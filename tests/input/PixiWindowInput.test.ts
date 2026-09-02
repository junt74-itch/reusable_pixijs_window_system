import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container } from "pixi.js";
import { PixiWindowInput } from "../../src/input/PixiWindowInput.ts";
import type { WindowActionEvent, WindowDragEvent } from "../../src/input/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

type FederatedHandler = (event: Record<string, unknown>) => void;

class StubStage {
  private readonly handlers = new Map<string, Set<FederatedHandler>>();

  public on(event: string, handler: FederatedHandler): this {
    const set = this.handlers.get(event) ?? new Set<FederatedHandler>();
    set.add(handler);
    this.handlers.set(event, set);
    return this;
  }

  public off(event: string, handler: FederatedHandler): this {
    this.handlers.get(event)?.delete(handler);
    return this;
  }

  public emit(event: string, payload: Record<string, unknown>): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(payload);
    }
  }
}

class StubKeyboardTarget {
  private readonly handlers = new Map<string, Set<(event: KeyboardEvent) => void>>();

  public addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const handler = listener as (event: KeyboardEvent) => void;
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
  }

  public removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    this.handlers.get(type)?.delete(listener as (event: KeyboardEvent) => void);
  }

  public dispatch(type: string, event: KeyboardEvent): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(event);
    }
  }
}

function createStubHost(stage: StubStage, onDestroyHandlers: Set<() => void>): PixiWindowHost {
  return {
    stage: stage as unknown as PixiWindowHost["stage"],
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => false,
    onDestroy: (handler) => {
      onDestroyHandlers.add(handler);
      return () => {
        onDestroyHandlers.delete(handler);
      };
    },
    destroy: () => {
      for (const handler of onDestroyHandlers) {
        handler();
      }
      onDestroyHandlers.clear();
    },
  };
}

function createKeyboardEvent(code: string, type: "keydown" | "keyup"): KeyboardEvent {
  return { code, type } as KeyboardEvent;
}

function createPointerEvent(
  stage: StubStage,
  options: {
    pointerId?: number;
    globalX?: number;
    globalY?: number;
    buttons?: number;
  } = {},
): Record<string, unknown> {
  const globalX = options.globalX ?? 0;
  const globalY = options.globalY ?? 0;
  return {
    pointerId: options.pointerId ?? 1,
    buttons: options.buttons ?? 1,
    global: { x: globalX, y: globalY },
    getLocalPosition: () => ({ x: globalX, y: globalY }),
  };
}

describe("PixiWindowInput", () => {
  test("ArrowUp pressed and released maps to up action", () => {
    const stage = new StubStage();
    const destroyHandlers = new Set<() => void>();
    const host = createStubHost(stage, destroyHandlers);
    const keyboard = new StubKeyboardTarget();
    const actions: WindowActionEvent[] = [];
    const input = new PixiWindowInput(host, { keyboardTarget: keyboard });
    input.subscribeAction((event) => actions.push(event));

    keyboard.dispatch("keydown", createKeyboardEvent("ArrowUp", "keydown"));
    keyboard.dispatch("keyup", createKeyboardEvent("ArrowUp", "keyup"));

    expect(actions.map((event) => `${event.action}:${event.phase}`)).toEqual([
      "up:pressed",
      "up:released",
    ]);
    input.dispose();
  });

  test("update(400) emits keyboard repeat after initial delay", () => {
    const stage = new StubStage();
    const destroyHandlers = new Set<() => void>();
    const host = createStubHost(stage, destroyHandlers);
    const keyboard = new StubKeyboardTarget();
    const actions: WindowActionEvent[] = [];
    const input = new PixiWindowInput(host, { keyboardTarget: keyboard });
    input.subscribeAction((event) => actions.push(event));

    keyboard.dispatch("keydown", createKeyboardEvent("ArrowUp", "keydown"));
    input.update(400);

    expect(actions.some((event) => event.action === "up" && event.phase === "repeated")).toBe(true);
    input.dispose();
  });

  test("dispose stops further emits", () => {
    const stage = new StubStage();
    const destroyHandlers = new Set<() => void>();
    const host = createStubHost(stage, destroyHandlers);
    const keyboard = new StubKeyboardTarget();
    const actions: WindowActionEvent[] = [];
    const input = new PixiWindowInput(host, { keyboardTarget: keyboard });
    input.subscribeAction((event) => actions.push(event));
    input.dispose();

    keyboard.dispatch("keydown", createKeyboardEvent("ArrowUp", "keydown"));
    expect(actions.length).toBe(0);
  });

  test("host.destroy disposes input", () => {
    const stage = new StubStage();
    const destroyHandlers = new Set<() => void>();
    const host = createStubHost(stage, destroyHandlers);
    const keyboard = new StubKeyboardTarget();
    const actions: WindowActionEvent[] = [];
    const input = new PixiWindowInput(host, { keyboardTarget: keyboard });
    input.subscribeAction((event) => actions.push(event));
    host.destroy();

    keyboard.dispatch("keydown", createKeyboardEvent("ArrowUp", "keydown"));
    expect(actions.length).toBe(0);
    expect(input.isAdapterDisposed()).toBe(true);
  });

  test("drag deltas are integers with remainder accumulation", () => {
    const stage = new StubStage();
    const destroyHandlers = new Set<() => void>();
    const host = createStubHost(stage, destroyHandlers);
    const keyboard = new StubKeyboardTarget();
    const drags: WindowDragEvent[] = [];
    const input = new PixiWindowInput(host, {
      keyboardTarget: keyboard,
      localToWorld: (localX, localY) => ({ worldX: localX, worldY: localY }),
    });
    input.subscribeDrag((event) => drags.push(event));

    stage.emit("pointerdown", createPointerEvent(stage, { globalX: 0, globalY: 0 }));
    stage.emit("pointermove", createPointerEvent(stage, { globalX: 1.4, globalY: 2.6 }));
    stage.emit("pointermove", createPointerEvent(stage, { globalX: 2.2, globalY: 3.1 }));
    stage.emit("pointerup", createPointerEvent(stage, { globalX: 2.2, globalY: 3.1, buttons: 0 }));

    const moved = drags.filter((event) => event.phase === "moved");
    expect(moved.every((event) => Number.isInteger(event.deltaX))).toBe(true);
    expect(moved.every((event) => Number.isInteger(event.deltaY))).toBe(true);
    expect(moved[0]?.deltaX).toBe(1);
    expect(moved[0]?.deltaY).toBe(2);
    input.dispose();
  });

  test("source uses KeyboardEvent.code and has no Phaser imports", () => {
    const source = readFileSync(join(import.meta.dir, "../../src/input/PixiWindowInput.ts"), "utf8");
    expect(source.includes("phaser")).toBe(false);
    expect(source.includes("KeyCodes")).toBe(false);
    expect(source.includes("event.code")).toBe(true);
    expect(source.includes("ArrowUp")).toBe(true);
    expect(source.includes("addEventListener")).toBe(true);
    expect(source.includes('stage.on("pointerdown"')).toBe(true);
  });
});
