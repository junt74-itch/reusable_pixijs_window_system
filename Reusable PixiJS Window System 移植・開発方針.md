# Reusable PixiJS Window System 移植・開発方針

## PixiJSを標準レンダラーとし、Grok 4.6が仕様・進行、Compose 2.5が実装を担うための実務方針

# 1\. 結論

移植先は「Phaser版の見た目だけを書き換える派生物」ではなく、PixiJS v8.xを標準かつ唯一の描画基盤とするTypeScript製ゲームUIライブラリとして育てる。MessageWindow.say()、ChoiceWindow.choose()、スクロール、focus/modal、非同期ライフサイクル、typed errorなどの利用側契約は原則維持し、Phaser固有のScene・Game Object・入力・フォントキャッシュ・maskだけをPixiJS／Browser実装へ置換する。  
最初から汎用レンダラー抽象化を完成させることは目標にしない。既存の純粋ロジックを温存しつつ、PixiJS版を正規実装として完成させる。Three.jsとの併用は、まず別canvasを重ねる方式を標準例とし、単一WebGL context共有はMVP後の統合試験に分離する。

# 2\. 調査時点の前提

* 移植先リポジトリは作成済みだが、現時点では空である。したがって既存ファイルとの互換調整ではなく、移植元の特定commitを基準に初期化できる。  
* 現行Phaser版はversion 0.1.0で、Bun＋Vite＋TypeScript 7、Phaser 4.2.1を使用し、unit／package／consumer typecheckを含むbun run checkを持つ。  
* 現行契約にはMessage、Choice、Command、Help、Log、Document、Scrollable、NineSlice、focus/modal、RichText、bitmap font、入力共有、キャンセル可能な非同期操作が含まれる。  
* すでにWindowInputAdapter、各controller、layout、theme、errorなど、エンジン非依存に近い層がある。一方、WindowBase、TextWindowBase、MessageWindow、SelectableWindow、clipping、portrait、cursorなどはPhaser Game Objectへ直接依存している。  
* PixiJS v8.xはContainer、Graphics、BitmapText、NineSliceSprite、mask、Assets、federated pointer eventsを備え、Three.jsとの併用手順も公式に示されている。

# 3\. 製品ゴールと非ゴール

## 製品ゴール

* Phaserを依存関係から完全に除外し、pixi.jsをruntime dependencyとする。  
* PixiJS単体アプリとThree.js上の2D UI overlayの両方から、同じWindow APIを利用できる。  
* 移植元の公開APIと意味論を可能な範囲で維持し、相違はMIGRATION.mdに明示する。  
* bitmap fontの欠損グリフ検査、整数座標、nearest sampling、Promiseの一回だけのsettle、destroy時の購読解除を維持する。  
* root index.ts／dist／型宣言／submodule source importの入口を揃え、未来の自分やAIが唯一の推奨導入ルートを選べるREADMEにする。

## 当面の非ゴール

* Phaser版とPixiJS版を1パッケージで動的に切り替えること。  
* React向けcomponent、DOM accessibility tree、レイアウトエンジン、会話グラフ、localization、sound managerまで所有すること。  
* 初期段階からWebGPU固有最適化や複数rendererの完全抽象化を行うこと。  
* 移植と同時に既存APIを全面刷新すること。機能追加は移植完了後に別WBSとする。

# 4\. 目標アーキテクチャ

構造は「意味論を持つcore」「PixiJS表示層」「Browser入力層」「統合用host」に分ける。PixiJSを標準にするが、Applicationそのものへの強結合は避け、Renderer・stage root・canvas・ticker/lifecycleを束ねるPixiWindowHostを境界にする。Application利用者にはcreatePixiWindowHost(app)を推奨ヘルパーとして提供する。

## 推奨モジュール境界

* core: controller、状態、layout、theme、typed error、focus stack、a11y意味イベント。PixiJS importを置かない。  
* pixi: WindowBase、Graphics renderer、NineSlice renderer、ContentClipper、BitmapText measurer／factory、portrait、cursor、scroll viewport。  
* input: WindowInputAdapter契約を維持し、PixiWindowInputをkeyboard／gamepad／Pixi federated pointer eventsで実装する。  
* host: stageへのattach/detach、update、resize、destroy、assetsの所有権を明示する。共有資産はwindow destroyでunloadしない。  
* examples: PixiJS単体sandboxとThree.js overlay sandboxを分ける。

## 主要な置換対応

* Phaser.Scene → PixiWindowHost。  
* Phaser.GameObjects.Container → PIXI.Container。  
* Phaser.GameObjects.Graphics → PIXI.Graphics。  
* Phaser.GameObjects.BitmapText → PIXI.BitmapText。  
* Phaser.GameObjects.NineSlice → PIXI.NineSliceSprite。  
* scene.load.bitmapFont／cache → Assets.loadとBitmapFont cacheの検証層。  
* GeometryMask／WebGL filter mask → PixiJSのGraphics mask。stencil要件は共有context例で明示する。  
* Scene shutdown／destroy → host所有のdestroyと、各windowの明示的destroy。

