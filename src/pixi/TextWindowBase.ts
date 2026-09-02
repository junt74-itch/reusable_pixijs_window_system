import { BitmapText } from "pixi.js";
import { WindowBase, type WindowBaseOptions } from "./WindowBase.ts";
import { createBitmapTextMeasurer, resolveLoadedBitmapFont } from "./PixiBitmapTextMeasurer.ts";
import type { WindowBounds, WindowConfig } from "../core/types.ts";
import { WindowDestroyedError, WindowConfigError } from "../core/types.ts";
import { layoutRichText } from "../text/TextLayout.ts";
import { scaleFontMetrics } from "../text/fontMetrics.ts";
import { collectSpecifiedFontKeys } from "../text/richText.ts";
import { uniqueFontKeys } from "../text/adaptBitmapTextMeasurer.ts";
import { BitmapFontNotLoadedError } from "../text/types.ts";
import type {
  LayoutLine,
  OwnedBitmapTextMeasurer,
  TextLayoutOptions,
  TextLayoutResult,
  WindowTextContent,
} from "../text/types.ts";
import { assertFontSwapAllowed, fontKeyChainsEqual } from "../text/fontFallback.ts";
import type { PixiWindowHost } from "../host/types.ts";

/**
 * Bitmap-text rendering base without message progression.
 */
export abstract class TextWindowBase extends WindowBase {
  protected measurer: OwnedBitmapTextMeasurer;
  protected readonly textObjects: BitmapText[] = [];
  private currentLayout: TextLayoutResult | null = null;

  public constructor(host: PixiWindowHost, config: WindowConfig, options: WindowBaseOptions = {}) {
    super(host, config, options);
    this.measurer = createBitmapTextMeasurer(host, this.theme.text.fontKeys);
    this.applyBitmapSamplingToContent();
  }

  public setFontKey(key: string): this {
    if (this.isDestroyed()) {
      throw new WindowDestroyedError("Window has been destroyed.");
    }
    assertFontSwapAllowed(this.isTextOperationBusy());
    if (key.length === 0) {
      throw new WindowConfigError("text.fontKey must not be empty.");
    }
    if (resolveLoadedBitmapFont(key) === undefined) {
      throw new BitmapFontNotLoadedError(key);
    }
    const fontKeys = [key, ...this.theme.text.fontKeys.filter((existing) => existing !== key)];
    this.replaceMeasurer(fontKeys);
    this.setTheme({
      text: {
        fontKey: key,
        fontKeys,
        fontSize: this.theme.text.fontSize,
        scale: this.theme.text.scale,
        tint: this.theme.text.tint,
        letterSpacing: this.theme.text.letterSpacing,
        lineSpacing: this.theme.text.lineSpacing,
      },
    });
    return this;
  }

  protected isTextOperationBusy(): boolean {
    return false;
  }

  protected getTextBodyOffsetY(): number {
    return 0;
  }

  protected getTextBodyOffsetX(): number {
    return 0;
  }

  protected getTextLayoutWidth(): number {
    return this.getContentBounds().width;
  }

  protected getTextLayoutHeight(): number {
    return this.getContentBounds().height;
  }

  protected layoutTextContent(content: WindowTextContent): TextLayoutResult {
    this.ensureMeasurerForContent(content);
    const options: TextLayoutOptions = {
      width: this.getTextLayoutWidth(),
      height: this.getTextLayoutHeight(),
      style: {
        fontKey: this.theme.text.fontKey,
        fontSize: this.theme.text.fontSize,
        scale: this.theme.text.scale,
        letterSpacing: this.theme.text.letterSpacing,
      },
      lineSpacing: this.theme.text.lineSpacing,
    };
    const result = layoutRichText(content, this.measurer, options);
    this.currentLayout = result;
    return result;
  }

  protected renderLines(lines: readonly LayoutLine[]): void {
    const style = this.theme.text;
    let slot = 0;
    for (const line of lines) {
      for (const run of line.runs) {
        this.ensureTextObjectCount(slot + 1);
        const textObject = this.textObjects[slot];
        if (textObject === undefined) {
          continue;
        }
        textObject.style.fontFamily = run.fontKey;
        textObject.text = run.text;
        textObject.style.fontSize = run.fontSize;
        textObject.scale.set(style.scale);
        textObject.tint = style.tint;
        textObject.style.letterSpacing = style.letterSpacing;
        const runAscent = scaleFontMetrics(
          this.measurer.fontMetrics(run.fontKey),
          run.fontSize,
          style.scale,
        ).ascent;
        textObject.position.set(
          Math.trunc(this.getTextBodyOffsetX() + run.x),
          Math.trunc(this.getTextBodyOffsetY() + line.y + line.ascent - runAscent),
        );
        textObject.visible = true;
        slot += 1;
      }
    }
    for (let index = slot; index < this.textObjects.length; index += 1) {
      this.textObjects[index]!.visible = false;
    }
  }

  protected clearText(): void {
    for (const textObject of this.textObjects) {
      textObject.text = "";
      textObject.visible = false;
    }
    this.currentLayout = null;
  }

  protected getCurrentLayout(): TextLayoutResult | null {
    return this.currentLayout;
  }

  protected override onLayoutChanged(_contentBounds: WindowBounds): void {
    this.syncMeasurerToTheme();
  }

  public override destroy(): void {
    for (const textObject of this.textObjects) {
      textObject.destroy();
    }
    this.textObjects.length = 0;
    this.measurer.destroy();
    super.destroy();
  }

  protected ensureTextObjectCount(count: number): void {
    const style = this.theme.text;
    while (this.textObjects.length < count) {
      const textObject = new BitmapText({
        text: "",
        style: {
          fontFamily: style.fontKey,
          fontSize: style.fontSize,
        },
      });
      textObject.scale.set(style.scale);
      this.applyBitmapSampling(textObject);
      this.getContentContainer().addChild(textObject);
      this.textObjects.push(textObject);
    }
  }

  protected ensureMeasurerForContent(content: WindowTextContent): void {
    this.ensureMeasurerForContents([content]);
  }

  protected ensureMeasurerForContents(contents: readonly WindowTextContent[]): void {
    const specifiedKeys = collectSpecifiedFontKeys(contents);
    for (const key of specifiedKeys) {
      if (resolveLoadedBitmapFont(key) === undefined) {
        throw new BitmapFontNotLoadedError(key);
      }
    }
    const fontKeys = uniqueFontKeys([...this.theme.text.fontKeys, ...specifiedKeys]);
    if (!fontKeyChainsEqual(this.measurer.fontKeys, fontKeys)) {
      this.replaceMeasurer(fontKeys);
    }
  }

  private replaceMeasurer(fontKeys: readonly string[]): void {
    this.measurer.destroy();
    this.measurer = createBitmapTextMeasurer(this.host, fontKeys);
    this.applyBitmapSamplingToContent();
  }

  private syncMeasurerToTheme(): void {
    if (fontKeyChainsEqual(this.measurer.fontKeys, this.theme.text.fontKeys)) {
      return;
    }
    this.replaceMeasurer(this.theme.text.fontKeys);
  }

  private applyBitmapSamplingToContent(): void {
    for (const fontKey of this.measurer.fontKeys) {
      const font = resolveLoadedBitmapFont(fontKey);
      if (font !== undefined) {
        for (const page of font.pages) {
          page.texture.source.scaleMode = "nearest";
        }
      }
    }
  }

  private applyBitmapSampling(target: BitmapText): void {
    this.applyBitmapSamplingToContent();
    target.position.set(Math.trunc(target.x), Math.trunc(target.y));
  }
}
