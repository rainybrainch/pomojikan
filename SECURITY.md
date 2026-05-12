# セキュリティポリシー ── ぽもじかん

## サポートされているバージョン

最新の `main` ブランチおよびそこから生成された GitHub Pages デプロイ版のみ。

| Version | Supported |
|---|---|
| v2.9.x | ✅ |
| v2.0〜v2.8 | ⚠️ ベストエフォート |
| v0.x〜v1.x | ❌ |

## 報告先

[GitHub Issues](https://github.com/rainybrainch/pomojikan/issues) にて、タイトル先頭に `[Security]` を付けて報告してください。

公開リスクが懸念される場合は、Issue 内に「**Private 希望**」と明記してください。

## 既知の特徴

- **データはすべて端末ローカル**（localStorage）に保存され、サーバー送信は一切行いません
- **アクセス解析・広告・トラッキング Cookie なし**
- **外部通信は 2 種のみ**:
  - Google Fonts（書体配信）
  - Gist API（服牢365 名言モード時のみ、書き込みなし）
- **PWA 起動後はオフライン動作可**

## CSP（Content Security Policy）

`<meta http-equiv="Content-Security-Policy">` で `default-src 'self'` ベースで制限済み（v2.9.18〜）。

## 対応 SLA

個人プロジェクトのため、**ベストエフォート**です。

- 重大度高：可能な限り 7 日以内に対応
- 重大度中：30 日以内に対応
- 重大度低：次の改善サイクルに含める

## 報告者への謝意

責任ある開示にご協力いただいた方は、ご希望に応じて `changelog.html` に Credit を記載します。
