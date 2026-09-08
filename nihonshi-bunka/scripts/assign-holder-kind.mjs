#!/usr/bin/env node
// M2b-14: work.holder の値から holderKind（'site' | 'museum'）を機械判定して付与する。
// 所蔵語（博物館・美術館・文庫・記念館・図書館・資料館・尚蔵館・国宝館・コレクション）が
// holder 文字列に含まれていれば 'museum'、含まれていなければ 'site' とする（機械判定案）。
// 判定が曖昧なもの（所有者と現在の展示・寄託先が異なる等）は AMBIGUOUS_IDS に列挙し、
// 標準出力に一覧を出す（値は機械判定のまま変更しない。目視確定は Hayato が行う）。
//
// content/works/*.json は既存の手書き整形（pairs 等の配列要素を1行に詰める等）を保っているため、
// JSON.parse→JSON.stringify で丸ごと書き直すと無関係な整形差分が大量に出る（builder メモ
// yaml-plain-scalar系の教訓と同種の「機械的な書き戻しは元の整形を壊さない」注意）。
// そのため行単位のテキスト処理で `"holder": "..."` の直後に `"holderKind": "..."` を
// 1行挿入するだけに留める（他の行には一切触れない）。
//
// 実行: node scripts/assign-holder-kind.mjs        （dry-run。一覧のみ表示）
//       node scripts/assign-holder-kind.mjs --write （実際に content/works/*.json を書き換える）

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')

const MUSEUM_WORDS = ['博物館', '美術館', '文庫', '記念館', '図書館', '資料館', '尚蔵館', '国宝館', 'コレクション']

/**
 * 判定が曖昧と判断した作品 id → 理由（報告用。値は機械判定のまま変更しない）。
 * - fujin-raijin-sotatsu: holder 原文の所有者は建仁寺（寺）だが京都国立博物館に寄託中。
 *   「博物館」を含むため機械判定は museum。
 * - juben-jugi: 「川端康成記念会」は所蔵語リストの「記念館」に一致しないため機械判定は site だが、
 *   実態は財団法人が所蔵する私設コレクションで、見学地としての「場所」ではない。
 * - shokintei-katsura: holder 原文「宮内庁（京都市西京区）」は所蔵語に一致せず機械判定は site だが、
 *   原文の主体（宮内庁）が地名になっていない（実際の建物は桂離宮内の松琴亭）。
 * - takamatsuzuka-heki / kitora-kofun-heki: holder 原文「国（文化庁所管、現地保存）」は
 *   所蔵語に一致せず機械判定は site（現地保存＝遺跡そのもののため方向性としては妥当）だが、
 *   原文の主体（国）も地名になっていない。
 * - koyagire: 「分割所蔵（複数の美術館・個人に分蔵）」は「美術館」を含むため機械判定は museum。
 *   分類方向は妥当だが、美術館と個人の混在で単一の値として条件に使うには不向き。
 */
const AMBIGUOUS_IDS = new Set([
  'fujin-raijin-sotatsu',
  'juben-jugi',
  'shokintei-katsura',
  'takamatsuzuka-heki',
  'kitora-kofun-heki',
  'koyagire',
])

function classify(holder) {
  const matched = MUSEUM_WORDS.filter((w) => holder.includes(w))
  return { kind: matched.length > 0 ? 'museum' : 'site', matched }
}

const HOLDER_LINE = /^(\s*)"holder":\s*"((?:[^"\\]|\\.)*)",?\s*$/

function main() {
  const write = process.argv.includes('--write')
  const files = readdirSync(worksDir).filter((f) => f.endsWith('.json'))

  let museumCount = 0
  let siteCount = 0
  const ambiguousReport = []
  let currentId = null

  for (const file of files) {
    const path = join(worksDir, file)
    const original = readFileSync(path, 'utf-8')
    const lines = original.split('\n')
    const out = []
    let changedInFile = false

    for (const line of lines) {
      const idMatch = line.match(/^\s*"id":\s*"([^"]+)",?\s*$/)
      if (idMatch) currentId = idMatch[1]

      out.push(line)

      const m = line.match(HOLDER_LINE)
      if (m) {
        const indent = m[1]
        const holderValue = m[2]
        const { kind, matched } = classify(holderValue)
        if (kind === 'museum') museumCount++
        else siteCount++
        if (currentId && AMBIGUOUS_IDS.has(currentId)) {
          ambiguousReport.push({ file, id: currentId, holder: holderValue, kind, matched })
        }
        out.push(`${indent}"holderKind": "${kind}",`)
        changedInFile = true
      }
    }

    if (changedInFile && write) {
      writeFileSync(path, out.join('\n'), 'utf-8')
    }
  }

  console.log(`holderKind 機械判定: museum=${museumCount} site=${siteCount}（write=${write}）`)
  console.log('判定が曖昧な作品（値は機械判定のまま。目視確定はHayatoが行う）:')
  for (const r of ambiguousReport) {
    console.log(`  - ${r.id} (${r.file}): "${r.holder}" → ${r.kind} (matched: ${r.matched.join(',') || 'なし'})`)
  }
}

main()
