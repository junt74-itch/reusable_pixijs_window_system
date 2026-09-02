import { describe, expect, test } from "bun:test";
import type { Application, Container, Renderer, Ticker } from "pixi.js";
import { createPixiWindowHost } from "../../src/host/createPixiWindowHost.ts";
import { WindowConfigError, WindowLayoutError } from "../../src/core/types.ts";

interface StubApplicationOptions {
  readonly stage?: Container | null;
  readonly renderer?: Partial<Renderer> | null;
  readonly canvas?: HTMLCanvasElement | null;
  readonly ticker?: Ticker | null;
  readonly screen?: { readonly width: number; readonly height: number } | null;
  readonly destroy?: () => void;
}

function createStubApplication(options: StubApplicationOptions = {}): Application {
  const destroy = options.destroy ?? (() => {});
  const canvas =
    options.canvas === undefined ? ({} as HTMLCanvasElement) : options.canvas;
  const renderer =
    options.renderer === undefined
      ? ({
          width: 800,
          height: 600,
          resolution: 2,
          canvas,
        } as Renderer)
      : options.renderer;
  const screen =
    options.screen === undefined ? { width: 960.7, height: 540.2 } : options.screen;
  const stage = options.stage === undefined ? ({} as Container) : options.stage;
  const ticker = options.ticker === undefined ? ({} as Ticker) : options.ticker;

  return {
    stage,
    renderer,
    canvas: canvas ?? undefined,
    ticker,
    screen,
    destroy,
  } as Application;
}

describe("createPixiWindowHost", () => {
  test("creates a host from a stub Application", () => {
    const app = createStubApplication();
    const host = createPixiWindowHost(app);

    expect(host.stage).toBe(app.stage);
    expect(host.renderer).toBe(app.renderer);
    expect(host.canvas).toBe(app.canvas);
    expect(host.ticker).toBe(app.ticker);
    expect(host.logicalWidth).toBe(960);
    expect(host.logicalHeight).toBe(540);
    expect(host.resolution).toBe(2);
    expect(host.isDestroyed()).toBe(false);
  });

  test("truncates screen dimensions when logical size is omitted", () => {
    const app = createStubApplication({
      screen: { width: 1279.9, height: 719.1 },
    });
    const host = createPixiWindowHost(app);

    expect(host.logicalWidth).toBe(1279);
    expect(host.logicalHeight).toBe(719);
  });

  test("prefers explicit logical size options", () => {
    const app = createStubApplication();
    const host = createPixiWindowHost(app, { logicalWidth: 640, logicalHeight: 360 });

    expect(host.logicalWidth).toBe(640);
    expect(host.logicalHeight).toBe(360);
  });

  test("falls back to renderer dimensions when screen is unavailable", () => {
    const app = createStubApplication({
      screen: null,
      renderer: {
        width: 1024.8,
        height: 768.3,
        resolution: 1,
        canvas: {} as HTMLCanvasElement,
      } as Renderer,
    });
    const host = createPixiWindowHost(app);

    expect(host.logicalWidth).toBe(1024);
    expect(host.logicalHeight).toBe(768);
  });

  test("throws WindowLayoutError for non-positive explicit logical size", () => {
    const app = createStubApplication();

    expect(() => createPixiWindowHost(app, { logicalWidth: 0, logicalHeight: 540 })).toThrow(
      WindowLayoutError,
    );
    expect(() => createPixiWindowHost(app, { logicalWidth: 960, logicalHeight: -1 })).toThrow(
      WindowLayoutError,
    );
  });

  test("throws WindowConfigError when required Application fields are missing", () => {
    expect(() => createPixiWindowHost(createStubApplication({ stage: null }))).toThrow(
      WindowConfigError,
    );
    expect(() => createPixiWindowHost(createStubApplication({ renderer: null }))).toThrow(
      WindowConfigError,
    );
    expect(() => createPixiWindowHost(createStubApplication({ canvas: null }))).toThrow(
      WindowConfigError,
    );
    expect(() => createPixiWindowHost(createStubApplication({ ticker: null }))).toThrow(
      WindowConfigError,
    );
  });

  test("destroy invokes subscribed handlers once and does not destroy the Application", () => {
    const app = createStubApplication();
    let appDestroyCalls = 0;
    app.destroy = () => {
      appDestroyCalls += 1;
    };

    const host = createPixiWindowHost(app);
    let handlerCalls = 0;
    host.onDestroy(() => {
      handlerCalls += 1;
    });

    host.destroy();
    host.destroy();

    expect(handlerCalls).toBe(1);
    expect(appDestroyCalls).toBe(0);
    expect(host.isDestroyed()).toBe(true);
  });

  test("unsubscribed handlers are not invoked on destroy", () => {
    const host = createPixiWindowHost(createStubApplication());
    let handlerCalls = 0;
    const unsubscribe = host.onDestroy(() => {
      handlerCalls += 1;
    });

    unsubscribe();
    host.destroy();

    expect(handlerCalls).toBe(0);
  });

  test("onDestroy after destroy invokes the handler immediately", () => {
    const host = createPixiWindowHost(createStubApplication());
    host.destroy();

    let lateHandlerCalls = 0;
    const unsubscribe = host.onDestroy(() => {
      lateHandlerCalls += 1;
    });

    expect(lateHandlerCalls).toBe(1);
    unsubscribe();
    expect(lateHandlerCalls).toBe(1);
  });
});
