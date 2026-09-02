# Documentation index

**他プロジェクトへの正式導入は Git submodule のみ**です。手順は [SUBMODULE.md](SUBMODULE.md)、最小実働例は [examples/consumer/minimal-submodule-runtime.ts](../examples/consumer/minimal-submodule-runtime.ts) を正とします。consumer は互換 range の `pixi.js`（`peerDependencies`）と独自フォント asset を所有し、import はリポジトリ直下の `index.ts` から行います。

仕様判断が競合する場合の優先順:

1. [SPECIFICATION.md](SPECIFICATION.md) — 目標仕様（landed 契約 + 将来 Defer）
2. [API.md](API.md) — 公開 API（Current surface）
3. [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md) — Phaser 版との Keep / Rename / Drop / Defer
4. [PORTING_PLAN.md](PORTING_PLAN.md) / [PROGRESS.md](PROGRESS.md) — 移植進行
5. [adr/](adr/) — 個別設計判断

## Start here

| Need | Document |
|---|---|
| 目標仕様 | [SPECIFICATION.md](SPECIFICATION.md) |
| 公開 API | [API.md](API.md) |
| submodule 統合 | [SUBMODULE.md](SUBMODULE.md) |
| PixiJS 移植 checklist | [PIXI_PORT_CHECKLIST.md](PIXI_PORT_CHECKLIST.md) |
| 移植の pin と所有権 | [../PORTING_BASELINE.md](../PORTING_BASELINE.md) |
| Phase とタスク分割 | [PORTING_PLAN.md](PORTING_PLAN.md) |
| いまの合格／次タスク | [PROGRESS.md](PROGRESS.md) |
| 公開 API 差分 | [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md) |
| Phaser からの破壊的変更 | [MIGRATION.md](MIGRATION.md) |
| 移植中に混ぜない改善 | [BACKLOG.md](BACKLOG.md) |
| Compose 向けタスク票 | [tasks/](tasks/) |
| 方針（人間承認済み） | [../Reusable PixiJS Window System 移植・開発方針.md](../Reusable%20PixiJS%20Window%20System%20移植・開発方針.md) |

`SPECIFICATION.md` は lifecycle / ownership / font / input 契約の規範です。`API.md` の Current surface が公開 symbol の正です。移植元 commit `7cfd3156a5184193fe9e9e63958e5416d277e37e` の契約を PixiJS 語に置換したものが正とします。
