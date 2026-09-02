import type { WindowPhase } from "../core/types.ts";
import type { FocusableWindow, FocusSnapshot } from "../focus/types.ts";

export interface WindowA11ySubscription {
  unsubscribe(): void;
}

export type WindowA11yEvent =
  | {
      readonly type: "windowOpened";
      readonly windowId: string;
      readonly phase: Extract<WindowPhase, "open">;
    }
  | {
      readonly type: "windowClosed";
      readonly windowId: string;
    }
  | {
      readonly type: "selectionChanged";
      readonly windowId: string;
      readonly index: number;
      readonly itemId: string;
      readonly label: string;
    }
  | {
      readonly type: "messagePage";
      readonly windowId: string;
      readonly pageIndex: number;
      readonly layoutPageIndex: number;
      readonly revealedText: string;
      readonly pausedForAdvance: boolean;
    }
  | {
      readonly type: "messageComplete";
      readonly windowId: string;
      readonly revealedText: string;
    }
  | {
      readonly type: "focusAcquired";
      readonly windowId: string;
      readonly modal: boolean;
      readonly stackDepth: number;
    }
  | {
      readonly type: "focusReleased";
      readonly windowId: string;
      readonly modal: boolean;
      readonly stackDepth: number;
    };

export type WindowA11yListener = (event: WindowA11yEvent) => void;

export interface A11yLifecycleSource {
  subscribeTransition(listener: (state: { readonly phase: WindowPhase }) => void): {
    unsubscribe(): void;
  };
}

import type { RichText } from "../text/types.ts";

export interface A11ySelectionItem {
  readonly id: string;
  readonly label: string | RichText;
}

export interface A11ySelectionSource {
  subscribeSelection(
    listener: (index: number, item: A11ySelectionItem | null) => void,
  ): { unsubscribe(): void };
}

export interface A11yMessageSnapshot {
  readonly revealedText: string;
  readonly pageIndex: number;
  readonly layoutPageIndex: number;
  readonly pausedForAdvance: boolean;
  readonly completed: boolean;
}

export interface A11yMessageSource {
  subscribeMessage(listener: (snapshot: A11yMessageSnapshot) => void): { unsubscribe(): void };
}

export interface A11yFocusSource {
  subscribe(listener: (snapshot: FocusSnapshot) => void): { unsubscribe(): void };
  idOf(window: FocusableWindow): string;
}

export interface BindWindowA11yOptions {
  readonly windowId: string;
  readonly listener: WindowA11yListener;
  readonly lifecycle?: A11yLifecycleSource;
  readonly selection?: A11ySelectionSource;
  readonly message?: A11yMessageSource;
  readonly focus?: A11yFocusSource;
}
