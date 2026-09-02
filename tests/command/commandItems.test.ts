import { describe, expect, test } from "bun:test";
import { assertCommandChoiceReady, toSelectableCommands } from "../../src/command/commandItems.ts";
import {
  CommandBusyError,
  CommandConfigurationError,
  type CommandItem,
} from "../../src/command/types.ts";

const ATTACK: CommandItem = { id: "attack", label: "Attack", enabled: true };
const ITEM: CommandItem = { id: "item", label: "Item", enabled: true };
const DISABLED: CommandItem = { id: "swap", label: "Swap", enabled: false };

describe("commandItems", () => {
  test("rejects busy, empty, and all-disabled lists", () => {
    expect(() => assertCommandChoiceReady([ATTACK], true)).toThrow(CommandBusyError);
    expect(() => assertCommandChoiceReady([], false)).toThrow(CommandConfigurationError);
    expect(() => assertCommandChoiceReady([DISABLED], false)).toThrow(CommandConfigurationError);
    expect(() => assertCommandChoiceReady([ATTACK, ITEM], false)).not.toThrow();
  });

  test("maps records to selectable items without invoking handlers", () => {
    const mapped = toSelectableCommands([ATTACK]);
    expect(mapped[0]).toEqual({
      id: "attack",
      label: "Attack",
      value: ATTACK,
      enabled: true,
    });
  });
});
