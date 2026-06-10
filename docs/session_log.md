# セッションログ — デジタル名刺サイト

---

## 2026-06-05

### 作業内容
リクエストいただいた5機能がすべてローカル実装済みであることを確認し、GitHubへデプロイ。

| 機能 | 状態 |
|---|---|
| カードをタップでフリップ（ヒントアニメ付き） | ✅ 実装済み・デプロイ完了 |
| Webシェアボタン（`navigator.share` → URLコピーフォールバック） | ✅ 実装済み・デプロイ完了 |
| 表示名（`displayName`）を管理画面で設定し日本語名を表示 | ✅ 実装済み・デプロイ完了 |
| OGPメタタグ（SNS/LINEシェア時に名刺画像がサムネ表示） | ✅ 実装済み・デプロイ完了 |
| 画像ダウンロードボタン（表示中のA/B面をスマホ保存） | ✅ 実装済み・デプロイ完了 |

### デプロイ情報
- **リポジトリ**: `furetomojapan/meishi`
- **コミット**: `6d3e381` — 全機能をデプロイ: タップフリップ・シェアボタン・表示名・OGP・ダウンロード
- **ブランチ**: `main`（force push）

### 次の課題
- 管理画面のリンク上限（現在3件）を増やす
- 管理パスワードのハードコード（`admin123`）を環境変数等に変更
- GitHub Pages カスタムドメイン設定の確認

---

## 2026-06-05（続き）

### 作業内容
QRポップアップが左にずれる問題を修正。

- **原因**: `position: absolute; left: 50%` がボタン幅(80px)基準で計算され、200px幅のポップアップが左にはみ出していた
- **修正**: `position: fixed; left:50%; top:50%; transform:translate(-50%,-50%)` に変更し viewport 中央に表示。外側クリックで閉じるオーバーレイも追加
- **コミット**: `7c73201` — fix: QRポップアップをviewport中央に修正

### 補足（既実装済み機能の案内）
以下は今回のデプロイ（`6d3e381`）で既に実装されているため、追加コードは不要：
- URLラベル表示（Instagram/X/LINEなどのSNSアイコン付き）
- 管理画面でのSNSラベルドロップダウン選択
- カスタムラベルのテキスト入力（「カスタム入力」選択時）

### 次の課題
- 管理画面のリンク上限（現在3件）を増やす
- 管理パスワードのハードコード（`admin123`）を変更

---

## 2026-06-05（続き2）

### 作業内容：ラベル保存バグ修正

#### バグ原因（3件）
1. **SNSLabelPicker カスタム入力バグ**
   - 「カスタム入力」選択 → `onChange("")` が呼ばれ `value=""` になる
   - `isCustom = ("" !== "") && ...` = `false` → カスタム入力欄が表示されない無限ループ
   - **修正**: ローカル `useState(customMode)` でカスタムモードを独立管理

2. **保存結果が見えないUX問題**
   - 保存ステータスがスクロール下部のtoken欄に表示されており見逃しやすかった
   - **修正**: `Toast` コンポーネントを新設、画面上部中央にfixed表示

3. **localStorage未使用でページ再読み込み時にデータ消失**
   - GitHubトークン未設定の場合、保存データがページ再読み込みで消えていた
   - **修正**: 保存時に `localStorage.setItem('meisi_urls_data', ...)` も実行、起動時にlocalStorageから初期値を読み込み

- **コミット**: `b3e9ee1` — fix: ラベル保存バグ修正（カスタム入力・toastトースト・localStorage）

### 次の課題
- 管理画面のリンク上限（現在3件）を増やす
- 管理パスワードのハードコード（`admin123`）を変更

---

## 2026-06-07

### 作業内容：フリーミアム実装・技術改善

