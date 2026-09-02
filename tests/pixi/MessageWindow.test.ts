import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BitmapFont,
  BitmapText,
  Cache,
  Container,
  Graphics,
  Sprite,
  Texture,
  type RawCharData,
} from "pixi.js";
import { MessageWindow } from "../../src/pixi/MessageWindow.ts";
import { TextWindowBase } from "../../src/pixi/TextWindowBase.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import {
  BitmapFontNotLoadedError,
  type WindowTextContent,
} from "../../src/text/types.ts";
import { WindowDestroyedError } from "../../src/core/types.ts";
import { MessageBusyError } from "../../src/message/MessageController.ts";
import { MissingMessagePortraitError } from "../../src/message/types.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

const ROOT = resolve(import.meta.dir, "../..");
const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;
const MESSAGE_SOURCE = readFileSync(join(ROOT, "src/pixi/MessageWindow.ts"), "utf8");
const PORTRAIT_KEY = "face";
const PORTRAIT = { textureKey: PORTRAIT_KEY, width: 48, height: 48 };

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
    B: {
      id: 66,
      page: 0,
      x: 6,
      y: 0,
      width: 6,
      height: 9,
      xOffset: 0,
      yOffset: 3,
      xAdvance: 6,
      kerning: {},
      letter: "B",
    },
  };
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

function clearPortrait(): void {
  Cache.remove(PORTRAIT_KEY);
}

function installPortrait(key: string = PORTRAIT_KEY): void {
  Cache.set(key, Texture.EMPTY);
}

function createMessageWindow(
  options: ConstructorParameters<typeof MessageWindow>[2] = {},
): MessageWindow {
  const host = createStubHost();
  return new MessageWindow(
    host,
    { x: 0, y: 0, width: 400, height: 100 },
    {
      createRenderer: (context) => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
      ...options,
    },
  );
}

function getVisibleBitmapTexts(window: MessageWindow): BitmapText[] {
  return window
    .getContentContainer()
    .children.filter((child): child is BitmapText => child instanceof BitmapText && child.visible);
}

function completeSay(window: MessageWindow): void {
  for (let step = 0; step < 80; step += 1) {
    window.update(step, 16);
  }
}

