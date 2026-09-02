import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container } from "pixi.js";
import { BitmapFont, Cache, Texture, type RawCharData } from "pixi.js";
import {
  PixiBitmapTextMeasurer,
  createBitmapTextMeasurer,
  resolveLoadedBitmapFont,
} from "../../src/pixi/PixiBitmapTextMeasurer.ts";
import { FallbackBitmapTextMeasurer } from "../../src/text/FallbackBitmapTextMeasurer.ts";
import { BitmapFontNotLoadedError } from "../../src/text/types.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;
const HIRAGANA_A = "あ".codePointAt(0)!;
const ELLIPSIS = 0x2026;

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

describe("PixiBitmapTextMeasurer", () => {
  const host = createStubHost();

  beforeEach(() => {
    clearFont();
    installFont(createTestFont());
  });

  afterEach(() => {
    clearFont();
    clearFont("secondary-font");
  });

  test("throws BitmapFontNotLoadedError for unloaded font key", () => {
    clearFont();
    expect(() => new PixiBitmapTextMeasurer(host, "missing-font")).toThrow(BitmapFontNotLoadedError);
  });

  test("resolves font via alias and ${key}-bitmap cache entries", () => {
    clearFont();
    const font = createTestFont();
    Cache.set(`${FONT_KEY}-bitmap`, font);
    expect(resolveLoadedBitmapFont(FONT_KEY)).toBe(font);
    expect(() => new PixiBitmapTextMeasurer(host, FONT_KEY)).not.toThrow();
  });

  test("base uses XML base (lineHeight - baseLineOffset), not baseLineOffset", () => {
    const measurer = new PixiBitmapTextMeasurer(host, FONT_KEY);
    expect(measurer.base).toBe(11);
    expect(measurer.base).not.toBe(3);
    expect(measurer.lineHeight).toBe(14);
  });

  test("base matches jf-dot-mplus12 font.xml common values", () => {
    const xml = readFileSync(
      join(import.meta.dir, "../../examples/assets/fonts/jf-dot-mplus12/font.xml"),
      "utf8",
    );
    const commonMatch = xml.match(/<common\b[^>]*>/);
    expect(commonMatch).not.toBeNull();
    const commonTag = commonMatch?.[0] ?? "";
    const lineHeight = Number(commonTag.match(/lineHeight="(\d+)"/)?.[1]);
    const base = Number(commonTag.match(/base="(\d+)"/)?.[1]);
    expect(lineHeight).toBe(14);
    expect(base).toBe(11);

    const measurer = new PixiBitmapTextMeasurer(host, FONT_KEY);
    expect(measurer.base).toBe(base);
    expect(measurer.base).toBe(lineHeight - 3);
  });

  test("hasGlyph returns true for hiragana present in font and false for absent code points", () => {
    const measurer = new PixiBitmapTextMeasurer(host, FONT_KEY);
    expect(measurer.hasGlyph(HIRAGANA_A)).toBe(true);
    expect(measurer.hasGlyph(ELLIPSIS)).toBe(false);
  });

  test("measure returns finite non-negative integer width and height", () => {
    const measurer = new PixiBitmapTextMeasurer(host, FONT_KEY);
    const style = { fontKey: FONT_KEY, fontSize: 12, scale: 1, letterSpacing: 0 };
    const measured = measurer.measure("Aあ", style);
    expect(Number.isFinite(measured.width)).toBe(true);
    expect(Number.isFinite(measured.height)).toBe(true);
    expect(measured.width).toBeGreaterThanOrEqual(0);
    expect(measured.height).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(measured.width)).toBe(true);
    expect(Number.isInteger(measured.height)).toBe(true);
  });

  test("createBitmapTextMeasurer returns PixiBitmapTextMeasurer for one key", () => {
    const measurer = createBitmapTextMeasurer(host, [FONT_KEY]);
    expect(measurer).toBeInstanceOf(PixiBitmapTextMeasurer);
    expect(measurer.fontKeys).toEqual([FONT_KEY]);
  });

  test("createBitmapTextMeasurer returns FallbackBitmapTextMeasurer for multiple keys", () => {
    installFont(createTestFont(), "secondary-font");
    const measurer = createBitmapTextMeasurer(host, [FONT_KEY, "secondary-font"]);
    expect(measurer).toBeInstanceOf(FallbackBitmapTextMeasurer);
    expect(measurer.fontKeys).toEqual([FONT_KEY, "secondary-font"]);
  });

  test("source avoids phaser, PIXI.Text, and beginFill", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../src/pixi/PixiBitmapTextMeasurer.ts"),
      "utf8",
    );
    expect(source.includes('from "phaser"')).toBe(false);
    expect(source.includes("PIXI.Text")).toBe(false);
    expect(source.includes("beginFill")).toBe(false);
    expect(source.includes("new Text(")).toBe(false);
  });

  test("measure implements char-metrics fallback when BitmapText probe cannot be created", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../src/pixi/PixiBitmapTextMeasurer.ts"),
      "utf8",
    );
    expect(source.includes("measureUsingCharMetrics")).toBe(true);
    expect(source.includes("xAdvance")).toBe(true);
    expect(source.includes("kerning")).toBe(true);
  });
});
