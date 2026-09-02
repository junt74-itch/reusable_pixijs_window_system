import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WindowFocusController } from "../../src/focus/WindowFocusController.ts";
import type { FocusableWindow } from "../../src/focus/types.ts";
import { WindowFocusError } from "../../src/focus/types.ts";

class FakeWindow implements FocusableWindow {
  public active = false;
  public destroyed = false;
  public open = true;
  public visible = true;
  public enabled = true;

  public activate(): this {
    if (this.destroyed) {
      throw new Error("destroyed");
    }
    this.active = true;
    return this;
  }

  public deactivate(): this {
    this.active = false;
    return this;
  }

  public isActive(): boolean {
    return this.active;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public canConsumeInput(): boolean {
    return !this.destroyed && this.visible && this.active && this.enabled && this.open;
  }

  public destroy(): void {
    this.destroyed = true;
    this.active = false;
  }
}

describe("WindowFocusController", () => {
  test("acquire makes exactly one window active", () => {
    const focus = new WindowFocusController();
    const first = new FakeWindow();
    const second = new FakeWindow();
    focus.acquire(first);
    focus.acquire(second);
    expect(first.isActive()).toBe(false);
    expect(second.isActive()).toBe(true);
    expect(focus.getActive()).toBe(second);
    expect(first.canConsumeInput()).toBe(false);
    expect(second.canConsumeInput()).toBe(true);
    focus.dispose();
  });

  test("release restores the previous window", () => {
    const focus = new WindowFocusController();
    const first = new FakeWindow();
    const second = new FakeWindow();
    focus.acquire(first);
    focus.acquire(second, { modal: true });
    expect(focus.getSnapshot().modal).toBe(true);
    expect(focus.getSnapshot().stackDepth).toBe(2);
    expect(first.canConsumeInput()).toBe(false);
    focus.release(second);
    expect(focus.getActive()).toBe(first);
    expect(first.isActive()).toBe(true);
    expect(second.isActive()).toBe(false);
    expect(focus.getSnapshot().modal).toBe(false);
    focus.dispose();
  });

  test("destroyed windows are dropped and the next top is activated", () => {
    const focus = new WindowFocusController();
    const first = new FakeWindow();
    const second = new FakeWindow();
    focus.acquire(first);
    focus.acquire(second, { modal: true });
    second.destroy();
    expect(focus.getActive()).toBe(first);
    expect(first.isActive()).toBe(true);
    expect(() => focus.acquire(second)).toThrow(WindowFocusError);
    focus.dispose();
  });

  test("releaseAll and dispose clear the stack", () => {
    const focus = new WindowFocusController();
    const first = new FakeWindow();
    focus.acquire(first);
    focus.releaseAll();
    expect(focus.getActive()).toBeNull();
    expect(first.isActive()).toBe(false);
    focus.dispose();
    expect(() => focus.acquire(first)).toThrow(WindowFocusError);
  });

  test("subscribers see modal snapshots for scene-owned dimmers", () => {
    const focus = new WindowFocusController();
    const first = new FakeWindow();
    const second = new FakeWindow();
    const snapshots: boolean[] = [];
    const sub = focus.subscribe((snapshot) => snapshots.push(snapshot.modal));
    focus.acquire(first);
    focus.acquire(second, { modal: true });
    focus.release(second);
    expect(snapshots).toEqual([false, true, false]);
    sub.unsubscribe();
    focus.dispose();
  });
});

const ROOT = join(import.meta.dir, "../..");

describe("WindowFocusController isolation", () => {
  test("WindowBase has no focus stack or modal API", () => {
    const windowBase = readFileSync(join(ROOT, "src/pixi/WindowBase.ts"), "utf8");
    expect(windowBase.includes("isDestroyed()")).toBe(true);
    expect(windowBase.includes("focus/")).toBe(false);
    expect(windowBase.includes("WindowFocusController")).toBe(false);
    expect(windowBase.includes("acquire(")).toBe(false);
    expect(windowBase.includes("modal")).toBe(false);
  });

  test("windows do not import the controller; binder uses onDestroy without dimmer", () => {
    const controller = readFileSync(join(ROOT, "src/focus/WindowFocusController.ts"), "utf8");
    const binder = readFileSync(join(ROOT, "src/focus/bindHostDestroy.ts"), "utf8");
    expect(controller.includes('from "phaser"')).toBe(false);
    expect(controller.includes('from "pixi.js"')).toBe(false);
    expect(controller.includes("add.graphics")).toBe(false);
    expect(binder.includes("onDestroy")).toBe(true);
    expect(binder.includes("add.graphics")).toBe(false);
    expect(binder.includes('from "phaser"')).toBe(false);
    expect(binder.includes('from "pixi.js"')).toBe(false);
  });
});
