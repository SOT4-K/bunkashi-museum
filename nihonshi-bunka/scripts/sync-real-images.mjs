#!/usr/bin/env node
// content/images/ には他の作業（writer/researcher、あるいは他の作品の並行作業）が
// ライセンス未確認の画像を置くことがある。content/images/*.* を Vite の
// import.meta.glob で丸ごと取り込むと、未ライセンスの画像や無関係な画像まで
// dist に同梱されてしまう（実際に事故が起きたため、この script 方式に変えた）。
//
// このスクリプトは「content/works/*.json のいずれかの作品が参照していて、かつ
// content/images/manifest.json にライセンスが記録済みの画像」だけを
// app/public/img/<workId>.<ext> としてコピーし、対応表を
// app/src/generated/real-images.json に書き出す。未対応の作品は自動的に
// プレースホルダ（scripts/make-placeholders.mjs 生成）にフォールバックする。
//
// 実行: node scripts/sync-real-images.mjs

import { readFileSync, readdirSync, existsSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const imagesDir = join(root, 'content', 'images')
const manifestPath = join(imagesDir, 'manifest.json')
const outImgDir = join(root, 'app', 'public', 'img')
const outManifestPath = join(root, 'app', 'src', 'generated', 'real-images.json')

function main() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  const licensedByFile = new Map(
    (manifest.images ?? [])
      .filter((img) => img.file && img.license && img.sourceUrl)
      .map((img) => [img.file, img]),
  )

  const workFiles = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  const result = {}
  let copied = 0

  for (const file of workFiles) {
    const works = JSON.parse(readFileSync(join(worksDir, file), 'utf-8'))
    for (const work of works) {
      const imageFile = work.image?.file
      if (!imageFile) continue
      if (!licensedByFile.has(imageFile)) continue // ライセンス未記録
      const srcPath = join(imagesDir, imageFile)
      if (!existsSync(srcPath)) continue // 参照はあるが実体が無い

      const ext = extname(imageFile)
      const destName = `${work.id}${ext}`
      mkdirSync(outImgDir, { recursive: true })
      copyFileSync(srcPath, join(outImgDir, destName))
      result[work.id] = destName
      copied++
    }
  }

  mkdirSync(dirname(outManifestPath), { recursive: true })
  writeFileSync(outManifestPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')
  console.log(`synced ${copied} licensed image(s). wrote ${outManifestPath}`)
}

main()
