import { BitmapText, Cache, Graphics, Sprite, Texture } from "pixi.js";
import type { WindowBaseOptions } from "./WindowBase.ts";
import { TextWindowBase } from "./TextWindowBase.ts";
import type { WindowBounds, WindowConfig } from "../core/types.ts";
import { WindowDestroyedError, WindowLayoutError } from "../core/types.ts";
import { ignoreTransitionCancellation } from "../core/windowOperations.ts";
import { scaleFontMetrics } from "../text/fontMetrics.ts";
import { flattenRichText, resolveRichTextAlign } from "../text/richText.ts";
import { BitmapFontNotLoadedError } from "../text/types.ts";
import type { RichText, WindowTextContent } from "../text/types.ts";
import {
  buildFlatTextFromTokens,
  computeLayoutPageBreaks,
  splitTokensByExplicitPage,
} from "../message/layoutPages.ts";
import { parseMessage } from "../message/MessageParser.ts";
import { splitLineColorRuns } from "../message/colorRuns.ts";
import { collectPageFlatStyles, richTextFromFlat, type FlatCharStyle } from "../message/richTextStyles.ts";
import type {
  MessageAudioHooks,
  MessagePortraitOptions,
  MessageToken,
} from "../message/types.ts";
import { MissingMessagePortraitError } from "../message/types.ts";
import {
  MessageBusyError,
  MessageController,
  type MessageRenderSnapshot,
} from "../message/MessageController.ts";
import {
  assertMessageSayPreflight,
  portraitReservedWidth,
  resolveMessageSayPortrait,
} from "../message/sayPreflight.ts";
import type { PixiWindowHost } from "../host/types.ts";

export interface MessageWindowOptions extends WindowBaseOptions {
  readonly portrait?: MessagePortraitOptions;
  readonly onType?: () => void;
  readonly onPage?: () => void;
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
}

export interface MessageSayOptions {
  readonly charsPerSecond?: number;
  readonly autoOpen?: boolean;
  readonly closeOnComplete?: boolean;
  readonly autoAdvanceMs?: number;
  readonly autoAdvancePause?: boolean;
  readonly portrait?: MessagePortraitOptions | null;
  readonly onType?: () => void;
  readonly onPage?: () => void;
  readonly onConfirm?: () => void;
  readonly onCancel?: () => void;
}

function portraitTextureExists(textureKey: string): boolean {
  return Cache.has(textureKey);
}

function resolvePortraitTexture(textureKey: string, frame?: string | number): Texture {
  if (!Cache.has(textureKey)) {
    throw new MissingMessagePortraitError(textureKey);
  }
  const cached = Cache.get<unknown>(textureKey);
  if (cached instanceof Texture) {
    cached.source.scaleMode = "nearest";
    return cached;
  }
  if (cached !== null && typeof cached === "object" && "textures" in cached) {
    const textures = (cached as { textures: Record<string, Texture> }).textures;
    const frameKey = frame !== undefined ? String(frame) : "0";
    const texture = textures[frameKey];
    if (texture === undefined) {
      throw new MissingMessagePortraitError(textureKey);
    }
    texture.source.scaleMode = "nearest";
    return texture;
  }
  throw new MissingMessagePortraitError(textureKey);
}

/**
 * Message window exposing async `say()` over bitmap text rendering.
 */
export class MessageWindow extends TextWindowBase {
  private readonly controller: MessageController;
  private readonly defaultPortrait: MessagePortraitOptions | null;
  private readonly defaultHooks: MessageAudioHooks;
  private readonly speakerText: BitmapText;
  private readonly pauseIndicator: Graphics;
  private portraitImage: Sprite | null = null;
  private activePortrait: MessagePortraitOptions | null = null;
  private currentSpeaker: string | null = null;
  private sourceText = "";
  private sourceContent: WindowTextContent = "";
  private layoutPageBreaksByPage: number[][] = [];
  private pageFlatStylesByPage: FlatCharStyle[][] = [];

