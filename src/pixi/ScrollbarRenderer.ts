import { Graphics, type Container } from "pixi.js";
import type { WindowInputAdapter } from "../input/WindowInputAdapter.ts";
import type { ScrollController } from "../scroll/ScrollController.ts";
import {
  computeScrollbarTrackRect,
  isPointInScrollbarTrack,
  type ScrollbarTrackRect,
} from "../scroll/scrollChrome.ts";

export interface ScrollbarRendererOptions {
  readonly trackWidth?: number;
  readonly thumbMinHeight?: number;
  readonly trackColor?: number;
  readonly thumbColor?: number;
}

export interface ScrollbarPointerBinding {
  readonly canConsumeInput: () => boolean;
  readonly toContentLocal: (worldX: number, worldY: number) => { x: number; y: number };
}

/**
 * Integer-pixel scrollbar track and thumb for a scroll controller.
 */
export class ScrollbarRenderer {
  private readonly track: Graphics;
  private readonly thumb: Graphics;
  private readonly trackWidth: number;
  private readonly thumbMinHeight: number;
  private readonly trackColor: number;
  private readonly thumbColor: number;
  private readonly getContentWidth: () => number;
  private readonly getContentHeight: () => number;
  private dragging = false;
  private pointerCaptured = false;
  private dragStartOffset = 0;
  private dragStartLocalY = 0;
  private destroyed = false;
  private pointerSubscription: { unsubscribe: () => void } | null = null;

  public constructor(
    parent: Container,
    private readonly controller: ScrollController,
    metrics: {
      readonly getContentWidth: () => number;
      readonly getContentHeight: () => number;
    },
    options: ScrollbarRendererOptions = {},
  ) {
    this.getContentWidth = metrics.getContentWidth;
    this.getContentHeight = metrics.getContentHeight;
    this.trackWidth = options.trackWidth ?? 8;
    this.thumbMinHeight = options.thumbMinHeight ?? 16;
    this.trackColor = options.trackColor ?? 0x334455;
    this.thumbColor = options.thumbColor ?? 0x8899aa;
    this.track = new Graphics();
    this.thumb = new Graphics();
    parent.addChild(this.track);
    parent.addChild(this.thumb);
    this.track.visible = false;
    this.thumb.visible = false;
  }

  public isPointerCaptured(): boolean {
    return this.pointerCaptured || this.dragging;
  }

  public containsContentLocalPoint(localX: number, localY: number): boolean {
    return isPointInScrollbarTrack(localX, localY, this.getTrackRect());
  }

  public getTrackRect(): ScrollbarTrackRect | null {
    const layout = this.computeLayout();
    if (layout === null) {
      return null;
    }
    return {
      x: layout.trackX,
      y: 0,
      width: layout.trackWidth,
      height: layout.contentHeight,
    };
  }

  public bindPointer(adapter: WindowInputAdapter, binding: ScrollbarPointerBinding): void {
    this.pointerSubscription = adapter.subscribePointer((event) => {
      if (event.phase === "released") {
        this.dragging = false;
        this.pointerCaptured = false;
      }
      if (!binding.canConsumeInput()) {
        return;
      }
      const local = binding.toContentLocal(event.worldX, event.worldY);
      const layout = this.computeLayout();
      if (layout === null) {
        return;
      }
      const inTrack = this.containsContentLocalPoint(local.x, local.y);
      if (event.phase === "pressed" && event.isPrimaryDown && inTrack) {
        this.pointerCaptured = true;
        if (this.isPointOnThumb(local.x, local.y, layout)) {
          this.dragging = true;
          this.dragStartOffset = this.controller.getBounds().offset;
          this.dragStartLocalY = local.y;
        } else if (local.y < layout.thumbY) {
          this.controller.pageUp();
        } else {
          this.controller.pageDown();
        }
        return;
      }
      if (event.phase === "repeated" && this.dragging) {
        const deltaY = local.y - this.dragStartLocalY;
        const scrollable = Math.max(1, layout.contentHeight - layout.thumbHeight);
        const maxOffset = this.controller.getBounds().maxOffset;
        const nextOffset = this.dragStartOffset + Math.trunc((deltaY / scrollable) * maxOffset);
        this.controller.setOffset(nextOffset);
      }
    });
  }

  public update(): void {
    if (this.destroyed) {
      return;
    }
    const layout = this.computeLayout();
    this.track.clear();
    this.thumb.clear();
    if (layout === null) {
      this.track.visible = false;
      this.thumb.visible = false;
      return;
    }
    this.track.visible = true;
    this.thumb.visible = true;
    this.track
      .rect(layout.trackX, 0, layout.trackWidth, layout.contentHeight)
      .fill({ color: this.trackColor, alpha: 0.9 });
    this.thumb
      .rect(layout.trackX, layout.thumbY, layout.trackWidth, layout.thumbHeight)
      .fill({ color: this.thumbColor, alpha: 1 });
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.pointerSubscription?.unsubscribe();
    this.pointerSubscription = null;
    this.track.destroy();
    this.thumb.destroy();
  }

  private computeLayout(): {
    contentHeight: number;
    trackX: number;
    trackWidth: number;
    thumbY: number;
    thumbHeight: number;
  } | null {
    const bounds = this.controller.getBounds();
    if (bounds.maxOffset <= 0 || bounds.viewportSize <= 0) {
      return null;
    }
    const contentHeight = this.getContentHeight();
    const contentWidth = this.getContentWidth();
    const track = computeScrollbarTrackRect(contentWidth, contentHeight, this.trackWidth);
    const thumbHeight = Math.max(
      this.thumbMinHeight,
      Math.trunc((bounds.viewportSize / bounds.contentSize) * contentHeight),
    );
    const travel = Math.max(1, contentHeight - thumbHeight);
    const thumbY = Math.trunc((bounds.offset / bounds.maxOffset) * travel);
    return {
      contentHeight,
      trackX: track.x,
      trackWidth: track.width,
      thumbY,
      thumbHeight,
    };
  }

  private isPointOnThumb(
    localX: number,
    localY: number,
    layout: { trackX: number; trackWidth: number; thumbY: number; thumbHeight: number },
  ): boolean {
    return (
      localX >= layout.trackX &&
      localX <= layout.trackX + layout.trackWidth &&
      localY >= layout.thumbY &&
      localY <= layout.thumbY + layout.thumbHeight
    );
  }
}
