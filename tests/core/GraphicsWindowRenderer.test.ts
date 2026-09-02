import { describe, expect, test } from "bun:test";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import { resolveWindowTheme } from "../../src/core/theme.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

class FakeGraphics implements GraphicsLike {
  public commands: string[] = [];
  public visible = true;
  public alpha = 1;

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

  public setVisible(visible: boolean): void {
    this.visible = visible;
  }

  public setAlpha(alpha: number): void {
    this.alpha = alpha;
  }

  public destroy(): void {
    this.commands.push("destroy");
  }
}

describe("GraphicsWindowRenderer", () => {
  test("resize clears and redraws in stable order", () => {
    const background = new FakeGraphics();
    const frame = new FakeGraphics();
    const factory: GraphicsFactory = {
      createBackground: () => background,
      createFrame: () => frame,
    };
    const renderer = new GraphicsWindowRenderer(factory);
    renderer.applyTheme(resolveWindowTheme());
    renderer.resize(120, 80);
    expect(background.commands.some((cmd) => cmd === "fillRect:0,0,120,80")).toBe(true);
    renderer.resize(140, 90);
    expect(background.commands.filter((cmd) => cmd === "clear").length).toBeGreaterThan(1);
    renderer.destroy();
    renderer.destroy();
    expect(background.commands).toContain("destroy");
  });

  test("stores openness for presentation owner", () => {
    const background = new FakeGraphics();
    const frame = new FakeGraphics();
    const renderer = new GraphicsWindowRenderer({
      createBackground: () => background,
      createFrame: () => frame,
    });
    renderer.setOpenness(0.25);
    expect(renderer.getOpenness()).toBe(0.25);
  });
});
