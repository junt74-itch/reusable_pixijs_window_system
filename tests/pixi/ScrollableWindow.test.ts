import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container, Graphics } from "pixi.js";
import { computeContentBounds, resolveWindowTheme } from "../../src/core/theme.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { WindowDragEvent } from "../../src/input/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { createScrollbarContentDragGate } from "../../src/scroll/scrollInputBinding.ts";
import { computeScrollbarTrackRect } from "../../src/scroll/scrollChrome.ts";
import { ScrollableWindow } from "../../src/pixi/ScrollableWindow.ts";
import { ScrollbarRenderer } from "../../src/pixi/ScrollbarRenderer.ts";
import { WindowBase } from "../../src/pixi/WindowBase.ts";
import { ScrollController } from "../../src/scroll/ScrollController.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";

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
  const destroyHandlers = new Set<() => void>();
  let destroyed = false;

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

function createScrollableWindow(
  options: ConstructorParameters<typeof ScrollableWindow>[2] = {},
): ScrollableWindow {
  const host = createStubHost();
  return new ScrollableWindow(
    host,
    { x: 10, y: 20, width: 200, height: 100 },
    {
      createRenderer: (context) => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
      ...options,
    },
  );
}

function collectGraphics(container: Container): Graphics[] {
  const found: Graphics[] = [];
  const walk = (node: Container): void => {
    for (const child of node.children) {
      if (child instanceof Graphics) {
        found.push(child);
      }
      if (child instanceof Container) {
        walk(child);
      }
    }
  };
  walk(container);
  return found;
}

describe("ScrollableWindow", () => {
  test("extends WindowBase and WindowBase source has no scroll field", () => {
    const window = createScrollableWindow();
    expect(window).toBeInstanceOf(WindowBase);
    expect(window).toBeInstanceOf(ScrollableWindow);

    const windowBaseSource = readFileSync(join(import.meta.dir, "../../src/pixi/WindowBase.ts"), "utf8");
    expect(windowBaseSource.includes("scrollController")).toBe(false);
    expect(windowBaseSource.includes("scrollBody")).toBe(false);
    expect(windowBaseSource.includes("ScrollController")).toBe(false);
  });

  test("getScrollBody is parented through the clip viewport", () => {
    const window = createScrollableWindow();
    const body = window.getScrollBody();
    const viewport = body.parent;
    expect(viewport).toBeInstanceOf(Container);
    expect(viewport?.parent).toBe(window.getContentContainer());
  });

  test("setScrollContentSize and setScrollOffset move body by integer -offset on y axis", () => {
    const window = createScrollableWindow();
    window.setScrollContentSize(200);
    window.setScrollOffset(37.9);
    expect(window.getScrollBody().y).toBe(Math.trunc(-37.9));
    expect(window.getScrollOffset()).toBe(37);
  });

  test("pageDown, wheel, and drag increase offset after open and activate", async () => {
    const input = new ManualWindowInput();
    const window = createScrollableWindow({ input });
    window.setScrollContentSize(300);

    await window.open(0);
    window.activate();
    window.enable();
    expect(window.canConsumeInput()).toBe(true);

    input.pushAction("pageDown");
    const afterPage = window.getScrollOffset();
    expect(afterPage).toBeGreaterThan(0);

    input.pushWheel(0, 1);
    const afterWheel = window.getScrollOffset();
    expect(afterWheel).toBeGreaterThan(afterPage);

    input.pushDrag("started", 1, 0, 0, 100, 100);
    input.pushDrag("moved", 1, 0, 10, 100, 90);
    expect(window.getScrollOffset()).toBeGreaterThan(afterWheel);
  });

  test("showScrollbar adds track and thumb graphics on content with pointer capture helper", () => {
    const window = createScrollableWindow({ showScrollbar: true });
    window.setScrollContentSize(300);

    const graphics = collectGraphics(window.getContentContainer());
    expect(graphics.length).toBeGreaterThanOrEqual(2);
    expect(graphics.some((node) => node.visible)).toBe(true);

    const scrollbarSource = readFileSync(
      join(import.meta.dir, "../../src/pixi/ScrollbarRenderer.ts"),
      "utf8",
    );
    expect(scrollbarSource.includes("isPointerCaptured")).toBe(true);
    expect(scrollbarSource.includes("beginFill")).toBe(false);
  });

  test("overflow indicators toggle visibility when content exceeds viewport", () => {
    const window = createScrollableWindow();
    const contentHeight = window.getContentBounds().height;
    window.setScrollContentSize(contentHeight + 120);

    const graphics = collectGraphics(window.getContentContainer());
    const visibleIndicators = graphics.filter((node) => node.visible);
    expect(visibleIndicators.length).toBeGreaterThanOrEqual(1);

    window.setScrollOffset(window.getScrollController().getBounds().maxOffset);
    const afterMax = collectGraphics(window.getContentContainer()).filter((node) => node.visible);
    expect(afterMax.length).toBeGreaterThanOrEqual(1);
  });

  test("onLayoutChanged resyncs viewport metrics and clip bounds", () => {
    const window = createScrollableWindow();
    const theme = resolveWindowTheme({ padding: 8 });
    window.setScrollContentSize(240);
    window.setScrollOffset(12);

    window.setSize(260, 140);
    window.setPadding(theme.padding);

    const bounds = window.getContentBounds();
    expect(bounds).toEqual(computeContentBounds(260, 140, theme.padding));
    expect(window.getScrollController().getBounds().viewportSize).toBe(bounds.height);
    expect(window.getScrollBody().y).toBe(Math.trunc(-window.getScrollOffset()));
  });

  test("source has no phaser import, beginFill, or SelectableWindow", () => {
    const files = [
      "ScrollableWindow.ts",
      "ScrollContentClip.ts",
      "ScrollbarRenderer.ts",
      "ScrollOverflowIndicators.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(import.meta.dir, "../../src/pixi", file), "utf8");
      expect(source.includes('from "phaser"')).toBe(false);
      expect(source.includes("from 'phaser'")).toBe(false);
      expect(source.includes("beginFill")).toBe(false);
      expect(source.includes("SelectableWindow")).toBe(false);
    }
  });
});

