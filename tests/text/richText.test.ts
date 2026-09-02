import { describe, expect, test } from "bun:test";
import { WindowConfigError } from "../../src/core/types.ts";
import {
  flattenRichText,
  normalizeRichText,
  resolveRichTextAlign,
  validateRichText,
} from "../../src/text/richText.ts";
import type { RichText } from "../../src/text/types.ts";

describe("richText", () => {
  test("string normalize yields one span without align and normalizes newlines", () => {
    const result = normalizeRichText("hello\r\nworld\r");
    expect(result).toEqual({ spans: [{ text: "hello\nworld\n" }] });
    expect(result.align).toBeUndefined();
  });

  test("normalizeRichText does not mutate RichText input", () => {
    const input: RichText = {
      align: "center",
      spans: [
        { text: "a\r\nb", fontKey: "font-a", fontSize: 12 },
        { text: "c" },
      ],
    };
    const snapshot = structuredClone(input);
    const result = normalizeRichText(input);
    expect(input).toEqual(snapshot);
    expect(result).not.toBe(input);
    expect(result.spans).not.toBe(input.spans);
    expect(result.spans[0]).not.toBe(input.spans[0]);
    expect(result).toEqual({
      align: "center",
      spans: [
        { text: "a\nb", fontKey: "font-a", fontSize: 12 },
        { text: "c" },
      ],
    });
  });

  test("empty string and empty spans flatten to empty text and chars", () => {
    expect(flattenRichText("")).toEqual({ text: "", align: undefined, chars: [] });
    expect(flattenRichText({ spans: [] })).toEqual({ text: "", align: undefined, chars: [] });
  });

  test("multiple spans concatenate with UTF-16 sourceIndex across spans", () => {
    const result = flattenRichText({
      spans: [{ text: "ab" }, { text: "cd" }],
    });
    expect(result.text).toBe("abcd");
    expect(result.chars.map((entry) => entry.sourceIndex)).toEqual([0, 1, 2, 3]);
    expect(result.chars.map((entry) => entry.char)).toEqual(["a", "b", "c", "d"]);
  });

  test("a span can specify fontKey and fontSize together", () => {
    const result = flattenRichText({
      spans: [{ text: "x", fontKey: "custom", fontSize: 24 }],
    });
    expect(result.chars).toEqual([
      { sourceIndex: 0, char: "x", fontKey: "custom", fontSize: 24 },
    ]);
  });

  test("unspecified span fontKey and fontSize are undefined", () => {
    const result = flattenRichText({ spans: [{ text: "z" }] });
    expect(result.chars).toEqual([
      { sourceIndex: 0, char: "z", fontKey: undefined, fontSize: undefined },
    ]);
  });

  test("carriage return newlines become one newline in text and chars", () => {
    const result = flattenRichText("a\r\nb");
    expect(result.text).toBe("a\nb");
    expect(result.chars.map((entry) => entry.char)).toEqual(["a", "\n", "b"]);
    expect(result.chars.filter((entry) => entry.char === "\n")).toHaveLength(1);
  });

  test("CRLF split across span boundaries is one newline", () => {
    const content: RichText = {
      spans: [
        { text: "a\r", fontSize: 12 },
        { text: "\nb", fontSize: 24 },
      ],
    };
    const flattened = flattenRichText(content);
    expect(flattened.text).toBe("a\nb");
    expect(flattened.chars.map((entry) => entry.char)).toEqual(["a", "\n", "b"]);
    expect(flattened.chars.filter((entry) => entry.char === "\n")).toHaveLength(1);
    expect(normalizeRichText(content)).toEqual({
      spans: [
        { text: "a\n", fontSize: 12 },
        { text: "b", fontSize: 24 },
      ],
    });
  });

  test("empty fontKey throws WindowConfigError", () => {
    expect(() => validateRichText({ spans: [{ text: "x", fontKey: "" }] })).toThrow(WindowConfigError);
    expect(() => validateRichText({ spans: [{ text: "x", fontKey: "" }] })).toThrow(
      "fontKey must not be empty.",
    );
  });

  test("invalid fontSize values throw WindowConfigError", () => {
    for (const fontSize of [0, 1.5, NaN, -1]) {
      expect(() => validateRichText({ spans: [{ text: "x", fontSize }] })).toThrow(WindowConfigError);
      expect(() => validateRichText({ spans: [{ text: "x", fontSize }] })).toThrow(
        "fontSize must be a positive integer.",
      );
    }
  });

  test("invalid align throws WindowConfigError", () => {
    expect(() => validateRichText({ spans: [], align: "justify" as never })).toThrow(WindowConfigError);
    expect(() => validateRichText({ spans: [], align: "justify" as never })).toThrow(
      'align must be "left", "center", or "right".',
    );
  });

  test("resolveRichTextAlign uses fallback for strings and explicit align for RichText", () => {
    expect(resolveRichTextAlign("hello")).toBe("left");
    expect(resolveRichTextAlign({ spans: [], align: "center" })).toBe("center");
  });

  test("surrogate pairs produce one char entry and advance sourceIndex by two", () => {
    const emoji = "😀X";
    const result = flattenRichText(emoji);
    expect(result.chars).toHaveLength(2);
    expect(result.chars[0]).toEqual({
      sourceIndex: 0,
      char: "😀",
      fontKey: undefined,
      fontSize: undefined,
    });
    expect(result.chars[1]).toEqual({
      sourceIndex: 2,
      char: "X",
      fontKey: undefined,
      fontSize: undefined,
    });
  });
});
