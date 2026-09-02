/** Semantic window input actions. */
export type WindowInputAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "confirm"
  | "cancel"
  | "pageUp"
  | "pageDown"
  | "skip";

/** Action event phase. */
export type WindowInputPhase = "pressed" | "repeated" | "released";

/** Source device for normalized input. */
export type WindowInputSource = "keyboard" | "pointer" | "gamepad" | "manual";

/** Readonly action event snapshot. */
export interface WindowActionEvent {
  readonly action: WindowInputAction;
  readonly phase: WindowInputPhase;
  readonly timestamp: number;
  readonly source: WindowInputSource;
}

/** Readonly pointer event snapshot in local/world coordinates. */
export interface WindowPointerEvent {
  readonly localX: number;
  readonly localY: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly isPrimaryDown: boolean;
  readonly phase: WindowInputPhase;
  readonly timestamp: number;
  readonly source: WindowInputSource;
}

export type WindowActionListener = (event: WindowActionEvent) => void;
export type WindowPointerListener = (event: WindowPointerEvent) => void;

/** Wheel scroll semantic event for scroll controllers. */
export interface WindowWheelEvent {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaZ: number;
  readonly pointerId: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly timestamp: number;
  readonly source: WindowInputSource;
}

/** Drag gesture phase for scroll thumb / content dragging. */
export type WindowDragPhase = "started" | "moved" | "ended";

/** Pointer drag semantic event with integer deltas since the previous moved sample. */
export interface WindowDragEvent {
  readonly phase: WindowDragPhase;
  readonly pointerId: number;
  readonly localX: number;
  readonly localY: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly timestamp: number;
  readonly source: WindowInputSource;
}

export type WindowWheelListener = (event: WindowWheelEvent) => void;
export type WindowDragListener = (event: WindowDragEvent) => void;

export interface WindowInputSubscription {
  unsubscribe(): void;
}
