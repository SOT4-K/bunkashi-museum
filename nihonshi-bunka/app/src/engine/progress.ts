// localStorage 上の進捗（`bunkashi.v1`）の読み書き・XP/レベル/ストリーク更新。DESIGN.md 5〜6章。
// スキーマ変更時は STORAGE_VERSION を上げ、migrate() に移行ロジックを足す（既存データは消さない）。
import { applyItemAnswer, createItemProgress, todayIso } from './srs'
import { addMiss, applyReviewOutcome } from './missLog'
import { clearThreshold, emptyEraStageProgress, emptyStageState, getEraStageProgress, segmentKey, type StageLocalKey } from './stages'
import type { AnswerKind, ItemProgress, MissLogEntry, MockExamRecord, ProgressState, QuestionType, StageState } from '../types'

export const STORAGE_KEY = 'bunkashi.v1'
// v2: ItemProgress に q4/q6/q8（DESIGN.md 10章）を追加。フィールドは optional なので
// 既存データはそのまま読める。version の値だけ更新し、items は変換不要（migrate で拾う）。
// v3: missLog（間違いノート。M2-23）を追加。既存データには無いため migrate() で [] を補う。
// v4: stages（ステージ制。M2b-01。s1/s2/s3/boss固定4マス）を追加。
// v5: stages を可変面数（EraStageProgress。M2b-04 v2）に作り直し。decisions.md
//     2026-09-08「v2公開時に進捗を全リセットする」に従い、v5未満のデータは移行せず
//     全リセットする（面の分割自体が変わるため意味のある移行ができない）。
export const STORAGE_VERSION = 5 as const

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

/** M2b v2「再挑戦はXP半分」（9/8オーナー確認済みの既定⑤）。既にクリア済みの面・ボスを
 *  再挑戦するときに recordAnswer の xpMultiplier に渡す値。呼び出し側（App.tsx）が
 *  「このステージは既にクリア済みか」を判定して選ぶ（progress.ts 自身は「今どのステージを
 *  プレイ中か」を知らないため、ここでは値の定義だけを持つ）。 */
export const RETRY_XP_MULTIPLIER = 0.5

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
    resetNotice: false,
    examRecords: [],
  }
}

/** 模試タブの記録の保持上限（無制限に増やさない。決め打ち。推移グラフは直近が見えれば十分）。 */
export const EXAM_RECORDS_MAX = 30

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

/**
 * version 違い・壊れたデータを吸収して現行スキーマに揃える。
 * v5未満（旧M2bのs1/s2/s3/boss固定4マス）は decisions.md 2026-09-08「v2公開時に進捗を
 * 全リセットする」に従い、意味のある移行を試みず全リセットする（面の分割自体が変わるため）。
 * このとき resetNotice を true にし、UI（M2b-05）が起動時に1回だけ通知を出せるようにする
 * （チケット規則7）。壊れたデータ（isValidProgress が false）は「旧バージョンの進捗を検出」
 * とは呼べないため resetNotice は立てない（真の初回インストールと区別できないため）。
 */
export function migrate(raw: unknown, today: string = todayIso()): ProgressState {
  if (!isValidProgress(raw)) return createInitialProgress(today)
  if (raw.version < STORAGE_VERSION) return { ...createInitialProgress(today), resetNotice: true }
  // v3 で missLog を追加。version が一致していても（手作りの fixture 等で）フィールドが
  // 無い可能性があるため、必ず補う（既存データは消さない）。
  const missLog: MissLogEntry[] = Array.isArray((raw as Partial<ProgressState>).missLog)
    ? (raw as ProgressState).missLog
    : []
  const stagesRaw = (raw as Partial<ProgressState>).stages
  // reviewer指摘M2b-99軽1の修正（M2b-01から引き継ぎ）: stages の中身が era ごとに「一部の
  // 段しか無い」形（手編集の fixture や将来のスキーマ差分）だと、StageMapScreen/StageScreen
  // の `.boss.cleared` 等のアクセスで undefined 参照エラーになり画面全体が落ちていた。
  // era ごとに emptyEraStageProgress() とマージして常に segments/boss が揃った形にする。
  const stages: ProgressState['stages'] =
    stagesRaw && typeof stagesRaw === 'object' && !Array.isArray(stagesRaw)
      ? Object.fromEntries(
          Object.entries(stagesRaw).map(([eraId, entry]) => [
            eraId,
            { ...emptyEraStageProgress(), ...(entry && typeof entry === 'object' ? entry : {}) },
          ]),
        )
      : {}
  const resetNotice = typeof (raw as Partial<ProgressState>).resetNotice === 'boolean' ? (raw as ProgressState).resetNotice : false
  const examRecords: MockExamRecord[] = Array.isArray((raw as Partial<ProgressState>).examRecords)
    ? (raw as ProgressState).examRecords
    : []
  return { ...raw, missLog, stages, resetNotice, examRecords }
}

