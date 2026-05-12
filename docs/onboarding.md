# strava-ai-export オンボーディング

このドキュメントはプロジェクト着手時に1度読む資料。
**CLAUDE.md には書かない**（context 汚染防止）。

---

## 1. ゴール

Strava API から取れる全範囲のデータを抜き、
**ChatGPT / Gemini / Claude にそのまま食わせられる CSV バンドル** に変換する。

入力は当初「Strava のデータエクスポート ZIP」だったが、Strava API 方式に変更（2026-05-11）。
API のほうが ZIP より:

- FIT 解析不要（ストリームが JSON で返る）
- 増分同期が自然
- スマホ UX が「OAuth → ボタン」で完結

---

## 2. ターゲットユーザー

- **英語圏**のスマホユーザー（日本語版は作らない）
- 技術知識ゼロ前提
- **運動直後に AI で振り返りたい** ユースケースが本命

形態の選択（議論結果）:

- **普通の Web ページで MVP 提供**
- ネイティブアプリ・LINE Bot は採用しない:
  - LINE は英語圏で普及していない
  - WhatsApp Business は個人開発に重い（審査・課金）
  - Telegram/Discord はターゲットがニッチ
  - ネイティブアプリは英語圏スポーツ系の流通実態（Reddit/Twitter のリンク経済）に逆行・配信と更新の負荷が高い
- `manifest.json` は置いて **iOS Safari「ホーム画面に追加」をできる人向けに案内**するが、PWA を売り文句にはしない
- 取得はユーザー操作起点（**オンデマンド**）。Webhook で先回りする方式は採用しない（理由は §5 参照）

---

## 3. ユーザーフロー

```
1. Strava で OAuth 認可（初回のみ）
2. （任意）iOS Safari の「ホームに追加」でアイコン起動可
3. 運動後にブクマ or アイコンから起動 → ボタンをタップ
4. サーバが裏で Strava から取得（数秒〜数時間）
   - 短時間で終わる場合: そのまま画面で待つ → CSV ZIP DL
   - 長時間の場合: 閉じて OK → 完了通知（メール/プッシュ）→ 開いて CSV DL
5. AI（ChatGPT / Claude / Gemini）にアップロード
```

ボタン構成（3 つ）:
- **「今日」**: 今日 0:00 以降のアクティビティ
- **「過去 N 日」**: 数値入力フィールドで日数指定（例: 3, 7, 30）
- **「全件」**: 全期間

設計方針: **取得処理は常にサーバジョブ**で統一する。件数によってクライアント/サーバを分岐させない（分岐するとフローと UI が二重化して保守が苦しい）。短時間で終わるケースもサーバ往復で十分速い（体感 2〜5 秒）。

---

## 4. 取得するデータ（API エンドポイント）

| 種別 | エンドポイント | 重さ | 備考 |
|------|---------------|------|------|
| 一覧サマリ | `GET /athlete/activities` | 軽（200件/req） | 距離・時間・平均心拍など |
| 詳細 | `GET /activities/{id}` | 1req/件 | splits, description, segment efforts |
| ストリーム | `GET /activities/{id}/streams` | 1req/件 | 秒単位の HR/GPS/Power/Cadence 等 |
| ラップ | `GET /activities/{id}/laps` | 1req/件 | |
| HR ゾーン分布 | `GET /activities/{id}/zones` | 1req/件 | Easy/Tempo/Threshold 滞在時間 |
| プロフィール | `GET /athlete` | 1req | 名前・体重・FTP |
| 通算統計 | `GET /athlete/stats` | 1req | Ride/Run/Swim 別 |
| ゾーン定義 | `GET /athlete/zones` | 1req | 自分の HR/Power ゾーン設定値 |
| ギア | `GET /gear/{id}` | 1req/件 | 自転車・シューズの通算距離 |

**取れないもの**: 食事・睡眠・体重・DM・写真本体・フォロワー関係（API v3 で廃止）。

---

## 5. レート制限とスケール戦略

### 公式の制限（2026 年時点）

- **アプリ全体**（per-application, **per-user ではない**）:
  - Overall: 200 req / 15min、2000 req / 日
  - Non-upload: 100 req / 15min、1000 req / 日
