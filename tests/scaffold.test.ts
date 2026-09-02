import { expect, test } from "bun:test";
import { VERSION } from "../src/index.ts";

test("Bun test runner is available", () => {
  expect(true).toBe(true);
});

test("VERSION is scaffold version", () => {
  expect(VERSION).toBe("0.0.0");
});
