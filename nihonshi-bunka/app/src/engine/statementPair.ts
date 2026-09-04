// Q10「2文（A・B）の正誤組合せ」4択（正正/正誤/誤正/誤誤）。
// mock-exam-analysis.md T-A（最頻出。5/約30問）に対応するため M2 チケットで新設。
// types.ts の QuestionType コメント参照: DESIGN.md の既存 Q8（組合せ文）とは別の型。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import { otherWorkFactCandidates, verifiedFalseStatementCandidates } from './statements'
import type { StatementPairSentence, Work } from '../types'

export interface StatementPairQuestionData {
  sentenceA: StatementPairSentence
  sentenceB: StatementPairSentence
  /** 4択のラベル固定順: [正正, 正誤, 誤正, 誤誤] */
  labels: string[]
  correctIndex: number
}

export const STATEMENT_PAIR_LABELS = ['A: 正 ・ B: 正', 'A: 正 ・ B: 誤', 'A: 誤 ・ B: 正', 'A: 誤 ・ B: 誤']

function pickTrueTexts(target: Work, count: number, rng: RandomFn, exclude: Set<string>): string[] {
  const seen = new Set(exclude)
  const out: string[] = []
  for (const fact of shuffle(target.facts, rng)) {
    if (seen.has(fact.text)) continue
    seen.add(fact.text)
    out.push(fact.text)
    if (out.length >= count) break
  }
  return out
}

function pickFalseCandidates(target: Work, pool: Work[], rng: RandomFn, exclude: Set<string>): { text: string; why: string }[] {
  const seen = new Set(exclude)
  const out: { text: string; why: string }[] = []
  for (const f of shuffle(verifiedFalseStatementCandidates(target), rng)) {
    if (seen.has(f.text)) continue
    seen.add(f.text)
    out.push({ text: f.text, why: f.why ?? '' })
  }
  for (const f of shuffle(otherWorkFactCandidates(target, pool), rng)) {
    if (seen.has(f.text)) continue
    seen.add(f.text)
    out.push({ text: f.text, why: f.why ?? '' })
  }
  return out
}

/**
 * target について独立した2文 A・B を用意し、それぞれの真偽をランダムに割り当てる。
 * 正文・誤文がそれぞれ2件ずつそろわなければ null（Q10 を出さない）。
 */
export function generateStatementPairQuestion(
  target: Work,
  pool: Work[],
  rng: RandomFn,
): StatementPairQuestionData | null {
  const trueTexts = pickTrueTexts(target, 2, rng, new Set())
  if (trueTexts.length < 2) return null
  const falseCandidates = pickFalseCandidates(target, pool, rng, new Set(trueTexts))
  if (falseCandidates.length < 2) return null

  const [trueText1, trueText2] = trueTexts
  const [falseOption1, falseOption2] = falseCandidates

  const aIsTrue = rng() < 0.5
  const bIsTrue = rng() < 0.5

  const sentenceA: StatementPairSentence = aIsTrue
    ? { text: trueText1, actuallyTrue: true, why: null }
    : { text: falseOption1.text, actuallyTrue: false, why: falseOption1.why }
  const sentenceB: StatementPairSentence = bIsTrue
    ? { text: trueText2, actuallyTrue: true, why: null }
    : { text: falseOption2.text, actuallyTrue: false, why: falseOption2.why }

  const correctIndex = (aIsTrue ? 0 : 2) + (bIsTrue ? 0 : 1)
  return { sentenceA, sentenceB, labels: STATEMENT_PAIR_LABELS, correctIndex }
}
