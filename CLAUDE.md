# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業するときのガイドだよ。

## Claudeへの指示

- **言語**: 常に日本語で返答すること
- **トーン**: フランクで親しみやすい感じで（「〜だよ」「〜だね」くらいのノリ）
- **説明スタイル**: プログラミング初心者にも分かるように、専門用語には一言説明を添えること

---

## プロジェクト概要

強迫性障害（OCD）のERP（曝露反応妨害法）治療を補助するための、スマホ用PWA（Progressive Web App）。
「不安を下げるアプリ」ではなく、**強迫行為をしなかった行動の積み重ねを加点式で記録するアプリ**。

GitHub Pages で公開 → iPhoneのSafariで「ホーム画面に追加」→ アプリ感覚で使える形。

---

## 技術スタック

| 項目 | 内容 |
|---|---|
| 言語 | HTML / CSS / Vanilla JavaScript（フレームワークなし） |
| ホスティング | GitHub Pages（ビルドなし、ファイルをそのままデプロイ） |
| PWA | `manifest.json` + Service Worker (`sw.js`) |
| データ保存 | `localStorage`（端末内のみ・クラウドなし） |
| グラフ | Canvas API（ライブラリなし） |

---

## ファイル構成

```
/
├── index.html          # SPA本体（4つのビューをJSで切り替え）
├── manifest.json       # PWA設定（アプリ名・アイコン・テーマカラー）
├── sw.js               # Service Worker（オフライン対応・キャッシュ）
├── css/
│   └── style.css       # ダーク系テーマ・スマホ最適化スタイル
├── js/
│   ├── app.js          # ビュー切り替え・フォーム送信・タイマー・履歴描画
│   ├── storage.js      # localStorage の読み書き（IIFE モジュール）
│   ├── scoring.js      # 加点ロジック（IIFE モジュール）
│   └── chart.js        # Canvas グラフ描画（IIFE モジュール）
└── icons/
    ├── icon-192.png    # PWAアイコン（Python スクリプトで生成）
    └── icon-512.png
```

---

## アプリの4画面構成

| 画面ID | 内容 |
|---|---|
| `#view-home` | 今日の点数・記録回数・3分タイマー |
| `#view-record` | 記録フォーム（スライダー・チップ選択・ラジオ） |
| `#view-history` | 日付別の記録一覧 |
| `#view-graph` | 直近7日間の棒グラフ2本 |

ビュー切り替えは `app.js` の `showView(name)` で行う。

---

## 加点ルール（重要・設計の核心）

**減点なし。できた行動だけ加点。**

| 条件 | 点数 |
|---|---|
| 記録した（常時） | +1 |
| 我慢時間（最高ランクのみ） | 10秒+2 / 1分+5 / 3分+8 / 10分+12 / 放置成功+15 |
| 反応しなかった | +15 |
| 不快なまま生活に戻れた | +20 |
| 確認・安心探しをしなかった | +20 |
| 打ち消しイメージをしなかった | +15 |

点数の正確さにこだわらせない設計にすること。点数付けそのものが強迫化しないよう注意。

---

## データモデル（`localStorage` キー: `ocd_records`）

```json
{
  "id": "1719544800000_a3f",
  "timestamp": "2026-06-28T10:30:00.000Z",
  "discomfortLevel": 85,
  "urgeLevel": 90,
  "situation": "仕事",
  "triggers": ["汚染感", "記憶映像"],
  "reaction": "しなかった",
  "enduranceTime": "10分",
  "bonuses": ["不快なまま生活に戻れた"],
  "memo": "",
  "score": 48
}
```

---

## ローカルでの確認方法

ビルドは不要。ブラウザで直接開けばOK。

```bash
# 方法1: Pythonの簡易サーバー（ポート8080で起動）
python3 -m http.server 8080
# → http://localhost:8080 で確認

# 方法2: VS Codeの Live Server 拡張を使う
```

PWA（Service Workerなど）の動作確認は `http://localhost` か `https://` 環境が必要。
`file://` で開くと Service Worker が動かないので注意。

---

## GitHub Pages へのデプロイ

1. このブランチを `main` にマージする
2. GitHub → リポジトリ Settings → Pages → Source: `main` branch, `/ (root)`
3. 数分後に `https://eternitybios-dot.github.io/ERP/` で公開される

iPhoneのSafariでそのURLを開き、「共有ボタン → ホーム画面に追加」でアプリ化完了。

---

## アイコンを再生成する場合

```bash
python3 << 'EOF'
# icons/icon-192.png と icons/icon-512.png を生成するスクリプトは
# このリポジトリの初期セットアップ時に手動実行済み。
# デザインを変えたい場合は icons/ 以下の PNG を差し替えるだけでOK。
EOF
```

---

## 設計上の注意点

- **点数付けの強迫化を防ぐ**: 減点・失敗表示・警告・ランキングは入れない
- **「不安が下がったか」ではなく「反応しなかったか」で点数をつける**
- 記録前後に「正確じゃなくていい」「不快感が残っていても成功」のメッセージを表示する
- メモ欄は最大100文字に制限（反芻防止）
