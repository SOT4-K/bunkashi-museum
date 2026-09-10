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

/** window の最大件数（時代距離が近い順に切り出す範囲）。q9.ts の nearbyCandidates の窓（6件）に揃える。 */
const CANDIDATE_WINDOW = 6

/**
 * target.artist を正解に、pool 内の他作品が持つ「target とは異なる作者名」を距離順に集め、
 * 近い窓からランダムに3件選ぶ。artist が無い、または異なる作者名が3件に満たない（＝同文化・
 * 隣接文化を含めても誤答が作れない）場合は null。
 */
export function generateQ5Question(target: Work, pool: Work[], eras: Era[], rng: RandomFn): Q5QuestionData | null {
  if (!target.artist) return null
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))
  const targetOrder = eraOrderIndex[target.era] ?? 0

  // 作者名ごとに「target に最も近い時代距離」を記録する（同じ作者が複数作品にまたがる場合、
  // 一番近い作品の距離を代表値にする＝同文化に居ればそちらを優先できる）。
  const distByName = new Map<string, number>()
  for (const w of pool) {
    if (!w.artist || w.artist === target.artist || w.id === target.id) continue
    const dist = Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder)
    const prev = distByName.get(w.artist)
    if (prev === undefined || dist < prev) distByName.set(w.artist, dist)
  }
  const namesByDistance = [...distByName.entries()].sort((a, b) => a[1] - b[1]).map(([name]) => name)
  if (namesByDistance.length < 3) return null

  const window = namesByDistance.slice(0, Math.max(CANDIDATE_WINDOW, 3))
  const distractorArtists = shuffle(window, rng).slice(0, 3)
  if (distractorArtists.length < 3) return null

  return { correctArtist: target.artist, distractorArtists }
}
