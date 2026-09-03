#!/usr/bin/env node
// content/ の整合性チェック。DESIGN.md 6章・7章:
//  必須項目・era の存在・confusables[].id の参照先の存在・id の重複・status の値。
// npm run build の prebuild で必ず走る。エラーがあれば exit code 1 で失敗させる。

import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const erasPath = join(root, 'content', 'eras.json')

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

  if (errors.length > 0) {
    console.error(`content の検証エラー ${errors.length} 件:`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`content OK: ${allWorks.length} 作品 / ${eras.length} 時代`)
}

main()
