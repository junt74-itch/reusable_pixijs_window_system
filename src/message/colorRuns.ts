export interface ColorRun {
  readonly text: string;
  readonly color: number | null;
}

/** Splits a laid-out line into tint runs using per-glyph colors aligned to sourceRange.start. */
export function splitLineColorRuns(
  lineText: string,
  sourceStart: number,
  colors: readonly (number | null)[],
): ColorRun[] {
  if (lineText.length === 0) {
    return [{ text: "", color: colors[sourceStart] ?? null }];
  }
  const runs: ColorRun[] = [];
  let currentText = "";
  let currentColor: number | null = colors[sourceStart] ?? null;
  for (let index = 0; index < lineText.length; index += 1) {
    const char = lineText[index] ?? "";
    const color = colors[sourceStart + index] ?? null;
    if (currentText.length > 0 && color !== currentColor) {
      runs.push({ text: currentText, color: currentColor });
      currentText = char;
      currentColor = color;
    } else {
      currentText += char;
    }
  }
  runs.push({ text: currentText, color: currentColor });
  return runs;
}
