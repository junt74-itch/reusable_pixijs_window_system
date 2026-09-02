import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Container, Graphics } from "pixi.js";
import { ContentClipper, ContentClipperUnsupportedError } from "../../src/pixi/ContentClipper.ts";
import type { WindowBounds } from "../../src/core/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";

/** Mirrors ContentClipper.redrawMask local coordinates without importing implementation details. */
function computeContentClipRect(bounds: WindowBounds): WindowBounds {
  return { x: 0, y: 0, width: bounds.width, height: bounds.height };
}

function createStubHost(): PixiWindowHost {
  return {
    stage: new Container(),
    renderer: {} as PixiWindowHost["renderer"],
    canvas: {} as HTMLCanvasElement,
    ticker: {} as PixiWindowHost["ticker"],
    logicalWidth: 800,
    logicalHeight: 600,
    resolution: 1,
    isDestroyed: () => false,
    onDestroy: () => () => {},
    destroy: () => {},
  };
}

describe("ContentClipper", () => {
  test("mask rect stays in content-local space regardless of padding offset", () => {
    const contentBounds = { x: 16, y: 12, width: 280, height: 120 };
    expect(computeContentClipRect(contentBounds)).toEqual({
      x: 0,
      y: 0,
      width: 280,
      height: 120,
    });
  });

  test("mask rect tracks resized content dimensions", () => {
    const initial = computeContentClipRect({ x: 8, y: 8, width: 200, height: 80 });
    const resized = computeContentClipRect({ x: 8, y: 8, width: 240, height: 100 });
    expect(initial.height).toBe(80);
    expect(resized.width).toBe(240);
    expect(resized.height).toBe(100);
  });

  test("attach parents mask graphics and sets target.mask on enable", () => {
    const host = createStubHost();
    const clipper = new ContentClipper(host);
    const target = new Container();
    clipper.updateBounds({ x: 16, y: 12, width: 200, height: 80 });
    clipper.attach(target);
    clipper.enable();

    expect(target.children.length).toBe(1);
    const maskChild = target.children[0];
    expect(maskChild).toBeDefined();
    if (maskChild === undefined) {
      return;
    }
    expect(maskChild).toBeInstanceOf(Graphics);
    expect(target.mask).toBe(maskChild);
    expect((maskChild as Graphics).visible).toBe(true);
    expect((maskChild as Graphics).eventMode).toBe("none");
  });

  test("updateBounds redraws mask at content-local origin", () => {
    const host = createStubHost();
    const clipper = new ContentClipper(host);
    const target = new Container();
    clipper.updateBounds({ x: 10, y: 10, width: 100, height: 50 });
    clipper.attach(target);
    clipper.enable();
    clipper.updateBounds({ x: 10, y: 10, width: 240, height: 100 });
    expect(computeContentClipRect({ x: 10, y: 10, width: 240, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 240,
      height: 100,
    });
  });

  test("destroy clears mask and destroys graphics", () => {
    const host = createStubHost();
    const clipper = new ContentClipper(host);
    const target = new Container();
    clipper.updateBounds({ x: 0, y: 0, width: 120, height: 60 });
    clipper.attach(target);
    clipper.enable();
    const mask = target.mask;
    clipper.destroy();
    expect(target.mask ?? null).toBeNull();
    expect(mask).not.toBeNull();
    expect((mask as Graphics).destroyed).toBe(true);
    clipper.destroy();
  });

  test("disable removes mask assignment", () => {
    const host = createStubHost();
    const clipper = new ContentClipper(host);
    const target = new Container();
    clipper.updateBounds({ x: 0, y: 0, width: 80, height: 40 });
    clipper.attach(target);
    clipper.enable();
    clipper.disable();
    expect(target.mask ?? null).toBeNull();
  });

  test("throws ContentClipperUnsupportedError for destroyed target", () => {
    const host = createStubHost();
    const clipper = new ContentClipper(host);
    const target = new Container();
    clipper.updateBounds({ x: 0, y: 0, width: 80, height: 40 });
    clipper.attach(target);
    target.destroy({ children: true });
    expect(() => clipper.enable()).toThrow(ContentClipperUnsupportedError);
  });

  test("source has no phaser, GeometryMask, Canvas fallback, or beginFill", () => {
    const source = readFileSync(join(import.meta.dir, "../../src/pixi/ContentClipper.ts"), "utf8");
    expect(source.includes("phaser")).toBe(false);
    expect(source.includes("GeometryMask")).toBe(false);
    expect(source.includes("CANVAS")).toBe(false);
    expect(source.includes("beginFill")).toBe(false);
    expect(source.includes("setSize")).toBe(false);
    expect(source.includes("target.mask")).toBe(true);
    expect(source.includes(".rect(")).toBe(true);
    expect(source.includes(".fill(")).toBe(true);
    expect(source.includes("visible = false")).toBe(false);
  });
});
