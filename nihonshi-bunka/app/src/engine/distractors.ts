// 出題の選択肢（ディストラクタ）生成。DESIGN.md 3章のルール:
//  1. confusables を最優先
//  2. 残りは同じカテゴリ・近い時代からランダム
//  3. それでも足りなければ同じ時代・別カテゴリからランダム
//  4. それでも足りなければ全体からランダム
// 重複なし・シャッフル・正解位置の偏りなし。純関数（乱数源は注入可能でテストしやすくする）。
//
// 3番目のステップ（同時代・別カテゴリ）が無いと、category: other のように
// 母数が少ないカテゴリ（実データで3件）は同カテゴリだけでは埋まらず、いきなり
// 全体ランダムに落ちて時代の近さを失っていた（reviewer 指摘）。

import type { Era, Work } from '../types'

export type RandomFn = () => number

const defaultRandom: RandomFn = () => Math.random()

/** Fisher-Yates シャッフル。破壊しない。 */
export function shuffle<T>(items: T[], rng: RandomFn = defaultRandom): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** rng() を使って配列から1件をランダムに取り除いて返す。空なら undefined。 */
function pickRandom<T>(items: T[], rng: RandomFn): T | undefined {
  if (items.length === 0) return undefined
  const idx = Math.floor(rng() * items.length)
  return items[idx]
}

/**
 * 対象作品に対する 3 件のディストラクタ（不正解の作品）を選ぶ。
 * pool には対象作品自身が含まれていてもよい（除外する）。
 */
export function pickWorkDistractors(
  target: Work,
  pool: Work[],
  eraOrderIndex: Record<string, number>,
  count = 3,
  rng: RandomFn = defaultRandom,
): Work[] {
  const chosen: Work[] = []
  const chosenIds = new Set<string>([target.id])
  const poolById = new Map(pool.map((w) => [w.id, w]))

  // 1. confusables を優先（登録順だがランダム性を持たせるためシャッフル）
  const confusableCandidates = shuffle(target.confusables, rng)
    .map((c) => poolById.get(c.id))
    .filter((w): w is Work => w !== undefined && !chosenIds.has(w.id))
  for (const w of confusableCandidates) {
    if (chosen.length >= count) break
    chosen.push(w)
    chosenIds.add(w.id)
  }

  // 2. 同カテゴリ・近い時代からランダム
  if (chosen.length < count) {
    const targetOrder = eraOrderIndex[target.era] ?? 0
    const sameCategory = pool
      .filter((w) => w.category === target.category && !chosenIds.has(w.id))
      .map((w) => ({ w, dist: Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder) }))
      .sort((a, b) => a.dist - b.dist)

    // 距離が近い順の上位グループ（同率含む）からランダムに選ぶ
    const remaining = sameCategory.map((x) => x.w)
    while (chosen.length < count && remaining.length > 0) {
      // 上位 4 件程度のプールからランダムに1件選ぶ（近い時代を優先しつつランダム性を保つ）
      const topWindow = remaining.slice(0, Math.max(4, count))
      const picked = pickRandom(topWindow, rng)
      if (!picked) break
      chosen.push(picked)
      chosenIds.add(picked.id)
      const idx = remaining.findIndex((w) => w.id === picked.id)
      if (idx >= 0) remaining.splice(idx, 1)
    }
  }

  // 3. 同じ時代・別カテゴリからランダム（同カテゴリの候補が尽きたとき、
  //    全体ランダムに落ちる前に時代の近さだけは保つ）
  if (chosen.length < count) {
    let sameEraPool = pool.filter((w) => w.era === target.era && !chosenIds.has(w.id))
    while (chosen.length < count && sameEraPool.length > 0) {
      const picked = pickRandom(sameEraPool, rng)
      if (!picked) break
      chosen.push(picked)
      chosenIds.add(picked.id)
      sameEraPool = sameEraPool.filter((w) => w.id !== picked.id)
    }
  }

  // 4. 残りは全体からランダム
  if (chosen.length < count) {
    let restPool = pool.filter((w) => !chosenIds.has(w.id))
    while (chosen.length < count && restPool.length > 0) {
      const picked = pickRandom(restPool, rng)
      if (!picked) break
      chosen.push(picked)
      chosenIds.add(picked.id)
      restPool = restPool.filter((w) => w.id !== picked.id)
    }
  }

  return chosen.slice(0, count)
}

/** Q2（画像→文化）用の文化（時代）ディストラクタ。正解以外からランダムに count 件。 */
export function pickEraDistractors(
  targetEra: Era,
  allEras: Era[],
  count = 3,
  rng: RandomFn = defaultRandom,
): Era[] {
  const others = allEras.filter((e) => e.id !== targetEra.id)
  return shuffle(others, rng).slice(0, count)
}

export interface ShuffledChoices<T> {
  items: T[]
  correctIndex: number
}

/** correctItem を含む distractors をシャッフルし、正解の位置を返す。 */
export function buildChoices<T>(
  correctItem: T,
  distractors: T[],
  rng: RandomFn = defaultRandom,
): ShuffledChoices<T> {
  const shuffled = shuffle([correctItem, ...distractors], rng)
  const correctIndex = shuffled.indexOf(correctItem)
  return { items: shuffled, correctIndex }
}
