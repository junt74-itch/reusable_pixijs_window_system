import type { Container } from "pixi.js";
import { GraphicsWindowRenderer } from "../core/GraphicsWindowRenderer.ts";
import type { WindowRenderer } from "../core/WindowRenderer.ts";
import type { PixiWindowHost } from "../host/types.ts";
import { createPixiGraphicsFactory } from "./PixiGraphicsFactory.ts";

export interface WindowRendererFactoryContext {
  readonly host: PixiWindowHost;
  readonly root: Container;
}

export type WindowRendererFactory = (context: WindowRendererFactoryContext) => WindowRenderer;

/** Default chrome: Graphics background and frame parented to the window root. */
export function createDefaultGraphicsWindowRenderer(
  context: WindowRendererFactoryContext,
): WindowRenderer {
  void context.host;
  return new GraphicsWindowRenderer(createPixiGraphicsFactory(context.root));
}

/** Resolves an injected factory or falls back to {@link createDefaultGraphicsWindowRenderer}. */
export function resolveWindowRenderer(
  factory: WindowRendererFactory | undefined,
  context: WindowRendererFactoryContext,
): WindowRenderer {
  return (factory ?? createDefaultGraphicsWindowRenderer)(context);
}
