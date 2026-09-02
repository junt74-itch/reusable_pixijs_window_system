import { Application, Assets, type BitmapFont } from "pixi.js";
import {
  createPixiWindowHost,
  PixiWindowInput,
  MessageWindow,
  ChoiceWindow,
  layoutWindowInViewport,
} from "../../index.ts";
import type { BitmapFontAsset } from "../../index.ts";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;
const FONT_KEY = "game-font";
const CHOICE_CONTINUE = "続ける";
const CHOICE_STOP = "やめる";

const GAME_FONT: BitmapFontAsset = {
  key: FONT_KEY,
  textureURL: new URL("./assets/fonts/game-font/font.png", import.meta.url).href,
  fontDataURL: new URL("./assets/fonts/game-font/font.xml", import.meta.url).href,
};

async function preloadGameFont(): Promise<BitmapFont> {
  const font = await Assets.load<BitmapFont>({
    alias: GAME_FONT.key,
    src: GAME_FONT.fontDataURL,
  });

  for (const page of font.pages) {
    page.texture.source.scaleMode = "nearest";
  }

  return font;
}

function applyLetterbox(canvas: HTMLCanvasElement): void {
  const scaleX = Math.trunc(window.innerWidth / LOGICAL_WIDTH);
  const scaleY = Math.trunc(window.innerHeight / LOGICAL_HEIGHT);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  canvas.style.width = `${LOGICAL_WIDTH * scale}px`;
  canvas.style.height = `${LOGICAL_HEIGHT * scale}px`;
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

  await preloadGameFont();

  const input = new PixiWindowInput(host);

  const messageBounds = layoutWindowInViewport({
    viewportWidth: LOGICAL_WIDTH,
    viewportHeight: LOGICAL_HEIGHT,
    width: 520,
    height: 140,
    margin: 40,
    anchor: "top-center",
  });

  const choiceBounds = layoutWindowInViewport({
    viewportWidth: LOGICAL_WIDTH,
    viewportHeight: LOGICAL_HEIGHT,
    width: 280,
    height: 120,
    margin: 40,
    anchor: "bottom-center",
  });

  const messageWindow = new MessageWindow(
    host,
    {
      x: messageBounds.x,
      y: messageBounds.y,
      width: messageBounds.width,
      height: messageBounds.height,
      theme: { text: { fontKey: FONT_KEY } },
    },
    { input, ownsInput: true },
  );

  const choiceWindow = new ChoiceWindow(
    host,
    {
      x: choiceBounds.x,
      y: choiceBounds.y,
      width: choiceBounds.width,
      height: choiceBounds.height,
      theme: { text: { fontKey: FONT_KEY } },
    },
    { input, ownsInput: false },
  );

  app.ticker.add((ticker) => {
    if (!input.isAdapterDisposed()) {
      input.update(ticker.deltaMS);
    }
    if (!messageWindow.isDestroyed()) {
      messageWindow.update(ticker.lastTime, ticker.deltaMS);
    }
    if (!choiceWindow.isDestroyed()) {
      choiceWindow.update(ticker.lastTime, ticker.deltaMS);
    }
  });

  window.addEventListener("resize", () => {
    applyLetterbox(app.canvas);
  });

  messageWindow.activate();
  choiceWindow.deactivate();

  await messageWindow.say(null, "consumer 例です。\f2ページ目です。");

  messageWindow.deactivate();
  choiceWindow.activate();

  await choiceWindow.choose([CHOICE_CONTINUE, CHOICE_STOP]);

  choiceWindow.destroy();
  messageWindow.destroy();
  host.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
});
