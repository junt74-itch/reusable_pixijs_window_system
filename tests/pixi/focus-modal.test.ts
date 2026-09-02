import { describe, expect, test } from "bun:test";
import { Container } from "pixi.js";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import { WindowFocusController } from "../../src/focus/WindowFocusController.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { WindowBase } from "../../src/pixi/WindowBase.ts";

class FakeGraphics implements GraphicsLike {
  public clear(): void {}
  public fillStyle(): this {
    return this;
  }
  public lineStyle(): this {
    return this;
  }
  public fillRect(): this {
    return this;
  }
  public strokeRect(): this {
    return this;
  }
  public setVisible(): void {}
  public setAlpha(): void {}
  public destroy(): void {}
}

function createFakeGraphicsFactory(): GraphicsFactory {
  return {
    createBackground: () => new FakeGraphics(),
    createFrame: () => new FakeGraphics(),
  };
}

function createStubHost(): PixiWindowHost {
  const stage = new Container();
  let destroyed = false;
  const destroyHandlers = new Set<() => void>();

  return {
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
}

const defaultConfig = { x: 0, y: 0, width: 200, height: 80 };

async function createOpenWindow(host: PixiWindowHost, x: number): Promise<WindowBase> {
  const window = new WindowBase(host, { ...defaultConfig, x }, {
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
  });
  await window.open(0);
  window.show();
  return window;
}

describe("focus modal with WindowBase", () => {
  test("non-modal acquire leaves exactly one active window that can consume input", async () => {
    const host = createStubHost();
    const focus = new WindowFocusController();
    const first = await createOpenWindow(host, 0);
    const second = await createOpenWindow(host, 100);

    focus.acquire(first);
    focus.acquire(second);

    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);
    expect(first.canConsumeInput()).toBe(false);
    expect(second.canConsumeInput()).toBe(true);
    expect(focus.getActive()).toBe(second);

    focus.dispose();
    first.destroy();
    second.destroy();
  });

  test("modal acquire deactivates background and sets snapshot.modal", async () => {
    const host = createStubHost();
    const focus = new WindowFocusController();
    const background = await createOpenWindow(host, 0);
    const modal = await createOpenWindow(host, 100);

    focus.acquire(background);
    focus.acquire(modal, { modal: true });

    expect(background.isActive()).toBe(false);
    expect(modal.isActive()).toBe(true);
    expect(background.canConsumeInput()).toBe(false);
    expect(modal.canConsumeInput()).toBe(true);
    expect(focus.getSnapshot().modal).toBe(true);

    focus.dispose();
    background.destroy();
    modal.destroy();
  });

  test("releasing modal restores background active and input consumption", async () => {
    const host = createStubHost();
    const focus = new WindowFocusController();
    const background = await createOpenWindow(host, 0);
    const modal = await createOpenWindow(host, 100);

    focus.acquire(background);
    focus.acquire(modal, { modal: true });
    focus.release(modal);

    expect(focus.getActive()).toBe(background);
    expect(background.isActive()).toBe(true);
    expect(modal.isActive()).toBe(false);
    expect(background.canConsumeInput()).toBe(true);
    expect(modal.canConsumeInput()).toBe(false);
    expect(focus.getSnapshot().modal).toBe(false);

    focus.dispose();
    background.destroy();
    modal.destroy();
  });
});