#### フリーミアムモデル（コミット `88cfa97` → `c0ee6bb`）
- 無料プラン: リンク1件・右端縦ストリップウォーターマーク（13px）
- PROプラン: リンク最大5件・ウォーターマーク非表示・¥480/月想定
- ライセンスキー認証: `licenses.json` 管理、形式 `MEISI-XXXX-XXXX-XXXX`
- 編集パネル: FREE時も全スロット表示しデータ消失を防止（PRO限定スロットはロック）

#### 管理パスワード変更機能
- ハードコード `admin123` を廃止 → `localStorage('meisi_admin_pass')` に移行
- 管理画面から変更可能

#### ライセンスキー管理UI
- 管理画面でワンクリック発行・メモ付き・一覧表示・失効ボタン
- GitHub API で `licenses.json` に自動追記

### 運用フロー
1. STORESで申し込み受付 → メールで通知
2. 管理画面でキー発行 → お客様にメール送付
3. お客様が管理画面でキー入力 → PRO有効化

### 次の課題
- STORESで商品ページ作成（¥480/月サブスク）
- ランディングページ作成
- カスタムドメイン設定

---

## 2026-06-07 セッション2（続き）

### 完了タスク
- **ユーザー編集モーダルをボトムシートに変更** (commit `0afe508`)
  - 中央ポップアップ → 画面下端から出現（`position:fixed; bottom:0; left:0; right:0; border-radius:24px 24px 0 0`）
  - ドラッグハンドル（グレーバー）を追加
  - `safe-area-inset-bottom` 対応（iPhone ホームバー考慮）
- **SNSLabelPicker をアイコングリッドに変更**
  - テキスト付きボタン → 32×32px の正方形アイコンボタン
  - 選択中のSNS名をグリッド下に小さく表示
  - 「なし」＝✕ ボタン、「カスタム」＝✎ ボタン
  - 1行に全ボタンが収まるコンパクトレイアウト（管理画面・ユーザー編集両方に適用）

### 次のタスク候補
- STORES 決済ページ作成（¥480/月）
- ランディングページ作成
- カスタムドメイン設定

---

## セッション 2026-06-07（続き）

### 完了タスク
- **日本語ウェルカムPDF作成** (`xyz_digitalcard_welcome.pdf`)
  - reportlab `HeiseiKakuGo-W5` CID フォントで日本語PDF生成
  - 購入お礼・STEP 1〜4・PRO特典・お問い合わせ先を記載
  - STORESの「デジタルコンテンツ」欄にアップロード済み

- **STORESリンクボタン追加・デプロイ**
  - `STORES_URL = "https://stores.jp/items/6a2546bbdb24c4c44d0274ef"` を定数として定義
  - Freeユーザーに「STORESで申し込む」ボタンを表示（黒丸ボタン）
  - タップすると STORES 商品ページへ遷移（別タブ）
  - GitHub Pages にデプロイ完了

### 次にやるべきこと
- STORESの公開URLが `stores.jp/items/{id}` 形式で合っているか確認（違う場合は `STORES_URL` を修正）
- STORESショップ設定（価格 ¥480/月、サブスクリプション設定、ウェルカムPDFアップロード）
- BASEショップ設定（物理プラスチック名刺販売）
- GAS の再デプロイ（plan 列追加後に必要）+ usersシートE1に `plan` ヘッダー追加確認

---

## 2026-06-08

### 作業内容：FREEプランをテキスト名刺に刷新

#### 完了タスク

| 機能 | 状態 |
|---|---|
| FREEプラン：テキスト名刺カード（CSS描画・画像不要） | ✅ |
| 名前・住所・電話番号の入力フォーム | ✅ |
| 裏面アピール項目 4つ | ✅ |
| 背景5種（hai1.png〜hai5.png）プレースホルダー生成 | ✅ |
| カラーティント8色（なし/ピンク/レッド/オレンジ/グリーン/ブルー/パープル/ブラック） | ✅ |
| ダウンロードボタンをPROプラン限定に変更 | ✅ |
| BgPicker / TintPicker コンポーネント追加 | ✅ |
| gas_backend.js に `profile` 列（F列）追加 | ✅ |

