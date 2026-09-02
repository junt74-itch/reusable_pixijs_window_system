import type { ResolvedWindowTheme } from "./types.ts";

/** Minimal Graphics-like surface for headless renderer tests. */
export interface GraphicsLike {
  clear(): void;
  fillStyle(color: number, alpha?: number): this;
  lineStyle(lineWidth: number, color: number, alpha?: number): this;
  fillRect(x: number, y: number, width: number, height: number): this;
  strokeRect(x: number, y: number, width: number, height: number): this;
  setVisible(visible: boolean): void;
  setAlpha(alpha: number): void;
  destroy(): void;
}

/** Factory that creates graphics objects parented to a container-like target. */
export interface GraphicsFactory {
  createBackground(): GraphicsLike;
  createFrame(): GraphicsLike;
}

/** Replaceable window chrome renderer. */
export interface WindowRenderer {
  readonly background: GraphicsLike;
  readonly frame: GraphicsLike;
  resize(width: number, height: number): void;
  applyTheme(theme: ResolvedWindowTheme): void;
  setOpenness(openness: number): void;
  destroy(): void;
}
