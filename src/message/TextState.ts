import type { MessageToken } from "./types.ts";
import { getFlatSourceIndexInExplicitPage } from "./layoutPages.ts";

export interface TextState {
  readonly tokenIndex: number;
  readonly graphemeOffset: number;
  readonly pageIndex: number;
  readonly layoutPageIndex: number;
  readonly revealAccumulator: number;
  readonly waitRemainingMs: number;
  readonly pausedForAdvance: boolean;
  readonly completed: boolean;
}

export type TextStateEffect =
  | { readonly type: "pageChanged"; readonly pageIndex: number; readonly layoutPageIndex: number }
  | { readonly type: "completed" };

export interface TextStateStepResult {
  readonly state: TextState;
  readonly effects: readonly TextStateEffect[];
}

export interface TextStateInput {
  readonly deltaMs?: number;
  readonly advance?: boolean;
  readonly confirm?: boolean;
  readonly skip?: boolean;
}

export interface TextStateOptions {
  readonly layoutPageBreaksByPage?: readonly (readonly number[])[];
}

const INITIAL_STATE: TextState = {
  tokenIndex: 0,
  graphemeOffset: 0,
  pageIndex: 0,
  layoutPageIndex: 0,
  revealAccumulator: 0,
  waitRemainingMs: 0,
  pausedForAdvance: false,
  completed: false,
};

export function createInitialTextState(): TextState {
  return { ...INITIAL_STATE };
}

export function reduceTextState(
  tokens: readonly MessageToken[],
  previous: TextState,
  input: TextStateInput,
  charsPerSecond: number,
  options: TextStateOptions = {},
): TextStateStepResult {
  if (previous.completed) {
    return { state: previous, effects: [] };
  }
  if (!Number.isFinite(charsPerSecond) || charsPerSecond <= 0) {
    throw new Error("charsPerSecond must be a positive finite number.");
  }

  const layoutPageBreaksByPage = options.layoutPageBreaksByPage ?? [];
  let state = { ...previous };
  const effects: TextStateEffect[] = [];

  if (input.skip === true || input.confirm === true) {
    state = skipToNextAdvancePoint(tokens, state, layoutPageBreaksByPage);
  }

  if (input.advance === true) {
    if (!state.pausedForAdvance && requiresAdvanceInput(tokens, state, layoutPageBreaksByPage)) {
      state = { ...state, pausedForAdvance: true };
    }
    if (state.pausedForAdvance) {
      state = advanceAfterPause(tokens, state, effects, layoutPageBreaksByPage);
    }
  }

  const deltaMs = input.deltaMs ?? 0;
  if (deltaMs > 0 && !state.pausedForAdvance && !state.completed) {
    state = progressTimed(tokens, state, deltaMs, charsPerSecond, layoutPageBreaksByPage);
  }

  if (state.tokenIndex >= tokens.length && !state.completed) {
    state = { ...state, completed: true, pausedForAdvance: false };
    effects.push({ type: "completed" });
  }

  return { state, effects };
}

function resolveCharsPerSecond(
  tokens: readonly MessageToken[],
  tokenIndex: number,
  fallback: number,
): number {
  let speed = fallback;
  for (let index = 0; index < tokenIndex; index += 1) {
    const token = tokens[index];
    if (token?.type === "speed") {
      speed = token.charsPerSecond;
    }
  }
  return speed;
}

function getLayoutBreaksForPage(
  layoutPageBreaksByPage: readonly (readonly number[])[],
  pageIndex: number,
): readonly number[] {
  return layoutPageBreaksByPage[pageIndex] ?? [];
}

function progressTimed(
  tokens: readonly MessageToken[],
  state: TextState,
  deltaMs: number,
  charsPerSecond: number,
  layoutPageBreaksByPage: readonly (readonly number[])[],
): TextState {
  let current = { ...state };
  let remainingDelta = deltaMs;

  while (remainingDelta > 0 && !current.pausedForAdvance && !current.completed) {
    const token = tokens[current.tokenIndex];
    if (token === undefined) {
      break;
    }

    if (token.type === "wait") {
      const nextWait = current.waitRemainingMs > 0 ? current.waitRemainingMs : token.ms;
      if (nextWait > remainingDelta) {
        current = { ...current, waitRemainingMs: nextWait - remainingDelta };
        remainingDelta = 0;
      } else {
        remainingDelta -= nextWait;
        current = {
          ...current,
          waitRemainingMs: 0,
          tokenIndex: current.tokenIndex + 1,
        };
      }
      continue;
    }

    if (token.type === "color" || token.type === "speed") {
      current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
      continue;
    }

    if (token.type === "newline") {
      current = {
        ...current,
        tokenIndex: current.tokenIndex + 1,
        graphemeOffset: 0,
      };
      current = applyLayoutPagePause(tokens, current, layoutPageBreaksByPage);
      continue;
    }

    if (token.type === "pause" || token.type === "pageBreak") {
      current = { ...current, pausedForAdvance: true };
      break;
    }

    if (token.type === "text") {
      const graphemes = [...token.value];
      if (current.graphemeOffset >= graphemes.length) {
        current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
        continue;
      }
      const msPerChar = 1000 / resolveCharsPerSecond(tokens, current.tokenIndex, charsPerSecond);
      current = {
        ...current,
        revealAccumulator: current.revealAccumulator + remainingDelta,
      };
      while (
        current.revealAccumulator >= msPerChar &&
        current.graphemeOffset < graphemes.length &&
        !current.pausedForAdvance
      ) {
        current = {
          ...current,
          revealAccumulator: current.revealAccumulator - msPerChar,
          graphemeOffset: current.graphemeOffset + 1,
        };
        current = applyLayoutPagePause(tokens, current, layoutPageBreaksByPage);
      }
      if (current.graphemeOffset >= graphemes.length && !current.pausedForAdvance) {
        current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
      }
      remainingDelta = 0;
      continue;
    }
  }

  return current;
}

