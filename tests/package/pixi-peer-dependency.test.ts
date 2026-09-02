import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test("pixi.js is a peer dependency, not a runtime dependency", () => {
  const pkg = JSON.parse(readRoot("package.json")) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  expect(pkg.dependencies?.["pixi.js"]).toBeUndefined();
  expect(pkg.peerDependencies?.["pixi.js"]).toBe(">=8.20.1 <9");
  expect(pkg.devDependencies?.["pixi.js"]).toBe("8.20.1");
});

test("package.json has no phaser in dependencies, devDependencies, or peerDependencies", () => {
  const pkg = JSON.parse(readRoot("package.json")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  expect(pkg.dependencies?.phaser).toBeUndefined();
  expect(pkg.devDependencies?.phaser).toBeUndefined();
  expect(pkg.peerDependencies?.phaser).toBeUndefined();
});

test("vite.config.ts externalizes pixi.js", () => {
  const viteConfig = readRoot("vite.config.ts");
  expect(viteConfig).toContain('external: ["pixi.js"]');
});

test("dist/index.js imports pixi.js externally and does not bundle Phaser", () => {
  const distJs = readRoot("dist/index.js");

  expect(distJs).toContain('from "pixi.js"');
  expect(distJs).not.toContain('from "phaser"');
  expect(distJs.length).toBeLessThan(200_000);
});
