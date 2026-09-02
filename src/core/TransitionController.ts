import type { WindowPhase } from "./types.ts";
import { WindowOperationCancelledError } from "./types.ts";

export interface TransitionState {
  readonly phase: WindowPhase;
  readonly openness: number;
}

export interface TransitionSubscription {
  unsubscribe(): void;
}

type TransitionListener = (state: TransitionState) => void;

type TransitionTarget = "open" | "closed";

interface PendingTransition {
  target: TransitionTarget;
  startOpenness: number;
  endOpenness: number;
  durationMs: number;
  elapsedMs: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

/**
 * Pure open/close phase controller without Phaser tweens or wall-clock timers.
 */
export class TransitionController {
  private phase: WindowPhase = "closed";
  private emittedPhase: WindowPhase = "closed";
  private openness = 0;
  private pending: PendingTransition | null = null;
  private disposed = false;
  private readonly listeners = new Set<TransitionListener>();

  public constructor(private readonly defaultDurationMs: number) {}

  public getState(): TransitionState {
    return { phase: this.phase, openness: this.openness };
  }

  public subscribe(listener: TransitionListener): TransitionSubscription {
    if (this.disposed) {
      return { unsubscribe: () => undefined };
    }
    this.listeners.add(listener);
    return {
      unsubscribe: () => {
        this.listeners.delete(listener);
      },
    };
  }

  public open(durationMs?: number): Promise<void> {
    return this.startTransition("open", 1, durationMs ?? this.defaultDurationMs);
  }

  public close(durationMs?: number): Promise<void> {
    return this.startTransition("closed", 0, durationMs ?? this.defaultDurationMs);
  }

  public update(deltaMs: number): void {
    if (!Number.isFinite(deltaMs) || deltaMs < 0 || this.pending === null) {
      return;
    }

    const pending = this.pending;
    pending.elapsedMs += deltaMs;
    const progress =
      pending.durationMs <= 0
        ? 1
        : Math.min(1, pending.elapsedMs / pending.durationMs);
    this.openness = clamp(
      pending.startOpenness + (pending.endOpenness - pending.startOpenness) * progress,
    );
    this.phase = pending.target === "open" ? "opening" : "closing";
    this.emitIfPhaseChanged();

    if (progress >= 1) {
      this.openness = pending.endOpenness;
      this.phase = pending.target === "open" ? "open" : "closed";
      this.pending = null;
      this.emitIfPhaseChanged();
      pending.resolve();
    }
  }

  public dispose(reason = "disposed"): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.cancelPending(new WindowOperationCancelledError(reason));
    this.phase = "closed";
    this.openness = 0;
    this.emitIfPhaseChanged();
    this.listeners.clear();
  }

  private startTransition(
    target: TransitionTarget,
    endOpenness: number,
    durationMs: number,
  ): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new WindowOperationCancelledError("disposed"));
    }

    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return Promise.reject(new Error("durationMs must be a non-negative finite number."));
    }

    if (this.pending !== null && this.pending.target === target) {
      return new Promise<void>((resolve, reject) => {
        const originalResolve = this.pending?.resolve;
        const originalReject = this.pending?.reject;
        if (this.pending === null || originalResolve === undefined || originalReject === undefined) {
          reject(new Error("Transition state lost."));
          return;
        }
        this.pending.resolve = () => {
          originalResolve();
          resolve();
        };
        this.pending.reject = (error: Error) => {
          originalReject(error);
          reject(error);
        };
      });
    }

    if (this.pending !== null) {
      this.cancelPending(new WindowOperationCancelledError(`reversed to ${target}`));
    }

    if (durationMs === 0 || this.openness === endOpenness) {
      this.openness = endOpenness;
      this.phase = target === "open" ? "open" : "closed";
      this.emitIfPhaseChanged();
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.pending = {
        target,
        startOpenness: this.openness,
        endOpenness,
        durationMs,
        elapsedMs: 0,
        resolve: () => resolve(),
        reject: (error: Error) => reject(error),
      };
      this.phase = target === "open" ? "opening" : "closing";
      this.emitIfPhaseChanged();
    });
  }

  private emitIfPhaseChanged(): void {
    if (this.emittedPhase === this.phase) {
      return;
    }
    this.emittedPhase = this.phase;
    const state = this.getState();
    for (const listener of [...this.listeners]) {
      listener(state);
    }
  }

  private cancelPending(error: WindowOperationCancelledError): void {
    const pending = this.pending;
    if (pending === null) {
      return;
    }
    this.pending = null;
    pending.reject(error);
  }
}

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}
