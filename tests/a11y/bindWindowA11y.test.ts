import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { bindWindowA11y } from "../../src/a11y/bindWindowA11y.ts";
import type {
  A11yLifecycleSource,
  A11yMessageSnapshot,
  A11ySelectionItem,
  A11ySelectionSource,
  WindowA11yEvent,
} from "../../src/a11y/types.ts";
import { TransitionController } from "../../src/core/TransitionController.ts";
import { WindowFocusController } from "../../src/focus/WindowFocusController.ts";
import type { FocusableWindow } from "../../src/focus/types.ts";
import { MessageController } from "../../src/message/MessageController.ts";
import type { MessageToken } from "../../src/message/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";

const ROOT = resolve(import.meta.dir, "../..");

function createFocusable(id: string): FocusableWindow & { id: string } {
  let active = false;
  return {
    id,
    activate: () => {
      active = true;
    },
    deactivate: () => {
      active = false;
    },
    isActive: () => active,
    isDestroyed: () => false,
  };
}

describe("bindWindowA11y", () => {
  test("emits opened and closed from lifecycle phase changes", () => {
    const transition = new TransitionController(100);
    const lifecycle: A11yLifecycleSource = {
      subscribeTransition: (listener) => transition.subscribe(listener),
    };
    const events: WindowA11yEvent[] = [];
    const sub = bindWindowA11y({
      windowId: "msg",
      lifecycle,
      listener: (event) => {
        events.push(event);
      },
    });
    void transition.open();
    transition.update(100);
    void transition.close();
    transition.update(100);
    expect(events).toEqual([
      { type: "windowOpened", windowId: "msg", phase: "open" },
      { type: "windowClosed", windowId: "msg" },
    ]);
    sub.unsubscribe();
    void transition.open(0);
    expect(events).toHaveLength(2);
  });

  test("emits selectionChanged with item fields for a captioner", () => {
    const listeners: Array<(index: number, item: A11ySelectionItem | null) => void> = [];
    const selection: A11ySelectionSource = {
      subscribeSelection: (listener) => {
        listeners.push(listener);
        return {
          unsubscribe: () => {
            const index = listeners.indexOf(listener);
            if (index >= 0) {
              listeners.splice(index, 1);
            }
          },
        };
      },
    };
    const events: WindowA11yEvent[] = [];
    bindWindowA11y({
      windowId: "choice",
      selection,
      listener: (event) => {
        events.push(event);
      },
    });
    listeners[0]?.(1, { id: "defend", label: "Defend" });
    expect(events).toEqual([
      {
        type: "selectionChanged",
        windowId: "choice",
        index: 1,
        itemId: "defend",
        label: "Defend",
      },
    ]);
  });

  test("emits selectionChanged with flattened RichText label", () => {
    const listeners: Array<(index: number, item: A11ySelectionItem | null) => void> = [];
    const selection: A11ySelectionSource = {
      subscribeSelection: (listener) => {
        listeners.push(listener);
        return { unsubscribe: () => undefined };
      },
    };
    const events: WindowA11yEvent[] = [];
    bindWindowA11y({
      windowId: "choice",
      selection,
      listener: (event) => {
        events.push(event);
      },
    });
    listeners[0]?.(0, {
      id: "skill",
      label: { spans: [{ text: "Fire" }, { text: "ball", fontSize: 18 }] },
    });
    expect(events).toEqual([
      {
        type: "selectionChanged",
        windowId: "choice",
        index: 0,
        itemId: "skill",
        label: "Fireball",
      },
    ]);
  });

  test("bindWindowA11y flattens RichText labels for captioners", () => {
    const source = readFileSync(join(ROOT, "src/a11y/bindWindowA11y.ts"), "utf8");
    expect(source.includes("flattenRichText")).toBe(true);
    expect(source.includes('typeof item.label === "string"')).toBe(true);
  });

  test("emits message page and complete, not every typed glyph", () => {
    const snapshots: Array<(snapshot: A11yMessageSnapshot) => void> = [];
    const events: WindowA11yEvent[] = [];
    bindWindowA11y({
      windowId: "msg",
      message: {
        subscribeMessage: (listener) => {
          snapshots.push(listener);
          return { unsubscribe: () => undefined };
        },
      },
      listener: (event) => {
        events.push(event);
      },
    });
    const typing: A11yMessageSnapshot = {
      revealedText: "He",
      pageIndex: 0,
      layoutPageIndex: 0,
      pausedForAdvance: false,
      completed: false,
    };
    snapshots[0]?.(typing);
    snapshots[0]?.({ ...typing, revealedText: "Hello" });
    snapshots[0]?.({
      revealedText: "Hello",
      pageIndex: 0,
      layoutPageIndex: 0,
      pausedForAdvance: true,
      completed: false,
    });
    snapshots[0]?.({
      revealedText: "Next",
      pageIndex: 1,
      layoutPageIndex: 0,
      pausedForAdvance: false,
      completed: true,
    });
    expect(events.map((event) => event.type)).toEqual(["messagePage", "messageComplete"]);
  });

  test("emits focus acquired and released without DOM", () => {
    const focus = new WindowFocusController();
    const first = createFocusable("one");
    const second = createFocusable("two");
    const ids = new Map<FocusableWindow, string>([
      [first, "one"],
      [second, "two"],
    ]);
    const events: WindowA11yEvent[] = [];
    bindWindowA11y({
      windowId: "unused",
      focus: {
        subscribe: (listener) => focus.subscribe(listener),
        idOf: (window) => ids.get(window) ?? "unknown",
      },
      listener: (event) => {
        events.push(event);
      },
    });
    focus.acquire(first);
    focus.acquire(second, { modal: true });
    focus.release(second);
    expect(events).toEqual([
      { type: "focusAcquired", windowId: "one", modal: false, stackDepth: 1 },
      {
        type: "focusReleased",
        windowId: "one",
        modal: false,
        stackDepth: 1,
      },
      { type: "focusAcquired", windowId: "two", modal: true, stackDepth: 2 },
      {
        type: "focusReleased",
        windowId: "two",
        modal: true,
        stackDepth: 2,
      },
      { type: "focusAcquired", windowId: "one", modal: false, stackDepth: 1 },
    ]);
    focus.dispose();
  });

  test("message controller snapshot subscribe fires page then complete", () => {
    const tokens: MessageToken[] = [
      { type: "text", value: "A", start: 0, end: 1 },
      { type: "pageBreak", start: 1, end: 2 },
      { type: "text", value: "B", start: 2, end: 3 },
    ];
    const input = new ManualWindowInput();
    const controller = new MessageController(input);
    const events: WindowA11yEvent[] = [];
    const sub = bindWindowA11y({
      windowId: "msg",
      message: {
        subscribeMessage: (listener) => controller.subscribeSnapshot(listener),
      },
      listener: (event) => {
        events.push(event);
      },
    });
    void controller.start({ tokens, charsPerSecond: 120 });
    for (let step = 0; step < 20 && !controller.getLatestSnapshot().pausedForAdvance; step += 1) {
      controller.update(16);
    }
    expect(events[events.length - 1]?.type).toBe("messagePage");
    input.pushAction("confirm");
    for (let step = 0; step < 20 && !controller.getLatestSnapshot().completed; step += 1) {
      controller.update(16);
    }
    expect(events[events.length - 1]?.type).toBe("messageComplete");
    sub.unsubscribe();
    controller.dispose();
  });
});

describe("a11y isolation", () => {
  test("a11y module stays Phaser-free and creates no DOM", () => {
    const binder = readFileSync(join(ROOT, "src/a11y/bindWindowA11y.ts"), "utf8");
    const types = readFileSync(join(ROOT, "src/a11y/types.ts"), "utf8");
    for (const source of [binder, types]) {
      expect(source.includes('from "phaser"')).toBe(false);
      expect(source.includes("add.text")).toBe(false);
      expect(source.includes("document.")).toBe(false);
      expect(source.includes("EventEmitter")).toBe(false);
    }
  });
});
