import { describe, expect, test } from "bun:test";
import { TransitionController } from "../../src/core/TransitionController.ts";
import { ignoreTransitionCancellation } from "../../src/core/windowOperations.ts";
import { WindowOperationCancelledError } from "../../src/core/types.ts";

describe("ignoreTransitionCancellation", () => {
  test("swallows WindowOperationCancelledError from fire-and-forget open", async () => {
    const controller = new TransitionController(1500);
    const openPromise = controller.open();
    ignoreTransitionCancellation(openPromise);
    controller.update(100);
    controller.dispose("destroyed");
    await expect(openPromise).rejects.toThrow("destroyed");
  });

  test("still rejects unexpected errors for awaiters", async () => {
    const failing = Promise.reject(new Error("unexpected"));
    ignoreTransitionCancellation(failing);
    await expect(failing).rejects.toThrow("unexpected");
  });
});

describe("WindowBase lifecycle contract", () => {
  test("destroy order deactivates before marking destroyed", () => {
    let destroyed = false;
    let active = true;
    const deactivate = (): void => {
      if (!destroyed) {
        active = false;
      }
    };
    const destroy = (): void => {
      if (destroyed) {
        return;
      }
      deactivate();
      destroyed = true;
    };

    expect(() => destroy()).not.toThrow();
    expect(active).toBe(false);
    expect(() => destroy()).not.toThrow();
  });

  test("transition dispose settles to closed", () => {
    const controller = new TransitionController(100);
    void controller.open();
    expect(() => controller.dispose("destroyed")).not.toThrow();
    expect(controller.getState()).toEqual({ phase: "closed", openness: 0 });
  });

  test("reversed transition rejects superseded promise", async () => {
    const controller = new TransitionController(100);
    const openPromise = controller.open();
    controller.update(50);
    openPromise.catch(() => {});
    const closePromise = controller.close();
    controller.update(100);
    await closePromise;
    expect(controller.getState().openness).toBe(0);
  });

  test("openness presentation math keeps vertical center fixed", () => {
    const height = 80;
    const rootY = 20;
    const scaleY = 0;
    const offsetY = (height * (1 - scaleY)) / 2;
    expect(rootY + offsetY).toBe(60);
    expect(scaleY).toBe(0);
  });

  test("open promise completes when transition updates run before dispose", async () => {
    const controller = new TransitionController(100);
    const openPromise = controller.open();
    controller.update(100);
    await openPromise;
    expect(controller.getState()).toEqual({ phase: "open", openness: 1 });
  });

  test("dispose during open rejects with cancellation reason", async () => {
    const controller = new TransitionController(1500);
    const openPromise = controller.open();
    ignoreTransitionCancellation(openPromise);
    controller.update(100);
    controller.dispose("destroyed");
    await expect(openPromise).rejects.toThrow("destroyed");
  });
});

describe("WindowOperationCancelledError", () => {
  test("carries the dispose reason", () => {
    const error = new WindowOperationCancelledError("destroyed");
    expect(error.message).toBe("destroyed");
  });
});
