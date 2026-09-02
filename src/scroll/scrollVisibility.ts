import type { ScrollbarTrackRect } from "./scrollChrome.ts";
import { isPointInContentViewport } from "./scrollChrome.ts";

/** Adjusts scroll offset so a row span stays inside the viewport, or returns null if already visible. */
export function computeScrollOffsetToReveal(
  rowTop: number,
  rowBottom: number,
  viewportSize: number,
  currentOffset: number,
): number | null {
  if (rowTop < currentOffset) {
    return rowTop;
  }
  if (rowBottom > currentOffset + viewportSize) {
    return rowBottom - viewportSize;
  }
  return null;
}

/** Returns inclusive row index range to render for the current scroll window. */
export function computeVisibleRowRange(
  rowTops: readonly number[],
  rowHeights: readonly number[],
  scrollOffset: number,
  viewportHeight: number,
  overscanPx: number,
): { readonly start: number; readonly end: number } {
  if (rowTops.length === 0) {
    return { start: 0, end: -1 };
  }
  const minY = scrollOffset - overscanPx;
  const maxY = scrollOffset + viewportHeight + overscanPx;
  let start = rowTops.length;
  let end = -1;
  for (let index = 0; index < rowTops.length; index += 1) {
    const top = rowTops[index];
    const height = rowHeights[index];
    if (top === undefined || height === undefined) {
      continue;
    }
    const bottom = top + height;
    if (bottom < minY || top > maxY) {
      continue;
    }
    start = Math.min(start, index);
    end = Math.max(end, index);
  }
  if (end < start) {
    return { start: 0, end: -1 };
  }
  return { start, end };
}

/** Hit-tests visible rows using content-local coordinates plus scroll offset. */
export function hitTestRowAtContentLocal(
  localX: number,
  localY: number,
  scrollOffset: number,
  viewportWidth: number,
  viewportHeight: number,
  scrollbarTrack: ScrollbarTrackRect | null,
  rows: readonly {
    readonly index: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[],
): number | null {
  if (
    !isPointInContentViewport(localX, localY, viewportWidth, viewportHeight, scrollbarTrack)
  ) {
    return null;
  }
  const adjustedY = localY + scrollOffset;
  for (const bounds of rows) {
    if (
      localX >= bounds.x &&
      localX <= bounds.x + bounds.width &&
      adjustedY >= bounds.y &&
      adjustedY <= bounds.y + bounds.height
    ) {
      return bounds.index;
    }
  }
  return null;
}