/** resetNotice を消費する（M2b-05が通知を1回出した直後に呼び、saveProgress し直す想定）。 */
export function acknowledgeResetNotice(state: ProgressState): ProgressState {
  return state.resetNotice ? { ...state, resetNotice: false } : state
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

/**
 * 1問への回答結果を進捗に反映する。isReview は復習出題だったか（新規出題なら false）。
 * xpMultiplier は M2b v2「再挑戦はXP半分」（9/8オーナー確認済みの既定⑤）用。省略時は1
 * （既存の全呼び出し元＝本番モード・間違い復習・ステージ初回挑戦は変更なし）。SRS・図鑑
 * （discoveredAt/masteredAt）・間違いノートは xpMultiplier に関わらず通常どおり更新する
 * （既定⑤「SRS/図鑑は通常更新」）。XP のみ Math.round(基本XP × xpMultiplier) にする。
 */
export function recordAnswer(
  state: ProgressState,
  workId: string,
  type: QuestionType,
  answer: AnswerKind,
  isReview: boolean,
  today: string,
  xpMultiplier = 1,
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

  const xpGained = correct ? Math.round((isReview ? XP_REVIEW_CORRECT : XP_CORRECT) * xpMultiplier) : 0
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

/** cleared 判定と StageState の更新だけを行う（recordStageResult の共通部分）。 */
function applyStageResult(
  prevStage: StageState,
  correctCount: number,
  total: number,
  today: string,
): { next: StageState; newlyCleared: boolean } {
  const cleared = total > 0 && correctCount >= clearThreshold(total)
  const newlyCleared = cleared && !prevStage.cleared
  return {
    next: {
      cleared: prevStage.cleared || cleared,
      bestScore: Math.max(prevStage.bestScore, correctCount),
      clearedAt: cleared ? today : prevStage.clearedAt,
    },
    newlyCleared,
  }
}

/**
 * ステージ制（M2b-01→M2b-04 v2）の1面/ボスの結果を進捗に反映する。cleared は
 * clearThreshold(total) 以上正解したかどうか。一度 cleared になったら以降再挑戦して
 * 未達でも false には戻らない。bestScore は自己ベスト、clearedAt はクリアした最新の日付
 * （クリアするたびに更新する。初回クリア日を残したい場合は別途ログが必要だが、DESIGN.md に
 * その要件は無いため「最新のクリア日」とした＝判断が必要なら要確認）。ボスを初めてクリアした
 * ときは XP_BOSS_CLEAR を付与する（DESIGN.md 5章「時代ボス突破200XP」）。
 * key は engine/stages.ts の StageLocalKey（{kind:'segment',difficulty,segment} または
 * {kind:'boss'}）。M2b-01の固定 StageKey（'s1'|'s2'|'s3'|'boss'）から置き換え
 * （面数が可変になったため。BOARD.md M2b-04）。
 */
export function recordStageResult(
  state: ProgressState,
  eraId: string,
  key: StageLocalKey,
  correctCount: number,
  total: number,
  today: string,
): ProgressState {
  const prevEra = getEraStageProgress(state.stages, eraId)
  if (key.kind === 'boss') {
    const { next, newlyCleared } = applyStageResult(prevEra.boss, correctCount, total, today)
    const withStages: ProgressState = { ...state, stages: { ...state.stages, [eraId]: { ...prevEra, boss: next } } }
    return newlyCleared ? addXp(withStages, XP_BOSS_CLEAR) : withStages
  }
  const segKey = segmentKey(key.difficulty, key.segment)
  const prevStage = prevEra.segments[segKey] ?? emptyStageState()
  const { next } = applyStageResult(prevStage, correctCount, total, today)
  return {
    ...state,
    stages: { ...state.stages, [eraId]: { ...prevEra, segments: { ...prevEra.segments, [segKey]: next } } },
  }
}

/**
 * 模試タブ（M2b-07）の1回分の記録を追加する。EXAM_RECORDS_MAX を超えたら古い方から捨てる
 * （推移グラフ・記録一覧は直近が見えれば十分。無制限に localStorage を肥大化させない）。
 */
export function recordExamResult(state: ProgressState, record: MockExamRecord): ProgressState {
  const next = [...state.examRecords, record]
  const trimmed = next.length > EXAM_RECORDS_MAX ? next.slice(next.length - EXAM_RECORDS_MAX) : next
  return { ...state, examRecords: trimmed }
}
