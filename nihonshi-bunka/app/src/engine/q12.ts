// Q12「画像なし、文字4択」。mock-exam-analysis.md 9章「画像リード型セット」:
//  passage.kind === "image" のリード画像について「作者は？」「主人公は？」のように
//  様々な属性を問う。stem・answerText・distractorTexts はすべて writer が手書きする
//  （engine は選択肢の並びのシャッフルのみ行う。何も合成しない）。
import type { RandomFn } from './distractors'
import { buildChoices } from './distractors'
import type { PassageUnderlineAsk, StatementOption } from '../types'

export interface Q12QuestionData {
  /** 4件（シャッフル済み） */
  choices: StatementOption[]
  correctIndex: number
}

/**
 * ask.type === 'q12' かつ answerText・distractorTexts（3件）がそろっているときだけ生成する。
 * データが足りない場合は null（呼び出し側で次善にフォールバックする）。
 */
export function generateQ12Question(ask: PassageUnderlineAsk | undefined, rng: RandomFn): Q12QuestionData | null {
  if (!ask || ask.type !== 'q12') return null
  if (!ask.answerText) return null
  if (!ask.distractorTexts || ask.distractorTexts.length < 3) return null

  const correct: StatementOption = { text: ask.answerText, correct: true, why: null }
  const distractors: StatementOption[] = ask.distractorTexts.slice(0, 3).map((text) => ({ text, correct: false, why: null }))
  const { items, correctIndex } = buildChoices(correct, distractors, rng)
  return { choices: items, correctIndex }
}
