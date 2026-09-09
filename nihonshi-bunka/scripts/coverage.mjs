#!/usr/bin/env node
// 収録率レポート（M2c-03）。content/canon.json（大学入試の文化史に出るべき項目の正本）と
// content/works/<era>.json（実際に出題可能な作品）を突き合わせ、文化（era）ごとに
// どれだけ収録できているかを表で出す。
//
// 集計の定義（canon の各項目を existingWorkId で content/works に引き当てる）:
//   visual（type: "visual"、図版で出題する項目）
//     出題可能: 対応する work があり、かつ画像実体がある（validate-content.mjs の
//       hasImageAsset と同じ判定: work.kind が artifact 相当・manifest.json にエントリ
//       あり・画像ファイルが content/images/ に実在する）、かつ work.status が "reviewed"
//     画像なし: 対応する work はあるが「出題可能」の条件を満たさない（画像未取得・
//       work.kind が person/text/concept で画像を持たない・status が draft 等）
//     未収録: canon にある項目に対応する work が content/works に無い
//       （existingWorkId が無い、または existingWorkId が存在しない work を指している）
//   text（type: "text"、文字問題の素材として出題する項目）
//     収録: 対応する work がある
//     未収録: 対応する work が無い（visual と同じ判定）
//
// canon にあって content に無い項目 = 上記「未収録」の項目（visual・text 両方）を列挙。
// content にあって canon に無い項目 = content/works 全体のうち、どの canon 項目の
//   existingWorkId からも参照されない work id を列挙。
//
// 出力の使い分け:
//   `node scripts/coverage.mjs`（`npm run coverage`）: era 別の表 ＋ canon-only/content-only
//     の全件列挙（詳細レポート）
//   `npm run validate`: validate-content.mjs の末尾がこのファイルの printSummary() を
//     呼び、era 別の表と件数のみを出す（詳細列挙は npm run coverage に譲る。既存の
//     validate の警告出力を壊さないよう、末尾に追加するだけ）
//
// 実行: node scripts/coverage.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const canonPath = join(root, 'content', 'canon.json')
const erasPath = join(root, 'content', 'eras.json')
const imagesDir = join(root, 'content', 'images')
const manifestPath = join(imagesDir, 'manifest.json')

// validate-content.mjs と揃える（work.kind の許容値）
const VALID_KINDS = new Set(['artifact', 'person', 'text', 'concept'])

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

/** content/works/*.json 全ファイルを読み、work.id -> work のマップを返す。
 *  worksDirPath を引数化してあるのは Vitest から一時ディレクトリで検証できるようにするため。 */
export function loadAllWorks(worksDirPath = worksDir) {
  const files = readdirSync(worksDirPath).filter((f) => f.endsWith('.json'))
  const all = []
  for (const file of files) {
    const works = loadJson(join(worksDirPath, file))
    if (Array.isArray(works)) all.push(...works)
  }
  return all
}

/** validate-content.mjs の hasImageAsset と同じ判定（画像実体が実際にあるか）。
 *  manifestById: id -> manifest.images[] のエントリ。imagesDirPath は引数化してある。 */
export function hasImageAsset(work, manifestById, imagesDirPath = imagesDir) {
  if (!work || !work.id) return false
  const kind = 'kind' in work ? work.kind : 'artifact'
  const isArtifactKind = kind === 'artifact' || !VALID_KINDS.has(kind)
  if (!isArtifactKind) return false
  const entry = manifestById.get(work.id)
  if (!entry || !entry.file) return false
  return existsSync(join(imagesDirPath, entry.file))
}

/** canon の visual 項目 1 件を "available"（出題可能）/ "noImage"（画像なし）/
 *  "missing"（未収録）に分類する。 */
export function classifyVisualItem(item, worksById, manifestById, imagesDirPath = imagesDir) {
  const work = item.existingWorkId ? worksById.get(item.existingWorkId) : undefined
  if (!work) return 'missing'
  if (hasImageAsset(work, manifestById, imagesDirPath) && work.status === 'reviewed') return 'available'
  return 'noImage'
}

/** canon の text 項目 1 件を "included"（収録）/ "missing"（未収録）に分類する。 */
export function classifyTextItem(item, worksById) {
  const work = item.existingWorkId ? worksById.get(item.existingWorkId) : undefined
  return work ? 'included' : 'missing'
}

