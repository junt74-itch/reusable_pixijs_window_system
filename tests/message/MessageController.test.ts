import { describe, expect, test } from "bun:test";
import { ManualWindowInput } from "../helpers/ManualWindowInput.ts";
import { MessageBusyError, MessageController } from "../../src/message/MessageController.ts";
import type { MessageToken } from "../../src/message/types.ts";

const tokens: MessageToken[] = [{ type: "text", value: "Hello", start: 0, end: 5 }];

describe("MessageController", () => {
  test("rejects a second start while busy", async () => {
    const controller = new MessageController(null);
    const first = controller.start({ tokens, charsPerSecond: 30 });
    await expect(controller.start({ tokens, charsPerSecond: 30 })).rejects.toBeInstanceOf(
      MessageBusyError,
    );
    expect(controller.isBusy()).toBe(true);
    controller.cancelOperation("test");
    await expect(first).rejects.toThrow("test");
  });

  test("ignores input when canConsumeInput returns false", () => {
    const input = new ManualWindowInput();
    let canConsume = false;
    const controller = new MessageController(input, () => canConsume);
    void controller.start({ tokens, charsPerSecond: 60 });
    input.pushAction("confirm");
    expect(controller.getLatestSnapshot().revealedText).toBe("");
    canConsume = true;
    input.pushAction("confirm");
    expect(controller.getLatestSnapshot().revealedText).toBe("Hello");
  });

  test("cancelOperation settles once", async () => {
    const controller = new MessageController(null);
    const pending = controller.start({ tokens, charsPerSecond: 30 });
    controller.cancelOperation("test");
    await expect(pending).rejects.toThrow("test");
    controller.cancelOperation("ignored");
  });

  test("layout page breaks pause until confirm advances layout page", () => {
    const longTokens: MessageToken[] = [
      { type: "text", value: "ABCDEFGHIJklmnop", start: 0, end: 16 },
    ];
    const controller = new MessageController(null);
    void controller.start({
      tokens: longTokens,
      charsPerSecond: 120,
      layoutPageBreaksByPage: [[10]],
    });
    for (let step = 0; step < 20; step += 1) {
      controller.update(16);
      if (controller.getLatestSnapshot().pausedForAdvance) {
        break;
      }
    }
    expect(controller.getLatestSnapshot().revealedText).toBe("ABCDEFGHIJ");
    expect(controller.getLatestSnapshot().layoutPageIndex).toBe(0);
  });

  test("confirm while typing stops at the next layout boundary like skip", () => {
    const longTokens: MessageToken[] = [
      { type: "text", value: "ABCDEFGHIJklmnop", start: 0, end: 16 },
    ];
    const layoutPageBreaksByPage = [[10]];
    const input = new ManualWindowInput();
    const controller = new MessageController(input);
    void controller.start({
      tokens: longTokens,
      charsPerSecond: 120,
      layoutPageBreaksByPage,
    });
    controller.update(16);
    input.pushAction("confirm");
    expect(controller.getLatestSnapshot().revealedText).toBe("ABCDEFGHIJ");
    expect(controller.getLatestSnapshot().pausedForAdvance).toBe(true);
    expect(controller.getLatestSnapshot().layoutPageIndex).toBe(0);
  });

  test("auto-advance proceeds after delay and confirm wins", () => {
    const paged: MessageToken[] = [
      { type: "text", value: "A", start: 0, end: 1 },
      { type: "pageBreak", start: 1, end: 2 },
      { type: "text", value: "B", start: 2, end: 3 },
    ];
    const auto = new MessageController(null);
    void auto.start({ tokens: paged, charsPerSecond: 120, autoAdvanceMs: 50 });
    for (let step = 0; step < 20 && !auto.getLatestSnapshot().pausedForAdvance; step += 1) {
      auto.update(16);
    }
    expect(auto.getLatestSnapshot().pausedForAdvance).toBe(true);
    expect(auto.getLatestSnapshot().pageIndex).toBe(0);
    auto.update(50);
    expect(auto.getLatestSnapshot().pageIndex).toBe(1);

    const input = new ManualWindowInput();
    const interrupted = new MessageController(input);
    void interrupted.start({ tokens: paged, charsPerSecond: 120, autoAdvanceMs: 5_000 });
    for (let step = 0; step < 20 && !interrupted.getLatestSnapshot().pausedForAdvance; step += 1) {
      interrupted.update(16);
    }
    expect(interrupted.getLatestSnapshot().pausedForAdvance).toBe(true);
    input.pushAction("confirm");
    expect(interrupted.getLatestSnapshot().pageIndex).toBe(1);
  });

  test("pause is not auto-advanced unless autoAdvancePause is set", () => {
    const paused: MessageToken[] = [
      { type: "text", value: "A", start: 0, end: 1 },
      { type: "pause", start: 1, end: 8 },
      { type: "text", value: "B", start: 8, end: 9 },
    ];
    const controller = new MessageController(null);
    void controller.start({ tokens: paused, charsPerSecond: 120, autoAdvanceMs: 10 });
    for (let step = 0; step < 20; step += 1) {
      controller.update(16);
    }
    expect(controller.getLatestSnapshot().pausedForAdvance).toBe(true);
    expect(controller.getLatestSnapshot().revealedText).toBe("A");
  });

  test("audio hooks fire while busy and not after dispose", async () => {
    const tokens: MessageToken[] = [
      { type: "text", value: "Hi", start: 0, end: 2 },
      { type: "pageBreak", start: 2, end: 3 },
      { type: "text", value: "Yo", start: 3, end: 5 },
    ];
    let typed = 0;
    let paged = 0;
    let confirmed = 0;
    let cancelled = 0;
    const input = new ManualWindowInput();
    const controller = new MessageController(input);
    const pending = controller.start({
      tokens,
      charsPerSecond: 120,
      hooks: {
        onType: () => {
          typed += 1;
        },
        onPage: () => {
          paged += 1;
        },
        onConfirm: () => {
          confirmed += 1;
        },
        onCancel: () => {
          cancelled += 1;
        },
      },
    });
    for (let step = 0; step < 10; step += 1) {
      controller.update(16);
    }
    expect(typed).toBeGreaterThan(0);
    input.pushAction("confirm");
    expect(confirmed).toBe(1);
    expect(paged).toBe(1);
    controller.dispose();
    const typedAfter = typed;
    controller.update(16);
    input.pushAction("confirm");
    expect(typed).toBe(typedAfter);
    expect(cancelled).toBe(0);
    await expect(pending).rejects.toThrow("disposed");
  });

  test("cancelOperation invokes onCancel once while busy", async () => {
    let cancelled = 0;
    const controller = new MessageController(null);
    const pending = controller.start({
      tokens,
      charsPerSecond: 30,
      hooks: {
        onCancel: () => {
          cancelled += 1;
        },
      },
    });
    controller.cancelOperation("test");
    expect(cancelled).toBe(1);
    await expect(pending).rejects.toThrow("test");
    controller.cancelOperation("ignored");
    expect(cancelled).toBe(1);
  });
});
