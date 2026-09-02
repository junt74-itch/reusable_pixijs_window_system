import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container } from "pixi.js";
import { computeContentBounds, resolveWindowTheme } from "../../src/core/theme.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import { WindowDestroyedError } from "../../src/core/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { WindowBase } from "../../src/pixi/WindowBase.ts";
import type { WindowRendererFactory, WindowRendererFactoryContext } from "../../src/pixi/windowRendererFactory.ts";

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

const defaultConfig = { x: 10, y: 20, width: 200, height: 80 };

describe("WindowBase", () => {
  test("starts closed with zero openness and collapsed scale", () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);

    expect(window.getPhase()).toBe("closed");
    expect(window.getOpenness()).toBe(0);
    expect(window.getRoot().scale.y).toBe(0);
    expect(window.getRoot().visible).toBe(false);
    expect(host.stage.children).toContain(window.getRoot());
  });

  test("open(0) synchronously opens with full scale", async () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);

    await window.open(0);

    expect(window.getPhase()).toBe("open");
    expect(window.getOpenness()).toBe(1);
    expect(window.getRoot().scale.y).toBe(1);
    expect(window.getRoot().visible).toBe(true);
  });

  test("canConsumeInput requires open, visible, active, and enabled", async () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);

    expect(window.canConsumeInput()).toBe(false);

    await window.open(0);
    expect(window.canConsumeInput()).toBe(false);

    window.activate();
    expect(window.canConsumeInput()).toBe(true);

    window.disable();
    expect(window.canConsumeInput()).toBe(false);

    window.enable();
    window.hide();
    expect(window.canConsumeInput()).toBe(false);

    window.show();
    window.deactivate();
    expect(window.canConsumeInput()).toBe(false);
  });

  test("show and hide affect visible flag and root visibility with openness gating", async () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);

    expect(window.isVisible()).toBe(true);
    expect(window.getRoot().visible).toBe(false);

    window.hide();
    expect(window.isVisible()).toBe(false);
    expect(window.getRoot().visible).toBe(false);

    window.show();
    expect(window.isVisible()).toBe(true);
    expect(window.getRoot().visible).toBe(false);

    await window.open(0);
    expect(window.getRoot().visible).toBe(true);

    window.hide();
    expect(window.isVisible()).toBe(false);
    expect(window.getRoot().visible).toBe(false);
  });

  test("activate and deactivate toggle active state", () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);

    expect(window.isActive()).toBe(false);

    window.activate();
    expect(window.isActive()).toBe(true);

    window.deactivate();
    expect(window.isActive()).toBe(false);
  });

  test("setSize and setPadding update content bounds", () => {
    const { host } = createStubHost();
    const theme = resolveWindowTheme({ padding: 8 });
    const window = new WindowBase(host, { ...defaultConfig, theme });

    const initialBounds = window.getContentBounds();
    expect(initialBounds).toEqual(computeContentBounds(200, 80, theme.padding));

    window.setSize(240, 100);
    const resizedBounds = window.getContentBounds();
    expect(resizedBounds).toEqual(computeContentBounds(240, 100, theme.padding));
    expect(resizedBounds.width).toBeGreaterThan(initialBounds.width);

    window.setPadding(16);
    const paddedBounds = window.getContentBounds();
    const resolvedPadding = resolveWindowTheme({ padding: 16 }).padding;
    expect(paddedBounds).toEqual(computeContentBounds(240, 100, resolvedPadding));
    expect(paddedBounds.width).toBeLessThan(resizedBounds.width);
  });

  test("destroy is idempotent and blocks subsequent open", async () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);
    const root = window.getRoot();

    window.destroy();
    expect(window.isDestroyed()).toBe(true);
    expect(root.destroyed).toBe(true);

    window.destroy();
    expect(window.isDestroyed()).toBe(true);

    expect(() => void window.open()).toThrow(WindowDestroyedError);
  });

  test("host destroy cascades to window destroy", () => {
    const { host } = createStubHost();
    const window = new WindowBase(host, defaultConfig);
    const root = window.getRoot();

    host.destroy();

    expect(window.isDestroyed()).toBe(true);
    expect(root.destroyed).toBe(true);
  });

  test("createRenderer injection resolves through resolveWindowRenderer", () => {
    const { host } = createStubHost();
    const captured: { context?: WindowRendererFactoryContext; calls: number } = { calls: 0 };

    const createRenderer: WindowRendererFactory = (context) => {
      captured.calls += 1;
      captured.context = context;
      return new GraphicsWindowRenderer(createFakeGraphicsFactory());
    };

    const window = new WindowBase(host, defaultConfig, { createRenderer });

    expect(captured.calls).toBe(1);
    expect(captured.context?.host).toBe(host);
    expect(captured.context?.root).toBe(window.getRoot());
    expect(captured.context?.root.parent).toBe(host.stage);
  });

  test("source has no phaser import", () => {
    const source = readFileSync(join(import.meta.dir, "../../src/pixi/WindowBase.ts"), "utf8");
    expect(source.includes('from "phaser"')).toBe(false);
    expect(source.includes("from 'phaser'")).toBe(false);
    expect(source.includes("scene")).toBe(false);
    expect(source.includes("ticker")).toBe(false);
    expect(source.includes("toLocal")).toBe(true);
    expect(source.includes("toGlobal")).toBe(true);
    expect(source.includes("zIndex")).toBe(true);
    expect(source.includes("destroy({ children: true })")).toBe(true);
  });

  test("destroy source does not unload shared Assets cache", () => {
    const source = readFileSync(join(import.meta.dir, "../../src/pixi/WindowBase.ts"), "utf8");
    expect(source.includes("Assets.unload")).toBe(false);
    expect(source.includes("Assets.reset")).toBe(false);
  });
});
