import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function extractConsumerSection(readme: string): string {
  const start = readme.indexOf("## 他プロジェクトへ導入する場合");
  const end = readme.indexOf("## このリポジトリを開発・確認する場合");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return readme.slice(start, end);
}

function extractCodeFences(section: string): string[] {
  const fences: string[] = [];
  const pattern = /```(?:\w+)?\n([\s\S]*?)```/g;
  for (const match of section.matchAll(pattern)) {
    fences.push(match[1] ?? "");
  }
  return fences;
}

test("README.md documents dev sandbox, overlay, and submodule guide", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("bun run dev");
  expect(readme).toContain("three-overlay.html");
  expect(readme).toContain("docs/SUBMODULE.md");
});

test("README.md has consumer and developer sections", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("他プロジェクトへ導入する場合");
  expect(readme).toContain("このリポジトリを開発・確認する場合");
});

test("README.md references minimal-submodule-runtime consumer example", () => {
  const readme = readRoot("README.md");

  expect(readme).toContain("minimal-submodule-runtime.ts");
});

test("README.md declares Git submodule as official install path", () => {
  const readme = readRoot("README.md");

  expect(readme).toMatch(/Git submodule/i);
  expect(readme).not.toContain("bun add git+");
  expect(readme).not.toContain("npm install git+");
});

test("README consumer code fences do not recommend DEFAULT_BITMAP_FONT_ASSET", () => {
  const readme = readRoot("README.md");
  const consumerSection = extractConsumerSection(readme);
  const codeFences = extractCodeFences(consumerSection);

  expect(codeFences.length).toBeGreaterThan(0);
  for (const fence of codeFences) {
    expect(fence).not.toContain("DEFAULT_BITMAP_FONT_ASSET");
  }
});

test("README.md includes CI badge for check workflow", () => {
  const readme = readRoot("README.md");
  const workflowPath = join(root, ".github/workflows/check.yml");

  expect(existsSync(workflowPath)).toBe(true);
  expect(readme).toContain("actions/workflows/check.yml");
});

test("docs/SUBMODULE.md documents peerDependencies contract", () => {
  const submodule = readRoot("docs/SUBMODULE.md");

  expect(submodule).toContain("peerDependencies");
});

test("docs/SUBMODULE.md does not claim VERSION-only exports", () => {
  const submodule = readRoot("docs/SUBMODULE.md");

  expect(submodule).not.toContain("VERSION のみ");
});

test("docs/API.md does not claim imports are unavailable", () => {
  const api = readRoot("docs/API.md");

  expect(api).not.toContain("いまは import できません");
});

test("docs/SPECIFICATION.md does not claim VERSION-only public code", () => {
  const spec = readRoot("docs/SPECIFICATION.md");

  expect(spec).not.toContain("公開コードは VERSION と最小 sandbox のみ");
});

test("docs/MIGRATION.md is not a preview-only notice", () => {
  const migration = readRoot("docs/MIGRATION.md");

  expect(migration).not.toContain("予告");
});