  public constructor(host: PixiWindowHost, config: WindowConfig, options: MessageWindowOptions = {}) {
    super(host, config, options);
    this.controller = new MessageController(this.getInputAdapter(), () => this.canConsumeInput());
    this.defaultPortrait = options.portrait ?? null;
    this.defaultHooks = {
      ...(options.onType !== undefined ? { onType: options.onType } : {}),
      ...(options.onPage !== undefined ? { onPage: options.onPage } : {}),
      ...(options.onConfirm !== undefined ? { onConfirm: options.onConfirm } : {}),
      ...(options.onCancel !== undefined ? { onCancel: options.onCancel } : {}),
    };
    const style = this.theme.text;
    this.speakerText = new BitmapText({
      text: "",
      style: {
        fontFamily: style.fontKey,
        fontSize: style.fontSize,
      },
    });
    this.speakerText.scale.set(style.scale);
    this.speakerText.visible = false;
    this.getContentContainer().addChild(this.speakerText);
    this.pauseIndicator = new Graphics();
    this.pauseIndicator.visible = false;
    this.getContentContainer().addChild(this.pauseIndicator);
  }

  public say(
    speaker: string | null,
    content: string | RichText,
    options: MessageSayOptions = {},
  ): Promise<MessageRenderSnapshot> {
    const charsPerSecond = options.charsPerSecond ?? 30;
    const autoOpen = options.autoOpen ?? true;
    const closeOnComplete = options.closeOnComplete ?? false;
    const portrait = resolveMessageSayPortrait(options.portrait, this.defaultPortrait);
    try {
      assertMessageSayPreflight({
        destroyed: this.isDestroyed(),
        busy: this.controller.isBusy(),
        portrait,
        textureExists: portraitTextureExists,
        contentWidth: this.getContentBounds().width,
      });
    } catch (error) {
      if (error instanceof MessageBusyError || error instanceof WindowDestroyedError) {
        return Promise.reject(error);
      }
      throw error;
    }

    try {
      this.ensureMeasurerForContent(content);
    } catch (error) {
      if (error instanceof BitmapFontNotLoadedError) {
        return Promise.reject(error);
      }
      throw error;
    }

    const rawText = typeof content === "string" ? content : flattenRichText(content).text;
    this.sourceText = rawText;
    this.sourceContent = content;
    this.currentSpeaker = speaker;
    this.applyPortrait(portrait);
    this.updateSpeakerLine();
    const parsed = parseMessage(rawText);
    this.layoutPageBreaksByPage = this.computeLayoutPageBreaksByPage(parsed.tokens);
    this.pageFlatStylesByPage = splitTokensByExplicitPage(parsed.tokens).map((pageTokens) =>
      collectPageFlatStyles(pageTokens, content),
    );

    if (autoOpen) {
      ignoreTransitionCancellation(this.open());
      this.activate();
      this.show();
    }

    const hooks = this.mergeHooks(options);
    return this.controller
      .start({
        tokens: parsed.tokens,
        charsPerSecond,
        layoutPageBreaksByPage: this.layoutPageBreaksByPage,
        ...(options.autoAdvanceMs !== undefined ? { autoAdvanceMs: options.autoAdvanceMs } : {}),
        ...(options.autoAdvancePause !== undefined
          ? { autoAdvancePause: options.autoAdvancePause }
          : {}),
        ...(hasHook(hooks) ? { hooks } : {}),
      })
      .then(async (snapshot) => {
        if (closeOnComplete) {
          await this.close();
          this.deactivate();
        }
        return snapshot;
      });
  }

  public subscribeMessage(
    listener: (snapshot: MessageRenderSnapshot) => void,
  ): { unsubscribe(): void } {
    return this.controller.subscribeSnapshot(listener);
  }

  public override update(time: number, delta: number): void {
    super.update(time, delta);
    this.controller.update(delta);
    const snapshot = this.controller.getLatestSnapshot();
    this.renderRevealed(
      snapshot.revealedText,
      snapshot.revealedColors,
      snapshot.pageIndex,
      snapshot.layoutPageIndex,
    );
    this.pauseIndicator.visible = snapshot.pausedForAdvance;
    if (snapshot.pausedForAdvance) {
      this.redrawPauseIndicator();
    }
  }

  public override destroy(): void {
    this.controller.dispose("destroyed");
    this.destroyPortrait();
    this.speakerText.destroy();
    this.pauseIndicator.destroy();
    super.destroy();
  }

