import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readExamplesMain(): string {
  return readRoot("examples/main.ts");
}

test("index.html loads examples/main.ts as module script", () => {
  const html = readRoot("index.html");

  expect(html).toContain('type="module"');
  expect(html).toContain('src="/examples/main.ts"');
});

test("examples/main.ts uses Application and async init", () => {
  const main = readExamplesMain();

  expect(main).toContain("Application");
  expect(main).toContain("app.init");
});

test("examples/main.ts builds say → choose integration with host", () => {
  const main = readExamplesMain();

  expect(main).toContain("MessageWindow");
  expect(main).toContain("ChoiceWindow");
  expect(main).toContain("createPixiWindowHost");
  expect(main).toContain("say(");
  expect(main).toContain("choose(");
});

test("examples/main.ts shares PixiWindowInput with ownsInput split", () => {
  const main = readExamplesMain();

  expect(main).toContain("PixiWindowInput");
  expect(main).toContain("ownsInput: true");
  expect(main).toContain("ownsInput: false");
});

test("examples/main.ts includes page break in say content", () => {
  const main = readExamplesMain();

  expect(main.includes("\\f") || main.includes("{page}")).toBe(true);
});

test("examples/main.ts updates windows and input on ticker", () => {
  const main = readExamplesMain();

  expect(main).toContain(".update(");
  expect(main).toContain("ticker");
  expect(main).toContain("sharedInput.update");
});

test("examples/main.ts exposes MessageWindow exercise keyboard controls", () => {
  const main = readExamplesMain();

  expect(main).toContain("KeyD");
  expect(main).toContain("destroy");
  expect(main).toContain("KeyC");
  expect(main).toContain("KeyO");
  expect(main).toContain("KeyH");
  expect(main).toContain("KeyS");
});

test("examples sandbox preloads default bitmap font with Assets.load", () => {
  const preload = readRoot("examples/preloadDefaultBitmapFont.ts");

  expect(preload).toContain("Assets.load");
  expect(preload).toContain("DEFAULT_BITMAP_FONT_ASSET");
});

test("examples/main.ts renders with BitmapText and preloadDefaultBitmapFont", () => {
  const main = readExamplesMain();

  expect(main).toContain("BitmapText");
  expect(main).toContain("preloadDefaultBitmapFont");
});

test("examples/main.ts handles resize with letterbox scaling", () => {
  const main = readExamplesMain();

  expect(main.toLowerCase()).toContain("resize");
  expect(main).toContain("applyLetterbox");
  expect(main).not.toContain("app.renderer.resize");
});

test("sandbox entry files do not reference phaser", () => {
  const main = readExamplesMain();
  const html = readRoot("index.html");

  expect(main.toLowerCase()).not.toContain("phaser");
  expect(html.toLowerCase()).not.toContain("phaser");
});

test("examples/main.ts does not use beginFill", () => {
  const main = readExamplesMain();

  expect(main).not.toContain("beginFill");
});

test("examples sandbox includes MessageWindow and ChoiceWindow integration", () => {
  const main = readExamplesMain();

  expect(main).toContain("MessageWindow");
  expect(main).toContain("ChoiceWindow");
});

test("examples sandbox excludes CommandWindow and NineSlice", () => {
  const main = readExamplesMain();

  expect(main).not.toContain("CommandWindow");
  expect(main).not.toContain("NineSlice");
});
