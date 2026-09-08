#!/usr/bin/env node
// M2b-14 (b): 博物館収蔵の出土品に findSite（出土地）を付与する。対象は「holder が museum で、
// location フィールドに実際の出土地情報がある作品」全件（content/works/*.json を走査して機械抽出）。
// 値は work.location から末尾の「出土」を取り除いたもの（例
// "青森県つがる市（亀ヶ岡遺跡）出土" → "青森県つがる市（亀ヶ岡遺跡）"）。
// この抽出条件に一致したのは遮光器土偶・火焔型土器・挂甲の武人・袈裟襷文銅鐸・稲荷山鉄剣の5件のみ
// （他の holder:museum 作品は全て絵画・書物等で「作られてからずっと同じ収蔵先にある」ため
// location と holder が同じ値で、出土地という別概念を持たない）。
//
// content/works/*.json の既存整形を保つため（assign-holder-kind.mjs と同じ理由）行単位で処理する。
//
// 実行: node scripts/assign-find-site.mjs        （dry-run）
//       node scripts/assign-find-site.mjs --write

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')

/** id → findSite の値。location から「出土」を取り除いた文字列（機械抽出＋目視確認）。 */
const FIND_SITE = {
  'shakoki-dogu': '青森県つがる市（亀ヶ岡遺跡）',
  'kaen-doki': '新潟県十日町市（笹山遺跡）',
  'keiko-bujin-haniwa': '群馬県太田市飯塚町',
  'kesadasuki-dotaku': '広島県（黒川遺跡）',
  'inariyama-tekken': '埼玉県行田市（稲荷山古墳）',
}

function main() {
  const write = process.argv.includes('--write')
  const files = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  const applied = []

  for (const file of files) {
    const path = join(worksDir, file)
    const original = readFileSync(path, 'utf-8')
    const lines = original.split('\n')
    const out = []
    let currentId = null
    let changedInFile = false

    for (const line of lines) {
      const idMatch = line.match(/^\s*"id":\s*"([^"]+)",?\s*$/)
      if (idMatch) currentId = idMatch[1]

      out.push(line)

      const holderKindMatch = line.match(/^(\s*)"holderKind":\s*"[^"]+",?\s*$/)
      if (holderKindMatch && currentId && FIND_SITE[currentId]) {
        const indent = holderKindMatch[1]
        out.push(`${indent}"findSite": "${FIND_SITE[currentId]}",`)
        applied.push({ file, id: currentId, findSite: FIND_SITE[currentId] })
        changedInFile = true
      }
    }

    if (changedInFile && write) {
      writeFileSync(path, out.join('\n'), 'utf-8')
    }
  }

  console.log(`findSite 付与: ${applied.length} 件（write=${write}）`)
  for (const a of applied) console.log(`  - ${a.id} (${a.file}): "${a.findSite}"`)

  const missing = Object.keys(FIND_SITE).filter((id) => !applied.some((a) => a.id === id))
  if (missing.length > 0) console.log(`見つからなかった id（holderKind行が無い/idが無い）: ${missing.join(', ')}`)
}

main()