#### データモデル変更
```json
"profile": {
  "name": "鈴木 一郎",
  "address": "東京都渋谷区〇〇1-2-3",
  "phone": "090-1234-5678",
  "appeals": ["強み1", "強み2", "強み3", "強み4"],
  "bg": "2",
  "tint": "rgba(255,105,180,0.38)"
}
```

#### プラン別動作
- **FREEプラン** → テキスト名刺（FreeCardFaceコンポーネント）。ダウンロード非表示
- **PROプラン** → 従来通り画像名刺。ダウンロードボタンあり

#### デプロイ情報
- **コミット**: `b94932e` — feat: FREEプランをテキスト名刺に刷新
- **ブランチ**: `main`

---

## 2026-06-08（続き3）

### 作業内容：名前欄3分割・スタイル操作PRO限定・ヒント追加

| 機能 | 状態 |
|---|---|
| 名前欄を会社名・肩書き・名前の3フィールドに分割 | ✅ |
| 各フィールドに個別フォント/サイズ/位置（PRO限定） | ✅ |
| フォント・サイズ・位置変更をPROプラン限定に変更 | ✅ |
| FREEユーザーに「フォント・サイズ・位置はPROで利用可能」バッジ表示 | ✅ |
| 編集モーダルに「空白文字（スペース・改行）も認識します」ヒント追加 | ✅ |
| B面の ✦ 星マーク削除（前コミット） | ✅ |

- **コミット**: `335c364`

---

## 2026-06-08（続き2）

### 作業内容：✦削除・名前/住所/電話のフォント＆サイズ選択対応

#### 完了タスク

| 機能 | 状態 |
|---|---|
| B面アピール先頭の ✦ 星マーク削除 | ✅ |
| `FONT_SIZES` 定数追加（name/address/phone × S/M/L/XL） | ✅ |
| `SizePicker` コンポーネント追加（S/M/L/XL ボタン） | ✅ |
| 名前：サイズ選択を追加（フォント選択は既存） | ✅ |
| 住所：フォント選択＋サイズ選択を追加 | ✅ |
| 電話番号：フォント選択＋サイズ選択を追加 | ✅ |
| ボトムシート・管理パネル両方に反映 | ✅ |

#### デプロイ情報
- **コミット**: `4b5cfcd` — feat: ✦削除・名前/住所/電話にフォント＆サイズ選択（S/M/L/XL）追加
- **ブランチ**: `main`

---

## 2026-06-08（続き）

### 作業内容：名前テキストエリア・空白保持・位置揃え対応

#### 完了タスク

| 機能 | 状態 |
|---|---|
| 名前入力欄を3行テキストエリアに変更（改行対応） | ✅ |
| 名前・アピール表示に `white-space: pre-line` 適用（空白・改行を保持） | ✅ |
| AlignPicker コンポーネント追加（左/中/右の3択ボタン） | ✅ |
| 名前の位置揃え（`nameAlign`）を profile に保存・カード表示に反映 | ✅ |
| アピールの位置揃え（`appealsAlign`）を profile に保存・カード表示に反映 | ✅ |
| ボトムシート・管理パネル両方に AlignPicker を追加 | ✅ |

#### データモデル変更
```json
"profile": {
  "name": "鈴木\n一郎",
  "nameAlign": "center",
  "appealsAlign": "left",
  ...
}
```

#### デプロイ情報
- **コミット**: `99729de` — feat: 名前テキストエリア・空白保持・位置揃え（左/中/右）対応
- **ブランチ**: `main`

### 次にやるべきこと
- **GAS再デプロイ必須**: `gas_backend.js` の `profile` 列対応コードをGASに貼り付けてデプロイし直す（`users` シートにF列 `profile` ヘッダーが自動追加される）
- `hai1.png`〜`hai5.png` を実際のデザイン画像に差し替え（現在はグラデーションのプレースホルダー）
- `xyz_design_change.pdf`（背景変更サービス）の説明をカスタムデザイン対応として更新
- STORESの商品説明にFREEプランのテキスト名刺機能を記載

