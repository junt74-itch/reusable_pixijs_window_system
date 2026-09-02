import { describe, expect, test } from "bun:test";
import { MissingWindowSkinError } from "../../src/skin/types.ts";

describe("MissingWindowSkinError", () => {
  test("exposes name, textureKey, and message containing the key", () => {
    const error = new MissingWindowSkinError("window-placeholder");

    expect(error.name).toBe("MissingWindowSkinError");
    expect(error.textureKey).toBe("window-placeholder");
    expect(error.message).toContain("window-placeholder");
  });
});
