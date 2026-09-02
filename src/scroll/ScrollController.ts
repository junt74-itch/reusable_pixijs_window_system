import type {
  ScrollAxis,
  ScrollBounds,
  ScrollChangeListener,
  ScrollChangeSubscription,
  ScrollControllerOptions,
} from "./types.ts";

/**
 * Pure scroll offset owner with clamping and semantic step helpers.
 * No Phaser or Game Object dependencies.
 */
export class ScrollController {
  private readonly axis: ScrollAxis;
  private readonly pageStepRatio: number;
  private readonly wheelStepPx: number;
  private contentSize = 0;
  private viewportSize = 0;
  private offset = 0;
  private targetOffset: number | null = null;
  private readonly listeners = new Set<ScrollChangeListener>();
  private lastEmittedBounds: ScrollBounds | null = null;

  public constructor(options: ScrollControllerOptions = {}) {
    this.axis = options.axis ?? "y";
    this.pageStepRatio = options.pageStepRatio ?? 0.9;
    this.wheelStepPx = options.wheelStepPx ?? 24;
  }

  public getAxis(): ScrollAxis {
    return this.axis;
  }

  public getBounds(): ScrollBounds {
    return this.snapshot();
  }

  public canScrollUp(): boolean {
    return this.offset > 0;
  }

  public canScrollDown(): boolean {
    return this.offset < this.getMaxOffset();
  }

  public setContentSize(size: number): void {
    this.contentSize = Math.max(0, Math.trunc(size));
    this.applyOffset(this.offset);
  }

  public setViewportSize(size: number): void {
    this.viewportSize = Math.max(0, Math.trunc(size));
    this.applyOffset(this.offset);
  }

  public setOffset(value: number): void {
    this.targetOffset = null;
    this.applyOffset(value);
  }

  public scrollBy(delta: number): void {
    this.targetOffset = null;
    this.applyOffset(this.offset + delta);
  }

  public scrollTo(value: number): void {
    this.targetOffset = null;
    this.applyOffset(value);
  }

  public pageUp(): void {
    this.scrollBy(-this.getPageStep());
  }

  public pageDown(): void {
    this.scrollBy(this.getPageStep());
  }

  public wheelStep(deltaY: number): void {
    if (deltaY === 0) {
      return;
    }
    const direction = deltaY > 0 ? 1 : -1;
    this.scrollBy(direction * this.wheelStepPx);
  }

  public subscribe(listener: ScrollChangeListener): ScrollChangeSubscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private getMaxOffset(): number {
    return Math.max(0, this.contentSize - this.viewportSize);
  }

  private getPageStep(): number {
    if (this.viewportSize <= 0) {
      return 0;
    }
    return Math.max(1, Math.trunc(this.viewportSize * this.pageStepRatio));
  }

  private clampOffset(value: number): number {
    return Math.max(0, Math.min(this.getMaxOffset(), Math.trunc(value)));
  }

  private applyOffset(value: number): void {
    this.offset = this.clampOffset(value);
    this.notifyBoundsChanged();
  }

  private notifyBoundsChanged(): void {
    const bounds = this.snapshot();
    if (this.lastEmittedBounds !== null && this.boundsEqual(this.lastEmittedBounds, bounds)) {
      return;
    }
    this.lastEmittedBounds = bounds;
    for (const listener of this.listeners) {
      listener(bounds);
    }
  }

  private boundsEqual(a: ScrollBounds, b: ScrollBounds): boolean {
    return (
      a.contentSize === b.contentSize &&
      a.viewportSize === b.viewportSize &&
      a.maxOffset === b.maxOffset &&
      a.offset === b.offset &&
      a.targetOffset === b.targetOffset &&
      a.axis === b.axis
    );
  }

  private snapshot(): ScrollBounds {
    return {
      contentSize: this.contentSize,
      viewportSize: this.viewportSize,
      maxOffset: this.getMaxOffset(),
      offset: this.offset,
      targetOffset: this.targetOffset,
      axis: this.axis,
    };
  }
}
