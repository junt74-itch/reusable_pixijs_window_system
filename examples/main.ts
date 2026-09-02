import { Application, BitmapText } from "pixi.js";
import { createPixiWindowHost } from "../src/host/createPixiWindowHost.ts";
import { PixiWindowInput } from "../src/input/PixiWindowInput.ts";
import { layoutWindowInViewport } from "../src/layout/viewportLayout.ts";
import { ChoiceWindow } from "../src/pixi/ChoiceWindow.ts";
import { MessageWindow } from "../src/pixi/MessageWindow.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../src/text/BitmapFontAsset.ts";
import { preloadDefaultBitmapFont } from "./preloadDefaultBitmapFont.ts";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;
const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;
const MAX_LOOP_ITERATIONS = 3;
const CHOICE_CONTINUE = "続ける";
const CHOICE_STOP = "やめる";

function applyLetterbox(canvas: HTMLCanvasElement): void {
  const scaleX = Math.trunc(window.innerWidth / LOGICAL_WIDTH);
  const scaleY = Math.trunc(window.innerHeight / LOGICAL_HEIGHT);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  canvas.style.width = `${LOGICAL_WIDTH * scale}px`;
  canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
}

function integrationLayout(): {
  readonly message: { x: number; y: number; width: number; height: number };
  readonly choice: { x: number; y: number; width: number; height: number };
} {
  return {
    message: layoutWindowInViewport({
      viewportWidth: LOGICAL_WIDTH,
      viewportHeight: LOGICAL_HEIGHT,
      width: 520,
      height: 140,
      margin: 40,
      anchor: "top-center",
    }),
    choice: layoutWindowInViewport({
      viewportWidth: LOGICAL_WIDTH,
      viewportHeight: LOGICAL_HEIGHT,
      width: 280,
      height: 120,
      margin: 40,
      anchor: "bottom-center",
    }),
  };
}

