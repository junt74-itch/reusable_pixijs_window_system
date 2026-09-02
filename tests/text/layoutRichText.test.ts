import { describe, expect, test } from "bun:test";
import { scaleFontMetrics } from "../../src/text/fontMetrics.ts";
import { layoutRichText, layoutText } from "../../src/text/TextLayout.ts";
import type { BitmapTextMeasurer, BitmapTextMeasureStyle } from "../../src/text/types.ts";
import { BitmapFontNotLoadedError, MissingBitmapGlyphError } from "../../src/text/types.ts";

const defaultStyle: BitmapTextMeasureStyle = {
  fontKey: "test",
  fontSize: 12,
  scale: 1,
  letterSpacing: 0,
};

class FixedWidthMeasurer implements BitmapTextMeasurer {
  public readonly fontKey: string;
  public readonly fontKeys: readonly string[];
  public readonly nativeFontSize = 12;
  public readonly lineHeight = 14;
  public readonly base = 11;
  private readonly supported = new Set<number>();
  private readonly glyphWidth: number;

  public constructor(chars: string, glyphWidth = 6, fontKey = "test") {
    this.fontKey = fontKey;
    this.fontKeys = [fontKey];
    this.glyphWidth = glyphWidth;
    for (const char of chars) {
      const codePoint = char.codePointAt(0);
      if (codePoint !== undefined) {
        this.supported.add(codePoint);
      }
    }
  }

  public hasGlyph(codePoint: number): boolean {
    return this.supported.has(codePoint);
  }

  public fontKeyFor(_codePoint: number): string {
    return this.fontKey;
  }

  public fontMetrics() {
    return {
      fontKey: this.fontKey,
      nativeFontSize: this.nativeFontSize,
      lineHeight: this.lineHeight,
      base: this.base,
    };
  }

  public measure(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    void measureStyle;
    return { width: text.length * this.glyphWidth, height: 14 };
  }

  public measureRun(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    return this.measure(text, measureStyle);
  }
}

class ChainMeasurer implements BitmapTextMeasurer {
  public readonly fontKey: string;
  public readonly fontKeys: readonly string[];
  public readonly nativeFontSize = 12;
  public readonly lineHeight = 14;
  public readonly base = 11;
  private readonly glyphsByKey: ReadonlyMap<string, ReadonlySet<number>>;

  public constructor(glyphsByKey: Record<string, string>, private readonly glyphWidth = 6) {
    const entries = Object.entries(glyphsByKey).map(([fontKey, chars]) => {
      const supported = new Set<number>();
      for (const char of chars) {
        const codePoint = char.codePointAt(0);
        if (codePoint !== undefined) {
          supported.add(codePoint);
        }
      }
      return [fontKey, supported] as const;
    });
    this.glyphsByKey = new Map(entries);
    this.fontKeys = entries.map(([fontKey]) => fontKey);
    this.fontKey = this.fontKeys[0] ?? "test";
  }

  public hasGlyph(codePoint: number): boolean {
    return this.fontKeys.some((fontKey) => this.hasGlyphFor(fontKey, codePoint));
  }

  public hasGlyphFor(fontKey: string, codePoint: number): boolean {
    return this.glyphsByKey.get(fontKey)?.has(codePoint) ?? false;
  }

  public fontKeyFor(codePoint: number): string {
    return this.fontKeys.find((fontKey) => this.hasGlyphFor(fontKey, codePoint)) ?? this.fontKey;
  }

  public fontMetrics(fontKey?: string) {
    return {
      fontKey: fontKey ?? this.fontKey,
      nativeFontSize: this.nativeFontSize,
      lineHeight: this.lineHeight,
      base: this.base,
    };
  }

  public measure(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    void measureStyle;
    return { width: text.length * this.glyphWidth, height: 14 };
  }

  public measureRun(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    return this.measure(text, measureStyle);
  }
}

class ProportionalWidthMeasurer implements BitmapTextMeasurer {
  public readonly fontKey = "test";
  public readonly fontKeys = ["test"] as const;
  public readonly nativeFontSize = 12;
  public readonly lineHeight = 14;
  public readonly base = 11;
  private readonly supported = new Set<number>();

  public constructor(chars: string) {
    for (const char of chars) {
      const codePoint = char.codePointAt(0);
      if (codePoint !== undefined) {
        this.supported.add(codePoint);
      }
    }
  }

  public hasGlyph(codePoint: number): boolean {
    return this.supported.has(codePoint);
  }

  public fontKeyFor(_codePoint: number): string {
    return this.fontKey;
  }

  public fontMetrics() {
    return {
      fontKey: this.fontKey,
      nativeFontSize: this.nativeFontSize,
      lineHeight: this.lineHeight,
      base: this.base,
    };
  }

  public measure(text: string, style: BitmapTextMeasureStyle): { width: number; height: number } {
    return { width: text.length * style.fontSize, height: 14 };
  }

