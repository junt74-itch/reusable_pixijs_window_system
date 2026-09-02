import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { DEFAULT_BITMAP_FONT_ASSET } from "../../src/text/BitmapFontAsset.ts";

const root = join(import.meta.dir, "../..");
const fontDir = join(root, "examples/assets/fonts/jf-dot-mplus12");
const parserPath = join(
  root,
  "node_modules/pixi.js/lib/scene/text-bitmap/asset/bitmapFontXMLParser.mjs",
);

function readFont(relativePath: string): string {
  return readFileSync(join(fontDir, relativePath), "utf8");
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

test("font.xml common has lineHeight=14 and base=11", () => {
  const xml = readFont("font.xml");
  const commonMatch = xml.match(/<common\b[^>]*>/);

  expect(commonMatch).not.toBeNull();
  const commonTag = commonMatch?.[0] ?? "";

  expect(commonTag).toMatch(/lineHeight="14"/);
  expect(commonTag).toMatch(/base="11"/);
});

test("Pixi bitmapFontXMLParser derives baseLineOffset from lineHeight - base", () => {
  const parserSource = readFileSync(parserPath, "utf8");

  expect(parserSource).toContain("getElementsByTagName(\"kerning\")");
  expect(parserSource).toMatch(
    /baseLineOffset\s*=\s*base\s*===\s*null\s*\?\s*0\s*:\s*data\.lineHeight\s*-\s*parseInt\(base,\s*10\)/,
  );

  // measurer は XML `base`（または `lineHeight - baseLineOffset`）を使う。
  // Pixi の `baseLineOffset` を `resolveBitmapFontBase` に渡さない（実装は P3）。
  const lineHeight = 14;
  const base = 11;
  const baseLineOffset = lineHeight - base;

  expect(baseLineOffset).toBe(3);
});

test("font.xml has zero kernings and expected glyph coverage", () => {
  const xml = readFont("font.xml");

  expect(xml).toContain('<kernings count="0" />');
  expect(xml).toContain('id="12354"');
  expect(xml).not.toContain('id="8226"');
});

test("missing-characters.txt lists U+2022 bullet as absent from font.xml", () => {
  const missing = readFont("missing-characters.txt");
  const xml = readFont("font.xml");

  expect(missing).toContain("U+2022");
  expect(xml).not.toContain('id="8226"');
});

test("DEFAULT_BITMAP_FONT_ASSET URLs match sandbox font directory", () => {
  expect(DEFAULT_BITMAP_FONT_ASSET.key).toBe("jf-dot-mplus12");
  expect(DEFAULT_BITMAP_FONT_ASSET.textureURL).toBe(
    "/examples/assets/fonts/jf-dot-mplus12/font.png",
  );
  expect(DEFAULT_BITMAP_FONT_ASSET.fontDataURL).toBe(
    "/examples/assets/fonts/jf-dot-mplus12/font.xml",
  );
});

test("provenance.json font.xml sha256 matches on-disk font.xml", () => {
  const provenance = JSON.parse(readFont("provenance.json")) as {
    files: Array<{ file: string; sha256: string }>;
  };
  const fontXmlEntry = provenance.files.find((entry) => entry.file === "font.xml");

  expect(fontXmlEntry).toBeDefined();
  if (!fontXmlEntry) {
    throw new Error("provenance.json is missing font.xml entry");
  }

  const fontXml = readFont("font.xml");
  expect(sha256(fontXml)).toBe(fontXmlEntry.sha256);
});

test("sandbox main uses Assets.load and BitmapText without importing Text", () => {
  const main = readFileSync(join(root, "examples/main.ts"), "utf8");
  const preload = readFileSync(join(root, "examples/preloadDefaultBitmapFont.ts"), "utf8");

  expect(main).toContain("BitmapText");
  expect(preload).toContain("Assets.load");
  expect(main.toLowerCase()).not.toContain("phaser");

  const pixiImportPattern = /import\s*\{([^}]+)\}\s*from\s*["']pixi\.js["']/g;
  const imports = [...main.matchAll(pixiImportPattern), ...preload.matchAll(pixiImportPattern)].flatMap(
    (match) => match[1]?.split(",").map((part) => part.trim()) ?? [],
  );

  expect(imports.some((name) => name === "BitmapText" || name.startsWith("BitmapText "))).toBe(
    true,
  );
  expect(imports.some((name) => name === "Text" || name.startsWith("Text "))).toBe(false);
  expect(imports.some((name) => name.includes("BitmapFont.install"))).toBe(false);
});
