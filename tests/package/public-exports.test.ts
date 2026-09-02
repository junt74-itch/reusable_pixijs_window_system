import { expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

const EXPECTED_EXPORTS = [
  "VERSION",
  "resolveWindowTheme",
  "validateWindowConfig",
  "computeContentBounds",
  "TransitionController",
  "GraphicsWindowRenderer",
  "WindowConfigError",
  "WindowOperationCancelledError",
  "WindowDestroyedError",
  "WindowLayoutError",
  "MissingBitmapGlyphError",
  "BitmapFontNotLoadedError",
  "FontSwapBusyError",
  "layoutText",
  "layoutRichText",
  "DEFAULT_BITMAP_FONT_ASSET",
  "FallbackBitmapTextMeasurer",
  "PixiBitmapTextMeasurer",
  "createBitmapTextMeasurer",
  "TextWindowBase",
  "MessageWindow",
  "CursorRenderer",
  "SelectableWindow",
  "ChoiceWindow",
  "ChoiceBusyError",
  "ChoiceConfigurationError",
  "CommandWindow",
  "CommandBusyError",
  "CommandConfigurationError",
  "HelpWindow",
  "LogWindow",
  "DocumentWindow",
  "shouldStickToLatest",
  "parseMessage",
  "createInitialTextState",
  "reduceTextState",
  "getRevealedText",
  "getRevealedPageText",
  "getRevealedPageColors",
  "requiresAdvanceInput",
  "MessageController",
  "MessageBusyError",
  "MissingMessagePortraitError",
  "SelectionController",
  "cursorBlinkVisible",
  "ScrollController",
  "bindScrollInput",
  "layoutWindowInViewport",
  "WindowFocusController",
  "WindowFocusError",
  "bindFocusControllerToHost",
  "bindWindowA11y",
  "createPixiWindowHost",
  "createDefaultGraphicsWindowRenderer",
  "resolveWindowRenderer",
  "NineSliceWindowRenderer",
  "createNineSliceWindowRenderer",
  "MissingWindowSkinError",
  "ContentClipper",
  "PixiWindowInput",
  "WindowBase",
  "ScrollableWindow",
  "ScrollbarRenderer",
];

const EXPECTED_TYPE_EXPORTS = [
  "WindowConfig",
  "WindowPadding",
  "WindowTheme",
  "ResolvedWindowTheme",
  "WindowPhase",
  "WindowBounds",
  "WindowStateSnapshot",
  "BitmapTextStyle",
  "CursorStyle",
  "TransitionState",
  "TransitionSubscription",
  "WindowRenderer",
  "GraphicsLike",
  "GraphicsFactory",
  "WindowInputAction",
  "WindowInputPhase",
  "WindowInputSource",
  "WindowActionEvent",
  "WindowPointerEvent",
  "WindowWheelEvent",
  "WindowDragPhase",
  "WindowDragEvent",
  "WindowActionListener",
  "WindowPointerListener",
  "WindowWheelListener",
  "WindowDragListener",
  "WindowInputSubscription",
  "WindowInputAdapter",
  "BitmapTextMeasurer",
  "BitmapTextMeasureStyle",
  "BitmapTextMeasurement",
  "BitmapFontNativeMetrics",
  "ScaledFontMetrics",
  "LayoutLine",
  "LayoutLineRun",
  "TextLayoutResult",
  "TextLayoutOptions",
  "TextAlign",
  "RichTextSpan",
  "RichText",
  "WindowTextContent",
  "BitmapFontAsset",
  "MessageToken",
  "MessageParseResult",
  "MessagePortraitOptions",
  "MessageAudioHooks",
  "TextState",
  "TextStateEffect",
  "TextStateStepResult",
  "MessageStartRequest",
  "MessageRenderSnapshot",
  "SelectableItem",
  "SelectionControllerOptions",
  "ScrollAxis",
  "ScrollBounds",
  "ScrollChangeListener",
  "ScrollChangeSubscription",
  "ScrollControllerOptions",
  "ViewportAnchor",
  "ViewportLayoutRequest",
  "FocusableWindow",
  "FocusAcquireOptions",
  "FocusSnapshot",
  "FocusChangeListener",
  "FocusChangeSubscription",
  "WindowA11yEvent",
  "WindowA11yListener",
  "WindowA11ySubscription",
  "BindWindowA11yOptions",
  "A11yLifecycleSource",
  "A11ySelectionSource",
  "A11yMessageSource",
  "A11yFocusSource",
  "PixiWindowHost",
  "PixiWindowHostOptions",
  "WindowRendererFactory",
  "WindowRendererFactoryContext",
  "NineSliceSkinOptions",
  "ContentClipperUnsupportedError",
  "PixiWindowInputBindings",
  "PixiWindowInputOptions",
  "WindowBaseOptions",
  "MessageWindowOptions",
  "MessageSayOptions",
  "SelectableWindowOptions",
  "RowBounds",
  "ChoiceOptions",
  "ChoiceResult",
  "CommandWindowOptions",
  "CommandItem",
  "CommandResult",
  "ScrollableWindowOptions",
  "ScrollbarRendererOptions",
];

const FORBIDDEN_INTERNAL_EXPORTS = [
  "ignoreTransitionCancellation",
  "sayPreflight",
  "assertMessageSayPreflight",
  "splitLineColorRuns",
  "computeLayoutPageBreaks",
  "collectPageFlatStyles",
  "ScrollContentClip",
  "flattenRichText",
  "splitTextFontRuns",
  "stackedTextHeight",
  "scaleFontMetrics",
  "adaptBitmapTextMeasurer",
  "ManualWindowInput",
  "BaseWindowInputAdapter",
  "PhaserWindowInput",
  "bindFocusControllerToScene",
  "computeScrollbarTrackRect",
  "isPointInContentViewport",
  "computeScrollOffsetToReveal",
  "computeVisibleRowRange",
  "hitTestRowAtContentLocal",
  "createScrollbarContentDragGate",
  "createPixiGraphicsFactory",
  "assertCommandChoiceReady",
];

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function walkSrc(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkSrc(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

test("package.json exports, module, and types point to dist", () => {
  const pkg = JSON.parse(readRoot("package.json")) as {
    module: string;
    types: string;
    exports: { ".": { types: string; import: string } };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  expect(pkg.module).toBe("./dist/index.js");
  expect(pkg.types).toBe("./dist/index.d.ts");
  expect(pkg.exports["."].types).toBe("./dist/index.d.ts");
  expect(pkg.exports["."].import).toBe("./dist/index.js");
  expect(pkg.dependencies?.phaser).toBeUndefined();
  expect(pkg.devDependencies?.phaser).toBeUndefined();
});

test("dist/index.js contains expected public exports and no Phaser imports", () => {
  const distJs = readRoot("dist/index.js");

  for (const name of EXPECTED_EXPORTS) {
    expect(distJs).toContain(name);
  }
  expect(distJs).not.toContain('from "phaser"');
  expect(distJs).not.toContain("phaser/dist/phaser.esm");
});

test("dist/index.js bundle size stays under 200_000 bytes", () => {
  const distJs = readRoot("dist/index.js");
  expect(distJs.length).toBeLessThan(200_000);
});

test("dist/index.d.ts has expected exports and no any", () => {
  const distDts = readRoot("dist/index.d.ts");

  for (const name of [...EXPECTED_EXPORTS, ...EXPECTED_TYPE_EXPORTS]) {
    expect(distDts).toContain(name);
  }
  expect(distDts).not.toMatch(/\bany\b/);
});

test("barrel does not export internal helper names", () => {
  const distDts = readRoot("dist/index.d.ts");

  for (const name of FORBIDDEN_INTERNAL_EXPORTS) {
    expect(distDts).not.toMatch(new RegExp(`export\\s.*\\b${name}\\b`));
  }
});

function isAllowedPixiImport(relativePath: string): boolean {
  return (
    relativePath.startsWith("host/") ||
    relativePath.startsWith("pixi/") ||
    relativePath === "input/PixiWindowInput.ts"
  );
}

test("src/ has no Phaser imports and pixi.js imports only under allowed paths", () => {
  const srcDir = join(root, "src");
  const srcFiles = walkSrc(srcDir);

  for (const file of srcFiles) {
    const content = readFileSync(file, "utf8");
    expect(content).not.toContain('from "phaser"');
    expect(content).not.toContain("from 'phaser'");

    const relativePath = file.slice(srcDir.length + 1);
    const hasPixiImport =
      content.includes('from "pixi.js"') || content.includes("from 'pixi.js'");
    if (hasPixiImport) {
      expect(isAllowedPixiImport(relativePath)).toBe(true);
    }
  }
});
