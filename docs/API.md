# Public API

規範的な lifecycle・ownership・互換性 boundary は [SPECIFICATION.md](SPECIFICATION.md)、Phaser 版との export 対応は [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md)、文書索引は [README.md](README.md) を参照してください。

**consumer 向け正式導入**: Git submodule → consumer 所有の `pixi.js`（`peerDependencies.pixi.js`: `>=8.20.1 <9`）→ consumer 所有フォント → repository root [`index.ts`](../index.ts) から import。最小実働例は [`examples/consumer/minimal-submodule-runtime.ts`](../examples/consumer/minimal-submodule-runtime.ts)。手順は [SUBMODULE.md](SUBMODULE.md)。

## Current surface（実装済み）

| Export | 型 | 説明 |
|---|---|---|
| `VERSION` | `string` | `"0.0.0"` — scaffold 版番号 |
| `resolveWindowTheme` | `(partial?: WindowTheme) => ResolvedWindowTheme` | partial theme を完全解決したスナップショットを返す |
| `validateWindowConfig` | `(config: WindowConfig) => void` | ウィンドウ geometry と theme を検証。無効時は `WindowConfigError` |
| `computeContentBounds` | `(width, height, padding) => WindowBounds` | padding を差し引いた content 矩形。非正なら `WindowLayoutError` |
| `TransitionController` | `class` | open/close phase と openness を delta 駆動で管理 |
| `GraphicsWindowRenderer` | `class` | `GraphicsFactory` 注入で chrome を描画する engine-free renderer |
| `NineSliceWindowRenderer` | `class` | consumer-owned NineSlice chrome。未ロード texture は `MissingWindowSkinError` |
| `createNineSliceWindowRenderer` | `(context, options) => WindowRenderer` | `NineSliceWindowRenderer` factory。`WindowBaseOptions.createRenderer` へ注入 |
| `MissingWindowSkinError` | `class extends Error` | window skin texture が未ロード |
| `WindowConfigError` | `class extends Error` | 設定値が無効 |
| `WindowOperationCancelledError` | `class extends Error` | 非同期操作がキャンセルされた |
| `WindowDestroyedError` | `class extends Error` | 破棄済みウィンドウへの操作 |
| `WindowLayoutError` | `class extends Error` | content 領域が非正 |
| `MissingBitmapGlyphError` | `class extends Error` | bitmap font に glyph が無い |
| `BitmapFontNotLoadedError` | `class extends Error` | 指定 font key が measurer に無い |
| `FontSwapBusyError` | `class extends Error` | 操作中の font swap |
| `layoutText` | `(text, measurer, options) => TextLayoutResult` | greedy bitmap-font layout |
| `layoutRichText` | `(content, measurer, options) => TextLayoutResult` | style-aware RichText layout |
| `DEFAULT_BITMAP_FONT_ASSET` | `BitmapFontAsset` | sandbox 専用 BMFont 記述子（`/examples/assets/fonts/jf-dot-mplus12/`）。consumer は独自 URL の `BitmapFontAsset` を定義し、配置・`Assets.load`・unload を所有すること |
| `FallbackBitmapTextMeasurer` | `class` | builder-font chain measurer |
| `PixiBitmapTextMeasurer` | `class` | Pixi `BitmapText` / font metrics measurer。第 1 引数 `PixiWindowHost` |
| `createBitmapTextMeasurer` | `(host, fontKeys) => OwnedBitmapTextMeasurer` | 1 キーなら `PixiBitmapTextMeasurer`、複数なら `FallbackBitmapTextMeasurer` |
| `TextWindowBase` | `abstract class` | BitmapText 描画 base（message 進行なし）。`WindowBase` を継承。RichText は `layoutRichText` → run ごとの BitmapText。欠損 glyph は `MissingBitmapGlyphError` |
| `MessageWindow` | `class` | `TextWindowBase` を継承した message window。`say(speaker, content, options)` でタイプライター表示。portrait / speaker 行 / pause 三角 / color run 描画 |
| `CursorRenderer` | `class` | 選択行 bounds 向け themed cursor（Pixi `Graphics` + blink） |
| `SelectableWindow` | `abstract class` | `TextWindowBase` を継承した selectable row window。独自 `ScrollController` + `scrollBody` 合成（`ScrollableWindow` は継承しない） |
| `ChoiceWindow` | `class` | `SelectableWindow` を継承。`choose(items, options)` Promise 契約 |
| `ChoiceBusyError` | `class extends Error` | 既に choice 操作中 |
| `ChoiceConfigurationError` | `class extends Error` | 空リスト / 全 disabled |
| `CommandWindow` | `class` | `SelectableWindow` を継承。`chooseCommands(items, options)` Promise 契約。confirm は `{ status: "selected", index, command }` |
| `CommandBusyError` | `class extends Error` | 既に command 選択操作中 |
| `CommandConfigurationError` | `class extends Error` | 空 command リスト / 全 disabled |
| `HelpWindow` | `class` | `TextWindowBase` を継承した help pane。`setHelp` / `getHelp`。overflow は page 0 のみ描画 |
| `LogWindow` | `class` | `ScrollableWindow` を継承した append-only log。最下部にいるときだけ stick |
| `DocumentWindow` | `class` | `ScrollableWindow` を継承した read-only wrapped document。typewriter なし |
| `shouldStickToLatest` | `(offset, maxOffset) => boolean` | scroll offset が最新位置か |
| `ScrollableWindow` | `class` | `WindowBase` を継承した scroll 合成。内側 `scrollBody`、`ScrollController`、clip viewport、任意 scrollbar / overflow 矢印 |
| `ScrollbarRenderer` | `class` | content-local 整数 pixel scrollbar track / thumb（`Graphics`）。`ScrollableWindow` の `showScrollbar: true` で使用 |
| `parseMessage` | `(text: string) => MessageParseResult` | MVP message syntax を immutable token 列へ解析 |
| `createInitialTextState` | `() => TextState` | タイプライター状態の初期値 |
| `reduceTextState` | `(tokens, state, input, charsPerSecond, options?) => TextStateStepResult` | delta / advance / skip / confirm で状態を 1 ステップ進める |
| `getRevealedText` | `(tokens, state) => string` | 全文に対する revealed 文字列 |
| `getRevealedPageText` | `(tokens, state, layoutPageBreaksByPage?) => string` | 現在 layout page の revealed 文字列 |
| `getRevealedPageColors` | `(tokens, state, layoutPageBreaksByPage?) => readonly (number \| null)[]` | 現在 layout page の per-glyph tint |
| `requiresAdvanceInput` | `(tokens, state, layoutPageBreaksByPage?) => boolean` | pause / page break / layout page 境界で confirm が必要か |
| `MessageController` | `class` | 1 メッセージ操作の lifecycle と snapshot 配信 |
| `MessageBusyError` | `class extends Error` | 既にメッセージ表示中 |
| `MissingMessagePortraitError` | `class extends Error` | portrait texture が未ロード（preflight 用） |
| `SelectionController` | `class` | engine-free selection movement と confirm/cancel |
| `cursorBlinkVisible` | `(elapsedMs, periodMs) => boolean` | cursor blink 時計 |
| `ScrollController` | `class` | scroll offset owner（clamp / page / wheel step） |
| `bindScrollInput` | `(adapter, controller, options) => ScrollInputBinding` | page / wheel / drag を ScrollController に接続 |
| `layoutWindowInViewport` | `(request) => WindowBounds` | viewport 内に整数 window bounds を配置 |
| `WindowFocusController` | `class` | scene/host 所有の排他 focus stack |
| `WindowFocusError` | `class extends Error` | focus 操作が無効 |
| `bindFocusControllerToHost` | `(host, controller) => () => void` | host destroy で focus controller を `dispose()`。application が dimmer を所有 |
| `bindWindowA11y` | `(options) => WindowA11ySubscription` | lifecycle / selection / message / focus を captioner イベントへ |
| `createPixiWindowHost` | `(app, options?) => PixiWindowHost` | 初期化済み PixiJS `Application` から logical pixel host 境界を作る。`Application.destroy` は呼ばない |
| `createDefaultGraphicsWindowRenderer` | `(context) => WindowRenderer` | 既定 Pixi `Graphics` chrome renderer を window root に生成 |
| `resolveWindowRenderer` | `(factory?, context) => WindowRenderer` | 注入 factory または既定 renderer を解決 |
| `ContentClipper` | `class` | content container 向け Pixi mask clipping |
| `ContentClipperUnsupportedError` | `class extends Error` | mask を適用できない |
| `PixiWindowInput` | `class` | keyboard（DOM `code`）/ pointer / wheel / gamepad 入力 adapter |
| `WindowBase` | `class` | 共通 window geometry、visual state、clipping、open/close transition。第 1 引数は `PixiWindowHost` |
| `WindowBaseOptions` | `{ input?, ownsInput?, createRenderer? }` | `WindowBase` コンストラクタ options |
| `MessageWindowOptions` | `WindowBaseOptions` + `{ portrait?, onType?, onPage?, onConfirm?, onCancel? }` | `MessageWindow` コンストラクタ options |
| `MessageSayOptions` | `{ charsPerSecond?, autoOpen?, closeOnComplete?, autoAdvanceMs?, autoAdvancePause?, portrait?, onType?, onPage?, onConfirm?, onCancel? }` | `MessageWindow.say()` options |
| `SelectableWindowOptions` | `WindowBaseOptions` + `SelectionControllerOptions` + `{ rowHeight?, columnGap?, rowGap?, showScrollbar?, rowOverscanPx? }` | `SelectableWindow` コンストラクタ options |
| `RowBounds` | `{ index, x, y, width, height }` | selectable 行 bounds |
| `ChoiceOptions` | `SelectableWindowOptions` + `{ cancelable?, initialSelection?, autoOpen?, closeOnComplete? }` | `ChoiceWindow.choose()` options |
| `ChoiceResult` | `{ status: "selected", index, item } \| { status: "cancelled" }` | `choose()` 解決値 |
| `CommandWindowOptions` | `SelectableWindowOptions` + `{ cancelable?, initialSelection?, autoOpen?, closeOnComplete?, onHighlight? }` | `CommandWindow.chooseCommands()` options |
| `CommandItem` | `{ id, label, enabled, help?, payload? }` | application 所有 command レコード |
| `CommandResult` | `{ status: "selected", index, command } \| { status: "cancelled" }` | `chooseCommands()` 解決値 |
| `ScrollableWindowOptions` | `WindowBaseOptions` + `ScrollControllerOptions` + `{ showScrollbar? }` | `ScrollableWindow` コンストラクタ options |
| `ScrollbarRendererOptions` | `{ trackWidth?, thumbMinHeight?, trackColor?, thumbColor? }` | scrollbar 描画パラメータ |

