# ADR 0003: Window renderer injection

## Port status (PixiJS)

- Status: re-verified
- 再検証 Phase: P5-T04

## Status

Accepted (2026-08-29, Phaser 版)

## Context

Phase 1 drew window chrome with `GraphicsWindowRenderer`. Phase 2 must allow consumer-owned NineSlice (or other) skins without `WindowBase` importing skin types or branching on renderer implementation.

## Decision

Inject chrome through `WindowBaseOptions.createRenderer`:

```ts
createRenderer?: (context: WindowRendererFactoryContext) => WindowRenderer;
```

- `WindowRendererFactoryContext` supplies `{ host, root }` after the root container exists and before derived content is attached.
- Default factory (`createDefaultGraphicsWindowRenderer`) returns `GraphicsWindowRenderer` + `createPixiGraphicsFactory`, preserving Phase 1 behavior when no option is passed.
- `WindowBase` stores `WindowRenderer` (interface), not `GraphicsWindowRenderer`.
- Child order remains: background, frame (via renderer factory), content container, then derived overlays.

Resolution lives in `resolveWindowRenderer()` so tests can verify injection without a full Pixi `Application.init`.

## Verified API (Phaser 4.2.1)

Default path unchanged from Phase 1:

- `scene.add.graphics()` via `createPhaserGraphicsFactory`
- `GraphicsWindowRenderer.resize` / `applyTheme` / `setOpenness` / `destroy`

## Verified NineSlice API (PixiJS 8.20.1, P5-T04)

Exercised headlessly with `Cache.set(key, new Texture())` — no WebGL / `Application.init`:

- consumer-owned `Assets.load(...)` populates `Cache` before window construction
- `Cache.has(key)` — missing key throws `MissingWindowSkinError` (no Graphics fallback)
- resolved `Texture.source.scaleMode = "nearest"`
- `new NineSliceSprite({ texture, leftWidth, rightWidth, topHeight, bottomHeight, width, height, anchor: 0 })` parented via `context.root.addChild`
- `NineSliceSprite.position.set(0, 0)` so chrome aligns to the window root local origin
- `chrome.width` / `chrome.height` — integer sizes; minimum is `leftWidth + rightWidth` by `topHeight + bottomHeight`
- Openness remains `WindowBase` root `scaleY`; the renderer only stores `setOpenness`
- `tileX` / `tileY` `true` throws `WindowConfigError` (Pixi `NineSliceSprite` has no tile flags)

Production class: `src/pixi/NineSliceWindowRenderer.ts` via `createRenderer`. `WindowBase` does not import `skin/`. Types live in engine-free `src/skin/types.ts`.

## Rejected alternatives

- **NineSlice branch inside `WindowBase`:** couples base class to skin assets and texture keys.
- **Subclass per renderer (`GraphicsWindowBase`, `NineSliceWindowBase`):** duplicates geometry, clipping, and transition logic.
- **Global renderer singleton:** prevents per-window or per-scene skin choice.
- **Skin types imported by `WindowBase`:** violates isolation; consumer passes a factory closure instead.

## Isolation

`WindowBase` has no imports from `skin/` and no scroll, focus, portrait, or command-specific API. Only generic `createRenderer` and existing lifecycle hooks are allowed.
