import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { BitmapFont, Cache, Container, Texture, type RawCharData } from "pixi.js";
import { MessageBusyError } from "../../src/message/MessageController.ts";
import {
  ChoiceWindow,
  ChoiceBusyError,
} from "../../src/pixi/ChoiceWindow.ts";
import { MessageWindow } from "../../src/pixi/MessageWindow.ts";
import { WindowOperationCancelledError } from "../../src/core/types.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";
import type { PixiWindowHost } from "../../src/host/types.ts";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { GraphicsWindowRenderer } from "../../src/core/GraphicsWindowRenderer.ts";
import type { GraphicsFactory, GraphicsLike } from "../../src/core/WindowRenderer.ts";

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

async function openMessageForInput(window: MessageWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.show();
}

async function openChoiceForInput(window: ChoiceWindow): Promise<void> {
  await window.open(0);
  window.activate();
  window.enable();
  window.show();
}

function completeSay(window: MessageWindow): void {
  for (let step = 0; step < 80; step += 1) {
    window.update(step, 16);
  }
}

function createIntegrationWindows(input: ManualWindowInput): {
  message: MessageWindow;
  choice: ChoiceWindow;
} {
  const host = createStubHost();
  const rendererOptions = {
    createRenderer: () => new GraphicsWindowRenderer(createFakeGraphicsFactory()),
  };
  const message = new MessageWindow(
    host,
    { x: 0, y: 0, width: 400, height: 100 },
    { input, ownsInput: true, ...rendererOptions },
  );
  const choice = new ChoiceWindow(
    host,
    { x: 0, y: 120, width: 200, height: 80 },
    { input, ownsInput: false, rowHeight: 16, rowGap: 2, ...rendererOptions },
  );
  return { message, choice };
}

describe("say → choose integration", () => {
  let message: MessageWindow;
  let choice: ChoiceWindow;
  let input: ManualWindowInput;

  beforeEach(() => {
    clearFont();
    installFont(createTestFont());
    input = new ManualWindowInput();
    ({ message, choice } = createIntegrationWindows(input));
  });

  afterEach(() => {
    message?.destroy();
    choice?.destroy();
    clearFont();
  });

  test("second say during pending say rejects with MessageBusyError", async () => {
    const first = message.say(null, "A", { autoOpen: false });
    await expect(message.say(null, "B")).rejects.toBeInstanceOf(MessageBusyError);
    await openMessageForInput(message);
    completeSay(message);
    await first;
  });

  test("second choose during pending choose rejects with ChoiceBusyError", async () => {
    const first = choice.choose(["A"], { autoOpen: false, closeOnComplete: false });
    await expect(choice.choose(["B"])).rejects.toBeInstanceOf(ChoiceBusyError);
    await openChoiceForInput(choice);
    input.pushAction("confirm");
    await first;
  });

  test("destroy rejects pending say with WindowOperationCancelledError", async () => {
    const promise = message.say(null, "A", { autoOpen: false, charsPerSecond: 120 });
    message.destroy();
    await expect(promise).rejects.toBeInstanceOf(WindowOperationCancelledError);
  });

  test("destroy rejects pending choose with WindowOperationCancelledError", async () => {
    const promise = choice.choose(["A"], { autoOpen: false, closeOnComplete: false });
    choice.destroy();
    await expect(promise).rejects.toBeInstanceOf(WindowOperationCancelledError);
  });

  test("ManualWindowInput settles page confirm then choice confirm", async () => {
    let pausedForAdvance = false;
    const subscription = message.subscribeMessage((snapshot) => {
      pausedForAdvance = snapshot.pausedForAdvance;
    });

    const sayPromise = message.say(null, "A\fB", { autoOpen: false, charsPerSecond: 120 });
    await openMessageForInput(message);

    for (let step = 0; step < 40; step += 1) {
      message.update(step, 16);
      if (pausedForAdvance) {
        break;
      }
    }
    expect(pausedForAdvance).toBe(true);

    input.pushAction("confirm");
    message.update(100, 16);
    completeSay(message);
    await sayPromise;
    subscription.unsubscribe();

    message.deactivate();
    choice.activate();

    const choosePromise = choice.choose(["A", "B"], { autoOpen: false, closeOnComplete: false });
    await openChoiceForInput(choice);
    input.pushAction("confirm");

    const result = await choosePromise;
    expect(result.status).toBe("selected");
    if (result.status === "selected") {
      expect(result.index).toBe(0);
      expect(result.item.label).toBe("A");
    }
  });
});