### Types（実装済み）

| Export | 説明 |
|---|---|
| `WindowConfig` | 初期 geometry と optional theme |
| `WindowPadding` | 四辺 padding（px） |
| `WindowTheme` | consumer が渡す partial theme |
| `ResolvedWindowTheme` | 完全解決済み immutable theme |
| `WindowPhase` | `"closed" \| "opening" \| "open" \| "closing"` |
| `WindowBounds` | ローカル座標矩形 |
| `WindowStateSnapshot` | 診断用 readonly 状態スナップショット |
| `BitmapTextStyle` | 解決済み bitmap text style |
| `CursorStyle` | selection cursor style |
| `TransitionState` | `{ phase, openness }` |
| `TransitionSubscription` | phase 変更購読の unsubscribe ハンドル |
| `WindowRenderer` | replaceable chrome renderer 契約（`background` / `frame` / resize / applyTheme / setOpenness / destroy） |
| `GraphicsLike` | headless テスト向け minimal Graphics 表面 |
| `GraphicsFactory` | `createBackground` / `createFrame` を供給する factory 契約 |
| `WindowInputAction` | 意味入力 action（`up` / `confirm` / `pageUp` など） |
| `WindowInputPhase` | action / pointer の phase（`pressed` / `repeated` / `released`） |
| `WindowInputSource` | 正規化入力の source device |
| `WindowActionEvent` | readonly action event スナップショット |
| `WindowPointerEvent` | readonly pointer event スナップショット |
| `WindowWheelEvent` | wheel scroll 意味イベント |
| `WindowDragPhase` | drag gesture phase（`started` / `moved` / `ended`） |
| `WindowDragEvent` | pointer drag 意味イベント（整数 delta） |
| `WindowActionListener` | action 購読コールバック |
| `WindowPointerListener` | pointer 購読コールバック |
| `WindowWheelListener` | wheel 購読コールバック |
| `WindowDragListener` | drag 購読コールバック |
| `WindowInputSubscription` | input 購読の unsubscribe ハンドル |
| `WindowInputAdapter` | window controller 向け injectable input 契約 |
| `BitmapTextMeasurer` | layout 向け measurement 契約 |
| `BitmapTextMeasureStyle` | measurer に渡す style |
| `BitmapTextMeasurement` | 計測結果 `{ width, height }` |
| `BitmapFontNativeMetrics` | native font metrics |
| `ScaledFontMetrics` | スケール済み ascent / descent / height |
| `LayoutLine` | 1 行分の layout 結果 |
| `LayoutLineRun` | 行内 font run |
| `TextLayoutResult` | `{ lines, pageCount }` |
| `TextLayoutOptions` | layout 入力（width / height / style / lineSpacing） |
| `TextAlign` | `"left" \| "center" \| "right"` |
| `RichTextSpan` | RichText span |
| `RichText` | span 配列 + optional align |
| `WindowTextContent` | `string \| RichText` |
| `BitmapFontAsset` | BMFont 記述子 `{ key, textureURL, fontDataURL }` |
| `MessageToken` | parser が返す discriminated union token |
| `MessageParseResult` | `{ tokens: readonly MessageToken[] }` |
| `MessagePortraitOptions` | portrait texture key / frame / size（Window 実装向け） |
| `MessageAudioHooks` | onType / onPage / onConfirm / onCancel コールバック |
| `TextState` | タイプライター reducer の readonly 状態 |
| `TextStateEffect` | pageChanged / completed 副作用 |
| `TextStateStepResult` | `{ state, effects }` |
| `MessageStartRequest` | `MessageController.start()` 入力 |
| `MessageRenderSnapshot` | controller が配信する revealed 表示スナップショット |
| `SelectableItem` | selection 行（id / label / value / enabled） |
| `SelectionControllerOptions` | columns / wrap / confirm / cancel hooks |
| `ScrollAxis` | `"x" \| "y"` |
| `ScrollBounds` | scroll offset スナップショット |
| `ScrollChangeListener` | bounds 変更コールバック |
| `ScrollChangeSubscription` | scroll 購読の unsubscribe ハンドル |
| `ScrollControllerOptions` | axis / pageStepRatio / wheelStepPx |
| `ViewportAnchor` | viewport 内 9 方向アンカー |
| `ViewportLayoutRequest` | viewport layout 入力 |
| `FocusableWindow` | activate / deactivate / isActive / isDestroyed 契約 |
| `FocusAcquireOptions` | `{ modal?: boolean }` |
| `FocusSnapshot` | active window / modal / stackDepth |
| `FocusChangeListener` | focus 変更コールバック |
| `FocusChangeSubscription` | focus 購読の unsubscribe ハンドル |
| `WindowA11yEvent` | captioner 向け discriminated union |
| `WindowA11yListener` | a11y イベントコールバック |
| `WindowA11ySubscription` | a11y 購読の unsubscribe ハンドル |
| `BindWindowA11yOptions` | windowId / listener / optional sources |
| `A11yLifecycleSource` | transition phase 購読 |
| `A11ySelectionSource` | selection 変更購読 |
| `A11yMessageSource` | message snapshot 購読 |
| `A11yFocusSource` | focus snapshot 購読 + window id 解決 |
| `PixiWindowHost` | stage / renderer / canvas / ticker / logical size / destroy 購読契約 |
| `PixiWindowHostOptions` | optional `logicalWidth` / `logicalHeight` 上書き |
| `WindowRendererFactory` | `(context) => WindowRenderer` — chrome renderer 注入 factory |
| `WindowRendererFactoryContext` | `{ host: PixiWindowHost, root: Container }` |
| `NineSliceSkinOptions` | consumer-owned NineSlice atlas 記述子（`textureKey`、slice 幅、`tileX` / `tileY` は unsupported） |
| `PixiWindowInputBindings` | action ごとの `KeyboardEvent.code` 配列 |
| `PixiWindowInputOptions` | bindings / gamepad / deadzone / localToWorld |
| `WindowBaseOptions` | optional `input` / `ownsInput` / `createRenderer` |

