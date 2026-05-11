# strava-ai-export

Strava のデータエクスポート ZIP を、ChatGPT / Gemini / Claude などの AI が読める CSV に変換するブラウザ完結 Web アプリ。

## 方針

- **クライアントサイド処理**（数百MB級のデータをサーバに送らない・プライバシー優位）
- **1タップ完結**（スマホユーザー・非エンジニアが対象）
- **静的ホスティング**（Vercel / GitHub Pages 等）

## 技術スタック（予定）

Next.js / Tailwind CSS / JSZip / PapaParse / FileSaver.js
GPX/FIT/TCX パーサは MVP 範囲に応じて追加判断

## 詳細

データ構造・MVP スコープ・参考情報は `docs/onboarding.md` を参照。
