import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    lib: {
      entry: "src/index.ts",
      fileName: "index",
      formats: ["es"],
    },
    rollupOptions: {
      external: ["pixi.js"],
    },
  },
});
