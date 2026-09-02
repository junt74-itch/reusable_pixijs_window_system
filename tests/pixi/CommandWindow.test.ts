import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BitmapFont, Cache, Container, Texture, type RawCharData } from "pixi.js";
import {
  CommandWindow,
  CommandBusyError,
  CommandConfigurationError,
} from "../../src/pixi/CommandWindow.ts";
import type { CommandItem } from "../../src/command/types.ts";
import { SelectableWindow } from "../../src/pixi/SelectableWindow.ts";
import { WindowOperationCancelledError } from "../../src/core/types.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";
import {
  CommandWindow as BarrelCommandWindow,
  CommandBusyError as BarrelCommandBusyError,
  CommandConfigurationError as BarrelCommandConfigurationError,
} from "../../src/index.ts";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/CommandWindow.ts"), "utf8");
const BARREL = readFileSync(join(ROOT, "src/index.ts"), "utf8");
const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;

const ATTACK: CommandItem = { id: "attack", label: "A", enabled: true };
const DEFEND: CommandItem = { id: "defend", label: "B", enabled: true };

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
    D: {
      id: 68,
      page: 0,
      x: 12,
      y: 0,
      width: 6,
      height: 9,
      xOffset: 0,
      yOffset: 3,
      xAdvance: 6,
      kerning: {},
      letter: "D",
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

async function openCommandForInput(window: CommandWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.enable();
  window.show();
}

function createCommandWindow(
  options: ConstructorParameters<typeof CommandWindow>[2] = {},
): { window: CommandWindow; input: ManualWindowInput } {
  const host = createStubHost();
  const input = new ManualWindowInput();
  const window = new CommandWindow(host, { x: 0, y: 0, width: 200, height: 80 }, {
    input,
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
    rowHeight: 16,
    rowGap: 2,
    ...options,
  });
  return { window, input };
}

describe("CommandWindow", () => {
  let window: CommandWindow;
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
    ({ window } = createCommandWindow());
    expect(window).toBeInstanceOf(SelectableWindow);
    expect(SOURCE.includes("extends SelectableWindow")).toBe(true);
  });

  test("chooseCommands resolves selected command record on confirm", async () => {
    ({ window, input } = createCommandWindow());
    const promise = window.chooseCommands([ATTACK, DEFEND], {
      autoOpen: false,
      closeOnComplete: false,
    });
    await openCommandForInput(window);

    input.pushAction("confirm");

    const result = await promise;
    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.index).toBe(0);
      expect(result.command).toEqual(ATTACK);
      expect(result.command.id).toBe("attack");
    }
  });

  test("second chooseCommands rejects with CommandBusyError and empty list with CommandConfigurationError", async () => {
    ({ window, input } = createCommandWindow());
    const first = window.chooseCommands([ATTACK], { autoOpen: false, closeOnComplete: false });
    await expect(window.chooseCommands([DEFEND])).rejects.toBeInstanceOf(CommandBusyError);

    await window.open(0);
    window.activate();
    window.enable();
    input.pushAction("confirm");
    await first;

    await expect(window.chooseCommands([])).rejects.toBeInstanceOf(CommandConfigurationError);
  });

  test("cancelable cancel resolves cancelled status", async () => {
    ({ window, input } = createCommandWindow());
    const promise = window.chooseCommands([ATTACK, DEFEND], {
      autoOpen: false,
      closeOnComplete: false,
      cancelable: true,
    });
    await openCommandForInput(window);

    input.pushAction("cancel");

    const result = await promise;
    expect(result).toEqual({ status: "cancelled" });
  });

  test("destroy rejects pending chooseCommands with WindowOperationCancelledError", async () => {
    ({ window } = createCommandWindow());
    const promise = window.chooseCommands([ATTACK], { autoOpen: false, closeOnComplete: false });
    window.destroy();
    await expect(promise).rejects.toBeInstanceOf(WindowOperationCancelledError);
  });

  test("avoids Phaser imports and beginFill; assertCommandChoiceReady stays internal", () => {
    expect(SOURCE.includes('from "phaser"')).toBe(false);
    expect(SOURCE.includes("beginFill")).toBe(false);
    expect(BARREL.includes("assertCommandChoiceReady")).toBe(false);
    expect(BARREL.includes("toSelectableCommands")).toBe(false);
  });

  test("barrel exports CommandWindow and typed errors", () => {
    expect(BarrelCommandWindow).toBe(CommandWindow);
    expect(BarrelCommandBusyError).toBe(CommandBusyError);
    expect(BarrelCommandConfigurationError).toBe(CommandConfigurationError);
  });
});
