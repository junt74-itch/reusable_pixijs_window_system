import { Container } from "pixi.js";
import { ContentClipper } from "./ContentClipper.ts";
import { TransitionController, type TransitionState, type TransitionSubscription } from "../core/TransitionController.ts";
import type { WindowRenderer } from "../core/WindowRenderer.ts";
import { resolveWindowRenderer, type WindowRendererFactory } from "./windowRendererFactory.ts";
import { computeContentBounds, resolveWindowTheme, validateWindowConfig } from "../core/theme.ts";
import type {
  WindowBounds,
  WindowConfig,
  WindowPadding,
  WindowPhase,
  WindowStateSnapshot,
  WindowTheme,
} from "../core/types.ts";
import {
  WindowDestroyedError,
  WindowLayoutError,
  WindowOperationCancelledError,
} from "../core/types.ts";
import type { ResolvedWindowTheme } from "../core/types.ts";
import type { WindowInputAdapter } from "../input/WindowInputAdapter.ts";
import type { PixiWindowHost } from "../host/types.ts";

export interface WindowBaseOptions {
  readonly input?: WindowInputAdapter;
  readonly ownsInput?: boolean;
  readonly createRenderer?: WindowRendererFactory;
}

/**
 * Common window geometry, visual state, clipping, and transition owner.
 */
export class WindowBase {
  protected readonly host: PixiWindowHost;
  protected readonly root: Container;
  protected readonly content: Container;
  protected readonly renderer: WindowRenderer;
  protected readonly clipper: ContentClipper;
  protected readonly transition: TransitionController;
  protected theme: ResolvedWindowTheme;
  private readonly inputAdapter: WindowInputAdapter | null;
  private readonly ownsInput: boolean;
  private width: number;
  private height: number;
  private visible = true;
  private active = false;
  private enabled = true;
  private alpha = 1;
  private depth = 0;
  private destroyed = false;
  private contentBounds: WindowBounds;
  private rootX: number;
  private rootY: number;
  private readonly unsubscribeHostDestroy: () => void;

  public constructor(host: PixiWindowHost, config: WindowConfig, options: WindowBaseOptions = {}) {
    validateWindowConfig(config);
    this.host = host;
    this.theme = resolveWindowTheme(config.theme);
    this.width = config.width;
    this.height = config.height;
    this.inputAdapter = options.input ?? null;
    this.ownsInput = options.ownsInput ?? false;
    this.contentBounds = computeContentBounds(this.width, this.height, this.theme.padding);

    this.rootX = Math.trunc(config.x);
    this.rootY = Math.trunc(config.y);
    this.root = new Container();
    this.root.position.set(this.rootX, this.rootY);
    this.host.stage.sortableChildren = true;
    this.host.stage.addChild(this.root);

    this.content = new Container();
    this.content.position.set(this.contentBounds.x, this.contentBounds.y);
    this.renderer = resolveWindowRenderer(options.createRenderer, {
      host: this.host,
      root: this.root,
    });
    this.clipper = new ContentClipper(host);
    this.transition = new TransitionController(this.theme.transitionDurationMs);

    this.root.addChild(this.content);
    this.renderer.resize(this.width, this.height);
    this.renderer.applyTheme(this.theme);
    this.clipper.attach(this.content);
    this.clipper.updateBounds(this.contentBounds);
    this.clipper.enable();

    this.unsubscribeHostDestroy = host.onDestroy(() => this.destroy());
    this.applyVisualState();
  }

  public getRoot(): Container {
    return this.root;
  }

  public getContentContainer(): Container {
    return this.content;
  }

  public getPhase(): WindowPhase {
    return this.transition.getState().phase;
  }

