import type { WindowInputAction } from "../input/types.ts";
import type {
  SelectableItem,
  SelectionCancelListener,
  SelectionChangeListener,
  SelectionConfirmListener,
  SelectionControllerOptions,
  SelectionSubscription,
} from "./types.ts";

/**
 * Phaser-free selection movement and confirm/cancel events.
 */
export class SelectionController<T> {
  private items: readonly SelectableItem<T>[] = [];
  private selectedIndex = -1;
  private readonly columns: number;
  private readonly wrap: boolean;
  private readonly changeListeners = new Set<SelectionChangeListener<T>>();
  private readonly confirmListeners = new Set<SelectionConfirmListener<T>>();
  private readonly cancelListeners = new Set<SelectionCancelListener>();

  private readonly confirmHook: (() => void) | null;
  private readonly cancelHook: (() => void) | null;
  private closed = false;

  public constructor(options: SelectionControllerOptions = {}) {
    this.columns = Math.max(1, options.columns ?? 1);
    this.wrap = options.wrap ?? true;
    this.confirmHook = options.onConfirm ?? null;
    this.cancelHook = options.onCancel ?? null;
  }

  public setItems(items: readonly SelectableItem<T>[]): void {
    const previousId =
      this.selectedIndex >= 0 ? this.items[this.selectedIndex]?.id : undefined;
    this.items = items;
    if (previousId !== undefined) {
      const preserved = items.findIndex((item) => item.id === previousId && item.enabled);
      this.selectedIndex = preserved >= 0 ? preserved : this.firstEnabledIndex();
    } else {
      this.selectedIndex = this.firstEnabledIndex();
    }
    this.emitChange();
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public getSelectedItem(): SelectableItem<T> | null {
    if (this.selectedIndex < 0) {
      return null;
    }
    return this.items[this.selectedIndex] ?? null;
  }

  public selectIndex(index: number): boolean {
    if (index < 0 || index >= this.items.length) {
      return false;
    }
    const item = this.items[index];
    if (item?.enabled !== true) {
      return false;
    }
    if (this.selectedIndex === index) {
      return true;
    }
    this.selectedIndex = index;
    this.emitChange();
    return true;
  }

  public move(action: WindowInputAction): void {
    if (this.items.length === 0) {
      return;
    }
    const previous = this.selectedIndex;
    if (action === "up") {
      this.moveByRows(-1);
    } else if (action === "down") {
      this.moveByRows(1);
    } else if (action === "left") {
      this.moveByColumns(-1);
    } else if (action === "right") {
      this.moveByColumns(1);
    }
    if (previous !== this.selectedIndex) {
      this.emitChange();
    }
  }

  public confirm(): boolean {
    if (this.closed) {
      return false;
    }
    const item = this.getSelectedItem();
    if (item === null || !item.enabled) {
      return false;
    }
    for (const listener of this.confirmListeners) {
      listener(this.selectedIndex, item);
    }
    this.confirmHook?.();
    return true;
  }

  public cancel(): void {
    if (this.closed) {
      return;
    }
    for (const listener of this.cancelListeners) {
      listener();
    }
    this.cancelHook?.();
  }

  public dispose(): void {
    this.closed = true;
    this.confirmListeners.clear();
    this.cancelListeners.clear();
    this.changeListeners.clear();
  }

  public onChange(listener: SelectionChangeListener<T>): SelectionSubscription {
    this.changeListeners.add(listener);
    return { unsubscribe: () => this.changeListeners.delete(listener) };
  }

  public onConfirm(listener: SelectionConfirmListener<T>): SelectionSubscription {
    this.confirmListeners.add(listener);
    return { unsubscribe: () => this.confirmListeners.delete(listener) };
  }

  public onCancel(listener: SelectionCancelListener): SelectionSubscription {
    this.cancelListeners.add(listener);
    return { unsubscribe: () => this.cancelListeners.delete(listener) };
  }

  private moveByRows(delta: number): void {
    const rowCount = Math.ceil(this.items.length / this.columns);
    const currentRow = Math.floor(this.selectedIndex / this.columns);
    let nextRow = currentRow + delta;
    if (this.wrap) {
      nextRow = ((nextRow % rowCount) + rowCount) % rowCount;
    } else {
      nextRow = Math.max(0, Math.min(rowCount - 1, nextRow));
    }
    const column = this.selectedIndex % this.columns;
    this.selectedIndex = this.findEnabledNear(nextRow * this.columns + column);
  }

  private moveByColumns(delta: number): void {
    let next = this.selectedIndex + delta;
    if (this.wrap) {
      next = ((next % this.items.length) + this.items.length) % this.items.length;
    } else {
      next = Math.max(0, Math.min(this.items.length - 1, next));
    }
    this.selectedIndex = this.findEnabledNear(next);
  }

  private findEnabledNear(start: number): number {
    if (this.items.length === 0) {
      return -1;
    }
    for (let offset = 0; offset < this.items.length; offset += 1) {
      const index = this.wrap
        ? ((start + offset) % this.items.length)
        : Math.min(this.items.length - 1, start + offset);
      const item = this.items[index];
      if (item?.enabled === true) {
        return index;
      }
    }
    return -1;
  }

  private firstEnabledIndex(): number {
    return this.findEnabledNear(0);
  }

  private emitChange(): void {
    const item = this.getSelectedItem();
    for (const listener of this.changeListeners) {
      listener(this.selectedIndex, item);
    }
  }
}