async function main(): Promise<void> {
  const appRoot = document.getElementById("app");
  if (!appRoot) {
    throw new Error("#app element not found");
  }

  const app = new Application();
  await app.init({
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    roundPixels: true,
    antialias: false,
    backgroundColor: 0x101820,
  });

  appRoot.appendChild(app.canvas);
  applyLetterbox(app.canvas);

  const host = createPixiWindowHost(app, {
    logicalWidth: LOGICAL_WIDTH,
    logicalHeight: LOGICAL_HEIGHT,
  });

  await preloadDefaultBitmapFont();

  let sharedInput = new PixiWindowInput(host);
  let messageWindow = createMessageWindow(host, sharedInput);
  let choiceWindow = createChoiceWindow(host, sharedInput);

  const logText = new BitmapText({
    text: "Event log:",
    style: {
      fontFamily: FONT_KEY,
      fontSize: 12,
      fill: 0xe8e8f0,
    },
    x: Math.trunc(40),
    y: Math.trunc(200),
  });
  host.stage.addChild(logText);

  let iteration = 0;
  let loopRunning = false;
  let destroyExerciseRunning = false;

  const setLog = (message: string): void => {
    logText.text = message;
  };

  const ensureSharedInput = (): PixiWindowInput => {
    if (sharedInput.isAdapterDisposed()) {
      sharedInput = new PixiWindowInput(host);
    }
    return sharedInput;
  };

  const recreateWindows = (): void => {
    const input = ensureSharedInput();
    if (messageWindow.isDestroyed()) {
      messageWindow = createMessageWindow(host, input);
    }
    if (choiceWindow.isDestroyed()) {
      choiceWindow = createChoiceWindow(host, input);
    }
  };

  const runLoop = async (): Promise<void> => {
    if (loopRunning) {
      return;
    }
    loopRunning = true;
    setLog("Event log: loop owner started");

    while (iteration < MAX_LOOP_ITERATIONS) {
      iteration += 1;
      messageWindow.activate();
      choiceWindow.deactivate();

      try {
        await messageWindow.say(
          null,
          `結合テスト ステップ ${iteration}。\f2ページ目です。Enter で次へ。`,
        );
      } catch (error) {
        setLog(`Event log: say ${error instanceof Error ? error.name : "error"}`);
        loopRunning = false;
        return;
      }

      messageWindow.deactivate();
      choiceWindow.activate();

      let result;
      try {
        result = await choiceWindow.choose([CHOICE_CONTINUE, CHOICE_STOP]);
      } catch (error) {
        setLog(`Event log: choose ${error instanceof Error ? error.name : "error"}`);
        loopRunning = false;
        return;
      }

      if (result.status === "cancelled" || result.item.label === CHOICE_STOP) {
        setLog("Event log: stopped");
        loopRunning = false;
        return;
      }

      setLog(`Event log: iteration ${iteration}`);
    }

    setLog("Event log: loop complete");
    loopRunning = false;
  };

  const exerciseDestroyDuringPending = async (): Promise<void> => {
    if (destroyExerciseRunning) {
      return;
    }
    destroyExerciseRunning = true;
    setLog("Event log: destroy exercise started");

    messageWindow.activate();
    choiceWindow.deactivate();
    const sayPromise = messageWindow.say(null, "destroy 演習 {wait:5000}");
    window.setTimeout(() => {
      messageWindow.destroy();
    }, 200);
    try {
      await sayPromise;
    } catch (error) {
      setLog(`Event log: say ${error instanceof Error ? error.name : "settled"}`);
    }

    recreateWindows();
    choiceWindow.activate();
    messageWindow.deactivate();
    const choosePromise = choiceWindow.choose([CHOICE_CONTINUE]);
    window.setTimeout(() => {
      choiceWindow.destroy();
    }, 200);
    try {
      await choosePromise;
    } catch (error) {
      setLog(`Event log: choose ${error instanceof Error ? error.name : "settled"}`);
    }

    recreateWindows();
    setLog("Event log: destroy exercise complete");
    destroyExerciseRunning = false;
  };

  void runLoop();

  app.ticker.add((ticker) => {
    if (!sharedInput.isAdapterDisposed()) {
      sharedInput.update(ticker.deltaMS);
    }
    if (!messageWindow.isDestroyed()) {
      messageWindow.update(ticker.lastTime, ticker.deltaMS);
    }
    if (!choiceWindow.isDestroyed()) {
      choiceWindow.update(ticker.lastTime, ticker.deltaMS);
    }
  });

  const handleKeydown = (event: KeyboardEvent): void => {
    switch (event.code) {
      case "KeyC": {
        if (!messageWindow.isDestroyed()) {
          void messageWindow.close().catch(() => {});
        }
        break;
      }
      case "KeyO": {
        if (!messageWindow.isDestroyed()) {
          void messageWindow.open().catch(() => {});
        }
        break;
      }
      case "KeyH": {
        if (!messageWindow.isDestroyed()) {
          messageWindow.hide();
        }
        break;
      }
      case "KeyS": {
        if (!messageWindow.isDestroyed()) {
          messageWindow.show();
        }
        break;
      }
      case "KeyD": {
        void exerciseDestroyDuringPending();
        break;
      }
      default:
        break;
    }
  };

  window.addEventListener("keydown", handleKeydown);
  window.addEventListener("resize", () => {
    applyLetterbox(app.canvas);
  });
}

function createMessageWindow(host: ReturnType<typeof createPixiWindowHost>, input: PixiWindowInput): MessageWindow {
  const bounds = integrationLayout().message;
  return new MessageWindow(
    host,
    {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      theme: { text: { fontKey: FONT_KEY } },
    },
    { input, ownsInput: true },
  );
}

function createChoiceWindow(host: ReturnType<typeof createPixiWindowHost>, input: PixiWindowInput): ChoiceWindow {
  const bounds = integrationLayout().choice;
  return new ChoiceWindow(
    host,
    {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      theme: { text: { fontKey: FONT_KEY } },
    },
    { input, ownsInput: false },
  );
}

main().catch((error: unknown) => {
  console.error(error);
});
