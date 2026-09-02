import { WindowOperationCancelledError } from "./types.ts";

/** Swallows expected transition cancellation from fire-and-forget open/close calls. */
export function ignoreTransitionCancellation(promise: Promise<unknown>): void {
  void promise.catch((error: unknown) => {
    if (error instanceof WindowOperationCancelledError) {
      return;
    }
  });
}
