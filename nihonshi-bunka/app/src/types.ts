// content/ の JSON スキーマに対応する型。DESIGN.md 6章を参照。

/** kind: artifact（省略時デフォルト）の視覚カテゴリ。ディストラクタ選定（同カテゴリ優先）に使う。
 *  kind: person/text/concept は出題プールに入らずディストラクタ選定に使われないため、
 *  category に "literature" 等の自由記述の値を持つことがある（validate-content.mjs 参照）。 */
export type Category =
  | 'architecture'
  | 'sculpture'
  | 'painting'
  | 'craft'
  | 'calligraphy'
  | 'garden'
  | 'other'
  | (string & {})

export type Status = 'draft' | 'reviewed'

/**
 * 出題プールに入るかどうかの区別（M2 チケット「テーマセット」拡張）。
 * 'artifact'（省略時デフォルト）=画像で出題する通常の作品。
 * 'person' | 'text' | 'concept' =画像を持たない項目（人物・著作・宗派・様式など）。
 * これらは単独では出題せず、リード文・誤文・Q9 の条件の素材としてのみ使う
 * （content.ts の playableWorks から除外する）。
 */
export type WorkKind = 'artifact' | 'person' | 'text' | 'concept'

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

  /** 省略時は 'artifact'。person/text/concept は出題プールから除外する（types.ts WorkKind 参照） */
  kind?: WorkKind

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
  /** 所蔵・安置先（寺院＋堂など）。Q9 の条件生成に使う（mock-exam-analysis.md T-C） */
  holder?: string | null
  /** 絵巻・絵図などの主題（誰の物語か、何の場面か）。null 可 */
  subject?: string | null
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
  /** 自由出題・時代ボスの出題頻度の重み（省略時は1として扱う。原始は0.5などで比重を下げる） */
  weight?: number
}

// --- リード文＋下線部（テーマセット。decisions.md 2026-09-04「模試型」） ---

/** 下線部から出す設問の希望（mock-exam-analysis.md 7章「修正の仕様」）。省略時は engine が
 *  優先順位（Q9→Q10→Q8→Q4→Q1）で決める。指定した type/slot で生成できなければ次善に落ちる
 *  （必ず値を返す。エラーにしない）。 */
export interface PassageUnderlineAsk {
  /** Q9 の条件スロット（engine/q9.ts の Q9Slot のうち ask で指定できるもの＋subject）。 */
  slot: 'holder' | 'artist' | 'technique' | 'era' | 'subject'
  /** q11 は M3 候補で未実装（生成できないので次善に落ちる）。 */
  type: 'q9' | 'q10' | 'q4' | 'q11'
}

/** リード文中の1つの下線部。text 内の `[[key|下線テキスト]]` マーカーに対応する。 */
export interface PassageUnderline {
  key: string
  /** この下線から出題する作品（先頭から見て、出題プールにある最初の作品を対象にする） */
  workIds: string[]
  note?: string
  /** この下線から出したい設問の型・条件スロット（省略可）。M2-09〜11 修正の仕様。 */
  ask?: PassageUnderlineAsk
}

export interface Passage {
  id: string
  era: string
  title: string
  /** `[[key|下線テキスト]]` マーカーを含む本文（200〜400字目安） */
  text: string
  sources: string[]
  underlines: PassageUnderline[]
}

// --- 出題 ---

/**
 * Q1: 画像→作品名 / Q2: 画像→文化 / Q3: 作品名→画像
 * Q4: 画像→関連記述の正誤 / Q6: 画像→同時代の事項 / Q8: 画像→作者×様式の組合せ文
 * （DESIGN.md 10章。Q5/Q7/⑨ は試験実例未確認のため実装しない）
 * Q9: 画像4枚（選択肢）から条件に合う/合わない1枚を選ぶ（mock-exam-analysis.md T-C。M2 チケットで新設）
 * Q10: 2文（A・B）の正誤組合せ 4択（正正/正誤/誤正/誤誤）。mock-exam-analysis.md T-A（最頻出）に対応。
 *   DESIGN.md 10章の既存 Q8（組合せ文形式。「正正/正誤ラベルは使わない」方針）とは別物。
 *   decisions.md 2026-09-04（模試型テーマセット）は「Q8 2文正誤」と表現しているが、
 *   既存 Q8 の型・挙動を変えると自由出題側が壊れるため、新しい型番号 q10 として追加した
 *   （テーマセットのみで使用。命名の妥当性はオーナー確認事項として報告する）。
 */
export type QuestionType = 'q1' | 'q2' | 'q3' | 'q4' | 'q6' | 'q8' | 'q9' | 'q10'

/** Q9 の条件スロット（作者・時代文化・所蔵・様式・製法）。engine/q9.ts が生成ロジックを持つ
 *  （型はここで定義し、q9.ts から re-export する。types.ts が engine に依存しないため）。 */
export type Q9Slot = 'artist' | 'era' | 'holder' | 'style' | 'technique'

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

/** Q10 の1文（A または B）。実際に表示される文とその真偽・理由。 */
export interface StatementPairSentence {
  text: string
  actuallyTrue: boolean
  why: string | null
}

export interface Question {
  /** 同セッション内の再出題（誤答後）。再出題は 1 作品 1 回まで */
  isRetry?: boolean
  type: QuestionType
  work: Work
  /** 選択肢（4件、シャッフル済み）。Q2 は era id の配列を choices として扱う。Q9 も Work の画像4枚 */
  choiceWorks: Work[]
  /** Q2 のときの選択肢（era id）。Q1/Q3 のときは undefined */
  choiceEras?: Era[]
  /** Q4 のときの選択肢（4件、シャッフル済み） */
  choiceStatements?: StatementOption[]
  /** Q6 のときの選択肢（4件、シャッフル済み） */
  choiceEraItems?: EraItemOption[]
  /** Q8 のときの選択肢（4件、シャッフル済み） */
  choiceCombos?: ComboOption[]
  /** Q10 のときの4択ラベル（固定順「正正/正誤/誤正/誤誤」） */
  choicePairLabels?: string[]
  /** Q10 のときの2文（A・B） */
  statementPair?: { sentenceA: StatementPairSentence; sentenceB: StatementPairSentence }
  /** Q9 の出題文（例:「作者が葛飾北斎であるもの」）。Q4 reversed のときは「最も不適切なもの」の意 */
  conditionText?: string
  /** Q9 のとき実際に使われた条件スロット。自由出題で era 条件を連続させないための内部情報
   *  （表示には使わない。修正の仕様 M2-09〜11）。 */
  q9Slot?: Q9Slot
  /** Q9/Q4 の逆パターン（「合わない1枚」「最も不適切なもの」）かどうか */
  reversed?: boolean
  correctIndex: number
  /** 復習出題か新規出題か（XP計算・表示に使う） */
  isReview: boolean
  /** テーマセット出題のとき、元になったリード文の下線キー（文脈再表示に使う） */
  passageId?: string
  underlineKey?: string
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
  /** q4/q6/q8/q9/q10 は作品ごとに生成できるとは限らないため、初めてその型が出題された時点で作る。
   *  「所蔵」の判定は q1〜q3 の3方向のまま（DESIGN.md 10章5項）。SRS の型を bunkashi.v2 に拡張。 */
  q4?: SrsCell
  q6?: SrsCell
  q8?: SrsCell
  q9?: SrsCell
  q10?: SrsCell
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
