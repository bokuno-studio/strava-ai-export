# strava-ai-export オンボーディング

このドキュメントはプロジェクト着手時に1度読む資料。
**CLAUDE.md には書かない**（context 汚染防止）。

---

## 1. ゴール

Strava の「データのバルクエクスポート」で配信される ZIP を、
**ChatGPT / Gemini / Claude にそのまま食わせられる CSV バンドル** に変換する。

姉妹プロダクト: [garmin-ai-export](https://github.com/bokuno-studio/garmin-ai-export) と同じ UX 思想。

---

## 2. ターゲットユーザー

- スマホユーザー
- 技術知識ゼロ前提
- **1手間で済む** UX が必須（アップロード → ダウンロード）

---

## 3. ユーザーフロー

```
1. Strava からデータエクスポートを依頼（メール添付の ZIP リンクが届く）
2. ZIP を本アプリにアップロード（1タップ）
3. 変換済み ZIP をダウンロード（1タップ）
4. ChatGPT に ZIP のままアップロード（または Claude/Gemini 用に展開して CSV を投げる）
```

---

## 4. Strava データエクスポートの構造（参考）

Strava の「Account → Download or Delete Your Account → Download Request」で取得できる ZIP の中身（実物確認前なので暫定）:

```
export_<athlete_id>/
  activities.csv               # 全アクティビティ一覧（中心データ）
  activities/
    <activity_id>.gpx          # ルート (XML)
    <activity_id>.fit.gz       # 詳細センサーデータ (binary, gzip)
    <activity_id>.tcx.gz       # 古い形式 (XML, gzip)
  media/<activity_id>/         # 写真
  routes/                      # 保存済みルート
  bikes.csv / shoes.csv        # ギア
  comments.csv / kudos.csv     # 社交シグナル
  followers.csv / following.csv
  messages/                    # DM
  profile.csv                  # プロフィール
  goals.csv
```

**注意点**:
- 個別アクティビティファイルは `.fit.gz` / `.gpx.gz` / `.tcx.gz` と **gzip 圧縮**されているケースが多い
- 元アップロード形式に依存（FIT/GPX/TCX が混在しうる）
- `activities.csv` の列は近年フォーマット変更があった（旧形式と新形式が混在する可能性）

→ **実エクスポート ZIP を入手して構造を確定するのが MVP の最優先タスク**

---

## 5. MVP スコープ（v1 候補）

- [ ] `activities.csv` を読み込んでクリーン化（不要列の除去・命名統一）
- [ ] `activities/*.fit.gz` から心拍・ペース・ラップを抽出 → `laps.csv`
- [ ] `bikes.csv` / `shoes.csv` をそのまま同梱（ギア解析用）
- [ ] AI 用プロンプトテンプレート（`prompt_template.txt`）同梱
- [ ] ブラウザ完結で変換・ダウンロード
- [ ] スマホで操作しやすい英語 UI
- [ ] AI ごとのアップロード方法ガイド（ChatGPT=ZIPそのまま / Claude・Gemini=展開して CSV）

## v2 以降（スコープ外）

- GPX からの位置情報・標高プロファイル抽出
- 写真・DM の取り扱い
- 多言語対応
- 複数ユーザー対応

---

## 6. garmin-ai-export からの学び

姉妹プロダクトで以下のような知見がある（移植可能）:

1. **ファイル名の正規表現マッチング**でディレクトリ構造のブレを吸収（パス決め打ち禁止）
2. **CSV 数式エスケープ** (`=` `+` `-` `@` で始まる値の頭に `'`) は必須 → PapaParse の `escapeFormulae` を活用
3. **数百MB ZIP** は Web Worker で処理しないと UI フリーズ
4. **Square 決済**を入れる場合は本サイト Origin チェック + intent body スキーマ + レート制限を最初から
5. **CSP / セキュリティヘッダ** は `next.config.ts` で最初から設定
6. **OG画像・sitemap・llms.txt** は MVP リリース前に揃える
7. **「Upload to ChatGPT, Gemini, or Claude」と一括で書くのは罠** — ZIP 直接対応は ChatGPT のみ
8. **favicon.ico は手で置く** — Next App Router の `/icon` だけでは bot/legacy 対応が漏れる

---

## 7. やること（着手手順の目安）

1. 実 Strava エクスポート ZIP を1個入手して `docs/sample/` に置く（コミットはしない）
2. ZIP の中身を確認して `onboarding.md` の構造記述を確定
3. Next.js + Tailwind + JSZip でアプリ雛形（garmin-ai-export を参考にコピー）
4. `activities.csv` の整形ロジックを実装
5. FIT/GPX パースの優先順位を決定
6. AI 用プロンプトテンプレート作成
7. デプロイ・GA・OG など定型整備

---

## 8. リポジトリ運用

`~/.claude/CLAUDE.md` のワークフロー定義に従う:

- Issue 起票 → `triage`
- ユーザー承認 → `ready`
- 「#XX 実装して」で着手 → `in-progress`
- マージ・デプロイ完了 → `done` + クローズ
