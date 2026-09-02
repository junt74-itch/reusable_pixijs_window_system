import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BitmapFont, BitmapText, Cache, Container, Texture, type RawCharData } from "pixi.js";
import { LogWindow } from "../../src/pixi/LogWindow.ts";
import { ScrollableWindow } from "../../src/pixi/ScrollableWindow.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/LogWindow.ts"), "utf8");
const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;

class FakeGraphics implements GraphicsLike {
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

function createFakeGraphicsFactory(): GraphicsFactory {
  return {
    createBackground: () => new FakeGraphics(),
    createFrame: () => new FakeGraphics(),
  };
}

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

function createTestFont(extraChars?: Record<string, { xAdvance: number }>): BitmapFont {
  const chars: Record<string, RawCharData> = {
    A: {
      id: 65,
      page: 0,
      x: 0,
      y: 0,
      width: 6,
      height: 9,
      xOffset: 0,
      yOffset: 3,
      xAdvance: 6,
      kerning: {},
      letter: "A",
    },
  };
  for (const [letter, glyph] of Object.entries(extraChars ?? {})) {
    const codePoint = letter.codePointAt(0)!;
    chars[letter] = {
      id: codePoint,
      page: 0,
      x: 0,
      y: 0,
      width: 6,
      height: 9,
      xOffset: 0,
      yOffset: 3,
      xAdvance: glyph.xAdvance,
      kerning: {},
      letter,
    };
  }
  return new BitmapFont({
    data: {
      pages: [{ id: 0, file: "font.png" }],
      chars,
      fontSize: 12,
      lineHeight: 14,
      baseLineOffset: 3,
      fontFamily: FONT_KEY,
    },
    textures: [new Texture()],
  });
}

function installFont(font: BitmapFont, key: string = FONT_KEY): void {
  Cache.set(key, font);
  Cache.set(`${key}-bitmap`, font);
}

function clearFont(key: string = FONT_KEY): void {
  Cache.remove(key);
  Cache.remove(`${key}-bitmap`);
}

function getScrollBodyBitmapTexts(window: LogWindow): BitmapText[] {
  return window.getScrollBody().children.filter((child): child is BitmapText => child instanceof BitmapText);
}

function createLogWindow(width: number, height: number): LogWindow {
  const host = createStubHost();
  return new LogWindow(host, { x: 0, y: 0, width, height }, {
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
  });
}

describe("LogWindow", () => {
  let window: LogWindow;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont({ X: { xAdvance: 6 } }));
  });

  afterEach(() => {
    window?.destroy();
    clearFont();
  });

  test("extends ScrollableWindow", () => {
    window = createLogWindow(200, 80);
    expect(window).toBeInstanceOf(ScrollableWindow);
    expect(SOURCE.includes("extends ScrollableWindow")).toBe(true);
  });

  test("append adds visible BitmapText to scrollBody and getEntries length is 1", () => {
    window = createLogWindow(200, 80);
    window.append("A");
    expect(getScrollBodyBitmapTexts(window).some((label) => label.text === "A")).toBe(true);
    expect(window.getEntries().length).toBe(1);
  });

  test("append sticks to bottom when already at bottom but not when scrolled up", () => {
    window = createLogWindow(80, 28);
    for (let index = 0; index < 8; index += 1) {
      window.append("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
    }
    const maxBefore = window.getScrollController().getBounds().maxOffset;
    expect(maxBefore).toBeGreaterThan(0);
    window.setScrollOffset(maxBefore);
    expect(window.getScrollOffset()).toBe(maxBefore);

    window.append("X");
    expect(window.getScrollOffset()).toBe(window.getScrollController().getBounds().maxOffset);

    window.setScrollOffset(0);
    const offsetBeforeAppend = window.getScrollOffset();
    window.append("X");
    expect(window.getScrollOffset()).toBe(offsetBeforeAppend);
  });

  test("clear removes entries and sets content size to 0", () => {
    window = createLogWindow(200, 80);
    window.append("A");
    window.clear();
    expect(window.getEntries().length).toBe(0);
    expect(window.getScrollController().getBounds().contentSize).toBe(0);
    expect(getScrollBodyBitmapTexts(window).length).toBe(0);
  });

  test("avoids Phaser imports, beginFill, and Pixi Text", () => {
    expect(SOURCE.includes('from "phaser"')).toBe(false);
    expect(SOURCE.includes("beginFill")).toBe(false);
    expect(SOURCE.includes("new Text(")).toBe(false);
  });
});
