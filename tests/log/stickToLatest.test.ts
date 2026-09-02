import { describe, expect, test } from "bun:test";
import { shouldStickToLatest } from "../../src/log/stickToLatest.ts";

describe("shouldStickToLatest", () => {
  test("returns true when offset >= maxOffset", () => {
    expect(shouldStickToLatest(10, 10)).toBe(true);
    expect(shouldStickToLatest(15, 10)).toBe(true);
  });

  test("returns false when offset < maxOffset", () => {
    expect(shouldStickToLatest(0, 10)).toBe(false);
    expect(shouldStickToLatest(9, 10)).toBe(false);
  });
});
