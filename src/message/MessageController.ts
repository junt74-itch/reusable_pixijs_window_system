import type { WindowInputAdapter } from "../input/WindowInputAdapter.ts";
import type { MessageAudioHooks, MessageToken } from "./types.ts";
import {
  createInitialTextState,
  getRevealedPageColors,
  getRevealedPageText,
  reduceTextState,
  requiresAdvanceInput,
  type TextState,
  type TextStateEffect,
} from "./TextState.ts";
import { WindowOperationCancelledError } from "../core/types.ts";

export class MessageBusyError extends Error {
  public override readonly name = "MessageBusyError";

  public constructor() {
    super("MessageWindow is already displaying a message.");
  }
}

export interface MessageStartRequest {
  readonly tokens: readonly MessageToken[];
  readonly charsPerSecond: number;
  readonly layoutPageBreaksByPage?: readonly (readonly number[])[];
  readonly autoAdvanceMs?: number;
  readonly autoAdvancePause?: boolean;
  readonly hooks?: MessageAudioHooks;
}

export interface MessageRenderSnapshot {
  readonly revealedText: string;
  readonly revealedColors: readonly (number | null)[];
  readonly pageIndex: number;
  readonly layoutPageIndex: number;
  readonly pausedForAdvance: boolean;
  readonly completed: boolean;
}

type Resolve = (snapshot: MessageRenderSnapshot) => void;
type Reject = (error: Error) => void;

/**
 * Owns one message operation and coordinates parser/layout state with semantic input.
 */
export class MessageController {
  private tokens: readonly MessageToken[] = [];
  private layoutPageBreaksByPage: readonly (readonly number[])[] = [];
  private state: TextState = createInitialTextState();
  private charsPerSecond = 30;
  private busy = false;
  private disposed = false;
  private resolve: Resolve | null = null;
  private reject: Reject | null = null;
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private latestSnapshot: MessageRenderSnapshot = {
    revealedText: "",
    revealedColors: [],
    pageIndex: 0,
    layoutPageIndex: 0,
    pausedForAdvance: false,
    completed: false,
  };
  private autoAdvanceMs = 0;
  private autoAdvancePause = false;
  private autoAdvanceElapsedMs = 0;
  private hooks: MessageAudioHooks = {};
  private readonly snapshotListeners = new Set<(snapshot: MessageRenderSnapshot) => void>();

  public constructor(
    private readonly input: WindowInputAdapter | null,
    private readonly canConsumeInput: () => boolean = () => true,
  ) {}

  public getLatestSnapshot(): MessageRenderSnapshot {
    return this.latestSnapshot;
  }

  public isBusy(): boolean {
    return this.busy;
  }

  public subscribeSnapshot(
    listener: (snapshot: MessageRenderSnapshot) => void,
  ): { unsubscribe(): void } {
    if (this.disposed) {
      return { unsubscribe: () => undefined };
    }
    this.snapshotListeners.add(listener);
    return {
      unsubscribe: () => {
        this.snapshotListeners.delete(listener);
      },
    };
  }

  public start(request: MessageStartRequest): Promise<MessageRenderSnapshot> {
    if (this.disposed) {
      return Promise.reject(new WindowOperationCancelledError("disposed"));
    }
    if (this.busy) {
      return Promise.reject(new MessageBusyError());
    }
    this.busy = true;
    this.tokens = request.tokens;
    this.layoutPageBreaksByPage = request.layoutPageBreaksByPage ?? [];
    this.charsPerSecond = request.charsPerSecond;
    this.autoAdvanceMs = request.autoAdvanceMs ?? 0;
    this.autoAdvancePause = request.autoAdvancePause === true;
    this.autoAdvanceElapsedMs = 0;
    this.hooks = request.hooks ?? {};
    this.state = createInitialTextState();
    this.bindInput();
    this.publishSnapshot();
    return new Promise<MessageRenderSnapshot>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  public update(deltaMs: number): void {
    if (!this.busy || this.disposed) {
      return;
    }
    const previousLength = this.latestSnapshot.revealedText.length;
    const result = reduceTextState(
      this.tokens,
      this.state,
      { deltaMs },
      this.charsPerSecond,
      { layoutPageBreaksByPage: this.layoutPageBreaksByPage },
    );
    this.state = result.state;
    this.emitEffects(result.effects);
    this.publishSnapshot(previousLength);
    if (this.state.completed) {
      this.finish();
      return;
    }
    this.tickAutoAdvance(deltaMs);
  }

  public cancelOperation(reason = "cancelled"): void {
    if (this.busy && !this.disposed) {
      this.hooks.onCancel?.();
    }
    this.finalizePending(new WindowOperationCancelledError(reason));
  }

  public dispose(reason = "disposed"): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.unbindInput();
    this.snapshotListeners.clear();
    this.finalizePending(new WindowOperationCancelledError(reason));
  }