const EMPTY_VISUAL = { available: 0, noImage: 0, missing: 0 }
const EMPTY_TEXT = { included: 0, missing: 0 }

/** canon・eras・works・manifest から収録率レポートのデータ構造を組み立てる（純粋関数、
 *  ファイルI/Oを含まない。main() 側でロードしたデータを渡す）。
 *  戻り値: {
 *    perEra: [{ eraId, eraName, visual: {available,noImage,missing}, text: {included,missing} }],
 *    totals: { visual: {...}, text: {...} },
 *    canonOnly: [{ id, title, era, type }],   // canon にあって content に無い項目
 *    contentOnly: [{ id, title, era }],        // content にあって canon に無い項目（work）
 *  }
 */
export function buildCoverageReport({ canon, eras, works, manifest, imagesDirPath = imagesDir }) {
  const worksById = new Map(works.filter((w) => w.id).map((w) => [w.id, w]))
  const manifestById = new Map((manifest.images ?? []).filter((img) => img.id).map((img) => [img.id, img]))
  const eraNameById = new Map(eras.map((e) => [e.id, e.name]))
  const eraOrder = [...eras].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((e) => e.id)

  const perEraMap = new Map()
  function ensureEra(eraId) {
    if (!perEraMap.has(eraId)) {
      perEraMap.set(eraId, {
        eraId,
        eraName: eraNameById.get(eraId) ?? eraId,
        visual: { ...EMPTY_VISUAL },
        text: { ...EMPTY_TEXT },
      })
    }
    return perEraMap.get(eraId)
  }
  // eras.json にある全時代を先に登録しておく（canon 項目が0件の時代でも表に出す）
  for (const eraId of eraOrder) ensureEra(eraId)

  const canonOnly = []

  for (const item of canon) {
    const row = ensureEra(item.era)
    if (item.type === 'visual') {
      const status = classifyVisualItem(item, worksById, manifestById, imagesDirPath)
      row.visual[status] += 1
      if (status === 'missing') canonOnly.push({ id: item.id, title: item.title, era: item.era, type: item.type })
    } else if (item.type === 'text') {
      const status = classifyTextItem(item, worksById)
      row.text[status] += 1
      if (status === 'missing') canonOnly.push({ id: item.id, title: item.title, era: item.era, type: item.type })
    }
  }

  // eras.json の順番、そこに無い era（canon 側の typo 等）は末尾にアルファベット順で追加
  const knownOrder = new Set(eraOrder)
  const extraEras = [...perEraMap.keys()].filter((id) => !knownOrder.has(id)).sort()
  const perEra = [...eraOrder, ...extraEras].map((id) => perEraMap.get(id))

  const totals = {
    visual: { ...EMPTY_VISUAL },
    text: { ...EMPTY_TEXT },
  }
  for (const row of perEra) {
    for (const key of Object.keys(EMPTY_VISUAL)) totals.visual[key] += row.visual[key]
    for (const key of Object.keys(EMPTY_TEXT)) totals.text[key] += row.text[key]
  }

  // content にあって canon に無い項目（canon のどの existingWorkId からも参照されない work id）
  const referencedIds = new Set(canon.map((c) => c.existingWorkId).filter(Boolean))
  const contentOnly = works
    .filter((w) => w.id && !referencedIds.has(w.id))
    .map((w) => ({ id: w.id, title: w.title, era: w.era }))

  return { perEra, totals, canonOnly, contentOnly }
}

function padEnd(s, n) {
  return String(s).padEnd(n, ' ')
}
function padStart(s, n) {
  return String(s).padStart(n, ' ')
}