  public measureRun(text: string, style: BitmapTextMeasureStyle): { width: number; height: number } {
    return this.measure(text, style);
  }
}

describe("layoutRichText", () => {
  test("string input with omitted align wraps like layoutText", () => {
    const measurer = new FixedWidthMeasurer("hello world");
    const result = layoutRichText("hello world", measurer, {
      width: 30,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0]?.align).toBe("left");
    expect(result.lines[0]?.runs[0]?.x).toBe(0);
  });

  test("mixed fontSize spans share one aligned line", () => {
    const measurer = new ProportionalWidthMeasurer("ab");
    const result = layoutRichText(
      { spans: [{ text: "a", fontSize: 12 }, { text: "b", fontSize: 24 }] },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines.length).toBe(1);
    expect(result.lines[0]?.runs.length).toBe(2);
    expect(result.lines[0]?.runs[0]?.fontSize).toBe(12);
    expect(result.lines[0]?.runs[1]?.fontSize).toBe(24);
    expect(result.lines[0]?.width).toBe(12 + 24);
  });

  test("span with fontKey and fontSize keeps both on the run", () => {
    const measurer = new ChainMeasurer({ other: "x" });
    const result = layoutRichText(
      { spans: [{ text: "x", fontKey: "other", fontSize: 18 }] },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines[0]?.runs[0]).toMatchObject({
      text: "x",
      fontKey: "other",
      fontSize: 18,
    });
  });

  test("span fontKey falls back to theme keys when the specified font lacks the glyph", () => {
    const measurer = new ChainMeasurer({ special: "a", test: "ab" });
    const result = layoutRichText(
      { spans: [{ text: "b", fontKey: "special" }] },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines[0]?.runs[0]?.fontKey).toBe("test");
  });

  test("span fontKey missing from the measurer throws BitmapFontNotLoadedError", () => {
    const measurer = new FixedWidthMeasurer("x");
    expect(() =>
      layoutRichText(
        { spans: [{ text: "x", fontKey: "other" }] },
        measurer,
        { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
      ),
    ).toThrow(BitmapFontNotLoadedError);
  });

  test("exhausted span font chain throws MissingBitmapGlyphError with triedKeys", () => {
    const measurer = new ChainMeasurer({ special: "a", test: "a" });
    try {
      layoutRichText(
        { spans: [{ text: "z", fontKey: "special" }] },
        measurer,
        { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
      );
      throw new Error("expected MissingBitmapGlyphError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingBitmapGlyphError);
      if (error instanceof MissingBitmapGlyphError) {
        expect(error.triedKeys).toEqual(["special", "test"]);
      }
    }
  });

  test("legacy BitmapTextMeasurer without optional rich-text members still layouts", () => {
    const measurer: BitmapTextMeasurer = {
      fontKey: "test",
      fontKeys: ["test"],
      nativeFontSize: 12,
      lineHeight: 14,
      hasGlyph: (codePoint) => codePoint === 97,
      fontKeyFor: () => "test",
      measure: (text) => ({ width: text.length * 6, height: 14 }),
    };
    const result = layoutRichText("a", measurer, {
      width: 100,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(result.lines[0]?.text).toBe("a");
    expect(result.lines[0]?.runs[0]?.fontKey).toBe("test");
    expect(result.lines[0]?.ascent).toBe(14);
  });

  test('align "center" offsets the first run x', () => {
    const measurer = new FixedWidthMeasurer("abcd", 5);
    const result = layoutRichText(
      { spans: [{ text: "abcd" }], align: "center" },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines[0]?.width).toBe(20);
    expect(result.lines[0]?.runs[0]?.x).toBe(Math.trunc((100 - 20) / 2));
  });

  test('align "right" offsets run x to the right edge', () => {
    const measurer = new FixedWidthMeasurer("abcd", 5);
    const result = layoutRichText(
      { spans: [{ text: "abcd" }], align: "right" },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines[0]?.runs[0]?.x).toBe(100 - 20);
  });

  test("each line aligns by its own measured width", () => {
    const measurer = new FixedWidthMeasurer("abcdef", 10);
    const result = layoutRichText(
      { spans: [{ text: "ab\ncdef" }], align: "center" },
      measurer,
      { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines.length).toBe(2);
    const shortLine = result.lines[0]!;
    const longLine = result.lines[1]!;
    expect(shortLine.width).toBe(20);
    expect(longLine.width).toBe(40);
    expect(shortLine.runs[0]?.x).toBe(Math.trunc((100 - 20) / 2));
    expect(longLine.runs[0]?.x).toBe(Math.trunc((100 - 40) / 2));
    expect(shortLine.runs[0]?.x).toBeGreaterThan(longLine.runs[0]?.x ?? 0);
  });

  test("mixed fontSize line ascent uses the larger run", () => {
    const measurer = new ProportionalWidthMeasurer("ab");
    const native = { base: 11, lineHeight: 14, nativeFontSize: 12 };
    const smallAscent = scaleFontMetrics(native, 12, 1).ascent;
    const largeAscent = scaleFontMetrics(native, 24, 1).ascent;
    const result = layoutRichText(
      { spans: [{ text: "a", fontSize: 12 }, { text: "b", fontSize: 24 }] },
      measurer,
      { width: 200, height: 200, style: defaultStyle, lineSpacing: 0 },
    );
    const line = result.lines[0]!;
    expect(line.ascent).toBe(largeAscent);
    expect(largeAscent).toBeGreaterThan(smallAscent);
    expect(line.height).toBe(largeAscent + scaleFontMetrics(native, 24, 1).descent);
  });

  test("empty string yields one empty line like layoutText", () => {
    const measurer = new FixedWidthMeasurer("");
    const rich = layoutRichText("", measurer, {
      width: 100,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    const plain = layoutText("", measurer, {
      width: 100,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(rich.lines.length).toBe(1);
    expect(rich.lines[0]?.text).toBe("");
    expect(rich.lines.length).toBe(plain.lines.length);
  });

  test('newline-only input includes empty lines', () => {
    const measurer = new FixedWidthMeasurer("\n");
    const result = layoutRichText("\n", measurer, {
      width: 100,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(result.lines.length).toBe(2);
    expect(result.lines.every((line) => line.text === "")).toBe(true);
  });

  test("over-wide single glyph stays on its own line with zero align offset", () => {
    const measurer = new FixedWidthMeasurer("W", 50);
    const result = layoutRichText(
      { spans: [{ text: "W" }], align: "center" },
      measurer,
      { width: 30, height: 100, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines.length).toBe(1);
    expect(result.lines[0]?.width).toBe(50);
    expect(result.lines[0]?.runs[0]?.x).toBe(0);
  });

  test("variable line height moves tall lines to the next page", () => {
    const measurer = new ProportionalWidthMeasurer("ab");
    const result = layoutRichText(
      { spans: [{ text: "a", fontSize: 12 }, { text: "\nb", fontSize: 24 }] },
      measurer,
      { width: 200, height: 20, style: defaultStyle, lineSpacing: 0 },
    );
    expect(result.lines.length).toBe(2);
    expect(result.lines[0]?.pageIndex).toBe(0);
    expect(result.lines[1]?.pageIndex).toBe(1);
    expect(result.pageCount).toBe(2);
  });

  test("missing glyph throws MissingBitmapGlyphError with triedKeys", () => {
    const measurer = new FixedWidthMeasurer("a");
    try {
      layoutRichText("z", measurer, { width: 100, height: 100, style: defaultStyle, lineSpacing: 0 });
      throw new Error("expected MissingBitmapGlyphError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingBitmapGlyphError);
      if (error instanceof MissingBitmapGlyphError) {
        expect(error.triedKeys).toEqual(["test"]);
      }
    }
  });

  test("layoutText delegation exposes height, ascent, align, and runs", () => {
    const measurer = new FixedWidthMeasurer("ab\n");
    const result = layoutText("a\nb", measurer, {
      width: 100,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(result.lines.length).toBe(2);
    for (const line of result.lines) {
      expect(line.height).toBe(14);
      expect(line.ascent).toBe(11);
      expect(line.align).toBe("left");
      expect(line.runs.length).toBeGreaterThan(0);
    }
  });

  test("wraps surrogate-pair emoji using char array indices and UTF-16 sourceRange", () => {
    const measurer = new FixedWidthMeasurer("😀X", 10);
    const result = layoutRichText("😀X", measurer, {
      width: 25,
      height: 100,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(result.lines.length).toBe(2);
    expect(result.lines[0]?.text).toBe("😀");
    expect(result.lines[1]?.text).toBe("X");
    expect(result.lines[0]?.sourceRange).toEqual({ start: 0, end: 2 });
    expect(result.lines[1]?.sourceRange).toEqual({ start: 2, end: 3 });
  });

  test("page break uses lineStep including lineSpacing like legacy pageCapacity", () => {
    const measurer = new FixedWidthMeasurer("ab");
    const withSpacing = layoutRichText("a\nb", measurer, {
      width: 100,
      height: 32,
      style: defaultStyle,
      lineSpacing: 4,
    });
    expect(withSpacing.lines[0]?.pageIndex).toBe(0);
    expect(withSpacing.lines[1]?.pageIndex).toBe(1);
    expect(withSpacing.lines[0]?.height).toBe(14);

    const withoutSpacing = layoutRichText("a\nb", measurer, {
      width: 100,
      height: 32,
      style: defaultStyle,
      lineSpacing: 0,
    });
    expect(withoutSpacing.lines[0]?.pageIndex).toBe(0);
    expect(withoutSpacing.lines[1]?.pageIndex).toBe(0);
  });
});
