import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test("root index.ts re-exports src barrel only", () => {
  const indexTs = readRoot("index.ts");

  expect(indexTs).toContain('export * from "./src/index.ts"');
  expect(indexTs).not.toContain("./src/core/");
  expect(indexTs).not.toContain("./src/message/");
});

test("submodule-source.ts imports from root index.ts only", () => {
  const submoduleSource = readRoot("examples/consumer/submodule-source.ts");

  expect(submoduleSource).toContain('from "../../index.ts"');
  expect(submoduleSource).not.toContain("../../src/");
});

test("docs/README.md and src/README.md exist", () => {
  expect(existsSync(join(root, "docs/README.md"))).toBe(true);
  expect(existsSync(join(root, "src/README.md"))).toBe(true);
});

test("root README points to docs/README.md", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("docs/README.md");
});

test("specification documents exist", () => {
  expect(existsSync(join(root, "docs/SPECIFICATION.md"))).toBe(true);
  expect(existsSync(join(root, "docs/API.md"))).toBe(true);
  expect(existsSync(join(root, "docs/SUBMODULE.md"))).toBe(true);
  expect(existsSync(join(root, "docs/PIXI_PORT_CHECKLIST.md"))).toBe(true);
});

const FORBIDDEN_WINDOW_CLASSES = [
  "SelectableWindow",
  "CursorRenderer",
  "CommandWindow",
];

function referencesWindowClass(source: string, className: string): boolean {
  return new RegExp(`\\b${className}\\b`).test(source);
}

test("consumer examples do not reference Window classes", () => {
  const submoduleSource = readRoot("examples/consumer/submodule-source.ts");
  const readmeExample = readRoot("examples/consumer/readme-example.ts");

  for (const name of FORBIDDEN_WINDOW_CLASSES) {
    expect(referencesWindowClass(submoduleSource, name)).toBe(false);
    expect(referencesWindowClass(readmeExample, name)).toBe(false);
  }
});
