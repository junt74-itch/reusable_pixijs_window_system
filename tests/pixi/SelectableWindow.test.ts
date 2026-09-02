import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BitmapFont, BitmapText, Cache, Container, Texture, type RawCharData } from "pixi.js";
import { SelectableWindow } from "../../src/pixi/SelectableWindow.ts";
import { ScrollableWindow } from "../../src/pixi/ScrollableWindow.ts";
import { TextWindowBase } from "../../src/pixi/TextWindowBase.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { SelectableItem } from "../../src/selection/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/SelectableWindow.ts"), "utf8");
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

function createTestFont(): BitmapFont {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const chars: Record<string, RawCharData> = {};
  for (let index = 0; index < letters.length; index += 1) {
    const letter = letters[index]!;
    chars[letter] = glyph(letter, index * 6);
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

class TestSelectableWindow extends SelectableWindow<string> {
  public confirmed: { index: number; item: SelectableItem<string> } | null = null;
  public cancelled = false;

  public getScrollBodyForTest(): Container {
    return this.scrollBody;
  }

  public getScrollOffset(): number {
    return this.scrollController.getBounds().offset;
  }

  protected override onSelectionConfirmed(index: number, item: SelectableItem<string>): void {
    this.confirmed = { index, item };
  }

  protected override onSelectionCancelled(): void {
    this.cancelled = true;
  }
}

function createSelectableWindow(
  options: ConstructorParameters<typeof TestSelectableWindow>[2] = {},
): { window: TestSelectableWindow; input: ManualWindowInput } {
  const host = createStubHost();
  const input = new ManualWindowInput();
  const window = new TestSelectableWindow(
    host,
    { x: 0, y: 0, width: 200, height: 40 },
    {
      input,
      createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
      rowHeight: 16,
      rowGap: 2,
      ...options,
    },
  );
  return { window, input };
}

function collectVisibleRowLabels(window: TestSelectableWindow): BitmapText[] {
  const scrollBody = window.getScrollBodyForTest();
  return scrollBody.children.filter(
    (child): child is BitmapText => child instanceof BitmapText && child.visible,
  );
}

async function openForInput(window: TestSelectableWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.enable();
  window.show();
}

function glyph(char: string, x: number): RawCharData {
  return {
    id: char.charCodeAt(0),
    page: 0,
    x,
    y: 0,
    width: 6,
    height: 9,
    xOffset: 0,
    yOffset: 3,
    xAdvance: 6,
    kerning: {},
    letter: char,
  };
}

describe("SelectableWindow", () => {
  let window: TestSelectableWindow;
  let input: ManualWindowInput;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont());
  });

  afterEach(() => {
    window?.destroy();
    clearFont();
  });

  test("extends TextWindowBase not ScrollableWindow and does not import ScrollableWindow", () => {
    ({ window } = createSelectableWindow());
    expect(window).toBeInstanceOf(TextWindowBase);
    expect(window).not.toBeInstanceOf(ScrollableWindow);
    expect(SOURCE.includes("extends TextWindowBase")).toBe(true);
    expect(SOURCE.includes("extends ScrollableWindow")).toBe(false);
    expect(SOURCE.includes("ScrollableWindow")).toBe(false);
  });

  test("setItems renders visible BitmapText rows from layoutRichText runs", () => {
    ({ window } = createSelectableWindow());
    window.setItems([
      { id: "0", label: "A", value: "A", enabled: true },
      { id: "1", label: { spans: [{ text: "B" }] }, value: "B", enabled: true },
    ]);

    const labels = collectVisibleRowLabels(window);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((label) => label.text === "A")).toBe(true);
    expect(labels.some((label) => label.text === "B")).toBe(true);
    expect(SOURCE.includes("layoutRichText(")).toBe(true);
    expect(SOURCE.includes("label.text = run.text")).toBe(true);
    expect(SOURCE.includes("label.text = item.label")).toBe(false);
  });

  test("ManualWindowInput moves selection when open and active", async () => {
    ({ window, input } = createSelectableWindow());
    window.setItems([
      { id: "0", label: "A", value: "A", enabled: true },
      { id: "1", label: "B", value: "B", enabled: true },
    ]);
    await openForInput(window);

    expect(window.getSelectedIndex()).toBe(0);
    input.pushAction("down");
    expect(window.getSelectedIndex()).toBe(1);
    input.pushAction("up");
    expect(window.getSelectedIndex()).toBe(0);
  });

  test("scrollBody y is Math.trunc(-offset) when rows exceed viewport", async () => {
    ({ window, input } = createSelectableWindow());
    const items = Array.from({ length: 20 }, (_, index) => ({
      id: String(index),
      label: String.fromCharCode(65 + (index % 26)),
      value: String(index),
      enabled: true,
    }));
    window.setItems(items);
    await openForInput(window);

    for (let step = 0; step < 15; step += 1) {
      input.pushAction("down");
    }

    const scrollBody = window.getScrollBodyForTest();
    const offset = window.getScrollOffset();
    expect(scrollBody.y).toBe(Math.trunc(-offset));
    expect(offset).toBeGreaterThan(0);
    expect(SOURCE.includes("Math.trunc(-offset)")).toBe(true);
  });

  test("source has no phaser beginFill or PIXI Text", () => {
    expect(SOURCE.includes('from "phaser"')).toBe(false);
    expect(SOURCE.includes("beginFill")).toBe(false);
    expect(SOURCE.includes("new Text(")).toBe(false);
  });
});
