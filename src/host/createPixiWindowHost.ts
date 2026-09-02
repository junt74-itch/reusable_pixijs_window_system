import type { Application, Container, Renderer, Ticker } from "pixi.js";
import { WindowConfigError, WindowLayoutError } from "../core/types.ts";
import type { PixiWindowHost, PixiWindowHostOptions } from "./types.ts";

class PixiWindowHostImpl implements PixiWindowHost {
  public readonly stage: Container;
  public readonly renderer: Renderer;
  public readonly canvas: HTMLCanvasElement;
  public readonly ticker: Ticker;
  public readonly logicalWidth: number;
  public readonly logicalHeight: number;
  public readonly resolution: number;

  private destroyed = false;
  private readonly destroyHandlers = new Set<() => void>();

  public constructor(
    stage: Container,
    renderer: Renderer,
    canvas: HTMLCanvasElement,
    ticker: Ticker,
    logicalWidth: number,
    logicalHeight: number,
    resolution: number,
  ) {
    this.stage = stage;
    this.renderer = renderer;
    this.canvas = canvas;
    this.ticker = ticker;
    this.logicalWidth = logicalWidth;
    this.logicalHeight = logicalHeight;
    this.resolution = resolution;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public onDestroy(handler: () => void): () => void {
    if (this.destroyed) {
      handler();
      return () => {};
    }

    this.destroyHandlers.add(handler);
    return () => {
      this.destroyHandlers.delete(handler);
    };
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    const handlers = [...this.destroyHandlers];
    this.destroyHandlers.clear();
    for (const handler of handlers) {
      handler();
    }
  }
}

function requireApplicationField<T>(
  value: T | null | undefined,
  label: string,
): T {
  if (value == null) {
    throw new WindowConfigError(`Application ${label} is missing.`);
  }
  return value;
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new WindowConfigError(`${label} must be a finite number.`);
  }
  if (!Number.isInteger(value)) {
    throw new WindowConfigError(`${label} must be an integer.`);
  }
  if (value <= 0) {
    throw new WindowLayoutError(`${label} must be positive; got ${value}.`);
  }
  return value;
}

function resolveDefaultLogicalWidth(app: Application): number {
  const screen = app.screen;
  if (screen != null && Number.isFinite(screen.width)) {
    return Math.trunc(screen.width);
  }

  const renderer = app.renderer;
  if (renderer != null && Number.isFinite(renderer.width)) {
    return Math.trunc(renderer.width);
  }

  throw new WindowConfigError("Application logical width is unavailable.");
}

function resolveDefaultLogicalHeight(app: Application): number {
  const screen = app.screen;
  if (screen != null && Number.isFinite(screen.height)) {
    return Math.trunc(screen.height);
  }

  const renderer = app.renderer;
  if (renderer != null && Number.isFinite(renderer.height)) {
    return Math.trunc(renderer.height);
  }

  throw new WindowConfigError("Application logical height is unavailable.");
}

function resolveLogicalSize(
  app: Application,
  options?: PixiWindowHostOptions,
): { readonly logicalWidth: number; readonly logicalHeight: number } {
  const logicalWidth =
    options?.logicalWidth === undefined
      ? resolveDefaultLogicalWidth(app)
      : assertPositiveInteger(options.logicalWidth, "logicalWidth");
  const logicalHeight =
    options?.logicalHeight === undefined
      ? resolveDefaultLogicalHeight(app)
      : assertPositiveInteger(options.logicalHeight, "logicalHeight");

  if (logicalWidth <= 0) {
    throw new WindowLayoutError(`logicalWidth must be positive; got ${logicalWidth}.`);
  }
  if (logicalHeight <= 0) {
    throw new WindowLayoutError(`logicalHeight must be positive; got ${logicalHeight}.`);
  }

  return { logicalWidth, logicalHeight };
}

/**
 * Creates a host boundary around an initialized PixiJS {@link Application}.
 * Does not destroy the application; ownership stays with the caller.
 */
export function createPixiWindowHost(
  app: Application,
  options?: PixiWindowHostOptions,
): PixiWindowHost {
  const stage = requireApplicationField(app.stage, "stage");
  const renderer = requireApplicationField(app.renderer, "renderer");
  const canvas = requireApplicationField(app.canvas, "canvas");
  const ticker = requireApplicationField(app.ticker, "ticker");
  const { logicalWidth, logicalHeight } = resolveLogicalSize(app, options);
  const resolution = renderer.resolution;

  if (!Number.isFinite(resolution) || resolution <= 0) {
    throw new WindowConfigError("Application renderer resolution must be positive.");
  }

  return new PixiWindowHostImpl(
    stage,
    renderer,
    canvas,
    ticker,
    logicalWidth,
    logicalHeight,
    resolution,
  );
}
