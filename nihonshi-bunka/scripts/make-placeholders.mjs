#!/usr/bin/env node
// content/works/*.json の各作品に対して、実画像が無いときのフォールバックとなる
// プレースホルダ SVG（3:4、作品名＋種別を表示、種別ごとに色分け）を app/public/img/<id>.svg に生成する。
// 実行: node scripts/make-placeholders.mjs

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const outDir = join(root, 'app', 'public', 'img')

/** @type {Record<string, {bg: string, fg: string, label: string}>} */
const CATEGORY_STYLE = {
  architecture: { bg: '#5b7a63', fg: '#f1f6ef', label: '建築' },
  sculpture: { bg: '#8a5a3c', fg: '#f8efe6', label: '彫刻' },
  painting: { bg: '#3c5a8a', fg: '#eaf1fb', label: '絵画' },
  craft: { bg: '#8a3c6f', fg: '#f8e6f2', label: '工芸' },
  calligraphy: { bg: '#3c3c3c', fg: '#f2f2f2', label: '書' },
  garden: { bg: '#3c8a5f', fg: '#eafbf1', label: '庭園' },
  other: { bg: '#6b6b6b', fg: '#f2f2f2', label: 'その他' },
}

function escapeXml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** 長いタイトルを複数行に折り返す（簡易・文字数ベース） */
function wrapTitle(title, maxCharsPerLine = 7) {
  const lines = []
  for (let i = 0; i < title.length; i += maxCharsPerLine) {
    lines.push(title.slice(i, i + maxCharsPerLine))
  }
  return lines.slice(0, 3) // 最大3行
}

function makeSvg(work) {
  const style = CATEGORY_STYLE[work.category] ?? CATEGORY_STYLE.other
  const width = 300
  const height = 400
  const lines = wrapTitle(work.title)
  const lineHeight = 34
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2

  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="${width / 2}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(work.title)}">
  <rect width="${width}" height="${height}" fill="${style.bg}"/>
  <rect x="8" y="8" width="${width - 16}" height="${height - 16}" fill="none" stroke="${style.fg}" stroke-opacity="0.35" stroke-width="2"/>
  <text font-family="'Hiragino Sans','Yu Gothic',sans-serif" font-size="28" font-weight="700" fill="${style.fg}" text-anchor="middle">${titleTspans}</text>
  <text x="${width / 2}" y="${height - 28}" font-family="'Hiragino Sans','Yu Gothic',sans-serif" font-size="18" fill="${style.fg}" fill-opacity="0.85" text-anchor="middle">${escapeXml(style.label)}</text>
</svg>
`
}

function main() {
  mkdirSync(outDir, { recursive: true })
  const files = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  let count = 0
  for (const file of files) {
    const works = JSON.parse(readFileSync(join(worksDir, file), 'utf-8'))
    for (const work of works) {
      const svg = makeSvg(work)
      writeFileSync(join(outDir, `${work.id}.svg`), svg, 'utf-8')
      count++
    }
  }
  console.log(`generated ${count} placeholder svg(s) in ${outDir}`)
}

main()
