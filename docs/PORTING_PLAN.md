# Porting plan

Grok 4.6 が仕様・進行・レビュー、Compose 2.5 が実装を担う。複数 Phase を同時実装しない。1 タスクは 1 つの検証可能な成果にする。

基準: [../PORTING_BASELINE.md](../PORTING_BASELINE.md)

## 役割

| 役割 | 担当 |
|---|---|
| 仕様、タスク分割、diff レビュー、合格判定 | Grok 4.6 |
| 指定タスク ID だけの実装とテスト | Compose 2.5 |
| 公開 API 破壊、MVP 増減、ライセンス、Three 共有 context を標準にするか | 人間 |
| 同一タスク 3 巡失敗 | 人間（設計変更） |

## 目標アーキテクチャ

```
core/     controller, layout, theme, error, focus, a11y  — pixi.js import 禁止
pixi/     WindowBase, Graphics/NineSlice renderer, clipper, BitmapText, cursor, portrait
input/    WindowInputAdapter 契約 + PixiWindowInput
host/     PixiWindowHost, createPixiWindowHost(app)
examples/ Pixi 単体 sandbox と Three.js overlay sandbox は分ける
```

`Application` への強結合は禁止。Window の第 1 引数は `PixiWindowHost`。

## Phase 0 — 基準線とリポジトリ初期化

完了条件: 空の library build、package consumer、最小 Pixi sandbox が通る。

| ID | 成果 | 状態 |
|---|---|---|
| P0-T00 | baseline / plan / progress / 互換性マップ / 本計画（本セッション） | done |
| P0-T01 | Bun + Vite + TS7 + pixi.js 8.20.1、空 barrel、`bun run build` | done |
| P0-T02 | package consumer + `bun run check` の骨格 | done |
| P0-T03 | 最小 Pixi sandbox（Application init、resize、色付き rect） | done |
| P0-T04 | SPECIFICATION / API / SUBMODULE / checklist を複製し未達を明示 | done |

## Phase 1 — 互換性マップと純粋 core

完了条件: core の unit test が Phaser なしで通り、`src/**` の `phaser` import 検査が 0 件。

| ID | 成果 |
|---|---|
| P1-T01 | core theme / types / TransitionController / windowOperations を移す | done |
| P1-T02 | input 契約と ManualWindowInput | done |
| P1-T03 | text layout / richText / fontMetrics / fallback（measurer は fake） | done |
| P1-T04 | message parser / TextState / MessageController | done |
| P1-T05 | SelectionController / ScrollController / viewportLayout / focus controller / a11y | done |
| P1-T06 | GraphicsWindowRenderer（GraphicsLike fake）と禁止 import 検査 | done |

Window クラスと pixi import は Phase 2 以降。

## Phase 2 — Pixi 基盤の縦切り

完了条件: Phaser dependency ゼロ。window 一枚が表示・操作・破棄できる。

| ID | 成果 |
|---|---|
| P2-T01 | BMFont XML spike（Assets.load、base / kerning / 欠損 glyph） | done |
| P2-T02 | PixiWindowHost + createPixiWindowHost(app) | done |
| P2-T03 | Pixi Graphics factory / ContentClipper / PixiWindowInput | done |
| P2-T04 | WindowBase open/close/show/hide/activate/destroy | done |
| P2-T05 | WindowBase sandbox（resize、padding、chromeless、途中反転、破棄） | done |

## Phase 3 — テキストとスクロール

完了条件: 長文、日本語、複数 font size、長いリスト、resize 後 re-layout が再現する。

| ID | 成果 |
|---|---|
| P3-T01 | PixiBitmapTextMeasurer / TextWindowBase | done |
| P3-T02 | RichText 描画と missing glyph 検査 | done |
| P3-T03 | ScrollableWindow + wheel / PageUp / PageDown / drag / scrollbar / overflow | done |
| P3-T04 | 整数座標 / nearest / clip の視覚 fixture | done |

## Phase 4 — 主要ウィンドウ

完了条件: 移植元の integration デモと Promise 契約が一致する。

| ID | 成果 |
|---|---|
| P4-T01 | MessageWindow.say | done |
| P4-T02 | ChoiceWindow.choose | done |
| P4-T03 | say → choose integration。busy / cancel / destroy / autoOpen / page / 入力 | done |

## Phase 5 — 拡張ウィンドウと skin

完了条件: 旧 sandbox 相当の全 route と release checklist が埋まる。

| ID | 成果 |
|---|---|
| P5-T01 | Command / Help | done |
| P5-T02 | Log / Document | done |
| P5-T03 | focus / modal + host bind | done |
| P5-T04 | portrait / NineSlice / typed error 一式 | done |

## Phase 6 — Three.js 統合と配布品質

完了条件: Pixi 単体 consumer と Three.js consumer が build・実行でき、`bun run check` が一括合格。

| ID | 成果 |
|---|---|
| P6-T01 | Three.js 別 canvas overlay 標準例 | done |
| P6-T02 | 任意の共有 context 例（標準にしない） | done |
| P6-T03 | README 導入経路の一本化、SUBMODULE / MIGRATION / API / SPEC 現行化 | done |

## Phase 7 — 援用性改善

完了条件: README から正式導入経路が Git submodule だと一意に分かり、consumer が `src/**` へ deep import せず、PixiJS が二重化せず、sandbox 専用フォントパスへ依存せず、`bun run check` がローカルと GitHub Actions の両方で通る。

新しい Window 種、公開 API の破壊的変更、npm / Git URL 公開は対象外。方針文書の「pixi.js を runtime dependency とする」は、本 Phase の peer dependency 契約で上書きする（方針 md 自体は人間承認済みのため書き換えない）。

| ID | 成果 | 状態 |
|---|---|---|
| P7-T01 | PixiJS を peer dependency 化し、library は devDep 固定版で開発する | done |
| P7-T02 | 公開 API だけの最小実働 consumer 例（root `index.ts` import） | done |
| P7-T03 | BitmapFont の consumer 所有契約（DEFAULT_ は sandbox 用と明記） | done |
| P7-T04 | GitHub Actions で `bun run check` を固定 | done |
| P7-T05 | README / SUBMODULE / API / SPEC の最終整合 | done |
| P7-T06 | `bun run check` へ consumer HTTP smoke を含め、browser 起動を確認 | done |

実装順は表の ID 順。Compose には 1 タスクずつ渡す。

## 品質ゲート（全 Phase）

- `src/` の `from "phaser"` および `phaser` 依存は 0
- `dist/index.d.ts` に `any` なし
- 公開 barrel が internal helper を再 export しない
- Promise は 1 回 settle。destroy は冪等
- window は app 所有の Assets / renderer / canvas を unload / destroy しない
- `pixi.js` は `peerDependencies`（consumer 所有）。library `dependencies` に置かない。Vite `external: ["pixi.js"]` を維持する
- consumer 向けコードは `src/**` へ deep import しない。入口は root `index.ts`
- consumer 向けコードは sandbox 専用パス `/examples/assets/fonts/jf-dot-mplus12/` に依存しない

## 進行ループ

1. Grok が `PROGRESS.md` から次タスクを選び、`docs/tasks/<ID>.md` を書く
2. Compose を新しい実装コンテキストで開き、その ID だけ実装させる
3. Grok が diff とテストをレビューし、受入条件ごとに合格 / 修正 / 保留
4. 修正は同じ ID で最大 3 巡。超えたら PROGRESS に残して人間判断
5. 合格後だけチェックボックスを更新する
