import { Graphics, type Container } from "pixi.js";
import type { ResolvedWindowTheme, WindowBounds } from "../core/types.ts";
import { cursorBlinkVisible } from "../selection/cursorBlink.ts";

export { cursorBlinkVisible } from "../selection/cursorBlink.ts";

/**
 * Draws a themed selection cursor around the active row bounds.
 */
export class CursorRenderer {
  private readonly graphics: Graphics;
  private destroyed = false;
  private shown = false;
  private elapsedMs = 0;
  private blinkPeriodMs = 0;
  private lastBounds: WindowBounds | null = null;
  private lastTheme: ResolvedWindowTheme | null = null;

  public constructor(parent: Container) {
    this.graphics = new Graphics();
    parent.addChild(this.graphics);
  }

  public draw(bounds: WindowBounds, theme: ResolvedWindowTheme): void {
    if (this.destroyed) {
      return;
    }
    this.shown = true;
    this.lastBounds = bounds;
    this.lastTheme = theme;
    this.blinkPeriodMs = theme.cursor.blinkPeriodMs;
    this.redraw();
  }

  public hide(): void {
    this.shown = false;
    this.lastBounds = null;
    this.graphics.clear();
    this.graphics.visible = false;
  }

  public update(deltaMs: number): void {
    if (this.destroyed || !this.shown) {
      return;
    }
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      return;
    }
    this.elapsedMs += deltaMs;
    this.applyBlinkVisibility();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.graphics.destroy();
  }

  private redraw(): void {
    const bounds = this.lastBounds;
    const theme = this.lastTheme;
    if (bounds === null || theme === null) {
      return;
    }
    const cursor = theme.cursor;
    this.graphics.clear();
    this.graphics
      .rect(
        bounds.x - cursor.padding,
        bounds.y - cursor.padding,
        bounds.width + cursor.padding * 2,
        bounds.height + cursor.padding * 2,
      )
      .fill({ color: cursor.color, alpha: cursor.alpha });
    this.applyBlinkVisibility();
  }

  private applyBlinkVisibility(): void {
    this.graphics.visible = this.shown && cursorBlinkVisible(this.elapsedMs, this.blinkPeriodMs);
  }
}
