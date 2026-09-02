import { Graphics, type Container } from "pixi.js";
import type { ResolvedWindowTheme } from "../core/types.ts";

/**
 * Fixed up/down overflow arrows drawn on the clipped content container.
 */
export class ScrollOverflowIndicators {
  private readonly up: Graphics;
  private readonly down: Graphics;
  private destroyed = false;

  public constructor(parent: Container) {
    this.up = new Graphics();
    this.down = new Graphics();
    parent.addChild(this.up);
    parent.addChild(this.down);
    this.up.visible = false;
    this.down.visible = false;
  }

  public update(
    contentWidth: number,
    contentHeight: number,
    canScrollUp: boolean,
    canScrollDown: boolean,
    theme: ResolvedWindowTheme,
  ): void {
    if (this.destroyed) {
      return;
    }
    this.drawArrow(this.up, contentWidth, 2, true, canScrollUp, theme);
    this.drawArrow(this.down, contentWidth, contentHeight - 10, false, canScrollDown, theme);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.up.destroy();
    this.down.destroy();
  }

  private drawArrow(
    graphics: Graphics,
    contentWidth: number,
    y: number,
    pointsUp: boolean,
    visible: boolean,
    theme: ResolvedWindowTheme,
  ): void {
    graphics.clear();
    graphics.visible = visible;
    if (!visible) {
      return;
    }
    const centerX = Math.trunc(contentWidth / 2);
    const tipY = y + (pointsUp ? 0 : 8);
    const baseY = y + (pointsUp ? 8 : 0);
    const points = pointsUp
      ? [centerX, tipY, centerX - 6, baseY, centerX + 6, baseY]
      : [centerX, tipY, centerX - 6, baseY, centerX + 6, baseY];
    graphics.poly(points).fill({ color: theme.text.tint, alpha: 0.85 });
  }
}
