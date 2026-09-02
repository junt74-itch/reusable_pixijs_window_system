import type { MessageParseResult, MessageToken } from "./types.ts";

const WAIT_PATTERN = /^\{wait:(\d+)\}$/;
const COLOR_PATTERN = /^\{color:([0-9A-Fa-f]{6})\}$/;
const COLOR_RESET_PATTERN = /^\{color\}$/;
const SPEED_PATTERN = /^\{speed:(\d+)\}$/;

/**
 * Parses MVP message syntax into immutable tokens.
 */
export function parseMessage(text: string): MessageParseResult {
  const tokens: MessageToken[] = [];
  let index = 0;
  let buffer = "";
  let bufferStart = 0;

  const flushText = (): void => {
    if (buffer.length === 0) {
      return;
    }
    tokens.push({
      type: "text",
      value: buffer,
      start: bufferStart,
      end: bufferStart + buffer.length,
    });
    buffer = "";
  };

  while (index < text.length) {
    const char = text[index];
    if (char === "\f") {
      flushText();
      tokens.push({ type: "pageBreak", start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "\n") {
      flushText();
      tokens.push({ type: "newline", start: index, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "{") {
      if (text[index + 1] === "{") {
        if (buffer.length === 0) {
          bufferStart = index;
        }
        buffer += "{";
        index += 2;
        continue;
      }
      const end = text.indexOf("}", index + 1);
      if (end === -1) {
        if (buffer.length === 0) {
          bufferStart = index;
        }
        buffer += char;
        index += 1;
        continue;
      }
      flushText();
      const raw = text.slice(index, end + 1);
      const inner = raw.slice(1, -1);
      const directiveStart = index;
      const directiveEnd = end + 1;
      const waitMatch = WAIT_PATTERN.exec(`{${inner}}`);
      if (waitMatch !== null) {
        const ms = Number(waitMatch[1]);
        if (Number.isInteger(ms) && ms >= 0 && ms <= 60_000) {
          tokens.push({ type: "wait", ms, start: directiveStart, end: directiveEnd });
        } else {
          tokens.push({
            type: "text",
            value: raw,
            start: directiveStart,
            end: directiveEnd,
          });
        }
      } else if (inner === "pause") {
        tokens.push({ type: "pause", start: directiveStart, end: directiveEnd });
      } else if (COLOR_RESET_PATTERN.test(raw)) {
        tokens.push({ type: "color", color: null, start: directiveStart, end: directiveEnd });
      } else {
        const colorMatch = COLOR_PATTERN.exec(raw);
        const speedMatch = SPEED_PATTERN.exec(raw);
        if (colorMatch !== null) {
          const hex = colorMatch[1];
          tokens.push({
            type: "color",
            color: Number.parseInt(hex ?? "0", 16),
            start: directiveStart,
            end: directiveEnd,
          });
        } else if (speedMatch !== null) {
          const charsPerSecond = Number(speedMatch[1]);
          if (Number.isInteger(charsPerSecond) && charsPerSecond >= 1 && charsPerSecond <= 1_200) {
            tokens.push({
              type: "speed",
              charsPerSecond,
              start: directiveStart,
              end: directiveEnd,
            });
          } else {
            tokens.push({
              type: "text",
              value: raw,
              start: directiveStart,
              end: directiveEnd,
            });
          }
        } else {
          tokens.push({
            type: "text",
            value: raw,
            start: directiveStart,
            end: directiveEnd,
          });
        }
      }
      index = end + 1;
      continue;
    }
    if (buffer.length === 0) {
      bufferStart = index;
    }
    buffer += char;
    index += 1;
  }

  flushText();
  return { tokens: coalesceTextTokens(tokens) };
}

function coalesceTextTokens(tokens: MessageToken[]): MessageToken[] {
  const merged: MessageToken[] = [];
  for (const token of tokens) {
    const previous = merged[merged.length - 1];
    if (
      previous !== undefined &&
      previous.type === "text" &&
      token.type === "text"
    ) {
      merged[merged.length - 1] = {
        type: "text",
        value: `${previous.value}${token.value}`,
        start: previous.start,
        end: token.end,
      };
    } else {
      merged.push(token);
    }
  }
  return merged;
}
