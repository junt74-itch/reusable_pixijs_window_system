import { BitmapText } from "pixi.js";
import type { WindowConfig } from "../core/types.ts";
import type { WindowBounds } from "../core/types.ts";
import { ScrollableWindow, type ScrollableWindowOptions } from "./ScrollableWindow.ts";
import { layoutRichText } from "../text/TextLayout.ts";
import { createBitmapTextMeasurer, resolveLoadedBitmapFont } from "./PixiBitmapTextMeasurer.ts";
import { fontKeyChainsEqual } from "../text/fontFallback.ts";
import { scaleFontMetrics } from "../text/fontMetrics.ts";
import { collectSpecifiedFontKeys } from "../text/richText.ts";
import { uniqueFontKeys } from "../text/adaptBitmapTextMeasurer.ts";
import { BitmapFontNotLoadedError } from "../text/types.ts";
import type { OwnedBitmapTextMeasurer, RichText, TextLayoutOptions } from "../text/types.ts";
import { shouldStickToLatest } from "../log/stickToLatest.ts";
import type { PixiWindowHost } from "../host/types.ts";

const UNBOUNDED_LAYOUT_HEIGHT = 1_000_000;

/**
 * Append-only log. Sticks to the latest line only when the viewer is already at the bottom.
 */
export class LogWindow extends ScrollableWindow {
  private measurer: OwnedBitmapTextMeasurer;
  private readonly entries: (string | RichText)[] = [];
  private readonly labels: BitmapText[] = [];
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

  public append(content: string | RichText): void {
    this.entries.push(content);
    const bounds = this.scrollController.getBounds();
    const stick = shouldStickToLatest(bounds.offset, bounds.maxOffset);
    this.rebuildLabels();
    if (stick) {
      this.setScrollOffset(this.scrollController.getBounds().maxOffset);
    }
  }

  public clear(): void {
    this.entries.length = 0;
    this.destroyLabels();
    this.setScrollContentSize(0);
    this.setScrollOffset(0);
  }

  public getEntries(): readonly (string | RichText)[] {
    return this.entries;
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
    const bounds = this.scrollController.getBounds();
    const stick = shouldStickToLatest(bounds.offset, bounds.maxOffset);
    this.rebuildLabels();
    if (stick) {
      this.setScrollOffset(this.scrollController.getBounds().maxOffset);
    }
  }

  private rebuildLabels(): void {
    this.destroyLabels();
    if (this.entries.length === 0) {
      this.setScrollContentSize(0);
      return;
    }
    this.ensureMeasurerForEntries();
    const content = this.getContentBounds();
    const style = this.theme.text;
    const layoutOptions = this.createLayoutOptions(content.width);
    let cursorY = 0;
    for (const entry of this.entries) {
      const layout = layoutRichText(entry, this.measurer, layoutOptions);
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
            Math.trunc(cursorY + line.y + line.ascent - runAscent),
          );
          this.getScrollBody().addChild(label);
          this.labels.push(label);
        }
      }
      const last = layout.lines[layout.lines.length - 1];
      cursorY += last !== undefined ? Math.trunc(last.y + last.height + style.lineSpacing) : 0;
    }
    this.setScrollContentSize(cursorY);
  }

  private ensureMeasurerForEntries(): void {
    const specifiedKeys = collectSpecifiedFontKeys(this.entries);
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
