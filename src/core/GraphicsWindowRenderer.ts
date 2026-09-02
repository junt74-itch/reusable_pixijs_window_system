import type { ResolvedWindowTheme } from "./types.ts";
import type { GraphicsFactory, GraphicsLike, WindowRenderer } from "./WindowRenderer.ts";

/**
 * Graphics-based window chrome renderer drawing from local (0,0) to (width,height).
 * Vertical open/close presentation is applied by {@link WindowBase} on the root container.
 */
export class GraphicsWindowRenderer implements WindowRenderer {
  public readonly background: GraphicsLike;
  public readonly frame: GraphicsLike;
  private width = 0;
  private height = 0;
  private theme: ResolvedWindowTheme | null = null;
  private openness = 1;
  private destroyed = false;

  public constructor(factory: GraphicsFactory) {
    this.background = factory.createBackground();
    this.frame = factory.createFrame();
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.redraw();
  }

  public applyTheme(theme: ResolvedWindowTheme): void {
    this.theme = theme;
    this.redraw();
  }

  public setOpenness(openness: number): void {
    this.openness = Math.max(0, Math.min(1, openness));
  }

  public getOpenness(): number {
    return this.openness;
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.background.destroy();
    this.frame.destroy();
  }

  private redraw(): void {
    if (this.theme === null || this.width <= 0 || this.height <= 0) {
      return;
    }
    const theme = this.theme;
    this.background.clear();
    this.background.fillStyle(theme.backgroundColor, theme.backgroundAlpha);
    this.background.fillRect(0, 0, this.width, this.height);

    this.frame.clear();
    if (theme.borderWidth > 0) {
      this.frame.lineStyle(theme.borderWidth, theme.borderColor, theme.borderAlpha);
      this.frame.strokeRect(
        theme.borderWidth / 2,
        theme.borderWidth / 2,
        this.width - theme.borderWidth,
        this.height - theme.borderWidth,
      );
    }
  }
}
