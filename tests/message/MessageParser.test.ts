import { describe, expect, test } from "bun:test";
import { parseMessage } from "../../src/message/MessageParser.ts";

describe("parseMessage", () => {
  test("parses text, newline, page break, wait, pause, and escaping", () => {
    const result = parseMessage("Hello\n\f{wait:500}{pause}{{brace}");
    expect(result.tokens.map((token) => token.type)).toEqual([
      "text",
      "newline",
      "pageBreak",
      "wait",
      "pause",
      "text",
    ]);
    const wait = result.tokens.find((token) => token.type === "wait");
    expect(wait && wait.type === "wait" ? wait.ms : null).toBe(500);
  });

  test("keeps invalid waits as literal text", () => {
    const result = parseMessage("{wait:70000}");
    expect(result.tokens).toEqual([
      expect.objectContaining({ type: "text", value: "{wait:70000}" }),
    ]);
  });

  test("parses color and speed and keeps unknown tokens literal", () => {
    const result = parseMessage("{color:FF0000}Hi{color}{speed:12} there {unknown} \\C[1]");
    expect(result.tokens.map((token) => token.type)).toEqual([
      "color",
      "text",
      "color",
      "speed",
      "text",
    ]);
    const color = result.tokens[0];
    expect(color && color.type === "color" ? color.color : null).toBe(0xff0000);
    const reset = result.tokens[2];
    expect(reset && reset.type === "color" ? reset.color : null).toBeNull();
    const speed = result.tokens[3];
    expect(speed && speed.type === "speed" ? speed.charsPerSecond : null).toBe(12);
    expect(result.tokens.some((token) => token.type === "text" && token.value.includes("{unknown}"))).toBe(
      true,
    );
    expect(result.tokens.some((token) => token.type === "text" && token.value.includes("\\C[1]"))).toBe(
      true,
    );
  });

  test("keeps invalid color and speed as literal text", () => {
    expect(parseMessage("{color:red}").tokens[0]).toEqual(
      expect.objectContaining({ type: "text", value: "{color:red}" }),
    );
    expect(parseMessage("{speed:0}").tokens[0]).toEqual(
      expect.objectContaining({ type: "text", value: "{speed:0}" }),
    );
  });
});
