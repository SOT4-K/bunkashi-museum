// セッション（1回の学習=最大10問）の組み立て。DESIGN.md 4章:
//  復習期限の来た作品を優先（最大7）＋新規（残り、上限5、日次上限は呼び出し側が渡す）
//  同じ時代を連続させない並べ替え
//  誤答の同セッション内再出題は型を変える（requeueType）
// DESIGN.md 10章（設問型の拡張）:
//  Q4/Q6/Q8 は作品によって生成できないことがある（facts/falseStatements が3件未満、
//  era.items が足りない、artist/patron と style/religion/technique の両方が無い等）。
//  型の出現比は QUESTION_TYPE_WEIGHTS で持ち、新規・復習どちらの型選びにも使う
//  （オーナー方針: Q4 が中心のアプリなので、新規出題も q1 固定にしない。2026-09-04）。
//  ただし Q3「作品名→画像」は、まだ作品名を知らない新規出題では出さない（重み対象から除外）。
//  再出題（requeueType）は誤答した型と違う、その作品で生成可能な型から選ぶ。
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
  // content 側で明示的に外した型は出さない（reviewer 指摘で個別に無効化した作品がある。DESIGN.md 10章）
  if (work.skipTypes?.includes(type)) return false
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

/** 新規出題（まだ一度も見せていない作品）で候補になりうる型。q3（作品名→画像）は
 *  名前をまだ知らないので出さない。q5/q7/⑨ は実装しない（DESIGN.md 10章）。 */
const NEW_CANDIDATE_TYPES: QuestionType[] = ['q1', 'q2', 'q4', 'q6', 'q8']

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

/**
 * まだ一度も出題していない作品を新規候補として返す（日次上限を考慮）。
 * 型は QUESTION_TYPE_WEIGHTS で重み付きに選ぶ（オーナー方針: Q4 中心のアプリなので
 * 新規出題を q1 固定にしない。2026-09-04）。q3 は名前をまだ知らないため対象外。
 * work がその型を生成できないとき（facts 不足等）は候補から外し、生成できる型の中で選ぶ
 * （q1/q2 は常に生成できるため候補が空になることはない）。
 */
export function selectNewCandidates(
  works: Work[],
  eras: Era[],
  progress: ProgressState,
  dailyNewRemaining: number,
  sessionRemaining: number,
  rng: RandomFn = defaultRandom,
): SessionPick[] {
  const unseen = works.filter((w) => !progress.items[w.id])
  const limit = Math.max(0, Math.min(NEW_MAX_PER_SESSION, sessionRemaining, dailyNewRemaining))
  return shuffle(unseen, rng)
    .slice(0, limit)
    .map((work) => {
      const candidates = NEW_CANDIDATE_TYPES.filter((t) => canGenerateType(t, work, works, eras))
      return { work, type: weightedTypePick(candidates, rng) }
    })
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
  const fresh = selectNewCandidates(works, eras, progress, dailyNewRemaining, sessionRemaining, rng)
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
  const fresh = selectNewCandidates(works, eras, progress, dailyNewRemaining, sessionRemaining, rng)
  const reviewIds = new Set(review.map((p) => p.work.id))
  const picks = interleaveByEra([...review, ...fresh], rng)
  return picks.map(({ work, type }) => buildQuestionOrFallback(work, type, works, eras, reviewIds.has(work.id), rng))
}

/**
 * 誤答したときの同セッション内再出題用に、出題済みと違う型を選ぶ。
 * その作品で生成可能な型（q1〜q8、originalType を除く）から QUESTION_TYPE_WEIGHTS で重み付けして選ぶ
 * （2026-09-04 拡張。以前は q1/q2/q3 の範囲のみだった）。q1/q2 のどちらかは常に生成できるため、
 * candidates が空になることはない。
 */
export function requeueType(
  originalType: QuestionType,
  work: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
): QuestionType {
  const allTypes: QuestionType[] = ['q1', 'q2', 'q3', 'q4', 'q6', 'q8']
  const candidates = allTypes.filter((t) => t !== originalType && canGenerateType(t, work, pool, eras))
  return weightedTypePick(candidates, rng)
}
