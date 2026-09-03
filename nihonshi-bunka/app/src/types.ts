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

/** DESIGN.md 10章「誤文の作り方」で使うスロット。'other' は値の同一性を機械判定できない自由記述。 */
export type FactSlot = 'artist' | 'patron' | 'style' | 'religion' | 'technique' | 'location' | 'era' | 'period' | 'other'

/** 正文の部品。同じ内容が他作品にも当てはまるときは shared に相手の work id を列挙する
 *  （Q4 の誤文候補からその作品由来の facts を除外するために使う）。 */
export interface WorkFact {
  slot: FactSlot | string
  text: string
  shared?: string[]
}

/** あらかじめ writer/reviewer が検証した誤文。verifiedFalse でない誤文は本番に出さない。 */
export interface WorkFalseStatement {
  text: string
  why: string
  verifiedFalse: boolean
}

export interface Work {
  /** この作品では出さない設問型（reviewer 指摘で個別に無効化したもの。content 側で指定） */
  skipTypes?: QuestionType[]

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
  /** 作者（正規化）。author は表示用に残す。DESIGN.md 10章 Q5/Q8 用 */
  artist: string | null
  /** 建立者・発願者 */
  patron: string | null
  /** 様式 */
  style: string | null
  /** 思想背景（宗派など） */
  religion: string | null
  /** 「平安時代中期（11世紀）」のような時代表記。解説シート先頭に表示する */
  periodLabel: string
  /** この作品と時代の結びつきの説明（2〜3文） */
  eraNote: string
  /** 正文の部品（Q4 の正解・誤文除外判定に使う） */
  facts: WorkFact[]
  /** 検証済みの誤文（Q4 の誤文の第一候補） */
  falseStatements: WorkFalseStatement[]
}

/** eras.json の items[].category（自由記述に近いが代表的な値）。 */
export type EraItemCategory = 'literature' | 'religion' | 'person' | 'style' | 'scholarship' | 'other'

export interface EraItem {
  text: string
  category: EraItemCategory | string
}

export interface Era {
  id: string
  name: string
  period: string
  order: number
  summary: string
  /** 時代と文化の説明（3〜5文）。解説シート・作品詳細の折りたたみに使う */
  detail: string
  /** その文化に属する代表事項（Q6 の正文・誤文の元） */
  items: EraItem[]
}

// --- 出題 ---

/**
 * Q1: 画像→作品名 / Q2: 画像→文化 / Q3: 作品名→画像
 * Q4: 画像→関連記述の正誤 / Q6: 画像→同時代の事項 / Q8: 画像→作者×様式の組合せ文
 * （DESIGN.md 10章。Q5/Q7/⑨ は試験実例未確認のため実装しない）
 */
export type QuestionType = 'q1' | 'q2' | 'q3' | 'q4' | 'q6' | 'q8'

/**
 * 回答の種類。'unknown' は4択の下の「わからない」ボタン（当てずっぽうで誤答選択肢を
 * 「正しい」と誤って記憶してしまう negative suggestion effect への対策。DESIGN.md 3章4項）。
 * SRS 上は 'incorrect' と同じく箱を0に戻す（不正解扱い）。
 */
export type AnswerKind = 'correct' | 'incorrect' | 'unknown'

/** Q4 の選択肢1件。correct=false のとき why に理由（falseStatements.why、または他作品由来の注記）を持つ。 */
export interface StatementOption {
  text: string
  correct: boolean
  why: string | null
}

/** Q6 の選択肢1件。文化名を添えて表示する。 */
export interface EraItemOption {
  text: string
  correct: boolean
  eraId: string
  eraName: string
}

/** Q8 の選択肢1件（「{artist/patron}・{style/religion/technique}」の組合せ文）。 */
export interface ComboOption {
  text: string
  correct: boolean
}

export interface Question {
  /** 同セッション内の再出題（誤答後）。再出題は 1 作品 1 回まで */
  isRetry?: boolean
  type: QuestionType
  work: Work
  /** 選択肢（4件、シャッフル済み）。Q2 は era id の配列を choices として扱う */
  choiceWorks: Work[]
  /** Q2 のときの選択肢（era id）。Q1/Q3 のときは undefined */
  choiceEras?: Era[]
  /** Q4 のときの選択肢（4件、シャッフル済み） */
  choiceStatements?: StatementOption[]
  /** Q6 のときの選択肢（4件、シャッフル済み） */
  choiceEraItems?: EraItemOption[]
  /** Q8 のときの選択肢（4件、シャッフル済み） */
  choiceCombos?: ComboOption[]
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
  /** q4/q6/q8 は作品ごとに生成できるとは限らないため、初めてその型が出題された時点で作る。
   *  「所蔵」の判定は q1〜q3 の3方向のまま（DESIGN.md 10章5項）。SRS の型を bunkashi.v2 に拡張。 */
  q4?: SrsCell
  q6?: SrsCell
  q8?: SrsCell
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
  /** 1: q1/q2/q3 のみ。2: ItemProgress に q4/q6/q8 を追加（DESIGN.md 10章） */
  version: 1 | 2
  xp: number
  level: number
  streak: StreakState
  items: Record<string, ItemProgress>
  bosses: Record<string, BossState>
  newToday: NewTodayState
}
