import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const SOURCE = readFileSync(join(ROOT, "src/pixi/TextWindowBase.ts"), "utf8");

function layoutTextContentBody(): string {
  const start = SOURCE.indexOf("protected layoutTextContent(");
  const end = SOURCE.indexOf("protected renderLines(", start);
  const helperStart = SOURCE.indexOf("protected ensureMeasurerForContent(");
  const helperEnd = SOURCE.indexOf("private replaceMeasurer(", helperStart);
  return SOURCE.slice(start, end) + SOURCE.slice(helperStart, helperEnd);
}

function renderLinesBody(): string {
  const start = SOURCE.indexOf("protected renderLines(");
  const end = SOURCE.indexOf("protected clearText(", start);
  return SOURCE.slice(start, end);
}

describe("TextWindowBase rich-text rendering contract", () => {
  test("layoutTextContent calls layoutRichText", () => {
    const body = layoutTextContentBody();
    expect(body.includes("layoutRichText(")).toBe(true);
    expect(body.includes("layoutText(")).toBe(false);
  });

  test("renderLines iterates line.runs and sets run fontSize", () => {
    const body = renderLinesBody();
    expect(body.includes("splitTextFontRuns")).toBe(false);
    expect(body.includes("line.runs")).toBe(true);
    expect(body.includes("run.fontSize")).toBe(true);
  });

  test("renderLines y position uses line.ascent and scaleFontMetrics", () => {
    const body = renderLinesBody();
    expect(body.includes("line.ascent")).toBe(true);
    expect(body.includes("scaleFontMetrics(")).toBe(true);
  });

  test("layoutTextContent throws BitmapFontNotLoadedError for unloaded specified font keys", () => {
    const body = layoutTextContentBody();
    expect(body.includes("resolveLoadedBitmapFont")).toBe(true);
    expect(body.includes("BitmapFontNotLoadedError")).toBe(true);
  });

  test("layoutTextContent does not call setTheme", () => {
    const body = layoutTextContentBody();
    expect(body.includes("setTheme(")).toBe(false);
  });

  test("TextWindowBase avoids OS/CSS/Pixi Text fallbacks", () => {
    expect(SOURCE.includes("Arial")).toBe(false);
    expect(SOURCE.includes("sans-serif")).toBe(false);
    expect(SOURCE.includes("new Text(")).toBe(false);
    expect(SOURCE.includes("from \"pixi.js\"")).toBe(true);
    expect(SOURCE.includes("BitmapText")).toBe(true);
  });
});
