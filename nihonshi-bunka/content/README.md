# content — 出題データ

- `eras.json` … 文化（時代）の一覧。`order` が学習順
- `works/<era>.json` … 作品の配列（スキーマは `../DESIGN.md` 6 章）。`status: reviewed` のものだけ本番に出る
- `images/<id>.webp` … 作品画像（長辺 1200px 以下）。**`images/manifest.json` にライセンス未記録の画像は使わない**
- 執筆ルール: `explanation` は 3〜6 文、`keyPoints` は 2〜4 個、`confusables[].howToTell` は「どこを見れば見分けられるか」を 1 文で。事実には `sources` を付ける
