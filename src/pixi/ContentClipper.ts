import { Graphics, type Container } from "pixi.js";
import type { WindowBounds } from "../core/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

export class ContentClipperUnsupportedError extends Error {
  public override readonly name = "ContentClipperUnsupportedError";

  public constructor(message: string) {
    super(message);
  }
}

/**
 * Encapsulates Pixi mask clipping for a single content container.
 */
export class ContentClipper {
  private target: Container | null = null;
  private maskGraphics: Graphics | null = null;
  private enabled = false;
  private bounds: WindowBounds = { x: 0, y: 0, width: 0, height: 0 };
  private readonly host: PixiWindowHost;
  private destroyed = false;

  public constructor(host: PixiWindowHost) {
    this.host = host;
    void this.host;
  }

  public attach(target: Container): void {
    this.target = target;
    this.ensureMaskGraphics();
    if (this.maskGraphics !== null && this.maskGraphics.parent !== target) {
      target.addChild(this.maskGraphics);
    }
    if (this.enabled) {
      this.applyMask();
    }
  }

  public updateBounds(bounds: WindowBounds): void {
    this.bounds = { ...bounds };
    this.redrawMask();
  }

  public enable(): void {
    if (this.destroyed) {
      return;
    }
    this.enabled = true;
    this.applyMask();
  }

  public disable(): void {
    this.enabled = false;
    this.removeMask();
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.disable();
    if (this.maskGraphics !== null) {
      this.maskGraphics.parent?.removeChild(this.maskGraphics);
      this.maskGraphics.destroy();
    }
    this.maskGraphics = null;
    this.target = null;
  }

  private applyMask(): void {
    const target = this.target;
    if (target === null) {
      return;
    }
    if (target.destroyed) {
      throw new ContentClipperUnsupportedError("Cannot apply mask to destroyed container.");
    }
    this.ensureMaskGraphics();
    if (this.maskGraphics === null) {
      throw new ContentClipperUnsupportedError("Failed to create mask graphics.");
    }
    if (this.maskGraphics.parent !== target) {
      target.addChild(this.maskGraphics);
    }
    this.redrawMask();
    target.mask = this.maskGraphics;
  }

  private removeMask(): void {
    const target = this.target;
    if (target === null) {
      return;
    }
    if (target.mask === this.maskGraphics) {
      target.mask = null;
    }
  }

  private ensureMaskGraphics(): void {
    if (this.maskGraphics !== null) {
      return;
    }
    this.maskGraphics = new Graphics();
    // Pixi v8 stencil collect skips `visible === false` (`globalDisplayStatus < 7`),
    // which would clip all content. StencilMask already sets `includeInBuild = false`
    // so the rect is not drawn in the color pass.
    this.maskGraphics.eventMode = "none";
  }

  private redrawMask(): void {
    if (this.maskGraphics === null) {
      return;
    }
    const { width, height } = this.bounds;
    this.maskGraphics.clear();
    this.maskGraphics.rect(0, 0, width, height).fill({ color: 0xffffff, alpha: 1 });
  }
}
