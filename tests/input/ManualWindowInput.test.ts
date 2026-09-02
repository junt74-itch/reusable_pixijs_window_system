import { describe, expect, test } from "bun:test";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import type { WindowDragEvent, WindowWheelEvent } from "../../src/input/types.ts";

describe("ManualWindowInput", () => {
  test("supports independent subscriptions and readonly snapshots", () => {
    const input = new ManualWindowInput();
    const seen: string[] = [];
    const subA = input.subscribeAction((event) => {
      seen.push(`${event.action}:${event.phase}`);
    });
    input.subscribeAction((event) => {
      seen.push(`b:${event.action}`);
    });
    input.pushAction("confirm");
    subA.unsubscribe();
    input.pushAction("cancel");
    expect(seen).toEqual(["confirm:pressed", "b:confirm", "b:cancel"]);
  });

  test("disposed adapter emits nothing", () => {
    const input = new ManualWindowInput();
    let count = 0;
    input.subscribeAction(() => {
      count += 1;
    });
    input.dispose();
    input.pushAction("up");
    expect(count).toBe(0);
  });

  test("wheel events carry delta and pointer id", () => {
    const input = new ManualWindowInput();
    const seen: WindowWheelEvent[] = [];
    input.subscribeWheel((event) => {
      seen.push({ ...event });
    });
    input.pushWheel(0, -120, { pointerId: 3, worldX: 10, worldY: 20 });
    expect(seen).toHaveLength(1);
    expect(seen[0]?.deltaY).toBe(-120);
    expect(seen[0]?.pointerId).toBe(3);
    expect(seen[0]?.worldX).toBe(10);
  });

  test("pageUp and pageDown actions remain available", () => {
    const input = new ManualWindowInput();
    const actions: string[] = [];
    input.subscribeAction((event) => {
      actions.push(event.action);
    });
    input.pushAction("pageUp");
    input.pushAction("pageDown");
    expect(actions).toEqual(["pageUp", "pageDown"]);
  });

  test("drag start, move, and end include pointer id and deltas", () => {
    const input = new ManualWindowInput();
    const seen: WindowDragEvent[] = [];
    input.subscribeDrag((event) => {
      seen.push({ ...event });
    });
    input.pushDrag("started", 1, 0, 0, 100, 100);
    input.pushDrag("moved", 1, 0, 10, 100, 120);
    input.pushDrag("ended", 1, 0, 20, 100, 140);
    expect(seen.map((event) => event.phase)).toEqual(["started", "moved", "ended"]);
    expect(seen[0]?.deltaX).toBe(0);
    expect(seen[1]?.deltaY).toBe(20);
    expect(seen[2]?.pointerId).toBe(1);
  });

  test("drag deltas are integers and accumulate sub-pixel movement", () => {
    const input = new ManualWindowInput();
    const seen: WindowDragEvent[] = [];
    input.subscribeDrag((event) => {
      seen.push({ ...event });
    });
    input.pushDrag("started", 1, 0, 0, 100, 100);
    input.pushDrag("moved", 1, 0, 0, 100, 100.4);
    input.pushDrag("moved", 1, 0, 0, 100, 100.8);
    input.pushDrag("moved", 1, 0, 0, 100, 101.2);
    expect(seen[1]?.deltaY).toBe(0);
    expect(seen[2]?.deltaY).toBe(0);
    expect(seen[3]?.deltaY).toBe(1);
    for (const event of seen) {
      expect(Number.isInteger(event.deltaX)).toBe(true);
      expect(Number.isInteger(event.deltaY)).toBe(true);
    }
  });

  test("dispose clears wheel and drag subscriptions", () => {
    const input = new ManualWindowInput();
    let wheelCount = 0;
    let dragCount = 0;
    input.subscribeWheel(() => {
      wheelCount += 1;
    });
    input.subscribeDrag(() => {
      dragCount += 1;
    });
    input.dispose();
    input.pushWheel(0, 10);
    input.pushDrag("started", 0, 0, 0, 0, 0);
    expect(wheelCount).toBe(0);
    expect(dragCount).toBe(0);
    expect(input.getSubscriptionCounts()).toEqual({
      action: 0,
      pointer: 0,
      wheel: 0,
      drag: 0,
    });
  });
});
