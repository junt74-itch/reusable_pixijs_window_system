import type { PixiWindowHost } from "../host/types.ts";
import type { WindowFocusController } from "./WindowFocusController.ts";

/**
 * Releases focus on host destroy. The controller does not import windows;
 * the application owns this binding and any dimmer Graphics.
 */
export function bindFocusControllerToHost(
  host: PixiWindowHost,
  controller: WindowFocusController,
): () => void {
  const onDestroy = (): void => {
    controller.dispose();
  };
  const unsubscribe = host.onDestroy(onDestroy);
  return () => {
    unsubscribe();
    controller.dispose();
  };
}
