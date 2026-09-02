import type { WindowBounds, WindowPadding } from "../core/types.ts";
import { WindowLayoutError } from "../core/types.ts";
import { computeContentBounds } from "../core/theme.ts";

export type ViewportAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ViewportLayoutRequest {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly width: number;
  readonly height: number;
  readonly margin?: number | WindowPadding;
  readonly padding?: number | WindowPadding;
  readonly anchor?: ViewportAnchor;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function toPadding(padding: number | WindowPadding | undefined): WindowPadding {
  if (padding === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (typeof padding === "number") {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return padding;
}

/**
 * Maps a viewport rectangle to integer window bounds. Scenes call this;
 * windows do not subscribe to the camera.
 */
export function layoutWindowInViewport(request: ViewportLayoutRequest): WindowBounds {
  const viewportWidth = request.viewportWidth;
  const viewportHeight = request.viewportHeight;
  if (!isFiniteNumber(viewportWidth) || !isFiniteNumber(viewportHeight)) {
    throw new WindowLayoutError("Viewport size must be finite.");
  }
  if (!isFiniteNumber(request.width) || !isFiniteNumber(request.height)) {
    throw new WindowLayoutError("Requested window size must be finite.");
  }
  if (request.width <= 0 || request.height <= 0) {
    throw new WindowLayoutError("Requested window size must be positive.");
  }

  const margin = toPadding(request.margin);
  const innerWidth = viewportWidth - margin.left - margin.right;
  const innerHeight = viewportHeight - margin.top - margin.bottom;
  if (innerWidth < 1 || innerHeight < 1) {
    throw new WindowLayoutError(
      `Viewport inner area must be positive; got ${Math.trunc(innerWidth)}x${Math.trunc(innerHeight)}.`,
    );
  }

  const width = Math.trunc(Math.min(request.width, innerWidth));
  const height = Math.trunc(Math.min(request.height, innerHeight));
  if (width < 1 || height < 1) {
    throw new WindowLayoutError(`Window bounds must be positive; got ${width}x${height}.`);
  }

  const anchor = request.anchor ?? "top-left";
  const innerX = margin.left;
  const innerY = margin.top;
  const spareX = innerWidth - width;
  const spareY = innerHeight - height;
  const alignX = anchor.endsWith("left") ? 0 : anchor.endsWith("right") ? 1 : 0.5;
  const alignY = anchor.startsWith("top") ? 0 : anchor.startsWith("bottom") ? 1 : 0.5;
  const x = Math.trunc(innerX + spareX * alignX);
  const y = Math.trunc(innerY + spareY * alignY);

  if (request.padding !== undefined) {
    computeContentBounds(width, height, toPadding(request.padding));
  }

  return { x, y, width, height };
}
