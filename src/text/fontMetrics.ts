import type { ScaledFontMetrics } from "./types.ts";

export interface BitmapFontDataForBase {
  readonly base?: unknown;
  readonly lineHeight: number;
  readonly chars?: Record<number, { yOffset?: number; height?: number } | undefined>;
}

export function inferBitmapFontBaseFromChars(
  chars: Record<number, { yOffset?: number; height?: number } | undefined>,
  lineHeight: number,
): number {
  const counts = new Map<number, number>();

  for (const glyph of Object.values(chars)) {
    if (glyph === undefined) {
      continue;
    }
    const { yOffset, height } = glyph;
    if (height === undefined || height <= 0) {
      continue;
    }
    if (yOffset === undefined || !Number.isFinite(yOffset) || !Number.isFinite(height)) {
      continue;
    }
    const bottom = yOffset + height;
    if (bottom <= 0 || bottom > lineHeight) {
      continue;
    }
    counts.set(bottom, (counts.get(bottom) ?? 0) + 1);
  }

  if (counts.size === 0) {
    return Math.max(0, Math.trunc(lineHeight));
  }

  let bestBottom = 0;
  let bestCount = -1;
  for (const [bottom, count] of counts) {
    if (count > bestCount || (count === bestCount && bottom < bestBottom)) {
      bestBottom = bottom;
      bestCount = count;
    }
  }
  return bestBottom;
}

export function resolveBitmapFontBase(data: BitmapFontDataForBase): number {
  if (typeof data.base === "number" && Number.isFinite(data.base) && data.base > 0) {
    return Math.trunc(data.base);
  }
  return inferBitmapFontBaseFromChars(data.chars ?? {}, data.lineHeight);
}

export function scaleFontMetrics(
  native: { base: number; lineHeight: number; nativeFontSize: number },
  fontSize: number,
  scale: number,
): ScaledFontMetrics {
  if (native.nativeFontSize <= 0 || !Number.isFinite(native.nativeFontSize)) {
    return { ascent: 0, descent: 0, height: 0 };
  }
  if (fontSize <= 0 || !Number.isFinite(fontSize) || scale <= 0 || !Number.isFinite(scale)) {
    return { ascent: 0, descent: 0, height: 0 };
  }

  const sizeRatio = fontSize / native.nativeFontSize;
  const ascent = Math.round(native.base * sizeRatio * scale);
  let descent = Math.round((native.lineHeight - native.base) * sizeRatio * scale);
  let height = ascent + descent;

  if (native.lineHeight < native.base) {
    descent = 0;
    height = ascent;
  }

  return { ascent, descent, height };
}