- **Strava は 2020 年 11 月以降、原則レート制限増加を許可していない**（intervals.icu の事例他で確認）

### スケールのボトルネック

| ユーザー数 | 1日あたり req 推定 | 1000 req/日 を超えるか |
|----------|-----------------|-------------------|
| 〜100人 | 〜400 | OK |
| 250人 | 〜1000 | ギリギリ |
| 1000人 | 〜4000 | 大幅超過 |
| 10000人 | 〜40000 | 完全に詰む |

（1人あたり「最新 1 件」を 1 日 1 回 = 4req 想定）

### 個別アクティビティの所要時間

- 1 activity = 詳細 + ストリーム + ラップ + ゾーン = **4 req**
- **「今日」**: 0〜2 件 → 0〜8 req → **2〜5 秒**（サーバ往復込み）
- **「過去 7 日」**: 平均 5 件として 20〜30 req → **10〜20 秒**
- **「全件」**: 200 本なら 800req（**ほぼ 1 日完走**）、500 本超は複数日またぐ → 通知 + 再開機構が必須

### 採用方針

1. **取得はサーバジョブで統一**: ボタン種別に関わらず、クライアントは「依頼 → 結果受け取り」のみ。スマホを閉じても処理が続く
2. **オンデマンド起動**: ユーザーがボタンを押した時だけジョブを開始（自動ポーリング・先回り取得はしない）
3. **Webhook 先回り取得は採用しない**: アプリ全体の rate limit を高速に消費する
4. **`X-RateLimit-Usage` 監視**: 90% 超で UI に「混雑中、しばらく待ってください」表示
5. **サーバ側キュー**: アプリ全体の上限を超えそうなら一時的にリクエストを並ばせる
6. **完了通知**: 短時間で終わるジョブは画面で待たせる。長時間ジョブはメール or プッシュ通知で完了を知らせる
7. **スケール時の最終手段**: Strava との Partner 契約打診（大規模サービスで事例あり、ただし条件非公開）

スケール時の見通しは「数百ユーザー規模までは現方針で問題なし、それ以上は実測してから対処」。MVP では先回り最適化はしない。

---

## 6. アーキテクチャ

```
[Browser]                          [Vercel + DB]                  [Strava]
 ┌──────────────┐                  ┌─────────────────────┐         ┌────────┐
 │ Next.js UI   │ ──OAuth start──> │ /api/auth/start     │ ──────> │ OAuth  │
 │              │ <──redirect──── │                     │ <──code─ │        │
 │              │                  │ /api/auth/callback  │ ──token─ │        │
 │              │ <──set cookie─── │ (token 暗号化保存)   │          │        │
 │              │                  │                     │          │        │
 │ ボタン押下   │ ──POST /jobs──> │ /api/jobs/sync       │          │        │
 │              │                  │ (job 登録・即時応答) │          │        │
 │              │                  │      ↓               │          │        │
 │              │                  │ Background Worker    │ ─API──> │ Data   │
 │              │                  │ (Vercel Background   │ <─json─ │        │
 │              │                  │  Functions / Cron)   │          │        │
 │              │                  │      ↓               │          │        │
 │              │                  │ サーバ DB に格納      │          │        │
 │              │ <──progress──── │ (activities / streams│          │        │
 │              │   (SSE/poll)     │  / laps / zones)     │          │        │
 │              │                  │      ↓               │          │        │
 │              │                  │ 完了通知（メール / WebPush）     │        │
 │              │ <──CSV ZIP──── │ /api/download/{job}  │          │        │
 │              │  (DL)            │ (CSV 生成→ ZIP →返却)│          │        │
 └──────────────┘                  └─────────────────────┘         └────────┘
```

- **フロント**: Next.js + Tailwind（Vercel デプロイ）。クライアントは UI と DL ボタンのみ
- **OAuth**: Vercel API Route（`client_secret` はサーバ側のみ）
- **サーバ DB**: token（暗号化）・athlete profile・activities・laps・zones・gear と、ジョブ状態（pending / running / done / failed）・最終同期時刻
  - 候補: Supabase（Postgres + Storage）or Vercel Postgres + R2
  - ストリームは行数が多い → Supabase Storage / R2 にファイルとして保存するのが現実的（テーブルに突っ込むと PostgreSQL の効率が悪い）
