import {
  VERSION,
  resolveWindowTheme,
  validateWindowConfig,
  computeContentBounds,
  TransitionController,
  WindowConfigError,
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
  WindowBase,
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
} from "reusable-pixijs-window-system";
import type {
  WindowConfig,
  ResolvedWindowTheme,
  WindowInputAdapter,
  BitmapTextMeasurer,
  TextLayoutOptions,
  TextLayoutResult,
  RichText,
  MessageToken,
  MessageRenderSnapshot,
  GraphicsFactory,
  GraphicsLike,
  PixiWindowHost,
  WindowRendererFactoryContext,
  WindowRendererFactory,
  PixiWindowInputOptions,
  WindowBaseOptions,
  MessageWindowOptions,
  MessageSayOptions,
  ChoiceOptions,
  ChoiceResult,
  CommandWindowOptions,
  CommandItem,
  CommandResult,
  ScrollableWindowOptions,
  ScrollbarRendererOptions,
  LogWindow,
  DocumentWindow,
  NineSliceSkinOptions,
} from "reusable-pixijs-window-system";
import type { Application, Container } from "pixi.js";

export const readmeExampleVersion = VERSION;

const config: WindowConfig = { x: 0, y: 0, width: 100, height: 50 };
validateWindowConfig(config);

const theme: ResolvedWindowTheme = resolveWindowTheme();
const bounds = computeContentBounds(100, 50, theme.padding);

export const readmeExampleTheme = theme;
export const readmeExampleBounds = bounds;
export const readmeExampleController = new TransitionController(theme.transitionDurationMs);

export function readmeExampleError(): WindowConfigError {
  return new WindowConfigError("example");
}

export function acceptWindowInput(input: WindowInputAdapter): void {
  input.subscribeAction(() => {});
}

/** Type-only layout surface check — no BitmapText runtime. */
export function readmeExampleLayout(
  measurer: BitmapTextMeasurer,
  options: TextLayoutOptions,
): TextLayoutResult {
  const plain = layoutText("hello", measurer, options);
  const rich: RichText = { spans: [{ text: "hello" }] };
  return layoutRichText(rich, measurer, options) ?? plain;
}

export function readmeExampleMessage(tokens: readonly MessageToken[]): MessageRenderSnapshot {
  const controller = new MessageController(null);
  void controller.start({ tokens, charsPerSecond: 30 });
  controller.update(16);
  return controller.getLatestSnapshot();
}

export const readmeExampleParsed = parseMessage("hello");
export const readmeExampleTextState = createInitialTextState();

/** Type-only chrome renderer surface check — no Pixi Graphics runtime. */
export function readmeExampleChrome(factory: GraphicsFactory): GraphicsWindowRenderer {
  const renderer = new GraphicsWindowRenderer(factory);
  renderer.applyTheme(readmeExampleTheme);
  renderer.resize(100, 50);
  return renderer;
}

export function acceptGraphicsLike(_graphics: GraphicsLike): void {}

/** Type-only host surface check — no Application runtime. */
export function readmeExampleHost(app: Application): PixiWindowHost {
  return createPixiWindowHost(app, { logicalWidth: 960, logicalHeight: 540 });
}

/** Type-only renderer factory surface check — no runtime execution. */
export function readmeExampleRendererFactory(
  context: WindowRendererFactoryContext,
  factory?: WindowRendererFactory,
): ReturnType<typeof resolveWindowRenderer> {
  return resolveWindowRenderer(factory, context);
}

export function readmeExampleDefaultRenderer(context: WindowRendererFactoryContext): ReturnType<
  typeof createDefaultGraphicsWindowRenderer
> {
  return createDefaultGraphicsWindowRenderer(context);
}

/** Type-only clipper surface check — no runtime execution. */
export function readmeExampleClipper(host: PixiWindowHost): ContentClipper {
  return new ContentClipper(host);
}

/** Type-only input surface check — no runtime execution. */
export function readmeExamplePixiInput(
  host: PixiWindowHost,
  options?: PixiWindowInputOptions,
): WindowInputAdapter {
  return new PixiWindowInput(host, options);
}

export function acceptWindowRendererContext(_context: WindowRendererFactoryContext): void {}

export function acceptContentRoot(_root: Container): void {}

/** Type-only WindowBase surface check — no runtime execution. */
export function readmeExampleWindowBase(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: WindowBaseOptions,
): WindowBase {
  return new WindowBase(host, config, options);
}

/** Type-only measurer factory surface check — no runtime execution. */
export function readmeExampleMeasurer(
  host: PixiWindowHost,
  fontKeys: readonly string[],
): BitmapTextMeasurer {
  return createBitmapTextMeasurer(host, fontKeys);
}

/** Type-only ScrollableWindow surface check — no runtime execution. */
export function readmeExampleScrollableWindow(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: ScrollableWindowOptions,
): ScrollableWindow {
  return new ScrollableWindow(host, config, options);
}

/** Type-only ScrollbarRenderer surface check — no runtime execution. */
export function readmeExampleScrollbarRenderer(
  content: Container,
  controller: ScrollController,
  options?: ScrollbarRendererOptions,
): ScrollbarRenderer {
  return new ScrollbarRenderer(content, controller, {
    getContentWidth: () => 100,
    getContentHeight: () => 100,
  }, options);
}

/** Type-only TextWindowBase subclass surface check — no runtime execution. */
export class ReadmeExampleTextWindow extends TextWindowBase {}

/** Type-only MessageWindow surface check — no runtime execution. */
export function readmeExampleMessageWindow(
  host: PixiWindowHost,
  config: WindowConfig,
  options?: MessageWindowOptions,
): MessageWindow {
  return new MessageWindow(host, config, options);
}

export function acceptMessageSayOptions(_options: MessageSayOptions): void {}

export function acceptChoiceOptions(_options: ChoiceOptions): void {}

export function acceptChoiceResult(_result: ChoiceResult<string>): void {}

export function acceptCommandOptions(_options: CommandWindowOptions): void {}

export function acceptCommandResult(_result: CommandResult<{ action: string }>): void {}

export function acceptCommandItem(_item: CommandItem<{ action: string }>): void {}

export function acceptLogWindow(_window: LogWindow): void {}

export function acceptDocumentWindow(_window: DocumentWindow): void {}

export const readmeExampleStickToLatest = shouldStickToLatest(0, 0);

/** Type-only focus bind surface check — no runtime execution. */
export function acceptBindFocus(host: PixiWindowHost, controller: WindowFocusController): () => void {
  return bindFocusControllerToHost(host, controller);
}

export function acceptNineSliceSkin(_options: NineSliceSkinOptions): void {}

export function acceptNineSliceRendererFactory(
  _factory: typeof createNineSliceWindowRenderer,
): void {}
