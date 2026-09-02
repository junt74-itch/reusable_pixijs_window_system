/** Scroll axis supported by {@link ScrollController}. */
export type ScrollAxis = "x" | "y";

/** Readonly scroll bounds snapshot. */
export interface ScrollBounds {
  readonly contentSize: number;
  readonly viewportSize: number;
  readonly maxOffset: number;
  readonly offset: number;
  readonly targetOffset: number | null;
  readonly axis: ScrollAxis;
}

export type ScrollChangeListener = (bounds: ScrollBounds) => void;

export interface ScrollChangeSubscription {
  unsubscribe(): void;
}

export interface ScrollControllerOptions {
  readonly axis?: ScrollAxis;
  readonly pageStepRatio?: number;
  readonly wheelStepPx?: number;
}
