#!/usr/bin/env node
// content/ の整合性チェック。DESIGN.md 6章・7章:
//  必須項目・era の存在・confusables[].id の参照先の存在・id の重複・status の値。
//  status: reviewed の作品は manifest.json に同じ id のエントリ（file・license・
//  sourceUrl・attributionText 必須）と画像実体が無ければエラー（本番ビルドに含まれる
//  のに出典を欠くのを防ぐ）。draft はエントリ無しでも警告のみ（M1 は全件 draft）。
//  confusables が1件以下の作品は警告（DESIGN.md 3章: ディストラクタの質に関わる）。
// npm run build の prebuild で必ず走る。エラーがあれば exit code 1 で失敗させる
// （警告のみなら exit 0）。
//
// 実行: node scripts/validate-content.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const erasPath = join(root, 'content', 'eras.json')
const imagesDir = join(root, 'content', 'images')
const manifestPath = join(imagesDir, 'manifest.json')

// status: reviewed で必須の manifest フィールド
const REQUIRED_MANIFEST_FIELDS = ['file', 'license', 'sourceUrl', 'attributionText']

const REQUIRED_FIELDS = [
  'id',
  'title',
  'reading',
  'era',
  'category',
  'location',
  'technique',
  'keyPoints',
  'explanation',
  'confusables',
  'image',
  'sources',
  'examTags',
  'status',
]

const VALID_CATEGORIES = new Set([
  'architecture',
  'sculpture',
  'painting',
  'craft',
  'calligraphy',
  'garden',
  'other',
])

const VALID_STATUS = new Set(['draft', 'reviewed'])

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function main() {
  const errors = []
  const warnings = []

  let manifest = { images: [] }
  try {
    manifest = loadJson(manifestPath)
  } catch (e) {
    errors.push(`content/images/manifest.json が読めない（${e.message}）`)
  }
  const manifestById = new Map((manifest.images ?? []).filter((img) => img.id).map((img) => [img.id, img]))

  const eras = loadJson(erasPath)
  if (!Array.isArray(eras)) {
    console.error('content/eras.json は配列である必要がある')
    process.exit(1)
  }
  const eraIds = new Set(eras.map((e) => e.id))

  const workFiles = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  if (workFiles.length === 0) {
    errors.push('content/works/ に .json ファイルが1つも無い')
  }

  const allWorks = []
  const idToFile = new Map()

  for (const file of workFiles) {
    let works
    try {
      works = loadJson(join(worksDir, file))
    } catch (e) {
      errors.push(`${file}: JSON として読めない（${e.message}）`)
      continue
    }
    if (!Array.isArray(works)) {
      errors.push(`${file}: 配列である必要がある`)
      continue
    }
    for (const work of works) {
      allWorks.push(work)

      const label = `${file} / ${work.id ?? '(id無し)'}`

      // 必須項目
      for (const field of REQUIRED_FIELDS) {
        if (!(field in work)) {
          errors.push(`${label}: 必須項目 "${field}" が無い`)
        }
      }

      // id の重複
      if (work.id) {
        if (idToFile.has(work.id)) {
          errors.push(`${label}: id "${work.id}" が ${idToFile.get(work.id)} と重複している`)
        } else {
          idToFile.set(work.id, file)
        }
      }

      // era の存在
      if (work.era && !eraIds.has(work.era)) {
        errors.push(`${label}: era "${work.era}" は content/eras.json に無い`)
      }

      // category
      if (work.category && !VALID_CATEGORIES.has(work.category)) {
        errors.push(`${label}: category "${work.category}" は不正な値`)
      }

      // status
      if (work.status && !VALID_STATUS.has(work.status)) {
        errors.push(`${label}: status "${work.status}" は draft か reviewed である必要がある`)
      }

      // confusables[].id の参照先
      if (Array.isArray(work.confusables)) {
        for (const c of work.confusables) {
          if (!c.id) {
            errors.push(`${label}: confusables に id の無い要素がある`)
            continue
          }
          if (!c.howToTell) {
            errors.push(`${label}: confusables["${c.id}"] に howToTell が無い`)
          }
        }
        // ディストラクタの質: confusable が1件以下だと選択肢生成が同カテゴリ・
        // 全体ランダムに頼りがちになる（DESIGN.md 3章）。警告のみ（ブロックしない）。
        if (work.confusables.length <= 1) {
          warnings.push(`${label}: confusables が ${work.confusables.length} 件しかない（2件以上を推奨）`)
        }
      }

      // manifest.json との照合（画像のライセンス記録）。id で引く
      // （works 側の image.file は拡張子が違うことがあるため file 名では引かない）。
      if (work.id) {
        const entry = manifestById.get(work.id)
        if (work.status === 'reviewed') {
          if (!entry) {
            errors.push(
              `${label}: status が reviewed だが content/images/manifest.json に id "${work.id}" のエントリが無い`,
            )
          } else {
            for (const field of REQUIRED_MANIFEST_FIELDS) {
              if (!entry[field]) {
                errors.push(`${label}: manifest["${work.id}"] に "${field}" が無い（reviewed には必須）`)
              }
            }
            if (entry.file && !existsSync(join(imagesDir, entry.file))) {
              errors.push(`${label}: manifest["${work.id}"].file "${entry.file}" の画像実体が content/images/ に無い`)
            }
          }
        } else if (!entry) {
          warnings.push(`${label}: manifest.json に id "${work.id}" のエントリが無い（draft のため警告のみ）`)
        }
      }
    }
  }

  // confusables[].id の参照先の存在チェック（全作品を読み終えてから）
  const allIds = new Set(allWorks.map((w) => w.id).filter(Boolean))
  for (const work of allWorks) {
    if (!Array.isArray(work.confusables)) continue
    for (const c of work.confusables) {
      if (c.id && !allIds.has(c.id)) {
        errors.push(`${work.id}: confusables の参照先 "${c.id}" が存在しない`)
      }
    }
  }

  if (warnings.length > 0) {
    console.warn(`content の警告 ${warnings.length} 件:`)
    for (const w of warnings) console.warn(`  - ${w}`)
  }

  if (errors.length > 0) {
    console.error(`content の検証エラー ${errors.length} 件:`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`content OK: ${allWorks.length} 作品 / ${eras.length} 時代（警告 ${warnings.length} 件）`)
}

main()
