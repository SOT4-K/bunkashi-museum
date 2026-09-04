# 無料で公開する手順（DEPLOY.md）

このゲームは**サーバー不要の静的サイト（PWA）**なので、無料ホスティングで運用費ゼロで公開できる。
進捗はプレイヤーの端末（localStorage）に保存され、こちらにデータは来ない。

## 選択肢の比較（2026-09 時点の Hayato の理解。料金・上限は各公式ページで最終確認すること）

| | GitHub Pages（第一候補） | Cloudflare Pages（代替） | Vercel / Netlify |
|---|---|---|---|
| 費用 | 無料（public リポジトリ） | 無料 | 無料枠あり（商用利用や帯域に条件） |
| 帯域 | 目安 100GB/月（ソフトリミット） | 無制限 | 100GB/月 前後 |
| HTTPS | 自動 | 自動 | 自動 |
| 独自ドメイン | 可 | 可 | 可 |
| デプロイ | `git push` → Actions が自動ビルド | GitHub 連携で自動 | GitHub 連携で自動 |
| 向き | 最短。`work/` が既に git なので追加設定が最小 | 帯域が読めない時、将来の高速化 | 使い慣れていれば |

PWA（ホーム画面に追加で全画面）は **HTTPS が必須**。上のどれでも満たす。

## A. GitHub Pages（推奨）— 初回はオーナー作業（約 10 分）
アカウント作成・公開設定は会社の原則で**オーナーが行う**（`company/PRINCIPLES.md`）。以後の更新は `git push` だけで自動。

1. GitHub で **public リポジトリ**を作る（例: `bunkashi-museum`）。README 等は作らない（空のまま）
2. ターミナルで `work/` に入り、リモートを追加して push
   ```bash
   cd ventures/game-dev/work
   git remote add origin git@github.com:<あなたのID>/bunkashi-museum.git
   git push -u origin main
   ```
3. GitHub のリポジトリ → **Settings → Pages → Build and deployment → Source を「GitHub Actions」** にする
4. **Actions** タブでワークフロー `deploy`（`work/.github/workflows/deploy.yml`）が緑になるのを待つ（初回 1〜2 分）
5. 公開 URL: `https://<あなたのID>.github.io/bunkashi-museum/`
   - サブパス配信になるため、ワークフローが `VITE_BASE=/bunkashi-museum/` を自動で渡す（リポジトリ名から生成）
6. iPhone の Safari で URL を開く → 共有ボタン → **「ホーム画面に追加」** → ホームのアイコンから起動すると URL バーなしの全画面になる

更新: `work/` で変更をコミットして `git push` するだけ。Hayato の `bin/company checkpoint` は `work/` にもコミットするので、その後 `git push` すれば反映される（push は公開行為なので、当面はオーナーが実行。包括承認があれば Hayato が行う）。

## B. Cloudflare Pages（代替）
1. Cloudflare アカウント（無料）→ Workers & Pages → Create → Pages → **Connect to Git** で上のリポジトリを選ぶ
2. Build settings: Framework preset = Vite / Root directory = `nihonshi-bunka/app` / Build command = `npm run build` / Output = `dist`
3. 環境変数 `VITE_BASE=/`（ルート配信なので `/`）
4. 公開 URL: `https://<project>.pages.dev/`

## 公開前チェック（Hayato が確認、reviewer が検証）
- [ ] `content/images/manifest.json` に全画像のライセンスと帰属が記録され、アプリの「クレジット」画面に表示される
- [ ] `status: reviewed` 以外の作品が本番ビルドに含まれていない（M2 で `VITE_INCLUDE_DRAFT` は撤去済み。dev サーバーでのみ draft を見る）
- [ ] Lighthouse の PWA 項目が合格（installable、HTTPS、manifest、service worker）
- [ ] iPhone 実機でホーム画面追加 → 全画面起動 → オフラインでも前回の画像が表示される
- [ ] 個人情報を送信していない（外部リクエストが画像とアプリ本体のみ）

## 制約として知っておくこと
- **Safari で URL を開いたままでは URL バーは消せない**（Apple の仕様）。「ホーム画面に追加」が唯一の全画面経路。アプリ内で案内を出す
- iOS の localStorage は、Safari で開いた場合 **7 日間使わないと消える**ことがある（ITP）。ホーム画面追加した standalone では消えにくい。保険として成績画面に進捗のエクスポート/インポートを置く
- GitHub Pages は「サイトを商用のオンラインサービスの主体として使う」ことを規約で制限している。無料・広告なしの教育用途は問題ないが、有料化する段階では Cloudflare 等へ移す
