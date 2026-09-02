import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Container, Graphics } from "pixi.js";
import { cursorBlinkVisible } from "../../src/selection/cursorBlink.ts";
import { resolveWindowTheme } from "../../src/core/theme.ts";
import { CursorRenderer } from "../../src/pixi/CursorRenderer.ts";

const ROOT = resolve(import.meta.dir, "../..");
const CURSOR_SOURCE = readFileSync(join(ROOT, "src/pixi/CursorRenderer.ts"), "utf8");
const WINDOW_BASE_SOURCE = readFileSync(join(ROOT, "src/pixi/WindowBase.ts"), "utf8");

describe("CursorRenderer", () => {
  test("draw attaches Graphics to parent with integer bounds", () => {
    const parent = new Container();
    const renderer = new CursorRenderer(parent);
    const theme = resolveWindowTheme({ cursor: { color: 0xff0000, alpha: 0.5, padding: 2 } });

    renderer.draw({ x: 10, y: 20, width: 100, height: 16 }, theme);

    expect(parent.children.length).toBe(1);
    const graphics = parent.children[0];
    expect(graphics).toBeInstanceOf(Graphics);
    renderer.destroy();
    parent.destroy({ children: true });
  });

  test("update uses cursorBlinkVisible and WindowBase has no blink", () => {
    expect(CURSOR_SOURCE.includes("cursorBlinkVisible")).toBe(true);
    expect(CURSOR_SOURCE.includes("public update(deltaMs: number)")).toBe(true);
    expect(WINDOW_BASE_SOURCE.includes("blink")).toBe(false);

    const parent = new Container();
    const renderer = new CursorRenderer(parent);
    const theme = resolveWindowTheme({ cursor: { color: 0xffffff, alpha: 1, blinkPeriodMs: 800 } });
    renderer.draw({ x: 0, y: 0, width: 40, height: 12 }, theme);

    renderer.update(0);
    const graphics = parent.children[0] as Graphics;
    expect(graphics.visible).toBe(cursorBlinkVisible(0, 800));

    renderer.update(500);
    expect(graphics.visible).toBe(cursorBlinkVisible(500, 800));

    renderer.destroy();
    parent.destroy({ children: true });
  });

  test("source has no beginFill or phaser", () => {
    expect(CURSOR_SOURCE.includes("beginFill")).toBe(false);
    expect(CURSOR_SOURCE.includes('from "phaser"')).toBe(false);
    expect(CURSOR_SOURCE.includes(".rect(")).toBe(true);
    expect(CURSOR_SOURCE.includes(".fill({")).toBe(true);
  });
});
