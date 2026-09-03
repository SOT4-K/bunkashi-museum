#!/usr/bin/env node
// content/images/ には他の作業（writer/researcher、あるいは他の作品の並行作業）が
// ライセンス未確認の画像を置くことがある。content/images/*.* を Vite の
// import.meta.glob で丸ごと取り込むと、未ライセンスの画像や無関係な画像まで
// dist に同梱されてしまう（実際に事故が起きたため、この script 方式に変えた）。
//
// このスクリプトは「content/works/*.json のいずれかの作品が参照していて、かつ
// content/images/manifest.json にライセンスが記録済みの画像」だけを、
// sharp で長辺 1200px 以下に縮小・WebP（品質80）に変換して
// app/public/img/<workId>.webp としてコピーし、対応表を
// app/src/generated/real-images.json に書き出す。未対応の作品は自動的に
// プレースホルダ（scripts/make-placeholders.mjs 生成）にフォールバックする。
//
// app/public/img/ はこのスクリプトと make-placeholders.mjs の生成物なので
// work/.gitignore で除外している（コミットしない）。
//
// このファイルは app/ の外（nihonshi-bunka/scripts/）にあり app/node_modules を
// 通常のバレ import では解決できないため、createRequire で app/package.json を
// 起点に 'sharp' を明示的に解決する。
//
// 実行: node scripts/sync-real-images.mjs

import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const requireFromApp = createRequire(join(root, 'app', 'package.json'))
const sharp = requireFromApp('sharp')
const worksDir = join(root, 'content', 'works')
const imagesDir = join(root, 'content', 'images')
const manifestPath = join(imagesDir, 'manifest.json')
const outImgDir = join(root, 'app', 'public', 'img')
const outManifestPath = join(root, 'app', 'src', 'generated', 'real-images.json')

// DESIGN.md 6章は「長辺1200px以下、100KB目安」。品質80のまま1200pxで書き出すと
// 高精細スキャンの作品（例: 2300px超級の原寸）で1枚200KB超になり、dist/img 合計が
// 2MB を超えた（実測）。目安の100KBに近づけるため長辺は1000pxに抑える
// （ticket の「1200px以下」の範囲内。品質は指示どおり80のまま変えない）。
const MAX_DIMENSION = 1000
const WEBP_QUALITY = 80

async function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  // manifest は作品 id で引く（works 側の image.file は拡張子が違うことがあるため）
  const licensedById = new Map(
    (manifest.images ?? [])
      .filter((img) => img.id && img.file && img.license && img.sourceUrl)
      .map((img) => [img.id, img]),
  )

  const workFiles = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  const result = {}
  let copied = 0

  mkdirSync(outImgDir, { recursive: true })

  for (const file of workFiles) {
    const works = JSON.parse(readFileSync(join(worksDir, file), 'utf-8'))
    for (const work of works) {
      const entry = licensedById.get(work.id)
      if (!entry) continue // ライセンス未記録
      const srcPath = join(imagesDir, entry.file)
      if (!existsSync(srcPath)) continue // 参照はあるが実体が無い

      const destName = `${work.id}.webp`
      await sharp(srcPath)
        .rotate() // Exif の向きを反映してから縮小
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toFile(join(outImgDir, destName))
      result[work.id] = destName
      copied++
    }
  }

  mkdirSync(dirname(outManifestPath), { recursive: true })
  writeFileSync(outManifestPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')
  console.log(`synced ${copied} licensed image(s) (resized <= ${MAX_DIMENSION}px, webp q${WEBP_QUALITY}). wrote ${outManifestPath}`)
}

main()
