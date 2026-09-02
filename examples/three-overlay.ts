import { Application } from "pixi.js";
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { createPixiWindowHost } from "../src/host/createPixiWindowHost.ts";
import { PixiWindowInput } from "../src/input/PixiWindowInput.ts";
import { layoutWindowInViewport } from "../src/layout/viewportLayout.ts";
import { MessageWindow } from "../src/pixi/MessageWindow.ts";
import { DEFAULT_BITMAP_FONT_ASSET } from "../src/text/BitmapFontAsset.ts";
import { preloadDefaultBitmapFont } from "./preloadDefaultBitmapFont.ts";

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 540;
const FONT_KEY = DEFAULT_BITMAP_FONT_ASSET.key;

function applyLetterbox(stage: HTMLElement, ...canvases: HTMLCanvasElement[]): void {
  const scaleX = Math.trunc(window.innerWidth / LOGICAL_WIDTH);
  const scaleY = Math.trunc(window.innerHeight / LOGICAL_HEIGHT);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  const cssWidth = `${LOGICAL_WIDTH * scale}px`;
  const cssHeight = `${LOGICAL_HEIGHT * scale}px`;
  stage.style.width = cssWidth;
  stage.style.height = cssHeight;
  for (const canvas of canvases) {
    canvas.style.width = cssWidth;
    canvas.style.height = cssHeight;
  }
}

async function main(): Promise<void> {
  const overlayRoot = document.getElementById("overlay-root");
  const overlayStage = document.getElementById("overlay-stage");
  if (!overlayRoot || !overlayStage) {
    throw new Error("#overlay-root or #overlay-stage element not found");
  }

  const threeRenderer = new WebGLRenderer({ antialias: false });
  threeRenderer.setSize(LOGICAL_WIDTH, LOGICAL_HEIGHT, false);
  threeRenderer.domElement.style.pointerEvents = "none";
  overlayStage.appendChild(threeRenderer.domElement);

  const scene = new Scene();
  scene.background = new Color(0x1a2030);
  const camera = new PerspectiveCamera(50, LOGICAL_WIDTH / LOGICAL_HEIGHT, 0.1, 100);
  camera.position.z = 3;

  const cube = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshBasicMaterial({ color: 0x4499cc }),
  );
  scene.add(cube);

  const app = new Application();
  await app.init({
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    roundPixels: true,
    antialias: false,
    backgroundAlpha: 0,
  });
  overlayStage.appendChild(app.canvas);

  applyLetterbox(overlayStage, threeRenderer.domElement, app.canvas);

  const host = createPixiWindowHost(app, {
    logicalWidth: LOGICAL_WIDTH,
    logicalHeight: LOGICAL_HEIGHT,
  });

  await preloadDefaultBitmapFont();

  const input = new PixiWindowInput(host);
  const bounds = layoutWindowInViewport({
    viewportWidth: LOGICAL_WIDTH,
    viewportHeight: LOGICAL_HEIGHT,
    width: 520,
    height: 140,
    margin: 40,
    anchor: "bottom-center",
  });

  const messageWindow = new MessageWindow(
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

  messageWindow.activate();
  void messageWindow.say(null, "Three.js 下層 + Pixi overlay の統合例です。");

  app.ticker.add((ticker) => {
    input.update(ticker.deltaMS);
    messageWindow.update(ticker.lastTime, ticker.deltaMS);
  });

  const renderThree = (): void => {
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;
    threeRenderer.render(scene, camera);
    requestAnimationFrame(renderThree);
  };
  requestAnimationFrame(renderThree);

  window.addEventListener("resize", () => {
    applyLetterbox(overlayStage, threeRenderer.domElement, app.canvas);
  });
}

main().catch((error: unknown) => {
  console.error(error);
});
