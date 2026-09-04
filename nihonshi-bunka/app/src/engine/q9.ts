// Q9「画像4枚が選択肢。条件に合う1枚を選ぶ／合わない1枚を選ぶ」。M2 チケット（テーマセット）新設。
// mock-exam-analysis.md T-C: 条件は作者・時代文化・所蔵・様式のいずれか。この優先順位で試す。
// 正パターン: target が条件に合う（正解）。distractor 3件は同カテゴリ・近い時代から、
//   条件に合わない（値が違う）ものだけを選ぶ。
// 逆パターン（reversed）: 同カテゴリ・近い時代の作品群の中で、target 以外の3件が同じ値を
//   共有する条件を探し、target はそれに当てはまらない（＝「合わない1枚」＝正解）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, Work } from '../types'

export type Q9Slot = 'artist' | 'era' | 'holder' | 'style'

export interface Q9QuestionData {
  reversed: boolean
  slot: Q9Slot
  conditionText: string
  correctWork: Work
  /** 常に3件 */
  distractorWorks: Work[]
}

/** 試す順序。ticket の記載順（作者/時代文化/所蔵/様式）に合わせる。 */
const SLOT_PRIORITY: Q9Slot[] = ['artist', 'era', 'holder', 'style']

function slotValue(work: Work, slot: Q9Slot): string | null {
  switch (slot) {
    case 'artist':
      return work.artist
    case 'era':
      return work.era
    case 'holder':
      return work.holder ?? null
    case 'style':
      return work.style
  }
}

function slotLabel(slot: Q9Slot, value: string, eraName: string): string {
  switch (slot) {
    case 'artist':
      return `作者が${value}`
    case 'era':
      return `${eraName}の作品`
    case 'holder':
      return `${value}が所蔵する作品`
    case 'style':
      return `${value}の様式`
  }
}

function eraOrderIndexOf(eras: Era[]): Record<string, number> {
  return Object.fromEntries(eras.map((e) => [e.id, e.order]))
}

function eraNameOf(eraId: string, eras: Era[]): string {
  return eras.find((e) => e.id === eraId)?.name ?? eraId
}

/** 同カテゴリ・近い時代順に並べた target 以外の作品。 */
function nearbyCandidates(target: Work, pool: Work[], eraOrderIndex: Record<string, number>): Work[] {
  const targetOrder = eraOrderIndex[target.era] ?? 0
  return pool
    .filter((w) => w.id !== target.id && w.category === target.category)
    .map((w) => ({ w, dist: Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder) }))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.w)
}

function generateNormal(target: Work, pool: Work[], eras: Era[], rng: RandomFn): Q9QuestionData | null {
  const eraOrderIndex = eraOrderIndexOf(eras)
  const near = nearbyCandidates(target, pool, eraOrderIndex)
  for (const slot of SLOT_PRIORITY) {
    const value = slotValue(target, slot)
    if (!value) continue
    const candidates = near.filter((w) => slotValue(w, slot) !== value)
    if (candidates.length < 3) continue
    const window = candidates.slice(0, Math.max(candidates.length, 6))
    const distractorWorks = shuffle(window, rng).slice(0, 3)
    if (distractorWorks.length < 3) continue
    return {
      reversed: false,
      slot,
      conditionText: `${slotLabel(slot, value, eraNameOf(target.era, eras))}のもの`,
      correctWork: target,
      distractorWorks,
    }
  }
  return null
}

function generateReversed(target: Work, pool: Work[], eras: Era[], rng: RandomFn): Q9QuestionData | null {
  const eraOrderIndex = eraOrderIndexOf(eras)
  const near = nearbyCandidates(target, pool, eraOrderIndex)
  for (const slot of SLOT_PRIORITY) {
    const targetValue = slotValue(target, slot)
    const groups = new Map<string, Work[]>()
    for (const w of near) {
      const v = slotValue(w, slot)
      if (!v || v === targetValue) continue
      const list = groups.get(v) ?? []
      list.push(w)
      groups.set(v, list)
    }
    const eligible = shuffle(
      [...groups.entries()].filter(([, list]) => list.length >= 3),
      rng,
    )
    if (eligible.length === 0) continue
    const [value, list] = eligible[0]
    const distractorWorks = shuffle(list, rng).slice(0, 3)
    return {
      reversed: true,
      slot,
      conditionText: `${slotLabel(slot, value, eraNameOf(distractorWorks[0].era, eras))}でないもの`,
      correctWork: target,
      distractorWorks,
    }
  }
  return null
}

export function generateQ9Question(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: { reversed?: boolean } = {},
): Q9QuestionData | null {
  return opts.reversed ? generateReversed(target, pool, eras, rng) : generateNormal(target, pool, eras, rng)
}
