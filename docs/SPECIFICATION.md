# Reusable PixiJS Window System specification

この文書は目標仕様（移植元 commit `7cfd3156a5184193fe9e9e63958e5416d277e37e` を PixiJS 語に置換したもの）です。公開 symbol のシグネチャは [API.md](API.md)、Phaser 版との差分は [API_COMPATIBILITY_MAP.md](API_COMPATIBILITY_MAP.md)、設計判断の根拠は [ADR](adr/) を参照してください。

## Scope

本 framework は PixiJS `Application` 上で再利用できる window、BitmapText、入力、scroll、focus/modal の部品を提供します。ゲーム固有の inventory、dialogue graph、sound manager、localization、DOM accessibility tree は所有しません。window の第 1 引数は `PixiWindowHost` です。

Status: landed (Phase 2–5)

## Stable entry points

| Use | Entry point |
|---|---|
| Git submodule source | repository `index.ts` |
| Repository build source | `src/index.ts` |
| Built JavaScript | `dist/index.js` |
| Type declarations | `dist/index.d.ts` |

4つの入口は同じ公開 surface を表します。`src/index.ts` から export されない source file は internal です。

Status: landed (Phase 0 entry + Phase 2–5 barrel)

## Core ownership

- `WindowBase` は root/content container、theme、renderer、clipper、transition、visibility、active/enabled state、`PixiWindowHost` destroy 時の cleanup を所有します。
- 派生 window は message、selection、scroll などの domain state を所有します。
- `WindowFocusController` は application / host 側が所有し、process-global singleton にはしません。
- injected input の破棄は `ownsInput` が `true` の owner だけが行います。

Status: landed (Phase 2)

## Open/close lifecycle

- 構築直後の phase は常に `closed`、openness は `0` です。`WindowConfig` に初期オープン用のフラグはありません。openness `0` では root の `scaleY` が `0` のため画面に見えません。
- 開くには構築後に `open(durationMs?)` を呼びます。省略時の duration は `theme.transitionDurationMs`（既定 200ms）です。
- 最初から開いた状態で見せるには `open(0)` を使います。duration `0` は同期的に `phase: "open"`、`openness: 1` へ settle します。
- `open()` は `activate()` を兼ねません。入力を消費するには open に加えて visible / active / enabled が必要です。
- `MessageWindow.say`、`ChoiceWindow.choose`、`CommandWindow.chooseCommands` は既定で `autoOpen: true` のため、操作開始時に `open()` します。これは構築時の初期オープンではありません。Help / Log / Document および素の `WindowBase` にはこの自動オープンはありません。

Status: landed (Phase 2 — `WindowBase`; Phase 4 — `say` / `choose` / `chooseCommands`)

## Coordinates and rendering

- `WindowConfig.x/y/width/height` と content bounds は整数 pixel を前提とします。
- content child は content-local coordinates を使用します。
- WebGL clipping が primary です。**Canvas GeometryMask fallback は提供しません**（Drop。詳細は [ADR 0001](adr/0001-content-clipping.md)）。
- renderer 差し替えは `WindowBaseOptions.createRenderer` だけを通します。
- `WindowBase` は renderer resize を自動購読せず、host / application が `layoutWindowInViewport()` の結果を適用します。

Status: landed (Phase 2)

## Content padding

- 文字・行ラベル・portrait・cursor・scrollbar・clip が共有する内側矩形は、外接矩形 `width`/`height` から `theme.padding` を引いた content bounds です。第二の `text.padding` はありません。
- `padding` は非負の数値（四辺同一）または `{ top, right, bottom, left }` です。省略時は四辺とも `12`。`0` は有効です。負数・非有限は `WindowConfigError`、content が非正になる値は `WindowLayoutError` です。
- 構築時は `WindowConfig.theme.padding`、実行時は `WindowBase.setPadding()` または `setTheme({ padding })` で変更し、派生 window は `onLayoutChanged` で再 layout します。
- wrap 幅・選択行幅は content 幅を使います。`MessageWindow` はさらに portrait 予約幅を引きます。

Status: landed (Phase 2)

## Chrome visibility

- 既定 chrome は `GraphicsWindowRenderer` の塗り（`backgroundColor` / `backgroundAlpha`）と枠（`borderColor` / `borderAlpha` / `borderWidth`）です。
- Graphics の下地だけ消すには `backgroundAlpha: 0`、枠も消すには `borderWidth: 0` です。両方指定すると chrome は見えず、content（文字など）は残ります。
- `hide()` や window 全体の `setAlpha(0)` は chrome だけでなく content も消します。下地オフではありません。
- `createNineSliceWindowRenderer` はロード済みテクスチャを必須とし、theme の alpha / border では画像を消しません。下地画像なしにするには NineSlice factory を渡さず Graphics を `backgroundAlpha: 0` かつ `borderWidth: 0` にするか、独自 `createRenderer` を注入します。未ロードテクスチャは `MissingWindowSkinError` で、Graphics へ silent fallback しません。

Status: landed (Phase 2 — Graphics; Phase 5 — NineSlice)

## Text wrapping

- 本文 layout（`layoutText()` / `layoutRichText()`、`MessageWindow`、`HelpWindow`、`LogWindow`、`DocumentWindow`）の折り返しは常に有効です。無効化する公開オプションはありません。1 行に収めたい場合は幅・padding・文字列を変えます。
- 入力は `string | RichText` です。マークアップ言語はありません。`{font}` / `{size}` トークンはありません。
- wrap 基準幅は content 幅です。ASCII は空白区切りの greedy wrap、幅に収まらない連続トークンと日本語などは grapheme 分割です。日本語禁則（kinsoku）はありません。
- 明示改行は `\n`（および `\r\n` / `\r`）だけです。高さに収まらない行はページ（Message / Help）または scroll 高さ（Log / Document）へ送られます。`HelpWindow` は `pageIndex === 0` のみ描画します。
- Choice / Command の行ラベルは wrap しません。`rowHeight` 固定で 1 行に収め、長い label は行ボックスを横にはみ出し clip されます。
- 選択カーソルのリスト周回は別契約です。`SelectionControllerOptions.wrap`（省略時 `true`）は上下左右の移動が端で周回するかです。文字折り返しとは独立です。

