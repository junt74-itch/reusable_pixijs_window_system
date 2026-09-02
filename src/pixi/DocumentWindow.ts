import { BitmapText } from "pixi.js";
import type { WindowConfig } from "../core/types.ts";
import type { WindowBounds } from "../core/types.ts";
import { ScrollableWindow, type ScrollableWindowOptions } from "./ScrollableWindow.ts";
import { layoutRichText } from "../text/TextLayout.ts";
import { createBitmapTextMeasurer, resolveLoadedBitmapFont } from "./PixiBitmapTextMeasurer.ts";
import { fontKeyChainsEqual } from "../text/fontFallback.ts";
import { scaleFontMetrics } from "../text/fontMetrics.ts";
import { collectSpecifiedFontKeys, flattenRichText } from "../text/richText.ts";
import { uniqueFontKeys } from "../text/adaptBitmapTextMeasurer.ts";
import { BitmapFontNotLoadedError } from "../text/types.ts";
import type {
  OwnedBitmapTextMeasurer,
  RichText,
  TextLayoutOptions,
  WindowTextContent,
} from "../text/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

const UNBOUNDED_LAYOUT_HEIGHT = 1_000_000;

/**
 * Read-only wrapped document. Input is page/wheel/drag only; there is no typewriter.
 */
export class DocumentWindow extends ScrollableWindow {
  private measurer: OwnedBitmapTextMeasurer;
  private readonly labels: BitmapText[] = [];
  private source: string | RichText = "";
  private ready = false;

  public constructor(
    host: PixiWindowHost,
    config: WindowConfig,
    options: ScrollableWindowOptions = {},
  ) {
    super(host, config, options);
    this.measurer = createBitmapTextMeasurer(host, this.theme.text.fontKeys);
    this.applyBitmapSampling();
    this.ready = true;
  }

  public setDocument(content: string | RichText): void {
    this.source = content;
    this.rebuildLabels();
    this.setScrollOffset(0);
  }

  public getDocument(): string | RichText {
    return this.source;
  }

  public override destroy(): void {
    this.destroyLabels();
    this.measurer.destroy();
    super.destroy();
  }

  protected override onLayoutChanged(contentBounds: WindowBounds): void {
    super.onLayoutChanged(contentBounds);
    if (!this.ready) {
      return;
    }
    if (!this.isContentEmpty()) {
      this.rebuildLabels();
    }
  }

  private isContentEmpty(): boolean {
    return flattenRichText(this.source).text.length === 0;
  }

  private rebuildLabels(): void {
    this.destroyLabels();
    if (this.isContentEmpty()) {
      this.setScrollContentSize(0);
      return;
    }
    this.ensureMeasurerForContent(this.source);
    const content = this.getContentBounds();
    const layout = layoutRichText(this.source, this.measurer, this.createLayoutOptions(content.width));
    const style = this.theme.text;
    for (const line of layout.lines) {
      for (const run of line.runs) {
        const label = new BitmapText({
          text: run.text,
          style: {
            fontFamily: run.fontKey,
            fontSize: run.fontSize,
          },
        });
        label.scale.set(style.scale);
        label.tint = style.tint;
        label.style.letterSpacing = style.letterSpacing;
        const runAscent = scaleFontMetrics(
          this.measurer.fontMetrics(run.fontKey),
          run.fontSize,
          style.scale,
        ).ascent;
        label.position.set(
          Math.trunc(run.x),
          Math.trunc(line.y + line.ascent - runAscent),
        );
        this.getScrollBody().addChild(label);
        this.labels.push(label);
      }
    }
    const last = layout.lines[layout.lines.length - 1];
    if (last !== undefined) {
      this.setScrollContentSize(Math.trunc(last.y + last.height + style.lineSpacing));
    }
  }

  private ensureMeasurerForContent(content: WindowTextContent): void {
    const specifiedKeys = collectSpecifiedFontKeys([content]);
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
    this.applyBitmapSampling();
  }

  private createLayoutOptions(width: number): TextLayoutOptions {
    return {
      width,
      height: UNBOUNDED_LAYOUT_HEIGHT,
      style: {
        fontKey: this.theme.text.fontKey,
        fontSize: this.theme.text.fontSize,
        scale: this.theme.text.scale,
        letterSpacing: this.theme.text.letterSpacing,
      },
      lineSpacing: this.theme.text.lineSpacing,
    };
  }

  private applyBitmapSampling(): void {
    for (const fontKey of this.measurer.fontKeys) {
      const font = resolveLoadedBitmapFont(fontKey);
      if (font !== undefined) {
        for (const page of font.pages) {
          page.texture.source.scaleMode = "nearest";
        }
      }
    }
  }

  private destroyLabels(): void {
    for (const label of this.labels) {
      label.destroy();
    }
    this.labels.length = 0;
  }
}
