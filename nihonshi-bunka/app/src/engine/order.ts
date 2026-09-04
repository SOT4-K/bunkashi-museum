// Q14「年代順並べ替え」（T7。mock-exam-analysis.md 2・5章「仏像3枚を制作順」。M2-16）。
// work.orderIndex（制作年代順。小さいほど古い）を持つ作品から count 件（既定3件）を選び、
// 表示順をシャッフルしたうえで「正しい制作順」を4択（順序の並びの文字列）で問う。
// orderIndex は writer が M2-17 で投入中のフィールドのため、無い/同じ区分に count 件そろわない
// ときは null を返す（呼び出し側 themeSet.ts の appendOrderQuestionIfDue が何もしない＝
// 既存のセットをそのまま返す。壊れない設計）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, StatementOption, Work } from '../types'

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
 *
 * Hayato 修正（2026-09-04、波1統合時）: orderIndex の尺度が writer 群ごとに不統一
 * （genshi/asuka/hakuho/konin-jogan/kokufu/tenpyo は区分内の相対値 10〜70、他の区分は
 * 西暦年 1150〜1857）と判明。orderIndex 単独で全区分横断ソートすると、同じ相対値レンジを
 * 使う区分どうし（例: asuka=50 と tenpyo=20）で年代が逆転しうる（実際には asuka が先）。
 * eras.json の order（15区分の正しい配列順）を第一キー、orderIndex を区分内の第二キーに
 * した合成キーでソートすることで、区分をまたいでも実際の時代順を保つ。eras が渡されない
 * 場合は旧来どおり orderIndex のみで比較する（テストの後方互換用）。
 */
export function generateOrderQuestion(
  pool: Work[],
  rng: RandomFn,
  count = 3,
  eras: Era[] = [],
): OrderQuestionData | null {
  const eraOrderById = new Map(eras.map((e) => [e.id, e.order]))
  function sortKey(w: Work): number {
    const eraOrder = eraOrderById.get(w.era) ?? 0
    return eraOrder * 1_000_000 + w.orderIndex!
  }

  const byOrder = new Map<number, Work[]>()
  for (const w of pool) {
    if (typeof w.orderIndex !== 'number') continue
    const key = sortKey(w)
    const list = byOrder.get(key) ?? []
    list.push(w)
    byOrder.set(key, list)
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
