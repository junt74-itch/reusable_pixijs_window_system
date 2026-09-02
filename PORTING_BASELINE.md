# Porting baseline

この文書は PixiJS 移植の判断基準である。実装開始後に移植元を追従しない。仕様変更は本ファイルと `docs/PROGRESS.md` を同じ変更で更新する。

記録日: 2026-09-02

## Source of truth

| 項目 | 値 |
|---|---|
| 移植元 | https://github.com/junt74-itch/reusable_phaser_window_system |
| Pin commit | `7cfd3156a5184193fe9e9e63958e5416d277e37e` |
| Commit date | 2026-08-31T10:27:43+09:00 |
| Subject | ウインドウ本文で文字範囲ごとのフォント・サイズと行揃えを指定できるようにする |
| 移植元 version | 0.1.0 (`reusable-phaser4-window-system`) |
| 移植先 | https://github.com/junt74-itch/reusable_pixijs_window_system |
| 方針 | [`Reusable PixiJS Window System 移植・開発方針.md`](Reusable%20PixiJS%20Window%20System%20移植・開発方針.md) |

以後の移植元差分は BACKLOG とし、本 pin を勝手に進めてはならない。

## Locked toolchain

移植元 `package.json` に合わせ、描画基盤だけ置換する。

| パッケージ | 版 | 役割 |
|---|---|---|
| bun (`@types/bun`) | 1.4.0 | test / scripts |
| typescript | 7.0.2 | strict + `.ts` extension imports |
| vite | 8.2.2 | library build + sandbox |
| pixi.js | 8.20.1 | **唯一の runtime renderer** |
| phaser | — | **禁止。dependencies / imports ともに 0** |

TypeScript 設定の継承対象:

