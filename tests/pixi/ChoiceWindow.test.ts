import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BitmapFont, Cache, Container, Texture, type RawCharData } from "pixi.js";
import {
  ChoiceWindow,
  ChoiceBusyError,
  ChoiceConfigurationError,
} from "../../src/pixi/ChoiceWindow.ts";
import { SelectableWindow } from "../../src/pixi/SelectableWindow.ts";
import { WindowOperationCancelledError } from "../../src/core/types.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import {
  ChoiceWindow as BarrelChoiceWindow,
  ChoiceBusyError as BarrelChoiceBusyError,
  ChoiceConfigurationError as BarrelChoiceConfigurationError,
} from "../../src/index.ts";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/ChoiceWindow.ts"), "utf8");
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

async function openChoiceForInput(window: ChoiceWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.enable();
  window.show();
}

function createChoiceWindow(
  options: ConstructorParameters<typeof ChoiceWindow>[2] = {},
): { window: ChoiceWindow; input: ManualWindowInput } {
  const host = createStubHost();
  const input = new ManualWindowInput();
  const window = new ChoiceWindow(host, { x: 0, y: 0, width: 200, height: 80 }, {
    input,
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
    rowHeight: 16,
    rowGap: 2,
    ...options,
  });
  return { window, input };
}

describe("ChoiceWindow", () => {
  let window: ChoiceWindow;
  let input: ManualWindowInput;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont());
  });

  afterEach(() => {
    window?.destroy();
    clearFont();
  });

  test("extends SelectableWindow", () => {
    ({ window } = createChoiceWindow());
    expect(window).toBeInstanceOf(SelectableWindow);
    expect(SOURCE.includes("extends SelectableWindow")).toBe(true);
  });

  test("choose resolves selected index on confirm", async () => {
    ({ window, input } = createChoiceWindow());
    const promise = window.choose(["A", "B"], { autoOpen: false, closeOnComplete: false });
    await openChoiceForInput(window);

    input.pushAction("confirm");

    const result = await promise;
    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.index).toBe(0);
      expect(result.item.value).toBe("A");
    }
  });

  test("second choose rejects with ChoiceBusyError and empty list with ChoiceConfigurationError", async () => {
    ({ window, input } = createChoiceWindow());
    const first = window.choose(["A"], { autoOpen: false, closeOnComplete: false });
    await expect(window.choose(["B"])).rejects.toBeInstanceOf(ChoiceBusyError);

    await window.open(0);
    window.activate();
    window.enable();
    input.pushAction("confirm");
    await first;

    await expect(window.choose([])).rejects.toBeInstanceOf(ChoiceConfigurationError);
  });

  test("cancelable cancel resolves cancelled status", async () => {
    ({ window, input } = createChoiceWindow());
    const promise = window.choose(["A", "B"], {
      autoOpen: false,
      closeOnComplete: false,
      cancelable: true,
    });
    await openChoiceForInput(window);

    input.pushAction("cancel");

    const result = await promise;
    expect(result).toEqual({ status: "cancelled" });
  });

  test("destroy rejects pending choose with WindowOperationCancelledError", async () => {
    ({ window } = createChoiceWindow());
    const promise = window.choose(["A"], { autoOpen: false, closeOnComplete: false });
    window.destroy();
    await expect(promise).rejects.toBeInstanceOf(WindowOperationCancelledError);
  });

  test("barrel exports ChoiceWindow and typed errors", () => {
    expect(BarrelChoiceWindow).toBe(ChoiceWindow);
    expect(BarrelChoiceBusyError).toBe(ChoiceBusyError);
    expect(BarrelChoiceConfigurationError).toBe(ChoiceConfigurationError);
  });
});
