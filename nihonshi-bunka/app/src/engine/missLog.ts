// 間違いノート（M2-23。research/nichidai-past-exams-analysis.md 9章）。
// 対象: ランダム学習（engine/randomLearn.ts）・本番モード（engine/mockExam.ts）で
// 「不正解」または「わからない」を選んだ問題。作品ごとに1件（何度間違えても count が
// 増えるだけでエントリは増えない）。文化別練習は呼び出し側がそもそも呼ばないため対象外
// （decisions.md 2026-09-04夜「学習モードを二本立てにする」の「記録に残らない」方針どおり）。
//
// 復習フロー: buildMissReviewQuestions で最大 N 問を組み立てる。「同じ問題をそのまま出さない」
// ため、直近に間違えた型（entry.type）を避けて別の型を選ぶ（session.ts の canGenerateType を
// 再利用。選択肢・誤答は buildQuestion が毎回 rng で新しく生成するため、型が同じになっても
// 選択肢の並びまでは同じにならない）。2回連続正解（correctStreak >= 2）でノートから外す。
import { buildQuestion, canGenerateType, QUESTION_TYPE_WEIGHTS } from './session'
import type { RandomFn } from './distractors'
import type { Era, MissLogEntry, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** 間違いノートから外すのに必要な連続正解数（DESIGN.md 拡張。decisions.md 2026-09-04夜）。 */
export const MISS_REVIEW_GRADUATE_STREAK = 2

/** 復習セッション1回で出す最大問題数。 */
export const MISS_REVIEW_MAX = 10

/** 間違いを1件記録する。既存エントリがあれば更新（count+1・correctStreak を0に戻す）。 */
export function addMiss(
  missLog: MissLogEntry[],
  workId: string,
  type: QuestionType,
  today: string,
  passageId?: string,
  underlineKey?: string,
): MissLogEntry[] {
  const idx = missLog.findIndex((e) => e.workId === workId)
  if (idx === -1) {
    const entry: MissLogEntry = { workId, type, passageId, underlineKey, lastMissedAt: today, count: 1, correctStreak: 0 }
    return [...missLog, entry]
  }
  const next = missLog.slice()
  const prev = next[idx]
  next[idx] = { ...prev, type, passageId, underlineKey, lastMissedAt: today, count: prev.count + 1, correctStreak: 0 }
  return next
}

/**
 * 間違いノート復習セッションでの1問の結果を反映する。正解なら correctStreak+1（規定数に
 * 達したらエントリを除去）。不正解なら correctStreak を0に戻す（ノートには残す。count は
 * addMiss 側でのみ増やす想定のため、ここでは増やさない＝復習中の再度の失点は「まだ定着して
 * いない」ことの確認であり、二重計上しない）。
 */
export function applyReviewOutcome(missLog: MissLogEntry[], workId: string, correct: boolean): MissLogEntry[] {
  const idx = missLog.findIndex((e) => e.workId === workId)
  if (idx === -1) return missLog
  const entry = missLog[idx]
  if (correct) {
    const streak = entry.correctStreak + 1
    if (streak >= MISS_REVIEW_GRADUATE_STREAK) {
      return missLog.filter((e) => e.workId !== workId)
    }
    const next = missLog.slice()
    next[idx] = { ...entry, correctStreak: streak }
    return next
  }
  const next = missLog.slice()
  next[idx] = { ...entry, correctStreak: 0 }
  return next
}

/** eras.json の order（時代順）→ 同一時代内は最後に間違えた日が新しい順。一覧表示用（M2-23）。 */
export function sortMissLogByCulture(missLog: MissLogEntry[], worksById: Record<string, Work>, eras: Era[]): MissLogEntry[] {
  const eraOrder = new Map(eras.map((e) => [e.id, e.order]))
  return missLog.slice().sort((a, b) => {
    const eraA = eraOrder.get(worksById[a.workId]?.era ?? '') ?? 999
    const eraB = eraOrder.get(worksById[b.workId]?.era ?? '') ?? 999
    if (eraA !== eraB) return eraA - eraB
    return b.lastMissedAt.localeCompare(a.lastMissedAt)
  })
}

/** 画像が要る型（image が無い作品には使えない）。 */
const IMAGE_DEPENDENT_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q9']
/** 間違いノートの再出題で使う型の候補（自由出題と同じ範囲。テーマセット専用の q10/q12/q13/q14 は
 *  下線・リード文の文脈が要るため、文脈から切り離された復習では作らない）。 */
const CANDIDATE_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q4', 'q6', 'q8', 'q9']

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
 * 1件のノートエントリから、直近と違う型（可能なら）で Question を組み立てる。
 * 対象作品が画像で出題できない（kind: person/text/concept）場合は画像が要る型を除外する。
 * どの型も生成できない場合は null（呼び出し側でその作品はスキップする。エラーにしない）。
 */
export function buildMissReviewQuestion(
  entry: MissLogEntry,
  work: Work,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
): Question | null {
  const imageEligible = imagePool.some((w) => w.id === work.id)
  const usablePool = imageEligible ? imagePool : pool
  const preferOtherType = (t: QuestionType) =>
    (imageEligible || !IMAGE_DEPENDENT_TYPES.includes(t)) && t !== entry.type && canGenerateType(t, work, usablePool, eras)
  const anyType = (t: QuestionType) =>
    (imageEligible || !IMAGE_DEPENDENT_TYPES.includes(t)) && canGenerateType(t, work, usablePool, eras)

  const preferred = CANDIDATE_TYPES.filter(preferOtherType)
  const fallback = CANDIDATE_TYPES.filter(anyType)
  const candidates = preferred.length > 0 ? preferred : fallback
  if (candidates.length === 0) return null

  const type = weightedPick(candidates, rng)
  return buildQuestion(work, type, usablePool, eras, true, rng)
}

export interface MissReviewItem {
  entry: MissLogEntry
  question: Question
}

/**
 * 間違いノートから復習セッション（最大 max 問）を組み立てる。最後に間違えた日が古い順
 * （長く放置している作品を優先）。どの型も生成できないエントリはスキップする。
 */
export function buildMissReviewSession(
  missLog: MissLogEntry[],
  worksById: Record<string, Work>,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  max = MISS_REVIEW_MAX,
): MissReviewItem[] {
  const ordered = missLog.slice().sort((a, b) => a.lastMissedAt.localeCompare(b.lastMissedAt))
  const out: MissReviewItem[] = []
  for (const entry of ordered) {
    if (out.length >= max) break
    const work = worksById[entry.workId]
    if (!work) continue
    const question = buildMissReviewQuestion(entry, work, pool, imagePool, eras, rng)
    if (!question) continue
    out.push({ entry, question })
  }
  return out
}
