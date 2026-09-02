import { WindowConfigError } from "../core/types.ts";
import type { FlattenedRichChar, RichText, TextAlign, WindowTextContent } from "./types.ts";

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function isTextAlign(value: unknown): value is TextAlign {
  return value === "left" || value === "center" || value === "right";
}

function assertTextAlign(value: unknown, message: string): asserts value is TextAlign {
  if (!isTextAlign(value)) {
    throw new WindowConfigError(message);
  }
}

function assertPositiveIntegerFontSize(fontSize: number): void {
  if (!Number.isFinite(fontSize) || !Number.isInteger(fontSize) || fontSize <= 0) {
    throw new WindowConfigError("fontSize must be a positive integer.");
  }
}

export function validateRichText(content: RichText): void {
  if (content.align !== undefined) {
    assertTextAlign(content.align, 'align must be "left", "center", or "right".');
  }
  for (const span of content.spans) {
    if (span.fontKey === "") {
      throw new WindowConfigError("fontKey must not be empty.");
    }
    if (span.fontSize !== undefined) {
      assertPositiveIntegerFontSize(span.fontSize);
    }
  }
}

function iterateSpanChars(spans: readonly RichText["spans"][number][]): Array<{
  char: string;
  fontKey: string | undefined;
  fontSize: number | undefined;
}> {
  const chars: Array<{
    char: string;
    fontKey: string | undefined;
    fontSize: number | undefined;
  }> = [];
  for (const span of spans) {
    for (let index = 0; index < span.text.length; index += 1) {
      const codePoint = span.text.codePointAt(index);
      if (codePoint === undefined) {
        continue;
      }
      chars.push({
        char: String.fromCodePoint(codePoint),
        fontKey: span.fontKey,
        fontSize: span.fontSize,
      });
      if (codePoint > 0xffff) {
        index += 1;
      }
    }
  }
  return chars;
}

function collapseCarriageReturns(
  raw: readonly {
    char: string;
    fontKey: string | undefined;
    fontSize: number | undefined;
  }[],
): FlattenedRichChar[] {
  const chars: FlattenedRichChar[] = [];
  let sourceIndex = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const entry = raw[index];
    if (entry === undefined) {
      continue;
    }
    const next = raw[index + 1];
    if (entry.char === "\r" && next?.char === "\n") {
      chars.push({
        sourceIndex,
        char: "\n",
        fontKey: entry.fontKey,
        fontSize: entry.fontSize,
      });
      sourceIndex += 1;
      index += 1;
      continue;
    }
    const char = entry.char === "\r" ? "\n" : entry.char;
    chars.push({
      sourceIndex,
      char,
      fontKey: entry.fontKey,
      fontSize: entry.fontSize,
    });
    sourceIndex += char.length;
  }
  return chars;
}

function normalizeSpansAcrossBoundaries(spans: readonly RichText["spans"][number][]): RichText["spans"][number][] {
  const normalized: RichText["spans"][number][] = [];
  let skipLeadingLf = false;
  for (const span of spans) {
    let text = "";
    for (let index = 0; index < span.text.length; index += 1) {
      const codePoint = span.text.codePointAt(index);
      if (codePoint === undefined) {
        continue;
      }
      const char = String.fromCodePoint(codePoint);
      if (codePoint > 0xffff) {
        index += 1;
      }
      if (skipLeadingLf) {
        skipLeadingLf = false;
        if (char === "\n") {
          continue;
        }
      }
      if (char === "\r") {
        text += "\n";
        const nextIndex = index + 1;
        const nextCodePoint = nextIndex < span.text.length ? span.text.codePointAt(nextIndex) : undefined;
        if (nextCodePoint === 0x000a) {
          index = nextIndex;
        } else {
          skipLeadingLf = true;
        }
        continue;
      }
      text += char;
    }
    normalized.push({
      text,
      ...(span.fontKey !== undefined ? { fontKey: span.fontKey } : {}),
      ...(span.fontSize !== undefined ? { fontSize: span.fontSize } : {}),
    });
  }
  return normalized;
}

export function collectSpecifiedFontKeys(contents: readonly WindowTextContent[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const content of contents) {
    for (const entry of flattenRichText(content).chars) {
      if (entry.fontKey === undefined || seen.has(entry.fontKey)) {
        continue;
      }
      seen.add(entry.fontKey);
      keys.push(entry.fontKey);
    }
  }
  return keys;
}

export function normalizeRichText(content: WindowTextContent): RichText {
  if (typeof content === "string") {
    return { spans: [{ text: normalizeNewlines(content) }] };
  }
  validateRichText(content);
  return {
    ...(content.align !== undefined ? { align: content.align } : {}),
    spans: normalizeSpansAcrossBoundaries(content.spans),
  };
}

export function resolveRichTextAlign(content: WindowTextContent, fallback: TextAlign = "left"): TextAlign {
  assertTextAlign(fallback, 'align must be "left", "center", or "right".');
  if (typeof content !== "string" && content.align !== undefined) {
    assertTextAlign(content.align, 'align must be "left", "center", or "right".');
    return content.align;
  }
  return fallback;
}

export function flattenRichText(content: WindowTextContent): {
  readonly text: string;
  readonly align: TextAlign | undefined;
  readonly chars: readonly FlattenedRichChar[];
} {
  if (typeof content === "string") {
    const chars = collapseCarriageReturns(iterateSpanChars([{ text: content }]));
    return { text: chars.map((entry) => entry.char).join(""), align: undefined, chars };
  }
  validateRichText(content);
  const chars = collapseCarriageReturns(iterateSpanChars(content.spans));
  return {
    text: chars.map((entry) => entry.char).join(""),
    align: content.align,
    chars,
  };
}
