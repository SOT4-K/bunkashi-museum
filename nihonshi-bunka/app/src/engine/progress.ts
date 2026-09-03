// localStorage 上の進捗（`bunkashi.v1`）の読み書き・XP/レベル/ストリーク更新。DESIGN.md 5〜6章。
// スキーマ変更時は STORAGE_VERSION を上げ、migrate() に移行ロジックを足す（既存データは消さない）。
import { applyItemAnswer, createItemProgress, todayIso } from './srs'
import type { AnswerKind, ItemProgress, ProgressState, QuestionType } from '../types'

export const STORAGE_KEY = 'bunkashi.v1'
export const STORAGE_VERSION = 1 as const

export const XP_CORRECT = 10
export const XP_REVIEW_CORRECT = 15
export const XP_BOSS_CLEAR = 200

// レベルは 100XP ごとに 1 上がる想定（DESIGN.md に数値の指定なし。仮の割当てとして明記）。
export const LEVEL_XP_STEP = 100

// 称号（DESIGN.md 5章の名称。レベル区切りは未指定のため仮に割当て）。
export const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 15, title: '館長' },
  { minLevel: 10, title: '主任学芸員' },
  { minLevel: 5, title: '学芸員' },
  { minLevel: 1, title: '見習い学芸員' },
]

export const DAILY_NEW_CAP = 15

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / LEVEL_XP_STEP) + 1)
}

export function titleForLevel(level: number): string {
  return TITLES.find((t) => level >= t.minLevel)?.title ?? '見習い学芸員'
}

export function createInitialProgress(today: string = todayIso()): ProgressState {
  return {
    version: STORAGE_VERSION,
    xp: 0,
    level: 1,
    streak: { count: 0, lastDate: null },
    items: {},
    bosses: {},
    newToday: { date: today, count: 0 },
  }
}

function isValidProgress(value: unknown): value is ProgressState {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<ProgressState>
  return (
    typeof v.version === 'number' &&
    typeof v.xp === 'number' &&
    typeof v.items === 'object' &&
    v.items !== null
  )
}

/** version 違い・壊れたデータを吸収して現行スキーマに揃える。既知データは消さない。 */
export function migrate(raw: unknown, today: string = todayIso()): ProgressState {
  if (!isValidProgress(raw)) return createInitialProgress(today)
  if (raw.version === STORAGE_VERSION) return raw
  // 将来 version が上がったらここに変換を追加する。
  return { ...createInitialProgress(today), ...raw, version: STORAGE_VERSION }
}

export function loadProgress(today: string = todayIso()): ProgressState {
  if (typeof localStorage === 'undefined') return createInitialProgress(today)
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return createInitialProgress(today)
  try {
    return migrate(JSON.parse(raw), today)
  } catch {
    return createInitialProgress(today)
  }
}

export function saveProgress(state: ProgressState): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/** 昨日/今日/それ以外を判定してストリークを更新する。セッション開始時に1回呼ぶ想定。 */
export function updateStreak(state: ProgressState, today: string): ProgressState {
  const { lastDate, count } = state.streak
  if (lastDate === today) return state
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = yesterday.toISOString().slice(0, 10)
  const nextCount = lastDate === yesterdayIso ? count + 1 : 1
  return { ...state, streak: { count: nextCount, lastDate: today } }
}

export function addXp(state: ProgressState, amount: number): ProgressState {
  const xp = state.xp + amount
  return { ...state, xp, level: levelForXp(xp) }
}

/** 日付が変わっていたら newToday をリセットしつつ、今日あと何件新規を出してよいか返す。 */
export function dailyNewRemaining(state: ProgressState, today: string, cap = DAILY_NEW_CAP): number {
  if (state.newToday.date !== today) return cap
  return Math.max(0, cap - state.newToday.count)
}

export interface RecordAnswerResult {
  state: ProgressState
  xpGained: number
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

/** 1問への回答結果を進捗に反映する。isReview は復習出題だったか（新規出題なら false）。 */
export function recordAnswer(
  state: ProgressState,
  workId: string,
  type: QuestionType,
  answer: AnswerKind,
  isReview: boolean,
  today: string,
): RecordAnswerResult {
  const correct = answer === 'correct'
  const isFirstExposure = !state.items[workId]
  const baseItem: ItemProgress = state.items[workId] ?? createItemProgress(today)
  const wasMastered = state.items[workId] ? isFirstExposureSafeMastered(state.items[workId]) : false
  const updatedItem = applyItemAnswer(baseItem, type, answer, today)

  const newToday =
    isFirstExposure && state.newToday.date === today
      ? { date: today, count: state.newToday.count + 1 }
      : isFirstExposure
        ? { date: today, count: 1 }
        : state.newToday

  const xpGained = correct ? (isReview ? XP_REVIEW_CORRECT : XP_CORRECT) : 0
  const withXp = addXp(state, xpGained)

  const nextState: ProgressState = {
    ...withXp,
    items: { ...withXp.items, [workId]: updatedItem },
    newToday,
  }

  return {
    state: nextState,
    xpGained,
    isNewDiscovery: !baseItem.discoveredAt && Boolean(updatedItem.discoveredAt),
    isNewlyMastered: !wasMastered && Boolean(updatedItem.masteredAt),
  }
}

function isFirstExposureSafeMastered(item: ItemProgress): boolean {
  return Boolean(item.masteredAt)
}
