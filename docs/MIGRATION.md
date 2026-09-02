# Migration from reusable-phaser-window-system

対象: 移植元 commit `7cfd3156a5184193fe9e9e63958e5416d277e37e` → 本リポジトリ。

本ファイルは Phaser 版から PixiJS 版へ移行するときの破壊的変更と現行 landed surface の差分を記述します。根拠のない API 刷新はしません。

## Breaking（方針で承認済み）

1. runtime 依存は `phaser` ではなく consumer 所有の `pixi.js`（`peerDependencies.pixi.js`: `>=8.20.1 <9`）。library は PixiJS を bundle しない
2. すべての window コンストラクタ第 1 引数は `Phaser.Scene` ではなく `PixiWindowHost`
3. `PhaserWindowInput` → `PixiWindowInput`
4. `PhaserBitmapTextMeasurer` → `PixiBitmapTextMeasurer`
5. `bindFocusControllerToScene` → `bindFocusControllerToHost`
6. `WindowRendererFactoryContext.scene` → `.host`
7. Canvas renderer / GeometryMask fallback は提供しない（WebGL / WebGPU のみ）
8. フォント preload は `scene.load.bitmapFont` ではなく consumer 所有の `Assets.load({ alias: key, src: fontDataURL })`。sandbox 参照は `examples/preloadDefaultBitmapFont.ts`。`BitmapText.style.fontFamily` は asset `key`（Pixi cache は `${key}-bitmap`）。XML `base` は Pixi では `baseLineOffset = lineHeight - base` になるため、measurer は XML `base` を使う（P3）

## Compatible（維持する）

- `say` / `choose` / `chooseCommands` の戻り値と busy / cancel / destroy 契約
- theme / padding / chromeless（Graphics alpha 0 + borderWidth 0）
- RichText の span / align
- `ownsInput` と共有 input
- typed errors の class 名（エンジン名を含まないもの）
- submodule 入口はリポジトリ直下 `index.ts`

詳細分類は [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md)。

## PixiJS 固有の landed 差分

### Focus / host bind

Phaser 版の `bindFocusControllerToScene(scene, controller)` は `bindFocusControllerToHost(host, controller)` に Rename 済みです。host の `destroy` 購読で controller を `dispose()` し、application 側 dimmer は consumer が所有します。export と型は [API.md](API.md) の Current surface を正とします。

### NineSlice chrome

`createNineSliceWindowRenderer(context, options)` で consumer-owned NineSlice atlas を `WindowBaseOptions.createRenderer` に注入します。texture は事前に `Assets.load` 済みである必要があり、未ロードは `MissingWindowSkinError` です。Graphics chromeless（`backgroundAlpha: 0` + `borderWidth: 0`）との使い分けは [SPECIFICATION.md](SPECIFICATION.md#chrome-visibility) を参照してください。

### Three.js 統合

| 経路 | URL | 備考 |
|---|---|---|
| 別 canvas overlay（**標準**） | [http://localhost:5173/three-overlay.html](../three-overlay.html) | Three 下層 + Pixi 上層。canvas 2 枚。追加の context 共有コード不要 |
| 共有 WebGL context（任意） | [http://localhost:5173/three-shared-context.html](../three-shared-context.html) | canvas 1 枚。フレームごとの `resetState` 必須。**標準経路ではない** |

共有 context を標準にするかは [BACKLOG.md](BACKLOG.md) の人間判断待ちです。新規統合は overlay を既定としてください。