  protected override getTextBodyOffsetY(): number {
    return this.getSpeakerReservedHeight();
  }

  protected override getTextBodyOffsetX(): number {
    return this.getPortraitReservedWidth();
  }

  protected override getTextLayoutWidth(): number {
    const width = this.getContentBounds().width - this.getPortraitReservedWidth();
    if (width <= 0) {
      throw new WindowLayoutError("Portrait column leaves no room for message text.");
    }
    return width;
  }

  protected override getTextLayoutHeight(): number {
    const bounds = this.getContentBounds();
    return Math.max(0, bounds.height - this.getSpeakerReservedHeight());
  }

  protected override onLayoutChanged(_contentBounds: WindowBounds): void {
    super.onLayoutChanged(_contentBounds);
    if (this.sourceText.length > 0) {
      const parsed = parseMessage(this.sourceText);
      this.layoutPageBreaksByPage = this.computeLayoutPageBreaksByPage(parsed.tokens);
      this.pageFlatStylesByPage = splitTokensByExplicitPage(parsed.tokens).map((pageTokens) =>
        collectPageFlatStyles(pageTokens, this.sourceContent),
      );
      this.updateSpeakerLine();
      this.layoutPortrait();
    }
  }

  protected override isTextOperationBusy(): boolean {
    return this.controller.isBusy();
  }

  private mergeHooks(options: MessageSayOptions): MessageAudioHooks {
    return {
      ...(this.defaultHooks.onType !== undefined || options.onType !== undefined
        ? { onType: options.onType ?? this.defaultHooks.onType }
        : {}),
      ...(this.defaultHooks.onPage !== undefined || options.onPage !== undefined
        ? { onPage: options.onPage ?? this.defaultHooks.onPage }
        : {}),
      ...(this.defaultHooks.onConfirm !== undefined || options.onConfirm !== undefined
        ? { onConfirm: options.onConfirm ?? this.defaultHooks.onConfirm }
        : {}),
      ...(this.defaultHooks.onCancel !== undefined || options.onCancel !== undefined
        ? { onCancel: options.onCancel ?? this.defaultHooks.onCancel }
        : {}),
    };
  }

  private applyPortrait(portrait: MessagePortraitOptions | null): void {
    if (portrait !== null && !portraitTextureExists(portrait.textureKey)) {
      throw new MissingMessagePortraitError(portrait.textureKey);
    }
    this.destroyPortrait();
    this.activePortrait = portrait;
    if (portrait === null) {
      return;
    }
    const texture = resolvePortraitTexture(portrait.textureKey, portrait.frame);
    const image = new Sprite(texture);
    image.anchor.set(0, 0);
    image.position.set(0, 0);
    this.getContentContainer().addChild(image);
    this.portraitImage = image;
    this.layoutPortrait();
  }

  private layoutPortrait(): void {
    const image = this.portraitImage;
    const portrait = this.activePortrait;
    if (image === null || portrait === null) {
      return;
    }
    const width = Math.trunc(portrait.width);
    const height = Math.trunc(portrait.height);
    image.position.set(0, 0);
    image.width = width;
    image.height = height;
  }

  private destroyPortrait(): void {
    this.portraitImage?.destroy();
    this.portraitImage = null;
    this.activePortrait = null;
  }

  private getPortraitReservedWidth(): number {
    return portraitReservedWidth(this.activePortrait);
  }

  private computeLayoutPageBreaksByPage(tokens: readonly MessageToken[]): number[][] {
    const align = resolveRichTextAlign(this.sourceContent);
    return splitTokensByExplicitPage(tokens).map((pageTokens) => {
      const flatText = buildFlatTextFromTokens(pageTokens);
      if (flatText.length === 0) {
        return [];
      }
      const styles = collectPageFlatStyles(pageTokens, this.sourceContent);
      const richText = richTextFromFlat(flatText, styles, align);
      const layout = this.layoutTextContent(richText);
      return computeLayoutPageBreaks(layout.lines);
    });
  }

  private getSpeakerReservedHeight(): number {
    if (this.currentSpeaker === null || this.currentSpeaker.length === 0) {
      return 0;
    }
    const style = this.theme.text;
    return Math.trunc(style.fontSize * style.scale + 4 + style.lineSpacing);
  }