  private bindInput(): void {
    this.unbindInput();
    if (this.input === null) {
      return;
    }
    this.subscriptions.push(
      this.input.subscribeAction((event) => {
        if (
          event.phase !== "pressed" ||
          !this.busy ||
          this.disposed ||
          !this.canConsumeInput()
        ) {
          return;
        }
        if (event.action === "confirm") {
          this.handleConfirm();
        } else if (event.action === "skip") {
          this.handleSkip();
        }
      }),
    );
  }

  private unbindInput(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];
  }

  private handleConfirm(): void {
    if (this.disposed || !this.busy) {
      return;
    }
    this.autoAdvanceElapsedMs = 0;
    this.hooks.onConfirm?.();
    if (requiresAdvanceInput(this.tokens, this.state, this.layoutPageBreaksByPage)) {
      const result = reduceTextState(
        this.tokens,
        this.state,
        { advance: true },
        this.charsPerSecond,
        { layoutPageBreaksByPage: this.layoutPageBreaksByPage },
      );
      this.state = result.state;
      this.emitEffects(result.effects);
      this.publishSnapshot();
      if (this.state.completed) {
        this.finish();
      }
      return;
    }
    this.applySkipOrConfirm();
  }

  private handleSkip(): void {
    this.applySkipOrConfirm();
  }

  private applySkipOrConfirm(): void {
    const result = reduceTextState(
      this.tokens,
      this.state,
      { skip: true },
      this.charsPerSecond,
      { layoutPageBreaksByPage: this.layoutPageBreaksByPage },
    );
    this.state = result.state;
    this.emitEffects(result.effects);
    this.publishSnapshot();
    if (this.state.completed) {
      this.finish();
    }
  }

  private tickAutoAdvance(deltaMs: number): void {
    if (!this.shouldAutoAdvance()) {
      this.autoAdvanceElapsedMs = 0;
      return;
    }
    this.autoAdvanceElapsedMs += deltaMs;
    if (this.autoAdvanceElapsedMs < this.autoAdvanceMs) {
      return;
    }
    this.autoAdvanceElapsedMs = 0;
    const result = reduceTextState(
      this.tokens,
      this.state,
      { advance: true },
      this.charsPerSecond,
      { layoutPageBreaksByPage: this.layoutPageBreaksByPage },
    );
    this.state = result.state;
    this.emitEffects(result.effects);
    this.publishSnapshot();
    if (this.state.completed) {
      this.finish();
    }
  }

  private shouldAutoAdvance(): boolean {
    if (this.autoAdvanceMs <= 0 || !this.state.pausedForAdvance) {
      return false;
    }
    const token = this.tokens[this.state.tokenIndex];
    if (token?.type === "pause" && !this.autoAdvancePause) {
      return false;
    }
    return true;
  }

  private emitEffects(effects: readonly TextStateEffect[]): void {
    if (this.disposed) {
      return;
    }
    for (const effect of effects) {
      if (effect.type === "pageChanged") {
        this.hooks.onPage?.();
      }
    }
  }

  private invokeTypeHooks(previousLength: number): void {
    if (this.disposed) {
      return;
    }
    const nextLength = this.latestSnapshot.revealedText.length;
    if (nextLength <= previousLength) {
      return;
    }
    const count = nextLength - previousLength;
    for (let index = 0; index < count; index += 1) {
      this.hooks.onType?.();
    }
  }

  private publishSnapshot(previousLength?: number): void {
    this.latestSnapshot = {
      revealedText: getRevealedPageText(this.tokens, this.state, this.layoutPageBreaksByPage),
      revealedColors: getRevealedPageColors(this.tokens, this.state, this.layoutPageBreaksByPage),
      pageIndex: this.state.pageIndex,
      layoutPageIndex: this.state.layoutPageIndex,
      pausedForAdvance: requiresAdvanceInput(this.tokens, this.state, this.layoutPageBreaksByPage),
      completed: this.state.completed,
    };
    if (previousLength !== undefined) {
      this.invokeTypeHooks(previousLength);
    }
    if (!this.disposed) {
      for (const listener of [...this.snapshotListeners]) {
        listener(this.latestSnapshot);
      }
    }
  }

  private finish(): void {
    this.finalizePending(this.latestSnapshot);
  }

  private finalizePending(value: MessageRenderSnapshot | Error): void {
    if (!this.busy) {
      return;
    }
    this.busy = false;
    this.unbindInput();
    const resolve = this.resolve;
    const reject = this.reject;
    this.resolve = null;
    this.reject = null;
    if (value instanceof Error) {
      reject?.(value);
    } else {
      resolve?.(value);
    }
  }
}