describe("createScrollbarContentDragGate", () => {
  test("blocks content drag while the scrollbar owns the pointer", () => {
    let captured = false;
    const scrollbar = {
      isPointerCaptured: () => captured,
      containsContentLocalPoint: () => false,
    };
    const gate = createScrollbarContentDragGate(scrollbar, (worldX, worldY) => ({
      x: worldX,
      y: worldY,
    }));
    const event = { worldX: 10, worldY: 10 } as WindowDragEvent;
    expect(gate(event)).toBe(true);
    captured = true;
    expect(gate(event)).toBe(false);
  });

  test("blocks content drag over the track even before capture is set", () => {
    const track = computeScrollbarTrackRect(100, 100, 8);
    const scrollbar = {
      isPointerCaptured: () => false,
      containsContentLocalPoint: (x: number, y: number) => x >= track.x && y >= track.y,
    };
    const gate = createScrollbarContentDragGate(scrollbar, (worldX, worldY) => ({
      x: worldX,
      y: worldY,
    }));
    expect(gate({ worldX: 95, worldY: 10 } as WindowDragEvent)).toBe(false);
    expect(gate({ worldX: 10, worldY: 10 } as WindowDragEvent)).toBe(true);
  });
});

describe("ScrollbarRenderer", () => {
  test("exposes pointer capture and track hit testing", () => {
    const host = createStubHost();
    const content = new Container();
    host.stage.addChild(content);
    const controller = new ScrollController();
    controller.setContentSize(200);
    controller.setViewportSize(80);

    const scrollbar = new ScrollbarRenderer(content, controller, {
      getContentWidth: () => 100,
      getContentHeight: () => 100,
    });
    scrollbar.update();

    expect(scrollbar.isPointerCaptured()).toBe(false);
    const track = scrollbar.getTrackRect();
    expect(track).not.toBeNull();
    if (track !== null) {
      expect(scrollbar.containsContentLocalPoint(track.x + 1, 5)).toBe(true);
    }

    scrollbar.destroy();
  });
});