  private renderRevealed(
    revealedText: string,
    colors: readonly (number | null)[],
    pageIndex: number,
    layoutPageIndex: number,
  ): void {
    if (revealedText.length === 0) {
      for (let index = 0; index < this.textObjects.length; index += 1) {
        this.textObjects[index]!.visible = false;
      }
      return;
    }

    const pageStyles = this.pageFlatStylesByPage[pageIndex] ?? [];
    const layoutPageBreaks = this.layoutPageBreaksByPage[pageIndex] ?? [];
    const layoutStart =
      layoutPageIndex === 0 ? 0 : (layoutPageBreaks[layoutPageIndex - 1] ?? 0);
    const styles = pageStyles.slice(layoutStart, layoutStart + revealedText.length);
    const align = resolveRichTextAlign(this.sourceContent);
    const layout = this.layoutTextContent(richTextFromFlat(revealedText, styles, align));
    const themeStyle = this.theme.text;
    const offsetX = this.getTextBodyOffsetX();
    const offsetY = this.getTextBodyOffsetY();
    let slot = 0;

    for (const line of layout.lines) {
      let utf16OffsetInLine = 0;
      for (const run of line.runs) {
        const colorRuns = splitLineColorRuns(
          run.text,
          line.sourceRange.start + utf16OffsetInLine,
          colors,
        );
        let x = offsetX + run.x;
        const runAscent = scaleFontMetrics(
          this.measurer.fontMetrics(run.fontKey),
          run.fontSize,
          themeStyle.scale,
        ).ascent;
        const y = Math.trunc(offsetY + line.y + line.ascent - runAscent);

        for (const colorRun of colorRuns) {
          this.ensureTextObjectCount(slot + 1);
          const textObject = this.textObjects[slot];
          if (textObject === undefined) {
            continue;
          }
          textObject.style.fontFamily = run.fontKey;
          textObject.text = colorRun.text;
          textObject.style.fontSize = run.fontSize;
          textObject.scale.set(themeStyle.scale);
          textObject.tint = colorRun.color ?? themeStyle.tint;
          textObject.style.letterSpacing = themeStyle.letterSpacing;
          textObject.position.set(Math.trunc(x), y);
          textObject.visible = true;
          if (colorRun.text.length > 0) {
            x += this.measurer.measureRun(colorRun.text, {
              fontKey: run.fontKey,
              fontSize: run.fontSize,
              scale: themeStyle.scale,
              letterSpacing: themeStyle.letterSpacing,
            }).width;
          }
          slot += 1;
        }
        utf16OffsetInLine += run.text.length;
      }
    }

    for (let index = slot; index < this.textObjects.length; index += 1) {
      this.textObjects[index]!.visible = false;
    }
  }

  private updateSpeakerLine(): void {
    const style = this.theme.text;
    if (this.currentSpeaker === null || this.currentSpeaker.length === 0) {
      this.speakerText.visible = false;
      return;
    }
    this.speakerText.style.fontFamily = style.fontKey;
    this.speakerText.text = this.currentSpeaker;
    this.speakerText.style.fontSize = style.fontSize;
    this.speakerText.scale.set(style.scale);
    this.speakerText.tint = style.tint;
    this.speakerText.visible = true;
    this.speakerText.position.set(Math.trunc(this.getTextBodyOffsetX()), 0);
  }

  private redrawPauseIndicator(): void {
    const bounds = this.getContentBounds();
    this.pauseIndicator.clear();
    this.pauseIndicator
      .poly([
        bounds.width - 24,
        bounds.height - 16,
        bounds.width - 8,
        bounds.height - 16,
        bounds.width - 16,
        bounds.height - 6,
      ])
      .fill({ color: 0xffffff, alpha: 1 });
  }
}

function hasHook(hooks: MessageAudioHooks): boolean {
  return (
    hooks.onType !== undefined ||
    hooks.onPage !== undefined ||
    hooks.onConfirm !== undefined ||
    hooks.onCancel !== undefined
  );
}

export { MessageBusyError, MissingMessagePortraitError, WindowDestroyedError };
