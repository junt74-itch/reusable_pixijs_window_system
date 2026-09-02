import type { RichText } from "../text/types.ts";

/** Application-owned command record. This library never dispatches handlers. */
export interface CommandItem<T = unknown> {
  readonly id: string;
  readonly label: string | RichText;
  readonly enabled: boolean;
  readonly help?: string;
  readonly payload?: T;
}

export type CommandResult<T = unknown> =
  | { readonly status: "selected"; readonly index: number; readonly command: CommandItem<T> }
  | { readonly status: "cancelled" };

export class CommandBusyError extends Error {
  public override readonly name = "CommandBusyError";

  public constructor() {
    super("CommandWindow already has a pending command choice.");
  }
}

export class CommandConfigurationError extends Error {
  public override readonly name = "CommandConfigurationError";

  public constructor(message: string) {
    super(message);
  }
}