- **Background Worker**: ジョブを順次処理。アプリ全体 rate limit を見て backoff。完了でフラグ更新・通知送信
- **進捗通知**: 短時間ジョブはクライアントが SSE or ポーリングで progress を取る。長時間ジョブはメール or WebPush で完了通知

設計方針:
- **クライアントに永続データを置かない**（IndexedDB は使わない）。データの一義的な保管庫はサーバ DB のみ
- 「複数デバイスから同じ自分のデータが見える」「スマホ閉じて OK」「PHR 化（多データソース統合）と相性が良い」が目的
- プライバシーは「暗号化保存 + RLS で他人のデータを引けない + 退会時完全削除」で担保

---

## 7. CSV 出力

ジョブ完了時に、**そのジョブで取得した範囲分**の ZIP を生成して DL させる。

出力 ZIP の中身:

```
strava-ai-export-YYYYMMDD-HHmm.zip
├── activities.csv           # サマリ（範囲の行のみ）
├── laps.csv
├── zones.csv
├── streams/
│   └── <activity_id>.csv   # 1アクティビティ1ファイル
├── gear.csv
├── athlete_profile.json
├── athlete_stats.json
├── athlete_zones.json
└── prompt_template.txt     # AI 用プロンプト雛形
```

- **CSV 数式インジェクション対策**: `=` `+` `-` `@` 先頭値を `'` でエスケープ。PapaParse の `escapeFormulae` を利用。
- **生成タイミング**: ジョブ完了時にサーバが ZIP を作って一時保管 → 当該ユーザーが DL するか TTL（例: 24h）で削除
- **再 DL**: ジョブ ID + 認可済みユーザー一致で何度でも DL 可。期限切れ後は再ジョブで生成し直し

---

## 8. MVP スコープ（v1）

- [ ] Strava OAuth フロー（Vercel API Route）
- [ ] **英語 UI**（日本語版は作らない）
- [ ] `manifest.json` 設置（ホーム追加できる人向け、PWA は売り文句にしない）
- [ ] サーバ DB スキーマ（activities / streams / laps / zones / gear / athlete / jobs）
- [ ] **Background Worker**（ジョブを順次実行、アプリ全体 rate limit を尊重）
- [ ] ボタン UI 3 種
  - [ ] 「今日」（0:00 以降）
  - [ ] 「過去 N 日」（数値入力フィールド）
  - [ ] 「全件」（長時間ジョブ・再開可）
- [ ] 進捗 UI（残り件数・経過時間・混雑時メッセージ）
- [ ] 完了通知（短時間: 画面で待つ / 長時間: メール or WebPush）
- [ ] CSV / ZIP 生成 + DL リンク（TTL 24h）
- [ ] AI ごとのアップロード案内（ChatGPT=ZIP 直、Claude/Gemini=展開して CSV）
- [ ] スマホ UI（375px 対応・タップターゲット 44px）
- [ ] CSP・セキュリティヘッダ・OG・sitemap・llms.txt・favicon

## v2 以降（スコープ外）

- セグメント / ルート / 写真メタ
- ストリームのブラウザ内可視化
- 複数アカウント切替
- ネイティブアプリ化（Web で需要が見えてから判断）
- **PHR 化**（§13 参照）

---

## 9. 関連プロジェクトとの差別化

- **training-coach-bot**: 同 Strava 認可だが「最新サマリのみを LINE 内で AI コーチ」。本プロダクトは「全期間フル × ストリーム込み」で目的が違う。
- **garmin-ai-export**: ZIP 入力・クライアント完結。データソースと UX 思想が違う（こちらは API + ハイブリッド）。
- API クライアントの実装は training-coach-bot の `apps/sync-server/src/strava/client.ts` を参考にできる（refresh token 自動更新・ページング）。

---

## 10. 注意点（実装着手時に思い出すこと）

