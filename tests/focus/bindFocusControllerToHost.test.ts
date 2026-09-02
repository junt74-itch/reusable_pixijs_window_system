import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container } from "pixi.js";
import { bindFocusControllerToHost } from "../../src/focus/bindHostDestroy.ts";
import { WindowFocusController } from "../../src/focus/WindowFocusController.ts";
import type { FocusableWindow } from "../../src/focus/types.ts";
import { WindowFocusError } from "../../src/focus/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

class FakeWindow implements FocusableWindow {
  public active = false;
  public destroyed = false;

  public activate(): this {
    this.active = true;
    return this;
  }

  public deactivate(): this {
    this.active = false;
    return this;
  }

  public isActive(): boolean {
    return this.active;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public canConsumeInput(): boolean {
    return this.active;
  }
}

function createStubHost(): {
  host: PixiWindowHost;
  destroyHandlers: Set<() => void>;
} {
  const stage = new Container();
  const destroyHandlers = new Set<() => void>();
  let destroyed = false;

  const host: PixiWindowHost = {
    stage,
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => destroyed,
    onDestroy: (handler: () => void) => {
      if (destroyed) {
        handler();
        return () => {};
      }
      destroyHandlers.add(handler);
      return () => {
        destroyHandlers.delete(handler);
      };
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      for (const handler of [...destroyHandlers]) {
        handler();
      }
      destroyHandlers.clear();
    },
  };

  return { host, destroyHandlers };
}

describe("bindFocusControllerToHost", () => {
  test("host destroy disposes the controller", () => {
    const { host } = createStubHost();
    const focus = new WindowFocusController();
    const window = new FakeWindow();
    bindFocusControllerToHost(host, focus);
    focus.acquire(window);
    expect(focus.getActive()).toBe(window);

    host.destroy();

    expect(() => focus.acquire(window)).toThrow(WindowFocusError);
  });

  test("unbind disposes without destroying the host", () => {
    const { host } = createStubHost();
    const focus = new WindowFocusController();
    const window = new FakeWindow();
    const unbind = bindFocusControllerToHost(host, focus);
    focus.acquire(window);

    unbind();

    expect(() => focus.acquire(window)).toThrow(WindowFocusError);
    expect(() => host.destroy()).not.toThrow();
  });

  test("binding to an already destroyed host disposes immediately", () => {
    const { host } = createStubHost();
    const focus = new WindowFocusController();
    const window = new FakeWindow();
    focus.acquire(window);

    host.destroy();
    bindFocusControllerToHost(host, focus);

    expect(() => focus.acquire(window)).toThrow(WindowFocusError);
  });

  test("source has no phaser, pixi.js, add.graphics, or Scenes.Events", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../src/focus/bindHostDestroy.ts"),
      "utf8",
    );
    expect(source.includes('from "phaser"')).toBe(false);
    expect(source.includes('from "pixi.js"')).toBe(false);
    expect(source.includes("add.graphics")).toBe(false);
    expect(source.includes("Scenes.Events")).toBe(false);
  });
});
