import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readThreeOverlayEntry(): string {
  return readRoot("examples/three-overlay.ts");
}

function walkSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = join(dir, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...walkSourceFiles(absolutePath));
      continue;
    }
    if (entry.endsWith(".ts")) {
      files.push(absolutePath);
    }
  }
  return files;
}

test("three-overlay.html loads examples/three-overlay.ts as module script", () => {
  const html = readRoot("three-overlay.html");

  expect(html).toContain('type="module"');
  expect(html).toContain('src="/examples/three-overlay.ts"');
});

test("examples/three-overlay.ts imports three and createPixiWindowHost with app.init", () => {
  const entry = readThreeOverlayEntry();

  expect(entry).toContain('from "three"');
  expect(entry).toContain("createPixiWindowHost");
  expect(entry).toContain("app.init");
});

test("examples/three-overlay.ts does not share WebGL context or resetState", () => {
  const entry = readThreeOverlayEntry();

  expect(entry).not.toContain("resetState");
  expect(entry).not.toMatch(/app\.init\s*\(\s*\{[^}]*context\s*:/);
  expect(entry).not.toMatch(/getContext\s*\(\s*\)[\s\S]*app\.init/);
});

test("examples/three-overlay.ts does not reference phaser or beginFill", () => {
  const entry = readThreeOverlayEntry();

  expect(entry.toLowerCase()).not.toContain("phaser");
  expect(entry).not.toContain("beginFill");
});

test("package.json keeps three in devDependencies only at 0.185.1", () => {
  const packageJson = JSON.parse(readRoot("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  expect(packageJson.dependencies?.three).toBeUndefined();
  expect(packageJson.devDependencies?.three).toBe("0.185.1");
});

test("src/ does not import three", () => {
  const sourceFiles = walkSourceFiles(join(root, "src"));
  for (const filePath of sourceFiles) {
    const source = readFileSync(filePath, "utf8");
    expect(source).not.toContain('from "three"');
  }
});
