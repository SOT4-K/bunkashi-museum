// Q14「年代順並べ替え」（T7。mock-exam-analysis.md 2・5章「仏像3枚を制作順」。M2-16）。
// work.orderIndex（制作年代順。小さいほど古い）を持つ作品から count 件（既定3件）を選び、
// 表示順をシャッフルしたうえで「正しい制作順」を4択（順序の並びの文字列）で問う。
// orderIndex は writer が M2-17 で投入中のフィールドのため、無い/同じ区分に count 件そろわない
// ときは null を返す（呼び出し側 themeSet.ts の appendOrderQuestionIfDue が何もしない＝
// 既存のセットをそのまま返す。壊れない設計）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { StatementOption, Work } from '../types'

export interface OrderDisplayItem {
  label: string
  work: Work
}

export interface OrderQuestionData {
  /** 画像を表示する順（時系列とは無関係。シャッフル済み）とラベル（A/B/C…）。 */
  displayItems: OrderDisplayItem[]
  /** 4択（シャッフル済み）。text は「A → B → C」のような順序の並び。 */
  choices: StatementOption[]
  correctIndex: number
}

const LABELS = ['A', 'B', 'C', 'D', 'E']

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}

/**
 * pool から orderIndex を持つ作品を count 件選び、正しい制作順を問う4択を作る。
 * orderIndex が重複する作品は「どちらが先か一意に決まらない」ため、区分（orderIndex の値）
 * ごとに1件だけを候補にする。区分が count 件に満たなければ null。
 */
export function generateOrderQuestion(pool: Work[], rng: RandomFn, count = 3): OrderQuestionData | null {
  const byOrder = new Map<number, Work[]>()
  for (const w of pool) {
    if (typeof w.orderIndex !== 'number') continue
    const list = byOrder.get(w.orderIndex) ?? []
    list.push(w)
    byOrder.set(w.orderIndex, list)
  }
  const distinctOrders = shuffle([...byOrder.keys()], rng)
  if (distinctOrders.length < count) return null

  const chosenOrders = distinctOrders.slice(0, count).sort((a, b) => a - b)
  const chronological = chosenOrders.map((o) => {
    const candidates = byOrder.get(o)!
    return candidates[Math.floor(rng() * candidates.length)]
  })

  const displayWorks = shuffle(chronological, rng)
  const labels = LABELS.slice(0, count)
  const displayItems: OrderDisplayItem[] = displayWorks.map((work, i) => ({ label: labels[i], work }))
  const labelByWorkId = new Map(displayItems.map((d) => [d.work.id, d.label]))
  const correctText = chronological.map((w) => labelByWorkId.get(w.id)!).join(' → ')

  const allPerms = permutations(labels).map((p) => p.join(' → '))
  const wrongPerms = shuffle(
    allPerms.filter((p) => p !== correctText),
    rng,
  ).slice(0, 3)
  if (wrongPerms.length < 3) return null

  const options: StatementOption[] = shuffle(
    [
      { text: correctText, correct: true, why: null },
      ...wrongPerms.map((text) => ({ text, correct: false, why: null })),
    ],
    rng,
  )
  const correctIndex = options.findIndex((o) => o.correct)

  return { displayItems, choices: options, correctIndex }
}
