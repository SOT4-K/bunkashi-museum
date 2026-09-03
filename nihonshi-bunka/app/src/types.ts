// content/ の JSON スキーマに対応する型。DESIGN.md 6章を参照。

export type Category =
  | 'architecture'
  | 'sculpture'
  | 'painting'
  | 'craft'
  | 'calligraphy'
  | 'garden'
  | 'other'

export type Status = 'draft' | 'reviewed'

export interface Confusable {
  id: string
  howToTell: string
}

export interface WorkImage {
  file: string
  credit: string
  license: string
  sourceUrl: string
  sourceName: string
}

export interface Work {
  id: string
  title: string
  reading: string
  era: string
  category: Category
  location: string
  author: string | null
  technique: string
  keyPoints: string[]
  explanation: string
  examNote?: string
  confusables: Confusable[]
  image: WorkImage
  sources: string[]
  examTags: string[]
  status: Status
}

export interface Era {
  id: string
  name: string
  period: string
  order: number
  summary: string
}

// --- 出題 ---

/** Q1: 画像→作品名 / Q2: 画像→文化 / Q3: 作品名→画像 */
export type QuestionType = 'q1' | 'q2' | 'q3'

/**
 * 回答の種類。'unknown' は4択の下の「わからない」ボタン（当てずっぽうで誤答選択肢を
 * 「正しい」と誤って記憶してしまう negative suggestion effect への対策。DESIGN.md 3章4項）。
 * SRS 上は 'incorrect' と同じく箱を0に戻す（不正解扱い）。
 */
export type AnswerKind = 'correct' | 'incorrect' | 'unknown'

export interface Question {
  type: QuestionType
  work: Work
  /** 選択肢（4件、シャッフル済み）。Q2 は era id の配列を choices として扱う */
  choiceWorks: Work[]
  /** Q2 のときの選択肢（era id）。Q1/Q3 のときは undefined */
  choiceEras?: Era[]
  correctIndex: number
  /** 復習出題か新規出題か（XP計算・表示に使う） */
  isReview: boolean
}

// --- 進捗（localStorage） ---

export interface SrsCell {
  box: number // 0-5
  due: string // ISO date (YYYY-MM-DD)
  correct: number
  wrong: number
}

export interface ItemProgress {
  q1: SrsCell
  q2: SrsCell
  q3: SrsCell
  discoveredAt: string | null
  masteredAt: string | null
}

export interface StreakState {
  count: number
  lastDate: string | null
}

export interface BossState {
  cleared: boolean
  bestScore: number
}

export interface NewTodayState {
  date: string
  count: number
}

export interface ProgressState {
  version: 1
  xp: number
  level: number
  streak: StreakState
  items: Record<string, ItemProgress>
  bosses: Record<string, BossState>
  newToday: NewTodayState
}
