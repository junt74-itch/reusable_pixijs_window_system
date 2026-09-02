import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container, Graphics } from "pixi.js";
import { resolveWindowTheme } from "../../src/core/theme.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import {
  createDefaultGraphicsWindowRenderer,
  resolveWindowRenderer,
  type WindowRendererFactory,
  type WindowRendererFactoryContext,
} from "../../src/pixi/windowRendererFactory.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

class RecordingContainer extends Container {
  public readonly addedChildren: unknown[] = [];

  public override addChild<T extends Container[]>(...children: T): T[number] {
    for (const child of children) {
      this.addedChildren.push(child);
    }
    return super.addChild(...children);
  }
}

class FakeGraphics implements GraphicsLike {
  public commands: string[] = [];

  public clear(): void {
    this.commands.push("clear");
  }

  public fillStyle(color: number, alpha?: number): this {
    this.commands.push(`fill:${color}:${alpha ?? 1}`);
    return this;
  }

  public lineStyle(lineWidth: number, color: number, alpha?: number): this {
    this.commands.push(`line:${lineWidth}:${color}:${alpha ?? 1}`);
    return this;
  }

  public fillRect(x: number, y: number, width: number, height: number): this {
    this.commands.push(`fillRect:${x},${y},${width},${height}`);
    return this;
  }

  public strokeRect(x: number, y: number, width: number, height: number): this {
    this.commands.push(`strokeRect:${x},${y},${width},${height}`);
    return this;
  }

  public setVisible(): void {}

  public setAlpha(): void {}

  public destroy(): void {
    this.commands.push("destroy");
  }
}

function createStubHost(root: Container): PixiWindowHost {
  return {
    stage: root,
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => false,
    onDestroy: () => () => {},
    destroy: () => {},
  };
}

describe("windowRendererFactory", () => {
  test("default factory parents Graphics children and supports resize/destroy", () => {
    const root = new RecordingContainer();
    const host = createStubHost(root);
    const context: WindowRendererFactoryContext = { host, root };
    const renderer = createDefaultGraphicsWindowRenderer(context);
    expect(renderer).toBeInstanceOf(GraphicsWindowRenderer);
    expect(root.addedChildren.length).toBe(2);
    expect(root.addedChildren.every((child) => child instanceof Graphics)).toBe(true);

    renderer.applyTheme(resolveWindowTheme());
    renderer.resize(120, 80);
    renderer.destroy();
  });

  test("injected factory can supply GraphicsLike and resize/destroy", () => {
    const root = new RecordingContainer();
    const host = createStubHost(root);
    const background = new FakeGraphics();
    const frame = new FakeGraphics();
    const factory: GraphicsFactory = {
      createBackground: () => background,
      createFrame: () => frame,
    };
    const custom: WindowRendererFactory = () => new GraphicsWindowRenderer(factory);
    const renderer = resolveWindowRenderer(custom, { host, root });
    renderer.applyTheme(resolveWindowTheme());
    renderer.resize(100, 50);
    expect(background.commands.some((cmd) => cmd === "fillRect:0,0,100,50")).toBe(true);
    renderer.destroy();
    expect(background.commands).toContain("destroy");
    expect(frame.commands).toContain("destroy");
  });

  test("resolveWindowRenderer(undefined) returns default renderer", () => {
    const root = new RecordingContainer();
    const host = createStubHost(root);
    const renderer = resolveWindowRenderer(undefined, { host, root });
    expect(renderer).toBeInstanceOf(GraphicsWindowRenderer);
  });

  test("resolveWindowRenderer(custom) returns custom renderer", () => {
    const root = new RecordingContainer();
    const host = createStubHost(root);
    const custom: WindowRendererFactory = () =>
      new GraphicsWindowRenderer({
        createBackground: () => new FakeGraphics(),
        createFrame: () => new FakeGraphics(),
      });
    const renderer = resolveWindowRenderer(custom, { host, root });
    expect(renderer).toBeInstanceOf(GraphicsWindowRenderer);
  });

  test("PixiGraphicsFactory source uses new Graphics and addChild", () => {
    const source = readFileSync(
      join(import.meta.dir, "../../src/pixi/PixiGraphicsFactory.ts"),
      "utf8",
    );
    expect(source.includes("new Graphics()")).toBe(true);
    expect(source.includes("addChild")).toBe(true);
    expect(source.includes("beginFill")).toBe(false);
    expect(source.includes(".rect(")).toBe(true);
    expect(source.includes(".fill(")).toBe(true);
    expect(source.includes(".stroke(")).toBe(true);
  });
});
