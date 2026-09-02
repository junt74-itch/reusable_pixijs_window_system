import { Container } from "pixi.js";
import type { WindowConfig } from "../core/types.ts";
import type { WindowBounds } from "../core/types.ts";
import { ScrollController } from "../scroll/ScrollController.ts";
import {
  bindScrollInput,
  createScrollbarContentDragGate,
  type ScrollInputBinding,
} from "../scroll/scrollInputBinding.ts";
import type { ScrollControllerOptions } from "../scroll/types.ts";
import type { PixiWindowHost } from "../host/types.ts";
import { WindowBase, type WindowBaseOptions } from "./WindowBase.ts";
import { ScrollContentClip } from "./ScrollContentClip.ts";
import { ScrollOverflowIndicators } from "./ScrollOverflowIndicators.ts";
import { ScrollbarRenderer } from "./ScrollbarRenderer.ts";

export interface ScrollableWindowOptions extends WindowBaseOptions, ScrollControllerOptions {
  readonly showScrollbar?: boolean;
}

/**
 * Window base that scrolls an inner body container with optional overflow indicators.
 */
export class ScrollableWindow extends WindowBase {
  protected readonly scrollController: ScrollController;
  protected readonly scrollBody: Container;
  private readonly scrollClip: ScrollContentClip;
  private readonly indicators: ScrollOverflowIndicators;
  private scrollInputBinding: ScrollInputBinding | null = null;
  private scrollSubscription: { unsubscribe: () => void } | null = null;
  private scrollbar: ScrollbarRenderer | null = null;

  public constructor(
    host: PixiWindowHost,
    config: WindowConfig,
    options: ScrollableWindowOptions = {},
  ) {
    super(host, config, options);
    this.scrollController = new ScrollController({
      ...(options.axis !== undefined ? { axis: options.axis } : {}),
      ...(options.pageStepRatio !== undefined ? { pageStepRatio: options.pageStepRatio } : {}),
      ...(options.wheelStepPx !== undefined ? { wheelStepPx: options.wheelStepPx } : {}),
    });
    this.scrollClip = new ScrollContentClip(host, this.getContentContainer());
    this.scrollBody = new Container();
    this.scrollClip.getViewport().addChild(this.scrollBody);
    const content = this.getContentBounds();
    this.scrollClip.updateBounds(content.width, content.height);
    this.indicators = new ScrollOverflowIndicators(this.getContentContainer());
    this.syncScrollMetrics();
    this.scrollSubscription = this.scrollController.subscribe(() => {
      this.applyScrollPresentation();
    });
    if (options.showScrollbar === true) {
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
    this.applyScrollPresentation();
  }

  public getScrollBody(): Container {
    return this.scrollBody;
  }

  public getScrollController(): ScrollController {
    return this.scrollController;
  }

  public setScrollContentSize(size: number): void {
    this.scrollController.setContentSize(size);
  }

  public setScrollOffset(offset: number): void {
    this.scrollController.setOffset(offset);
  }

  public getScrollOffset(): number {
    return this.scrollController.getBounds().offset;
  }

  public override destroy(): void {
    this.scrollSubscription?.unsubscribe();
    this.scrollSubscription = null;
    this.scrollInputBinding?.unsubscribe();
    this.scrollInputBinding = null;
    this.scrollbar?.destroy();
    this.scrollbar = null;
    this.scrollClip.destroy();
    this.indicators.destroy();
    super.destroy();
  }

  protected override onLayoutChanged(_contentBounds: WindowBounds): void {
    this.syncScrollMetrics();
    const content = this.getContentBounds();
    this.scrollClip.updateBounds(content.width, content.height);
    this.applyScrollPresentation();
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

  private syncScrollMetrics(): void {
    const bounds = this.getContentBounds();
    if (this.scrollController.getAxis() === "x") {
      this.scrollController.setViewportSize(bounds.width);
    } else {
      this.scrollController.setViewportSize(bounds.height);
    }
  }

  private applyScrollPresentation(): void {
    const offset = this.scrollController.getBounds().offset;
    if (this.scrollController.getAxis() === "x") {
      this.scrollBody.position.set(Math.trunc(-offset), 0);
    } else {
      this.scrollBody.position.set(0, Math.trunc(-offset));
    }
    const content = this.getContentBounds();
    this.indicators.update(
      content.width,
      content.height,
      this.scrollController.canScrollUp(),
      this.scrollController.canScrollDown(),
      this.theme,
    );
    this.scrollbar?.update();
    this.scrollClip.cullChildren(this.scrollBody, offset, this.scrollController.getAxis());
  }
}
