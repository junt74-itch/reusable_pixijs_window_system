import { Assets, type BitmapFont } from "pixi.js";
import { DEFAULT_BITMAP_FONT_ASSET } from "../src/text/BitmapFontAsset.ts";

/** Shared sandbox preload for the default builder bitmap font. */
export async function preloadDefaultBitmapFont(): Promise<BitmapFont> {
  const font = await Assets.load<BitmapFont>({
    alias: DEFAULT_BITMAP_FONT_ASSET.key,
    src: DEFAULT_BITMAP_FONT_ASSET.fontDataURL,
  });

  for (const page of font.pages) {
    page.texture.source.scaleMode = "nearest";
  }

  return font;
}
