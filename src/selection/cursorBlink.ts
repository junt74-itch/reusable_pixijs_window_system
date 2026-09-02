/** True while the filled cursor should be shown for the current blink clock. */
export function cursorBlinkVisible(elapsedMs: number, periodMs: number): boolean {
  if (periodMs <= 0) {
    return true;
  }
  return elapsedMs % periodMs < periodMs / 2;
}
