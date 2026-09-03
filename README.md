# game-dev / work — 成果物（独立 git リポジトリ）

ゲーム 1 本につき `work/<game-slug>/` を 1 つ。共通エンジンは 2 本目が必要になるまで作らない。

- `nihonshi-bunka/` … 第1作「文化史ミュージアム（仮）」日本史文化史（江戸まで）の画像選択クイズ PWA
  - `DESIGN.md` ゲーム設計（出題・定着・楽しさ・データモデル・技術）
  - `DEPLOY.md` 無料で公開する手順（GitHub Pages / Cloudflare Pages）
  - `content/` 出題データ（作品 JSON・時代・画像 manifest とライセンス）。**アプリのコードから独立させ、writer/reviewer が直接編集できる形**
  - `app/` Vite + React + TypeScript の PWA
  - `scripts/` 画像取得・検証・content→app への同期
