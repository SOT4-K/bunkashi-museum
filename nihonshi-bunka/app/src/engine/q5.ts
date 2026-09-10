// Q5「画像→作者」（M2i ★2「作者」。BOARD.md M2i-01②）。work.artist を持つ作品だけが対象。
// 誤答は「同文化→足りなければ隣接文化の実在の作者から選ぶ（同名回避）」（チケット文面どおり）。
// q9.ts の nearbyCandidates と同じ考え方（era の距離が近い順の窓からランダムに選ぶ）だが、
// ここでは作品ではなく「作者名（文字列）」を候補にする（同じ作者が複数作品を持つことがあるため、
// 作者名で重複除去してから距離でソートする）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, Work } from '../types'

export interface Q5QuestionData {
  correctArtist: string
  /** 常に3件 */
  distractorArtists: string[]
}

export interface Q5GenerateOptions {
  /** M2i-05b③（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-1「q1/q3/q5のヘッダー
   *  解答可能率が未改善」の修正）: true のとき、target と同era（＝ワールド）の作者名が4件以上
   *  あればそれだけを誤答候補にし、未満なら同era分＋足りない分だけ近い時代から補う
   *  （q9.ts の preferSameEra・SAME_ERA_EXCLUSIVE_MIN と同じ考え方）。engine/stages.ts の
   *  ステージ生成だけが渡す（自由出題はq5を使わないため対象外）。 */
  preferSameEra?: boolean
}

/** window の最大件数（時代距離が近い順に切り出す範囲）。q9.ts の nearbyCandidates の窓（6件）に揃える。 */
const CANDIDATE_WINDOW = 6

/** 同era（＝ワールド）の作者名が4件以上あれば全て同eraから、未満なら同eraぶん＋足りない分だけ
 *  近い時代から補う（q9.ts の SAME_ERA_EXCLUSIVE_MIN と同じ値、同じ考え方）。 */
const SAME_ERA_EXCLUSIVE_MIN = 4

/**
 * target.artist を正解に、pool 内の他作品が持つ「target とは異なる作者名」を距離順に集め、
 * 近い窓からランダムに3件選ぶ（preferSameEra 指定時は同era優先、engine/q9.ts と同じ考え方）。
 * artist が無い、または異なる作者名が3件に満たない（＝同文化・隣接文化を含めても誤答が
 * 作れない）場合は null。
 */
export function generateQ5Question(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Q5GenerateOptions = {},
): Q5QuestionData | null {
  if (!target.artist) return null
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))
  const targetOrder = eraOrderIndex[target.era] ?? 0

  // 作者名ごとに「target に最も近い時代距離」を記録する（同じ作者が複数作品にまたがる場合、
  // 一番近い作品の距離を代表値にする＝同文化に居ればそちらを優先できる）。距離0＝同era
  // （＝ワールド）に少なくとも1件はその作者名の作品がある、という意味になる（preferSameEraで使う）。
  const distByName = new Map<string, number>()
  for (const w of pool) {
    if (!w.artist || w.artist === target.artist || w.id === target.id) continue
    const dist = Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder)
    const prev = distByName.get(w.artist)
    if (prev === undefined || dist < prev) distByName.set(w.artist, dist)
  }
  const namesByDistance = [...distByName.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)
  if (namesByDistance.length < 3) return null

  let window: string[]
  if (opts.preferSameEra) {
    const sameEraNames = namesByDistance.filter((n) => distByName.get(n) === 0)
    if (sameEraNames.length >= SAME_ERA_EXCLUSIVE_MIN) {
      window = sameEraNames
    } else {
      const adjacent = namesByDistance.filter((n) => distByName.get(n)! > 0)
      const needed = Math.max(3 - sameEraNames.length, 0)
      window = [...sameEraNames, ...adjacent.slice(0, needed)]
    }
  } else {
    window = namesByDistance.slice(0, Math.max(CANDIDATE_WINDOW, 3))
  }
  if (window.length < 3) return null
  const distractorArtists = shuffle(window, rng).slice(0, 3)
  if (distractorArtists.length < 3) return null

  return { correctArtist: target.artist, distractorArtists }
}
