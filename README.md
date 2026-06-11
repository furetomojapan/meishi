# XYZ Digital Card — デジタル名刺サイト

スマホで見せる・送れるデジタル名刺。GitHub Pages（静的フロント）+ Google Apps Script（API）+ Googleスプレッドシート（データ）で動作。

- 本番サイト: https://furetomojapan.github.io/meishi/
- 現行バージョン: フロント v5.10 / GAS v3.1

## 構成

```
index.html       … 本体（閲覧・編集・管理画面すべて含む単一ファイル / React + Babel standalone）
welcome.html     … メール自己登録ページ
gas_backend.js   … GAS用コード（Apps Scriptに貼り付けて使用。リポジトリはマスターコピー）
hai1〜10.png     … カード背景画像
image1_/image2_* … 旧デモ用名刺画像（フェーズ6で削除予定）
docs/            … セッションログ・計画書・スモークテスト・各種資料
```

## 認証の仕組み（概要）

- 利用者: 6桁PIN → セッショントークン（30日端末記憶）。5回失敗で15分ロック
- 管理者: パスワード（SHA-256ハッシュ保存・初期値は強制変更）
- 名刺URLは2種類: フルURL（`#zz…`）と、タグ仲間向け限定URL（`#zt…` 電話・住所はタグ用の値に差し替え）

## デプロイ手順

### フロント（GitHub Pages）
`main` に push するだけ（数分で反映）。

### GAS（バックエンド）
1. スプレッドシート → 拡張機能 → Apps Script
2. `gas_backend.js` の内容で全置き換え
3. **まずテスト用デプロイに反映**して docs/smoke_test.md を実施
4. 問題なければ「デプロイ → デプロイを管理 → 編集 → 新バージョン」で本番デプロイ
5. シート列が増わる変更のときは `initSheets()` を1回手動実行

### ロールバック
- フロント: `git revert` して push（基準点タグ: `v5.10-stable`）
- GAS: デプロイ管理から旧バージョンを選び直す
- データ: バックアップシート（meisi_backup_*）から復元

## 開発ルール

- 変更のたびに `docs/session_log.md` へ追記（履歴は消さない）
- デプロイ後は `docs/smoke_test.md` のチェックリストを実施
- リファクタリングは `docs/refactoring_plan.md` のフェーズ計画に従う
- 秘密情報（トークン・キー類）はリポジトリに置かない（`.gitignore` 参照）
