import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Cache, Container, NineSliceSprite, Texture } from "pixi.js";
import { WindowConfigError } from "../../src/core/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import {
  createNineSliceWindowRenderer,
  NineSliceWindowRenderer,
} from "../../src/pixi/NineSliceWindowRenderer.ts";
import { WindowBase } from "../../src/pixi/WindowBase.ts";
import { MissingWindowSkinError, type NineSliceSkinOptions } from "../../src/skin/types.ts";

const ROOT = join(import.meta.dir, "../..");
const NINESLICE_SOURCE = readFileSync(join(ROOT, "src/pixi/NineSliceWindowRenderer.ts"), "utf8");
const WINDOW_BASE_SOURCE = readFileSync(join(ROOT, "src/pixi/WindowBase.ts"), "utf8");

const SKIN_KEY = "window-skin";
const defaultOptions: NineSliceSkinOptions = {
  textureKey: SKIN_KEY,
  leftWidth: 8,
  rightWidth: 8,
  topHeight: 8,
  bottomHeight: 8,
};

function createStubHost(): PixiWindowHost {
  const stage = new Container();
  let destroyed = false;
  return {
    stage,
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => destroyed,
    onDestroy: (handler: () => void) => {
      if (destroyed) {
        handler();
        return () => {};
      }
      return () => {};
    },
    destroy: () => {
      destroyed = true;
    },
  };
}

describe("NineSliceWindowRenderer", () => {
  test("throws MissingWindowSkinError when texture key is not loaded", () => {
    const host = createStubHost();
    const root = new Container();
    host.stage.addChild(root);

    expect(() => createNineSliceWindowRenderer({ host, root }, defaultOptions)).toThrow(
      MissingWindowSkinError,
    );
  });

  test("creates NineSliceSprite on WindowBase root when texture is loaded", () => {
    Cache.set(SKIN_KEY, new Texture());
    const host = createStubHost();

    const window = new WindowBase(
      host,
      { x: 0, y: 0, width: 200, height: 80 },
      {
        createRenderer: (context) => createNineSliceWindowRenderer(context, defaultOptions),
      },
    );

    const chrome = window.getRoot().children.find(
      (child): child is NineSliceSprite => child instanceof NineSliceSprite,
    );
    expect(chrome).toBeDefined();
    expect(chrome?.width).toBeGreaterThanOrEqual(defaultOptions.leftWidth + defaultOptions.rightWidth);
    expect(chrome?.height).toBeGreaterThanOrEqual(defaultOptions.topHeight + defaultOptions.bottomHeight);

    window.destroy();
    Cache.remove(SKIN_KEY);
  });

  test("WindowBase source does not import skin or NineSlice but supports createRenderer", () => {
    expect(WINDOW_BASE_SOURCE.includes('from "../skin')).toBe(false);
    expect(WINDOW_BASE_SOURCE.includes("NineSlice")).toBe(false);
    expect(WINDOW_BASE_SOURCE.includes("createRenderer")).toBe(true);
  });

  test("source uses Cache.has and NineSliceSprite with nearest filtering", () => {
    expect(NINESLICE_SOURCE.includes('from "phaser"')).toBe(false);
    expect(NINESLICE_SOURCE.includes("beginFill")).toBe(false);
    expect(NINESLICE_SOURCE.includes("scene.add.nineslice")).toBe(false);
    expect(NINESLICE_SOURCE.includes("GraphicsWindowRenderer")).toBe(false);
    expect(NINESLICE_SOURCE.includes("Cache.has")).toBe(true);
    expect(NINESLICE_SOURCE.includes("NineSliceSprite")).toBe(true);
    expect(NINESLICE_SOURCE.includes("nearest")).toBe(true);
  });

  test("tileX or tileY true throws WindowConfigError", () => {
    Cache.set(SKIN_KEY, new Texture());
    const host = createStubHost();
    const root = new Container();
    host.stage.addChild(root);
    const context = { host, root };

    expect(() =>
      createNineSliceWindowRenderer(context, { ...defaultOptions, tileX: true }),
    ).toThrow(WindowConfigError);
    expect(() =>
      createNineSliceWindowRenderer(context, { ...defaultOptions, tileY: true }),
    ).toThrow(WindowConfigError);

    Cache.remove(SKIN_KEY);
  });

  test("exports createNineSliceWindowRenderer factory", () => {
    expect(typeof createNineSliceWindowRenderer).toBe("function");
    expect(NineSliceWindowRenderer.name).toBe("NineSliceWindowRenderer");
  });
});
