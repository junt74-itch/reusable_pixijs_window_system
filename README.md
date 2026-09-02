# reusable_pixijs_window_system

PixiJS v8.x を唯一の描画基盤とする TypeScript 製ゲーム UI ライブラリ。移植元は [`reusable_phaser_window_system`](https://github.com/junt74-itch/reusable_phaser_window_system) の pin commit（[PORTING_BASELINE.md](PORTING_BASELINE.md)）。

公開 symbol の一覧は [docs/API.md](docs/API.md) の Current surface を正とします。

[![check](https://github.com/junt74-itch/reusable_pixijs_window_system/actions/workflows/check.yml/badge.svg)](https://github.com/junt74-itch/reusable_pixijs_window_system/actions/workflows/check.yml)

## 他プロジェクトへ導入する場合

**正式な導入方法は Git submodule のみ**です。npm registry や Git URL からの package install はサポート対象外です。詳細手順は [docs/SUBMODULE.md](docs/SUBMODULE.md) を参照してください。

1. **submodule を追加する**

   ```bash
   git submodule add <repository-url> vendor/reusable_pixijs_window_system
   git submodule update --init --recursive
   ```

2. **consumer 側で互換 version の `pixi.js` を追加する**（`peerDependencies.pixi.js`: `>=8.20.1 <9`）。library と consumer で同じ `pixi.js` 解決先を使ってください。

3. **フォント asset を consumer へ配置する**（`font.png` / `font.xml` / `license.txt`）。参照例は [`examples/consumer/assets/fonts/game-font/`](examples/consumer/assets/fonts/game-font/) です。

   - 配置・`Assets.load`・unload は **consumer** の責任です。Window 構築前に `Assets.load` してください。
   - `window.destroy()` は display object のみ破棄し、共有 BitmapFont / Assets cache は unload しません。unload / `Assets.reset` は consumer または host 終了時に行います。
   - **`DEFAULT_BITMAP_FONT_ASSET` は sandbox 専用**（`/examples/assets/fonts/jf-dot-mplus12/`）です。consumer コードでは使わず、下記例のように独自 `BitmapFontAsset` を定義してください。

4. **root `index.ts` から import する**（`src/**` への deep import は互換性保証の対象外）。

5. **最小初期化コード**（実働例 [`examples/consumer/minimal-submodule-runtime.ts`](examples/consumer/minimal-submodule-runtime.ts) と同一。import パスも同じ `../../index.ts`）:

   ```ts
   import { Application, Assets, type BitmapFont } from "pixi.js";
   import {
     createPixiWindowHost,
     PixiWindowInput,
     MessageWindow,
     ChoiceWindow,
     layoutWindowInViewport,
   } from "../../index.ts";
   import type { BitmapFontAsset } from "../../index.ts";

   const LOGICAL_WIDTH = 960;
   const LOGICAL_HEIGHT = 540;
   const FONT_KEY = "game-font";
   const CHOICE_CONTINUE = "続ける";
   const CHOICE_STOP = "やめる";

   const GAME_FONT: BitmapFontAsset = {
     key: FONT_KEY,
     textureURL: new URL("./assets/fonts/game-font/font.png", import.meta.url).href,
     fontDataURL: new URL("./assets/fonts/game-font/font.xml", import.meta.url).href,
   };

   async function preloadGameFont(): Promise<BitmapFont> {
     const font = await Assets.load<BitmapFont>({
       alias: GAME_FONT.key,
       src: GAME_FONT.fontDataURL,
     });

     for (const page of font.pages) {
       page.texture.source.scaleMode = "nearest";
     }

     return font;
   }

   function applyLetterbox(canvas: HTMLCanvasElement): void {
     const scaleX = Math.trunc(window.innerWidth / LOGICAL_WIDTH);
     const scaleY = Math.trunc(window.innerHeight / LOGICAL_HEIGHT);
     const scale = Math.max(1, Math.min(scaleX, scaleY));
     canvas.style.width = `${LOGICAL_WIDTH * scale}px`;
     canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
   }

   async function main(): Promise<void> {
     const appRoot = document.getElementById("app");
     if (!appRoot) {
       throw new Error("#app element not found");
     }

     const app = new Application();
     await app.init({
       width: LOGICAL_WIDTH,
       height: LOGICAL_HEIGHT,
       roundPixels: true,
       antialias: false,
       backgroundColor: 0x101820,
     });

     appRoot.appendChild(app.canvas);
     applyLetterbox(app.canvas);

     const host = createPixiWindowHost(app, {
       logicalWidth: LOGICAL_WIDTH,
       logicalHeight: LOGICAL_HEIGHT,
     });

     await preloadGameFont();

     const input = new PixiWindowInput(host);

     const messageBounds = layoutWindowInViewport({
       viewportWidth: LOGICAL_WIDTH,
       viewportHeight: LOGICAL_HEIGHT,
       width: 520,
       height: 140,
       margin: 40,
       anchor: "top-center",
     });

     const choiceBounds = layoutWindowInViewport({
       viewportWidth: LOGICAL_WIDTH,
       viewportHeight: LOGICAL_HEIGHT,
       width: 280,
       height: 120,
       margin: 40,
       anchor: "bottom-center",
     });

     const messageWindow = new MessageWindow(
       host,
       {
         x: messageBounds.x,
         y: messageBounds.y,
         width: messageBounds.width,
         height: messageBounds.height,
         theme: { text: { fontKey: FONT_KEY } },
       },
       { input, ownsInput: true },
     );

     const choiceWindow = new ChoiceWindow(
       host,
       {
         x: choiceBounds.x,
         y: choiceBounds.y,
         width: choiceBounds.width,
         height: choiceBounds.height,
         theme: { text: { fontKey: FONT_KEY } },
       },
       { input, ownsInput: false },
     );

     app.ticker.add((ticker) => {
       if (!input.isAdapterDisposed()) {
         input.update(ticker.deltaMS);
       }
       if (!messageWindow.isDestroyed()) {
         messageWindow.update(ticker.lastTime, ticker.deltaMS);
       }
       if (!choiceWindow.isDestroyed()) {
         choiceWindow.update(ticker.lastTime, ticker.deltaMS);
       }
     });

     window.addEventListener("resize", () => {
       applyLetterbox(app.canvas);
     });

     messageWindow.activate();
     choiceWindow.deactivate();

     await messageWindow.say(null, "consumer 例です。\f2ページ目です。");

     messageWindow.deactivate();
     choiceWindow.activate();

     await choiceWindow.choose([CHOICE_CONTINUE, CHOICE_STOP]);

     choiceWindow.destroy();
     messageWindow.destroy();
     host.destroy();
   }

   main().catch((error: unknown) => {
     console.error(error);
   });
   ```

   親プロジェクトでは import パスを submodule の配置位置へ、フォント URL を親の asset pipeline へ読み替えてください。

6. **親プロジェクトで typecheck / build / browser smoke test を実行する**

ブラウザ実働確認: [`examples/consumer/minimal-submodule.html`](examples/consumer/minimal-submodule.html)（`bun run dev` 後 [http://localhost:5173/examples/consumer/minimal-submodule.html](http://localhost:5173/examples/consumer/minimal-submodule.html)）。

型検査 fixture（`bun run build` 後の package 名 import を型検査するのみ。npm 導入例ではない）: [`examples/consumer/readme-example.ts`](examples/consumer/readme-example.ts)。barrel surface の型検査 fixture（実働例ではない）: [`examples/consumer/submodule-source.ts`](examples/consumer/submodule-source.ts)。

## このリポジトリを開発・確認する場合

```bash
bun install
bun run check
```

`check` は unit test・型チェック・library build・package 検証・consumer 型チェックを順に実行します。

[`examples/main.ts`](examples/main.ts) は library 内部 sandbox です。`../src/**` を直接 import しており、consumer 向け導入例ではありません。consumer 向けの最小実働例は [`examples/consumer/minimal-submodule-runtime.ts`](examples/consumer/minimal-submodule-runtime.ts) を参照してください。

### Sandbox（ローカル）

`MessageWindow.say` → `ChoiceWindow.choose` の統合デモ（移植元 `IntegrationScene` 相当）。共有 `PixiWindowInput`（Message `ownsInput: true`、Choice `false`）、日本語 + ページ送り、Continue/Stop ループ。論理 960×540 を整数倍 letterbox で表示します。

```bash
bun run dev
```

- 既定 sandbox: [http://localhost:5173/](http://localhost:5173/)
- consumer 最小例: [http://localhost:5173/examples/consumer/minimal-submodule.html](http://localhost:5173/examples/consumer/minimal-submodule.html)

Three.js 統合例:

| 例 | URL | 備考 |
|---|---|---|
| 別 canvas overlay（**標準**） | [http://localhost:5173/three-overlay.html](http://localhost:5173/three-overlay.html) | Three 下層 + Pixi 上層。canvas 2 枚 |
| 共有 WebGL context（任意） | [http://localhost:5173/three-shared-context.html](http://localhost:5173/three-shared-context.html) | canvas 1 枚。`resetState` 必須。**標準経路ではない** |

#### say → choose ループ

起動後、MessageWindow が日本語メッセージ（`\f` ページ送り付き）を表示し、確定後に ChoiceWindow で「続ける」「やめる」を選べます。「続ける」で次の iteration、「やめる」でループ停止。Enter / Space で確定（`PixiWindowInput` 既定 binding）。

#### 演習キー（MessageWindow 対象）

デモ専用。`PixiWindowInput` の binding には追加していません。

| code | 操作 |
|---|---|
| `KeyC` | MessageWindow close |
| `KeyO` | MessageWindow open |
| `KeyH` | MessageWindow hide |
| `KeyS` | MessageWindow show |
| `KeyD` | pending `say` / `choose` 中に window を destroy（`WindowOperationCancelledError` 演習。say は MessageWindow、choose は ChoiceWindow） |

Phaser からの破壊的変更: [docs/MIGRATION.md](docs/MIGRATION.md)

## 文書

- 仕様: [docs/SPECIFICATION.md](docs/SPECIFICATION.md)
- 公開 API: [docs/API.md](docs/API.md)
- submodule 統合: [docs/SUBMODULE.md](docs/SUBMODULE.md)
- 進行: [docs/PROGRESS.md](docs/PROGRESS.md)
- 計画: [docs/PORTING_PLAN.md](docs/PORTING_PLAN.md)
- Phaser 版との差分: [docs/API_COMPATIBILITY_MAP.md](docs/API_COMPATIBILITY_MAP.md) / [docs/MIGRATION.md](docs/MIGRATION.md)
- 索引: [docs/README.md](docs/README.md)
- 方針: [Reusable PixiJS Window System 移植・開発方針.md](Reusable%20PixiJS%20Window%20System%20移植・開発方針.md)

submodule から source を import する安定入口は、リポジトリ直下の [`index.ts`](index.ts) です。`src/**` への deep import は互換性保証の対象外です。

## 開発役割

仕様・進行・レビューは Grok 4.6、実装は Compose 2.5。次の実装タスクは [docs/PROGRESS.md](docs/PROGRESS.md) を正とする。
