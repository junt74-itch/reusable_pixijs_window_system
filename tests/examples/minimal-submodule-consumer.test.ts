import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const runtimePath = "examples/consumer/minimal-submodule-runtime.ts";
const htmlPath = "examples/consumer/minimal-submodule.html";
const fontDir = "examples/consumer/assets/fonts/game-font";

test("minimal-submodule.html loads runtime as module script", () => {
  const html = readRoot(htmlPath);

  expect(html).toContain('type="module"');
  expect(html).toContain("minimal-submodule-runtime.ts");
});

test("minimal-submodule-runtime imports only root barrel", () => {
  const runtime = readRoot(runtimePath);

  expect(runtime).toContain('from "../../index.ts"');
  expect(runtime).not.toContain('from "../src/');
  expect(runtime).not.toContain('from "../../src/');
});

test("minimal-submodule-runtime includes required integration surface", () => {
  const runtime = readRoot(runtimePath);

  expect(runtime).toContain("createPixiWindowHost");
  expect(runtime).toContain("PixiWindowInput");
  expect(runtime).toContain("MessageWindow");
  expect(runtime).toContain("ChoiceWindow");
  expect(runtime).toContain("say(");
  expect(runtime).toContain("choose(");
  expect(runtime).toContain("Assets.load");
  expect(runtime).toContain("scaleMode");
  expect(runtime).toContain('"nearest"');
});

test("minimal-submodule-runtime excludes sandbox-only defaults", () => {
  const runtime = readRoot(runtimePath);

  expect(runtime).not.toContain("DEFAULT_BITMAP_FONT_ASSET");
  expect(runtime).not.toContain("/examples/assets/fonts/jf-dot-mplus12");
});

test("minimal-submodule-runtime does not reference phaser", () => {
  const runtime = readRoot(runtimePath);

  expect(runtime.toLowerCase()).not.toContain("phaser");
});

test("consumer-owned font files exist", () => {
  for (const file of ["font.png", "font.xml", "license.txt"]) {
    expect(existsSync(join(root, fontDir, file))).toBe(true);
  }
});

test("README documents consumer integration path", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("他プロジェクトへ導入する場合");
  expect(readme).toContain("minimal-submodule-runtime.ts");
  expect(readme).toContain("docs/SUBMODULE.md");
});

test("README consumer code fence excludes sandbox-only DEFAULT_BITMAP_FONT_ASSET", () => {
  const readme = readRoot("README.md");
  const consumerSection = readme.slice(readme.indexOf("## 他プロジェクトへ導入する場合"));
  const fences = [...consumerSection.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");

  expect(fences.length).toBeGreaterThan(0);
  for (const fence of fences) {
    expect(fence).not.toContain("DEFAULT_BITMAP_FONT_ASSET");
    expect(fence).not.toContain("/examples/assets/fonts/jf-dot-mplus12");
  }
});

test("README documents font ownership and sandbox-only DEFAULT_BITMAP_FONT_ASSET", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("DEFAULT_BITMAP_FONT_ASSET");
  expect(readme).toMatch(/sandbox 専用/i);
  expect(readme).toContain("Assets.load");
  expect(readme).toMatch(/unload|Assets\.reset/);
});

test("README distinguishes internal sandbox from consumer example", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("examples/main.ts");
  expect(readme).toMatch(/内部|sandbox|サンドボックス/i);
});
