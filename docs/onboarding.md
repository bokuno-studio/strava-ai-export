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
3. 運動後にブクマ or アイコンから起動 → 「最新を取得」をタップ
   → 10〜20 秒で取得完了 → CSV ZIP ダウンロード → AI に投げる
4. まとめ分析したい時は「直近 7 日」「全期間」も選べる
```

ボタン構成:
- **「最新 1 件」**: 運動直後用の最速取得（1〜4 req）
- **「直近 7 日」**: 週末まとめ用
- **「全期間」**: 初回同期 / 特別な分析用

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
- 「最新 1 件」: 4req → **約 1〜2 秒**（page delay 込みで 5 秒以内）
- 「直近 7 日」: 平均 5 件として 20〜30 req → **10〜20 秒**
- 「全期間」: 200 本なら 800req（**ほぼ 1 日完走**）、500 本超は複数日またぐ → 再開機構が必須

### 採用方針

1. **オンデマンド取得**: ユーザーが PWA を開いてボタンを押した時だけ叩く
2. **Webhook 先回り取得は採用しない**: 全ユーザー分の取得をサーバが代行する形になり、アプリ全体の rate limit を高速に消費する
3. **`X-RateLimit-Usage` 監視**: 90% 超で UI に「混雑中、しばらく待ってください」表示
4. **サーバ側キュー**: アプリ全体の上限を超えそうなら一時的にリクエストを並ばせる
5. **スケール時の最終手段**: Strava との Partner 契約打診（大規模サービスで事例あり、ただし条件非公開）

スケール時の見通しは「数百ユーザー規模までは現方針で問題なし、それ以上は実測してから対処」。MVP では先回り最適化はしない。

---

## 6. アーキテクチャ

```
[Browser]                          [Vercel]                    [Strava]
 ┌──────────────┐                  ┌─────────────────┐          ┌────────┐
 │ Next.js UI   │ ──OAuth start──> │ /api/auth/start │ ───────> │ OAuth  │
 │              │ <──redirect──── │                 │ <──code── │        │
 │              │                  │ /api/auth/cb    │ ──token── │        │
 │              │ <──set cookie─── │ (token 暗号化   │           │        │
 │              │                  │  → DB に保存)   │           │        │
 │              │                  │                 │           │        │
 │ Sync Worker  │ ──fetch chunk──> │ /api/sync/next  │ ──API───> │ Data   │
 │ (Web Worker) │ <──activities── │ (token 復号→     │ <──json── │        │
 │ ↓            │                  │  Strava 中継)   │           │        │
 │ IndexedDB    │                  │                 │           │        │
 │ ↓            │                  │ ※ サーバ側は     │           │        │
 │ CSV/ZIP 生成 │                  │   token と進捗   │           │        │
 │ ↓ download   │                  │   のみ保持       │           │        │
 └──────────────┘                  └─────────────────┘          └────────┘
```

- **フロント**: Next.js + Tailwind（Vercel デプロイ）
- **OAuth**: Vercel API Route（`client_secret` はサーバ側のみ）
- **サーバ DB**: 暗号化 token / `athlete_id` / `last_synced_at` / `sync_cursor` のみ保持
  - 候補: Supabase or Vercel KV（最終確定は雛形作成時）
- **クライアント DB（IndexedDB）**: activities / streams / laps / zones の本体
- **同期ワーカー**: Web Worker でレート制限を見ながら逐次取得・再開可

「重いデータは手元、軽い進捗情報だけサーバ」のハイブリッド構成。プライバシーと再開性の両立を狙う。

---

## 7. CSV 出力

取得イベント（初回 / 増分）ごとに、その**差分だけ**を ZIP で吐く。

出力 ZIP の中身:

```
strava-ai-export-YYYYMMDD-HHmm.zip
├── activities.csv           # サマリ（差分の行のみ）
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

**CSV 数式インジェクション対策**: `=` `+` `-` `@` 先頭値を `'` でエスケープ。PapaParse の `escapeFormulae` を利用。

