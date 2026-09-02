import { Cache, NineSliceSprite, Texture } from "pixi.js";
import type { ResolvedWindowTheme } from "../core/types.ts";
import { WindowConfigError } from "../core/types.ts";
import type {
  GraphicsLike,
  WindowRenderer,
} from "../core/WindowRenderer.ts";
import type { WindowRendererFactoryContext } from "./windowRendererFactory.ts";
import { MissingWindowSkinError, type NineSliceSkinOptions } from "../skin/types.ts";

class UnusedChromeGraphics implements GraphicsLike {
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

function resolveSkinTexture(textureKey: string, frame?: string | number): Texture {
  if (!Cache.has(textureKey)) {
    throw new MissingWindowSkinError(textureKey);
  }
  const cached = Cache.get<unknown>(textureKey);
  if (cached instanceof Texture) {
    cached.source.scaleMode = "nearest";
    return cached;
  }
  if (cached !== null && typeof cached === "object" && "textures" in cached) {
    const textures = (cached as { textures: Record<string, Texture> }).textures;
    const frameKey = frame !== undefined ? String(frame) : "0";
    const texture = textures[frameKey];
    if (texture === undefined) {
      throw new MissingWindowSkinError(textureKey);
    }
    texture.source.scaleMode = "nearest";
    return texture;
  }
  throw new MissingWindowSkinError(textureKey);
}

function assertNineSliceSkinSupported(options: NineSliceSkinOptions): void {
  if (options.tileX === true) {
    throw new WindowConfigError("NineSliceSkinOptions.tileX is not supported.");
  }
  if (options.tileY === true) {
    throw new WindowConfigError("NineSliceSkinOptions.tileY is not supported.");
  }
}

/**
 * WindowRenderer that draws consumer-owned NineSlice chrome.
 * Missing textures throw; there is no Graphics fallback.
 * Isolation: constructed only via WindowBaseOptions.createRenderer. WindowBase must not import this module.
 */
export class NineSliceWindowRenderer implements WindowRenderer {
  public readonly background: GraphicsLike = new UnusedChromeGraphics();
  public readonly frame: GraphicsLike = new UnusedChromeGraphics();
  private readonly chrome: NineSliceSprite;
  private readonly options: NineSliceSkinOptions;
  private width = 0;
  private height = 0;
  private openness = 1;
  private destroyed = false;

  public constructor(context: WindowRendererFactoryContext, options: NineSliceSkinOptions) {
    assertNineSliceSkinSupported(options);
    if (!Cache.has(options.textureKey)) {
      throw new MissingWindowSkinError(options.textureKey);
    }
    this.options = options;
    const texture = resolveSkinTexture(options.textureKey, options.frame);
    this.chrome = new NineSliceSprite({
      texture,
      leftWidth: options.leftWidth,
      rightWidth: options.rightWidth,
      topHeight: options.topHeight,
      bottomHeight: options.bottomHeight,
      width: Math.max(options.leftWidth + options.rightWidth, 1),
      height: Math.max(options.topHeight + options.bottomHeight, 1),
      anchor: 0,
    });
    this.chrome.position.set(0, 0);
    context.root.addChild(this.chrome);
    void context.host;
  }

  public resize(width: number, height: number): void {
    this.width = Math.trunc(width);
    this.height = Math.trunc(height);
    this.applySize();
  }

  public applyTheme(_theme: ResolvedWindowTheme): void {
    // Skin pixels are consumer-owned; theme colors do not recolor the atlas.
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
    this.chrome.destroy();
  }

  private applySize(): void {
    if (this.destroyed || this.width <= 0 || this.height <= 0) {
      return;
    }
    const minWidth = this.options.leftWidth + this.options.rightWidth;
    const minHeight = this.options.topHeight + this.options.bottomHeight;
    this.chrome.width = Math.max(this.width, minWidth);
    this.chrome.height = Math.max(this.height, minHeight);
  }
}

export function createNineSliceWindowRenderer(
  context: WindowRendererFactoryContext,
  options: NineSliceSkinOptions,
): WindowRenderer {
  return new NineSliceWindowRenderer(context, options);
}
