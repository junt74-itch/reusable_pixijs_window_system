import { adaptBitmapTextMeasurer, uniqueFontKeys, type ResolvedBitmapTextMeasurer } from "./adaptBitmapTextMeasurer.ts";
import { flattenRichText, resolveRichTextAlign } from "./richText.ts";
import { scaleFontMetrics } from "./fontMetrics.ts";
import type {
  BitmapTextMeasurer,
  BitmapTextMeasureStyle,
  FlattenedRichChar,
  LayoutLine,
  LayoutLineRun,
  TextAlign,
  TextLayoutOptions,
  TextLayoutResult,
  WindowTextContent,
} from "./types.ts";
import { BitmapFontNotLoadedError, MissingBitmapGlyphError } from "./types.ts";
import { assertMeasurerHasGlyphs } from "./fontFallback.ts";

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

interface StyledChar {
  readonly sourceIndex: number;
  readonly char: string;
  readonly fontKey: string;
  readonly fontSize: number;
}

interface StyleRunSegment {
  readonly text: string;
  readonly fontKey: string;
  readonly fontSize: number;
}

function splitGraphemes(text: string): string[] {
  if (segmenter !== null) {
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return [...text];
}

function tokenizeWords(paragraph: string): Array<{ text: string }> {
  const parts = paragraph.split(/(\s+)/);
  return parts.filter((part) => part.length > 0).map((text) => ({ text }));
}

function charIndexAtUtf16Start(chars: readonly StyledChar[], utf16Pos: number): number {
  let offset = 0;
  for (let index = 0; index < chars.length; index += 1) {
    if (utf16Pos <= offset) {
      return index;
    }
    offset += chars[index]?.char.length ?? 0;
  }
  return chars.length;
}

function charIndexAtUtf16End(chars: readonly StyledChar[], utf16End: number): number {
  let offset = 0;
  for (let index = 0; index < chars.length; index += 1) {
    offset += chars[index]?.char.length ?? 0;
    if (utf16End <= offset) {
      return index + 1;
    }
  }
  return chars.length;
}

function graphemeEndCharIndex(chars: readonly StyledChar[], startIdx: number, endIdx: number): number {
  const tokenText = chars
    .slice(startIdx, endIdx)
    .map((entry) => entry.char)
    .join("");
  const firstGrapheme = splitGraphemes(tokenText)[0] ?? "";
  let built = "";
  let index = startIdx;
  while (index < endIdx) {
    built += chars[index]?.char ?? "";
    index += 1;
    if (built === firstGrapheme) {
      return index;
    }
  }
  return endIdx;
}

function validateLayoutOptions(options: TextLayoutOptions): void {
  if (options.width <= 0 || options.height <= 0) {
    throw new Error("Layout width and height must be positive.");
  }
  if (options.lineSpacing < 0 || !Number.isFinite(options.lineSpacing)) {
    throw new Error("lineSpacing must be a non-negative finite number.");
  }
  if (!Number.isInteger(options.style.scale) || options.style.scale <= 0) {
    throw new Error("style.scale must be a positive integer.");
  }
}

function isStructuralChar(char: string): boolean {
  return char === "\n" || char === "\f";
}

function resolveCharFontKey(
  specified: string | undefined,
  char: string,
  sourceIndex: number,
  measurer: ResolvedBitmapTextMeasurer,
): string {
  if (specified !== undefined && !measurer.fontKeys.includes(specified)) {
    throw new BitmapFontNotLoadedError(specified);
  }
  if (isStructuralChar(char)) {
    return specified ?? measurer.fontKey;
  }
  const chain = uniqueFontKeys(specified !== undefined ? [specified, ...measurer.fontKeys] : [...measurer.fontKeys]);
  const codePoint = char.codePointAt(0) ?? 0;
  for (const key of chain) {
    if (measurer.hasGlyphFor(key, codePoint)) {
      return key;
    }
  }
  throw new MissingBitmapGlyphError(specified ?? measurer.fontKey, codePoint, char, sourceIndex, chain);
}

function resolveStyledChars(
  chars: readonly FlattenedRichChar[],
  measurer: ResolvedBitmapTextMeasurer,
  defaultStyle: BitmapTextMeasureStyle,
): StyledChar[] {
  return chars.map((entry) => ({
    sourceIndex: entry.sourceIndex,
    char: entry.char,
    fontKey: resolveCharFontKey(entry.fontKey, entry.char, entry.sourceIndex, measurer),
    fontSize: entry.fontSize ?? defaultStyle.fontSize,
  }));
}

function groupStyleRuns(chars: readonly StyledChar[], start: number, end: number): StyleRunSegment[] {
  const runs: StyleRunSegment[] = [];
  let index = start;
  while (index < end) {
    const current = chars[index];
    if (current === undefined) {
      break;
    }
    let next = index + 1;
    while (next < end) {
      const candidate = chars[next];
      if (
        candidate === undefined ||
        candidate.fontKey !== current.fontKey ||
        candidate.fontSize !== current.fontSize
      ) {
        break;
      }
      next += 1;
    }
    runs.push({
      text: chars
        .slice(index, next)
        .map((entry) => entry.char)
        .join(""),
      fontKey: current.fontKey,
      fontSize: current.fontSize,
    });
    index = next;
  }
  return runs;
}

function measureStyledChars(
  chars: readonly StyledChar[],
  start: number,
  end: number,
  measurer: ResolvedBitmapTextMeasurer,
  baseStyle: BitmapTextMeasureStyle,
): number {
  if (start >= end) {
    return 0;
  }
  const runs = groupStyleRuns(chars, start, end);
  let width = 0;
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    if (run === undefined) {
      continue;
    }
    width += measurer.measureRun(run.text, {
      fontKey: run.fontKey,
      fontSize: run.fontSize,
      scale: baseStyle.scale,
      letterSpacing: baseStyle.letterSpacing,
    }).width;
    if (index < runs.length - 1 && baseStyle.letterSpacing !== 0) {
      width += baseStyle.letterSpacing * baseStyle.scale;
    }
  }
  return width;
}

