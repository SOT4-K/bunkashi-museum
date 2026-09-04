// 本番モード（大問IV形式の模試）。M2-20。research/nichidai-past-exams-analysis.md 5.4章:
//  「大問IV形式の模試モード: リード文A〜D＋10問（型の配分は本番どおり）、20点満点、
//  時間目安10分。妹が本番前に1回分通す用途」。型の配分・下線ごとの設問生成は M2-16 の
//  buildThemeSetQuestions をそのまま流用する（新しい生成ロジックを作らない）。
import { shuffle, type RandomFn } from './distractors'
import { buildThemeSetQuestions, type ThemeQuestion } from './themeSet'
import type { Era, Passage, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** 本番と同じ10問・20点満点（1問2点）。 */
export const MOCK_EXAM_SIZE = 10
export const MOCK_EXAM_POINTS_PER_QUESTION = 2
/** 時間目安10分（分析5.4章）。あくまで目安の表示で、自動採点はしない。 */
export const MOCK_EXAM_TIME_SECONDS = 600

const SECTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

export interface MockExamSection {
  label: string
  passage: Passage
  questions: ThemeQuestion[]
}

/**
 * 大問IV形式（リード文A〜D＋10問）の模試セットを組み立てる。
 * kind: "image"（画像リード型）は大問IVの「リード文」形式に合わないため対象外にする
 * （画像リード型はテーマセット単体選択で引き続き遊べる）。passages をシャッフルして
 * 順に消化し、合計が10問に達したら打ち切る。超過分は最後に採用したセクションから間引いて
 * ちょうど10問にする。どの passage からも1問も作れない場合は空配列を返す
 * （呼び出し側でメッセージを出す。エラーにしない）。
 */
export function buildMockExam(
  passages: Passage[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  size = MOCK_EXAM_SIZE,
): MockExamSection[] {
  if (passages.length === 0) return []
  const candidates = shuffle(
    passages.filter((p) => (p.kind ?? 'text') === 'text'),
    rng,
  )
  const sections: MockExamSection[] = []
  let total = 0
  for (const passage of candidates) {
    if (total >= size) break
    const questions = buildThemeSetQuestions(passage, pool, eras, rng, imagePool)
    if (questions.length === 0) continue
    sections.push({ label: SECTION_LABELS[sections.length] ?? String(sections.length + 1), passage, questions })
    total += questions.length
  }
  if (total === 0) return []
  if (total <= size) return sections

  // 超過分は末尾から間引いて size 件ちょうどにする（先頭のセクションほど優先して残す）。
  let remaining = size
  const trimmed: MockExamSection[] = []
  for (const section of sections) {
    if (remaining <= 0) break
    const take = section.questions.slice(0, remaining)
    if (take.length > 0) {
      trimmed.push({ ...section, questions: take })
      remaining -= take.length
    }
  }
  return trimmed
}

/** 秒数を「m:ss」表示に整形する（残り時間の目安表示。M2-20）。負数は 0:00 に丸める。 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${String(rest).padStart(2, '0')}`
}
