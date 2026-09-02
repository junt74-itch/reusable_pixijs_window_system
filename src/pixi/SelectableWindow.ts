import { BitmapText, Container } from "pixi.js";
import type { WindowInputPhase } from "../input/types.ts";
import type { WindowBounds, WindowConfig } from "../core/types.ts";
import type { WindowBaseOptions } from "./WindowBase.ts";
import { TextWindowBase } from "./TextWindowBase.ts";
import { assertMeasurerHasGlyphs } from "../text/fontFallback.ts";
import { scaleFontMetrics } from "../text/fontMetrics.ts";
import { flattenRichText, resolveRichTextAlign } from "../text/richText.ts";
import { layoutRichText } from "../text/TextLayout.ts";
import type { RichText, TextAlign, WindowTextContent } from "../text/types.ts";
import { ScrollController } from "../scroll/ScrollController.ts";
import { ScrollContentClip } from "./ScrollContentClip.ts";
import { ScrollbarRenderer } from "./ScrollbarRenderer.ts";
import { bindScrollInput, createScrollbarContentDragGate } from "../scroll/scrollInputBinding.ts";
import { isPointInContentViewport } from "../scroll/scrollChrome.ts";
import {
  computeScrollOffsetToReveal,
  computeVisibleRowRange,
  hitTestRowAtContentLocal,
} from "../scroll/scrollVisibility.ts";
import { CursorRenderer } from "./CursorRenderer.ts";
import { SelectionController } from "../selection/SelectionController.ts";
import type { SelectableItem, SelectionControllerOptions } from "../selection/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

export interface SelectableWindowOptions extends WindowBaseOptions, SelectionControllerOptions {
  readonly rowHeight?: number;
  readonly columnGap?: number;
  readonly rowGap?: number;
  readonly showScrollbar?: boolean;
  readonly rowOverscanPx?: number;
}

export interface RowBounds {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const DEFAULT_ROW_OVERSCAN_PX = 24;
const ROW_LABEL_LAYOUT_WIDTH = 1_000_000;
const ROW_LABEL_LAYOUT_HEIGHT = 1_000_000;

function truncateLabelAtNewline(content: WindowTextContent): WindowTextContent {
  if (typeof content === "string") {
    const newlineIndex = content.indexOf("\n");
    return newlineIndex >= 0 ? content.slice(0, newlineIndex) : content;
  }
  const spans: RichText["spans"][number][] = [];
  for (const span of content.spans) {
    const newlineIndex = span.text.indexOf("\n");
    if (newlineIndex >= 0) {
      if (newlineIndex > 0) {
        spans.push({
          text: span.text.slice(0, newlineIndex),
          ...(span.fontKey !== undefined ? { fontKey: span.fontKey } : {}),
          ...(span.fontSize !== undefined ? { fontSize: span.fontSize } : {}),
        });
      }
      break;
    }
    spans.push(span);
  }
  return { spans };
}

function computeRowLabelAlignOffset(
  align: TextAlign,
  lineWidth: number,
  availableWidth: number,
): number {
  if (lineWidth > availableWidth) {
    return 0;
  }
  if (align === "center") {
    return Math.trunc((availableWidth - lineWidth) / 2);
  }
  if (align === "right") {
    return availableWidth - lineWidth;
  }
  return 0;
}

/**
 * Renders selectable rows and connects semantic input to {@link SelectionController}.
 */
export abstract class SelectableWindow<T> extends TextWindowBase {
  protected readonly controller: SelectionController<T>;
  protected readonly scrollController: ScrollController;
  protected readonly scrollBody: Container;
  private readonly scrollClip: ScrollContentClip;
  private readonly rowLabels: BitmapText[] = [];
  private readonly cursor: CursorRenderer;
  private readonly rowHeight: number;
  private readonly columnGap: number;
  private readonly rowGap: number;
  private readonly columns: number;
  private readonly rowOverscanPx: number;
  private readonly showScrollbar: boolean;
  private items: readonly SelectableItem<T>[] = [];
  private rowBounds: RowBounds[] = [];
  private pointerDownIndex: number | null = null;
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private scrollInputBinding: { unsubscribe: () => void } | null = null;
  private scrollSubscription: { unsubscribe: () => void } | null = null;
  private scrollbar: ScrollbarRenderer | null = null;
  private scrollEnabled = false;

