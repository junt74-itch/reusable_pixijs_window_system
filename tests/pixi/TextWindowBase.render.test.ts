import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { Container, BitmapText, BitmapFont, Cache, Texture, type RawCharData } from "pixi.js";
import { TextWindowBase } from "../../src/pixi/TextWindowBase.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import {
  BitmapFontNotLoadedError,
  MissingBitmapGlyphError,
  type LayoutLine,
  type WindowTextContent,
} from "../../src/text/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;
const HIRAGANA_A = "あ".codePointAt(0)!;
const ELLIPSIS = "…";

class TestTextWindow extends TextWindowBase {
  public layout(content: WindowTextContent) {
    return this.layoutTextContent(content);
  }

  public paint(lines: readonly LayoutLine[]): void {
    this.renderLines(lines);
  }
}

function createStubHost(): PixiWindowHost {
  const stage = new Container();
  let destroyed = false;
  return {
    stage,
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => destroyed,
    onDestroy: (handler: () => void) => {
      if (destroyed) {
        handler();
        return () => {};
      }
      return () => {};
    },
    destroy: () => {
      destroyed = true;
    },
  };
}

function createTestFont(overrides?: {
  lineHeight?: number;
  baseLineOffset?: number;
  fontSize?: number;
  extraChars?: Record<string, { xAdvance: number; yOffset?: number; height?: number }>;
}): BitmapFont {
  const lineHeight = overrides?.lineHeight ?? 14;
  const baseLineOffset = overrides?.baseLineOffset ?? 3;
  const fontSize = overrides?.fontSize ?? 12;
  const chars: Record<string, RawCharData> = {
    A: {
      id: 65,
      page: 0,
      x: 0,
      y: 0,
      width: 6,
      height: 9,
      xOffset: 0,
      yOffset: 3,
      xAdvance: 6,
      kerning: {},
      letter: "A",
    },
    あ: {
      id: HIRAGANA_A,
      page: 0,
      x: 6,
      y: 0,
      width: 12,
      height: 12,
      xOffset: 0,
      yOffset: 2,
      xAdvance: 12,
      kerning: {},
      letter: "あ",
    },
  };
  for (const [letter, glyph] of Object.entries(overrides?.extraChars ?? {})) {
    const codePoint = letter.codePointAt(0)!;
    chars[letter] = {
      id: codePoint,
      page: 0,
      x: 0,
      y: 0,
      width: glyph.height ?? 9,
      height: glyph.height ?? 9,
      xOffset: 0,
      yOffset: glyph.yOffset ?? 3,
      xAdvance: glyph.xAdvance,
      kerning: {},
      letter,
    };
  }
  return new BitmapFont({
    data: {
      pages: [{ id: 0, file: "font.png" }],
      chars,
      fontSize,
      lineHeight,
      baseLineOffset,
      fontFamily: FONT_KEY,
    },
    textures: [new Texture()],
  });
}

function installFont(font: BitmapFont, key: string = FONT_KEY): void {
  Cache.set(key, font);
  Cache.set(`${key}-bitmap`, font);
}

function clearFont(key: string = FONT_KEY): void {
  Cache.remove(key);
  Cache.remove(`${key}-bitmap`);
}

function getVisibleBitmapTexts(window: TestTextWindow): BitmapText[] {
  return window
    .getContentContainer()
    .children.filter((child): child is BitmapText => child instanceof BitmapText && child.visible);
}

const defaultConfig = { x: 0, y: 0, width: 400, height: 100 };

describe("TextWindowBase render execution", () => {
  let host: PixiWindowHost;
  let window: TestTextWindow;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont());
    host = createStubHost();
    window = new TestTextWindow(host, defaultConfig);
  });

  afterEach(() => {
    window.destroy();
    clearFont();
  });

  test("mixed fontSize RichText creates separate visible BitmapText runs", () => {
    const content: WindowTextContent = {
      spans: [
        { text: "A", fontSize: 12 },
        { text: "あ", fontSize: 24 },
      ],
    };

    const layout = window.layout(content);
    window.paint(layout.lines);

    const visible = getVisibleBitmapTexts(window);
    expect(visible.length).toBeGreaterThanOrEqual(2);

    const fontSizes = visible.map((textObject) => textObject.style.fontSize).sort((a, b) => a - b);
    expect(fontSizes).toContain(12);
    expect(fontSizes).toContain(24);

    for (const textObject of visible) {
      expect(textObject.style.fontFamily).toBe(FONT_KEY);
      expect(textObject.x).toBe(Math.trunc(textObject.x));
      expect(textObject.y).toBe(Math.trunc(textObject.y));
    }
  });

  test("Japanese hiragana survives on at least one BitmapText.text", () => {
    const content: WindowTextContent = "あ";

    const layout = window.layout(content);
    window.paint(layout.lines);

    const visible = getVisibleBitmapTexts(window);
    expect(visible.some((textObject) => textObject.text.includes("あ"))).toBe(true);
  });

  test("missing glyph throws MissingBitmapGlyphError without silent fallback", () => {
    expect(() => window.layout(ELLIPSIS)).toThrow(MissingBitmapGlyphError);

    try {
      window.layout(ELLIPSIS);
    } catch (error) {
      expect(error).toBeInstanceOf(MissingBitmapGlyphError);
      if (error instanceof MissingBitmapGlyphError) {
        expect(error.codePoint).toBe(0x2026);
        expect(error.character).toBe(ELLIPSIS);
      }
    }

    expect(getVisibleBitmapTexts(window).length).toBe(0);
  });

  test("unloaded span fontKey throws BitmapFontNotLoadedError before layout", () => {
    const content: WindowTextContent = {
      spans: [{ text: "A", fontKey: "missing-font" }],
    };

    expect(() => window.layout(content)).toThrow(BitmapFontNotLoadedError);
  });

  test("re-layout after setSize does not throw", () => {
    const content: WindowTextContent = "A";

    const first = window.layout(content);
    window.paint(first.lines);

    window.setSize(320, 120);

    const second = window.layout(content);
    expect(() => window.paint(second.lines)).not.toThrow();
  });
});
