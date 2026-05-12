# QA シナリオ

`docs/onboarding.md` の MVP スコープから派生した QA シナリオ集。
実装が進むごとに更新する。

入力方式: Strava API（ZIP 入力は廃止）。UI は英語のみ。
取得処理は**常にサーバジョブ**で実行する（クライアント直叩きは行わない）。

---

## シナリオ: トップページ表示（未認可）

- 前提: 初回訪問・未ログイン
- 操作: アプリ URL（例: `http://localhost:3000`）にアクセス
- 期待結果:
  - 200 OK で HTML が返る
  - サービス概要が一目で分かる（Strava → AI 用 CSV）
  - 「Connect with Strava」ボタンが見える
  - スマホ幅（375px）で崩れない

---

## シナリオ: OAuth 認可（ハッピーパス）

- 前提: Strava アカウントを持ち、ログイン済み
- 操作:
  1. トップで「Connect with Strava」をタップ
  2. Strava の認可画面で許可
  3. アプリに戻る
- 期待結果:
  - Strava の認可ページにリダイレクトされる
  - 戻り先で 3 ボタン（Today / Past N days / All）が出る
  - サーバ DB に暗号化 token と athlete_id が保存される

---

## シナリオ: OAuth 拒否

- 前提: OAuth 認可画面まで遷移済み
- 操作: 「Cancel」を選ぶ
- 期待結果:
  - アプリに戻って「Connection cancelled」表示
  - 再試行ボタンが見える
  - サーバ DB に中途半端なレコードが残らない

---

## シナリオ: 「Today」ジョブ（短時間・主要ハッピーパス）

- 前提: OAuth 済み・今日のアクティビティが 1〜2 件 Strava 側にある
- 操作: 「Today」をタップ
- 期待結果:
  - サーバが即座にジョブを登録（POST /api/jobs/sync）
  - 画面に進捗インジケータが出る（数秒〜10 秒以内に完了）
  - 完了後「Download」ボタンが出る → CSV ZIP が落ちる
  - ZIP に当日分の `activities.csv` 等が含まれる

---

## シナリオ: 「Past N days」ジョブ

- 前提: OAuth 済み・直近 N 日にアクティビティが複数ある
- 操作: 入力フィールドに「7」と入力 → 「Past N days」タップ
- 期待結果:
  - 過去 7 日分のアクティビティを取得
  - 約 10〜20 秒で完了
  - 「Download」ボタンが出て、その範囲の CSV ZIP が落ちる

---

## シナリオ: 「All」ジョブ（長時間・初回）

- 前提: OAuth 済み・データ取得未実施
- 操作: 「All」をタップ
- 期待結果:
  - サーバジョブが登録される（即時応答）
  - 進捗 UI に「Running… N / M activities」表示
  - 取得は Background Worker で実行され、画面を閉じても進む
  - 長時間（数分〜数時間）かかる場合、メール or WebPush で完了通知
  - サーバ DB に全アクティビティが格納される
  - 完了後「Download」ボタンで全件 ZIP DL

---

## シナリオ: 「All」ジョブ中にタブを閉じる → 後で再訪

- 前提: 「All」ジョブ実行中（途中）
- 操作: タブを閉じる → 後で同じブラウザ or 別デバイスで再訪
- 期待結果:
  - サーバ側でジョブが継続中なら、UI に進捗が表示される
  - 既に完了していれば「Download」ボタンが見える
  - クライアントを閉じても処理が止まらないこと

---

## シナリオ: アプリ全体レート制限ヒット（混雑時）

- 前提: 他ユーザーのジョブでアプリ全体の `100 req / 15min` が逼迫
- 操作: ユーザーがボタンタップ
- 期待結果:
  - `X-RateLimit-Usage` 監視でサーバが backoff
  - UI に「Strava is busy, your job is queued」表示
  - 制限解除後にジョブが自動進行
  - クライアント側は永遠に待たされない（タイムアウト + ガイダンス）

---

## シナリオ: 完了通知（長時間ジョブ）

- 前提: 「All」ジョブが裏で完了
- 操作: ユーザーが事前にメール / WebPush 通知を許可していた
- 期待結果:
  - 「Your Strava export is ready」というメール or プッシュ通知が届く
  - リンクから直接 DL 画面に飛べる
  - 通知拒否の場合は、ユーザーが次回ログイン時に「Ready」表示

