import { Graphics, type Container } from "pixi.js";
import type { GraphicsFactory, GraphicsLike } from "../core/WindowRenderer.ts";

class PixiGraphicsLike implements GraphicsLike {
  private fillColor = 0xffffff;
  private fillAlpha = 1;
  private strokeWidth = 0;
  private strokeColor = 0;
  private strokeAlpha = 1;

  public constructor(private readonly graphics: Graphics) {}

  public clear(): void {
    this.graphics.clear();
  }

  public fillStyle(color: number, alpha?: number): this {
    this.fillColor = color;
    this.fillAlpha = alpha ?? 1;
    return this;
  }

  public lineStyle(lineWidth: number, color: number, alpha?: number): this {
    this.strokeWidth = lineWidth;
    this.strokeColor = color;
    this.strokeAlpha = alpha ?? 1;
    return this;
  }

  public fillRect(x: number, y: number, width: number, height: number): this {
    this.graphics.rect(x, y, width, height).fill({ color: this.fillColor, alpha: this.fillAlpha });
    return this;
  }

  public strokeRect(x: number, y: number, width: number, height: number): this {
    this.graphics
      .rect(x, y, width, height)
      .stroke({ width: this.strokeWidth, color: this.strokeColor, alpha: this.strokeAlpha });
    return this;
  }

  public setVisible(visible: boolean): void {
    this.graphics.visible = visible;
  }

  public setAlpha(alpha: number): void {
    this.graphics.alpha = alpha;
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}

/** Creates renderer graphics parented to a window root container. */
export function createPixiGraphicsFactory(root: Container): GraphicsFactory {
  return {
    createBackground(): GraphicsLike {
      const graphics = new Graphics();
      root.addChild(graphics);
      return new PixiGraphicsLike(graphics);
    },
    createFrame(): GraphicsLike {
      const graphics = new Graphics();
      root.addChild(graphics);
      return new PixiGraphicsLike(graphics);
    },
  };
}
