// セッション（1回の学習=最大10問）の組み立て。DESIGN.md 4章:
//  復習期限の来た作品を優先（最大7）＋新規（残り、上限5、日次上限は呼び出し側が渡す）
//  同じ時代を連続させない並べ替え
//  誤答の同セッション内再出題は型を変える（requeueType）
// DESIGN.md 10章（設問型の拡張）:
//  Q4/Q6/Q8 は作品によって生成できないことがある（facts/falseStatements が3件未満、
//  era.items が足りない、artist/patron と style/religion/technique の両方が無い等）。
//  型の出現比は QUESTION_TYPE_WEIGHTS で持ち、復習でどの方向を選ぶかに重みづけする。
//  「新規」出題は既存どおり必ず q1 から始める（初出題は易しい方向からという既存設計を維持）。
//  q4/q6/q8 は、すでに一度でも出題した作品が復習対象になったときに初めて導入される
//  （selectReviewCandidates が生成可能性を都度チェックする）。
import { buildChoices, pickEraDistractors, pickWorkDistractors, shuffle, type RandomFn } from './distractors'
import { generateComboQuestion } from './combos'
import { generateEraItemQuestion } from './eraItems'
import { generateStatementQuestion } from './statements'
import { dueTypes, isDue } from './srs'
import type { Era, ProgressState, Question, QuestionType, Work } from '../types'

export const REVIEW_MAX = 7
export const NEW_MAX_PER_SESSION = 5
export const SESSION_SIZE = 10

const defaultRandom: RandomFn = () => Math.random()

/** 常に同じ結果になる rng（乱数に依存しない「生成できるか」チェック専用。件数比較にしか使わないため安全）。 */
const PROBE_RANDOM: RandomFn = () => 0

/** DESIGN.md 10章5項の初期値。1セッション全体でこの比率に厳密従うわけではなく、
 *  復習でどの方向を優先するかの重みとして使う（新規出題は常に q1）。 */
export const QUESTION_TYPE_WEIGHTS: Record<QuestionType, number> = {
  q1: 0.25,
  q2: 0.15,
  q3: 0.15,
  q4: 0.25,
  q6: 0.1,
  q8: 0.1,
}

export interface SessionPick {
  work: Work
  type: QuestionType
}

/** その型の問題を work に対して生成できるか（データ不足で null になるものを事前に弾く）。 */
export function canGenerateType(type: QuestionType, work: Work, pool: Work[], eras: Era[]): boolean {
  switch (type) {
    case 'q4':
      return generateStatementQuestion(work, pool, PROBE_RANDOM) !== null
    case 'q6':
      return generateEraItemQuestion(work, eras, PROBE_RANDOM) !== null
    case 'q8':
      return generateComboQuestion(work, pool, PROBE_RANDOM) !== null
    default:
      return true
  }
}