1. **token の保護**: AES-256-GCM 等で暗号化して DB に保存（training-coach-bot と同方式）
2. **token の期限**: access_token は 6 時間 → refresh_token で自動更新
3. **ジョブの冪等性**: 「全件」ジョブが中断 → 再開時は `last_synced_at` + 既取得 `activity_id` セットで重複取得を避ける
4. **アプリ全体 rate limit**: `X-RateLimit-Usage` ヘッダ監視で 90% 超 backoff。混雑時 UI 表示
5. **Background Worker の実装手段**: Vercel Functions（Hobby は 60s, Pro は 300s）か、別途 Worker（Railway, Fly.io, Cloudflare Workers）か。長時間ジョブを Vercel 単独でこなすには工夫が必要 → 詳細は実装着手時に再検討
6. **ストリーム保管**: Postgres の行に突っ込むより Storage / R2 にファイルとして置く方が現実的
7. **CSV 数式エスケープ**: `escapeFormulae` 必須
8. **manifest.json**: アイコン・テーマカラー・`display: standalone` だけ設定
9. **CSP**: `next.config.ts` で初期設定（Strava OAuth リダイレクト先を `form-action` に許可）
10. **OG / sitemap / llms.txt / favicon**: リリース前に整備
11. **英語 UI**: 日本語版は作らない方針。文言・i18n キーは英語固定
12. **退会フロー**: ユーザーが連携解除 → サーバ DB から該当 athlete の全データを完全削除

---

## 11. リポジトリ運用

`~/.claude/CLAUDE.md` のワークフロー定義に従う:

- Issue 起票 → `triage`
- ユーザー承認 → `ready`
- 「#XX 実装して」で着手 → `in-progress`
- マージ・デプロイ完了 → `done` + クローズ

---

## 12. やること（着手手順の目安）

1. Strava の OAuth アプリ登録（client_id / client_secret 取得）
2. Next.js + Tailwind の雛形作成（garmin-ai-export を参考、英語 UI）
3. OAuth フロー（`/api/auth/start` + `/api/auth/callback`）
4. サーバ DB 選定（Supabase / Vercel Postgres + R2 / 他）+ スキーマ確定
5. ジョブ管理テーブル（pending / running / done / failed・進捗 % ・取得範囲）
6. Background Worker 実装（Vercel Background Functions or 外部 Worker）+ アプリ全体 rate limit ガード
7. CSV / ZIP 生成 + DL リンク（TTL 付き）
8. UI（ログイン状態 / 3 ボタン / 進捗 SSE or ポーリング / 混雑時メッセージ）
9. 完了通知（メール or WebPush、短時間ジョブはスキップ可）
10. `manifest.json` 設置（ホーム追加できる人向け）
11. 定型整備（CSP・OG・sitemap・llms.txt・favicon・GA）
12. 退会フロー（連携解除 + データ完全削除）

---

## 13. 長期ビジョン: AI 向け PHR ストレージ

strava-ai-export は最終的に **「ChatGPT / Claude / Gemini に渡す前提の個人 PHR（Personal Health Record）倉庫」** に拡張する構想。Strava はその最初のデータソース。

### 想定する追加データソース

- Garmin（→ garmin-ai-export の資産を統合）
- Apple Health / Google Fit（睡眠・体重・心拍）
- 食事ログ（手入力 or 外部連携）
- 主観メモ（疲労感・気分・症状）

### 設計方針

- **内部保持**: ソース別テーブル（Strava / Garmin / Apple Health / 食事 / 主観メモ 等を独立にサーバ DB で持つ）
- **出力**: Apple Health 方式で「**ユーザーが設定した優先データソースのみ**」をデフォルトで CSV に書く
  - 例: Strava と Garmin が同じ運動を持っていても、優先=Garmin なら Garmin のデータだけ書く
  - **フル出力モード**で全ソースの内訳を見られる（仕様は v2 設計時に決定）
- **MVP 期の扱い**: Strava 1 個しか無いので優先ソース設定 UI は不要。CSV は素直に `activities.csv` を出す。`source` 列も MVP では入れない（PHR 化時に再設計）

### MVP で過剰設計しないこと

- サーバ DB のテーブル構造は「Strava 単体で必要なものだけ」で OK
- 後で `source` 列を足したり、別テーブルを増やしたりは破壊的でない変更で済む

### 形態の進化

- v1: Web（Strava のみ・サーバ DB）
- v2: Web（複数データソース・優先ソース設定・フル出力モード）
- vN: ネイティブアプリ化を検討（Web で需要が見えてから・端末センサー連携や通知が活きてくる段階で）
