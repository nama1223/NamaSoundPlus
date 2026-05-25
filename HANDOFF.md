# NamaSound+ 引き継ぎドキュメント

---

## ローカルファイル構成

```
C:\Users\nama1\Desktop\出力ファイル\FFFTP\SoundPlus\
├── index.html            # アプリ本体（タブシェル・設定パネル・全JS）
├── manifest.json         # PWAインストール用マニフェスト
├── sw.js                 # Service Worker（自スコープのみキャッシュ）
├── NamaSoundPlus192.png
├── NamaSoundPlus512.png
├── NamaSoundPlus1024.png
└── HANDOFF.md            # このファイル
```

---

## アップロード先・リポジトリ情報

| 項目 | 内容 |
|---|---|
| GitHub リポジトリ | https://github.com/nama1223/NamaSoundPlus |
| 公開URL | https://nama1223.github.io/NamaSoundPlus/ |
| ブランチ | `main` |
| 配信方法 | GitHub Pages（Settings → Pages → Source: main / root） |
| デプロイ | `git push` するだけで自動反映（CDN反映まで数分〜十数分かかることがある） |

### 修正時の手順

```bash
# 1. ファイルを編集
# 2. コミット＆プッシュ
git add -A
git commit -m "変更内容"
git push
```

> **注意**: GitHub 上でファイルを直接更新した場合、次の `push` 前に必ず `git pull` でローカルに取り込むこと（しないと push が rejected される）。

> **キャッシュ更新**: PWA にキャッシュが残っている場合は設定画面の「強制リロード」ボタンで更新。

---

## 利用している外部サービス・接続方法

### 子アプリ 3本（iframe 埋め込み）

| 識別子 | アプリ名（日本語 / English） | URL |
|---|---|---|
| `meto` | NamaMeto / NamaMetro | https://nama1223.github.io/NamaMeto/NamaMeto.html |
| `chu` | NamaChu / NamaTune | https://nama1223.github.io/Namachu/ |
| `ham` | NamaHam / NamaHarmony | https://nama1223.github.io/NamaHam/ |

- すべて **同一オリジン**（`nama1223.github.io`）のため、postMessage・contentDocument・getComputedStyle を制限なく使用可能
- 各 iframe に `allow="microphone; autoplay; clipboard-read; clipboard-write"` を付与

### 子アプリへの postMessage

```js
const CHILD_ORIGIN = 'https://nama1223.github.io';

// 親 → 子 に送るメッセージ
{ type: 'setLanguage', lang: 'ja' | 'en' }
{ type: 'setWakeLock', enabled: true | false }
{ type: 'pauseAll' }          // タブ切替時に再生中の音を停止

// 子 → 親 に送るメッセージ
{ type: 'childReady', app: pathname }   // 子アプリロード完了通知
```

子アプリ側にはすべてのハンドラ実装済み。

### Amazon 欲しいものリスト

設定パネル内にバナーリンクのみ設置（API利用なし）。  
URL: `https://www.amazon.jp/hz/wishlist/ls/21PS61YG1P32B`  
バナー: Amazon CDN のスプライト画像を `background-position` で切り出して表示。

---

## アプリ固有の特徴・修正時の注意点

### Service Worker の設計方針

- `index.html` は **意図的に pre-cache していない**
  - 理由: GitHub Pages CDN の遅延中に SW がインストールされると古い版が焼き付くため
  - 実用上の問題なし: fetch ハンドラのネットワークファーストで初回アクセス時に自動キャッシュされる
- アイコン・manifest のみ install 時に pre-cache
- 子アプリの SW には一切干渉しない（スコープが別のため自動分離）

### iframe スケール処理

NamaMeto と NamaChu は `<meta name="viewport" content="width=450">` の**固定幅設計**。  
iframe 内では viewport meta が無視されるため、JS で `transform: scale()` を適用して単独起動時と同じ見た目を再現している。

```
effectiveScale = min(realW / designW, state.appScale)
```

- `realW / designW` = 横幅ピッタリになるスケール（スマホでは縮小、タブレットでは 1.0 以上になることもある）
- `state.appScale` = ユーザーのスライダー設定（0.5〜2.0、デフォルト 1.0）
- 上限を `realW / designW` にキャップすることでコンテンツの横はみ出しを防止
- 余白は左右均等センタリング（`translateX(offsetX)` で調整）
- **NamaHam は `width=device-width` 設計のため、この処理をスルー**（スケール変換なし）

### テーマ背景色の同期

子アプリのテーマ変更を検知して iframe 周囲の余白色をリアルタイムで一致させる。  
**MutationObserver（即時）+ 1.5 秒ポーリング（取りこぼし補完）** の二刀流。

| アプリ | テーマ管理要素 | 属性 | テーマ名一覧 |
|---|---|---|---|
| NamaMeto | `document.body` | `data-theme` | beige / dark / light / darkred / navy / green |
| NamaChu | `document.documentElement` | `data-theme` | default / dark / light / darkred / navy |
| NamaHam | — | — | `getComputedStyle` フォールバック（動作確認済み） |

カラーマッピングは `index.html` 内の `THEME_BG` オブジェクトに定義。

### 遅延ロード

初期表示は NamaMeto のみロード済み。NamaChu・NamaHam は該当タブを初めて開いたタイミングで `data-src → src` に書き換えてロード開始（初回起動を軽くするため）。

### デッドゾーンスクロール転送

タブレット等でスケール後に左右に余白が生じる場合、その余白部分のタッチ操作を iframe 内スクロールに転送する仕組みを実装済み。  
`e.target === wrap`（iframe 外の余白）のタッチのみを検知して `contentWindow.scrollBy()` を呼ぶ。

---

## localStorage キー一覧

| キー | 型 | デフォルト | 内容 |
|---|---|---|---|
| `nsp_lang` | string | 端末言語に従う | `'ja'` または `'en'` |
| `nsp_wakelock` | string | `'false'` | スリープ防止のON/OFF |
| `nsp_silence_on_switch` | string | `'true'` | タブ切替時に音を止めるかどうか |
| `nsp_last_tab` | string | `'meto'` | 最後に開いていたタブ |
| `nsp_app_scale` | string | `'1'` | 表示サイズスライダーの値（0.5〜2.0） |

---

## i18n（多言語対応）

`index.html` 内の `I18N` オブジェクトに日英テキストを定義。  
HTML 側は `data-i18n="キー名"` を付けた要素に対して `applyI18n()` が一括でテキストを書き換える。  
コピーボタンのみ `data-i18n` 非使用（一時的な「コピー済み」表示のため `applyI18n()` 内で別途処理）。

---

## 設定パネルの機能一覧

| 機能 | 内容 |
|---|---|
| 言語切替 | 日本語 / English を一括切替。子アプリに `setLanguage` を postMessage |
| スリープ防止 | 親アプリの WakeLock + 子アプリへの `setWakeLock` postMessage の両方を制御 |
| 切替時に音を止める | タブ切替時に非アクティブな子アプリへ `pauseAll` を postMessage |
| 表示サイズ | 固定幅アプリ（NamaMeto・NamaChu）の `transform: scale` を調整するスライダー |
| 強制リロード | SW キャッシュ全消去 → SW 解除 → `location.reload()` の順で完全リフレッシュ |
| アプリリンク | 各子アプリへの直リンク + URL コピーボタン（言語に応じてアプリ名が変わる） |
| 欲しいものリスト | Amazon バナーリンク |
