# Source layout

公開入口はリポジトリ直下の [`index.ts`](../index.ts) と [`src/index.ts`](index.ts) です。`src/**` への deep import は互換性保証の対象外です。

## Public modules

| Directory | Responsibility |
|---|---|
| `core/` | theme 解決（`resolveWindowTheme`）、config 検証、content bounds 計算、open/close transition（`TransitionController`）、engine-free chrome renderer（`GraphicsWindowRenderer` + `GraphicsLike` / `GraphicsFactory`） |
| `skin/` | engine-free NineSlice skin 型（`NineSliceSkinOptions`、`MissingWindowSkinError`）。`NineSliceWindowRenderer` 描画は `pixi/` |
| `command/` | engine-free command record 型（`CommandItem`、`CommandResult`）と choice preflight（`assertCommandChoiceReady` / `toSelectableCommands` は barrel 非公開） |
| `pixi/` | PixiJS adapter（`WindowBase`、`TextWindowBase`、`MessageWindow`、`ChoiceWindow`、`CommandWindow`、`HelpWindow`、`LogWindow`、`DocumentWindow`、`SelectableWindow`、`CursorRenderer`、`ScrollableWindow`、`ScrollbarRenderer`、`PixiBitmapTextMeasurer`、`createDefaultGraphicsWindowRenderer` / `resolveWindowRenderer`、`ContentClipper`）。`ScrollContentClip` / `ScrollOverflowIndicators` / `createPixiGraphicsFactory` は barrel 非公開 |
| `log/` | engine-free log scroll helper（`shouldStickToLatest`）。`LogWindow` 描画は `pixi/LogWindow` |
| `input/` | keyboard / pointer / gamepad の意味入力 adapter 契約（`WindowInputAdapter`）と本番 adapter（`PixiWindowInput`） |
| `text/` | engine-free bitmap text layout（`layoutText` / `layoutRichText`）、RichText 正規化、font metrics / fallback（`FallbackBitmapTextMeasurer`）。`PixiBitmapTextMeasurer` / `createBitmapTextMeasurer` は `pixi/` |
| `message/` | engine-free message parser（`parseMessage`）、TextState reducer、semantic input 連携（`MessageController`）。`MessageWindow` 描画は `pixi/MessageWindow` |
| `selection/` | engine-free selection movement（`SelectionController`）、cursor blink 時計（`cursorBlinkVisible`）。`SelectableWindow` / `CursorRenderer` は `pixi/` |
| `scroll/` | engine-free scroll offset owner（`ScrollController`）、input binding（`bindScrollInput`）。Pixi 描画は `pixi/ScrollableWindow` / `ScrollbarRenderer` |
| `layout/` | viewport 内 window 配置（`layoutWindowInViewport`）。camera / host への subscribe は Window 側に置かない |
| `focus/` | scene/host 所有の排他 focus stack（`WindowFocusController`、`bindFocusControllerToHost`） |
| `host/` | PixiJS `Application` 境界（`createPixiWindowHost` / `PixiWindowHost`）。logical pixel 座標と destroy 購読。window レジストリは持たない |
| `a11y/` | captioner 向け semantic event バインディング（`bindWindowA11y`）。DOM / EventEmitter は作らない |

PixiJS 依存は `host/`、`pixi/`、`input/PixiWindowInput.ts` に置き、`core/` 以降の engine-free module と barrel の `core`/`text` 等は Pixi を import しません。

## 文書

- 目標仕様: [docs/SPECIFICATION.md](../docs/SPECIFICATION.md)
- 公開 API: [docs/API.md](../docs/API.md)
