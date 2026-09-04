// Q13「語句の組合せ」（T1。mock-exam-analysis.md 2・5章。M2-16）。
// 人物×技法・書物×作者・様式×建築・原料×産地などの正しい組を1つ選ぶ4択。
// work.pairs（{left, right, kind}。フィールド名は M2-17 writer の実データに合わせてある）を
// 素材にする。combos.ts（Q8: artist×style の組合せ文）と考え方は同じだが、pairs は writer が
// 明示的に書いた「意味のある組」なので slot 名を持たない汎用フィールドにしてある
// （無い/少ない作品では null を返し、themeSet.ts が次善の型にフォールバックする。壊れない設計）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { ComboOption, Work, WorkPair } from '../types'

export interface PairQuestionData {
  /** 「答え」となる選択肢。reversed のときは誤った組合せ（answer）がここに入る
   *  （フィールド名は「答えの選択肢」の意味で、組合せの真偽自体とは別。statements.ts と同じ規約）。 */
  correct: ComboOption
  /** 常に3件 */
  distractors: ComboOption[]
  /** true なら「誤っている組合せはどれか」（正しい組合せ3件＋偽の組合せ1件、偽の組合せが正解）。 */
  reversed: boolean
}

interface Candidate {
  left: string
  right: string
}

function pairText(left: string, right: string): string {
  return `${left}・${right}`
}

function toCandidate(p: WorkPair): Candidate {
  return { left: p.left, right: p.right }
}

/** pool 全体（target 含む）の中に、この left/right の組が実在するか（偽の組が偶然に真実になっていないか）。 */
function isRealCombo(pool: Work[], left: string, right: string): boolean {
  return pool.some((w) => (w.pairs ?? []).some((p) => p.left === left && p.right === right))
}

/** target 以外の作品が持つ pairs（重複除去）。 */
function otherPairsOf(target: Work, pool: Work[]): Candidate[] {
  const seen = new Set<string>()
  const out: Candidate[] = []
  for (const w of pool) {
    if (w.id === target.id) continue
    for (const p of w.pairs ?? []) {
      const key = `${p.left} ${p.right}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(toCandidate(p))
    }
  }
  return out
}

/**
 * target.pairs から1件（ランダム）を選び、片方の値だけを他作品の値に差し替えた「偽の組」を
 * 作る（combos.ts の swap 戦略と同じ）。安全確認（isRealCombo）で偶然に真実の組と一致する
 * 候補は除外する。
 */
function buildFakeCandidates(chosen: Candidate, target: Work, pool: Work[], rng: RandomFn): Candidate[] {
  const others = otherPairsOf(target, pool)
  const rightValues = Array.from(new Set(others.map((p) => p.right))).filter((r) => r !== chosen.right)
  const leftValues = Array.from(new Set(others.map((p) => p.left))).filter((l) => l !== chosen.left)

  const swapRight: Candidate[] = rightValues.map((right) => ({ left: chosen.left, right }))
  const swapLeft: Candidate[] = leftValues.map((left) => ({ left, right: chosen.right }))

  const seen = new Set<string>()
  function dedupeSafe(list: Candidate[]): Candidate[] {
    const out: Candidate[] = []
    for (const c of list) {
      const key = `${c.left} ${c.right}`
      if (seen.has(key)) continue
      seen.add(key)
      // reviewer指摘（2026-09-04 波1事実検証・群A [中4]）: leftとrightが同じ語になる
      // 「法隆寺金堂釈迦三尊像・法隆寺金堂釈迦三尊像」のような自明に破綻した誤答を防ぐ
      if (c.left === c.right) continue
      if (isRealCombo(pool, c.left, c.right)) continue
      out.push(c)
    }
    return out
  }

  const s1 = dedupeSafe(shuffle(swapRight, rng))
  const s2 = dedupeSafe(shuffle(swapLeft, rng))
  const interleaved: Candidate[] = []
  for (let i = 0; i < Math.max(s1.length, s2.length); i++) {
    if (s1[i]) interleaved.push(s1[i])
    if (s2[i]) interleaved.push(s2[i])
  }
  return interleaved
}

export function generatePairQuestion(
  target: Work,
  pool: Work[],
  rng: RandomFn,
  opts: { reversed?: boolean } = {},
): PairQuestionData | null {
  const targetPairs = target.pairs ?? []
  if (targetPairs.length === 0) return null
  const chosen = toCandidate(targetPairs[Math.floor(rng() * targetPairs.length)])

  const fakeCandidates = buildFakeCandidates(chosen, target, pool, rng)

  if (opts.reversed) {
    // 「誤っている組合せはどれか」: 偽の組合せ1件を答え（correct フィールド）に、
    // 他作品の実在する組合せ3件を distractors（正しい組合せ）にする。
    const fake = fakeCandidates[0]
    if (!fake) return null
    const realOthers = shuffle(otherPairsOf(target, pool), rng).slice(0, 3)
    if (realOthers.length < 3) return null
    return {
      correct: { text: pairText(fake.left, fake.right), correct: true },
      distractors: realOthers.map((p) => ({ text: pairText(p.left, p.right), correct: false })),
      reversed: true,
    }
  }

  if (fakeCandidates.length < 3) return null
  return {
    correct: { text: pairText(chosen.left, chosen.right), correct: true },
    distractors: fakeCandidates.slice(0, 3).map((c) => ({ text: pairText(c.left, c.right), correct: false })),
    reversed: false,
  }
}