function defaultLineMetrics(
  measurer: ResolvedBitmapTextMeasurer,
  defaultStyle: BitmapTextMeasureStyle,
): { ascent: number; descent: number; height: number } {
  const metrics = scaleFontMetrics(measurer.fontMetrics(defaultStyle.fontKey), defaultStyle.fontSize, defaultStyle.scale);
  return { ascent: metrics.ascent, descent: metrics.descent, height: metrics.height };
}

function computeLineMetrics(
  runs: readonly StyleRunSegment[],
  measurer: ResolvedBitmapTextMeasurer,
  defaultStyle: BitmapTextMeasureStyle,
): { ascent: number; descent: number; height: number } {
  if (runs.length === 0) {
    return defaultLineMetrics(measurer, defaultStyle);
  }
  let lineAscent = 0;
  let lineDescent = 0;
  for (const run of runs) {
    const metrics = scaleFontMetrics(measurer.fontMetrics(run.fontKey), run.fontSize, defaultStyle.scale);
    lineAscent = Math.max(lineAscent, metrics.ascent);
    lineDescent = Math.max(lineDescent, metrics.descent);
  }
  return { ascent: lineAscent, descent: lineDescent, height: lineAscent + lineDescent };
}

function computeAlignOffset(align: TextAlign, lineWidth: number, availableWidth: number): number {
  if (lineWidth > availableWidth) {
    return 0;
  }
  if (align === "center") {
    return Math.trunc((availableWidth - lineWidth) / 2);
  }
  if (align === "right") {
    return availableWidth - lineWidth;
  }
  return 0;
}

function buildLayoutRuns(
  runs: readonly StyleRunSegment[],
  measurer: ResolvedBitmapTextMeasurer,
  baseStyle: BitmapTextMeasureStyle,
  lineXOffset: number,
): { runs: LayoutLineRun[]; width: number } {
  const layoutRuns: LayoutLineRun[] = [];
  let width = 0;
  let x = lineXOffset;
  for (let index = 0; index < runs.length; index += 1) {
    const run = runs[index];
    if (run === undefined) {
      continue;
    }
    const measured = measurer.measureRun(run.text, {
      fontKey: run.fontKey,
      fontSize: run.fontSize,
      scale: baseStyle.scale,
      letterSpacing: baseStyle.letterSpacing,
    });
    layoutRuns.push({
      text: run.text,
      fontKey: run.fontKey,
      fontSize: run.fontSize,
      width: measured.width,
      x,
    });
    width += measured.width;
    if (index < runs.length - 1) {
      if (baseStyle.letterSpacing !== 0) {
        width += baseStyle.letterSpacing * baseStyle.scale;
      }
      x = lineXOffset + width;
    }
  }
  return { runs: layoutRuns, width };
}

function emptyLine(
  sourceStart: number,
  align: TextAlign,
  measurer: ResolvedBitmapTextMeasurer,
  options: TextLayoutOptions,
): LayoutLine {
  const metrics = defaultLineMetrics(measurer, options.style);
  return {
    text: "",
    sourceRange: { start: sourceStart, end: sourceStart },
    width: 0,
    y: 0,
    height: metrics.height,
    ascent: metrics.ascent,
    pageIndex: 0,
    align,
    runs: [],
  };
}

