import { Assets, BitmapText, Cache, type BitmapFont } from "pixi.js";
import { resolveBitmapFontBase } from "../text/fontMetrics.ts";
import { FallbackBitmapTextMeasurer } from "../text/FallbackBitmapTextMeasurer.ts";
import type {
  BitmapFontNativeMetrics,
  BitmapTextMeasurement,
  BitmapTextMeasureStyle,
  OwnedBitmapTextMeasurer,
} from "../text/types.ts";
import { BitmapFontNotLoadedError } from "../text/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

/** Resolves a loaded bitmap font by asset key (alias or `${key}-bitmap`). */
export function resolveLoadedBitmapFont(fontKey: string): BitmapFont | undefined {
  if (Cache.has(fontKey)) {
    return Cache.get<BitmapFont>(fontKey);
  }
  const bitmapKey = `${fontKey}-bitmap`;
  if (Cache.has(bitmapKey)) {
    return Cache.get<BitmapFont>(bitmapKey);
  }
  if (Assets.cache.has(fontKey)) {
    return Assets.get<BitmapFont>(fontKey);
  }
  return undefined;
}

function applyNearestSampling(font: BitmapFont): void {
  for (const page of font.pages) {
    page.texture.source.scaleMode = "nearest";
  }
}

function pixiCharsForBase(font: BitmapFont): Record<number, { yOffset?: number; height?: number }> {
  const chars: Record<number, { yOffset?: number; height?: number }> = {};
  for (const [letter, glyph] of Object.entries(font.chars)) {
    const codePoint = letter.codePointAt(0);
    if (codePoint === undefined) {
      continue;
    }
    chars[codePoint] = {
      yOffset: glyph.yOffset,
      ...(glyph.texture?.orig.height !== undefined
        ? { height: glyph.texture.orig.height }
        : glyph.texture?.height !== undefined
          ? { height: glyph.texture.height }
          : {}),
    };
  }
  return chars;
}

/**
 * Pixi-backed bitmap text measurer using loaded Assets / Cache entries only.
 */
export class PixiBitmapTextMeasurer implements OwnedBitmapTextMeasurer {
  public readonly nativeFontSize: number;
  public readonly lineHeight: number;
  public readonly base: number;
  public readonly fontKeys: readonly string[];
  private readonly font: BitmapFont;
  private readonly probe: BitmapText | null;
  private readonly measureFromChars: boolean;
  private destroyed = false;

  public constructor(
    _host: PixiWindowHost,
    public readonly fontKey: string,
  ) {
    const font = resolveLoadedBitmapFont(fontKey);
    if (font === undefined) {
      throw new BitmapFontNotLoadedError(fontKey);
    }
    this.font = font;
    this.fontKeys = [fontKey];
    this.nativeFontSize = font.baseMeasurementFontSize;
    this.lineHeight = font.lineHeight;
    this.base = resolveBitmapFontBase({
      base: font.lineHeight - font.baseLineOffset,
      lineHeight: font.lineHeight,
      chars: pixiCharsForBase(font),
    });
    applyNearestSampling(font);

    let probe: BitmapText | null = null;
    let measureFromChars = false;
    try {
      probe = new BitmapText({
        text: "",
        style: {
          fontFamily: fontKey,
          fontSize: this.nativeFontSize,
        },
        x: -10000,
        y: -10000,
      });
      probe.visible = false;
    } catch {
      probe = null;
      measureFromChars = true;
    }
    this.probe = probe;
    this.measureFromChars = measureFromChars;
  }

  public hasGlyph(codePoint: number): boolean {
    const letter = String.fromCodePoint(codePoint);
    return this.font.chars[letter] !== undefined;
  }

  public hasGlyphFor(fontKey: string, codePoint: number): boolean {
    return fontKey === this.fontKey && this.hasGlyph(codePoint);
  }

  public fontKeyFor(_codePoint: number): string {
    return this.fontKey;
  }

  public fontMetrics(_fontKey?: string): BitmapFontNativeMetrics {
    return {
      fontKey: this.fontKey,
      nativeFontSize: this.nativeFontSize,
      lineHeight: this.lineHeight,
      base: this.base,
    };
  }

  public measure(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement {
    if (this.measureFromChars || this.probe === null) {
      return this.measureUsingCharMetrics(text, style);
    }
    this.applyStyle(style);
    this.probe.text = text;
    const bounds = this.probe.getBounds();
    return {
      width: Math.ceil(bounds.width),
      height: Math.ceil(bounds.height),
    };
  }

  public measureRun(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement {
    return this.measure(text, style);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.probe?.destroy();
  }

  private applyStyle(style: BitmapTextMeasureStyle): void {
    if (this.probe === null) {
      return;
    }
    this.probe.style.fontSize = style.fontSize;
    this.probe.scale.set(style.scale);
    this.probe.style.letterSpacing = style.letterSpacing;
  }

  private measureUsingCharMetrics(text: string, style: BitmapTextMeasureStyle): BitmapTextMeasurement {
    if (text.length === 0) {
      return { width: 0, height: 0 };
    }
    const scaleRatio = (style.fontSize / this.nativeFontSize) * style.scale;
    let width = 0;
    let height = 0;
    let previousLetter: string | null = null;

    for (let index = 0; index < text.length; index += 1) {
      const codePoint = text.codePointAt(index);
      if (codePoint === undefined) {
        continue;
      }
      const letter = String.fromCodePoint(codePoint);
      const glyph = this.font.chars[letter];
      if (glyph === undefined) {
        if (codePoint > 0xffff) {
          index += 1;
        }
        continue;
      }
      if (previousLetter !== null) {
        const kerning = glyph.kerning[previousLetter];
        if (kerning !== undefined) {
          width += kerning * scaleRatio;
        }
      }
      width += glyph.xAdvance * scaleRatio;
      if (index < text.length - 1 && style.letterSpacing !== 0) {
        width += style.letterSpacing * style.scale;
      }
      const glyphHeight = glyph.texture?.orig.height ?? glyph.texture?.height ?? 0;
      height = Math.max(height, (glyph.yOffset + glyphHeight) * scaleRatio, this.lineHeight * scaleRatio);
      previousLetter = letter;
      if (codePoint > 0xffff) {
        index += 1;
      }
    }

    return {
      width: Math.ceil(width),
      height: Math.ceil(height),
    };
  }
}

export function createBitmapTextMeasurer(
  host: PixiWindowHost,
  fontKeys: readonly string[],
): OwnedBitmapTextMeasurer {
  const chain = fontKeys.map((fontKey) => new PixiBitmapTextMeasurer(host, fontKey));
  if (chain.length === 1) {
    const only = chain[0];
    if (only !== undefined) {
      return only;
    }
  }
  return new FallbackBitmapTextMeasurer(chain);
}
