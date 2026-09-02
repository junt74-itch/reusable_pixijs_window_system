import type {
  BitmapTextStyle,
  CursorStyle,
  ResolvedWindowTheme,
  WindowBounds,
  WindowConfig,
  WindowPadding,
  WindowTheme,
} from "./types.ts";
import { WindowConfigError, WindowLayoutError } from "./types.ts";

const DEFAULT_PADDING: WindowPadding = {
  top: 12,
  right: 12,
  bottom: 12,
  left: 12,
};

const DEFAULT_TEXT: BitmapTextStyle = {
  fontKey: "jf-dot-mplus12",
  fontKeys: ["jf-dot-mplus12"],
  fontSize: 12,
  scale: 1,
  tint: 0xffffff,
  letterSpacing: 0,
  lineSpacing: 4,
};

const DEFAULT_CURSOR: CursorStyle = {
  color: 0xffffff,
  alpha: 0.3,
  width: 0,
  padding: 4,
  blinkPeriodMs: 0,
};

const DEFAULT_THEME: ResolvedWindowTheme = {
  backgroundColor: 0x1a2433,
  backgroundAlpha: 0.92,
  borderColor: 0x4a6a8a,
  borderAlpha: 1,
  borderWidth: 2,
  padding: DEFAULT_PADDING,
  text: DEFAULT_TEXT,
  cursor: DEFAULT_CURSOR,
  transitionDurationMs: 200,
};

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function resolvePadding(padding: number | WindowPadding | undefined): WindowPadding {
  if (padding === undefined) {
    return DEFAULT_PADDING;
  }
  if (typeof padding === "number") {
    validateNonNegativeFinite("padding", padding);
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  validateNonNegativeFinite("padding.top", padding.top);
  validateNonNegativeFinite("padding.right", padding.right);
  validateNonNegativeFinite("padding.bottom", padding.bottom);
  validateNonNegativeFinite("padding.left", padding.left);
  return {
    top: padding.top,
    right: padding.right,
    bottom: padding.bottom,
    left: padding.left,
  };
}

function validateNonNegativeFinite(label: string, value: number): void {
  if (!isFiniteNumber(value)) {
    throw new WindowConfigError(`${label} must be a finite number.`);
  }
  if (value < 0) {
    throw new WindowConfigError(`${label} must be non-negative.`);
  }
}

function validatePositiveFinite(label: string, value: number): void {
  if (!isFiniteNumber(value)) {
    throw new WindowConfigError(`${label} must be a finite number.`);
  }
  if (value <= 0) {
    throw new WindowConfigError(`${label} must be positive.`);
  }
}

function validateInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new WindowConfigError(`${label} must be an integer.`);
  }
}

function resolveFontKeyChain(
  fontKeys: readonly string[] | undefined,
  fontKey: string,
): readonly string[] {
  const source = fontKeys !== undefined && fontKeys.length > 0 ? fontKeys : [fontKey];
  const unique: string[] = [];
  for (const key of source) {
    if (key.length === 0) {
      throw new WindowConfigError("text.fontKeys must not contain empty keys.");
    }
    if (!unique.includes(key)) {
      unique.push(key);
    }
  }
  if (unique.length === 0) {
    throw new WindowConfigError("text.fontKeys must not be empty.");
  }
  return unique;
}

function resolveBitmapTextStyle(partial: Partial<BitmapTextStyle> | undefined): BitmapTextStyle {
  const merged = { ...DEFAULT_TEXT, ...partial };
  const fontKeys = resolveFontKeyChain(partial?.fontKeys, merged.fontKey);
  const fontKey = fontKeys[0];
  if (fontKey === undefined || fontKey.length === 0) {
    throw new WindowConfigError("text.fontKey must not be empty.");
  }
  validatePositiveFinite("text.fontSize", merged.fontSize);
  validateInteger("text.fontSize", merged.fontSize);
  validatePositiveFinite("text.scale", merged.scale);
  validateInteger("text.scale", merged.scale);
  if (!isFiniteNumber(merged.tint)) {
    throw new WindowConfigError("text.tint must be a finite number.");
  }
  if (!isFiniteNumber(merged.letterSpacing)) {
    throw new WindowConfigError("text.letterSpacing must be a finite number.");
  }
  if (!isFiniteNumber(merged.lineSpacing)) {
    throw new WindowConfigError("text.lineSpacing must be a finite number.");
  }
  return {
    fontKey,
    fontKeys,
    fontSize: merged.fontSize,
    scale: merged.scale,
    tint: merged.tint,
    letterSpacing: merged.letterSpacing,
    lineSpacing: merged.lineSpacing,
  };
}