function finalizeLine(
  chars: readonly StyledChar[],
  start: number,
  end: number,
  align: TextAlign,
  measurer: ResolvedBitmapTextMeasurer,
  options: TextLayoutOptions,
): LayoutLine {
  const runs = groupStyleRuns(chars, start, end);
  const text =
    start >= end
      ? ""
      : chars
          .slice(start, end)
          .map((entry) => entry.char)
          .join("");
  const sourceStart = start >= end ? (chars[start]?.sourceIndex ?? 0) : (chars[start]?.sourceIndex ?? 0);
  const sourceEnd =
    start >= end
      ? sourceStart
      : (chars[end - 1]?.sourceIndex ?? sourceStart) + (chars[end - 1]?.char.length ?? 0);
  const { runs: layoutRuns, width } = buildLayoutRuns(runs, measurer, options.style, 0);
  const lineXOffset = computeAlignOffset(align, width, options.width);
  const alignedRuns =
    lineXOffset === 0
      ? layoutRuns
      : buildLayoutRuns(runs, measurer, options.style, lineXOffset).runs;
  const metrics = computeLineMetrics(runs, measurer, options.style);
  return {
    text,
    sourceRange: { start: sourceStart, end: sourceEnd },
    width,
    y: 0,
    height: metrics.height,
    ascent: metrics.ascent,
    pageIndex: 0,
    align,
    runs: alignedRuns,
  };
}

function wrapLongTokenRich(
  chars: readonly StyledChar[],
  startIdx: number,
  endIdx: number,
  measurer: ResolvedBitmapTextMeasurer,
  options: TextLayoutOptions,
  align: TextAlign,
  maxWidth: number,
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let lineStartIdx = startIdx;
  let lineEndIdx = startIdx;
  let charIdx = startIdx;

  while (charIdx < endIdx) {
    const graphemeEndIdx = graphemeEndCharIndex(chars, charIdx, endIdx);
    const candidateStartIdx = lineEndIdx === lineStartIdx ? charIdx : lineStartIdx;
    const width = measureStyledChars(chars, candidateStartIdx, graphemeEndIdx, measurer, options.style);
    if (width <= maxWidth || lineEndIdx === lineStartIdx) {
      if (lineEndIdx === lineStartIdx) {
        lineStartIdx = charIdx;
      }
      lineEndIdx = graphemeEndIdx;
    } else {
      lines.push(finalizeLine(chars, lineStartIdx, lineEndIdx, align, measurer, options));
      lineStartIdx = charIdx;
      lineEndIdx = graphemeEndIdx;
    }
    charIdx = graphemeEndIdx;
  }

  if (lineEndIdx > lineStartIdx) {
    lines.push(finalizeLine(chars, lineStartIdx, lineEndIdx, align, measurer, options));
  }

  return lines;
}