# 5\. 開発原則

* 契約先行: 実装前に移植元commit、公開API、仕様、error、所有権、完了条件を固定する。  
* 縦切り: 最初にWindowBaseだけを全機能分解するのではなく、表示・入力・文字・destroyを通した小さな実動経路を作る。  
* 差分最小: engine-freeなcontroller／layoutは原則そのまま移し、名称変更や整理は挙動一致後に行う。  
* silent fallback禁止: font、glyph、skin、host設定の不備は既存方針どおりtyped errorにする。  
* 所有権を曖昧にしない: stage、renderer、canvas、ticker、Assets cache、inputの誰がdestroy／unloadするかを型と文書に書く。  
* 検証不能な完了を認めない: unit testだけでなく、sandbox、consumer build、destroy/leak、Three.js overlay smokeまで通して完了とする。

# 6\. Grok 4.6とCompose 2.5の役割

## Grok 4.6：仕様策定・進行・レビュー

* 移植元の特定commitを読み、API／挙動／所有権／例外／テストの対応表を作る。  
* docs/PORTING\_PLAN.md、docs/PROGRESS.md、docs/adr/、タスク票を更新する。  
* 1タスクを1つの検証可能な成果へ分割し、対象ファイル、非対象、受入条件、実行コマンドをComposeへ渡す。  
* Composeの差分を仕様逸脱、Phaser残存、資産所有権、Promise settle、destroy漏れ、公開API差分の観点でレビューする。  
* bun run checkと該当sandboxを確認し、合格／修正／保留を判定する。大規模な実装は担当しない。

## Compose 2.5：実装

* 渡されたタスク票の範囲だけを実装し、同じ変更でunit test、必要なintegration fixture、文書差分を追加する。  
* 移植元からコードを持ち込む場合はengine-free層を優先し、Phaser型をanyや薄い偽型で隠さない。  
* API変更、仕様の曖昧さ、PixiJS制約、テスト不能を発見したら勝手に範囲を広げず、Grokへ判断材料を返す。  
* 完了報告には変更ファイル、判断点、実行結果、未解決事項を必ず含める。

## 人間が承認する判断

* 公開APIの破壊的変更、MVP範囲の増減、ライセンス／配布形態、Three.js共有contextを標準にするかどうか。  
* 同じ失敗が3回続いたタスクの設計変更。GrokとComposeの往復だけで無限修正しない。

# 7\. 推奨WBS

## Phase 0：基準線とリポジトリ初期化

* 移植元commitをpinし、PORTING\_BASELINE.mdに記録する。  
* Bun＋Vite＋TypeScript 7、PixiJS v8.x、check scripts、root index.ts、dist entryを作る。  
* 仕様、API、release checklist、ADRのうち移植判断に必要な文書を複製・改名し、未達項目を明示する。  
* 完了条件: 空のlibrary build、package consumer、最小Pixi sandboxが通る。

## Phase 1：互換性マップと純粋core

* 公開exportをKeep／Rename／Drop／Deferに分類する。  
* controller、layout、theme、error、focus、a11y意味イベントをPhaser importなしで移す。  
* characterization testを先に移し、移植元と同じ入力から同じ状態遷移・layout結果・errorを得る。  
* 完了条件: coreのunit testがPhaserなしで通り、禁止import検査がある。

## Phase 2：Pixi基盤の縦切り

* PixiWindowHost、Graphics chrome、content mask、PixiWindowInput、bitmap font loader／measurerを実装する。  
* WindowBaseのopen／close／show／hide／activate／destroyを移植する。  
* WindowBase sandboxでresize、padding、chromeless、途中反転、破棄を確認する。  
* 完了条件: Phaser dependencyゼロ、window一枚が表示・操作・破棄できる。

## Phase 3：テキストとスクロール

* TextWindowBase、RichText layout、font fallback chain、missing glyph検査を移植する。  
* ScrollableWindow、wheel、PageUp／PageDown、drag、scrollbar、overflow indicatorを移植する。  
* 整数座標／nearest samplingとクリップ境界の視覚fixtureを追加する。  
* 完了条件: 長文、日本語、複数font size、長いリスト、resize後再layoutが再現する。

## Phase 4：主要ウィンドウ

* MessageWindowとChoiceWindowを先に移し、say→chooseのintegration sceneを完成させる。  
* busy、cancel、destroy中、autoOpen、closeOnComplete、page送り、keyboard／pointer／gamepadを検証する。  
* 完了条件: 移植元の主要デモとPromise契約が一致する。

## Phase 5：拡張ウィンドウとskin

* Command、Help、Log、Document、focus/modal、portrait、NineSliceを移植する。  
* skin未ロード、portrait未ロード、font swap中などのtyped errorを揃える。  
* 完了条件: 旧sandbox相当の全routeとrelease checklistが埋まる。

## Phase 6：Three.js統合と配布品質

