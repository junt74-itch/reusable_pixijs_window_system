import { describe, expect, test } from "bun:test";
import { computeContentBounds, resolveWindowTheme, validateWindowConfig } from "../../src/core/theme.ts";
import { WindowConfigError, WindowLayoutError } from "../../src/core/types.ts";

describe("resolveWindowTheme", () => {
  test("returns deterministic defaults without mutating caller input", () => {
    const partial = { padding: 8 };
    const resolved = resolveWindowTheme(partial);
    expect(resolved.padding.top).toBe(8);
    expect(partial.padding).toBe(8);
    const again = resolveWindowTheme();
    expect(again.padding.top).toBe(12);
    expect(resolved).not.toBe(again);
    expect(again.cursor).toEqual({
      color: 0xffffff,
      alpha: 0.3,
      width: 0,
      padding: 4,
      blinkPeriodMs: 0,
    });
  });

  test("rejects invalid numeric values", () => {
    expect(() => validateWindowConfig({ x: 0, y: 0, width: 0, height: 10 })).toThrow(WindowConfigError);
    expect(() => validateWindowConfig({ x: NaN, y: 0, width: 10, height: 10 })).toThrow(WindowConfigError);
    expect(() => resolveWindowTheme({ borderWidth: -1 })).toThrow(WindowConfigError);
    expect(() => resolveWindowTheme({ transitionDurationMs: Number.POSITIVE_INFINITY })).toThrow(
      WindowConfigError,
    );
    expect(() => resolveWindowTheme({ cursor: { blinkPeriodMs: -1 } })).toThrow(WindowConfigError);
  });

  test("computes content bounds from padding", () => {
    const theme = resolveWindowTheme({ padding: { top: 4, right: 6, bottom: 8, left: 10 } });
    const bounds = computeContentBounds(100, 50, theme.padding);
    expect(bounds).toEqual({ x: 10, y: 4, width: 84, height: 38 });
  });

  test("rejects non-positive content area", () => {
    const theme = resolveWindowTheme({ padding: 40 });
    expect(() => computeContentBounds(50, 50, theme.padding)).toThrow(WindowLayoutError);
  });
});
