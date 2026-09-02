import type { WindowConfig } from "../core/types.ts";
import { WindowDestroyedError, WindowOperationCancelledError } from "../core/types.ts";
import { ignoreTransitionCancellation } from "../core/windowOperations.ts";
import {
  SelectableWindow,
  type SelectableWindowOptions,
} from "./SelectableWindow.ts";
import type { SelectableItem } from "../selection/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

export class ChoiceBusyError extends Error {
  public override readonly name = "ChoiceBusyError";

  public constructor() {
    super("ChoiceWindow already has a pending choice.");
  }
}

export class ChoiceConfigurationError extends Error {
  public override readonly name = "ChoiceConfigurationError";

  public constructor(message: string) {
    super(message);
  }
}

export type ChoiceResult<T> =
  | { readonly status: "selected"; readonly index: number; readonly item: SelectableItem<T> }
  | { readonly status: "cancelled" };

export interface ChoiceOptions extends SelectableWindowOptions {
  readonly cancelable?: boolean;
  readonly initialSelection?: number;
  readonly autoOpen?: boolean;
  readonly closeOnComplete?: boolean;
}

/**
 * Promise-based choice window built on {@link SelectableWindow}.
 */
export class ChoiceWindow<T = string> extends SelectableWindow<T> {
  private pending = false;
  private cancelable = true;
  private resolveChoice: ((result: ChoiceResult<T>) => void) | null = null;
  private rejectChoice: ((error: Error) => void) | null = null;

  public constructor(host: PixiWindowHost, config: WindowConfig, options: ChoiceOptions = {}) {
    super(host, config, options);
    this.cancelable = options.cancelable ?? true;
  }

  public choose(
    items: readonly string[] | readonly SelectableItem<T>[],
    options: ChoiceOptions = {},
  ): Promise<ChoiceResult<T>> {
    if (this.pending) {
      return Promise.reject(new ChoiceBusyError());
    }
    const normalized = normalizeItems(items);
    if (normalized.length === 0) {
      return Promise.reject(new ChoiceConfigurationError("Choice list must not be empty."));
    }
    if (normalized.every((item) => !item.enabled)) {
      return Promise.reject(new ChoiceConfigurationError("Choice list has no enabled items."));
    }

    this.cancelable = options.cancelable ?? this.cancelable;
    this.pending = true;
    this.setItems(normalized);
    if (options.initialSelection !== undefined) {
      this.select(options.initialSelection);
    }

    const autoOpen = options.autoOpen ?? true;
    if (autoOpen) {
      ignoreTransitionCancellation(this.open());
      this.activate();
      this.show();
    }

    return new Promise<ChoiceResult<T>>((resolve, reject) => {
      this.resolveChoice = resolve;
      this.rejectChoice = reject;
    }).then(async (result) => {
      if (options.closeOnComplete ?? true) {
        await this.close();
        this.deactivate();
      }
      return result;
    });
  }

  protected override onSelectionConfirmed(index: number, item: SelectableItem<T>): void {
    this.settleOnce({ status: "selected", index, item });
  }

  protected override onSelectionCancelled(): void {
    if (!this.cancelable) {
      return;
    }
    this.settleOnce({ status: "cancelled" });
  }

  protected override isTextOperationBusy(): boolean {
    return this.pending;
  }

  public override destroy(): void {
    this.settleOnce(new WindowOperationCancelledError("destroyed"));
    super.destroy();
  }

  private settleOnce(result: ChoiceResult<T> | Error): void {
    if (!this.pending) {
      return;
    }
    this.pending = false;
    const resolve = this.resolveChoice;
    const reject = this.rejectChoice;
    this.resolveChoice = null;
    this.rejectChoice = null;
    if (result instanceof Error) {
      reject?.(result);
    } else {
      resolve?.(result);
    }
  }
}

function normalizeItems<T>(
  items: readonly string[] | readonly SelectableItem<T>[],
): SelectableItem<T>[] {
  if (items.length === 0) {
    return [];
  }
  const first = items[0];
  if (typeof first === "string") {
    return (items as readonly string[]).map((label, index) => ({
      id: String(index),
      label,
      value: label as T,
      enabled: true,
    }));
  }
  return [...(items as readonly SelectableItem<T>[])];
}

export { WindowDestroyedError };