### 公開 entry point

| 利用形態 | Entry point |
|---|---|
| Git submodule の source import（**consumer 正式**） | repository root `index.ts` |
| 本リポジトリ内の source/build | `src/index.ts` |
| Build artifact | `dist/index.js` / `dist/index.d.ts` |

consumer は `src/**` へ deep import しません。`dist/` を使う場合も package 名 import ではなく submodule 配置からの path / alias を使い、互換 range 内の `pixi.js` を consumer が所有します。

```ts
import {
  VERSION,
  resolveWindowTheme,
  validateWindowConfig,
  TransitionController,
  GraphicsWindowRenderer,
  createNineSliceWindowRenderer,
  layoutText,
  layoutRichText,
  parseMessage,
  MessageController,
  createInitialTextState,
} from "reusable-pixijs-window-system";
import type { GraphicsFactory, GraphicsLike, NineSliceSkinOptions } from "reusable-pixijs-window-system";

const theme = resolveWindowTheme({ padding: 8 });
validateWindowConfig({ x: 0, y: 0, width: 200, height: 100, theme });

const controller = new TransitionController(theme.transitionDurationMs);
void controller.open();
controller.update(16); // host tick から deltaMs を渡す

const { tokens } = parseMessage("Hello{pause}world");
const message = new MessageController(null);
void message.start({ tokens, charsPerSecond: 30 });
message.update(16);
const snapshot = message.getLatestSnapshot();
void createInitialTextState(); // reducer 初期値

// measurer は consumer または PixiBitmapTextMeasurer / createBitmapTextMeasurer が供給する
// layoutText("hello", measurer, { width, height, style, lineSpacing });

// chrome renderer は consumer または createDefaultGraphicsWindowRenderer が供給する
const factory: GraphicsFactory = {
  createBackground: (): GraphicsLike => ({ clear() {}, fillStyle() { return this; }, lineStyle() { return this; }, fillRect() { return this; }, strokeRect() { return this; }, setVisible() {}, setAlpha() {}, destroy() {} }),
  createFrame: (): GraphicsLike => ({ clear() {}, fillStyle() { return this; }, lineStyle() { return this; }, fillRect() { return this; }, strokeRect() { return this; }, setVisible() {}, setAlpha() {}, destroy() {} }),
};
const chrome = new GraphicsWindowRenderer(factory);
chrome.applyTheme(theme);
chrome.resize(200, 100);

// NineSlice skin は consumer が Assets.load 後、createRenderer で注入する
const skinOptions: NineSliceSkinOptions = {
  textureKey: "window-skin",
  leftWidth: 8,
  rightWidth: 8,
  topHeight: 8,
  bottomHeight: 8,
};
void skinOptions;
void createNineSliceWindowRenderer;
```

