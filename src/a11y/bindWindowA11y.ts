import type { FocusableWindow } from "../focus/types.ts";
import { flattenRichText } from "../text/richText.ts";
import type {
  A11yMessageSnapshot,
  BindWindowA11yOptions,
  WindowA11yEvent,
  WindowA11ySubscription,
} from "./types.ts";

/**
 * Maps window/selection/message/focus sources to captioner-ready semantic events.
 * Does not create DOM nodes or use a Phaser event bus.
 */
export function bindWindowA11y(options: BindWindowA11yOptions): WindowA11ySubscription {
  const subscriptions: Array<{ unsubscribe(): void }> = [];
  let closed = false;

  const emit = (event: WindowA11yEvent): void => {
    if (!closed) {
      options.listener(event);
    }
  };

  if (options.lifecycle !== undefined) {
    let previousPhase = "closed";
    subscriptions.push(
      options.lifecycle.subscribeTransition((state) => {
        if (state.phase === "open" && previousPhase !== "open") {
          emit({ type: "windowOpened", windowId: options.windowId, phase: "open" });
        } else if (state.phase === "closed" && previousPhase !== "closed") {
          emit({ type: "windowClosed", windowId: options.windowId });
        }
        previousPhase = state.phase;
      }),
    );
  }

  if (options.selection !== undefined) {
    subscriptions.push(
      options.selection.subscribeSelection((index, item) => {
        emit({
          type: "selectionChanged",
          windowId: options.windowId,
          index,
          itemId: item?.id ?? "",
          label:
            item === null || item === undefined
              ? ""
              : typeof item.label === "string"
                ? item.label
                : flattenRichText(item.label).text,
        });
      }),
    );
  }

  if (options.message !== undefined) {
    let previous: A11yMessageSnapshot | null = null;
    subscriptions.push(
      options.message.subscribeMessage((snapshot) => {
        const last = previous;
        previous = snapshot;
        if (snapshot.completed) {
          if (last === null || !last.completed) {
            emit({
              type: "messageComplete",
              windowId: options.windowId,
              revealedText: snapshot.revealedText,
            });
          }
          return;
        }
        const pageChanged =
          snapshot.pausedForAdvance &&
          (last === null ||
            !last.pausedForAdvance ||
            last.pageIndex !== snapshot.pageIndex ||
            last.layoutPageIndex !== snapshot.layoutPageIndex);
        if (pageChanged) {
          emit({
            type: "messagePage",
            windowId: options.windowId,
            pageIndex: snapshot.pageIndex,
            layoutPageIndex: snapshot.layoutPageIndex,
            revealedText: snapshot.revealedText,
            pausedForAdvance: snapshot.pausedForAdvance,
          });
        }
      }),
    );
  }

  if (options.focus !== undefined) {
    const focusSource = options.focus;
    let previousActive: FocusableWindow | null = null;
    let previousModal = false;
    let previousStackDepth = 0;
    subscriptions.push(
      focusSource.subscribe((snapshot) => {
        if (snapshot.active === previousActive) {
          return;
        }
        const released = previousActive;
        const releasedModal = previousModal;
        const releasedStackDepth = previousStackDepth;
        previousActive = snapshot.active;
        previousModal = snapshot.modal;
        previousStackDepth = snapshot.stackDepth;
        if (released !== null) {
          emit({
            type: "focusReleased",
            windowId: focusSource.idOf(released),
            modal: releasedModal,
            stackDepth: releasedStackDepth,
          });
        }
        if (snapshot.active !== null) {
          emit({
            type: "focusAcquired",
            windowId: focusSource.idOf(snapshot.active),
            modal: snapshot.modal,
            stackDepth: snapshot.stackDepth,
          });
        }
      }),
    );
  }

  return {
    unsubscribe: () => {
      if (closed) {
        return;
      }
      closed = true;
      for (const subscription of subscriptions) {
        subscription.unsubscribe();
      }
      subscriptions.length = 0;
    },
  };
}
