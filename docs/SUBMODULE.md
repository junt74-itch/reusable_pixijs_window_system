# Git submodule integration

**正式な導入方法は Git submodule のみ**です。npm registry や Git URL からの package install はサポート対象外です。

このリポジトリをゲーム本体へ source dependency として固定する手順です。公開 source entry point はリポジトリ直下の `index.ts` です。barrel から Window / Host / Input を含む Current surface 全体を import できます。`src/**` への deep import は互換性保証の対象外です。

## Add and pin

```bash
git submodule add <repository-url> vendor/reusable_pixijs_window_system
git submodule update --init --recursive
git add .gitmodules vendor/reusable_pixijs_window_system
```

親リポジトリは submodule の commit を記録します。更新は submodule 内で検証済み commit を checkout し、親側で新しい gitlink を commit してください。branch の先端を暗黙追従させないでください。

## Direct source import

Vite / Bun など TypeScript source を処理できる環境では、ゲーム側から root barrel を import します。

```ts
import {
  VERSION,
  createPixiWindowHost,
  PixiWindowInput,
  MessageWindow,
  ChoiceWindow,
  bindFocusControllerToHost,
} from "../../vendor/reusable_pixijs_window_system/index.ts";
import type {
  PixiWindowHost,
  WindowConfig,
  MessageWindowOptions,
  PixiWindowInputOptions,
  WindowInputAdapter,
} from "../../vendor/reusable_pixijs_window_system/index.ts";
import type { Application } from "pixi.js";

export const gameVersion = VERSION;

/** Host は consumer が初期化済み Application から作る */
export function createGameHost(app: Application): PixiWindowHost {
  return createPixiWindowHost(app, { logicalWidth: 960, logicalHeight: 540 });
}

export function createGameInput(
  host: PixiWindowHost,
  options?: PixiWindowInputOptions,
): WindowInputAdapter {
  return new PixiWindowInput(host, options);
}

export function createMessageWindow(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: MessageWindowOptions,
): MessageWindow {
  return new MessageWindow(host, config, options);
}
```

`src/**` への deep import はしないでください。公開 barrel にない helper は内部実装であり、互換性保証の対象外です。

ホスト側 TypeScript は `moduleResolution: "Bundler"` と `.ts` import の解決を許可する必要があります。本リポジトリの [tsconfig.json](../tsconfig.json) が基準設定です。

型検査のみの網羅例は [`examples/consumer/submodule-source.ts`](../examples/consumer/submodule-source.ts) を参照してください（Window インスタンス化デモではなく barrel surface の型チェック）。ブラウザで動く最小 consumer 例は [`examples/consumer/minimal-submodule-runtime.ts`](../examples/consumer/minimal-submodule-runtime.ts) と [`minimal-submodule.html`](../examples/consumer/minimal-submodule.html) です。

## Built artifact import

ホストが TypeScript submodule source を直接処理しない場合は、submodule をビルドして `dist/index.js` と `dist/index.d.ts` を参照します。

```bash
bun --cwd vendor/reusable_pixijs_window_system install
bun --cwd vendor/reusable_pixijs_window_system run build
```

`dist/` を親リポジトリへ複製せず、alias や workspace 設定で submodule の出力を参照してください。

## PixiJS ownership

- consumer は互換バージョンの `pixi.js` を親プロジェクトへインストールします。対応範囲の正は `package.json` の `peerDependencies.pixi.js`（`>=8.20.1 <9`）です。
- ゲームと framework が別々の PixiJS runtime を bundle しないよう、ホスト bundler では同じ `pixi.js` 解決先を使用します。
- Host ごとに `PixiWindowInput` を1つ共有し、入力所有権は `activate()` / `deactivate()` と `ownsInput` で管理します。

## Font assets

**Sandbox には既定 font artifact（`examples/assets/fonts/jf-dot-mplus12/`）が含まれます。** 公開定数 `DEFAULT_BITMAP_FONT_ASSET` は sandbox 専用 URL を指します。consumer プロジェクトではこの定数や sandbox パスを使わず、独自の `BitmapFontAsset` を定義してください。参照実装は sandbox 用 `examples/preloadDefaultBitmapFont.ts` と consumer 用 `examples/consumer/minimal-submodule-runtime.ts` です。

| 責任 | 所有者 |
|---|---|
| `font.png` / `font.xml` / `license.txt` の配置 | consumer の asset pipeline |
| `Assets.load` | consumer（Window 構築前） |
| missing font | `BitmapFontNotLoadedError` |
| missing glyph | `MissingBitmapGlyphError` |
| window `destroy()` | 自前 display object のみ。共有 BitmapFont / Assets cache は残す |
| unload / `Assets.reset` | consumer または host 終了時。library は呼ばない |

ゲーム本体では必要な font artifact をゲームの asset pipeline に置き、consumer-owned URL と cache key で `Assets.load` 経由の bitmap font 読み込みを行ってください。texture は `scaleMode = "nearest"` を設定することを推奨します。runtime に font builder や GitHub access は不要です。

## Upgrade checklist

1. [CHANGE boundary](SPECIFICATION.md#compatibility-boundary) と公開 API 差分を確認する
2. `bun run check` を submodule 内で実行する
3. 親ゲームの typecheck / build / browser smoke test を実行する
4. submodule commit の更新とゲーム側変更を同じレビュー単位にする