---

## 2026-06-08（続き4）

### 作業内容：ピッカー常時表示・FREEはグレーアウト

| 機能 | 状態 |
|---|---|
| AlignPicker / FontPicker / SizePicker に `disabled` プロップ追加（opacity:0.35, pointerEvents:none） | ✅ |
| ボトムシート：`{pro && <AlignPicker>}` → `<AlignPicker disabled={!pro}>` に変更（全フィールド） | ✅ |
| ボトムシート：`{pro && (<FontPicker/><SizePicker/>)}` → 常時表示・`disabled={!pro}` に変更 | ✅ |
| 管理パネル：同様に `personIsPro` 条件を `disabled={!personIsPro}` に変更 | ✅ |

FREEユーザーにもピッカーが見えることで「PROにアップグレードすれば使える」ことが伝わるUXに改善。

- **コミット**: `eb66e95` — feat: フォントサイズ/フォント/位置ピッカーを常時表示・FREEプランはグレーアウト

---

## 2026-06-08（続き5）

### 作業内容：ユーザー管理改善・バージョン表示

| 機能 | 状態 |
|---|---|
| `APP_VERSION` 定数を追加（`v1.6`）→ デプロイごとにインクリメント | ✅ |
| 管理パネル Library 横にバージョンバッジ表示 | ✅ |
| 管理パネルにユーザー削除ボタン追加（確認ダイアログ付き） | ✅ |
| GAS に `delete_user` アクション＋`deleteUser()` 関数追加 | ✅ |
| `loadNamesData` をGASユーザーキー優先に改修 | ✅ |
| 管理パネルに「新規ユーザー追加」フォーム追加 | ✅ |

### 次にやるべきこと
- GAS を再デプロイして `delete_user` アクションを有効化
- `hai1.png`〜`hai5.png` を実際の背景画像に差し替え

- **コミット**: `v1.6` 系（複数コミット）

---

## 2026-06-08 — v2.1

### 作業内容
- **バグ修正: 画像アップロード・テキストオーバーレイトグルが即時反映されない**
  - 原因: `FlipCard` は `urlsData` の `pd.profile` を参照していたため、`userEditProfile` の変更が保存前にカードへ反映されなかった
  - 修正1: ボトムシートが開いている間（`showUserEdit === true`）は `previewPd = { ...pd, profile: userEditProfile }` を `FlipCard` に渡し、全編集操作がリアルタイムでカードに表示されるようにした
  - 修正2: `uploadImg` — ファイル選択直後に `URL.createObjectURL()` でローカルプレビューを即時表示。GAS成功時はDrive URLに差し替え、失敗時は "⚠ プレビューのみ" 警告を表示
  - 修正3: `saveUserLinks` で `blob:` URLをストリップ（セッションローカルのURLは永続化しない）

### デプロイ
- commit: `v2.1: リアルタイムプレビュー・画像アップロード即時表示修正`
- push: `main -> main` ✓

### 次のタスク
- GASの `upload_image` + `delete_user` アクションを有効にするため、GASエディタに `gas_backend.js` を貼り付けて再デプロイが必要（ユーザーへ案内済み）

---

## 2026-06-08 — v2.2

### 作業内容
- **裏面の文字反転バグ修正**
  - `flip-face` に `translateZ(1px)` 追加でGPUレイヤーを確保
  - `flip-card.flipped .flip-face { visibility:hidden }` を追加（backface-visibility未対応ブラウザ対策）
  - `flip-card:not(.flipped) .flip-face-back { visibility:hidden }` も追加

