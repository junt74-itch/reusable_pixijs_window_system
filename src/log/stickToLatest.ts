/** True when the viewer is already at the latest scroll position. */
export function shouldStickToLatest(offset: number, maxOffset: number): boolean {
  return offset >= maxOffset;
}
