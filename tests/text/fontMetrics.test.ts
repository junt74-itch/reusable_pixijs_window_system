import { describe, expect, test } from "bun:test";
import { FallbackBitmapTextMeasurer } from "../../src/text/FallbackBitmapTextMeasurer.ts";
import {
  inferBitmapFontBaseFromChars,
  resolveBitmapFontBase,
  scaleFontMetrics,
} from "../../src/text/fontMetrics.ts";
import type { BitmapTextMeasureStyle, OwnedBitmapTextMeasurer } from "../../src/text/types.ts";

const native = { base: 11, lineHeight: 14, nativeFontSize: 12 };

class FakeMeasurer implements OwnedBitmapTextMeasurer {
  public readonly fontKeys: readonly string[];

  public constructor(
    public readonly fontKey: string,
    public readonly nativeFontSize: number,
    public readonly lineHeight: number,
    public readonly base: number,
    private readonly glyphWidth: number,
  ) {
    this.fontKeys = [fontKey];
  }

  public hasGlyph(_codePoint: number): boolean {
    return true;
  }

  public hasGlyphFor(fontKey: string, _codePoint: number): boolean {
    return fontKey === this.fontKey;
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

  public measure(text: string, _style: BitmapTextMeasureStyle): { width: number; height: number } {
    return { width: text.length * this.glyphWidth, height: this.lineHeight };
  }

  public measureRun(text: string, style: BitmapTextMeasureStyle): { width: number; height: number } {
    return this.measure(text, style);
  }

  public destroy(): void {}
}

describe("scaleFontMetrics", () => {
  test("scales at native fontSize and scale 1", () => {
    expect(scaleFontMetrics(native, 12, 1)).toEqual({ ascent: 11, descent: 3, height: 14 });
  });

  test("scales doubled fontSize at scale 1", () => {
    expect(scaleFontMetrics(native, 24, 1)).toEqual({ ascent: 22, descent: 6, height: 28 });
  });

  test("scales native fontSize at scale 2", () => {
    expect(scaleFontMetrics(native, 12, 2)).toEqual({ ascent: 22, descent: 6, height: 28 });
  });
});

describe("resolveBitmapFontBase", () => {
  test("prefers explicit base when chars are absent", () => {
    expect(resolveBitmapFontBase({ base: 11, lineHeight: 14 })).toBe(11);
  });

  test("returns the most frequent glyph bottom", () => {
    const chars = {
      65: { yOffset: 3, height: 9 },
      66: { yOffset: 3, height: 9 },
      67: { yOffset: 3, height: 9 },
      68: { yOffset: 2, height: 11 },
    };
    expect(resolveBitmapFontBase({ lineHeight: 14, chars })).toBe(12);
  });

  test("breaks bottom ties by choosing the smaller value", () => {
    const chars = {
      65: { yOffset: 3, height: 9 },
      66: { yOffset: 2, height: 9 },
    };
    expect(inferBitmapFontBaseFromChars(chars, 14)).toBe(11);
  });

  test("falls back to truncated lineHeight when no glyphs qualify", () => {
    expect(inferBitmapFontBaseFromChars({}, 14)).toBe(14);
    expect(inferBitmapFontBaseFromChars({ 32: { yOffset: 0, height: 0 } }, 14.9)).toBe(14);
  });
});

describe("FallbackBitmapTextMeasurer fontMetrics", () => {
  test("uses primary base and per-key fontMetrics", () => {
    const chain = new FallbackBitmapTextMeasurer([
      new FakeMeasurer("primary", 12, 14, 11, 6),
      new FakeMeasurer("fallback", 12, 16, 13, 8),
    ]);
    expect(chain.base).toBe(11);
    expect(chain.fontMetrics()).toEqual({
      fontKey: "primary",
      nativeFontSize: 12,
      lineHeight: 14,
      base: 11,
    });
    expect(chain.fontMetrics("fallback")).toEqual({
      fontKey: "fallback",
      nativeFontSize: 12,
      lineHeight: 16,
      base: 13,
    });
  });
});
