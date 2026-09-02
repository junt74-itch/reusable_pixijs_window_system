import type {
  BitmapFontNativeMetrics,
  BitmapTextMeasurer,
  BitmapTextMeasureStyle,
  BitmapTextMeasurement,
} from "./types.ts";

/** Measurer surface used by style-aware layout after filling optional members. */
export interface ResolvedBitmapTextMeasurer extends BitmapTextMeasurer {
  readonly base: number;
  measureRun(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement;
  fontMetrics(fontKey?: string): BitmapFontNativeMetrics;
  hasGlyphFor(fontKey: string, codePoint: number): boolean;
}

export function uniqueFontKeys(keys: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

/**
 * Completes optional {@link BitmapTextMeasurer} members for rich-text layout.
 * Does not mutate the consumer object.
 */
export function adaptBitmapTextMeasurer(measurer: BitmapTextMeasurer): ResolvedBitmapTextMeasurer {
  const base = measurer.base ?? Math.max(0, Math.trunc(measurer.lineHeight));
  return {
    fontKey: measurer.fontKey,
    fontKeys: measurer.fontKeys,
    nativeFontSize: measurer.nativeFontSize,
    lineHeight: measurer.lineHeight,
    base,
    hasGlyph: (codePoint) => measurer.hasGlyph(codePoint),
    fontKeyFor: (codePoint) => measurer.fontKeyFor(codePoint),
    measure: (text, style) => measurer.measure(text, style),
    measureRun: (text, style) => measurer.measureRun?.(text, style) ?? measurer.measure(text, style),
    fontMetrics: (fontKey) => {
      if (measurer.fontMetrics !== undefined) {
        return measurer.fontMetrics(fontKey);
      }
      return {
        fontKey: fontKey ?? measurer.fontKey,
        nativeFontSize: measurer.nativeFontSize,
        lineHeight: measurer.lineHeight,
        base,
      };
    },
    hasGlyphFor: (fontKey, codePoint) => {
      if (measurer.hasGlyphFor !== undefined) {
        return measurer.hasGlyphFor(fontKey, codePoint);
      }
      if (!measurer.fontKeys.includes(fontKey) || !measurer.hasGlyph(codePoint)) {
        return false;
      }
      if (measurer.fontKeys.length <= 1) {
        return true;
      }
      return measurer.fontKeyFor(codePoint) === fontKey;
    },
  };
}
