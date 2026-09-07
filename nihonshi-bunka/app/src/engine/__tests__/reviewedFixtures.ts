// 本番ビルド相当（status: reviewed のみ、DEV フラグに依存しない）の content/ を組み立てる。
// builder メモ「import.meta.env.DEV は vitest 実行中も true」: content.ts をそのまま import
// すると `npx vitest run` 中は draft も混在してしまう（shouldIncludeDraft() が DEV=true を返す）。
// M2b-01 の受け入れ条件①「reviewed限定プール（DEV変数なし）で生成できる」を実データで確かめる
// には、Vite を経由せず content/*.json を直接 fs で読み、content.ts と同じフィルタ規則
// （status/kind/hasRealImage/passage publishable）を独立に再実装するのが最も確実
// （scripts/validate-content.mjs も同じ理由でロジックを独立実装している）。
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Era, Passage, Work } from '../../types'

const here = dirname(fileURLToPath(import.meta.url))
// __tests__ → engine → src → app → nihonshi-bunka
const contentDir = join(here, '..', '..', '..', '..', 'content')
const realImagesPath = join(here, '..', '..', 'generated', 'real-images.json')

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T
}

function readAllJsonInDir<T>(dir: string): T[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => readJson<T[]>(join(dir, f)))
}

export const reviewedEras: Era[] = [...readJson<Era[]>(join(contentDir, 'eras.json'))].sort((a, b) => a.order - b.order)

const allWorks = readAllJsonInDir<Work>(join(contentDir, 'works'))
export const reviewedWorks: Work[] = allWorks.filter((w) => w.status === 'reviewed')

const realImageMap: Record<string, string> = readJson(realImagesPath)
function hasRealImage(work: Work): boolean {
  return Boolean(realImageMap[work.id])
}

// content.ts の playableWorks / themeSetPool と同じ規則。
export const reviewedPlayableWorks: Work[] = reviewedWorks.filter(
  (w) => hasRealImage(w) && (w.kind ?? 'artifact') === 'artifact',
)
export const reviewedThemeSetPool: Work[] = reviewedWorks.filter((w) => {
  const kind = w.kind ?? 'artifact'
  return kind === 'artifact' ? hasRealImage(w) : true
})

const playableIds = new Set(reviewedPlayableWorks.map((w) => w.id))
const themeSetPoolIds = new Set(reviewedThemeSetPool.map((w) => w.id))

const allPassages = readAllJsonInDir<Passage>(join(contentDir, 'passages'))

// content.ts の isPassagePublishable と同じ規則（DEV バイパス無し版）。
function isPublishable(passage: Passage): boolean {
  if ((passage.status ?? 'reviewed') !== 'reviewed') return false
  if (passage.kind === 'image' && !(passage.leadWorkIds ?? []).some((id) => playableIds.has(id))) return false
  return passage.underlines.every((u) => {
    if (!u.workIds || u.workIds.length === 0) return true
    return u.workIds.some((id) => themeSetPoolIds.has(id))
  })
}

export const reviewedPassages: Passage[] = allPassages.filter(isPublishable)
