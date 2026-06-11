# ぽもじかん v11 ── 新UI実装

`design_canvas.jsx` のレビューモック `ぽもじかん UI改良.html` と、
動く本体 `ぽもじかん 実装.html` の2本立て。

## ファイル
| ファイル | 役割 |
|---|---|
| `ぽもじかん 実装.html` | **動く本体** ── これがリリース対象 |
| `ぽもじかん UI改良.html` | 設計レビュー用キャンバス（5テーマ並走・モーダル比較） |
| `themes.jsx` | 5つの世界（夜雨／墨道／苔庭／金閣／春霞）のトークン |
| `MainScreen.jsx` | メイン画面・落下フィールド・タイマー・パーティ |
| `Modals.jsx` | 図鑑・遊び方・パーティ選択・文章モード・時間設定 |
| `AppImpl.jsx` | 実装のルート（永続化・モーダル制御・テーマ切替） |
| `App.jsx` | レビュー用キャンバスのルート |
| `Concept.jsx` | 改良方針メモ |
| `DesktopScreen.jsx` | PCレイアウト |
| `styles.css` | 全体スタイル |
| `design-canvas.jsx` / `tweaks-panel.jsx` | レビュー用ヘルパー |

## 動かし方（ローカル）
```
python3 -m http.server 8000
# → http://localhost:8000/ぽもじかん%20実装.html
```

## 統合方針（要相談）
- (A) 既存 `index.html` / `app.js` / `style.css` を丸ごと差し替え
- (B) `v11/` サブフォルダに並走（既存はそのまま）
- (C) 新UIの要素を既存コードに段階移植

## Phase A 実装済み
- テーマ切替（5世界・localStorage永続化）
- リーダー選択 → タイマー → 字を拾ってEXP → Lv→★帯昇格
- 図鑑・ヘルプ・文章モードのUI骨格（実データはまだ最小）

## Phase B 以降に必要
- codex.js の実データ流し込み（既存 codex.js 流用可能）
- words-*.js の合成辞書連携
- 書体進化（楷→行→草→篆→甲骨…）
- 音響・PWA・通知
- 文章モードの実保存
