import { BitmapText, Container } from "pixi.js";
import { ContentClipper } from "./ContentClipper.ts";
import type { PixiWindowHost } from "../host/types.ts";
import type { ScrollAxis } from "../scroll/types.ts";

/**
 * Viewport that clips a moving scroll body to the content rectangle.
 * Uses {@link ContentClipper} (external world mask) plus a visibility cull so
 * children that leave the viewport cannot paint outside the window chrome.
 */
export class ScrollContentClip {
  private readonly viewport: Container;
  private readonly clipper: ContentClipper;
  private width = 0;
  private height = 0;
  private destroyed = false;

  public constructor(host: PixiWindowHost, parent: Container) {
    this.viewport = new Container();
    parent.addChild(this.viewport);
    this.clipper = new ContentClipper(host);
    this.clipper.attach(this.viewport);
  }

  public getViewport(): Container {
    return this.viewport;
  }

  public updateBounds(width: number, height: number): void {
    if (this.destroyed) {
      return;
    }
    this.width = width;
    this.height = height;
    this.clipper.updateBounds({ x: 0, y: 0, width, height });
    this.clipper.enable();
  }

  public cullChildren(body: Container, scrollOffset: number, axis: ScrollAxis): void {
    if (this.destroyed) {
      return;
    }
    const viewportStart = scrollOffset;
    const viewportEnd = scrollOffset + (axis === "x" ? this.width : this.height);
    for (const child of body.children) {
      if (!(child instanceof BitmapText)) {
        continue;
      }
      this.applyCull(child, 0, viewportStart, viewportEnd, axis);
    }
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.clipper.destroy();
    this.viewport.destroy({ children: true });
  }

  private applyCull(
    child: BitmapText,
    parentOffset: number,
    viewportStart: number,
    viewportEnd: number,
    axis: ScrollAxis,
  ): void {
    const start = parentOffset + (axis === "x" ? child.x : child.y);
    const size = axis === "x" ? child.width : child.height;
    const end = start + size;
    child.visible = end > viewportStart && start < viewportEnd;
  }
}