- **表裏別背景デザイン**
  - `normalizeProfile` に `bgBack` フィールド追加（デフォルト: 表面と同じ）
  - `FreeCardFace` が `side="back"` の場合は `bgBack` を使用
  - 編集フォームに「背景デザイン（表面）」「背景デザイン（裏面）」の2つのBgPickerを追加

- **hai7〜10.png 追加**
  - 7: 紺〜紫グラデーション
  - 8: 深緑〜緑グラデーション
  - 9: 茶〜オレンジグラデーション
  - 10: 黒〜グレーグラデーション
  - BgPickerを1〜10の10種類に拡張

### デプロイ
- commit: `v2.2: 裏面文字反転修正・表裏別背景デザイン・hai7-10追加`
- push: `main -> main` ✓

### 次のタスク
- GAS再デプロイ（delete_user アクション有効化）

---

## 2026-06-08 — v2.3

### 作業内容
- **PRO文字色変更機能追加**
  - `TextColorPicker` コンポーネントを新規作成（プリセット12色 + カスタムカラー入力）
  - `normalizeProfile` / `defaultProfile` に `textColor` フィールド追加（デフォルト: `#ffffff`）
  - `FreeCardFace` が `profile.textColor` を参照するよう更新
  - 文字色の明度を自動判定し、テキストシャドウを白系/黒系に自動切替（見やすさ確保）
  - 編集フォームの「カラー（オーバーレイ）」の下に「文字色」ピッカーを追加（FREEはグレーアウト）

### デプロイ
- commit: `v2.3: PRO文字色変更機能追加（TextColorPicker）`
- push: `main -> main` ✓

---

## 2026-06-08 (v2.4)

### 完了タスク
- フィールド別文字色（companyColor, titleColor, nameColor, addressColor, phoneColor, appealColors[]）を実装
- 編集フォームを縦積みレイアウトに全面リファクタ  
  各フィールド: ラベル + AlignPicker → 入力欄 → フォント行 → サイズ行 → カラー行（ラベル左・ピッカー右）
- アピール項目: フォント行 + カラー行（サイズなし）
- グローバル文字色を「デフォルト文字色（各フィールドで未設定の場合に使用）」に改名
- APP_VERSION → v2.4
- GitHub push & デプロイ完了

### 次の課題
- GAS 再デプロイ（delete_user アクション対応）
- 住所・電話の AlignPicker 追加（現状 PRO のみ companyAlign/titleAlign/nameAlign のみ）
- スマホ実機での動作確認


---

## 2026-06-08 (v2.5)

### 完了タスク（セキュリティ修正）
- セキュリティホール修正: 誰でも「リンクを編集」できた問題
- ユーザー追加時に6桁PINを自動生成
- 管理パネルのユーザー一覧にPIN表示 + 「再生成」ボタン
- 「リンクを編集」ボタン → 6桁PIN入力モーダルを経由（正しいPINのみ編集可）
- 編集ボトムシートの下部にPIN変更欄を追加
- APP_VERSION → v2.5
- GitHub push & デプロイ完了

### 注意
- 既存ユーザー（PINが未設定）はPIN認証なしで編集可能のまま → 管理パネルから手動で再生成推奨


---

## 2026-06-08 (v2.7〜v2.8)

### 完了タスク
- PIN変更欄をユーザー編集シートの「表示名」フィールド上に移動
- 管理パネルの編集セクションに PIN変更欄を追加（「名前」フィールド上）
- APP_VERSION → v2.8
- GitHub push & デプロイ完了


---
## Session 2026-06-08 (v3.5)

### 作業内容
- ユーザー編集ボトムシート（白背景）のラベル色を改善
  - `text-neutral-400` → `text-neutral-700 font-medium` に変更
  - 対象: 会社名、肩書き、名前、住所、電話番号、裏面アピール項目（4つ）
  - セクションヘッダー「名刺情報」: neutral-500 → neutral-700
  - カラー（オーバーレイ）、デフォルト文字色、背景デザイン各ラベル
  - PIN変更、表示名、リンク、独自背景画像ラベル
  - PRow sub-labels（フォント/サイズ/カラー）: neutral-400 → neutral-600
