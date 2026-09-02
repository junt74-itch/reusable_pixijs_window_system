import type { FederatedPointerEvent, FederatedWheelEvent } from "pixi.js";
import type {
  WindowActionEvent,
  WindowInputAction,
  WindowInputPhase,
  WindowInputSource,
  WindowDragEvent,
  WindowPointerEvent,
  WindowWheelEvent,
} from "./types.ts";
import { BaseWindowInputAdapter } from "./WindowInputAdapter.ts";
import type { PixiWindowHost } from "../host/types.ts";

export interface PixiWindowInputBindings {
  readonly up?: readonly string[];
  readonly down?: readonly string[];
  readonly left?: readonly string[];
  readonly right?: readonly string[];
  readonly confirm?: readonly string[];
  readonly cancel?: readonly string[];
  readonly pageUp?: readonly string[];
  readonly pageDown?: readonly string[];
  readonly skip?: readonly string[];
}

export interface PixiWindowInputOptions {
  readonly bindings?: PixiWindowInputBindings;
  readonly enableGamepad?: boolean;
  readonly gamepadDeadZone?: number;
  readonly localToWorld?: (localX: number, localY: number) => { worldX: number; worldY: number };
  /** Test-only keyboard event target; not part of the supported consumer surface. */
  readonly keyboardTarget?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}

const DEFAULT_BINDINGS: Required<PixiWindowInputBindings> = {
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  confirm: ["Enter", "Space"],
  cancel: ["Escape", "Backspace"],
  pageUp: ["PageUp"],
  pageDown: ["PageDown"],
  skip: ["ControlLeft", "ControlRight"],
};

const ACTION_TO_BINDING_KEY: Record<WindowInputAction, keyof PixiWindowInputBindings> = {
  up: "up",
  down: "down",
  left: "left",
  right: "right",
  confirm: "confirm",
  cancel: "cancel",
  pageUp: "pageUp",
  pageDown: "pageDown",
  skip: "skip",
};

type KeyboardTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Pixi keyboard/pointer/gamepad adapter scoped to one {@link PixiWindowHost}.
 */
export class PixiWindowInput extends BaseWindowInputAdapter {
  private readonly host: PixiWindowHost;
  private readonly bindings: Required<PixiWindowInputBindings>;
  private readonly enableGamepad: boolean;
  private readonly gamepadDeadZone: number;
  private readonly localToWorld: (localX: number, localY: number) => { worldX: number; worldY: number };
  private readonly keyboardTarget: KeyboardTarget;
  private readonly keyDownHandler: (event: KeyboardEvent) => void;
  private readonly keyUpHandler: (event: KeyboardEvent) => void;
  private readonly pointerDownHandler: (event: FederatedPointerEvent) => void;
  private readonly pointerUpHandler: (event: FederatedPointerEvent) => void;
  private readonly pointerMoveHandler: (event: FederatedPointerEvent) => void;
  private readonly wheelHandler: (event: FederatedWheelEvent) => void;
  private readonly hostDestroyUnsubscribe: () => void;
  private readonly pressedKeys = new Set<string>();
  private readonly repeatAccumMs = new Map<string, number>();
  private readonly gamepadPrevious = new Map<number, Set<WindowInputAction>>();
  private readonly activeDrags = new Map<
    number,
    {
      localX: number;
      localY: number;
      worldX: number;
      worldY: number;
      remainderX: number;
      remainderY: number;
    }
  >();
  private gamepadRepeatMs = 0;

  public constructor(host: PixiWindowHost, options: PixiWindowInputOptions = {}) {
    super();
    this.host = host;
    this.bindings = mergeBindings(options.bindings);
    this.enableGamepad = options.enableGamepad ?? true;
    this.gamepadDeadZone = options.gamepadDeadZone ?? 0.2;
    this.localToWorld =
      options.localToWorld ??
      ((localX, localY) => ({
        worldX: localX,
        worldY: localY,
      }));
    this.keyboardTarget = options.keyboardTarget ?? globalThis;

    this.keyDownHandler = (event) => this.handleKey(event, "pressed");
    this.keyUpHandler = (event) => this.handleKey(event, "released");
    this.pointerDownHandler = (event) => {
      this.emitPointerFromPixi(event, "pressed", true);
      this.emitDragFromPixi(event, "started");
    };
    this.pointerUpHandler = (event) => {
      this.emitPointerFromPixi(event, "released", false);
      this.emitDragFromPixi(event, "ended");
    };
    this.pointerMoveHandler = (event) => {
      const isPrimaryDown = event.buttons !== 0;
      this.emitPointerFromPixi(event, "repeated", isPrimaryDown);
      if (isPrimaryDown) {
        this.emitDragFromPixi(event, "moved");
      }
    };
    this.wheelHandler = (event) => {
      this.emitWheelFromPixi(event);
    };
    this.hostDestroyUnsubscribe = host.onDestroy(() => this.dispose());

    this.registerKeyboard();
    this.registerPointer();
    this.registerWheel();
  }

