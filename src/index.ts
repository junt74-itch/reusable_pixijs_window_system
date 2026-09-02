/** Public API for the reusable PixiJS window system. */

export const VERSION = "0.0.0";

export type {
  WindowConfig,
  WindowPadding,
  WindowTheme,
  ResolvedWindowTheme,
  WindowPhase,
  WindowBounds,
  WindowStateSnapshot,
  BitmapTextStyle,
  CursorStyle,
} from "./core/types.ts";

export {
  WindowConfigError,
  WindowOperationCancelledError,
  WindowDestroyedError,
  WindowLayoutError,
} from "./core/types.ts";

export { resolveWindowTheme, validateWindowConfig, computeContentBounds } from "./core/theme.ts";
export { TransitionController } from "./core/TransitionController.ts";
export type { TransitionState, TransitionSubscription } from "./core/TransitionController.ts";
export { GraphicsWindowRenderer } from "./core/GraphicsWindowRenderer.ts";
export type { WindowRenderer, GraphicsLike, GraphicsFactory } from "./core/WindowRenderer.ts";

export type {
  WindowInputAction,
  WindowInputPhase,
  WindowInputSource,
  WindowActionEvent,
  WindowPointerEvent,
  WindowWheelEvent,
  WindowDragPhase,
  WindowDragEvent,
  WindowActionListener,
  WindowPointerListener,
  WindowWheelListener,
  WindowDragListener,
  WindowInputSubscription,
} from "./input/types.ts";
export type { WindowInputAdapter } from "./input/WindowInputAdapter.ts";

export type {
  BitmapTextMeasurer,
  BitmapTextMeasureStyle,
  BitmapTextMeasurement,
  BitmapFontNativeMetrics,
  ScaledFontMetrics,
  LayoutLine,
  LayoutLineRun,
  TextLayoutResult,
  TextLayoutOptions,
  TextAlign,
  RichTextSpan,
  RichText,
  WindowTextContent,
} from "./text/types.ts";
export { MissingBitmapGlyphError, BitmapFontNotLoadedError, FontSwapBusyError } from "./text/types.ts";
export { layoutText, layoutRichText } from "./text/TextLayout.ts";
export { DEFAULT_BITMAP_FONT_ASSET } from "./text/BitmapFontAsset.ts";
export type { BitmapFontAsset } from "./text/BitmapFontAsset.ts";
export { FallbackBitmapTextMeasurer } from "./text/FallbackBitmapTextMeasurer.ts";
export { PixiBitmapTextMeasurer, createBitmapTextMeasurer } from "./pixi/PixiBitmapTextMeasurer.ts";
export { TextWindowBase } from "./pixi/TextWindowBase.ts";
export { MessageWindow } from "./pixi/MessageWindow.ts";
export type { MessageWindowOptions, MessageSayOptions } from "./pixi/MessageWindow.ts";
export { CursorRenderer } from "./pixi/CursorRenderer.ts";
export { SelectableWindow } from "./pixi/SelectableWindow.ts";
export type { SelectableWindowOptions, RowBounds } from "./pixi/SelectableWindow.ts";
export {
  ChoiceWindow,
  ChoiceBusyError,
  ChoiceConfigurationError,
} from "./pixi/ChoiceWindow.ts";
export type { ChoiceOptions, ChoiceResult } from "./pixi/ChoiceWindow.ts";
export {
  CommandWindow,
  CommandBusyError,
  CommandConfigurationError,
} from "./pixi/CommandWindow.ts";
export type { CommandWindowOptions } from "./pixi/CommandWindow.ts";
export type { CommandItem, CommandResult } from "./command/types.ts";
export { HelpWindow } from "./pixi/HelpWindow.ts";
export { LogWindow } from "./pixi/LogWindow.ts";
export { DocumentWindow } from "./pixi/DocumentWindow.ts";
export { shouldStickToLatest } from "./log/stickToLatest.ts";
export { ScrollableWindow } from "./pixi/ScrollableWindow.ts";
export type { ScrollableWindowOptions } from "./pixi/ScrollableWindow.ts";
export { ScrollbarRenderer } from "./pixi/ScrollbarRenderer.ts";
export type { ScrollbarRendererOptions } from "./pixi/ScrollbarRenderer.ts";

export type {
  MessageToken,
  MessageParseResult,
  MessagePortraitOptions,
  MessageAudioHooks,
} from "./message/types.ts";
export { MissingMessagePortraitError } from "./message/types.ts";
export type {
  TextState,
  TextStateEffect,
  TextStateStepResult,
} from "./message/TextState.ts";
export type { MessageStartRequest, MessageRenderSnapshot } from "./message/MessageController.ts";
export { MessageBusyError, MessageController } from "./message/MessageController.ts";
export { parseMessage } from "./message/MessageParser.ts";
export {
  createInitialTextState,
  reduceTextState,
  getRevealedText,
  getRevealedPageText,
  getRevealedPageColors,
  requiresAdvanceInput,
} from "./message/TextState.ts";

export type { SelectableItem, SelectionControllerOptions } from "./selection/types.ts";
export { SelectionController } from "./selection/SelectionController.ts";
export { cursorBlinkVisible } from "./selection/cursorBlink.ts";

export { ScrollController } from "./scroll/ScrollController.ts";
export { bindScrollInput } from "./scroll/scrollInputBinding.ts";
export type {
  ScrollAxis,
  ScrollBounds,
  ScrollChangeListener,
  ScrollChangeSubscription,
  ScrollControllerOptions,
} from "./scroll/types.ts";

export { layoutWindowInViewport } from "./layout/viewportLayout.ts";
export type { ViewportAnchor, ViewportLayoutRequest } from "./layout/viewportLayout.ts";

export { WindowFocusController } from "./focus/WindowFocusController.ts";
export { bindFocusControllerToHost } from "./focus/bindHostDestroy.ts";
export { WindowFocusError } from "./focus/types.ts";
export type {
  FocusableWindow,
  FocusAcquireOptions,
  FocusSnapshot,
  FocusChangeListener,
  FocusChangeSubscription,
} from "./focus/types.ts";

export { createPixiWindowHost } from "./host/createPixiWindowHost.ts";
export type { PixiWindowHost, PixiWindowHostOptions } from "./host/types.ts";

export {
  createDefaultGraphicsWindowRenderer,
  resolveWindowRenderer,
} from "./pixi/windowRendererFactory.ts";
export {
  NineSliceWindowRenderer,
  createNineSliceWindowRenderer,
} from "./pixi/NineSliceWindowRenderer.ts";
export { MissingWindowSkinError } from "./skin/types.ts";
export type { NineSliceSkinOptions } from "./skin/types.ts";
export type {
  WindowRendererFactory,
  WindowRendererFactoryContext,
} from "./pixi/windowRendererFactory.ts";
export { ContentClipper, ContentClipperUnsupportedError } from "./pixi/ContentClipper.ts";
export { WindowBase } from "./pixi/WindowBase.ts";
export type { WindowBaseOptions } from "./pixi/WindowBase.ts";
export { PixiWindowInput } from "./input/PixiWindowInput.ts";
export type { PixiWindowInputBindings, PixiWindowInputOptions } from "./input/PixiWindowInput.ts";

export { bindWindowA11y } from "./a11y/bindWindowA11y.ts";
export type {
  WindowA11yEvent,
  WindowA11yListener,
  WindowA11ySubscription,
  BindWindowA11yOptions,
  A11yLifecycleSource,
  A11ySelectionSource,
  A11yMessageSource,
  A11yFocusSource,
} from "./a11y/types.ts";