---

## 8. MVP スコープ（v1）

- [ ] Strava OAuth フロー（Vercel API Route）
- [ ] **英語 UI**（日本語版は作らない）
- [ ] `manifest.json` 設置（ホーム追加できる人向け、PWA は売り文句にしない）
- [ ] 「最新 1 件」ボタン（運動直後用・最速）
- [ ] 「直近 7 日」ボタン（まとめ用）
- [ ] 「全期間」ボタン（初回 / 再ダウンロード用、再開可）
- [ ] 取得イベントごとの差分 CSV / ZIP ダウンロード
- [ ] AI ごとのアップロード案内（ChatGPT=ZIP 直、Claude/Gemini=展開して CSV）
- [ ] スマホ UI（375px 対応・タップターゲット 44px）
- [ ] 進捗 UI（残り件数・経過時間・混雑時メッセージ）
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
3. **再開**: 「全期間」取得時は `last_synced_at` + 既取得 `activity_id` セットで重複取得を避ける
4. **アプリ全体 rate limit**: `X-RateLimit-Usage` ヘッダ監視で 90% 超 backoff。混雑時 UI 表示
5. **manifest.json**: アイコン・テーマカラー・`display: standalone` だけ設定（できる人がホーム追加した時に綺麗に出る程度）
6. **IndexedDB 容量**: ストリーム JSON は 1アクティビティ 0.5〜2MB → 500本で 1GB クラス。容量警告 UI が必要
7. **CSV 数式エスケープ**: `escapeFormulae` 必須
8. **CSP**: `next.config.ts` で初期設定（Strava OAuth リダイレクト先を `form-action` に許可）
9. **OG / sitemap / llms.txt / favicon**: リリース前に整備
10. **英語 UI**: 日本語版は作らない方針。文言・i18n キーは英語固定

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
4. サーバ DB 選定・スキーマ確定（Supabase or Vercel KV）
5. 同期ワーカー（Web Worker）の骨組み + アプリ全体 rate limit ガード
6. IndexedDB スキーマ + CSV 生成
7. UI（ログイン状態 / 3 ボタン / 進捗表示 / 混雑時メッセージ）
8. `manifest.json` 設置（ホーム追加できる人向け）
9. 定型整備（CSP・OG・sitemap・llms.txt・favicon・GA）

---

## 13. 長期ビジョン: AI 向け PHR ストレージ

strava-ai-export は最終的に **「ChatGPT / Claude / Gemini に渡す前提の個人 PHR（Personal Health Record）倉庫」** に拡張する構想。Strava はその最初のデータソース。

### 想定する追加データソース

- Garmin（→ garmin-ai-export の資産を統合）
- Apple Health / Google Fit（睡眠・体重・心拍）
- 食事ログ（手入力 or 外部連携）
- 主観メモ（疲労感・気分・症状）

### 設計方針

- **内部保持**: ソース別テーブル（Strava / Garmin / Apple Health / 食事 / 主観メモ 等を独立に持つ）
- **出力**: Apple Health 方式で「**ユーザーが設定した優先データソースのみ**」をデフォルトで CSV に書く
  - 例: Strava と Garmin が同じ運動を持っていても、優先=Garmin なら Garmin のデータだけ書く
  - **フル出力モード**で全ソースの内訳を見られる（仕様は v2 設計時に決定）
- **MVP 期の扱い**: Strava 1 個しか無いので優先ソース設定 UI は不要。CSV は素直に `activities.csv` を出す。`source` 列も MVP では入れない（PHR 化時に再設計）

### MVP で過剰設計しないこと

- IndexedDB のテーブル構造は「Strava 単体で必要なものだけ」で OK
- 後で `source` 列を足したり、別 store を増やしたりは破壊的でない変更で済む

### 形態の進化

- v1: 普通の Web（Strava のみ）
- v2: 普通の Web（複数データソース・優先ソース設定）
- vN: ネイティブアプリ化を検討（Web で需要が見えてから・端末センサーや通知が活きてくる段階で）
