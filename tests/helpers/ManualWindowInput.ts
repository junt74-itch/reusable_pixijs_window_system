import type {
  WindowDragPhase,
  WindowInputAction,
  WindowInputPhase,
} from "../../src/input/types.ts";
import { BaseWindowInputAdapter } from "../../src/input/WindowInputAdapter.ts";

/**
 * Deterministic manual input adapter for unit tests.
 */
export class ManualWindowInput extends BaseWindowInputAdapter {
  private timestamp = 0;
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

  public pushAction(action: WindowInputAction, phase: WindowInputPhase = "pressed"): void {
    this.emitAction({
      action,
      phase,
      timestamp: this.nextTimestamp(),
      source: "manual",
    });
  }

  public pushPointer(
    localX: number,
    localY: number,
    worldX: number,
    worldY: number,
    isPrimaryDown: boolean,
    phase: WindowInputPhase = "pressed",
  ): void {
    this.emitPointer({
      localX,
      localY,
      worldX,
      worldY,
      isPrimaryDown,
      phase,
      timestamp: this.nextTimestamp(),
      source: "manual",
    });
  }

  public pushWheel(
    deltaX: number,
    deltaY: number,
    options: {
      deltaZ?: number;
      pointerId?: number;
      worldX?: number;
      worldY?: number;
    } = {},
  ): void {
    this.emitWheel({
      deltaX,
      deltaY,
      deltaZ: options.deltaZ ?? 0,
      pointerId: options.pointerId ?? 0,
      worldX: options.worldX ?? 0,
      worldY: options.worldY ?? 0,
      timestamp: this.nextTimestamp(),
      source: "manual",
    });
  }

  public pushDrag(
    phase: WindowDragPhase,
    pointerId: number,
    localX: number,
    localY: number,
    worldX: number,
    worldY: number,
  ): void {
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
    } else {
      this.activeDrags.delete(pointerId);
    }
    this.emitDragSnapshot(pointerId, phase, localX, localY, worldX, worldY, deltaX, deltaY);
  }

  private emitDragSnapshot(
    pointerId: number,
    phase: WindowDragPhase,
    localX: number,
    localY: number,
    worldX: number,
    worldY: number,
    deltaX: number,
    deltaY: number,
  ): void {
    this.emitDrag({
      phase,
      pointerId,
      localX: Math.trunc(localX),
      localY: Math.trunc(localY),
      worldX: Math.trunc(worldX),
      worldY: Math.trunc(worldY),
      deltaX: Math.trunc(deltaX),
      deltaY: Math.trunc(deltaY),
      timestamp: this.nextTimestamp(),
      source: "manual",
    });
  }

  private nextTimestamp(): number {
    this.timestamp += 1;
    return this.timestamp;
  }
}
