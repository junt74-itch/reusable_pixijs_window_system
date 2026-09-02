import type {
  FocusAcquireOptions,
  FocusableWindow,
  FocusChangeListener,
  FocusChangeSubscription,
  FocusSnapshot,
} from "./types.ts";
import { WindowFocusError } from "./types.ts";

interface FocusStackEntry {
  readonly window: FocusableWindow;
  readonly modal: boolean;
}

/**
 * Scene-owned exclusive active assigner. Not a process-global singleton.
 * Windows keep activate/deactivate; they do not import this controller.
 */
export class WindowFocusController {
  private stack: FocusStackEntry[] = [];
  private readonly listeners = new Set<FocusChangeListener>();
  private disposed = false;

  public acquire(window: FocusableWindow, options: FocusAcquireOptions = {}): void {
    this.assertOpen();
    this.pruneDestroyed();
    if (window.isDestroyed()) {
      throw new WindowFocusError("Cannot acquire a destroyed window.");
    }
    const modal = options.modal === true;
    if (!modal) {
      this.deactivateAll();
      this.stack = [{ window, modal: false }];
      window.activate();
      this.emit();
      return;
    }
    this.stack = this.stack.filter((entry) => entry.window !== window);
    const previous = this.stack[this.stack.length - 1];
    previous?.window.deactivate();
    this.stack.push({ window, modal: true });
    window.activate();
    this.emit();
  }

  public release(window: FocusableWindow): void {
    if (this.disposed) {
      return;
    }
    this.pruneDestroyed();
    const index = this.stack.findIndex((entry) => entry.window === window);
    if (index < 0) {
      return;
    }
    const wasTop = index === this.stack.length - 1;
    this.stack.splice(index, 1);
    if (!window.isDestroyed()) {
      window.deactivate();
    }
    if (wasTop) {
      const next = this.stack[this.stack.length - 1];
      next?.window.activate();
    }
    this.emit();
  }

  public releaseAll(): void {
    if (this.disposed) {
      return;
    }
    this.deactivateAll();
    this.stack = [];
    this.emit();
  }

  public getActive(): FocusableWindow | null {
    if (this.disposed) {
      return null;
    }
    this.pruneDestroyed();
    return this.stack[this.stack.length - 1]?.window ?? null;
  }

  public getSnapshot(): FocusSnapshot {
    if (this.disposed) {
      return { active: null, modal: false, stackDepth: 0 };
    }
    this.pruneDestroyed();
    return this.snapshot();
  }

  public subscribe(listener: FocusChangeListener): FocusChangeSubscription {
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.releaseAll();
    this.listeners.clear();
    this.disposed = true;
  }

  private pruneDestroyed(): void {
    const remaining = this.stack.filter((entry) => !entry.window.isDestroyed());
    if (remaining.length === this.stack.length) {
      return;
    }
    this.stack = remaining;
    const top = this.stack[this.stack.length - 1];
    top?.window.activate();
    for (const entry of this.stack.slice(0, -1)) {
      if (entry.window.isActive()) {
        entry.window.deactivate();
      }
    }
    this.emit();
  }

  private deactivateAll(): void {
    for (const entry of this.stack) {
      if (!entry.window.isDestroyed()) {
        entry.window.deactivate();
      }
    }
  }

  private snapshot(): FocusSnapshot {
    const top = this.stack[this.stack.length - 1];
    return {
      active: top?.window ?? null,
      modal: top?.modal === true,
      stackDepth: this.stack.length,
    };
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private assertOpen(): void {
    if (this.disposed) {
      throw new WindowFocusError("WindowFocusController has been disposed.");
    }
  }
}
