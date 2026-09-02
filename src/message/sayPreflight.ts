import { WindowDestroyedError, WindowLayoutError } from "../core/types.ts";
import { MessageBusyError } from "./MessageController.ts";
import type { MessagePortraitOptions } from "./types.ts";
import { MissingMessagePortraitError } from "./types.ts";

export const MESSAGE_PORTRAIT_GAP_PX = 8;

export function resolveMessageSayPortrait(
  optionsPortrait: MessagePortraitOptions | null | undefined,
  defaultPortrait: MessagePortraitOptions | null,
): MessagePortraitOptions | null {
  return optionsPortrait !== undefined ? optionsPortrait : defaultPortrait;
}

export function portraitReservedWidth(portrait: MessagePortraitOptions | null): number {
  if (portrait === null) {
    return 0;
  }
  return Math.trunc(portrait.width) + MESSAGE_PORTRAIT_GAP_PX;
}

/**
 * Validates a `say()` attempt without mutating window display state.
 * Busy and destroyed fail before texture or layout checks.
 */
export function assertMessageSayPreflight(input: {
  readonly destroyed: boolean;
  readonly busy: boolean;
  readonly portrait: MessagePortraitOptions | null;
  readonly textureExists: (textureKey: string) => boolean;
  readonly contentWidth: number;
}): void {
  if (input.destroyed) {
    throw new WindowDestroyedError("Window has been destroyed.");
  }
  if (input.busy) {
    throw new MessageBusyError();
  }
  if (input.portrait === null) {
    return;
  }
  if (!input.textureExists(input.portrait.textureKey)) {
    throw new MissingMessagePortraitError(input.portrait.textureKey);
  }
  if (input.contentWidth - portraitReservedWidth(input.portrait) <= 0) {
    throw new WindowLayoutError("Portrait column leaves no room for message text.");
  }
}
