/** Descriptor for Pixi `Assets.load` bitmap-font loading (consumer-owned URLs). */
export interface BitmapFontAsset {
  readonly key: string;
  readonly textureURL: string;
  readonly fontDataURL: string;
}

/**
 * Sandbox-only default bitmap font paths for this repository's internal examples
 * (`examples/assets/fonts/jf-dot-mplus12/`), resolved against the current document URL.
 *
 * Do not copy these URLs into consumer projects. Define your own {@link BitmapFontAsset}
 * with URLs from your asset pipeline, call `Assets.load` before constructing windows,
 * and unload via `Assets.unload` or `Assets.reset` when your host shuts down.
 *
 * Window `destroy()` removes only display objects; it does not unload shared BitmapFont
 * entries from the Pixi Assets cache.
 */
export const DEFAULT_BITMAP_FONT_ASSET: BitmapFontAsset = {
  key: "jf-dot-mplus12",
  textureURL: new URL("examples/assets/fonts/jf-dot-mplus12/font.png", document.baseURI).href,
  fontDataURL: new URL("examples/assets/fonts/jf-dot-mplus12/font.xml", document.baseURI).href,
};
