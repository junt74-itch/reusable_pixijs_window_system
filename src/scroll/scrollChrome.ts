/** Content-local scrollbar track rectangle. */
export interface ScrollbarTrackRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function computeScrollbarTrackRect(
  contentWidth: number,
  contentHeight: number,
  trackWidth: number,
): ScrollbarTrackRect {
  return {
    x: Math.max(0, contentWidth - trackWidth - 2),
    y: 0,
    width: trackWidth,
    height: contentHeight,
  };
}

export function isPointInScrollbarTrack(
  localX: number,
  localY: number,
  track: ScrollbarTrackRect | null,
): boolean {
  if (track === null) {
    return false;
  }
  return (
    localX >= track.x &&
    localX <= track.x + track.width &&
    localY >= track.y &&
    localY <= track.y + track.height
  );
}

/** Whether a content-local point is inside the visible viewport body (excluding the scrollbar track). */
export function isPointInContentViewport(
  localX: number,
  localY: number,
  viewportWidth: number,
  viewportHeight: number,
  scrollbarTrack: ScrollbarTrackRect | null,
): boolean {
  if (localY < 0 || localY > viewportHeight) {
    return false;
  }
  if (localX < 0 || localX > viewportWidth) {
    return false;
  }
  if (isPointInScrollbarTrack(localX, localY, scrollbarTrack)) {
    return false;
  }
  return true;
}