  public override dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.keyboardTarget.removeEventListener("keydown", this.keyDownHandler as EventListener);
    this.keyboardTarget.removeEventListener("keyup", this.keyUpHandler as EventListener);
    const stage = this.host.stage;
    stage.off("pointerdown", this.pointerDownHandler);
    stage.off("pointerup", this.pointerUpHandler);
    stage.off("pointerupoutside", this.pointerUpHandler);
    stage.off("pointermove", this.pointerMoveHandler);
    stage.off("wheel", this.wheelHandler);
    this.hostDestroyUnsubscribe();
    this.pressedKeys.clear();
    this.repeatAccumMs.clear();
    this.gamepadPrevious.clear();
    this.activeDrags.clear();
    super.dispose();
  }

  /** Deterministic repeat/update hook for tests and host update loops. */
  public update(deltaMs: number): void {
    if (this.isDisposed || !Number.isFinite(deltaMs) || deltaMs < 0) {
      return;
    }
    this.gamepadRepeatMs += deltaMs;
    this.updateKeyboardRepeat(deltaMs);
    if (this.enableGamepad) {
      this.updateGamepad(deltaMs);
    }
  }

  private registerKeyboard(): void {
    this.keyboardTarget.addEventListener("keydown", this.keyDownHandler as EventListener);
    this.keyboardTarget.addEventListener("keyup", this.keyUpHandler as EventListener);
  }

  private registerPointer(): void {
    const stage = this.host.stage;
    stage.on("pointerdown", this.pointerDownHandler);
    stage.on("pointerup", this.pointerUpHandler);
    stage.on("pointerupoutside", this.pointerUpHandler);
    stage.on("pointermove", this.pointerMoveHandler);
  }

  private registerWheel(): void {
    this.host.stage.on("wheel", this.wheelHandler);
  }

  private handleKey(event: KeyboardEvent, phase: WindowInputPhase): void {
    const action = this.actionForKeyCode(event.code);
    if (action === null) {
      return;
    }
    if (phase === "pressed") {
      if (this.pressedKeys.has(event.code)) {
        return;
      }
      this.pressedKeys.add(event.code);
      this.repeatAccumMs.set(event.code, 0);
    } else {
      this.pressedKeys.delete(event.code);
      this.repeatAccumMs.delete(event.code);
    }
    this.emitActionSnapshot(action, phase, "keyboard");
  }

  private updateKeyboardRepeat(deltaMs: number): void {
    for (const keyCode of this.pressedKeys) {
      const elapsed = (this.repeatAccumMs.get(keyCode) ?? 0) + deltaMs;
      this.repeatAccumMs.set(keyCode, elapsed);
      if (elapsed >= 400) {
        const action = this.actionForKeyCode(keyCode);
        if (action !== null) {
          this.emitActionSnapshot(action, "repeated", "keyboard");
        }
        this.repeatAccumMs.set(keyCode, 350);
      }
    }
  }

  private updateGamepad(deltaMs: number): void {
    void deltaMs;
    const gamepads =
      typeof navigator !== "undefined" && typeof navigator.getGamepads === "function"
        ? navigator.getGamepads()
        : [];
    const pad = gamepads[0] ?? null;
    if (pad === null) {
      return;
    }

    const index = pad.index;
    const previous = this.gamepadPrevious.get(index) ?? new Set<WindowInputAction>();
    const current = new Set<WindowInputAction>();
    this.collectGamepadActions(pad, current);
    for (const action of current) {
      if (!previous.has(action)) {
        this.emitActionSnapshot(action, "pressed", "gamepad");
      } else if (this.gamepadRepeatMs >= 400) {
        this.emitActionSnapshot(action, "repeated", "gamepad");
      }
    }
    for (const action of previous) {
      if (!current.has(action)) {
        this.emitActionSnapshot(action, "released", "gamepad");
      }
    }
    this.gamepadPrevious.set(index, current);

    if (this.gamepadRepeatMs >= 400) {
      this.gamepadRepeatMs = 0;
    }
  }

  private collectGamepadActions(pad: Gamepad, out: Set<WindowInputAction>): void {
    const threshold = this.gamepadDeadZone;
    const axisX = pad.axes[0] ?? 0;
    const axisY = pad.axes[1] ?? 0;
    if (axisY < -threshold) {
      out.add("up");
    }
    if (axisY > threshold) {
      out.add("down");
    }
    if (axisX < -threshold) {
      out.add("left");
    }
    if (axisX > threshold) {
      out.add("right");
    }
    if (pad.buttons[12]?.pressed) {
      out.add("up");
    }
    if (pad.buttons[13]?.pressed) {
      out.add("down");
    }
    if (pad.buttons[14]?.pressed) {
      out.add("left");
    }
    if (pad.buttons[15]?.pressed) {
      out.add("right");
    }
    if (pad.buttons[0]?.pressed) {
      out.add("confirm");
    }
    if (pad.buttons[1]?.pressed) {
      out.add("cancel");
    }
  }

  private emitPointerFromPixi(
    event: FederatedPointerEvent,
    phase: WindowInputPhase,
    isPrimaryDown: boolean,
  ): void {
    const local = event.getLocalPosition(this.host.stage);
    const world = this.localToWorld(event.global.x, event.global.y);
    const pointerEvent: WindowPointerEvent = {
      localX: local.x,
      localY: local.y,
      worldX: world.worldX,
      worldY: world.worldY,
      isPrimaryDown,
      phase,
      timestamp: performance.now(),
      source: "pointer",
    };
    this.emitPointer(pointerEvent);
  }

  private emitWheelFromPixi(event: FederatedWheelEvent): void {
    const wheelEvent: WindowWheelEvent = {
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      pointerId: 0,
      worldX: event.global.x,
      worldY: event.global.y,
      timestamp: performance.now(),
      source: "pointer",
    };
    this.emitWheel(wheelEvent);
  }

  private emitDragFromPixi(
    event: FederatedPointerEvent,
    phase: WindowDragEvent["phase"],
  ): void {
    const pointerId = event.pointerId;
    const local = event.getLocalPosition(this.host.stage);
    const world = this.localToWorld(event.global.x, event.global.y);
    const localX = local.x;
    const localY = local.y;
    const worldX = world.worldX;
    const worldY = world.worldY;

    if (phase === "started") {
      this.activeDrags.set(pointerId, {
        localX,
        localY,
        worldX,
        worldY,
        remainderX: 0,
        remainderY: 0,
      });
      this.emitDragSnapshot(pointerId, phase, localX, localY, worldX, worldY, 0, 0);
      return;
    }

    const previous = this.activeDrags.get(pointerId);
    if (previous === undefined) {
      return;
    }

    const totalDeltaX = worldX - previous.worldX + previous.remainderX;
    const totalDeltaY = worldY - previous.worldY + previous.remainderY;
    const deltaX = Math.trunc(totalDeltaX);
    const deltaY = Math.trunc(totalDeltaY);
    const nextDragState = {
      localX,
      localY,
      worldX,
      worldY,
      remainderX: totalDeltaX - deltaX,
      remainderY: totalDeltaY - deltaY,
    };
    if (phase === "moved") {
      this.activeDrags.set(pointerId, nextDragState);
      this.emitDragSnapshot(pointerId, phase, localX, localY, worldX, worldY, deltaX, deltaY);
      return;
    }

    this.activeDrags.delete(pointerId);
    this.emitDragSnapshot(pointerId, phase, localX, localY, worldX, worldY, deltaX, deltaY);
  }

  private emitDragSnapshot(
    pointerId: number,
    phase: WindowDragEvent["phase"],
    localX: number,
    localY: number,
    worldX: number,
    worldY: number,
    deltaX: number,
    deltaY: number,
  ): void {
    const event: WindowDragEvent = {
      phase,
      pointerId,
      localX: Math.trunc(localX),
      localY: Math.trunc(localY),
      worldX: Math.trunc(worldX),
      worldY: Math.trunc(worldY),
      deltaX: Math.trunc(deltaX),
      deltaY: Math.trunc(deltaY),
      timestamp: performance.now(),
      source: "pointer",
    };
    this.emitDrag(event);
  }

  private emitActionSnapshot(
    action: WindowInputAction,
    phase: WindowInputPhase,
    source: WindowInputSource,
  ): void {
    const event: WindowActionEvent = {
      action,
      phase,
      timestamp: performance.now(),
      source,
    };
    this.emitAction(event);
  }

  private actionForKeyCode(keyCode: string): WindowInputAction | null {
    for (const [action, bindingKey] of Object.entries(ACTION_TO_BINDING_KEY)) {
      const codes = this.bindings[bindingKey];
      if (codes.includes(keyCode)) {
        return action as WindowInputAction;
      }
    }
    return null;
  }
}

function mergeBindings(
  partial: PixiWindowInputBindings | undefined,
): Required<PixiWindowInputBindings> {
  return {
    up: partial?.up ?? DEFAULT_BINDINGS.up,
    down: partial?.down ?? DEFAULT_BINDINGS.down,
    left: partial?.left ?? DEFAULT_BINDINGS.left,
    right: partial?.right ?? DEFAULT_BINDINGS.right,
    confirm: partial?.confirm ?? DEFAULT_BINDINGS.confirm,
    cancel: partial?.cancel ?? DEFAULT_BINDINGS.cancel,
    pageUp: partial?.pageUp ?? DEFAULT_BINDINGS.pageUp,
    pageDown: partial?.pageDown ?? DEFAULT_BINDINGS.pageDown,
    skip: partial?.skip ?? DEFAULT_BINDINGS.skip,
  };
}
