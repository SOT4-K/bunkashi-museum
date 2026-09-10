// Q7「画像→出土地・所在地」（M2i ★3「出土地・所在地」。BOARD.md M2i-05③、decisions.md
// 2026-09-11「★3にQ7を新設」）。engine/q5.ts（画像→作者）と対称の構造で実装する。
// 対象は work.findSite を持つ、または（holderKind==='site' かつ location を持ち所蔵語を含まない）
// 作品のみ（engine/stages.ts の hasStar ★3判定・engine/q9.ts の findSite/location スロットと
// 同じ判定基準。findSite を優先する）。誤答は「同文化→足りなければ隣接文化の実在の出土地・
// 所在地から選ぶ」（q5.ts と同じ時代距離ソート方式）。博物館は使わない（M2b-14の決定どおり、
// containsMuseumWord で弾く）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, Work } from '../types'
import { containsMuseumWord } from './q9'

export interface Q7QuestionData {
  correctLocation: string
  /** 常に3件 */
  distractorLocations: string[]
}

/** window の最大件数（q5.ts の CANDIDATE_WINDOW と同じ考え方）。 */
const CANDIDATE_WINDOW = 6

/** work が★3（出土地・所在地）の値を持つならその値を返す（engine/stages.ts の hasStar ★3判定と
 *  同じ優先順位: findSite があればそれを使い、無ければ holderKind==='site' の location を使う。
 *  博物館収蔵品の所在地は使わない）。 */
export function q7LocationValue(work: Work): string | null {
  if (work.findSite) return work.findSite
  if (work.holderKind === 'site' && work.location && !containsMuseumWord(work.location)) return work.location
  return null
}

/**
 * target の出土地・所在地を正解に、pool 内の他作品が持つ「target とは異なる出土地・所在地」を
 * 時代距離順に集め、近い窓からランダムに3件選ぶ。対象自身が値を持たない、または異なる値が
 * 3件に満たない（＝同文化・隣接文化を含めても誤答が作れない）場合は null。
 */
export function generateQ7Question(target: Work, pool: Work[], eras: Era[], rng: RandomFn): Q7QuestionData | null {
  const correctLocation = q7LocationValue(target)
  if (!correctLocation) return null
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))
  const targetOrder = eraOrderIndex[target.era] ?? 0

  // 出土地・所在地の値ごとに「target に最も近い時代距離」を記録する（同じ値を複数作品が
  // 共有する場合、一番近い作品の距離を代表値にする）。
  const distByValue = new Map<string, number>()
  for (const w of pool) {
    if (w.id === target.id) continue
    const value = q7LocationValue(w)
    if (!value || value === correctLocation) continue
    const dist = Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder)
    const prev = distByValue.get(value)
    if (prev === undefined || dist < prev) distByValue.set(value, dist)
  }
  const valuesByDistance = [...distByValue.entries()].sort((a, b) => a[1] - b[1]).map(([v]) => v)
  if (valuesByDistance.length < 3) return null

  const window = valuesByDistance.slice(0, Math.max(CANDIDATE_WINDOW, 3))
  const distractorLocations = shuffle(window, rng).slice(0, 3)
  if (distractorLocations.length < 3) return null

  return { correctLocation, distractorLocations }
}
