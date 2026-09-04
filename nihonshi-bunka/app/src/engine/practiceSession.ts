// 文化別練習（学習タブ）のセッション組み立て。M2-22。decisions.md 2026-09-04夜:
//  文化を選ぶとその範囲だけを解く。経験値・図鑑・SRS は更新しない（呼び出し側が progress の
//  answer() を一切呼ばないことで担保する。この engine 層は Question を作るだけで progress には
//  一切触れない＝更新しようがない設計）。誤答した作品はセッション内でのみ再出題する
//  （呼び出し側 PracticeSessionScreen が requeueType/buildQuestionOrFallback を使う。
//  LearnScreen と同じパターンだが progress を更新しない点だけが違う）。
import { buildQuestion, canGenerateType, QUESTION_TYPE_WEIGHTS } from './session'
import { weightedSampleWithoutReplacement } from './weighted'
import type { RandomFn } from './distractors'
import type { Era, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

export const PRACTICE_SESSION_SIZE = 10

const IMAGE_DEPENDENT_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q9']
/** 文化別練習で使う型の範囲（自由出題と同じ。テーマセット専用の q10/q12/q13/q14 は文脈が要るため使わない）。 */
const PRACTICE_TYPES: QuestionType[] = ['q1', 'q2', 'q4', 'q6', 'q8', 'q9']

function weightedPick(types: QuestionType[], rng: RandomFn): QuestionType {
  const weights = types.map((t) => QUESTION_TYPE_WEIGHTS[t] ?? 0.1)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return types[Math.floor(rng() * types.length)]
  let r = rng() * total
  for (let i = 0; i < types.length; i++) {
    r -= weights[i]
    if (r <= 0) return types[i]
  }
  return types[types.length - 1]
}

/**
 * 指定した文化（eraId）の作品だけを対象にセッション（最大 count 問）を組み立てる。
 * pool は素材プール（画像なし person/text/concept を含む。content.ts の themeSetPool）、
 * imagePool は画像で出題できる作品だけ（content.ts の playableWorks）。
 * 対象文化の作品数が count 未満なら、作れるだけ作る（水増ししない）。
 */
export function buildPracticeSession(
  eraId: string,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  count = PRACTICE_SESSION_SIZE,
): Question[] {
  const eraWorks = pool.filter((w) => w.era === eraId)
  if (eraWorks.length === 0) return []
  const picked = weightedSampleWithoutReplacement(eraWorks, () => 1, Math.min(count, eraWorks.length), rng)
  const questions: Question[] = []
  for (const work of picked) {
    const imageEligible = imagePool.some((w) => w.id === work.id)
    const usablePool = imageEligible ? imagePool : pool
    const candidateTypes = PRACTICE_TYPES.filter((t) => {
      if (IMAGE_DEPENDENT_TYPES.includes(t) && !imageEligible) return false
      return canGenerateType(t, work, usablePool, eras)
    })
    if (candidateTypes.length === 0) continue
    const type = weightedPick(candidateTypes, rng)
    const question = buildQuestion(work, type, usablePool, eras, false, rng)
    if (question) questions.push(question)
  }
  return questions
}

/**
 * 誤答したときの同セッション内再出題（LearnScreen の requeueType と同じ考え方だが、
 * progress を一切参照しない。画像を持たない対象では画像が要る型を避ける＝missLog.ts の
 * buildMissReviewQuestion と同じ安全策）。生成できなければ null（呼び出し側は諦める）。
 */
export function requeuePracticeQuestion(
  original: Question,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
): Question | null {
  const work = original.work
  const imageEligible = imagePool.some((w) => w.id === work.id)
  const usablePool = imageEligible ? imagePool : pool
  const candidateTypes = PRACTICE_TYPES.filter((t) => {
    if (IMAGE_DEPENDENT_TYPES.includes(t) && !imageEligible) return false
    if (t === original.type) return false
    return canGenerateType(t, work, usablePool, eras)
  })
  if (candidateTypes.length === 0) return null
  const type = weightedPick(candidateTypes, rng)
  return buildQuestion(work, type, usablePool, eras, false, rng)
}
