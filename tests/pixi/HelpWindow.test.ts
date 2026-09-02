import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BitmapFont, BitmapText, Cache, Container, Texture, type RawCharData } from "pixi.js";
import { HelpWindow } from "../../src/pixi/HelpWindow.ts";
import { TextWindowBase } from "../../src/pixi/TextWindowBase.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/HelpWindow.ts"), "utf8");
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

function getVisibleBitmapTexts(window: HelpWindow): BitmapText[] {
  return window
    .getContentContainer()
    .children.filter((child): child is BitmapText => child instanceof BitmapText && child.visible);
}

function createHelpWindow(width: number, height: number): HelpWindow {
  const host = createStubHost();
  return new HelpWindow(host, { x: 0, y: 0, width, height }, {
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
  });
}

describe("HelpWindow", () => {
  let window: HelpWindow;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont({ X: { xAdvance: 6 } }));
  });

  afterEach(() => {
    window?.destroy();
    clearFont();
  });

  test("extends TextWindowBase", () => {
    window = createHelpWindow(200, 80);
    expect(window).toBeInstanceOf(TextWindowBase);
    expect(SOURCE.includes("extends TextWindowBase")).toBe(true);
  });

  test("setHelp shows visible BitmapText and setHelp(null) clears it", () => {
    window = createHelpWindow(200, 80);
    window.setHelp("A");
    expect(getVisibleBitmapTexts(window).some((textObject) => textObject.text === "A")).toBe(true);
    expect(window.getHelp()).toBe("A");

    window.setHelp(null);
    expect(getVisibleBitmapTexts(window).length).toBe(0);
    expect(window.getHelp()).toBeNull();
  });

  test("renderHelp keeps pageIndex === 0 filter for overflow content", () => {
    expect(SOURCE.includes("line.pageIndex === 0")).toBe(true);

    window = createHelpWindow(80, 28);
    window.setHelp("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

    const visible = getVisibleBitmapTexts(window);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((textObject) => textObject.text.length > 0)).toBe(true);
  });

  test("avoids Phaser imports, beginFill, and Pixi Text", () => {
    expect(SOURCE.includes('from "phaser"')).toBe(false);
    expect(SOURCE.includes("beginFill")).toBe(false);
    expect(SOURCE.includes("new Text(")).toBe(false);
  });
});
