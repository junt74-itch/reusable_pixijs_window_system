import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function readSharedContextEntry(): string {
  return readRoot("examples/three-shared-context.ts");
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

test("three-shared-context.html loads examples/three-shared-context.ts as module script", () => {
  const html = readRoot("three-shared-context.html");

  expect(html).toContain('type="module"');
  expect(html).toContain('src="/examples/three-shared-context.ts"');
});

test("examples/three-shared-context.ts shares WebGL context with resetState and stencil", () => {
  const entry = readSharedContextEntry();

  expect(entry).toContain('from "three"');
  expect(entry).toContain("createPixiWindowHost");
  expect(entry).toContain("app.init");
  expect(entry).toContain("getContext");
  expect(entry).toContain("resetState");
  expect(entry).toContain("stencil");
});

test("examples/three-overlay.ts does not share WebGL context or resetState", () => {
  const entry = readThreeOverlayEntry();

  expect(entry).not.toContain("resetState");
  expect(entry).not.toMatch(/app\.init\s*\(\s*\{[^}]*context\s*:/);
  expect(entry).not.toMatch(/getContext\s*\(\s*\)[\s\S]*app\.init/);
});

test("shared context and overlay entries do not reference phaser or beginFill", () => {
  const shared = readSharedContextEntry();
  const overlay = readThreeOverlayEntry();

  for (const entry of [shared, overlay]) {
    expect(entry.toLowerCase()).not.toContain("phaser");
    expect(entry).not.toContain("beginFill");
  }
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
