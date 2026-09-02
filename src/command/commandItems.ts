import type { SelectableItem } from "../selection/types.ts";
import { CommandBusyError, CommandConfigurationError, type CommandItem } from "./types.ts";

export function assertCommandChoiceReady<T>(
  items: readonly CommandItem<T>[],
  pending: boolean,
): void {
  if (pending) {
    throw new CommandBusyError();
  }
  if (items.length === 0) {
    throw new CommandConfigurationError("Command list must not be empty.");
  }
  if (items.every((item) => !item.enabled)) {
    throw new CommandConfigurationError("Command list has no enabled items.");
  }
}

export function toSelectableCommands<T>(
  items: readonly CommandItem<T>[],
): SelectableItem<CommandItem<T>>[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    value: item,
    enabled: item.enabled,
  }));
}