  public getOpenness(): number {
    return this.transition.getState().openness;
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public isActive(): boolean {
    return this.active;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public getAlpha(): number {
    return this.alpha;
  }

  public getContentBounds(): WindowBounds {
    return { ...this.contentBounds };
  }

  public getStateSnapshot(): WindowStateSnapshot {
    return {
      phase: this.getPhase(),
      openness: this.getOpenness(),
      visible: this.visible,
      active: this.active,
      enabled: this.enabled,
      alpha: this.alpha,
      depth: this.depth,
      bounds: { x: 0, y: 0, width: this.width, height: this.height },
      contentBounds: this.getContentBounds(),
    };
  }

  public worldToContentLocal(worldX: number, worldY: number): { x: number; y: number } {
    const point = this.content.toLocal({ x: worldX, y: worldY });
    return { x: point.x, y: point.y };
  }

  public contentLocalToWorld(localX: number, localY: number): { x: number; y: number } {
    const point = this.content.toGlobal({ x: localX, y: localY });
    return { x: point.x, y: point.y };
  }

  public setPosition(x: number, y: number): this {
    this.assertAlive();
    this.rootX = Math.trunc(x);
    this.rootY = Math.trunc(y);
    this.applyOpennessPresentation();
    return this;
  }

  public setSize(width: number, height: number): this {
    this.assertAlive();
    validateWindowConfig({ x: 0, y: 0, width, height, theme: this.theme });
    this.width = width;
    this.height = height;
    this.relayout();
    return this;
  }

  public setPadding(padding: number | WindowPadding): this {
    this.assertAlive();
    this.theme = resolveWindowTheme({ ...this.theme, padding });
    this.relayout();
    return this;
  }

  public setTheme(partial: WindowTheme): this {
    this.assertAlive();
    this.theme = resolveWindowTheme({ ...this.theme, ...partial });
    this.renderer.applyTheme(this.theme);
    this.relayout();
    return this;
  }

  public show(): this {
    this.assertAlive();
    this.visible = true;
    this.applyVisualState();
    return this;
  }

  public hide(): this {
    this.assertAlive();
    this.visible = false;
    this.applyVisualState();
    return this;
  }

  public activate(): this {
    this.assertAlive();
    this.active = true;
    this.onActiveChanged(true);
    return this;
  }

  public deactivate(): this {
    if (this.destroyed) {
      return this;
    }
    this.active = false;
    this.onActiveChanged(false);
    return this;
  }

  public enable(): this {
    this.assertAlive();
    this.enabled = true;
    return this;
  }

  public disable(): this {
    this.assertAlive();
    this.enabled = false;
    return this;
  }

  public setDepth(depth: number): this {
    this.assertAlive();
    this.depth = depth;
    this.host.stage.sortableChildren = true;
    this.root.zIndex = depth;
    return this;
  }

  public setAlpha(alpha: number): this {
    this.assertAlive();
    this.alpha = alpha;
    this.root.alpha = alpha;
    return this;
  }

  public open(durationMs?: number): Promise<void> {
    this.assertAlive();
    return this.transition.open(durationMs).then(() => {
      if (!this.destroyed) {
        this.applyOpennessPresentation();
      }
    });
  }

  public close(durationMs?: number): Promise<void> {
    this.assertAlive();
    return this.transition.close(durationMs).then(() => {
      if (!this.destroyed) {
        this.applyOpennessPresentation();
      }
    });
  }

  public subscribeTransition(listener: (state: TransitionState) => void): TransitionSubscription {
    this.assertAlive();
    return this.transition.subscribe(listener);
  }

  public update(_time: number, delta: number): void {
    if (this.destroyed) {
      return;
    }
    this.transition.update(delta);
    this.applyOpennessPresentation();
    this.onUpdate(delta);
  }

  public canConsumeInput(): boolean {
    return (
      !this.destroyed &&
      this.visible &&
      this.active &&
      this.enabled &&
      this.getPhase() === "open"
    );
  }

  protected getInputAdapter(): WindowInputAdapter | null {
    return this.inputAdapter;
  }

  protected onLayoutChanged(_contentBounds: WindowBounds): void {}

  protected onActiveChanged(_active: boolean): void {}

  protected onUpdate(_delta: number): void {}

  protected onBeforeDestroy(): void {}

  protected cancelOwnedOperations(reason: string): void {
    this.transition.dispose(reason);
  }

  public destroy(): void {
    if (this.destroyed) {
      return;
    }
    this.active = false;
    this.onActiveChanged(false);
    this.destroyed = true;
    this.cancelOwnedOperations("destroyed");
    this.onBeforeDestroy();
    this.unsubscribeHostDestroy();
    if (this.ownsInput && this.inputAdapter !== null) {
      this.inputAdapter.dispose();
    }
    this.clipper.destroy();
    this.renderer.destroy();
    this.root.destroy({ children: true });
  }

  private relayout(): void {
    try {
      this.contentBounds = computeContentBounds(this.width, this.height, this.theme.padding);
    } catch (error) {
      if (error instanceof WindowLayoutError) {
        throw error;
      }
      throw error;
    }
    this.content.position.set(this.contentBounds.x, this.contentBounds.y);
    this.renderer.resize(this.width, this.height);
    this.clipper.updateBounds(this.contentBounds);
    this.onLayoutChanged(this.getContentBounds());
  }

  private applyVisualState(): void {
    this.applyOpennessPresentation();
  }

  private applyOpennessPresentation(): void {
    const openness = this.getOpenness();
    const scaleY = Math.max(0, Math.min(1, openness));
    const visibleHeight = this.height * scaleY;
    const offsetY = (this.height - visibleHeight) / 2;
    this.root.scale.set(1, scaleY);
    this.root.position.set(Math.trunc(this.rootX), Math.trunc(this.rootY + offsetY));
    this.root.visible = this.visible && scaleY > 0;
    this.renderer.setOpenness(openness);
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new WindowDestroyedError("Window has been destroyed.");
    }
  }
}

export { WindowDestroyedError, WindowOperationCancelledError };
