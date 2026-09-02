import { flattenRichText } from "../text/richText.ts";
import type { MessageToken } from "./types.ts";
import type { RichText, RichTextSpan, TextAlign, WindowTextContent } from "../text/types.ts";

export interface FlatCharStyle {
  readonly fontKey?: string;
  readonly fontSize?: number;
}

function stylesEqual(left: FlatCharStyle, right: FlatCharStyle): boolean {
  return left.fontKey === right.fontKey && left.fontSize === right.fontSize;
}

function styleToSpan(text: string, style: FlatCharStyle): RichTextSpan {
  return {
    text,
    ...(style.fontKey !== undefined ? { fontKey: style.fontKey } : {}),
    ...(style.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
  };
}

/** Maps each UTF-16 code unit in raw text to span style from RichText. */
export function buildRawIndexStyles(
  content: WindowTextContent,
  rawText: string,
): FlatCharStyle[] {
  const styles: FlatCharStyle[] = Array.from({ length: rawText.length }, () => ({}));
  const { chars } = flattenRichText(content);
  for (const entry of chars) {
    const style: FlatCharStyle = {
      ...(entry.fontKey !== undefined ? { fontKey: entry.fontKey } : {}),
      ...(entry.fontSize !== undefined ? { fontSize: entry.fontSize } : {}),
    };
    styles[entry.sourceIndex] = style;
    const codePoint = entry.char.codePointAt(0);
    if (codePoint !== undefined && codePoint > 0xffff) {
      styles[entry.sourceIndex + 1] = style;
    }
  }
  return styles;
}

/** Collects per-glyph styles aligned with `buildFlatTextFromTokens(pageTokens)`. */
export function collectPageFlatStyles(
  pageTokens: readonly MessageToken[],
  content: WindowTextContent,
): FlatCharStyle[] {
  const rawText = typeof content === "string" ? content : flattenRichText(content).text;
  const styleByRawIndex = buildRawIndexStyles(content, rawText);
  const styles: FlatCharStyle[] = [];

  for (const token of pageTokens) {
    if (token.type === "text") {
      for (let index = 0; index < token.value.length; index += 1) {
        styles.push(styleByRawIndex[token.start + index] ?? {});
      }
    } else if (token.type === "newline") {
      styles.push({});
    }
  }

  return styles;
}

/** Builds RichText spans from flat text and per-code-unit styles, merging consecutive matches. */
export function richTextFromFlat(
  flatText: string,
  styles: readonly FlatCharStyle[],
  align?: TextAlign,
): RichText {
  if (flatText.length === 0) {
    return align !== undefined ? { spans: [], align } : { spans: [] };
  }

  const spans: RichTextSpan[] = [];
  let spanStart = 0;
  let currentStyle = styles[0] ?? {};

  for (let index = 1; index <= flatText.length; index += 1) {
    const nextStyle = index < flatText.length ? (styles[index] ?? {}) : null;
    if (nextStyle === null || !stylesEqual(currentStyle, nextStyle)) {
      spans.push(styleToSpan(flatText.slice(spanStart, index), currentStyle));
      spanStart = index;
      currentStyle = nextStyle ?? {};
    }
  }

  return {
    spans,
    ...(align !== undefined ? { align } : {}),
  };
}
