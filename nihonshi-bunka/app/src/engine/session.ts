// セッション（1回の学習=最大10問）の組み立て。DESIGN.md 4章:
//  復習期限の来た作品を優先（最大7）＋新規（残り、上限5、日次上限は呼び出し側が渡す）
//  同じ時代を連続させない並べ替え
//  誤答の同セッション内再出題は型を変える（requeueType）
import { buildChoices, pickEraDistractors, pickWorkDistractors, shuffle, type RandomFn } from './distractors'
import { dueTypes } from './srs'
import type { Era, ProgressState, Question, QuestionType, Work } from '../types'

export const REVIEW_MAX = 7
export const NEW_MAX_PER_SESSION = 5
export const SESSION_SIZE = 10

const defaultRandom: RandomFn = () => Math.random()

export interface SessionPick {
  work: Work
  type: QuestionType
}

/** 復習期日が来ている作品を（作品ごとに1方向選んで）ピックアップする。 */
export function selectReviewCandidates(
  works: Work[],
  progress: ProgressState,
  today: string,
  rng: RandomFn = defaultRandom,
): SessionPick[] {
  const candidates: SessionPick[] = []
  for (const work of works) {
    const item = progress.items[work.id]
    if (!item) continue // 未出題の作品は新規側で扱う
    const due = dueTypes(item, today)
    if (due.length === 0) continue
    const type = due[Math.floor(rng() * due.length)]
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

/** 1問分の Question オブジェクト（選択肢・正解位置つき）を組み立てる。 */
export function buildQuestion(
  work: Work,
  type: QuestionType,
  pool: Work[],
  eras: Era[],
  isReview = false,
  rng: RandomFn = defaultRandom,
): Question {
  const eraOrderIndex = Object.fromEntries(eras.map((e) => [e.id, e.order]))

  if (type === 'q2') {
    const targetEra = eras.find((e) => e.id === work.era)
    if (!targetEra) throw new Error(`unknown era for work ${work.id}: ${work.era}`)
    const distractorEras = pickEraDistractors(targetEra, eras, 3, rng)
    const { items, correctIndex } = buildChoices(targetEra, distractorEras, rng)
    return { type, work, choiceWorks: [], choiceEras: items, correctIndex, isReview }
  }

  const distractors = pickWorkDistractors(work, pool, eraOrderIndex, 3, rng)
  const { items, correctIndex } = buildChoices(work, distractors, rng)
  return { type, work, choiceWorks: items, correctIndex, isReview }
}

export interface SessionComposition {
  reviewCount: number
  newCount: number
}

/** ホーム画面表示用: 実際にセッションを組まずに「復習n・新規m」の件数だけ知りたい時に使う。 */
export function previewSessionComposition(
  works: Work[],
  progress: ProgressState,
  today: string,
  dailyNewRemaining: number,
  rng: RandomFn = defaultRandom,
): SessionComposition {
  const review = selectReviewCandidates(works, progress, today, rng)
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
  const review = selectReviewCandidates(works, progress, today, rng)
  const sessionRemaining = SESSION_SIZE - review.length
  const fresh = selectNewCandidates(works, progress, dailyNewRemaining, sessionRemaining, rng)
  const reviewIds = new Set(review.map((p) => p.work.id))
  const picks = interleaveByEra([...review, ...fresh], rng)
  return picks.map(({ work, type }) => buildQuestion(work, type, works, eras, reviewIds.has(work.id), rng))
}

/** 誤答したときの同セッション内再出題用に、出題済みと違う型を選ぶ。 */
export function requeueType(originalType: QuestionType, rng: RandomFn = defaultRandom): QuestionType {
  const others: QuestionType[] = (['q1', 'q2', 'q3'] as QuestionType[]).filter((t) => t !== originalType)
  return others[Math.floor(rng() * others.length)]
}
