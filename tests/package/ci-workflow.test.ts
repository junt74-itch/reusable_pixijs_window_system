import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "../..");
const workflowPath = join(root, ".github/workflows/check.yml");

function readRoot(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

test(".github/workflows/check.yml exists", () => {
  expect(existsSync(workflowPath)).toBe(true);
});

test("check workflow contains required CI contract", () => {
  const workflow = readFileSync(workflowPath, "utf8");

  expect(workflow).toContain("name: check");
  expect(workflow).toContain("branches:");
  expect(workflow).toContain("- main");
  expect(workflow).toContain("pull_request:");
  expect(workflow).toContain('bun-version: "1.4.0"');
  expect(workflow).toContain("bun install --frozen-lockfile");
  expect(workflow).toContain("bun run check");
});

test("package.json packageManager is bun@1.4.0", () => {
  const pkg = JSON.parse(readRoot("package.json")) as {
    packageManager?: string;
  };

  expect(pkg.packageManager).toBe("bun@1.4.0");
});
