# XYZ Digital Card — デジタル名刺サイト

スマホで見せる・送れるデジタル名刺。GitHub Pages（静的フロント）+ Google Apps Script（API）+ Googleスプレッドシート（データ）で動作。

- 本番サイト: https://furetomojapan.github.io/meishi/
- 現行バージョン: フロント v5.13 / GAS v4.0

## 構成（フェーズ4: Viteビルド）

```
index.html        … Viteエントリ（OGPメタ・フォント・Tailwind CDN・スタイル）
welcome.html      … メール自己登録ページ（Viteのマルチページとしてビルド）
src/
  main.jsx        … 起動（createRoot）
  App.jsx         … アプリ本体（閲覧・編集・管理画面）
  lib/core.jsx    … 定数・正規化・ヘルパー・SNS定義
  components/     … misc(QR/シェア/フリーカード) pickers(各種ピッカー) flipcard forms(共通フォーム)
public/           … カード背景 hai1〜10.png、旧デモ画像 image1_/image2_*（フェーズ6で整理予定）
gas_backend.js    … GAS用コード（Apps Scriptに貼り付けて使用。リポジトリはマスターコピー）
legacy/           … 旧単一ファイル版（v5.10）の保全コピー
.github/workflows/deploy.yml … mainへのpushで自動ビルド→Pages公開
docs/             … セッションログ・計画書・スモークテスト・各種資料
```

## 開発コマンド

```
npm install      # 初回のみ
npm run dev      # ローカル開発サーバー
npm run build    # 本番ビルド（dist/）
```

## 認証の仕組み（概要）

- 利用者: 6桁PIN → セッショントークン（30日端末記憶）。5回失敗で15分ロック
- 管理者: パスワード（SHA-256ハッシュ保存・初期値は強制変更）
- 名刺URLは2種類: フルURL（`#zz…`）と、タグ仲間向け限定URL（`#zt…` 電話・住所はタグ用の値に差し替え）

## デプロイ手順

### フロント（GitHub Pages）
`main` に push すると GitHub Actions が自動でビルドして公開（数分で反映）。
Pages の Source は「GitHub Actions」（リポジトリ Settings → Pages）。

### GAS（バックエンド）
1. スプレッドシート → 拡張機能 → Apps Script
2. `gas_backend.js` の内容で全置き換え
3. **まずテスト用デプロイに反映**して docs/smoke_test.md を実施
4. 問題なければ「デプロイ → デプロイを管理 → 編集 → 新バージョン」で本番デプロイ
5. シート列が増える変更のときは `initSheets()` を1回手動実行
6. **反映確認**: ブラウザで `本番URL?action=version` を開き、バージョン番号が一致するか確認（複数デプロイがある場合、更新対象を間違えやすいため必須）

### ロールバック
- フロント: `git revert` して push（基準点タグ: `v5.10-stable`）
- GAS: デプロイ管理から旧バージョンを選び直す
- データ: バックアップシート（meisi_backup_*）から復元

## 開発ルール

- 変更のたびに `docs/session_log.md` へ追記（履歴は消さない）
- デプロイ後は `docs/smoke_test.md` のチェックリストを実施
- リファクタリングは `docs/refactoring_plan.md` のフェーズ計画に従う
- 秘密情報（トークン・キー類）はリポジトリに置かない（`.gitignore` 参照）
