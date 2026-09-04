// テーマセット（リード文＋下線部→図版問題）の組み立て。decisions.md 2026-09-04「模試型」:
//  下線部ごとに、対象作品から図版問題を自動生成する。優先順位は
//  Q9（画像4枚から条件）→ Q10（2文正誤）→ Q8（組合せ文）→ Q4（関連記述、正/逆パターン）→
//  Q1（画像→作品名、必ず生成できる保険）。
//  生成できない下線（対象作品が出題プールに無い）はスキップし、console.warn で知らせる
//  （エラーにしない。M2 チケット「進め方」）。
import { buildChoices, type RandomFn } from './distractors'
import { buildQuestion } from './session'
import { generateStatementQuestion } from './statements'
import { generateComboQuestion } from './combos'
import { generateQ9Question } from './q9'
import { generateStatementPairQuestion } from './statementPair'
import { pickUnderlineTargetId } from './passage'
import type { Era, Passage, Question, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

export interface ThemeQuestion {
  underlineKey: string
  question: Question
}

/** 1作品に対して、優先順位に従って生成できる最初の設問を作る。q1 は必ず生成できる保険。 */
export function buildThemeQuestionForWork(work: Work, pool: Work[], eras: Era[], rng: RandomFn = defaultRandom): Question {
  const q9 = generateQ9Question(work, pool, eras, rng)
  if (q9) {
    const { items, correctIndex } = buildChoices(q9.correctWork, q9.distractorWorks, rng)
    return {
      type: 'q9',
      work,
      choiceWorks: items,
      correctIndex,
      isReview: false,
      conditionText: q9.conditionText,
      reversed: q9.reversed,
    }
  }

  const pair = generateStatementPairQuestion(work, pool, rng)
  if (pair) {
    return {
      type: 'q10',
      work,
      choiceWorks: [],
      choicePairLabels: pair.labels,
      statementPair: { sentenceA: pair.sentenceA, sentenceB: pair.sentenceB },
      correctIndex: pair.correctIndex,
      isReview: false,
    }
  }

  const combo = generateComboQuestion(work, pool, rng)
  if (combo) {
    const { items, correctIndex } = buildChoices(combo.correct, combo.distractors, rng)
    return { type: 'q8', work, choiceWorks: [], choiceCombos: items, correctIndex, isReview: false }
  }

  const statement = generateStatementQuestion(work, pool, rng)
  if (statement) {
    const { items, correctIndex } = buildChoices(statement.correct, statement.distractors, rng)
    return {
      type: 'q4',
      work,
      choiceWorks: [],
      choiceStatements: items,
      correctIndex,
      isReview: false,
      reversed: false,
    }
  }

  const reversedStatement = generateStatementQuestion(work, pool, rng, { reversed: true })
  if (reversedStatement) {
    const { items, correctIndex } = buildChoices(reversedStatement.correct, reversedStatement.distractors, rng)
    return {
      type: 'q4',
      work,
      choiceWorks: [],
      choiceStatements: items,
      correctIndex,
      isReview: false,
      reversed: true,
    }
  }

  // Q1（画像→作品名）は pool に3件以上あれば必ず生成できる保険。
  return buildQuestion(work, 'q1', pool, eras, false, rng)
}

/**
 * passage の下線部ごとに図版問題を組み立てる。対象作品が pool（出題プール）に無い下線はスキップする。
 * pool は「出題に使える作品」（画像あり・kind が artifact のもの）を渡す想定
 * （content.ts の playableWorks。person/text/concept は自動的に対象から外れる）。
 */
export function buildThemeSetQuestions(passage: Passage, pool: Work[], eras: Era[], rng: RandomFn = defaultRandom): ThemeQuestion[] {
  const byId = new Map(pool.map((w) => [w.id, w]))
  const availableIds = new Set(pool.map((w) => w.id))
  const out: ThemeQuestion[] = []

  for (const underline of passage.underlines) {
    const targetId = pickUnderlineTargetId(underline, availableIds)
    const target = targetId ? byId.get(targetId) : undefined
    if (!target) {
      console.warn(
        `[themeSet] passage "${passage.id}" underline "${underline.key}": 出題プールに対象作品が無い（workIds: ${underline.workIds.join(', ')}）。スキップする。`,
      )
      continue
    }
    const question = buildThemeQuestionForWork(target, pool, eras, rng)
    out.push({ underlineKey: underline.key, question: { ...question, passageId: passage.id, underlineKey: underline.key } })
  }

  return out
}
