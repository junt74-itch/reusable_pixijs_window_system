import { describe, expect, test } from "bun:test";
import {
  createInitialTextState,
  getRevealedPageText,
  reduceTextState,
  requiresAdvanceInput,
} from "../../src/message/TextState.ts";
import {
  getFlatSourceIndexInExplicitPage,
  splitTokensByExplicitPage,
} from "../../src/message/layoutPages.ts";
import type { MessageToken } from "../../src/message/types.ts";

const tokens: MessageToken[] = [
  { type: "text", value: "Line1", start: 0, end: 5 },
  { type: "newline", start: 5, end: 6 },
  { type: "text", value: "Line2", start: 6, end: 11 },
  { type: "pageBreak", start: 11, end: 12 },
  { type: "text", value: "Page2", start: 12, end: 17 },
];

describe("TextState", () => {
  test("newline advances without waiting for confirm", () => {
    let state = createInitialTextState();
    for (let step = 0; step < 20; step += 1) {
      const result = reduceTextState(tokens, state, { deltaMs: 16 }, 60);
      state = result.state;
      if (state.tokenIndex >= 2) {
        break;
      }
    }
    expect(state.pausedForAdvance).toBe(false);
    expect(state.tokenIndex).toBeGreaterThanOrEqual(2);
  });

  test("page break waits for advance and switches page text", () => {
    let state = createInitialTextState();
    while (!state.pausedForAdvance && !state.completed) {
      const result = reduceTextState(tokens, state, { deltaMs: 32 }, 120);
      state = result.state;
    }
    expect(requiresAdvanceInput(tokens, state)).toBe(true);
    const advanced = reduceTextState(tokens, state, { advance: true }, 120);
    state = advanced.state;
    expect(state.pageIndex).toBe(1);
    expect(getRevealedPageText(tokens, state)).toBe("");
  });

  test("completes automatically after final token", () => {
    let state = createInitialTextState();
    while (!state.completed) {
      const result = reduceTextState(tokens, state, { deltaMs: 50, advance: state.pausedForAdvance }, 120);
      state = result.state.pausedForAdvance
        ? reduceTextState(tokens, result.state, { advance: true }, 120).state
        : result.state;
    }
    expect(state.completed).toBe(true);
  });

  test("layout page break pauses and advances within the same explicit page", () => {
    const longTokens: MessageToken[] = [
      { type: "text", value: "ABCDEFGHIJklmnop", start: 0, end: 16 },
    ];
    const layoutPageBreaksByPage = [[10]];
    let state = createInitialTextState();
    while (!state.pausedForAdvance && !state.completed) {
      state = reduceTextState(longTokens, state, { deltaMs: 16 }, 120, { layoutPageBreaksByPage }).state;
    }
    expect(getFlatSourceIndexInExplicitPage(longTokens, state.tokenIndex, state.graphemeOffset, 0)).toBe(10);
    expect(getRevealedPageText(longTokens, state, layoutPageBreaksByPage)).toBe("ABCDEFGHIJ");
    state = reduceTextState(longTokens, state, { advance: true }, 120, { layoutPageBreaksByPage }).state;
    while (!state.completed && !state.pausedForAdvance) {
      state = reduceTextState(longTokens, state, { deltaMs: 16 }, 120, { layoutPageBreaksByPage }).state;
    }
    expect(getRevealedPageText(longTokens, state, layoutPageBreaksByPage)).toBe("klmnop");
  });

  test("layout breaks on explicit page two ignore page one length", () => {
    const pagedTokens: MessageToken[] = [
      { type: "text", value: "AAA", start: 0, end: 3 },
      { type: "pageBreak", start: 3, end: 4 },
      { type: "text", value: "BBBBBBBBBBCCCC", start: 4, end: 18 },
    ];
    expect(splitTokensByExplicitPage(pagedTokens).length).toBe(2);
    const layoutPageBreaksByPage = [[], [10]];
    let state = createInitialTextState();
    while (state.pageIndex < 1 && !state.completed) {
      const result = reduceTextState(pagedTokens, state, { deltaMs: 32, advance: state.pausedForAdvance }, 120, {
        layoutPageBreaksByPage,
      });
      state = result.state;
    }
    expect(state.pageIndex).toBe(1);
    while (!state.pausedForAdvance && !state.completed) {
      state = reduceTextState(pagedTokens, state, { deltaMs: 16 }, 120, { layoutPageBreaksByPage }).state;
    }
    expect(getFlatSourceIndexInExplicitPage(pagedTokens, state.tokenIndex, state.graphemeOffset, 1)).toBe(10);
    expect(getRevealedPageText(pagedTokens, state, layoutPageBreaksByPage)).toBe("BBBBBBBBBB");
  });

  test("confirm while typing stops at layout boundary", () => {
    const longTokens: MessageToken[] = [{ type: "text", value: "ABCDEFGHIJklmnop", start: 0, end: 16 }];
    const layoutPageBreaksByPage = [[10]];
    let state = createInitialTextState();
    state = reduceTextState(longTokens, state, { confirm: true }, 120, { layoutPageBreaksByPage }).state;
    expect(getRevealedPageText(longTokens, state, layoutPageBreaksByPage)).toBe("ABCDEFGHIJ");
    expect(state.pausedForAdvance).toBe(true);
  });

  test("color tokens do not appear in revealed text and speed changes typing rate", () => {
    const colored: MessageToken[] = [
      { type: "color", color: 0xff0000, start: 0, end: 14 },
      { type: "text", value: "AB", start: 14, end: 16 },
      { type: "speed", charsPerSecond: 1, start: 16, end: 25 },
      { type: "text", value: "CD", start: 25, end: 27 },
    ];
    let state = createInitialTextState();
    state = reduceTextState(colored, state, { deltaMs: 50 }, 120).state;
    expect(getRevealedPageText(colored, state)).toBe("AB");
    const slow = reduceTextState(colored, state, { deltaMs: 50 }, 120).state;
    expect(getRevealedPageText(colored, slow).startsWith("AB")).toBe(true);
    expect(getRevealedPageText(colored, slow).length).toBeLessThan(4);
  });
});