  public constructor(
    host: PixiWindowHost,
    config: WindowConfig,
    options: SelectableWindowOptions = {},
  ) {
    super(host, config, options);
    this.controller = new SelectionController<T>(options);
    this.scrollController = new ScrollController();
    this.columns = Math.max(1, options.columns ?? 1);
    this.rowHeight = options.rowHeight ?? this.theme.text.fontSize * this.theme.text.scale + 8;
    this.columnGap = options.columnGap ?? 8;
    this.rowGap = options.rowGap ?? 4;
    this.rowOverscanPx = options.rowOverscanPx ?? DEFAULT_ROW_OVERSCAN_PX;
    this.showScrollbar = options.showScrollbar ?? false;
    this.scrollClip = new ScrollContentClip(host, this.getContentContainer());
    this.scrollBody = new Container();
    this.scrollClip.getViewport().addChild(this.scrollBody);
    const initialContent = this.getContentBounds();
    this.scrollClip.updateBounds(initialContent.width, initialContent.height);
    this.cursor = new CursorRenderer(this.scrollBody);
    this.bindControllerEvents();
    this.bindInput();
    this.scrollSubscription = this.scrollController.subscribe(() => {
      this.applyScrollOffset();
      this.refreshRowVisuals();
      this.refreshCursor();
      this.scrollbar?.update();
      this.cullScrollBody();
    });
    if (this.showScrollbar) {
      this.scrollbar = new ScrollbarRenderer(this.getContentContainer(), this.scrollController, {
        getContentWidth: () => this.getContentBounds().width,
        getContentHeight: () => this.getContentBounds().height,
      });
      const input = this.getInputAdapter();
      if (input !== null) {
        this.scrollbar.bindPointer(input, {
          canConsumeInput: () => this.canConsumeInput(),
          toContentLocal: (worldX, worldY) => this.worldToContentLocal(worldX, worldY),
        });
      }
    }
    this.bindScrollInput();
  }

  public setItems(items: readonly SelectableItem<T>[]): void {
    this.items = items;
    this.controller.setItems(items);
    this.relayoutRows();
    this.ensureSelectedVisible();
    this.refreshRowVisuals();
    this.refreshCursor();
    this.scrollbar?.update();
  }

  public getItems(): readonly SelectableItem<T>[] {
    return this.items;
  }

  public select(index: number): void {
    if (this.controller.selectIndex(index)) {
      this.ensureSelectedVisible();
      this.refreshCursor();
    }
  }

  public getSelectedIndex(): number {
    return this.controller.getSelectedIndex();
  }

  public getSelectedItem(): SelectableItem<T> | null {
    return this.controller.getSelectedItem();
  }

  public subscribeSelection(
    listener: (index: number, item: SelectableItem<T> | null) => void,
  ): { unsubscribe(): void } {
    return this.controller.onChange(listener);
  }

  protected getRowBounds(): readonly RowBounds[] {
    return this.rowBounds;
  }

  protected abstract onSelectionConfirmed(index: number, item: SelectableItem<T>): void;

  protected abstract onSelectionCancelled(): void;

  public override update(time: number, delta: number): void {
    super.update(time, delta);
    this.cursor.update(delta);
  }

  public override destroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions = [];
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;
    this.scrollInputBinding?.unsubscribe();
    this.scrollInputBinding = null;
    this.scrollbar?.destroy();
    this.scrollbar = null;
    this.scrollClip.destroy();
    for (const label of this.rowLabels) {
      label.destroy();
    }
    this.rowLabels.length = 0;
    this.cursor.destroy();
    this.controller.dispose();
    super.destroy();
  }

  protected override onLayoutChanged(_contentBounds: WindowBounds): void {
    super.onLayoutChanged(_contentBounds);
    const content = this.getContentBounds();
    this.scrollClip.updateBounds(content.width, content.height);
    this.relayoutRows();
    this.ensureSelectedVisible();
    this.refreshRowVisuals();
    this.refreshCursor();
    this.scrollbar?.update();
  }

