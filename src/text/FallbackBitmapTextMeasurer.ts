import type {
  BitmapFontNativeMetrics,
  BitmapTextMeasurement,
  BitmapTextMeasureStyle,
  OwnedBitmapTextMeasurer,
} from "./types.ts";
import { splitTextFontRuns } from "./fontFallback.ts";

/**
 * Measures mixed-glyph strings by walking an application-supplied builder-font chain.
 * Never consults a system or web font.
 */
export class FallbackBitmapTextMeasurer implements OwnedBitmapTextMeasurer {
  public readonly fontKey: string;
  public readonly fontKeys: readonly string[];
  public readonly nativeFontSize: number;
  public readonly lineHeight: number;
  public readonly base: number;
  private readonly byKey: ReadonlyMap<string, OwnedBitmapTextMeasurer>;
  private destroyed = false;

  public constructor(private readonly chain: readonly OwnedBitmapTextMeasurer[]) {
    const primary = chain[0];
    if (primary === undefined) {
      throw new Error("FallbackBitmapTextMeasurer requires at least one measurer.");
    }
    this.fontKey = primary.fontKey;
    this.fontKeys = chain.map((entry) => entry.fontKey);
    this.nativeFontSize = primary.nativeFontSize;
    this.base = primary.base;
    this.lineHeight = chain.reduce(
      (max, entry) => (entry.lineHeight > max ? entry.lineHeight : max),
      primary.lineHeight,
    );
    this.byKey = new Map(chain.map((entry) => [entry.fontKey, entry]));
  }

  public hasGlyph(codePoint: number): boolean {
    return this.chain.some((entry) => entry.hasGlyph(codePoint));
  }

  public hasGlyphFor(fontKey: string, codePoint: number): boolean {
    return this.byKey.get(fontKey)?.hasGlyph(codePoint) ?? false;
  }

  public fontKeyFor(codePoint: number): string {
    const found = this.chain.find((entry) => entry.hasGlyph(codePoint));
    return found?.fontKey ?? this.fontKey;
  }

  public fontMetrics(fontKey?: string): BitmapFontNativeMetrics {
    if (fontKey !== undefined) {
      const measurer = this.byKey.get(fontKey);
      if (measurer !== undefined) {
        return measurer.fontMetrics();
      }
    }
    const primary = this.chain[0];
    if (primary === undefined) {
      throw new Error("FallbackBitmapTextMeasurer requires at least one measurer.");
    }
    return primary.fontMetrics();
  }

  public measure(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement {
    if (text.length === 0) {
      return { width: 0, height: 0 };
    }
    const runs = splitTextFontRuns(text, (codePoint) => this.fontKeyFor(codePoint), this.fontKey);
    let width = 0;
    let height = 0;
    for (let index = 0; index < runs.length; index += 1) {
      const run = runs[index];
      if (run === undefined) {
        continue;
      }
      const measured = this.measureRun(run.text, { ...style, fontKey: run.fontKey });
      width += measured.width;
      height = Math.max(height, measured.height);
      if (index < runs.length - 1 && style.letterSpacing !== 0) {
        width += style.letterSpacing * style.scale;
      }
    }
    return { width, height };
  }

  public measureRun(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement {
    if (text.length === 0) {
      return { width: 0, height: 0 };
    }
    const measurer = this.byKey.get(style.fontKey);
    if (measurer !== undefined) {
      return measurer.measure(text, style);
    }
    return this.measure(text, style);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    for (const entry of this.chain) {
      entry.destroy();
    }
  }
}
