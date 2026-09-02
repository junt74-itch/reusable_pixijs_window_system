# Public API compatibility map

分類は移植元 `src/index.ts`（commit `7cfd3156a5184193fe9e9e63958e5416d277e37e`）の export が対象。

- **Keep**: 名前と意味論を維持
- **Rename**: 意味論は維持し、Phaser 固有名だけ置換。MIGRATION.md に書く
- **Drop**: PixiJS 版では提供しない
- **Defer**: 移植後の BACKLOG。Phase 6 まで実装しない

Status は実装進捗（`queued` = 未着手、`landed` = 公開 barrel に乗った）。Keep でもコードが無ければ queued。

## Constructors and windows

| Phaser export | PixiJS | 分類 | Status | 注 |
|---|---|---|---|---|
| `WindowBase` | `WindowBase` | Keep | landed | 第 1 引数 `PixiWindowHost`（破壊的） |
| `TextWindowBase` | `TextWindowBase` | Keep | landed | 同上 |
| `MessageWindow` | `MessageWindow` | Keep | landed | `say()` 契約 Keep |
| `ChoiceWindow` | `ChoiceWindow` | Keep | landed | `choose()` 契約 Keep |
| `SelectableWindow` | `SelectableWindow` | Keep | landed | `TextWindowBase` 継承。`ScrollableWindow` は継承しない |
| `ScrollableWindow` | `ScrollableWindow` | Keep | landed | `WindowBase` を継承。Selectable は継承しない |
| `CommandWindow` | `CommandWindow` | Keep | landed | |
| `HelpWindow` | `HelpWindow` | Keep | landed | |
| `LogWindow` | `LogWindow` | Keep | landed | `ScrollableWindow` 継承 |
| `DocumentWindow` | `DocumentWindow` | Keep | landed | `ScrollableWindow` 継承 |
| `CursorRenderer` | `CursorRenderer` | Keep | landed | Pixi Graphics |
| `ScrollbarRenderer` | `ScrollbarRenderer` | Keep | landed | |
| `GraphicsWindowRenderer` | `GraphicsWindowRenderer` | Keep | landed | Pixi Graphics factory 注入 |
| `NineSliceWindowRenderer` | `NineSliceWindowRenderer` | Keep | landed | `NineSliceSprite` |
| `ContentClipper` | `ContentClipper` | Keep | landed | `Container.mask`。Canvas Drop |
| `WindowFocusController` | `WindowFocusController` | Keep | landed | Phaser-free のまま |

## Host and input

| Phaser export | PixiJS | 分類 | Status | 注 |
|---|---|---|---|---|
| `PhaserWindowInput` | `PixiWindowInput` | Rename | landed | 契約は `WindowInputAdapter`。key は `KeyboardEvent.code` |
| `PhaserWindowInputBindings` | `PixiWindowInputBindings` | Rename | landed | |
| `PhaserWindowInputOptions` | `PixiWindowInputOptions` | Rename | landed | |
| `bindFocusControllerToScene` | `bindFocusControllerToHost` | Rename | landed | host `onDestroy` で `dispose()` |
| — | `PixiWindowHost` | Rename\* | landed | Scene の置換。新規公開型 |
| — | `createPixiWindowHost` | Rename\* | landed | `Application` 向けヘルパー |

\* 移植元に無いが、Scene 削除に伴う必須公開面。人間承認済み方針に含まれる。

## Keep: types, functions, errors

名前を変えない。P1-T01 で landed したもの以外は queued。

**Landed (P1-T01):** `WindowConfig`, `WindowPadding`, `WindowTheme`, `ResolvedWindowTheme`, `WindowPhase`, `WindowBounds`, `WindowStateSnapshot`, `BitmapTextStyle`, `CursorStyle`, `TransitionState`, `TransitionSubscription`, `resolveWindowTheme`, `validateWindowConfig`, `computeContentBounds`, `TransitionController`, `WindowConfigError`, `WindowOperationCancelledError`, `WindowDestroyedError`, `WindowLayoutError`

**Landed (P1-T02):** `WindowInputAction`, `WindowInputPhase`, `WindowInputSource`, `WindowActionEvent`, `WindowPointerEvent`, `WindowWheelEvent`, `WindowDragPhase`, `WindowDragEvent`, 各 listener / subscription, `WindowInputAdapter`

**Landed (P1-T03):** `BitmapTextMeasurer` 一式, `LayoutLine`, `TextLayoutResult`, `TextAlign`, `RichTextSpan`, `RichText`, `WindowTextContent`, `BitmapFontAsset`, `layoutText`, `layoutRichText`, `DEFAULT_BITMAP_FONT_ASSET`, `FallbackBitmapTextMeasurer`, `MissingBitmapGlyphError`, `BitmapFontNotLoadedError`, `FontSwapBusyError`

