# 文化史ミュージアム（仮）— app

日本史文化史（飛鳥〜江戸）の画像選択クイズ PWA。Vite + React + TypeScript。
ゲーム設計は `../DESIGN.md`、見た目のトークンは `../UI-DESIGN.md` を参照。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

`content/`（`../content/`、このリポジトリでは app/ の外）を `import.meta.glob` で読み込む。
dev サーバーでは `status: draft` の作品も常に含める。

## テスト

```bash
npm test          # vitest run（distractors / srs / session / progress / explain の単体テスト、
                   # AnswerSheet・QuestionCard・LearnScreen のコンポーネントテストを含む）
```

## content の検証

```bash
npm run validate           # content/ の必須項目・era参照・confusables参照・id重複・statusを検査
npm run make-placeholders  # 実画像が無い作品用に app/public/img/<id>.svg を生成
npm run sync-real-images   # content/images/manifest.json でライセンス記録済み・かつ作品から
                            # 参照されている画像だけを app/public/img/<id>.<ext> にコピーする
```

`npm run build` は `prebuild` で `validate` → `sync-real-images` を自動実行する。

**画像の取り扱い（重要）**: `content/images/` は他の作業（writer など）とも共有のディレクトリで、
ライセンス未確認・本アプリの作品に無関係な画像が置かれることがある。そのため
`app/src/utils/image.ts` は `content/images/` を `import.meta.glob` で丸ごと取り込まない
（過去に無関係な画像十数枚が dist に混入する事故があった）。
`sync-real-images.mjs` が明示的にコピーしたファイルだけを使い、対応表は
`app/src/generated/real-images.json`（コミット対象）。実体が無い作品は
`public/img/<id>.svg`（プレースホルダ）にフォールバックする。

## ビルド・プレビュー

```bash
npm run build      # tsc -b && vite build。dist/ に manifest.webmanifest と sw.js が出る
npm run preview    # ローカルでビルド結果を確認（既定 4173番ポート）
```

## 環境変数

| 変数 | 既定 | 用途 |
|---|---|---|
| `VITE_BASE` | `/` | GitHub Pages 等のサブパス配信用。CI からは `/<repo>/` を渡す |
| `VITE_INCLUDE_DRAFT` | 未設定 | `1` を渡すとビルドでも `status: draft` の作品を含める（M1 の間の暫定措置。サンプルが全部 draft のため） |

## ディレクトリ

- `src/types.ts` — content のスキーマに対応する型（`Work` / `Era` / `Question` / `ProgressState` など）
- `src/content.ts` — `../../content/` を読み込み、draft の扱いを決める
- `src/engine/` — 出題・SRS・セッション組み立て・進捗更新の純粋関数（Vitest で単体テスト）
  - `distractors.ts` 選択肢（ディストラクタ）生成
  - `srs.ts` 間隔反復（箱0〜5、間隔0/1/3/7/14/30日）。`AnswerKind`（correct/incorrect/unknown）を扱う
  - `session.ts` 1セッション（復習優先＋新規、同時代非連続）の組み立て
  - `progress.ts` localStorage（`bunkashi.v1`）の読み書き・XP/レベル/ストリーク
  - `explain.ts` 不正解時の「なぜ違うか」1文
- `src/store/useProgressStore.ts` — 進捗の React 側ラッパー（localStorage 永続化）
- `src/components/` — 画面（ホーム・学習・図鑑・成績）とボトムシート
- `src/utils/image.ts` — 作品画像のURL解決（実画像 → プレースホルダのフォールバック）
- `scripts/`（`../scripts/`）— content 検証・プレースホルダ生成・画像同期（Node、依存無し）

## 画面遷移について（iOS スワイプ戻るとの関係）

タブ（ホーム/学習/図鑑/成績）の切り替えは React の state のみで行っており、
`history.pushState` は使っていない。理由: 画面はすべて1つの `App` 内の条件分岐
（`tab` の値）で出し分けているだけで、ブラウザの「ページ」に相当する概念が無いため、
履歴エントリを積む意味が無い。結果として、iOS の「エッジからスワイプで戻る」
ジェスチャーに対して戻れる「前の画面」が無く、アプリ内タブ遷移と二重に食い違う
ことは起きない（DESIGN.md 2章の懸念点への回答）。図鑑の作品詳細シートやセッション中の
解説シートも同様に state で開閉するのみで、閉じるボタンかシート下部の操作でしか閉じない
（誤ってスワイプで解説を飛ばさない設計。UI-DESIGN.md 2章）。

将来、画面ごとに直接リンクしたくなった場合（例: 特定の作品を共有する等）は、
`pushState` の導入とスワイプ戻る時の二重遷移防止を改めて検討すること。
