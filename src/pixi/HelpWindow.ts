import type { WindowConfig } from "../core/types.ts";
import type { WindowBounds } from "../core/types.ts";
import type { WindowBaseOptions } from "./WindowBase.ts";
import { TextWindowBase } from "./TextWindowBase.ts";
import { flattenRichText } from "../text/richText.ts";
import type { RichText } from "../text/types.ts";
import type { PixiWindowHost } from "../host/types.ts";

/**
 * Small help text pane. Binding to the current selection is scene-owned.
 */
export class HelpWindow extends TextWindowBase {
  private source: string | RichText | null = null;

  public constructor(host: PixiWindowHost, config: WindowConfig, options: WindowBaseOptions = {}) {
    super(host, config, options);
  }

  public setHelp(content: string | RichText | null): void {
    if (content === null) {
      this.source = null;
    } else if (typeof content === "string") {
      this.source = content.length > 0 ? content : null;
    } else {
      this.source = flattenRichText(content).text.length > 0 ? content : null;
    }
    this.renderHelp();
  }

  public getHelp(): string | RichText | null {
    return this.source;
  }

  protected override onLayoutChanged(_contentBounds: WindowBounds): void {
    super.onLayoutChanged(_contentBounds);
    this.renderHelp();
  }

  private renderHelp(): void {
    if (this.source === null) {
      this.clearText();
      return;
    }
    const layout = this.layoutTextContent(this.source);
    this.renderLines(layout.lines.filter((line) => line.pageIndex === 0));
  }
}
