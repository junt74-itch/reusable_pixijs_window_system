# ADR 0005: Scene-owned focus and modal capture

## Port status (PixiJS)

- Status: **re-verified (Phase 5)**
- 再検証 Phase: P5
- Scene → `PixiWindowHost` 所有。`bindFocusControllerToHost(host, controller)` で host destroy 時に `dispose()`。dimmer Graphics は **application 所有**（controller / binder / `WindowBase` は作らない）。

## Status

Accepted (2026-08-29, Phaser 版)

## Context

Phase 1 windows each expose `activate()` / `deactivate()` and `canConsumeInput()`. Scenes that share one `PhaserWindowInput` must assign `active` exclusively, including a modal stack, without a process-global `WindowManager`.

## Decision

A Scene constructs `WindowFocusController` and is the exclusive assigner while it is in use:

- `acquire(window)` replaces the stack (non-modal). The previous window is deactivated, then the new window is activated.
- `acquire(window, { modal: true })` pushes. Only the stack top is activated; lower windows stay deactivated.
- `release(window)` removes that entry. If it was the top, the new top is activated.
- `getActive()` / `getSnapshot()` prune destroyed windows. Destroy already sets `active` false on `WindowBase`.
- Windows do **not** import the controller. They keep the Phase 1 `activate` / `deactivate` API.
- `canConsumeInput()` stays a local predicate (`open + visible + active + enabled`). Modality is expressed only by deactivating lower windows.

### Dimmer ownership

Dimmer Graphics is **Scene-owned**. The controller is Phaser-free and emits `FocusSnapshot.modal` so the Scene can show or hide its dimmer. The controller does not parent a dimmer under `WindowBase`.

Bind shutdown with `bindFocusControllerToHost(host, controller)` so host destroy calls `dispose()` (release all). The application destroys its dimmer on shutdown.

## Verified behavior

- Two windows acquired through the controller are never both `isActive()`.
- Modal acquire: background `canConsumeInput()` is false because it is deactivated, not because `WindowBase` knows about a modal stack.
- Destroyed tops are dropped; the next living entry is activated.
- Non-modal acquire while a modal is open replaces the stack (modals are dismissed by deactivation, not by destroying windows).

## Rejected alternatives

- **Global singleton WindowManager:** leaks across Scenes and tests.
- **Windows self-registering on construct:** `WindowBase` would own focus.
- **Controller-owned dimmer as a WindowBase child:** mixes Scene chrome with window chrome; ownership becomes ambiguous on restart.
- **A `modal` flag on `WindowBase.canConsumeInput()`:** duplicates the stack inside every window.

## Isolation

`WindowBase` gained only a generic `isDestroyed()` getter (the existing private flag). It has no focus stack, no `acquire`, and no modal API.
