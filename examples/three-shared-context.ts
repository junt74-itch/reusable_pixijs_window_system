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

function applyLetterbox(stage: HTMLElement, canvas: HTMLCanvasElement): void {
  const scaleX = Math.trunc(window.innerWidth / LOGICAL_WIDTH);
  const scaleY = Math.trunc(window.innerHeight / LOGICAL_HEIGHT);
  const scale = Math.max(1, Math.min(scaleX, scaleY));
  const cssWidth = `${LOGICAL_WIDTH * scale}px`;
  const cssHeight = `${LOGICAL_HEIGHT * scale}px`;
  stage.style.width = cssWidth;
  stage.style.height = cssHeight;
  canvas.style.width = cssWidth;
  canvas.style.height = cssHeight;
}

async function main(): Promise<void> {
  const sharedRoot = document.getElementById("shared-root");
  const sharedStage = document.getElementById("shared-stage");
  if (!sharedRoot || !sharedStage) {
    throw new Error("#shared-root or #shared-stage element not found");
  }

  const threeRenderer = new WebGLRenderer({ antialias: false, stencil: true });
  threeRenderer.setSize(LOGICAL_WIDTH, LOGICAL_HEIGHT, false);
  sharedStage.appendChild(threeRenderer.domElement);

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
    autoStart: false,
    context: threeRenderer.getContext(),
    canvas: threeRenderer.domElement,
    width: LOGICAL_WIDTH,
    height: LOGICAL_HEIGHT,
    clearBeforeRender: false,
    roundPixels: true,
    antialias: false,
    backgroundAlpha: 0,
    preference: "webgl",
  });

  applyLetterbox(sharedStage, threeRenderer.domElement);

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
  void messageWindow.say(null, "Three.js 共有 WebGL context + Pixi UI の任意例です。");

  let lastTime = performance.now();

  const renderFrame = (now: number): void => {
    const deltaMS = now - lastTime;
    lastTime = now;

    cube.rotation.x += 0.01;
    cube.rotation.y += 0.015;

    threeRenderer.resetState();
    threeRenderer.render(scene, camera);

    app.renderer.resetState();
    input.update(deltaMS);
    messageWindow.update(now, deltaMS);
    app.renderer.render({ container: app.stage, clear: false });

    requestAnimationFrame(renderFrame);
  };

  requestAnimationFrame(renderFrame);

  window.addEventListener("resize", () => {
    applyLetterbox(sharedStage, threeRenderer.domElement);
  });
}

main().catch((error: unknown) => {
  console.error(error);
});