- APP_VERSION: v3.4 → v3.5

### 課題と修正
- 前セッションの git rebase / index.lock 問題により /tmp に一時クローンしてデプロイ

### 次にやること
- GAS redeployment（delete_user action）
- グレイアウトと有効UIのコントラスト調整（継続）

---

## セッション 2026-06-10 (v4.10) — welcome.html 新規登録・self_register・isNewUser バナー

### 完了タスク

| 機能 | 状態 |
|---|---|
| `welcome.html` 新規作成（メールアドレス入力 → GAS → URL送信） | ✅ |
| GAS: `self_register` アクション追加 | ✅ |
| GAS: `normalizeEmail()` — Gmail +alias / ドット正規化 | ✅ |
| GAS: `generateShortId()` — ID重複時に3文字追加 | ✅ |
| GAS: `registrations` シート追加（24h重複防止） | ✅ |
| GAS: `initSheets()` に registrations シート初期化追加 | ✅ |
| `index.html` v4.10: `isNewUser` バナー（`?new=1` パラメータ検出） | ✅ |

### self_register の仕様
- メール正規化（Gmail +alias・ドット除去）で同一アドレスの重複登録を防止
- 同一メールで24h以内の再登録はブロック
- IDは `@` より前を使用、重複時は3文字のランダム英数字を付加（最大10回）
- 登録完了後：ユーザーへカードURL付きメール送信、管理者 `furetomojapan@gmail.com` にも通知

### isNewUser バナーの仕様
- `?new=1` パラメータで `isNewUser=true` → URL から即削除（`history.replaceState`）
- バナーは名刺編集ボタンの上に表示、✕ボタンで閉じられる

### デプロイ
- commit: `52917d6`
- URL: https://furetomojapan.github.io/meishi/
- 登録ページ: https://furetomojapan.github.io/meishi/welcome.html

### 次の課題（重要）
- **GAS再デプロイ必須**：`self_register` / `normalizeEmail` / `generateShortId` / `registrations` シートを反映するため、GASコンソールで「新バージョン」としてデプロイ
- **`initSheets()` を手動実行**：`registrations` シートを作成するため1回実行
- welcome.html の GAS_URL が現在の本番URLと一致しているか確認

---

## セッション 2026-06-10 (v4.10 hotfix) — 白画面バグ修正

### 問題
`isNewUser` の `useState` 宣言が抜けていたため、`?new=1` パラメータ付きURLで白画面になっていた。

### 修正
- `const [isNewUser, setIsNewUser] = useState(...)` を追加
- `?new=1` をURLから削除する `history.replaceState` useEffect を追加

### デプロイ
- commit: `0b5698c`
- URL: https://furetomojapan.github.io/meishi/

### 補足
`furetomojapan@gmail.com` で登録すると2通メールが届く（管理者通知 + ユーザー向けURL付きメール）。
管理者通知にはURLが含まれていないため混乱が生じた → 今後ユーザーメールにもURLを含める仕様は維持。

---

## セッション 2026-06-10 — デザインタブ 背景を先頭に移動

- デザインタブの表示順を変更: 背景デザイン（表面・裏面）→ カラー → デフォルト文字色 → 会社名〜アピールのフォント設定
- commit: `405ad76`

---

## セッション 2026-06-10 — 独自背景画像（+G）を最上部に移動

- デザインタブの表示順をさらに変更: 独自背景画像（+G・PRO限定アップロード）を一番上に移動
- 最終順序: 独自背景画像（+G）→ 背景デザイン（表面）→ 背景デザイン（裏面）→ カラー（オーバーレイ）→ デフォルト文字色 → 会社名〜アピール
- commit: `ef6eeac`

---