/** types から QUESTION_TYPE_WEIGHTS に従って重み付きで1つ選ぶ。重みが無ければ一様分布にフォールバック。 */
function weightedTypePick(types: QuestionType[], rng: RandomFn): QuestionType {
  if (types.length === 0) throw new Error('weightedTypePick: types is empty')
  const weights = types.map((t) => QUESTION_TYPE_WEIGHTS[t] ?? 0)
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
 * 復習期日が来ている作品を（作品ごとに1方向選んで）ピックアップする。
 * q1/q2/q3 はセルの due で判定（既存どおり）。q4/q6/q8 はセルが無ければ「まだ出題したことが
 * 無い＝今すぐ導入してよい」とみなし、work がその型を生成できるときだけ候補に加える。
 */
export function selectReviewCandidates(
  works: Work[],
  progress: ProgressState,
  today: string,
  rng: RandomFn = defaultRandom,
  eras: Era[] = [],
): SessionPick[] {
  const candidates: SessionPick[] = []
  for (const work of works) {
    const item = progress.items[work.id]
    if (!item) continue // 未出題の作品は新規側で扱う
    const due: QuestionType[] = dueTypes(item, today)
    for (const type of ['q4', 'q6', 'q8'] as QuestionType[]) {
      const cell = item[type]
      if (cell) {
        if (isDue(cell, today)) due.push(type)
      } else if (canGenerateType(type, work, works, eras)) {
        due.push(type)
      }
    }
    if (due.length === 0) continue
    const type = weightedTypePick(due, rng)
    candidates.push({ work, type })
  }
  return shuffle(candidates, rng).slice(0, REVIEW_MAX)
}

/** まだ一度も出題していない作品を新規候補として返す（日次上限を考慮）。 */
export function selectNewCandidates(
  works: Work[],
  progress: ProgressState,
  dailyNewRemaining: number,
  sessionRemaining: number,
  rng: RandomFn = defaultRandom,
): SessionPick[] {
  const unseen = works.filter((w) => !progress.items[w.id])
  const limit = Math.max(0, Math.min(NEW_MAX_PER_SESSION, sessionRemaining, dailyNewRemaining))
  return shuffle(unseen, rng)
    .slice(0, limit)
    .map((work) => ({ work, type: 'q1' as QuestionType })) // 初出題は画像→作品名から
}

/** 同じ時代の問題を連続させない並び替え（できる限り）。 */
export function interleaveByEra(picks: SessionPick[], rng: RandomFn = defaultRandom): SessionPick[] {
  if (picks.length <= 1) return picks.slice()
  const shuffled = shuffle(picks, rng)
  const groups = new Map<string, SessionPick[]>()
  for (const pick of shuffled) {
    const list = groups.get(pick.work.era) ?? []
    list.push(pick)
    groups.set(pick.work.era, list)
  }
  const result: SessionPick[] = []
  let lastEra: string | null = null
  const bucket = [...groups.values()]
  while (bucket.some((g) => g.length > 0)) {
    // 直前と違う時代のグループを優先。無ければ何でも取り出す(重複許容の最終手段)。
    let idx = bucket.findIndex((g) => g.length > 0 && g[0].work.era !== lastEra)
    if (idx === -1) idx = bucket.findIndex((g) => g.length > 0)
    const picked = bucket[idx].shift()!
    result.push(picked)
    lastEra = picked.work.era
  }
  return result
}

/**
 * 1問分の Question オブジェクト（選択肢・正解位置つき）を組み立てる。
 * q1/q2/q3 は常に生成できる（リテラル型で呼ぶと戻り値は null にならない、オーバーロード参照）。
 * q4/q6/q8 はデータ不足で生成できないことがあり、その場合 null を返す
 * （呼び出し側は buildQuestionOrFallback を使うと自動で q1 にフォールバックする）。
 */
export function buildQuestion(
  work: Work,
  type: 'q1' | 'q2' | 'q3',
  pool: Work[],
  eras: Era[],
  isReview?: boolean,
  rng?: RandomFn,
): Question
export function buildQuestion(
  work: Work,
  type: QuestionType,
  pool: Work[],
  eras: Era[],
  isReview?: boolean,
  rng?: RandomFn,
): Question | null
export function buildQuestion(
  work: Work,
  type: QuestionType,
  pool: Work[],
  eras: Era[],
  isReview = false,
  rng: RandomFn = defaultRandom,
): Question | null {
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))

  if (type === 'q2') {
    const targetEra = eras.find((e) => e.id === work.era)
    if (!targetEra) throw new Error(`unknown era for work ${work.id}: ${work.era}`)
    const distractorEras = pickEraDistractors(targetEra, eras, 3, rng)
    const { items, correctIndex } = buildChoices(targetEra, distractorEras, rng)
    return { type, work, choiceWorks: [], choiceEras: items, correctIndex, isReview }
  }

  if (type === 'q4') {
    const data = generateStatementQuestion(work, pool, rng)
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
    return { type, work, choiceWorks: [], choiceStatements: items, correctIndex, isReview }
  }

  if (type === 'q6') {
    const data = generateEraItemQuestion(work, eras, rng)
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
    return { type, work, choiceWorks: [], choiceEraItems: items, correctIndex, isReview }
  }

  if (type === 'q8') {
    const data = generateComboQuestion(work, pool, rng)
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
    return { type, work, choiceWorks: [], choiceCombos: items, correctIndex, isReview }
  }

  const distractors = pickWorkDistractors(work, pool, eraOrderIndex, 3, rng)
  const { items, correctIndex } = buildChoices(work, distractors, rng)
  return { type, work, choiceWorks: items, correctIndex, isReview }
}

/** buildQuestion が null を返したとき（データ不足）は q1 にフォールバックする。q1 は常に生成できる想定。 */
export function buildQuestionOrFallback(
  work: Work,
  type: QuestionType,
  pool: Work[],
  eras: Era[],
  isReview = false,
  rng: RandomFn = defaultRandom,
): Question {
  return buildQuestion(work, type, pool, eras, isReview, rng) ?? buildQuestion(work, 'q1', pool, eras, isReview, rng)
}

export interface SessionComposition {
  reviewCount: number
  newCount: number
}

/** ホーム画面表示用: 実際にセッションを組まずに「復習n・新規m」の件数だけ知りたい時に使う。 */
export function previewSessionComposition(
  works: Work[],
  eras: Era[],
  progress: ProgressState,
  today: string,
  dailyNewRemaining: number,
  rng: RandomFn = defaultRandom,
): SessionComposition {
  const review = selectReviewCandidates(works, progress, today, rng, eras)
  const sessionRemaining = SESSION_SIZE - review.length
  const fresh = selectNewCandidates(works, progress, dailyNewRemaining, sessionRemaining, rng)
  return { reviewCount: review.length, newCount: fresh.length }
}

/**
 * セッション全体（最大10問）を組み立てる。
 * dailyNewRemaining は「今日あと何件の新規作品を出してよいか」（呼び出し側が progress.newToday から計算）。
 */
export function buildSession(
  works: Work[],
  eras: Era[],
  progress: ProgressState,
  today: string,
  dailyNewRemaining: number,
  rng: RandomFn = defaultRandom,
): Question[] {
  const review = selectReviewCandidates(works, progress, today, rng, eras)
  const sessionRemaining = SESSION_SIZE - review.length
  const fresh = selectNewCandidates(works, progress, dailyNewRemaining, sessionRemaining, rng)
  const reviewIds = new Set(review.map((p) => p.work.id))
  const picks = interleaveByEra([...review, ...fresh], rng)
  return picks.map(({ work, type }) => buildQuestionOrFallback(work, type, works, eras, reviewIds.has(work.id), rng))
}

/** 誤答したときの同セッション内再出題用に、出題済みと違う型を選ぶ（q1/q2/q3 の範囲。既存動作を維持）。 */
export function requeueType(originalType: QuestionType, rng: RandomFn = defaultRandom): QuestionType {
  const others: QuestionType[] = (['q1', 'q2', 'q3'] as QuestionType[]).filter((t) => t !== originalType)
  return others[Math.floor(rng() * others.length)]
}
