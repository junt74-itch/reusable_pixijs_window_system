/** Minimal window surface used by the Scene-owned focus controller. */
export interface FocusableWindow {
  activate(): unknown;
  deactivate(): unknown;
  isActive(): boolean;
  isDestroyed(): boolean;
}

export interface FocusAcquireOptions {
  readonly modal?: boolean;
}

export interface FocusSnapshot {
  readonly active: FocusableWindow | null;
  readonly modal: boolean;
  readonly stackDepth: number;
}

export type FocusChangeListener = (snapshot: FocusSnapshot) => void;

export interface FocusChangeSubscription {
  unsubscribe(): void;
}

export class WindowFocusError extends Error {
  public override readonly name = "WindowFocusError";

  public constructor(message: string) {
    super(message);
  }
}
