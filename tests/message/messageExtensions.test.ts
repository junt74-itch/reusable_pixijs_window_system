import { describe, expect, test } from "bun:test";
import { WindowDestroyedError, WindowLayoutError } from "../../src/core/types.ts";
import { splitLineColorRuns } from "../../src/message/colorRuns.ts";
import { MessageBusyError } from "../../src/message/MessageController.ts";
import {
  assertMessageSayPreflight,
  portraitReservedWidth,
  resolveMessageSayPortrait,
} from "../../src/message/sayPreflight.ts";
import { MissingMessagePortraitError } from "../../src/message/types.ts";

const PORTRAIT = { textureKey: "face", width: 48, height: 48 };

describe("splitLineColorRuns", () => {
  test("groups consecutive glyphs that share a tint", () => {
    const runs = splitLineColorRuns("ABC", 0, [0xff0000, 0xff0000, 0x00ff00]);
    expect(runs).toEqual([
      { text: "AB", color: 0xff0000 },
      { text: "C", color: 0x00ff00 },
    ]);
  });
});

describe("assertMessageSayPreflight", () => {
  test("rejects busy before consulting the texture atlas", () => {
    let textureLookups = 0;
    expect(() =>
      assertMessageSayPreflight({
        destroyed: false,
        busy: true,
        portrait: PORTRAIT,
        textureExists: () => {
          textureLookups += 1;
          return false;
        },
        contentWidth: 200,
      }),
    ).toThrow(MessageBusyError);
    expect(textureLookups).toBe(0);
  });

  test("rejects destroyed before busy or texture checks", () => {
    let textureLookups = 0;
    expect(() =>
      assertMessageSayPreflight({
        destroyed: true,
        busy: true,
        portrait: PORTRAIT,
        textureExists: () => {
          textureLookups += 1;
          return true;
        },
        contentWidth: 200,
      }),
    ).toThrow(WindowDestroyedError);
    expect(textureLookups).toBe(0);
  });

  test("rejects a missing portrait texture without treating it as busy", () => {
    expect(() =>
      assertMessageSayPreflight({
        destroyed: false,
        busy: false,
        portrait: PORTRAIT,
        textureExists: () => false,
        contentWidth: 200,
      }),
    ).toThrow(MissingMessagePortraitError);
  });

  test("rejects a portrait that leaves no room for body text", () => {
    expect(() =>
      assertMessageSayPreflight({
        destroyed: false,
        busy: false,
        portrait: { textureKey: "face", width: 200, height: 48 },
        textureExists: () => true,
        contentWidth: 200,
      }),
    ).toThrow(WindowLayoutError);
  });

  test("allows a null portrait without texture lookup", () => {
    let textureLookups = 0;
    assertMessageSayPreflight({
      destroyed: false,
      busy: false,
      portrait: null,
      textureExists: () => {
        textureLookups += 1;
        return false;
      },
      contentWidth: 200,
    });
    expect(textureLookups).toBe(0);
  });

  test("resolveMessageSayPortrait keeps an explicit null over the default", () => {
    expect(resolveMessageSayPortrait(null, PORTRAIT)).toBeNull();
    expect(resolveMessageSayPortrait(undefined, PORTRAIT)).toEqual(PORTRAIT);
    expect(portraitReservedWidth(PORTRAIT)).toBe(56);
  });

  test("accepts a loaded portrait that leaves room for body text", () => {
    assertMessageSayPreflight({
      destroyed: false,
      busy: false,
      portrait: PORTRAIT,
      textureExists: (key) => key === "face",
      contentWidth: 200,
    });
  });

  test("missing portrait error names the texture key", () => {
    const error = new MissingMessagePortraitError("face");
    expect(error.name).toBe("MissingMessagePortraitError");
    expect(error.textureKey).toBe("face");
  });
});
