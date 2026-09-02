# Progress

最終更新: 2026-09-02

現在 Phase: **7 完了**
現在タスク: **なし**（計画タスクはすべて合格）
レビュー巡回数: 0 / 3

## 判定ログ

| 日時 | タスク | 判定 | メモ |
|---|---|---|---|
| 2026-09-02 | P0 / P1 | 合格 | scaffold + 純粋 core |
| 2026-09-02 | P2-T01〜T03 | 合格 | font / host / adapters |
| 2026-09-02 | P2-T04 | 合格 | 1 巡。WindowBase |
| 2026-09-02 | P2-T05 | 合格 | 1 巡。sandbox |
| 2026-09-02 | P3-T01〜T04 | 合格 | テキスト / スクロール / sandbox |
| 2026-09-02 | P4-T01〜T03 | 合格 | Message / Choice / integration |
| 2026-09-02 | P5-T01〜T04 | 合格 | Command / Log / focus / NineSlice |
| 2026-09-02 | P6-T01 | 合格 | 別 canvas overlay。three は devDep `0.185.1`。letterbox 中央寄せをレビュー修正 |
| 2026-09-02 | P6-T02 | 合格 | 任意の共有 context 例。1 canvas + `resetState`。標準にはしていない |
| 2026-09-02 | P6-T03 | 合格 | README / SUBMODULE / MIGRATION / API / SPEC 現行化。docs-contract 5。check exit 0 |
| 2026-09-02 | P6 目視 | 合格 | 人間。overlay / shared context 問題なし |
| 2026-09-02 | P7-T01 | 合格 | 1 巡。pixi.js を peer `>=8.20.1 <9` + devDep `8.20.1` |
| 2026-09-02 | P7-T02 | 合格 | 1 巡。root barrel 実働例。README 導入節。HTML 200 |
| 2026-09-02 | P7-T03 | 合格 | 1 巡。DEFAULT_ は JSDoc で sandbox 専用。destroy は Assets を unload しない |
| 2026-09-02 | P7-T04 | 合格 | 1 巡。workflow `check` + packageManager bun@1.4.0 |
| 2026-09-02 | P7-T05 | 合格 | 1 巡。導入経路一意化。CI badge。docs-contract 現行化 |
| 2026-09-02 | P7-T06 | 合格 | 1 巡。HTTP smoke port 4179。check exit 0。browser で MessageWindow 表示 |

## Phase 0–6

完了。計画タスク ID はすべて合格。

## Phase 7 — 援用性改善

- [x] P7-T01 PixiJS peer dependency 化
- [x] P7-T02 最小実働 consumer 例
- [x] P7-T03 BitmapFont consumer 契約
- [x] P7-T04 GitHub Actions
- [x] P7-T05 README / SUBMODULE / API 最終整合
- [x] P7-T06 `bun run check` + consumer HTTP smoke

完了。新しい Window 機能は入れていない。公開 API 破壊と npm / Git URL 公開は BACKLOG（人間判断）。

## 人間判断待ち

- Phaser pin の `provenance.json` `font.xml` sha256 不一致（BACKLOG）。任意。
- Three.js 単一 WebGL context 共有を標準にするか（BACKLOG。P6-T02 は任意例のまま）。
- npm publish / release tag / LICENSE / version 0.1.0 / `private: true` 解除 / Git URL install / branch protection（BACKLOG。Phase 7 ではやらない）。
- `DEFAULT_BITMAP_FONT_ASSET` を公開 barrel から外す破壊的変更（BACKLOG。P7-T03 は JSDoc のみ）。
- 方針 md の「pixi.js を runtime dependency とする」を peer 記述へ更新するか（BACKLOG。Phase 7 の正は PORTING_PLAN / README / SUBMODULE）。

## Compose への次指示

なし。追加実装は BACKLOG または人間判断のあと新しいタスク票から。