- `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
- `moduleResolution: "Bundler"`, `allowImportingTsExtensions`, `verbatimModuleSyntax`
- library `dist/index.js` + `dist/index.d.ts`
- Vite `build.rollupOptions.external` は `pixi.js`（Phaser 版の `phaser` に相当）

## Font artifact（未コピー）

ADR 0002 の検証済み upstream:

- Repository: `junt74-itch/reusable_pixel_font_builder`
- Commit: `20fa374ba24d3d70ff7437ab39532f28261f45f5`
- Font id: `jf-dot-mplus12`
- 必須ペア: `font.png` + AngelCode `font.xml` + `license.txt`

Phase 0 では sandbox にフォントを入れない。Phase 2 の bitmap font spike で同期する。

## Inherited contracts（意味論は維持）

規範は移植元 `docs/SPECIFICATION.md`（上記 commit）である。PixiJS 版の現行仕様は後続タスクで `docs/SPECIFICATION.md` へ移植し、未達項目を明示する。

維持する利用側契約:

- `MessageWindow.say()` / `ChoiceWindow.choose()` / `CommandWindow.chooseCommands()` の Promise は完了または typed cancellation で **1 回だけ** settle する
- 同一 window の同種 operation 重ねは busy error
- `open` / `close` / `show` / `hide` / `activate` / `deactivate` / `destroy`
- 構築直後は `closed` / openness `0`。最初から見せるには `open(0)`
- `canConsumeInput()` = open + visible + active + enabled
- injected input の破棄は `ownsInput === true` の owner だけ
- silent fallback 禁止（font / glyph / skin / portrait / host 不備は typed error）
- 整数座標、整数 `fontSize`、整数 `scale`、nearest sampling
- 本文 wrap は常時有効。Choice / Command の label は wrap しない
- RichText `{ spans, align? }`。マークアップ言語なし
- `WindowFocusController` は process-global singleton にしない
- a11y は意味イベントのみ（DOM tree なし）
- `WindowBase` は scroll / skin / focus / portrait 固有 API を持たない

## Ownership snapshot（Phaser → PixiJS）

| Phaser 版 | PixiJS 版の置換先 | destroy 責任 |
|---|---|---|
| `Phaser.Scene` | `PixiWindowHost`（Renderer / stage root / canvas / ticker / logical size） | host / Application 所有者 |
| `scene.add.container` | `PIXI.Container` | window |
| `Graphics` chrome | `PIXI.Graphics` | renderer / window |
| `BitmapText` | `PIXI.BitmapText` | window（shared font cache は unload しない） |
| `NineSlice` | `PIXI.NineSliceSprite` | renderer / window |
| `scene.load.bitmapFont` / cache | `Assets.load` + 検証層 | consumer preload。window destroy で unload しない |
| WebGL filter mask / GeometryMask | `PIXI.Graphics` mask | `ContentClipper` |
| `PhaserWindowInput` | `PixiWindowInput`（keyboard/gamepad は Browser、pointer は Pixi federated events） | `ownsInput` owner |
| `bindFocusControllerToScene` | `bindFocusControllerToHost` | host shutdown で `dispose()` |
| Scene `shutdown` / `destroy` | host の destroy + 各 window の明示 `destroy` | 両方。host 破棄時は window を落とす |

`createPixiWindowHost(app)` は `Application` 利用者向け推奨ヘルパーとする。`Application` そのものへ Window を直接結合しない。

## Phaser 結合ファイル（置換対象）

移植元 `src/` のうち `from "phaser"` があるもの:

- `core/WindowBase.ts`
- `core/WindowRenderer.ts`（`Scene` / `Container` 型）
- `core/PhaserGraphicsFactory.ts`
- `core/ContentClipper.ts`
- `core/windowRendererFactory.ts`（factory 経由）
- `input/PhaserWindowInput.ts`
- `text/TextWindowBase.ts`
- `text/PhaserBitmapTextMeasurer.ts`
- `selection/SelectableWindow.ts`
- `selection/CursorRenderer.ts`
- `scroll/ScrollableWindow.ts`
- `scroll/ScrollbarRenderer.ts`
- `scroll/ScrollContentClip.ts`
- `scroll/ScrollOverflowIndicators.ts`
- `skin/NineSliceWindowRenderer.ts`
- `message/MessageWindow.ts`
- `help/HelpWindow.ts`（type-only）
- `log/LogWindow.ts`
- `document/DocumentWindow.ts`
- `focus/bindSceneShutdown.ts`

派生で Phaser 型が伝播するもの: `choice/ChoiceWindow.ts`, `command/CommandWindow.ts`。

## Engine-free 層（原則そのまま移す）

controller / layout / theme / error / 意味入力契約。Phase 1 で Phaser import 0 を検査する。

- `core/types.ts`, `theme.ts`, `TransitionController.ts`, `windowOperations.ts`, `GraphicsWindowRenderer.ts`
- `input/types.ts`, `WindowInputAdapter.ts`
- `text/types.ts`, `TextLayout.ts`, `richText.ts`, `fontMetrics.ts`, `fontFallback.ts`, `adaptBitmapTextMeasurer.ts`, `FallbackBitmapTextMeasurer.ts`, `stackedText.ts`, `BitmapFontAsset.ts`
- `message/MessageParser.ts`, `TextState.ts`, `MessageController.ts`, `layoutPages.ts`, `colorRuns.ts`, `richTextStyles.ts`, `sayPreflight.ts`, `types.ts`
- `selection/SelectionController.ts`, `cursorBlink.ts`, `types.ts`
- `scroll/ScrollController.ts`, `scrollInputBinding.ts`, `scrollVisibility.ts`, `scrollChrome.ts`, `types.ts`
- `focus/WindowFocusController.ts`, `focus/types.ts`
- `a11y/bindWindowA11y.ts`, `a11y/types.ts`
- `layout/viewportLayout.ts`
- `command/commandItems.ts`, `command/types.ts`
- `log/stickToLatest.ts`
- `skin/types.ts`

名称変更や整理は **挙動一致後** に限る。

## Verification evidence on source commit

- `bun run check` 構成: unit + typecheck + build + package + consumer typecheck
- Phase 2 checklist 時点: 168 unit + 10 package tests（実装後に数が増えている可能性あり。移植時はファイル単位で移す）
- sandbox routes: `examples/sceneKeys.ts` の `ALL_SCENE_KEYS`
- consumer fixtures: `examples/consumer/readme-example.ts`, `phase2-surface.ts`, `submodule-source.ts`

## Inherited ADRs（再検証が必要）

移植元 `docs/adr/`（同じ commit）:

| ADR | 題 | PixiJS での扱い |
|---|---|---|
| 0001 | Content clipping | WebGL/WebGPU の Graphics mask で再検証。Canvas GeometryMask は PixiJS v8 に Canvas 2D renderer が無いため **Drop** |
| 0002 | Bitmap font loading | `Assets.load` + measurer spike を Phase 2 先頭で実施 |
| 0003 | Renderer injection | `createRenderer` 契約は Keep。context の `scene` は host へ Rename |
| 0004 | Scroll composition | Keep。`ScrollableWindow` 継承禁止も Keep |
| 0005 | Scene-owned focus/modal | Keep。所有者名を host へ Rename。dimmer は host 所有のまま |

## Out of scope until Phase 6 complete

- Phaser / Pixi の動的切替
- React component、DOM a11y tree、会話グラフ、localization、sound manager
- WebGPU 固有最適化、複数 renderer 抽象の完成
- 単一 WebGL context を Three.js と共有すること（任意例は Phase 6）
- 互換性マップに無い機能追加（`docs/BACKLOG.md` へ送る）
