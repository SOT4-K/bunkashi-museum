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

export interface PickWorkDistractorsOptions {
  /** M2i-05b③（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-1「q1/q3のヘッダー
   *  解答可能率が19.8%/19.9%で未改善」の修正）: true のとき、step 2（同カテゴリ・近い時代）を
   *  「target と同era（＝ワールド、カテゴリ不問）の候補が4件以上あればそれだけ、未満なら同era分
   *  ＋足りない分だけ同カテゴリの他eraから補う」に置き換える（q9.ts の preferSameEra・
   *  SAME_ERA_EXCLUSIVE_MIN と同じ考え方。同カテゴリに限定すると母数が減って同era候補が
   *  見つからないことがあるため、同era側はカテゴリを問わずに広く集める）。engine/stages.ts の
   *  ステージ生成（q1/q3）だけが渡す。step 3・4（同era・別カテゴリ／全体ランダム）は
   *  preferSameEra でも変えない（不足時のフォールバックとして従来どおり使う）。 */
  preferSameEra?: boolean
}

/** 同era（＝ワールド）の候補が4件以上あれば全て同eraから、未満なら同eraぶん＋足りない分だけ
 *  同カテゴリの他eraから補う（q9.ts の SAME_ERA_EXCLUSIVE_MIN と同じ値、同じ考え方）。 */
const SAME_ERA_EXCLUSIVE_MIN = 4

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
  opts: PickWorkDistractorsOptions = {},
): Work[] {
  const chosen: Work[] = []
  const chosenIds = new Set<string>([target.id])
  const poolById = new Map(pool.map((w) => [w.id, w]))
  const targetOrder = eraOrderIndex[target.era] ?? 0

  // 1. confusables を優先（登録順だがランダム性を持たせるためシャッフル）
  const confusableCandidates = shuffle(target.confusables, rng)
    .map((c) => poolById.get(c.id))
    .filter((w): w is Work => w !== undefined && !chosenIds.has(w.id))
  for (const w of confusableCandidates) {
    if (chosen.length >= count) break
    chosen.push(w)
    chosenIds.add(w.id)
  }

  // 2. preferSameEra: 同era（ワールド）優先。既定: 同カテゴリ・近い時代からランダム
  if (chosen.length < count) {
    const categoryNear = pool
      .filter((w) => w.category === target.category && !chosenIds.has(w.id))
      .map((w) => ({ w, dist: Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder) }))
      .sort((a, b) => a.dist - b.dist)
      .map((x) => x.w)

    let remaining: Work[]
    if (opts.preferSameEra) {
      const sameEraAny = pool.filter((w) => w.era === target.era && !chosenIds.has(w.id))
      if (sameEraAny.length >= SAME_ERA_EXCLUSIVE_MIN) {
        remaining = sameEraAny
      } else {
        const adjacent = categoryNear.filter((w) => w.era !== target.era)
        remaining = [...sameEraAny, ...adjacent]
      }
    } else {
      remaining = categoryNear
    }

    // 距離が近い順の上位グループ（同率含む）からランダムに選ぶ
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
