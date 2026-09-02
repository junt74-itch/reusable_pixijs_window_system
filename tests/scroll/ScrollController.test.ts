import { describe, expect, test } from "bun:test";
import { ScrollController } from "../../src/scroll/ScrollController.ts";

describe("ScrollController", () => {
  test("clamps offset between zero and content minus viewport", () => {
    const scroll = new ScrollController();
    scroll.setContentSize(200);
    scroll.setViewportSize(80);
    scroll.setOffset(999);
    expect(scroll.getBounds().offset).toBe(120);
    scroll.setOffset(-50);
    expect(scroll.getBounds().offset).toBe(0);
  });

  test("zero or negative sizes yield zero max offset", () => {
    const scroll = new ScrollController();
    scroll.setContentSize(0);
    scroll.setViewportSize(80);
    expect(scroll.getBounds().maxOffset).toBe(0);
    scroll.setContentSize(100);
    scroll.setViewportSize(0);
    expect(scroll.getBounds().maxOffset).toBe(100);
    scroll.setContentSize(-20);
    scroll.setViewportSize(-10);
    expect(scroll.getBounds().maxOffset).toBe(0);
  });

  test("scrollBy and scrollTo clamp at bounds", () => {
    const scroll = new ScrollController();
    scroll.setContentSize(100);
    scroll.setViewportSize(40);
    scroll.scrollBy(80);
    expect(scroll.getBounds().offset).toBe(60);
    scroll.scrollTo(10);
    expect(scroll.getBounds().offset).toBe(10);
  });

  test("page up and page down step by viewport ratio", () => {
    const scroll = new ScrollController({ pageStepRatio: 0.5 });
    scroll.setContentSize(200);
    scroll.setViewportSize(100);
    scroll.pageDown();
    expect(scroll.getBounds().offset).toBe(50);
    scroll.pageDown();
    expect(scroll.getBounds().offset).toBe(100);
    scroll.pageUp();
    expect(scroll.getBounds().offset).toBe(50);
  });

  test("wheel step moves by configured pixels in wheel direction", () => {
    const scroll = new ScrollController({ wheelStepPx: 16 });
    scroll.setContentSize(100);
    scroll.setViewportSize(40);
    scroll.wheelStep(1);
    expect(scroll.getBounds().offset).toBe(16);
    scroll.wheelStep(-1);
    expect(scroll.getBounds().offset).toBe(0);
    scroll.wheelStep(0);
    expect(scroll.getBounds().offset).toBe(0);
  });

  test("canScrollUp and canScrollDown reflect offset", () => {
    const scroll = new ScrollController();
    scroll.setContentSize(100);
    scroll.setViewportSize(40);
    expect(scroll.canScrollUp()).toBe(false);
    expect(scroll.canScrollDown()).toBe(true);
    scroll.setOffset(60);
    expect(scroll.canScrollUp()).toBe(true);
    expect(scroll.canScrollDown()).toBe(false);
  });

  test("change listeners receive snapshots and unsubscribe cleanly", () => {
    const scroll = new ScrollController();
    const seen: number[] = [];
    const subscription = scroll.subscribe((bounds) => {
      seen.push(bounds.offset);
    });
    scroll.setContentSize(80);
    scroll.setViewportSize(40);
    scroll.setOffset(10);
    subscription.unsubscribe();
    scroll.setOffset(20);
    expect(seen).toEqual([0, 0, 10]);
  });

  test("content or viewport resize emits when offset stays unchanged", () => {
    const scroll = new ScrollController();
    scroll.setViewportSize(80);
    const maxOffsets: number[] = [];
    scroll.subscribe((bounds) => {
      maxOffsets.push(bounds.maxOffset);
    });
    scroll.setContentSize(200);
    expect(maxOffsets).toEqual([120]);
    expect(scroll.canScrollDown()).toBe(true);
    scroll.setContentSize(200);
    expect(maxOffsets).toEqual([120]);
  });

  test("defaults axis to y", () => {
    const scroll = new ScrollController();
    expect(scroll.getAxis()).toBe("y");
  });
});