function wrapRichParagraph(
  paragraphChars: readonly StyledChar[],
  measurer: ResolvedBitmapTextMeasurer,
  options: TextLayoutOptions,
  align: TextAlign,
  maxWidth: number,
): LayoutLine[] {
  const paragraphText = paragraphChars.map((entry) => entry.char).join("");
  const tokens = tokenizeWords(paragraphText);
  const lines: LayoutLine[] = [];
  let lineStartIdx = 0;
  let lineEndIdx = 0;
  let utf16Offset = 0;
  let nextLineStartIdx = 0;

  const flush = (): void => {
    lines.push(finalizeLine(paragraphChars, lineStartIdx, lineEndIdx, align, measurer, options));
    lineStartIdx = nextLineStartIdx;
    lineEndIdx = nextLineStartIdx;
  };

  for (const token of tokens) {
    const tokenStartIdx = charIndexAtUtf16Start(paragraphChars, utf16Offset);
    utf16Offset += token.text.length;
    const tokenEndIdx = charIndexAtUtf16End(paragraphChars, utf16Offset);
    nextLineStartIdx = tokenEndIdx;
    const candidateStartIdx = lineEndIdx === lineStartIdx ? tokenStartIdx : lineStartIdx;
    const candidateEndIdx = tokenEndIdx;
    const width = measureStyledChars(paragraphChars, candidateStartIdx, candidateEndIdx, measurer, options.style);
    if (width <= maxWidth || lineEndIdx === lineStartIdx) {
      if (lineEndIdx === lineStartIdx) {
        lineStartIdx = tokenStartIdx;
      }
      lineEndIdx = candidateEndIdx;
      const acceptedWidth = measureStyledChars(
        paragraphChars,
        lineStartIdx,
        lineEndIdx,
        measurer,
        options.style,
      );
      if (
        acceptedWidth > maxWidth &&
        lineStartIdx === tokenStartIdx &&
        lineEndIdx === tokenEndIdx
      ) {
        const graphemeLines = wrapLongTokenRich(
          paragraphChars,
          tokenStartIdx,
          tokenEndIdx,
          measurer,
          options,
          align,
          maxWidth,
        );
        for (const line of graphemeLines) {
          lines.push(line);
        }
        lineStartIdx = tokenEndIdx;
        lineEndIdx = tokenEndIdx;
        nextLineStartIdx = tokenEndIdx;
        continue;
      }
    } else {
      flush();
      lineStartIdx = tokenStartIdx;
      lineEndIdx = tokenEndIdx;
      const tokenWidth = measureStyledChars(paragraphChars, lineStartIdx, lineEndIdx, measurer, options.style);
      if (tokenWidth > maxWidth) {
        const graphemeLines = wrapLongTokenRich(
          paragraphChars,
          lineStartIdx,
          lineEndIdx,
          measurer,
          options,
          align,
          maxWidth,
        );
        for (const line of graphemeLines) {
          lines.push(line);
        }
        lineStartIdx = tokenEndIdx;
        lineEndIdx = tokenEndIdx;
        nextLineStartIdx = tokenEndIdx;
      }
    }
  }

  if (lineEndIdx > lineStartIdx || lines.length === 0) {
    flush();
  }

  return lines;
}

function assignPages(lines: LayoutLine[], options: TextLayoutOptions): LayoutLine[] {
  if (lines.length === 0) {
    return lines;
  }
  let pageIndex = 0;
  let yInPage = 0;
  const placed: LayoutLine[] = [];
  for (const line of lines) {
    const lineStep = line.height + options.lineSpacing;
    if (yInPage > 0 && yInPage + lineStep > options.height) {
      pageIndex += 1;
      yInPage = 0;
    }
    placed.push({
      ...line,
      y: yInPage,
      pageIndex,
    });
    yInPage += lineStep;
  }
  return placed;
}

/**
 * Greedy style-aware bitmap-font layout without Phaser dependencies.
 * MVP does not implement Japanese kinsoku rules.
 */
export function layoutRichText(
  content: WindowTextContent,
  measurer: BitmapTextMeasurer,
  options: TextLayoutOptions,
): TextLayoutResult {
  validateLayoutOptions(options);
  const resolved = adaptBitmapTextMeasurer(measurer);
  const align = resolveRichTextAlign(content, options.align ?? "left");
  const flattened = flattenRichText(content);
  const styledChars = resolveStyledChars(flattened.chars, resolved, options.style);

  const paragraphs: StyledChar[][] = [];
  let currentParagraph: StyledChar[] = [];
  for (const entry of styledChars) {
    if (entry.char === "\n") {
      paragraphs.push(currentParagraph);
      currentParagraph = [];
      continue;
    }
    currentParagraph.push(entry);
  }
  paragraphs.push(currentParagraph);

  for (const paragraph of paragraphs) {
    const paragraphText = paragraph.map((entry) => entry.char).join("");
    assertMeasurerHasGlyphs(paragraphText, resolved);
  }

  const rawLines: LayoutLine[] = [];
  let sourceCursor = 0;

  for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
    const paragraph = paragraphs[paragraphIndex] ?? [];
    const paragraphStart = sourceCursor;
    if (paragraph.length === 0) {
      rawLines.push(emptyLine(paragraphStart, align, resolved, options));
    } else {
      const wrapped = wrapRichParagraph(paragraph, resolved, options, align, options.width);
      rawLines.push(...wrapped);
    }
    sourceCursor += paragraph.map((entry) => entry.char).join("").length;
    if (paragraphIndex < paragraphs.length - 1) {
      sourceCursor += 1;
    }
  }

  const lines = assignPages(rawLines, options);
  const pageCount = lines.length === 0 ? 1 : (lines[lines.length - 1]?.pageIndex ?? 0) + 1;
  return { lines, pageCount };
}

/**
 * Greedy bitmap-font-aware text layout without Phaser dependencies.
 * MVP does not implement Japanese kinsoku rules.
 */
export function layoutText(text: string, measurer: BitmapTextMeasurer, options: TextLayoutOptions): TextLayoutResult {
  return layoutRichText(text, measurer, options);
}
