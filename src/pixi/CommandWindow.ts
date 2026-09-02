import type { WindowConfig } from "../core/types.ts";
import { WindowOperationCancelledError } from "../core/types.ts";
import { ignoreTransitionCancellation } from "../core/windowOperations.ts";
import {
  SelectableWindow,
  type SelectableWindowOptions,
} from "./SelectableWindow.ts";
import type { SelectableItem } from "../selection/types.ts";
import { assertCommandChoiceReady, toSelectableCommands } from "../command/commandItems.ts";
import type { CommandItem, CommandResult } from "../command/types.ts";
import { CommandBusyError, CommandConfigurationError } from "../command/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

export interface CommandWindowOptions<T = unknown> extends SelectableWindowOptions {
  readonly cancelable?: boolean;
  readonly initialSelection?: number;
  readonly autoOpen?: boolean;
  readonly closeOnComplete?: boolean;
  /** Scene-owned highlight hook. This class does not import help types. */
  readonly onHighlight?: (command: CommandItem<T> | null) => void;
}

/**
 * Selectable command list. Confirm returns the record; application handlers are not invoked.
 */
export class CommandWindow<T = unknown> extends SelectableWindow<CommandItem<T>> {
  private pending = false;
  private cancelable = true;
  private readonly onHighlight: ((command: CommandItem<T> | null) => void) | null;
  private highlightSubscription: { unsubscribe: () => void } | null = null;
  private resolveChoice: ((result: CommandResult<T>) => void) | null = null;
  private rejectChoice: ((error: Error) => void) | null = null;

  public constructor(
    host: PixiWindowHost,
    config: WindowConfig,
    options: CommandWindowOptions<T> = {},
  ) {
    super(host, config, options);
    this.cancelable = options.cancelable ?? true;
    this.onHighlight = options.onHighlight ?? null;
    this.highlightSubscription = this.subscribeSelection((_index, item) => {
      this.onHighlight?.(item?.value ?? null);
    });
  }

  public chooseCommands(
    items: readonly CommandItem<T>[],
    options: CommandWindowOptions<T> = {},
  ): Promise<CommandResult<T>> {
    try {
      assertCommandChoiceReady(items, this.pending);
    } catch (error) {
      return Promise.reject(error);
    }

    this.cancelable = options.cancelable ?? this.cancelable;
    this.pending = true;
    this.setItems(toSelectableCommands(items));
    if (options.initialSelection !== undefined) {
      this.select(options.initialSelection);
    }

    const autoOpen = options.autoOpen ?? true;
    if (autoOpen) {
      ignoreTransitionCancellation(this.open());
      this.activate();
      this.show();
    }

    return new Promise<CommandResult<T>>((resolve, reject) => {
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

  public getSelectedCommand(): CommandItem<T> | null {
    return this.getSelectedItem()?.value ?? null;
  }

  protected override onSelectionConfirmed(
    index: number,
    item: SelectableItem<CommandItem<T>>,
  ): void {
    this.settleOnce({ status: "selected", index, command: item.value });
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
    this.highlightSubscription?.unsubscribe();
    this.highlightSubscription = null;
    this.settleOnce(new WindowOperationCancelledError("destroyed"));
    super.destroy();
  }

  private settleOnce(result: CommandResult<T> | Error): void {
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

export { CommandBusyError, CommandConfigurationError };