/** era 別の表を文字列で返す。 */
export function formatEraTable(report) {
  const lines = []
  const header = ['era', 'visual出題可能', 'visual画像なし', 'visual未収録', 'text収録', 'text未収録']
  lines.push(header.map((h, i) => (i === 0 ? padEnd(h, 24) : padStart(h, 14))).join(' | '))
  lines.push('-'.repeat(24 + 5 * (14 + 3)))
  for (const row of report.perEra) {
    lines.push(
      [
        padEnd(`${row.eraId}（${row.eraName}）`, 24),
        padStart(row.visual.available, 14),
        padStart(row.visual.noImage, 14),
        padStart(row.visual.missing, 14),
        padStart(row.text.included, 14),
        padStart(row.text.missing, 14),
      ].join(' | '),
    )
  }
  lines.push('-'.repeat(24 + 5 * (14 + 3)))
  lines.push(
    [
      padEnd('合計', 24),
      padStart(report.totals.visual.available, 14),
      padStart(report.totals.visual.noImage, 14),
      padStart(report.totals.visual.missing, 14),
      padStart(report.totals.text.included, 14),
      padStart(report.totals.text.missing, 14),
    ].join(' | '),
  )
  return lines.join('\n')
}

/** 1行の要約（validate の末尾に出す用）。 */
export function formatSummaryLine(report) {
  const v = report.totals.visual
  const t = report.totals.text
  const vTotal = v.available + v.noImage + v.missing
  const tTotal = t.included + t.missing
  return `canon ${vTotal + tTotal}件（visual ${vTotal}: 出題可能${v.available}/画像なし${v.noImage}/未収録${v.missing}、text ${tTotal}: 収録${t.included}/未収録${t.missing}） canon-only ${report.canonOnly.length}件 content-only ${report.contentOnly.length}件`
}

/** canon にあって content に無い項目の一覧を文字列で返す（0件でも「0件」と明記する。
 *  [[feedback-lint-must-not-report-clean-when-it-checked-nothing]]: 検査した上での0件と
 *  未検査を区別するため）。 */
export function formatCanonOnlyList(report) {
  if (report.canonOnly.length === 0) {
    return `canon にあって content に無い項目: 0件（全 canon 項目に対応する work がある）`
  }
  const lines = [`canon にあって content に無い項目: ${report.canonOnly.length}件`]
  for (const item of report.canonOnly) {
    lines.push(`  - [${item.era}/${item.type}] ${item.id}: ${item.title}`)
  }
  return lines.join('\n')
}

/** content にあって canon に無い項目（work）の一覧を文字列で返す。 */
export function formatContentOnlyList(report) {
  if (report.contentOnly.length === 0) {
    return `content にあって canon に無い項目: 0件（全 work が canon から参照されている）`
  }
  const lines = [`content にあって canon に無い項目: ${report.contentOnly.length}件`]
  for (const item of report.contentOnly) {
    lines.push(`  - [${item.era}] ${item.id}: ${item.title}`)
  }
  return lines.join('\n')
}

/** ファイルを実際に読んでレポートを組み立てる（main() と validate-content.mjs 両方から使う）。 */
export function loadAndBuildReport() {
  const canon = loadJson(canonPath)
  const eras = loadJson(erasPath)
  const works = loadAllWorks()
  let manifest = { images: [] }
  if (existsSync(manifestPath)) manifest = loadJson(manifestPath)
  return buildCoverageReport({ canon, eras, works, manifest })
}

/** validate-content.mjs の末尾から呼ぶ用の短い要約出力（表 ＋ 1行サマリのみ。
 *  canon-only/content-only の全件列挙は詳細すぎるため出さない。詳細は `npm run coverage`）。
 *  validate 実行を失敗させない（レポートの読み込みに失敗しても warning 止まりにする）ため、
 *  例外を投げず console.warn に留める。 */
export function printCoverageSummary() {
  try {
    const report = loadAndBuildReport()
    console.log('')
    console.log('=== 収録率レポート（詳細は npm run coverage） ===')
    console.log(formatEraTable(report))
    console.log(formatSummaryLine(report))
  } catch (e) {
    console.warn(`収録率レポートの生成に失敗した（${e.message}）`)
  }
}

function main() {
  const report = loadAndBuildReport()
  console.log(formatEraTable(report))
  console.log('')
  console.log(formatSummaryLine(report))
  console.log('')
  console.log(formatCanonOnlyList(report))
  console.log('')
  console.log(formatContentOnlyList(report))
}

// このファイルが `node scripts/coverage.mjs` として直接実行されたときだけ main() を走らせる
// （test-plain-node-script-guard-main の教訓どおり、import しただけでは副作用を起こさない）。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