function advanceAfterPause(
  tokens: readonly MessageToken[],
  state: TextState,
  effects: TextStateEffect[],
  layoutPageBreaksByPage: readonly (readonly number[])[],
): TextState {
  const token = tokens[state.tokenIndex];
  if (token === undefined) {
    return { ...state, completed: true, pausedForAdvance: false };
  }
  if (token.type === "pageBreak") {
    const pageIndex = state.pageIndex + 1;
    effects.push({ type: "pageChanged", pageIndex, layoutPageIndex: 0 });
    return {
      ...state,
      tokenIndex: state.tokenIndex + 1,
      pageIndex,
      layoutPageIndex: 0,
      graphemeOffset: 0,
      pausedForAdvance: false,
    };
  }
  if (token.type === "pause") {
    return {
      ...state,
      tokenIndex: state.tokenIndex + 1,
      graphemeOffset: 0,
      pausedForAdvance: false,
    };
  }
  const layoutPageBreaks = getLayoutBreaksForPage(layoutPageBreaksByPage, state.pageIndex);
  const boundary = layoutPageBreaks[state.layoutPageIndex];
  if (
    boundary !== undefined &&
    getFlatSourceIndexInExplicitPage(
      tokens,
      state.tokenIndex,
      state.graphemeOffset,
      state.pageIndex,
    ) >= boundary
  ) {
    const layoutPageIndex = state.layoutPageIndex + 1;
    effects.push({
      type: "pageChanged",
      pageIndex: state.pageIndex,
      layoutPageIndex,
    });
    return {
      ...state,
      layoutPageIndex,
      pausedForAdvance: false,
    };
  }
  return { ...state, pausedForAdvance: false };
}

function skipToNextAdvancePoint(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[],
): TextState {
  let current = { ...state, revealAccumulator: 0, waitRemainingMs: 0, pausedForAdvance: false };
  while (current.tokenIndex < tokens.length && !current.pausedForAdvance) {
    const token = tokens[current.tokenIndex];
    if (token === undefined) {
      break;
    }
    if (token.type === "wait") {
      current = { ...current, tokenIndex: current.tokenIndex + 1, waitRemainingMs: 0 };
      continue;
    }
    if (token.type === "color" || token.type === "speed") {
      current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
      continue;
    }
    if (token.type === "newline") {
      current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
      current = applyLayoutPagePause(tokens, current, layoutPageBreaksByPage);
      continue;
    }
    if (token.type === "pause" || token.type === "pageBreak") {
      current = { ...current, pausedForAdvance: true };
      break;
    }
    if (token.type === "text") {
      const layoutPageBreaks = getLayoutBreaksForPage(layoutPageBreaksByPage, current.pageIndex);
      const boundary = layoutPageBreaks[current.layoutPageIndex];
      if (boundary !== undefined) {
        const flatStart = getFlatSourceIndexInExplicitPage(
          tokens,
          current.tokenIndex,
          0,
          current.pageIndex,
        );
        const room = boundary - flatStart;
        if (room <= 0) {
          current = { ...current, pausedForAdvance: true };
          break;
        }
        const nextOffset = Math.min(token.value.length, room);
        current = { ...current, graphemeOffset: nextOffset };
        if (nextOffset >= token.value.length) {
          current = { ...current, tokenIndex: current.tokenIndex + 1, graphemeOffset: 0 };
        }
        current = applyLayoutPagePause(tokens, current, layoutPageBreaksByPage);
        continue;
      }
      current = {
        ...current,
        graphemeOffset: token.value.length,
        tokenIndex: current.tokenIndex + 1,
      };
      continue;
    }
  }
  return current;
}

