export type MessageToken =
  | { readonly type: "text"; readonly value: string; readonly start: number; readonly end: number }
  | { readonly type: "newline"; readonly start: number; readonly end: number }
  | { readonly type: "pageBreak"; readonly start: number; readonly end: number }
  | { readonly type: "wait"; readonly ms: number; readonly start: number; readonly end: number }
  | { readonly type: "pause"; readonly start: number; readonly end: number }
  | { readonly type: "color"; readonly color: number | null; readonly start: number; readonly end: number }
  | { readonly type: "speed"; readonly charsPerSecond: number; readonly start: number; readonly end: number };

export interface MessageParseResult {
  readonly tokens: readonly MessageToken[];
}

export interface MessagePortraitOptions {
  readonly textureKey: string;
  readonly frame?: string | number;
  readonly width: number;
  readonly height: number;
}

export interface MessageAudioHooks {
  readonly onType?: () => void;
  readonly onPage?: () => void;
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
}

export class MissingMessagePortraitError extends Error {
  public override readonly name = "MissingMessagePortraitError";
  public readonly textureKey: string;

  public constructor(textureKey: string) {
    super(`Message portrait texture "${textureKey}" is not loaded.`);
    this.textureKey = textureKey;
  }
}

