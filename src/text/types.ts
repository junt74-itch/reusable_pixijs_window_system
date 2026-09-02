/** Thrown when a code point is absent from the configured bitmap font. */
export class MissingBitmapGlyphError extends Error {
  public override readonly name = "MissingBitmapGlyphError";
  public readonly triedKeys: readonly string[];

  public constructor(
    public readonly fontKey: string,
    public readonly codePoint: number,
    public readonly character: string,
    public readonly sourceIndex: number,
    triedKeys: readonly string[] = [fontKey],
  ) {
    const keys = triedKeys.length > 0 ? triedKeys : [fontKey];
    super(
      `Missing glyph U+${codePoint.toString(16).toUpperCase().padStart(4, "0")} (${character}) at index ${sourceIndex} for font "${fontKey}". Tried keys: ${keys.join(", ")}.`,
    );
    this.triedKeys = keys;
  }
}

/** Thrown when Assets / Cache lacks the configured bitmap font key. */
export class BitmapFontNotLoadedError extends Error {
  public override readonly name = "BitmapFontNotLoadedError";

  public constructor(public readonly fontKey: string) {
    super(
      `Bitmap font "${fontKey}" is not loaded. Call Assets.load({ alias: "${fontKey}", src: fontDataURL }) before use.`,
    );
  }
}

/** Thrown when `setFontKey` is called while a window operation is in flight. */
export class FontSwapBusyError extends Error {
  public override readonly name = "FontSwapBusyError";

  public constructor() {
    super("Cannot change font while a window operation is in progress.");
  }
}

export interface BitmapTextMeasureStyle {
  readonly fontKey: string;
  readonly fontSize: number;
  readonly scale: number;
  readonly letterSpacing: number;
}

export interface BitmapTextMeasurement {
  readonly width: number;
  readonly height: number;
}

export interface BitmapFontNativeMetrics {
  readonly fontKey: string;
  readonly nativeFontSize: number;
  readonly lineHeight: number;
  readonly base: number;
}

export interface ScaledFontMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly height: number;
}

/**
 * Phaser-free measurement surface for layout.
 *
 * `base`, `measureRun`, `fontMetrics`, and `hasGlyphFor` are optional so existing
 * consumer implementations stay valid. `layoutText` / `layoutRichText` adapt missing
 * members. Library-owned measurers implement the full surface.
 */
export interface BitmapTextMeasurer {
  readonly fontKey: string;
  readonly fontKeys: readonly string[];
  readonly nativeFontSize: number;
  readonly lineHeight: number;
  readonly base?: number;
  hasGlyph(codePoint: number): boolean;
  fontKeyFor(codePoint: number): string;
  measure(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement;
  measureRun?(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement;
  fontMetrics?(fontKey?: string): BitmapFontNativeMetrics;
  hasGlyphFor?(fontKey: string, codePoint: number): boolean;
}

export interface OwnedBitmapTextMeasurer extends BitmapTextMeasurer {
  readonly base: number;
  measureRun(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement;
  fontMetrics(fontKey?: string): BitmapFontNativeMetrics;
  hasGlyphFor(fontKey: string, codePoint: number): boolean;
  destroy(): void;
}

export interface TextLineRange {
  readonly start: number;
  readonly end: number;
}

export interface LayoutLineRun {
  readonly text: string;
  readonly fontKey: string;
  readonly fontSize: number;
  readonly width: number;
  readonly x: number;
}

export interface LayoutLine {
  readonly text: string;
  readonly sourceRange: TextLineRange;
  readonly width: number;
  readonly y: number;
  readonly height: number;
  readonly ascent: number;
  readonly pageIndex: number;
  readonly align: TextAlign;
  readonly runs: readonly LayoutLineRun[];
}

export interface TextLayoutResult {
  readonly lines: readonly LayoutLine[];
  readonly pageCount: number;
}

export interface TextLayoutOptions {
  readonly width: number;
  readonly height: number;
  readonly style: BitmapTextMeasureStyle;
  readonly lineSpacing: number;
  readonly align?: TextAlign;
}

export type TextAlign = "left" | "center" | "right";

export interface RichTextSpan {
  readonly text: string;
  readonly fontKey?: string;
  readonly fontSize?: number;
}

export interface RichText {
  readonly spans: readonly RichTextSpan[];
  readonly align?: TextAlign;
}

export type WindowTextContent = string | RichText;

export interface FlattenedRichChar {
  readonly sourceIndex: number;
  readonly char: string;
  readonly fontKey: string | undefined;
  readonly fontSize: number | undefined;
}
