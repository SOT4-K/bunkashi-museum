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

export interface Q7GenerateOptions {
  /** M2i-05b②（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-2「Q7が計測対象から
   *  除外されたまま同ワールド優先ロジックを持たず、ヘッダー解答可能率23.9%のまま残っている」の
   *  修正）: true のとき、target と同era（＝ワールド）の値が4件以上あればそれだけを誤答候補にし、
   *  未満なら同era分＋足りない分だけ近い時代から補う（q9.ts の preferSameEra・
   *  SAME_ERA_EXCLUSIVE_MIN と同じ考え方）。engine/stages.ts のステージ生成だけが渡す
   *  （自由出題・模試・ボスはq7を使わないため対象外）。 */
  preferSameEra?: boolean
}

/** window の最大件数（q5.ts の CANDIDATE_WINDOW と同じ考え方）。 */
const CANDIDATE_WINDOW = 6

/** 同era（＝ワールド）の値が4件以上あれば全て同eraから、未満なら同eraぶん＋足りない分だけ
 *  近い時代から補う（q9.ts の SAME_ERA_EXCLUSIVE_MIN と同じ値、同じ考え方）。 */
const SAME_ERA_EXCLUSIVE_MIN = 4

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
export function generateQ7Question(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Q7GenerateOptions = {},
): Q7QuestionData | null {
  const correctLocation = q7LocationValue(target)
  if (!correctLocation) return null
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))
  const targetOrder = eraOrderIndex[target.era] ?? 0

  // 出土地・所在地の値ごとに「target に最も近い時代距離」を記録する（同じ値を複数作品が
  // 共有する場合、一番近い作品の距離を代表値にする）。距離0＝同era（＝ワールド）に少なくとも
  // 1件はその値を持つ作品がある、という意味になる（preferSameEra で使う）。
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

  let window: string[]
  if (opts.preferSameEra) {
    const sameEraValues = valuesByDistance.filter((v) => distByValue.get(v) === 0)
    if (sameEraValues.length >= SAME_ERA_EXCLUSIVE_MIN) {
      window = sameEraValues
    } else {
      const adjacent = valuesByDistance.filter((v) => distByValue.get(v)! > 0)
      const needed = Math.max(3 - sameEraValues.length, 0)
      window = [...sameEraValues, ...adjacent.slice(0, needed)]
    }
  } else {
    window = valuesByDistance.slice(0, Math.max(CANDIDATE_WINDOW, 3))
  }
  if (window.length < 3) return null
  const distractorLocations = shuffle(window, rng).slice(0, 3)
  if (distractorLocations.length < 3) return null

  return { correctLocation, distractorLocations }
}
