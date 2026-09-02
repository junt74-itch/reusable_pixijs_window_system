import { describe, expect, test } from "bun:test";
import { layoutText } from "../../src/text/TextLayout.ts";
import type { BitmapTextMeasurer, BitmapTextMeasureStyle } from "../../src/text/types.ts";
import { parseMessage } from "../../src/message/MessageParser.ts";
import {
  buildFlatTextFromTokens,
  computeLayoutPageBreaks,
  splitTokensByExplicitPage,
} from "../../src/message/layoutPages.ts";
import {
  createInitialTextState,
  getRevealedPageText,
  reduceTextState,
} from "../../src/message/TextState.ts";

const style: BitmapTextMeasureStyle = {
  fontKey: "test",
  fontSize: 12,
  scale: 1,
  letterSpacing: 0,
};

class FakeMeasurer implements BitmapTextMeasurer {
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

  public measure(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    void measureStyle;
    return { width: text.length * 6, height: 14 };
  }

  public measureRun(text: string, measureStyle: BitmapTextMeasureStyle): { width: number; height: number } {
    return this.measure(text, measureStyle);
  }
}

describe("auto page layout integration", () => {
  test("layoutText overflow produces breaks consumed by TextState", () => {
    const measurer = new FakeMeasurer("abcdefghijklmnopqrstuvwxyz \n");
    const source = "alpha beta\ngamma delta\nepsilon zeta\neta theta";
    const layout = layoutText(source, measurer, {
      width: 80,
      height: 30,
      style,
      lineSpacing: 0,
    });
    const breaks = computeLayoutPageBreaks(layout.lines);
    expect(breaks.length).toBeGreaterThan(0);

    const parsed = parseMessage(source);
    const layoutPageBreaksByPage = splitTokensByExplicitPage(parsed.tokens).map((pageTokens) => {
      const flat = buildFlatTextFromTokens(pageTokens);
      const pageLayout = layoutText(flat, measurer, {
        width: 80,
        height: 30,
        style,
        lineSpacing: 0,
      });
      return computeLayoutPageBreaks(pageLayout.lines);
    });
    expect(layoutPageBreaksByPage[0]?.length).toBeGreaterThan(0);

    let state = createInitialTextState();
    while (!state.pausedForAdvance && !state.completed) {
      state = reduceTextState(parsed.tokens, state, { deltaMs: 32 }, 120, { layoutPageBreaksByPage }).state;
    }
    const firstPage = getRevealedPageText(parsed.tokens, state, layoutPageBreaksByPage);
    expect(firstPage.length).toBeGreaterThan(0);
    expect(firstPage.length).toBeLessThan(source.length);
  });

  test("explicit page break keeps layout breaks scoped per page", () => {
    const measurer = new FakeMeasurer("abcdefghijklmnopqrstuvwxyz \n");
    const parsed = parseMessage("short\faaaa\nbbbb\ncccc\ndddd");
    const layoutPageBreaksByPage = splitTokensByExplicitPage(parsed.tokens).map((pageTokens) => {
      const flat = buildFlatTextFromTokens(pageTokens);
      if (flat.length === 0) {
        return [];
      }
      const pageLayout = layoutText(flat, measurer, {
        width: 80,
        height: 30,
        style,
        lineSpacing: 0,
      });
      return computeLayoutPageBreaks(pageLayout.lines);
    });
    expect(layoutPageBreaksByPage[0]).toEqual([]);
    expect(layoutPageBreaksByPage[1]?.length).toBeGreaterThan(0);
  });
});
