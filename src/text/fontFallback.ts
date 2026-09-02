import type { BitmapTextMeasurer } from "./types.ts";
import { FontSwapBusyError, MissingBitmapGlyphError } from "./types.ts";

export interface FontRun {
  readonly text: string;
  readonly fontKey: string;
}

export function fontKeyChainsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

export function assertFontSwapAllowed(busy: boolean): void {
  if (busy) {
    throw new FontSwapBusyError();
  }
}

export function splitTextFontRuns(
  text: string,
  fontKeyFor: (codePoint: number) => string,
  emptyFontKey: string,
): FontRun[] {
  if (text.length === 0) {
    return [{ text: "", fontKey: emptyFontKey }];
  }
  const runs: FontRun[] = [];
  let currentText = "";
  let currentKey = emptyFontKey;
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined) {
      continue;
    }
    const fontKey = fontKeyFor(codePoint);
    const char = String.fromCodePoint(codePoint);
    if (currentText.length > 0 && fontKey !== currentKey) {
      runs.push({ text: currentText, fontKey: currentKey });
      currentText = char;
      currentKey = fontKey;
    } else {
      if (currentText.length === 0) {
        currentKey = fontKey;
      }
      currentText += char;
    }
    if (codePoint > 0xffff) {
      index += 1;
    }
  }
  runs.push({ text: currentText, fontKey: currentKey });
  return runs;
}

function isStructuralCodePoint(codePoint: number): boolean {
  return codePoint === 0x000a || codePoint === 0x000c;
}

/** Throws {@link MissingBitmapGlyphError} with tried keys when no builder font has the glyph. */
export function assertMeasurerHasGlyphs(text: string, measurer: BitmapTextMeasurer): void {
  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index);
    if (codePoint === undefined || isStructuralCodePoint(codePoint)) {
      if (codePoint !== undefined && codePoint > 0xffff) {
        index += 1;
      }
      continue;
    }
    if (!measurer.hasGlyph(codePoint)) {
      throw new MissingBitmapGlyphError(
        measurer.fontKey,
        codePoint,
        String.fromCodePoint(codePoint),
        index,
        measurer.fontKeys,
      );
    }
    if (codePoint > 0xffff) {
      index += 1;
    }
  }
}

export function resolveLabelFontRuns(text: string, measurer: BitmapTextMeasurer): FontRun[] {
  assertMeasurerHasGlyphs(text, measurer);
  return splitTextFontRuns(text, (codePoint) => measurer.fontKeyFor(codePoint), measurer.fontKey);
}
