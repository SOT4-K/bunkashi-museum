// localStorage 上の進捗（`bunkashi.v1`）の読み書き・XP/レベル/ストリーク更新。DESIGN.md 5〜6章。
// スキーマ変更時は STORAGE_VERSION を上げ、migrate() に移行ロジックを足す（既存データは消さない）。
import { applyItemAnswer, createItemProgress, todayIso } from './srs'
import { addMiss, applyReviewOutcome } from './missLog'
import { clearThreshold, emptyEraStageState, type StageKey } from './stages'
import type { AnswerKind, ItemProgress, MissLogEntry, ProgressState, QuestionType, StageState } from '../types'

export const STORAGE_KEY = 'bunkashi.v1'
// v2: ItemProgress に q4/q6/q8（DESIGN.md 10章）を追加。フィールドは optional なので
// 既存データはそのまま読める。version の値だけ更新し、items は変換不要（migrate で拾う）。
// v3: missLog（間違いノート。M2-23）を追加。既存データには無いため migrate() で [] を補う。
// v4: stages（ステージ制。M2b-01）を追加。既存データには無いため migrate() で {} を補う。
export const STORAGE_VERSION = 4 as const

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
    stages: {},
    newToday: { date: today, count: 0 },
    missLog: [],
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
  // v3 で missLog、v4 で stages を追加。version が一致していても（手作りの fixture 等で）
  // フィールドが無い可能性があるため、version 分岐に関わらず必ず補う（既存データは消さない）。
  const missLog: MissLogEntry[] = Array.isArray((raw as Partial<ProgressState>).missLog)
    ? (raw as ProgressState).missLog
    : []
  const stagesRaw = (raw as Partial<ProgressState>).stages
  // reviewer指摘M2b-99軽1の修正: stages の中身が era ごとに「一部の段しか無い」形（手編集の
  // fixture や将来のスキーマ差分）だと、StageMapScreen/StageScreen の `es.boss.cleared` 等の
  // アクセスで undefined 参照エラーになり画面全体が落ちていた。era ごとに emptyEraStageState()
  // とマージして常に s1/s2/s3/boss が揃った形にする。
  const stages: ProgressState['stages'] =
    stagesRaw && typeof stagesRaw === 'object' && !Array.isArray(stagesRaw)
      ? Object.fromEntries(
          Object.entries(stagesRaw).map(([eraId, entry]) => [
            eraId,
            { ...emptyEraStageState(), ...(entry && typeof entry === 'object' ? entry : {}) },
          ]),
        )
      : {}
  if (raw.version === STORAGE_VERSION) return { ...raw, missLog, stages }
  // 将来 version が上がったらここに変換を追加する。
  return { ...createInitialProgress(today), ...raw, missLog, stages, version: STORAGE_VERSION }
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

/**
 * 間違いノートに1件追加/更新する（M2-23。ランダム学習・本番モードで「不正解」「わからない」を
 * 選んだときに呼ぶ。文化別練習は呼び出し側がそもそも呼ばない＝記録しない）。
 * ロジック本体は engine/missLog.ts（純関数、progress の他フィールドに依存しない）。
 */
export function recordMiss(
  state: ProgressState,
  workId: string,
  type: QuestionType,
  today: string,
  passageId?: string,
  underlineKey?: string,
): ProgressState {
  return { ...state, missLog: addMiss(state.missLog, workId, type, today, passageId, underlineKey) }
}

/**
 * 間違いノート復習セッションでの1問の結果を反映する（M2-23）。2回連続正解でノートから外す。
 */
export function recordMissReviewOutcome(state: ProgressState, workId: string, correct: boolean): ProgressState {
  return { ...state, missLog: applyReviewOutcome(state.missLog, workId, correct) }
}

/**
 * ステージ制（M2b-01）の1マス分の結果を進捗に反映する。cleared は ceil(0.9×total) 以上
 * 正解したかどうか（engine/stages.ts の clearThreshold）。一度 cleared になったら以降
 * 再挑戦して未達でも false には戻らない。bestScore は自己ベスト、clearedAt はクリアした
 * 最新の日付（クリアするたびに更新する。初回クリア日を残したい場合は別途ログが必要だが、
 * DESIGN.md にその要件は無いため「最新のクリア日」とした＝判断が必要なら要確認）。
 * ボスを初めてクリアしたときは XP_BOSS_CLEAR を付与する（DESIGN.md 5章「時代ボス突破
 * 200XP」。定数自体は以前から存在したが、呼び出し箇所が無かったためこのチケットで配線する）。
 */
export function recordStageResult(
  state: ProgressState,
  eraId: string,
  key: StageKey,
  correctCount: number,
  total: number,
  today: string,
): ProgressState {
  const cleared = total > 0 && correctCount >= clearThreshold(total)
  const prevEra = state.stages[eraId] ?? emptyEraStageState()
  const prevStage = prevEra[key]
  const newlyCleared = cleared && !prevStage.cleared
  const nextStage: StageState = {
    cleared: prevStage.cleared || cleared,
    bestScore: Math.max(prevStage.bestScore, correctCount),
    clearedAt: cleared ? today : prevStage.clearedAt,
  }
  const withStages: ProgressState = {
    ...state,
    stages: { ...state.stages, [eraId]: { ...prevEra, [key]: nextStage } },
  }
  return key === 'boss' && newlyCleared ? addXp(withStages, XP_BOSS_CLEAR) : withStages
}
