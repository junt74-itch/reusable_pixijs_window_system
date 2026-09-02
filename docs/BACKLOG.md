# Backlog

互換性マップに無い改善は Phase 6 完了まで混ぜない。Phase 7（援用性改善）も、ここに書いた公開・配布準備と機能追加は混ぜない。

## Deferred from source limits

- 日本語禁則処理
- 複数 gamepad
- 小数 font scale
- DOM accessibility tree

## Deferred by porting policy

- Phaser 版との 1 パッケージ動的切替
- 汎用レンダラー抽象の完成
- Three.js との単一 WebGL context 共有を標準経路にすること
- React 向け component、会話グラフ、localization、sound manager

## Phase 7 後の公開・配布準備（人間判断）

内部プロジェクトでの submodule 援用が確認できたあと、人間が可否を決める。Phase 7 では実装しない。決まるまで README は「正式な導入方法は Git submodule のみ」と書き、Git URL からの `bun add` / `npm install` が使えるように見せない。

- root `LICENSE` の追加
- package version を `0.1.0` 以上へ更新
- `src/index.ts` の `VERSION` と package version の同期検証
- npm 公開の要否
- package の `files` 指定
- package tarball を使った clean consumer test
- Git URL 直接インストールをサポートするか
- `private: true` を解除するか
- release tag と CHANGELOG
- main branch protection
- 方針 md の「pixi.js を runtime dependency とする」を peer dependency 記述へ更新するか（Phase 7 の package 契約は PORTING_PLAN / README / SUBMODULE が正）

## Discovered during port

- Phaser pin `7cfd315` の `examples/assets/fonts/jf-dot-mplus12/provenance.json` は `font.xml` sha256 を `7ff8d524...` と記録しているが、同 commit の実ファイルは `a442df20...`。Pixi 版は実ファイル hash に合わせた。上流 provenance の修正同期は人間判断。
- `PixiWindowInputOptions.keyboardTarget` はテスト差し込み。consumer API として文書化しない。必要なら後で internal options に分離。
- sandbox `?scene=` URL カタログ（複数 demo を query で切替）は Defer。既定 sandbox は `examples/main.ts` の say → choose のみ。

## Phase 7 で記録する破壊的変更候補

- `DEFAULT_BITMAP_FONT_ASSET` を公開 barrel から外し、sandbox 専用へ移す。当面は公開 API 互換のため残し、JSDoc で sandbox 用と明記する（P7-T03）。移設は破壊的変更が可能になった段階。
