import {
  VERSION,
  resolveWindowTheme,
  validateWindowConfig,
  computeContentBounds,
  TransitionController,
  GraphicsWindowRenderer,
  layoutText,
  layoutRichText,
  parseMessage,
  MessageController,
  createInitialTextState,
  createPixiWindowHost,
  createDefaultGraphicsWindowRenderer,
  resolveWindowRenderer,
  ContentClipper,
  PixiWindowInput,
  PixiBitmapTextMeasurer,
  createBitmapTextMeasurer,
  TextWindowBase,
  MessageWindow,
  ScrollableWindow,
  ScrollbarRenderer,
  ScrollController,
  ChoiceBusyError,
  ChoiceConfigurationError,
  CommandBusyError,
  CommandConfigurationError,
  shouldStickToLatest,
  WindowFocusController,
  bindFocusControllerToHost,
  createNineSliceWindowRenderer,
} from "../../index.ts";
import type {
  WindowConfig,
  BitmapTextMeasurer,
  TextLayoutOptions,
  TextLayoutResult,
  MessageToken,
  MessageRenderSnapshot,
  GraphicsFactory,
  GraphicsLike,
  PixiWindowHost,
  WindowRendererFactoryContext,
  WindowRendererFactory,
  PixiWindowInputOptions,
  WindowInputAdapter,
  ScrollableWindowOptions,
  ScrollbarRendererOptions,
  MessageWindowOptions,
  MessageSayOptions,
  ChoiceOptions,
  ChoiceResult,
  CommandWindowOptions,
  CommandItem,
  CommandResult,
  LogWindow,
  DocumentWindow,
  NineSliceSkinOptions,
} from "../../index.ts";
import type { Application, Container } from "pixi.js";

export const submoduleSourceVersion = VERSION;

const config: WindowConfig = { x: 0, y: 0, width: 80, height: 40 };
validateWindowConfig(config);

const theme = resolveWindowTheme();
export const submoduleSourceBounds = computeContentBounds(80, 40, theme.padding);
export const submoduleSourceController = new TransitionController(theme.transitionDurationMs);

export function submoduleSourceLayout(
  measurer: BitmapTextMeasurer,
  options: TextLayoutOptions,
): TextLayoutResult {
  return layoutRichText({ spans: [{ text: "ok" }] }, measurer, options) ?? layoutText("", measurer, options);
}

export function submoduleSourceMessage(tokens: readonly MessageToken[]): MessageRenderSnapshot {
  const controller = new MessageController(null);
  void controller.start({ tokens, charsPerSecond: 30 });
  controller.update(16);
  return controller.getLatestSnapshot();
}

export const submoduleSourceParsed = parseMessage("hello");
export const submoduleSourceTextState = createInitialTextState();

/** Type-only chrome renderer surface check — no Pixi Graphics runtime. */
export function submoduleSourceChrome(factory: GraphicsFactory): GraphicsWindowRenderer {
  const renderer = new GraphicsWindowRenderer(factory);
  renderer.applyTheme(theme);
  renderer.resize(80, 40);
  return renderer;
}

export function acceptSubmoduleGraphicsLike(_graphics: GraphicsLike): void {}

/** Type-only host surface check — no Application runtime. */
export function submoduleSourceHost(app: Application): PixiWindowHost {
  return createPixiWindowHost(app, { logicalWidth: 960, logicalHeight: 540 });
}

export function submoduleSourceRendererFactory(
  context: WindowRendererFactoryContext,
  factory?: WindowRendererFactory,
): ReturnType<typeof resolveWindowRenderer> {
  return resolveWindowRenderer(factory, context);
}

export function submoduleSourceDefaultRenderer(context: WindowRendererFactoryContext): ReturnType<
  typeof createDefaultGraphicsWindowRenderer
> {
  return createDefaultGraphicsWindowRenderer(context);
}

export function submoduleSourceClipper(host: PixiWindowHost): ContentClipper {
  return new ContentClipper(host);
}

export function submoduleSourcePixiInput(
  host: PixiWindowHost,
  options?: PixiWindowInputOptions,
): WindowInputAdapter {
  return new PixiWindowInput(host, options);
}

export function acceptSubmoduleRendererContext(_context: WindowRendererFactoryContext): void {}

export function acceptSubmoduleContentRoot(_root: Container): void {}

export function submoduleSourceMeasurer(
  host: PixiWindowHost,
  fontKeys: readonly string[],
): BitmapTextMeasurer {
  return createBitmapTextMeasurer(host, fontKeys);
}

export class SubmoduleSourceTextWindow extends TextWindowBase {}

export function submoduleSourceMessageWindow(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: MessageWindowOptions,
): MessageWindow {
  return new MessageWindow(host, config, options);
}

export function acceptSubmoduleMessageSayOptions(_options: MessageSayOptions): void {}

export function acceptSubmoduleChoiceOptions(_options: ChoiceOptions): void {}

export function acceptSubmoduleChoiceResult(_result: ChoiceResult<string>): void {}

export function acceptSubmoduleCommandOptions(_options: CommandWindowOptions): void {}

export function acceptSubmoduleCommandResult(_result: CommandResult<{ action: string }>): void {}

export function acceptSubmoduleCommandItem(_item: CommandItem<{ action: string }>): void {}

export function acceptSubmoduleLogWindow(_window: LogWindow): void {}

export function acceptSubmoduleDocumentWindow(_window: DocumentWindow): void {}

export const submoduleSourceStickToLatest = shouldStickToLatest(0, 0);

/** Type-only focus bind surface check — no runtime execution. */
export function acceptBindFocus(host: PixiWindowHost, controller: WindowFocusController): () => void {
  return bindFocusControllerToHost(host, controller);
}

export function acceptNineSliceSkin(_options: NineSliceSkinOptions): void {}

export function acceptNineSliceRendererFactory(
  _factory: typeof createNineSliceWindowRenderer,
): void {}

export function submoduleSourceScrollableWindow(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: ScrollableWindowOptions,
): ScrollableWindow {
  return new ScrollableWindow(host, config, options);
}

export function submoduleSourceScrollbarRenderer(
  content: Container,
  controller: ScrollController,
  options?: ScrollbarRendererOptions,
): ScrollbarRenderer {
  return new ScrollbarRenderer(content, controller, {
    getContentWidth: () => 80,
    getContentHeight: () => 40,
  }, options);
}
