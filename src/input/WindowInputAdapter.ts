import type {
  WindowActionEvent,
  WindowActionListener,
  WindowDragEvent,
  WindowDragListener,
  WindowInputSubscription,
  WindowPointerEvent,
  WindowPointerListener,
  WindowWheelEvent,
  WindowWheelListener,
} from "./types.ts";

/**
 * Semantic, injectable input surface for window controllers.
 */
export interface WindowInputAdapter {
  subscribeAction(listener: WindowActionListener): WindowInputSubscription;
  subscribePointer(listener: WindowPointerListener): WindowInputSubscription;
  subscribeWheel(listener: WindowWheelListener): WindowInputSubscription;
  subscribeDrag(listener: WindowDragListener): WindowInputSubscription;
  dispose(): void;
}

/** Base class with independent subscriber lists. */
export abstract class BaseWindowInputAdapter implements WindowInputAdapter {
  private actionListeners = new Set<WindowActionListener>();
  private pointerListeners = new Set<WindowPointerListener>();
  private wheelListeners = new Set<WindowWheelListener>();
  private dragListeners = new Set<WindowDragListener>();
  private disposed = false;

  public subscribeAction(listener: WindowActionListener): WindowInputSubscription {
    this.actionListeners.add(listener);
    return {
      unsubscribe: () => {
        this.actionListeners.delete(listener);
      },
    };
  }

  public subscribePointer(listener: WindowPointerListener): WindowInputSubscription {
    this.pointerListeners.add(listener);
    return {
      unsubscribe: () => {
        this.pointerListeners.delete(listener);
      },
    };
  }

  public subscribeWheel(listener: WindowWheelListener): WindowInputSubscription {
    this.wheelListeners.add(listener);
    return {
      unsubscribe: () => {
        this.wheelListeners.delete(listener);
      },
    };
  }

  public subscribeDrag(listener: WindowDragListener): WindowInputSubscription {
    this.dragListeners.add(listener);
    return {
      unsubscribe: () => {
        this.dragListeners.delete(listener);
      },
    };
  }

  public dispose(): void {
    this.disposed = true;
    this.actionListeners.clear();
    this.pointerListeners.clear();
    this.wheelListeners.clear();
    this.dragListeners.clear();
  }

  /** Whether {@link dispose} has already run. */
  public isAdapterDisposed(): boolean {
    return this.disposed;
  }

  protected emitAction(event: WindowActionEvent): void {
    if (this.disposed) {
      return;
    }
    for (const listener of this.actionListeners) {
      listener(event);
    }
  }

  protected emitPointer(event: WindowPointerEvent): void {
    if (this.disposed) {
      return;
    }
    for (const listener of this.pointerListeners) {
      listener(event);
    }
  }

  protected emitWheel(event: WindowWheelEvent): void {
    if (this.disposed) {
      return;
    }
    for (const listener of this.wheelListeners) {
      listener(event);
    }
  }

  protected emitDrag(event: WindowDragEvent): void {
    if (this.disposed) {
      return;
    }
    for (const listener of this.dragListeners) {
      listener(event);
    }
  }

  protected get isDisposed(): boolean {
    return this.disposed;
  }

  /** Returns current subscriber counts (for settlement/leak tests). */
  public getSubscriptionCounts(): Readonly<{
    action: number;
    pointer: number;
    wheel: number;
    drag: number;
  }> {
    return {
      action: this.actionListeners.size,
      pointer: this.pointerListeners.size,
      wheel: this.wheelListeners.size,
      drag: this.dragListeners.size,
    };
  }
}
