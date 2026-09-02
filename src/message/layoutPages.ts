import type { LayoutLine } from "../text/types.ts";
import type { MessageToken } from "./types.ts";

/** Source indices where TextLayout starts a new page due to content height. */
export function computeLayoutPageBreaks(lines: readonly LayoutLine[]): number[] {
  const breaks: number[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const previous = lines[index - 1];
    const current = lines[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      current.pageIndex > previous.pageIndex
    ) {
      breaks.push(current.sourceRange.start);
    }
  }
  return breaks;
}

/** Splits parsed tokens into explicit `\f` page segments. */
export function splitTokensByExplicitPage(tokens: readonly MessageToken[]): MessageToken[][] {
  const pages: MessageToken[][] = [[]];
  for (const token of tokens) {
    if (token.type === "pageBreak") {
      pages.push([]);
      continue;
    }
    pages[pages.length - 1]?.push(token);
  }
  return pages;
}

/** Builds layout input text for one explicit page segment. */
export function buildFlatTextFromTokens(tokens: readonly MessageToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "text") {
        return token.value;
      }
      if (token.type === "newline") {
        return "\n";
      }
      return "";
    })
    .join("");
}

export function getExplicitPageStartTokenIndex(
  tokens: readonly MessageToken[],
  pageIndex: number,
): number {
  if (pageIndex <= 0) {
    return 0;
  }
  let page = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (page === pageIndex) {
      return index;
    }
    if (tokens[index]?.type === "pageBreak") {
      page += 1;
    }
  }
  return tokens.length;
}

/** Flat source index within one explicit page segment (excludes `\f` from other pages). */
export function getFlatSourceIndexInExplicitPage(
  tokens: readonly MessageToken[],
  tokenIndex: number,
  graphemeOffset: number,
  pageIndex: number,
): number {
  const pageStart = getExplicitPageStartTokenIndex(tokens, pageIndex);
  if (tokenIndex < pageStart) {
    return 0;
  }
  let index = 0;
  for (let i = pageStart; i < tokenIndex; i += 1) {
    const token = tokens[i];
    if (token === undefined) {
      continue;
    }
    if (token.type === "text") {
      index += token.value.length;
    } else if (token.type === "newline") {
      index += 1;
    }
  }
  const current = tokens[tokenIndex];
  if (current?.type === "text") {
    index += graphemeOffset;
  }
  return index;
}
