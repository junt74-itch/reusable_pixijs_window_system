import type { Container, Renderer, Ticker } from "pixi.js";

/** Application-owned rendering boundary for window controllers. */
export interface PixiWindowHost {
  readonly stage: Container;
  readonly renderer: Renderer;
  readonly canvas: HTMLCanvasElement;
  readonly ticker: Ticker;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly resolution: number;
  isDestroyed(): boolean;
  onDestroy(handler: () => void): () => void;
  destroy(): void;
}

/** Optional logical pixel size overrides for {@link createPixiWindowHost}. */
export interface PixiWindowHostOptions {
  readonly logicalWidth?: number;
  readonly logicalHeight?: number;
}