## セッション 2026-06-10 — メール文面・welcome.html: PIN説明文と署名を更新

### 変更内容
- `gas_backend.js`（self_register登録完了メール本文）と `welcome.html`（登録完了画面）の文言を変更
  - 変更前: 「初回アクセス時にPINの設定が必要です。」「— デジタル名刺チーム」
  - 変更後: 「初回アクセス時に6桁のPINの設定が必要です。」「— XYZ Digital Card プロジェクト」

### デプロイ
- commit: `ca89ffd`（push済み）
- welcome.html はGitHub Pagesに反映済み: https://furetomojapan.github.io/meishi/welcome.html

### 次の課題
- **GAS再デプロイ必須**: `gas_backend.js` のメール文面変更を反映するため、GASコンソールで「新バージョン」としてデプロイが必要
- commit: `405ad76`

---

## セッション 2026-06-10 (v5.0) — タグ機能 + publicId（ID秘匿）

### 完了タスク

| 機能 | 状態 |
|---|---|
| GAS: users シートに `tags` / `publicId` 列追加（initSheetsで自動マイグレーション） | ✅ |
| GAS: `save_tags` / `get_my_tags` / `get_users_by_tag`（PINセッション必須） | ✅ |
| GAS: `admin_get_tags` / `admin_save_tags`（adminPass必須） | ✅ |
| GAS: 既存・新規ユーザーに publicId（zz+数字9桁）発行 | ✅ |
| GAS: self_register のメールURLを publicId に変更 | ✅ |
| index.html: ユーザー編集パネルに「タグ」タブ追加（FREE 1 / PRO 5） | ✅ |
| index.html: タグ保存時プライバシー確認ダイアログ（初回のみ） | ✅ |
| index.html: 「同じタグの名刺」一覧（表示名 + 名刺リンク） | ✅ |
| index.html: `?id=` / `#` の publicId 解決（旧IDのURLも従来どおり動作） | ✅ |
| index.html: シェア・QR・OGPのURLを publicId に変更 | ✅ |
| 管理画面: タグタブ追加（最大5つ保存可、FREEは1つ目のみ有効の注記） | ✅ |
| APP_VERSION: v4.10 → v5.0 | ✅ |

### タグ機能の設計
- 正規化: NFKC → trim → 小文字 → 連続空白圧縮（GAS/フロント同一実装）、各20文字以内、重複除去
- 上限はGAS側でも検証（FREE 1 / PRO 5）。PRO→FREEダウングレード時はタグを保持し先頭1つのみ有効
- `get_all` には tags を**含めない**（列挙防止）。マッチは `get_users_by_tag`（要セッション + 本人がそのタグを保有）経由のみ
- tags は専用アクションでのみ更新 — `save_user_profile` / `admin_save_user` は tags 列に触れない（上書き事故防止）
- マッチ一覧の返却は `{displayName, publicId}` のみ

### 既知の制限
- `get_all` は引き続き内部ID（メール由来）をキーとして返すため、APIを直接見れば内部IDは判別可能（名刺URL・マッチ一覧からは秘匿済み）。完全秘匿はget_allのpublicIdキー化が必要（将来課題）
- FREEアカウントのタグ付け替えによる探索は完全には防げない（変更回数制限は初版見送り）

### 検証
- JSX: Babel transform OK / GAS: node --check OK
- 単体テスト: normalizeTag / sanitizeTags / activeTags / generatePublicId 全12項目 pass

### デプロイ
- GitHub Pages: push予定（このコミット）

### 次の課題（重要）
- **GAS再デプロイ必須**: タグ系アクション + publicId 反映のため「新バージョン」としてデプロイ（前回の self_register 分も未反映なら合わせて反映される）
- **`initSheets()` を1回手動実行**: tags / publicId 列の追加と既存ユーザーへの publicId 発行のため
- 実機での動作確認: タグ保存 → 別ユーザーで同タグ設定 → マッチ一覧表示