* 標準例はThree.js canvasの上にPixiJS canvasを重ね、resizeと入力座標を同期する。  
* 任意例として単一WebGL context共有を追加し、renderer.resetState、clear抑止、stencil、render順を検証する。  
* READMEの推奨導入経路を一本化し、SUBMODULE.md、MIGRATION.md、API.md、SPECIFICATION.mdを現行化する。  
* 完了条件: Pixi単体consumerとThree.js consumerの両方がbuild・実行でき、bun run checkが一括合格する。

# 8\. Cursor上の進行ループ

* Grokがdocs/PROGRESS.mdから次の最小タスクを選び、タスクID、目的、対象、非対象、受入条件、コマンドを記述する。  
* Composeを新しい実装コンテキストで開き、1タスクだけ実装させる。  
* Composeの報告後、Grokがdiffとテストをレビューし、受入条件ごとに判定する。  
* 修正は同じタスクIDで最大3巡。3巡で解消しなければ、設計仮説／再現手順／失敗ログをPROGRESSへ残して人間判断へ上げる。  
* 合格後だけチェックボックスと互換性マップを更新し、次タスクへ進む。複数Phaseを一度に実装させない。

# 9\. 品質ゲート

* 静的: strict、noUncheckedIndexedAccess、exactOptionalPropertyTypesを維持し、src内のphaser importを0件にする。  
* 自動: unit、integration、typecheck、build、package consumer、source consumerをbun run checkに束ねる。  
* 契約: 公開export snapshot、typed error、Promiseの一回settle、input subscription count、destroyの冪等性を検証する。  
* 表示: route固定のsandboxと代表画面のスクリーンショット比較を用意する。見た目差は許容差と理由を記録する。  
* 性能: 代表UIでobject数、draw call、texture数、更新頻度を記録する。最適化は測定後に行う。  
* 統合: Pixi単体、Three.js別canvas overlay、任意の共有contextの順で確認する。

# 10\. 主なリスクと先回り

* BMFont XMLの解釈差: PixiJSのAssets.load結果と既存font artifactの互換をPhase 2最初のspikeで確認する。base／kerning／欠損glyphのcharacterization testを置く。  
* 座標と解像度: devicePixelRatio、resolution、CSS size、logical sizeをhostで一元化し、window座標はlogical pixelに固定する。  
* mask差: PixiJS maskのWebGL／WebGPU差とThree共有contextのstencilを分離して検証する。  
* 入力の二重取得: Pixi eventとDOM eventの責務を分け、keyboard／gamepadはBrowser、pointerはPixi eventを正とする。  
* destroy責任: app所有資産をwindowが破棄しない。windowは自分のdisplay objectと購読だけを破棄する。  
* 移植中の機能追加: 互換性マップにない改善はBACKLOGへ送り、Phase 6までは混ぜない。

# 11\. Grok 4.6への初期指示テンプレート

あなたは本リポジトリの仕様策定者兼進行役です。移植元 reusable\_phaser\_window\_system の固定commitを読み、現行API・意味論・所有権・例外・テストを基準に、PixiJS v8.x標準実装へ段階移植してください。まず実装せず、PORTING\_BASELINE.md、PORTING\_PLAN.md、PROGRESS.md、公開API互換性マップ、最初のCompose向けタスク票を作成してください。タスクは1回で検証できる大きさにし、対象／非対象／受入条件／実行コマンドを明記してください。Phaserをanyや偽型で温存する案、仕様根拠のないAPI変更、複数Phaseの同時実装は却下してください。

# 12\. Compose 2.5へのタスク指示テンプレート

あなたは実装担当です。Grokが指定したタスクIDだけを実装してください。対象ファイル、非対象、受入条件を守り、実装と同じ変更でテストと必要な文書差分を追加してください。曖昧な仕様、公開API変更、PixiJS制約、所有権の衝突を見つけた場合は推測で範囲を広げず、選択肢と影響を報告して停止してください。完了報告は、変更ファイル／実装判断／実行コマンドと結果／未解決事項の順に記載してください。

# 13\. 参照資料

[移植先リポジトリ](https://github.com/junt74-itch/reusable_pixijs_window_system)／[現行Phaser版README](https://github.com/junt74-itch/reusable_phaser_window_system/blob/main/README.md)／[現行仕様書](https://github.com/junt74-itch/reusable_phaser_window_system/blob/main/docs/SPECIFICATION.md)／[PixiJS Application](https://pixijs.com/8.x/guides/components/application)／[PixiJS Assets](https://pixijs.com/8.x/guides/components/assets)／[PixiJS TextとBitmapText](https://pixijs.com/8.x/guides/components/scene-objects/text)／[PixiJS NineSliceSprite](https://pixijs.com/8.x/guides/components/scene-objects/nine-slice-sprite)／[PixiJS Events](https://pixijs.com/8.x/guides/components/events)／[PixiJSとThree.jsの統合](https://pixijs.com/8.x/guides/third-party/mixing-three-and-pixi)  
本方針は、移植先が空であること、移植元の現行README・仕様・package構成、およびPixiJS公式v8.xガイドを根拠に策定した。実装開始時には移植元commitとpixi.jsの正確なversionをlockfileで固定し、以後の判断基準をPORTING\_BASELINE.mdへ残す。  