  private bindControllerEvents(): void {
    this.subscriptions.push(
      this.controller.onChange(() => {
        this.ensureSelectedVisible();
        this.refreshRowVisuals();
        this.refreshCursor();
      }),
      this.controller.onConfirm((index, item) => {
        this.onSelectionConfirmed(index, item);
      }),
      this.controller.onCancel(() => {
        this.onSelectionCancelled();
      }),
    );
  }

  private bindInput(): void {
    const input = this.getInputAdapter();
    if (input === null) {
      return;
    }
    this.subscriptions.push(
      input.subscribeAction((event) => {
        if (!this.canConsumeInput() || event.phase !== "pressed") {
          return;
        }
        if (event.action === "confirm") {
          this.controller.confirm();
        } else if (event.action === "cancel") {
          this.controller.cancel();
        } else if (
          event.action === "up" ||
          event.action === "down" ||
          event.action === "left" ||
          event.action === "right"
        ) {
          this.controller.move(event.action);
        }
      }),
      input.subscribePointer((event) => {
        const local = this.worldToContentLocal(event.worldX, event.worldY);
        this.handlePointer(local.x, local.y, event.phase, event.isPrimaryDown);
      }),
    );
  }

  private bindScrollInput(): void {
    const input = this.getInputAdapter();
    if (input === null) {
      return;
    }
    this.scrollInputBinding = bindScrollInput(input, this.scrollController, {
      canConsumeInput: () => this.canConsumeInput(),
      allowContentDrag: createScrollbarContentDragGate(this.scrollbar, (worldX, worldY) =>
        this.worldToContentLocal(worldX, worldY),
      ),
    });
  }

  private isPointerInInteractiveContent(localX: number, localY: number): boolean {
    if (this.scrollbar?.isPointerCaptured() === true) {
      return false;
    }
    const content = this.getContentBounds();
    return isPointInContentViewport(
      localX,
      localY,
      content.width,
      content.height,
      this.scrollbar?.getTrackRect() ?? null,
    );
  }

  private handlePointer(
    localX: number,
    localY: number,
    phase: WindowInputPhase,
    isPrimaryDown: boolean,
  ): void {
    if (!this.canConsumeInput()) {
      return;
    }
    if (!this.isPointerInInteractiveContent(localX, localY)) {
      if (phase === "released") {
        this.pointerDownIndex = null;
      }
      return;
    }
    const index = this.hitTestRow(localX, localY);
    if (index !== null && (phase === "pressed" || phase === "repeated")) {
      this.select(index);
    }
    if (phase === "pressed" && isPrimaryDown) {
      this.pointerDownIndex = index;
      return;
    }
    if (phase === "released") {
      if (index !== null && index === this.pointerDownIndex) {
        const item = this.items[index];
        if (item?.enabled === true && this.controller.getSelectedIndex() === index) {
          this.controller.confirm();
        }
      }
      this.pointerDownIndex = null;
    }
  }

  private relayoutRows(): void {
    const content = this.getContentBounds();
    const columnWidth = Math.floor(
      (content.width - this.columnGap * (this.columns - 1)) / this.columns,
    );
    this.rowBounds = this.items.map((_, index) => {
      const column = index % this.columns;
      const row = Math.floor(index / this.columns);
      return {
        index,
        x: column * (columnWidth + this.columnGap),
        y: row * (this.rowHeight + this.rowGap),
        width: columnWidth,
        height: this.rowHeight,
      };
    });
    const last = this.rowBounds[this.rowBounds.length - 1];
    const requiredHeight = last === undefined ? 0 : last.y + last.height;
    this.scrollEnabled = requiredHeight > content.height;
    this.scrollController.setViewportSize(content.height);
    this.scrollController.setContentSize(requiredHeight);
    if (!this.scrollEnabled) {
      this.scrollController.setOffset(0);
    }
    this.applyScrollOffset();
  }

