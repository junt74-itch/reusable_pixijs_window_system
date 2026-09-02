# ADR 0004: Scroll composition

## Port status (PixiJS)

- Status: landed (P3-T03); `SelectableWindow` scroll composition landed (P4-T02)
- 再検証 Phase: P3 / P4

## Status

Accepted (2026-08-29, Phaser 版)

## Context

Phase 1 threw when selectable rows exceeded the content rectangle. Phase 2 needs scrolling without deepening `WindowBase` inheritance (`WindowBase → ScrollableWindow → SelectableWindow` is forbidden).

## Decision

Use a pure `ScrollController` plus composition:

- `ScrollController` owns bounds, offset, page/wheel/drag steps, and change events. No Phaser types.
- `ScrollableWindow extends WindowBase` composes a controller, an inner `scrollBody` container, optional overflow indicators, and optional `ScrollbarRenderer`.
- `SelectableWindow` composes its own `ScrollController` and `scrollBody` when row layout exceeds the viewport. It does **not** extend `ScrollableWindow`.
- Scroll input (`pageUp` / `pageDown`, wheel, drag) binds through the injected `WindowInputAdapter` and `canConsumeInput()`.
- Content-local hit tests add the current scroll offset.
- Visible-row virtualization renders only the viewport window (plus overscan) in `SelectableWindow`.

## Verified behavior

- Content children move by integer `-offset` on the scroll axis.
- Scrollable body lives inside `ScrollContentClip`. That viewport reuses `ContentClipper` (external world mask) and culls children whose bounds leave the viewport, because an internal object-view mask follows expanded child bounds and leaks above the chrome.
- Indicators and scrollbars are derived overlays on the clipped content container, not `WindowBase` chrome.
- `setContentSize` / `setViewportSize` emit change events even when offset is unchanged (for indicator refresh).

## Rejected alternatives

- **`ScrollableWindow → SelectableWindow` inheritance:** couples selection and scroll lifecycles; rejected in Phase 2 plan.
- **Scroll fields on `WindowBase`:** violates isolation.
- **Global scroll manager:** Scene/window-local controllers remain explicit.

## Isolation

`WindowBase` has no scroll offset, indicator, or scrollbar API. Scroll modules live under `src/scroll/`.