function resolveCursorStyle(partial: Partial<CursorStyle> | undefined): CursorStyle {
  const merged = { ...DEFAULT_CURSOR, ...partial };
  if (!isFiniteNumber(merged.color)) {
    throw new WindowConfigError("cursor.color must be a finite number.");
  }
  validateNonNegativeFinite("cursor.alpha", merged.alpha);
  validateNonNegativeFinite("cursor.width", merged.width);
  validateNonNegativeFinite("cursor.padding", merged.padding);
  validateNonNegativeFinite("cursor.blinkPeriodMs", merged.blinkPeriodMs);
  return merged;
}

/**
 * Returns a fresh deeply readonly theme snapshot without mutating the caller input.
 */
export function resolveWindowTheme(partial?: WindowTheme): ResolvedWindowTheme {
  if (partial === undefined) {
    return {
      ...DEFAULT_THEME,
      padding: { ...DEFAULT_PADDING },
      text: { ...DEFAULT_TEXT, fontKeys: [...DEFAULT_TEXT.fontKeys] },
      cursor: { ...DEFAULT_CURSOR },
    };
  }

  validateNonNegativeFinite("backgroundAlpha", partial.backgroundAlpha ?? DEFAULT_THEME.backgroundAlpha);
  validateNonNegativeFinite("borderAlpha", partial.borderAlpha ?? DEFAULT_THEME.borderAlpha);
  validateNonNegativeFinite("borderWidth", partial.borderWidth ?? DEFAULT_THEME.borderWidth);
  validateNonNegativeFinite(
    "transitionDurationMs",
    partial.transitionDurationMs ?? DEFAULT_THEME.transitionDurationMs,
  );

  return {
    backgroundColor: partial.backgroundColor ?? DEFAULT_THEME.backgroundColor,
    backgroundAlpha: partial.backgroundAlpha ?? DEFAULT_THEME.backgroundAlpha,
    borderColor: partial.borderColor ?? DEFAULT_THEME.borderColor,
    borderAlpha: partial.borderAlpha ?? DEFAULT_THEME.borderAlpha,
    borderWidth: partial.borderWidth ?? DEFAULT_THEME.borderWidth,
    padding: resolvePadding(partial.padding),
    text: resolveBitmapTextStyle(partial.text),
    cursor: resolveCursorStyle(partial.cursor),
    transitionDurationMs: partial.transitionDurationMs ?? DEFAULT_THEME.transitionDurationMs,
  };
}

/**
 * Validates window geometry. Throws {@link WindowConfigError} on invalid input.
 */
export function validateWindowConfig(config: WindowConfig): void {
  if (!isFiniteNumber(config.x) || !isFiniteNumber(config.y)) {
    throw new WindowConfigError("x and y must be finite numbers.");
  }
  validatePositiveFinite("width", config.width);
  validatePositiveFinite("height", config.height);
  if (config.theme !== undefined) {
    resolveWindowTheme(config.theme);
  }
}

/** Computes inner content bounds from outer size and resolved padding. */
export function computeContentBounds(
  width: number,
  height: number,
  padding: WindowPadding,
): WindowBounds {
  const contentWidth = width - padding.left - padding.right;
  const contentHeight = height - padding.top - padding.bottom;
  if (contentWidth <= 0 || contentHeight <= 0) {
    throw new WindowLayoutError(
      `Content area must be positive; got ${contentWidth}x${contentHeight}.`,
    );
  }
  return {
    x: padding.left,
    y: padding.top,
    width: contentWidth,
    height: contentHeight,
  };
}