/** @deprecated Use getFlatSourceIndexInExplicitPage for layout paging. */
export function getFlatSourceIndex(
  tokens: readonly MessageToken[],
  tokenIndex: number,
  graphemeOffset: number,
): number {
  return getFlatSourceIndexInExplicitPage(tokens, tokenIndex, graphemeOffset, 0);
}

function applyLayoutPagePause(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[],
): TextState {
  const layoutPageBreaks = getLayoutBreaksForPage(layoutPageBreaksByPage, state.pageIndex);
  if (layoutPageBreaks.length === 0) {
    return state;
  }
  const boundary = layoutPageBreaks[state.layoutPageIndex];
  if (boundary === undefined) {
    return state;
  }
  const sourceIndex = getFlatSourceIndexInExplicitPage(
    tokens,
    state.tokenIndex,
    state.graphemeOffset,
    state.pageIndex,
  );
  if (sourceIndex >= boundary) {
    return { ...state, pausedForAdvance: true };
  }
  return state;
}

function isPausedForLayoutPage(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[],
): boolean {
  if (!state.pausedForAdvance) {
    return false;
  }
  const token = tokens[state.tokenIndex];
  if (token?.type === "pause" || token?.type === "pageBreak") {
    return false;
  }
  const layoutPageBreaks = getLayoutBreaksForPage(layoutPageBreaksByPage, state.pageIndex);
  const boundary = layoutPageBreaks[state.layoutPageIndex];
  if (boundary === undefined) {
    return false;
  }
  return (
    getFlatSourceIndexInExplicitPage(
      tokens,
      state.tokenIndex,
      state.graphemeOffset,
      state.pageIndex,
    ) >= boundary
  );
}

export function getRevealedText(tokens: readonly MessageToken[], state: TextState): string {
  let output = "";
  for (let index = 0; index < tokens.length; index += 1) {
    if (index > state.tokenIndex) {
      break;
    }
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.type === "text") {
      if (index < state.tokenIndex) {
        output += token.value;
      } else {
        output += token.value.slice(0, state.graphemeOffset);
      }
    } else if (token.type === "newline") {
      if (index < state.tokenIndex) {
        output += "\n";
      }
    } else if (token.type === "pageBreak" && index < state.tokenIndex) {
      output += "\f";
    }
  }
  return output;
}

export function getRevealedPageText(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[] = [],
): string {
  return getRevealedPageGlyphs(tokens, state, layoutPageBreaksByPage)
    .map((glyph) => glyph.char)
    .join("");
}

export function getRevealedPageColors(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[] = [],
): readonly (number | null)[] {
  return getRevealedPageGlyphs(tokens, state, layoutPageBreaksByPage).map((glyph) => glyph.color);
}

function getRevealedPageGlyphs(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[],
): readonly { char: string; color: number | null }[] {
  const glyphs = getRevealedGlyphsInExplicitPage(tokens, state);
  const layoutPageBreaks = getLayoutBreaksForPage(layoutPageBreaksByPage, state.pageIndex);
  const start =
    state.layoutPageIndex === 0 ? 0 : (layoutPageBreaks[state.layoutPageIndex - 1] ?? glyphs.length);
  const end = layoutPageBreaks[state.layoutPageIndex] ?? glyphs.length;
  return glyphs.slice(start, Math.min(glyphs.length, end));
}

function getRevealedGlyphsInExplicitPage(
  tokens: readonly MessageToken[],
  state: TextState,
): { char: string; color: number | null }[] {
  const glyphs: { char: string; color: number | null }[] = [];
  let page = 0;
  let color: number | null = null;
  for (let index = 0; index < tokens.length; index += 1) {
    if (index > state.tokenIndex) {
      break;
    }
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.type === "pageBreak") {
      page += 1;
      continue;
    }
    if (token.type === "color") {
      if (index < state.tokenIndex) {
        color = token.color;
      }
      continue;
    }
    if (token.type === "speed" || token.type === "wait" || token.type === "pause") {
      continue;
    }
    if (page !== state.pageIndex) {
      continue;
    }
    if (token.type === "text") {
      const value =
        index < state.tokenIndex ? token.value : token.value.slice(0, state.graphemeOffset);
      for (const char of value) {
        glyphs.push({ char, color });
      }
    } else if (token.type === "newline" && index < state.tokenIndex) {
      glyphs.push({ char: "\n", color });
    }
  }
  return glyphs;
}

export function requiresAdvanceInput(
  tokens: readonly MessageToken[],
  state: TextState,
  layoutPageBreaksByPage: readonly (readonly number[])[] = [],
): boolean {
  const token = tokens[state.tokenIndex];
  if (token?.type === "pause" || token?.type === "pageBreak") {
    return true;
  }
  return isPausedForLayoutPage(tokens, state, layoutPageBreaksByPage);
}