function walkMessageSources(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkMessageSources(fullPath));
    } else if (entry.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function openForInput(window: MessageWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.show();
}

describe("MessageWindow", () => {
  let window: MessageWindow;

  beforeEach(() => {
    clearFont();
    clearPortrait();
    installFont(createTestFont());
  });

  afterEach(() => {
    window?.destroy();
    clearFont();
    clearPortrait();
  });

  test("extends TextWindowBase and src/message has no pixi imports", () => {
    window = createMessageWindow();
    expect(window).toBeInstanceOf(TextWindowBase);
    expect(window).toBeInstanceOf(MessageWindow);

    const messageDir = join(ROOT, "src/message");
    for (const file of walkMessageSources(messageDir)) {
      const content = readFileSync(file, "utf8");
      expect(content.includes('from "pixi.js"')).toBe(false);
      expect(content.includes("from 'pixi.js'")).toBe(false);
    }
  });

  test("say rejects busy and destroyed with typed errors", async () => {
    window = createMessageWindow();
    const first = window.say(null, "A", { autoOpen: false });
    await expect(window.say(null, "B")).rejects.toBeInstanceOf(MessageBusyError);
    await openForInput(window);
    for (let step = 0; step < 50; step += 1) {
      window.update(step, 16);
    }
    await first;

    window.destroy();
    await expect(window.say(null, "C")).rejects.toBeInstanceOf(WindowDestroyedError);
  });

  test("missing portrait throws MissingMessagePortraitError; loaded portrait adds Sprite", () => {
    window = createMessageWindow();
    expect(() =>
      window.say(null, "A", {
        autoOpen: false,
        portrait: PORTRAIT,
      }),
    ).toThrow(MissingMessagePortraitError);

    installPortrait();
    void window.say(null, "A", { autoOpen: false, portrait: PORTRAIT, charsPerSecond: 120 });
    const sprite = window.getContentContainer().children.find(
      (child): child is Sprite => child instanceof Sprite,
    );
    expect(sprite).toBeDefined();
    expect(sprite!.width).toBe(Math.trunc(PORTRAIT.width));
    completeSay(window);
  });

  test("speaker BitmapText is visible and body y includes speaker reserved height", async () => {
    window = createMessageWindow();
    void window.say("Alice", "A", { autoOpen: false });
    await openForInput(window);
    for (let step = 0; step < 30; step += 1) {
      window.update(step, 16);
    }

    const visible = getVisibleBitmapTexts(window);
    const speaker = visible.find((node) => node.text === "Alice");
    expect(speaker).toBeDefined();
    expect(speaker!.visible).toBe(true);

    const speakerReserved = Math.trunc(12 * 1 + 4 + 4);
    const body = visible.find((node) => node.text === "A");
    expect(body).toBeDefined();
    expect(body!.y).toBeGreaterThanOrEqual(speakerReserved);
  });

  test("page break pauses for confirm and pause indicator toggles visibility", async () => {
    const input = new ManualWindowInput();
    window = createMessageWindow({ input });
    void window.say(null, "A\fB", { autoOpen: false, charsPerSecond: 120 });
    await openForInput(window);

    const pauseGraphics = window
      .getContentContainer()
      .children.filter((child): child is Graphics => child instanceof Graphics);
    expect(pauseGraphics.length).toBeGreaterThanOrEqual(1);

    let pausedForAdvance = false;
    const subscription = window.subscribeMessage((snapshot) => {
      pausedForAdvance = snapshot.pausedForAdvance;
    });

    for (let step = 0; step < 40; step += 1) {
      window.update(step, 16);
      if (pausedForAdvance) {
        break;
      }
    }
    expect(pausedForAdvance).toBe(true);
    expect(pauseGraphics.some((node) => node.visible)).toBe(true);

    input.pushAction("confirm");
    window.update(100, 16);
    expect(pausedForAdvance).toBe(false);

    subscription.unsubscribe();
    completeSay(window);
  });

  test("color tokens produce multiple visible BitmapText runs with different tints", async () => {
    window = createMessageWindow();
    const content: WindowTextContent = "{color:FF0000}A{color:00FF00}B";
    void window.say(null, content, { autoOpen: false, charsPerSecond: 120 });
    await openForInput(window);
    for (let step = 0; step < 60; step += 1) {
      window.update(step, 16);
    }

    const bodyTexts = getVisibleBitmapTexts(window).filter(
      (node) => node.text === "A" || node.text === "B",
    );
    expect(bodyTexts.length).toBeGreaterThanOrEqual(2);
    const tints = new Set(bodyTexts.map((node) => node.tint));
    expect(tints.size).toBeGreaterThanOrEqual(2);
  });

  test("MessageWindow source avoids Phaser, beginFill, and Pixi Text", () => {
    expect(MESSAGE_SOURCE.includes('from "phaser"')).toBe(false);
    expect(MESSAGE_SOURCE.includes("beginFill")).toBe(false);
    expect(MESSAGE_SOURCE.includes("PIXI.Text")).toBe(false);
    expect(MESSAGE_SOURCE.includes("new Text(")).toBe(false);
    expect(MESSAGE_SOURCE.includes("Cache.has(")).toBe(true);
  });

  test("MessageWindow portrait source contract keeps Cache.has, Sprite, and MissingMessagePortraitError", () => {
    expect(MESSAGE_SOURCE.includes("Cache.has(")).toBe(true);
    expect(MESSAGE_SOURCE.includes("new Sprite(")).toBe(true);
    expect(MESSAGE_SOURCE.includes("MissingMessagePortraitError")).toBe(true);
  });

  test("barrel exports MessageWindow and keeps assertMessageSayPreflight internal", async () => {
    const barrel = await import("../../src/index.ts");
    expect(barrel.MessageWindow).toBe(MessageWindow);
    expect("assertMessageSayPreflight" in barrel).toBe(false);
  });

  test("unloaded rich-text fontKey rejects with BitmapFontNotLoadedError", async () => {
    window = createMessageWindow();
    const content: WindowTextContent = {
      spans: [{ text: "A", fontKey: "missing-font" }],
    };
    await expect(window.say(null, content, { autoOpen: false })).rejects.toBeInstanceOf(
      BitmapFontNotLoadedError,
    );
  });
});
