import { describe, expect, test } from "bun:test";
import { TransitionController } from "../../src/core/TransitionController.ts";
import { WindowOperationCancelledError } from "../../src/core/types.ts";

describe("TransitionController", () => {
  test("opens and closes with deterministic updates", async () => {
    const controller = new TransitionController(100);
    const openPromise = controller.open();
    controller.update(50);
    expect(controller.getState().phase).toBe("opening");
    controller.update(50);
    await openPromise;
    expect(controller.getState()).toEqual({ phase: "open", openness: 1 });

    const closePromise = controller.close();
    controller.update(100);
    await closePromise;
    expect(controller.getState()).toEqual({ phase: "closed", openness: 0 });
  });

  test("reversal cancels the superseded promise", async () => {
    const controller = new TransitionController(100);
    const openPromise = controller.open();
    controller.update(50);
    let openRejected = false;
    openPromise.catch((error) => {
      if (error instanceof WindowOperationCancelledError) {
        openRejected = true;
      }
    });
    const closePromise = controller.close();
    controller.update(100);
    await closePromise;
    expect(openRejected).toBe(true);
    expect(controller.getState().openness).toBe(0);
  });

  test("zero-duration transitions settle synchronously", async () => {
    const controller = new TransitionController(100);
    await controller.open(0);
    expect(controller.getState().phase).toBe("open");
  });

  test("subscribe notifies phase changes and clears on dispose", () => {
    const controller = new TransitionController(100);
    const phases: string[] = [];
    const sub = controller.subscribe((state) => {
      phases.push(state.phase);
    });
    void controller.open();
    expect(phases).toEqual(["opening"]);
    controller.update(100);
    expect(phases).toEqual(["opening", "open"]);
    sub.unsubscribe();
    void controller.close(0);
    expect(phases).toEqual(["opening", "open"]);
    const after = new TransitionController(0);
    const disposed: string[] = [];
    after.subscribe((state) => {
      disposed.push(state.phase);
    });
    void after.open(0);
    after.dispose();
    expect(disposed).toEqual(["open", "closed"]);
  });

  test("ignores invalid deltas", () => {
    const controller = new TransitionController(100);
    void controller.open();
    controller.update(-1);
    expect(controller.getState().openness).toBe(0);
  });
});
