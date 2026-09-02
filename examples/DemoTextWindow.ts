import { TextWindowBase } from "../src/pixi/TextWindowBase.ts";
import type { LayoutLine, WindowTextContent } from "../src/text/types.ts";

/** Sandbox-only TextWindowBase wrapper; not exported from the public barrel. */
export class DemoTextWindow extends TextWindowBase {
  /** Rich-text display path: paint(layout(content)). Not WindowBase#show(). */
  public showDemo(content: WindowTextContent): void {
    const result = this.layout(content);
    this.paint(result.lines);
  }

  public layout(content: WindowTextContent) {
    return this.layoutTextContent(content);
  }

  public paint(lines: readonly LayoutLine[]): void {
    this.renderLines(lines);
  }
}
