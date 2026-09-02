import { describe, expect, test } from "bun:test";
import { computeLayoutPageBreaks } from "../../src/message/layoutPages.ts";
import type { LayoutLine } from "../../src/text/types.ts";

describe("computeLayoutPageBreaks", () => {
  test("collects source indices where pageIndex increases", () => {
    const lines: LayoutLine[] = [
      {
        text: "page0 line1",
        y: 0,
        width: 80,
        height: 14,
        ascent: 11,
        pageIndex: 0,
        align: "left",
        runs: [],
        sourceRange: { start: 0, end: 11 },
      },
      {
        text: "page0 line2",
        y: 14,
        width: 80,
        height: 14,
        ascent: 11,
        pageIndex: 0,
        align: "left",
        runs: [],
        sourceRange: { start: 12, end: 23 },
      },
      {
        text: "page1 line1",
        y: 0,
        width: 80,
        height: 14,
        ascent: 11,
        pageIndex: 1,
        align: "left",
        runs: [],
        sourceRange: { start: 24, end: 35 },
      },
      {
        text: "page1 line2",
        y: 14,
        width: 80,
        height: 14,
        ascent: 11,
        pageIndex: 1,
        align: "left",
        runs: [],
        sourceRange: { start: 36, end: 47 },
      },
      {
        text: "page2 line1",
        y: 0,
        width: 80,
        height: 14,
        ascent: 11,
        pageIndex: 2,
        align: "left",
        runs: [],
        sourceRange: { start: 48, end: 59 },
      },
    ];
    expect(computeLayoutPageBreaks(lines)).toEqual([24, 48]);
  });

  test("returns empty array for single-page layout", () => {
    const lines: LayoutLine[] = [
      {
        text: "only",
        y: 0,
        width: 40,
        height: 14,
        ascent: 11,
        pageIndex: 0,
        align: "left",
        runs: [],
        sourceRange: { start: 0, end: 4 },
      },
    ];
    expect(computeLayoutPageBreaks(lines)).toEqual([]);
  });
});
