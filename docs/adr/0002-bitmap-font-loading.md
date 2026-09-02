# ADR 0002: Bitmap font loading

## Port status (PixiJS)

- Status: spike verified (P2-T01)
- 再検証 Phase: P2
- Sandbox: `examples/preloadDefaultBitmapFont.ts` loads `DEFAULT_BITMAP_FONT_ASSET` via `Assets.load({ alias: key, src: fontDataURL })`; `font.xml` `<page file="font.png" />` resolves relative to the XML URL. `DEFAULT_BITMAP_FONT_ASSET` URLs are sandbox-only; consumers define their own `BitmapFontAsset` and own placement, load, and unload.
- Pixi `bitmapFontXMLParser` maps XML `<common base="11" lineHeight="14" />` to `baseLineOffset = lineHeight - base` (**3** for this artifact). Measurer code must use XML `base` (or `lineHeight - baseLineOffset`), not Pixi `baseLineOffset` directly (P3).
- Sandbox `BitmapText` uses `style.fontFamily: DEFAULT_BITMAP_FONT_ASSET.key` (`"jf-dot-mplus12"`), which resolves via Pixi cache as `${key}-bitmap`.

## Status

Accepted (2026-08-29, Phaser 版)

## Context

All window text must use validated `reusable_pixel_font_builder` artifacts loaded through Phaser's standard bitmap-font loader.

## Decision

Load with:

```ts
this.load.bitmapFont("jf-dot-mplus12", textureURL, fontDataURL);
```

Measure with a hidden `scene.make.bitmapText(...)` probe and `getTextBounds(true)`.

Rendering uses integer `fontSize`, integer `scale`, integer positions, nearest-neighbor texture filtering, and `camera.roundPixels = true`.

## Verified upstream artifact

- Repository: `junt74-itch/reusable_pixel_font_builder`
- Commit: `20fa374ba24d3d70ff7437ab39532f28261f45f5`
- Font id: `jf-dot-mplus12`

## Lifecycle

Windows destroy their own `BitmapText` objects and measurer probes but do not remove shared cache entries during ordinary teardown.

## Missing glyphs

Production layout preflights code points and throws `MissingBitmapGlyphError` before display. Phaser may still render absent glyphs opaquely; that behavior is evidence only.
