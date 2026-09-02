import type { WindowInputAdapter } from "../input/WindowInputAdapter.ts";
import type { WindowDragEvent } from "../input/types.ts";
import type { ScrollController } from "./ScrollController.ts";

export interface ScrollInputBinding {
  unsubscribe(): void;
}

export interface ScrollInputBindingOptions {
  readonly canConsumeInput: () => boolean;
  readonly allowContentDrag?: (event: WindowDragEvent) => boolean;
}

/** Wires page, wheel, and drag semantics to a {@link ScrollController}. */
export function bindScrollInput(
  adapter: WindowInputAdapter,
  controller: ScrollController,
  options: ScrollInputBindingOptions,
): ScrollInputBinding {
  const subscriptions = [
    adapter.subscribeAction((event) => {
      if (!options.canConsumeInput() || event.phase !== "pressed") {
        return;
      }
      if (event.action === "pageUp") {
        controller.pageUp();
      } else if (event.action === "pageDown") {
        controller.pageDown();
      }
    }),
    adapter.subscribeWheel((event) => {
      if (!options.canConsumeInput()) {
        return;
      }
      controller.wheelStep(event.deltaY);
    }),
    adapter.subscribeDrag((event) => {
      if (!options.canConsumeInput() || event.phase !== "moved") {
        return;
      }
      if (options.allowContentDrag !== undefined && !options.allowContentDrag(event)) {
        return;
      }
      controller.scrollBy(-event.deltaY);
    }),
  ];

  return {
    unsubscribe(): void {
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
    },
  };
}

/** Blocks content drag while the scrollbar track/thumb owns the active pointer. */
export function createScrollbarContentDragGate(
  scrollbar: { isPointerCaptured(): boolean; containsContentLocalPoint(x: number, y: number): boolean } | null,
  toContentLocal: (worldX: number, worldY: number) => { x: number; y: number },
): (event: WindowDragEvent) => boolean {
  return (event) => {
    if (scrollbar?.isPointerCaptured() === true) {
      return false;
    }
    const local = toContentLocal(event.worldX, event.worldY);
    return scrollbar?.containsContentLocalPoint(local.x, local.y) !== true;
  };
}
