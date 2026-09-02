# PixiJS port checklist

Last updated: 2026-09-02

Phaser 版 MVP / Phase2 release checklist の「全部 done」状態は移植元の履歴であり、本リポジトリの進行状況ではありません。進行の正は [PROGRESS.md](PROGRESS.md) と [PORTING_PLAN.md](PORTING_PLAN.md) です。

## Phase 0 — scaffold（完了）

- [x] toolchain / empty library / `bun run check`
- [x] package consumer（`examples/consumer/readme-example.ts`, `submodule-source.ts`, `typecheck:consumer`）
- [x] 最小 Pixi sandbox（色付き矩形・resize、`bun run dev`）
- [x] SPECIFICATION / API / SUBMODULE / ADR の未達明示

## Phase 1 — 純粋 core（完了）

- [x] core 純粋移植（Phaser 非依存の layout / error / settlement / GraphicsWindowRenderer）
- [x] `src/**` の phaser / pixi.js import 検査が 0

## Phase 2 — Pixi 基盤（完了）

- [x] BMFont XML spike（`Assets.load` + sandbox BitmapText）
- [x] PixiWindowHost / WindowBase
- [x] Message / Choice
- [x] 拡張 window / skin / focus
- [x] Three.js overlay

## Phase 3 — テキストとスクロール（完了）

- [x] PixiBitmapTextMeasurer / TextWindowBase
- [x] RichText 描画と missing glyph 検査
- [x] ScrollableWindow
- [x] sandbox 視覚 fixture（整数座標 / nearest / clip / letterbox）

## Phase 4 — 主要ウィンドウ

- [x] MessageWindow.say
- [x] ChoiceWindow.choose
- [x] say → choose integration

## Browser evidence

| Capability | URL | Automated | Chromium (operator) |
|---|---|---|---|
| WindowBase sandbox | http://localhost:5173/ | `tests/examples/sandbox-entry.test.ts` | 2026-09-02 Grok: 表示・clip・R/P/C/Space/X |
| Phase 3 text + scroll sandbox | http://localhost:5173/ | `tests/examples/sandbox-entry.test.ts` | 2026-09-02 Grok: 3枚・RichText 12/24・clip・PageDown・letterbox 2x（canvas 960×540 / CSS 1920×1080） |
| say → choose integration | http://localhost:5173/ | `tests/examples/sandbox-entry.test.ts`, `tests/pixi/integration.say-choose.test.ts` | 2026-09-02 Grok: ページ1→ページ2→選択「続ける」→ステップ2 |
| Three.js 別 canvas overlay（標準） | http://localhost:5173/three-overlay.html | `tests/examples/three-overlay-entry.test.ts` | 2026-09-02 人間: 目視問題なし |
| Three.js 共有 context（任意） | http://localhost:5173/three-shared-context.html | `tests/examples/three-shared-context-entry.test.ts` | 2026-09-02 人間: 目視問題なし |

## Phase 5 — 拡張ウィンドウと skin

- [x] Command / Help
- [x] Log / Document
- [x] focus / modal + host bind
- [x] portrait / NineSlice / typed error 一式

## Phase 6 — 文書現行化

- [x] README / SUBMODULE / MIGRATION / API / SPEC / docs index を landed surface に合わせる
- [x] Phase 0「VERSION のみ」「import 不可」表現を除去
- [x] Three overlay を標準、shared context を任意として明記
- [ ] npm publish / release tag（スコープ外 — [BACKLOG.md](BACKLOG.md)）

## Phase 7 — 援用性改善（進行中）

進行の正は [PROGRESS.md](PROGRESS.md)。Compose は 1 タスクずつ。

- [x] P7-T01 PixiJS peer dependency
- [x] P7-T02 最小実働 consumer 例（root `index.ts`）
- [x] P7-T03 BitmapFont consumer 契約
- [x] P7-T04 GitHub Actions `check`
- [x] P7-T05 README / SUBMODULE / API 最終整合（submodule + peer `pixi.js` + consumer フォント + root `index.ts` を README / 索引 / SPEC / MIGRATION / docs-contract で一意化。CI badge は workflow `check`）
- [x] P7-T06 `bun run check` + consumer HTTP smoke

## 参照

- 移植元 MVP checklist: Phaser 版 `docs/MVP_RELEASE_CHECKLIST.md`（commit `7cfd315`）
- 移植元 Phase 2 checklist: Phaser 版 `docs/PHASE2_RELEASE_CHECKLIST.md`（commit `7cfd315`）
- 互換性: [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md)
