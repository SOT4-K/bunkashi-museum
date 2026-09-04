// 重み付きサンプリング。DESIGN.md 10章 / decisions.md 2026-09-04「範囲を縄文から化政までに拡張」:
//  eras.json の weight（省略時1）を自由出題（新規候補選定）・時代ボスの出題頻度に反映する。
//  原始（genshi）は weight 0.5 で他の約半分の頻度になる。
import type { RandomFn } from './distractors'
import type { Era } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** eras.json の weight を引く。無い/0以下なら1として扱う（DESIGN.md 10章5項の既定値）。 */
export function eraWeight(eraId: string, eras: Era[]): number {
  const era = eras.find((e) => e.id === eraId)
  const w = era?.weight
  return typeof w === 'number' && w > 0 ? w : 1
}

/**
 * 重み付き非復元抽出。weightOf が 0 以下を返す要素も、他候補が尽きたときのために
 * 極小の重みで拾えるようにする（0件になることを避ける）。count が items.length 以上なら
 * 全件をシャッフルして返す。
 */
export function weightedSampleWithoutReplacement<T>(
  items: T[],
  weightOf: (item: T) => number,
  count: number,
  rng: RandomFn = defaultRandom,
): T[] {
  if (count <= 0 || items.length === 0) return []
  const pool = items.map((item) => ({ item, w: Math.max(weightOf(item), 0.0001) }))
  const chosen: T[] = []
  while (chosen.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.w, 0)
    let r = rng() * total
    let idx = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].w
      if (r <= 0) {
        idx = i
        break
      }
    }
    chosen.push(pool[idx].item)
    pool.splice(idx, 1)
  }
  return chosen
}
