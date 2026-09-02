/** Content height for vertically stacked layout lines, including the last line box. */
export function stackedTextHeight(lastLineY: number | undefined, lineStep: number): number {
  if (lastLineY === undefined) {
    return 0;
  }
  return Math.trunc(lastLineY + lineStep);
}
