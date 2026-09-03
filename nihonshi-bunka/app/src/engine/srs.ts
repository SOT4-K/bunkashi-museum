// 間隔反復（SRS）。DESIGN.md 4章:
//  箱 0〜5、間隔 0/1/3/7/14/30 日。正解で箱+1（上限5）、不正解で箱0に戻す。
//  箱4以上を「習熟」、3方向（q1/q2/q3）とも習熟で「所蔵」。
//  「発見」はいずれかの方向で初めて正解した時点。
import type { AnswerKind, ItemProgress, QuestionType, SrsCell } from '../types'

export const MAX_BOX = 5
export const MASTERED_BOX = 4
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30] as const

/** YYYY-MM-DD の today に days 日を加算した YYYY-MM-DD を返す。 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function todayIso(now: Date = new Date()): string {
  const yy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function createCell(today: string): SrsCell {
  return { box: 0, due: today, correct: 0, wrong: 0 }
}

/** due <= today なら復習期日が来ている。 */
export function isDue(cell: SrsCell, today: string): boolean {
  return cell.due <= today
}

export function nextDue(box: number, today: string): string {
  const clamped = Math.max(0, Math.min(MAX_BOX, box))
  return addDays(today, INTERVAL_DAYS[clamped])
}

/**
 * 1問回答した結果で SrsCell を更新する。
 * answer: 'correct' | 'incorrect' | 'unknown'。'unknown'（わからない、を選んだ）は
 * SRS 上は 'incorrect' と同じ扱い（箱0・XPなし）だが、UI 側で区別できるように型を分けている。
 */
export function applyAnswer(cell: SrsCell, answer: AnswerKind, today: string): SrsCell {
  const correct = answer === 'correct'
  const box = correct ? Math.min(MAX_BOX, cell.box + 1) : 0
  return {
    box,
    due: nextDue(box, today),
    correct: cell.correct + (correct ? 1 : 0),
    wrong: cell.wrong + (correct ? 0 : 1),
  }
}

export function isCellMastered(cell: SrsCell): boolean {
  return cell.box >= MASTERED_BOX
}

export function isItemMastered(item: ItemProgress): boolean {
  return isCellMastered(item.q1) && isCellMastered(item.q2) && isCellMastered(item.q3)
}

export function createItemProgress(today: string): ItemProgress {
  return {
    q1: createCell(today),
    q2: createCell(today),
    q3: createCell(today),
    discoveredAt: null,
    masteredAt: null,
  }
}

/** ある作品の1方向分の回答結果を反映し、discoveredAt/masteredAt も更新する。
 *  q4/q6/q8 はまだセルが無いことがある（その型が初めて出題された時点で作る）。 */
export function applyItemAnswer(
  item: ItemProgress,
  type: QuestionType,
  answer: AnswerKind,
  today: string,
): ItemProgress {
  const correct = answer === 'correct'
  const baseCell = item[type] ?? createCell(today)
  const updatedCell = applyAnswer(baseCell, answer, today)
  const next: ItemProgress = {
    ...item,
    [type]: updatedCell,
    discoveredAt: item.discoveredAt ?? (correct ? today : null),
  }
  if (!next.masteredAt && isItemMastered(next)) {
    next.masteredAt = today
  }
  return next
}

/**
 * 復習期日が来ている方向のうち、いずれかがあるか（セッション組み立て用）。
 * q1/q2/q3 は常にセルがあるためそのまま判定する。q4/q6/q8 はセルが無ければ
 * （＝まだその型で出題したことがない）ここでは対象外にする。その型を新しく
 * 導入するかどうかは session.ts 側（作品がその型を生成できるかを見て判断する）に委ねる。
 */
export function dueTypes(item: ItemProgress, today: string): QuestionType[] {
  const types: ('q1' | 'q2' | 'q3')[] = ['q1', 'q2', 'q3']
  return types.filter((t) => isDue(item[t], today))
}