submodule の設定例は [SUBMODULE.md](SUBMODULE.md) にあります。`src/index.ts` が export しない module への deep import は公開 API ではありません。

## Phaser 版からの Rename

| Phaser 版 | PixiJS 版 |
|---|---|
| コンストラクタ第 1 引数 `Scene` | `PixiWindowHost` |
| `PhaserWindowInput` | `PixiWindowInput` |
| `PhaserBitmapTextMeasurer` | `PixiBitmapTextMeasurer` |
| `bindFocusControllerToScene` | `bindFocusControllerToHost` |
| `scene.load.bitmapFont(...)` | consumer 所有の `Assets.load(...)` |

破壊的変更の詳細は [MIGRATION.md](MIGRATION.md) を参照してください。Keep / Rename / Drop / **Defer** の一覧は [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md) を正とします（Defer 例: sandbox `?scene=` カタログ — [BACKLOG.md](BACKLOG.md)）。

sandbox（`examples/main.ts`）は `MessageWindow.say` → `ChoiceWindow.choose` の統合デモです。Three.js **標準**は [three-overlay.html](../three-overlay.html)、共有 context は [three-shared-context.html](../three-shared-context.html)（任意）。

## インストール（本リポジトリのローカル開発のみ）

consumer 向け正式導入は Git submodule です（[SUBMODULE.md](SUBMODULE.md)）。以下は **このリポジトリを clone して開発・確認する場合** のみです。

```bash
bun install
bun run build
```

npm publish / release tag の手順は Phase 6 までスコープ外です。`private: true` の scaffold 版番号であり、完成した配布物ではありません。

## フォント

consumer が `Assets.load({ alias, src: fontDataURL })` で BMFont artifact（`font.png` + `font.xml`）を preload します。`DEFAULT_BITMAP_FONT_ASSET` は sandbox 専用（`/examples/assets/fonts/jf-dot-mplus12/`）であり、consumer コードでは使いません。consumer は独自 `BitmapFontAsset` を定義してください。Canvas / CSS / OS font および Pixi `Text`（非 BitmapText）は禁止です。詳細は [SPECIFICATION.md](SPECIFICATION.md#text-and-font-contract) と [ADR 0002](adr/0002-bitmap-font-loading.md)。

## ブラウザサポート（目標）

| 項目 | 目標 |
|---|---|
| Renderer | WebGL（PixiJS v8） |
| Clipping | WebGL mask のみ — Canvas fallback **なし**（Drop、[ADR 0001](adr/0001-content-clipping.md)） |
| ゲームパッド | 最初の 1 台のみ。未接続は no-op |
| Canvas text | **禁止** — ウィンドウ内は BitmapText のみ |