---

## シナリオ: CSV ZIP の中身検証

- 前提: ジョブ完了直後
- 操作: 「Download」ボタンをタップ
- 期待結果:
  - `strava-ai-export-YYYYMMDD-HHmm.zip` 形式で保存される
  - 中身に少なくとも以下が含まれる:
    - `activities.csv`（範囲の行）
    - `laps.csv`
    - `zones.csv`
    - `streams/<activity_id>.csv`
    - `gear.csv`
    - `athlete_profile.json`
    - `athlete_stats.json`
    - `athlete_zones.json`
    - `prompt_template.txt`
  - CSV の値が `=` `+` `-` `@` で始まる場合に `'` でエスケープされている
  - DL リンクには TTL（24h）がある

---

## シナリオ: AI ごとのアップロード方法ガイド

- 前提: ダウンロード完了画面
- 操作: 画面を確認
- 期待結果:
  - ChatGPT / Claude / Gemini の各アップロード案内が表示される
  - ChatGPT は ZIP 直、Claude/Gemini は展開して CSV を投げる旨が区別されている

---

## シナリオ: 異常系 - token 失効

- 前提: 何らかの理由で refresh token も無効化されている
- 操作: ボタンタップ
- 期待結果:
  - 「Reconnect required」表示
  - 「Connect with Strava」ボタンで OAuth に戻れる
  - 既存のサーバ DB データは消えない

---

## シナリオ: 異常系 - Strava 障害

- 前提: Strava API が 5xx を返す状態
- 操作: ジョブ実行
- 期待結果:
  - Background Worker が指数バックオフでリトライ
  - 最大リトライ後も失敗なら、ジョブステータスを `failed` にして UI に「Strava is down, try later」表示
  - 既取得分は保持・再開可

---

## シナリオ: 退会フロー

- 前提: 連携済みユーザー
- 操作: 「Disconnect & delete data」をタップ
- 期待結果:
  - サーバ DB から当該 athlete の token / activities / streams / 全データが完全削除される
  - Strava 側の連携アプリ一覧からも本アプリが解除される（or 解除手順を案内）
  - 削除後にトップページへ戻る

---

## シナリオ: モバイル UI（375px）

- 前提: iPhone SE 相当のビューポート
- 操作: OAuth → ジョブ実行 → ダウンロードまで通す
- 期待結果:
  - すべてのタップターゲットが 44px 以上
  - 横スクロールが発生しない
  - フォントが極小にならない

---

## シナリオ: セキュリティヘッダ

- 前提: 本番デプロイ済み環境
- 操作: `curl -I https://<URL>` でヘッダ確認
- 期待結果:
  - `Content-Security-Policy` / `X-Content-Type-Options` / `Referrer-Policy` が設定されている
  - Strava OAuth リダイレクト先のドメインが CSP の `form-action` 等で許可されている
  - `next.config.ts` の設定が反映されている

---

## シナリオ: token の保管

- 前提: 任意の連携済みアカウント
- 操作: サーバ DB の token カラムを直接確認
- 期待結果:
  - 平文で保存されていない（AES-256-GCM 等で暗号化）
  - 暗号化鍵は環境変数で管理されている
  - athlete_id 以外で他人の token を引けない（RLS or 等価制御）

---

## シナリオ: ホーム画面追加（任意・できる人向け）

- 前提: `manifest.json` 設置済み・本番デプロイ済み
- 操作:
  - iOS Safari: 共有 → 「Add to Home Screen」
  - Android Chrome: メニュー → 「Add to Home screen」
- 期待結果:
  - アイコン・アプリ名が `manifest.json` の設定通り（英語）
  - アイコンタップで `display: standalone` で起動（アドレスバーなし）
  - OAuth 状態が保持されている
- 注意: この操作は MVP の必須フローではない。**追加できない・しないユーザーも普通の Web として完全に使える**ことが本シナリオより優先

---

## シナリオ: favicon / OG / sitemap / llms.txt

- 前提: 本番デプロイ済み環境
- 操作:
  - `/favicon.ico` を直接取得
  - OGP デバッガで OG 画像を確認
  - `/sitemap.xml` と `/llms.txt` を取得
- 期待結果: いずれも 200 OK で内容が妥当