Status: landed (Phase 3)

## Input contract

- adapter は action、pointer、wheel、drag を意味イベントへ正規化します（`PixiWindowInput`）。
- window は open + visible + active + enabled のときだけ入力を消費します。
- 同じ host の window は通常1つの adapter を共有します。
- focus/modal の排他制御は host-owned `WindowFocusController` が担当します。

Status: landed (Phase 2 — input; Phase 5 — focus / modal bind)

## Async operation contract

- `say()`、`choose()`、open/close transition は完了または typed cancellation で必ず1回だけ settle します。
- 同一 window の同種 operation を重ねると busy error になります。
- destroy / host shutdown は購読を解除し、pending operation を拒否して display object を解放します。
- application は cancellation を正常な lifecycle terminal path として扱います。

Status: landed (Phase 4)

## Text and font contract

- canvas text は Pixi `BitmapText` のみを使い、Pixi `Text`、CSS font、OS font fallback は使いません。
- font は consumer が Pixi `Assets.load` で preload します（P2-T01 spike 済み。詳細は [ADR 0002](adr/0002-bitmap-font-loading.md)）。
- glyph は layout 前に検査し、fallback chain を使い切ると `MissingBitmapGlyphError` を投げます。未ロード font key は `BitmapFontNotLoadedError` です。
- scale、座標、font size は整数を基本とし、nearest-neighbor と整数座標を使用します。
- 本文の折り返し契約は [Text wrapping](#text-wrapping) を正とします。

Status: landed (Phase 2 — font load; Phase 3 — layout / measurer)

### Rich text

- `RichText = { spans, align? }`。各 span は `text` と任意の `fontKey` / `fontSize` を持ちます。
- 同一本文で font と fontSize を混在できます。同じ span に両方指定できます。
- `align` は `left` / `center` / `right`。content 全体で 1 つ。各行の実測幅と content 幅で配置します。
- 混在サイズは共通ベースラインで配置します。BMFont XML の `base` を使い、runtime が base を捨てる場合はグリフ最頻 bottom から推定します。
- 既存 `string` API は左寄せ・theme 既定 style のままです。
- 公開 layout 関数は `layoutRichText`。`layoutText(string)` は残ります。
- `MessageWindow` の `{color}` 等は span 連結文字列に対して従来どおり適用されます。
- span の `fontKey` は文字ごとに `[span.fontKey, ...theme.fontKeys]`（重複除去）で解決します。未ロードは `BitmapFontNotLoadedError`、連鎖尽きは `MissingBitmapGlyphError` です。
- 公開 extension point `BitmapTextMeasurer` の `base` / `measureRun` / `fontMetrics` / `hasGlyphFor` は optional です。未実装でも既存メンバーだけで `layoutText` / `layoutRichText` に渡せます。

Status: landed (Phase 3)

## Extension points

- chrome: `createRenderer` / `WindowRendererFactory`
- input: `WindowInputAdapter`（`PixiWindowInput`）
- text metrics: `BitmapTextMeasurer`（`PixiBitmapTextMeasurer`）
- focus/modal: host-owned `WindowFocusController`
- accessibility: `bindWindowA11y()` の意味イベントを application layer へ接続

内部 helper の deep import や `WindowBase` private/protected state への依存は extension point ではありません。

Status: landed (Phase 2–5)

## Error policy

設定不正、busy、destroyed、missing font/glyph/skin/portrait、layout failure、operation cancellation は公開 typed error で通知します。silent fallback や未完了 Promise は許容しません。具体的な error 一覧は [API.md](API.md) を参照してください。

Status: landed (Phase 1–5)

## Compatibility boundary

互換性を保つ対象は、公開 entry point の export、公開型、本文書の lifecycle/ownership contract です。次は互換性対象外です。

- `src/index.ts` に export されない module、class、function
- `examples/` と `tests/` の構成
- sandbox 専用 asset URL
- internal display object hierarchy と private field

PixiJS 対応バージョンは `package.json` の `peerDependencies.pixi.js`（`>=8.20.1 <9`）を正とします。consumer は互換 range 内の `pixi.js` をインストールし、library と同一 runtime を共有します。library は PixiJS を bundle しません。公開 surface の破壊的変更は仕様書・API・consumer fixture・release checklist を同じ変更で更新します。

Status: landed

## Verification evidence

- Checklist: [PIXI_PORT_CHECKLIST.md](PIXI_PORT_CHECKLIST.md)
- Source/package consumers: [`examples/consumer/`](../examples/consumer/)
- 既定 sandbox: `bun run dev` → [http://localhost:5173/](../index.html)
- Three.js overlay（標準）: [http://localhost:5173/three-overlay.html](../three-overlay.html)
- Three.js shared context（任意）: [http://localhost:5173/three-shared-context.html](../three-shared-context.html)
- Automated tests: `bun run check`
- Operator visual: 2026-09-02 人間、overlay / shared 問題なし（[PIXI_PORT_CHECKLIST.md](PIXI_PORT_CHECKLIST.md#browser-evidence)）

Status: landed (Phase 6 — 文書現行化まで)
