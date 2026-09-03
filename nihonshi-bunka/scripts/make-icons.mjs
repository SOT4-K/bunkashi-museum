#!/usr/bin/env node
// app/public/icon.svg から PWA 用の PNG アイコンを書き出す。
// iOS の apple-touch-icon は SVG を受け付けないため、home screen アイコンには
// PNG が必須（実機 https://sot4-k.github.io/bunkashi-museum/ で確認された不備の修正）。
// 出力先 app/public/icons/ は生成物なので work/.gitignore で除外している。
//
// 実行: node scripts/make-icons.mjs

import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'app', 'public')
const svgPath = join(publicDir, 'icon.svg')
const outDir = join(publicDir, 'icons')

// icon.svg の背景（rect fill）と同じ墨色。maskable のパディング背景に使う。
const BG = '#15171c'

async function renderIcon(svgBuffer, size, outName) {
  await sharp(svgBuffer).resize(size, size).png().toFile(join(outDir, outName))
}

/**
 * maskable アイコンは OS 側で丸や角丸にトリミングされるため、内容を
 * 「安全域」（中央 80%）に収めて周囲をアイコン背景色でパディングする。
 */
async function renderMaskable(svgBuffer, size, outName) {
  const safe = Math.round(size * 0.8)
  const pad = Math.floor((size - safe) / 2)
  const inner = await sharp(svgBuffer).resize(safe, safe).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: inner, left: pad, top: pad }])
    .png()
    .toFile(join(outDir, outName))
}

async function main() {
  mkdirSync(outDir, { recursive: true })
  const svgBuffer = readFileSync(svgPath)
  await renderIcon(svgBuffer, 180, 'apple-touch-icon.png')
  await renderIcon(svgBuffer, 192, 'icon-192.png')
  await renderIcon(svgBuffer, 512, 'icon-512.png')
  await renderMaskable(svgBuffer, 512, 'icon-512-maskable.png')
  console.log(`generated PWA icons (180/192/512/512-maskable) in ${outDir}`)
}

main()