  private refreshRowVisuals(): void {
    const visibleRange = this.getVisibleRowRange();
    const style = this.theme.text;
    this.ensureMeasurerForContents(this.items.map((item) => truncateLabelAtNewline(item.label)));
    let slot = 0;
    for (let index = visibleRange.start; index <= visibleRange.end; index += 1) {
      const item = this.items[index];
      const bounds = this.rowBounds[index];
      if (item === undefined || bounds === undefined) {
        continue;
      }
      const labelContent = truncateLabelAtNewline(item.label);
      const flattened = flattenRichText(labelContent);
      assertMeasurerHasGlyphs(flattened.text, this.measurer);
      const align = resolveRichTextAlign(item.label);
      const layout = layoutRichText(labelContent, this.measurer, {
        width: ROW_LABEL_LAYOUT_WIDTH,
        height: ROW_LABEL_LAYOUT_HEIGHT,
        style: {
          fontKey: style.fontKey,
          fontSize: style.fontSize,
          scale: style.scale,
          letterSpacing: style.letterSpacing,
        },
        lineSpacing: 0,
        align: "left",
      });
      const line = layout.lines[0];
      if (line === undefined) {
        continue;
      }
      const alignOffset = computeRowLabelAlignOffset(align, line.width, bounds.width);
      for (const run of line.runs) {
        this.ensureRowLabelCount(slot + 1);
        const label = this.rowLabels[slot];
        if (label === undefined) {
          continue;
        }
        label.style.fontFamily = run.fontKey;
        label.text = run.text;
        label.style.fontSize = run.fontSize;
        label.scale.set(style.scale);
        label.style.letterSpacing = style.letterSpacing;
        const runAscent = scaleFontMetrics(
          this.measurer.fontMetrics(run.fontKey),
          run.fontSize,
          style.scale,
        ).ascent;
        label.position.set(
          Math.trunc(bounds.x + alignOffset + run.x),
          Math.trunc(bounds.y + 4 + line.ascent - runAscent),
        );
        label.tint = item.enabled ? style.tint : 0x888888;
        label.alpha = item.enabled ? 1 : 0.5;
        label.visible = true;
        slot += 1;
      }
    }
    for (let index = slot; index < this.rowLabels.length; index += 1) {
      this.rowLabels[index]!.visible = false;
    }
  }

  private ensureRowLabelCount(count: number): void {
    const style = this.theme.text;
    while (this.rowLabels.length < count) {
      const label = new BitmapText({
        text: "",
        style: {
          fontFamily: style.fontKey,
          fontSize: style.fontSize,
        },
      });
      label.scale.set(style.scale);
      this.scrollBody.addChild(label);
      this.rowLabels.push(label);
    }
  }

  private refreshCursor(): void {
    const index = this.controller.getSelectedIndex();
    const bounds = index >= 0 ? this.rowBounds[index] : undefined;
    if (bounds === undefined) {
      this.cursor.hide();
      return;
    }
    this.cursor.draw(
      { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      this.theme,
    );
  }

  private hitTestRow(localX: number, localY: number): number | null {
    const content = this.getContentBounds();
    const offset = this.scrollEnabled ? this.scrollController.getBounds().offset : 0;
    return hitTestRowAtContentLocal(
      localX,
      localY,
      offset,
      content.width,
      content.height,
      this.scrollbar?.getTrackRect() ?? null,
      this.rowBounds,
    );
  }

  private getVisibleRowRange(): { start: number; end: number } {
    const offset = this.scrollEnabled ? this.scrollController.getBounds().offset : 0;
    return computeVisibleRowRange(
      this.rowBounds.map((row) => row.y),
      this.rowBounds.map((row) => row.height),
      offset,
      this.getContentBounds().height,
      this.rowOverscanPx,
    );
  }

  private ensureSelectedVisible(): void {
    if (!this.scrollEnabled) {
      return;
    }
    const index = this.controller.getSelectedIndex();
    const bounds = index >= 0 ? this.rowBounds[index] : undefined;
    if (bounds === undefined) {
      return;
    }
    const viewport = this.getContentBounds().height;
    const currentOffset = this.scrollController.getBounds().offset;
    const nextOffset = computeScrollOffsetToReveal(
      bounds.y,
      bounds.y + bounds.height,
      viewport,
      currentOffset,
    );
    if (nextOffset !== null) {
      this.scrollController.setOffset(nextOffset);
    }
  }

  private applyScrollOffset(): void {
    const offset = this.scrollController.getBounds().offset;
    this.scrollBody.position.set(0, this.scrollEnabled ? Math.trunc(-offset) : 0);
    this.cullScrollBody();
  }

  private cullScrollBody(): void {
    this.scrollClip.cullChildren(
      this.scrollBody,
      this.scrollEnabled ? this.scrollController.getBounds().offset : 0,
      "y",
    );
  }
}
