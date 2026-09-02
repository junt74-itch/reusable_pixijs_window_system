# ADR 0001: Content clipping

## Port status (PixiJS)

- Status: **verified (Phase 2)**
- Implementation: `ContentClipper` in `src/pixi/ContentClipper.ts`
- Primary path: hidden mask `Graphics` parented to the content container with `Container.mask` assignment. Clip rect is content-local `{ x: 0, y: 0, width, height }` — padding offsets are not baked into the mask.
- **Canvas / GeometryMask fallback: Drop** — PixiJS 版では提供しない。

## Status

Accepted (2026-08-29, Phaser 版); Pixi mask path accepted (2026-09-02)

## Context

Derived windows must clip overflowing content after move and resize without importing Phaser mask/filter APIs directly.

## Decision (Phaser 版 — historical)

Use `ContentClipper` with renderer-specific paths:

- **WebGL:** enable filters and add an **external** mask via `content.filters.external.addMask(maskGraphics, false, scene.cameras.main, "world")`. Internal masks match the filtered object's view; scrolled children expand that view so the clip rect sticks to overflow (top leak / bottom crop). External + world keeps the hole at the content rectangle in camera space.
- Pin `target.setSize(width, height)` when bounds update so the filter region does not follow child `getBounds()`.
- Set `filtersFocusContext = true` so the filter camera tracks the render context, not the expanded child bounds (`filtersAutoFocus` follows the Game Object by default).
- **Canvas:** create a `GeometryMask` from hidden mask `Graphics` and call `content.setMask(geometryMask)`.

## Decision (PixiJS 版)

Use `ContentClipper` with a single mask path:

- Create mask `Graphics`, parent to the content `Container`, assign `target.mask = maskGraphics`. Keep `visible = true` (Pixi v8 stencil collect skips invisible objects). Do not paint it in the color pass — `StencilMask` sets `includeInBuild = false`.
- Redraw mask rect at content-local `(0, 0, width, height)` on bounds update.
- Do **not** implement Canvas renderer fallback or `GeometryMask` alternate paths.

Mask bounds use content-local `WindowBounds` and redraw on resize without replacing the content target.

## Verified API (Phaser 4.2.1)

- `Phaser.GameObjects.Container.enableFilters()`
- `Phaser.GameObjects.Components.FilterList.addMask(mask?, invert?, viewCamera?, viewTransform?, scaleFactor?)` — `viewTransform: "world"`
- `filters.external` (camera-space) vs `filters.internal` (object-view)
- `Phaser.GameObjects.Graphics.createGeometryMask()`
- `Phaser.GameObjects.GameObject.setMask(mask)`
- `Phaser.GameObjects.GameObject.clearMask(destroyMask?)`

## Verified API (PixiJS 8.20.1)

- `new Graphics()` + `rect(...).fill(...)` for mask shape
- `Container.addChild(maskGraphics)` + `Container.mask = maskGraphics`
- `Container.mask = null` on disable
- `Graphics.destroy()` on cleanup

## Cleanup

`ContentClipper.destroy()` clears `target.mask`, removes and destroys mask graphics, and clears references.

## Rejected alternatives

- Direct mask usage in derived windows (violates abstraction boundary)
- Phaser 3 documentation assumptions without runtime verification
- Canvas / GeometryMask fallback in PixiJS port (Drop)