**Landed (P1-T04):** `MessageToken`, `MessageParseResult`, `MessagePortraitOptions`, `MessageAudioHooks`, `TextState` 一式, `MessageStartRequest`, `MessageRenderSnapshot`, `parseMessage`, `createInitialTextState`, `reduceTextState`, `getRevealedText`, `getRevealedPageText`, `getRevealedPageColors`, `requiresAdvanceInput`, `MessageController`, `MissingMessagePortraitError`, `MessageBusyError`

**Landed (P1-T05):** `SelectableItem`, `SelectionControllerOptions`, `SelectionController`, `cursorBlinkVisible`, scroll types, `ScrollController`, `bindScrollInput`, `layoutWindowInViewport`, `ViewportAnchor`, `ViewportLayoutRequest`, focus types, `WindowFocusController`, `WindowFocusError`, a11y types, `bindWindowA11y`

**Landed (P1-T06):** `GraphicsWindowRenderer`, `WindowRenderer`, `GraphicsLike`, `GraphicsFactory`

**Landed (P2-T03):** `WindowRendererFactory`, `WindowRendererFactoryContext`（`.host`）、`createDefaultGraphicsWindowRenderer`, `resolveWindowRenderer`, `ContentClipper`, `ContentClipperUnsupportedError`, `PixiWindowInput`, `PixiWindowInputBindings`, `PixiWindowInputOptions`

**Landed (P2-T04 / P2-T05):** `WindowBase`, `WindowBaseOptions`。sandbox で一枚表示・操作・破棄を確認。

**Landed (P3-T01):** `PixiBitmapTextMeasurer`, `createBitmapTextMeasurer`, `TextWindowBase`

**Landed (P3-T03):** `ScrollableWindow`, `ScrollableWindowOptions`, `ScrollbarRenderer`, `ScrollbarRendererOptions`

**Landed (P4-T01):** `MessageWindow`, `MessageWindowOptions`, `MessageSayOptions`

**Landed (P4-T02):** `CursorRenderer`, `SelectableWindow`, `SelectableWindowOptions`, `RowBounds`, `ChoiceWindow`, `ChoiceOptions`, `ChoiceResult`, `ChoiceBusyError`, `ChoiceConfigurationError`

**Landed (P5-T01):** `CommandWindow`, `CommandWindowOptions`, `CommandItem`, `CommandResult`, `CommandBusyError`, `CommandConfigurationError`, `HelpWindow`

**Landed (P5-T02):** `LogWindow`, `DocumentWindow`, `shouldStickToLatest`

**Landed (P5-T03):** `bindFocusControllerToHost`

**Landed (P5-T04):** `NineSliceWindowRenderer`, `createNineSliceWindowRenderer`, `NineSliceSkinOptions`, `MissingWindowSkinError`

## Rename 詳細

| From | To | 理由 |
|---|---|---|
| `PhaserWindowInput` | `PixiWindowInput` | エンジン名 |
| `PhaserBitmapTextMeasurer` | `PixiBitmapTextMeasurer` | エンジン名 |
| `bindFocusControllerToScene` | `bindFocusControllerToHost` | Scene 廃止 |
| `WindowRendererFactoryContext.scene` | `.host` | Scene 廃止 |
| `createPhaserGraphicsFactory`（internal） | `createPixiGraphicsFactory` | internal。公開しない |

コンストラクタ第 1 引数の型変更は Rename ではなく **破壊的 Keep** として MIGRATION.md に書く。

## Drop

| Phaser 面 | 理由 |
|---|---|
| Canvas GeometryMask fallback | PixiJS v8 に Canvas 2D renderer が無い |
| `package.json` の `phaser` dependency | 製品ゴール |
| Phaser `Text` 禁止規則 | 代わりに Canvas/CSS/OS font 禁止と Pixi `Text`（非 BitmapText）禁止を置く |

## Defer（BACKLOG）

- Phaser 版と PixiJS 版の 1 パッケージ切替
- DOM accessibility tree
- 日本語禁則
- 複数 gamepad
- 小数 font scale
- 単一 WebGL context の Three.js 共有を標準経路にすること
- 互換マップに無い新 window 種（ItemList / inventory 等）

## Internal のまま（再 export しない）

移植元 `FORBIDDEN_INTERNAL_EXPORTS` を継承する:

`assertMessageSayPreflight`, `sayPreflight`, `splitLineColorRuns`, `computeLayoutPageBreaks`, `toSelectableCommands`, `ScrollContentClip`, `ScrollOverflowIndicators`, `isPointInContentViewport`, `splitTextFontRuns`, `stackedTextHeight`, `flattenRichText`, `scaleFontMetrics`, `collectPageFlatStyles`
