/** Window lifecycle phase. */
export type WindowPhase = "closed" | "opening" | "open" | "closing";

/** Four-sided padding in pixels. */
export interface WindowPadding {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Bitmap text style resolved for window rendering. */
export interface BitmapTextStyle {
  readonly fontKey: string;
  readonly fontKeys: readonly string[];
  readonly fontSize: number;
  readonly scale: number;
  readonly tint: number;
  readonly letterSpacing: number;
  readonly lineSpacing: number;
}

/** Cursor style for selection windows. */
export interface CursorStyle {
  readonly color: number;
  readonly alpha: number;
  readonly width: number;
  readonly padding: number;
  /** 0 disables blink. Owned by CursorRenderer, not WindowBase. */
  readonly blinkPeriodMs: number;
}

/** Partial theme supplied by consumers. */
export interface WindowTheme {
  readonly backgroundColor?: number;
  readonly backgroundAlpha?: number;
  readonly borderColor?: number;
  readonly borderAlpha?: number;
  readonly borderWidth?: number;
  readonly padding?: number | WindowPadding;
  readonly text?: Partial<BitmapTextStyle>;
  readonly cursor?: Partial<CursorStyle>;
  readonly transitionDurationMs?: number;
}

/** Fully resolved, immutable window theme. */
export interface ResolvedWindowTheme {
  readonly backgroundColor: number;
  readonly backgroundAlpha: number;
  readonly borderColor: number;
  readonly borderAlpha: number;
  readonly borderWidth: number;
  readonly padding: WindowPadding;
  readonly text: BitmapTextStyle;
  readonly cursor: CursorStyle;
  readonly transitionDurationMs: number;
}

/** Initial window geometry and optional theme. */
export interface WindowConfig {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly theme?: WindowTheme;
}

/** Local-coordinate rectangle in pixels. */
export interface WindowBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Readonly snapshot of window state for diagnostics. */
export interface WindowStateSnapshot {
  readonly phase: WindowPhase;
  readonly openness: number;
  readonly visible: boolean;
  readonly active: boolean;
  readonly enabled: boolean;
  readonly alpha: number;
  readonly depth: number;
  readonly bounds: WindowBounds;
  readonly contentBounds: WindowBounds;
}

/** Thrown when window configuration is invalid. */
export class WindowConfigError extends Error {
  public override readonly name = "WindowConfigError";

  public constructor(message: string) {
    super(message);
  }
}

/** Thrown when an async window operation is cancelled. */
export class WindowOperationCancelledError extends Error {
  public override readonly name = "WindowOperationCancelledError";

  public constructor(message: string) {
    super(message);
  }
}

/** Thrown when operating on a destroyed window. */
export class WindowDestroyedError extends Error {
  public override readonly name = "WindowDestroyedError";

  public constructor(message: string) {
    super(message);
  }
}

/** Thrown when content area would become non-positive. */
export class WindowLayoutError extends Error {
  public override readonly name = "WindowLayoutError";

  public constructor(message: string) {
    super(message);
  }
}
