// 設問文（stem）の型カタログからの生成。BOARD.md M2e-02:
//  「模試モードとボスモードは、ただリード文を出して適当に問題を出しているように見える」
//  （オーナー指摘 2026-09-09）を受け、下線部と設問文を必ず対応させる。
//
// 正本は research/stem-patterns.md 2章（P1〜P18。日大過去問4年分の実読から抽出したテンプレート）。
// ここでは type（QuestionType）ごとに、そのテンプレートに最も近い定型文を1つ選んで実装する
// （writer が ask.stem を手書きしていない下線・writer の手が回っていない下線でも、
// 「下線部◯」を欠かない設問文を機械的に作れるようにするための既定値。writer 手書きの
// ask.stem は常にこれより優先される＝engine/themeSet.ts の withStem／このファイルの
// 呼び出し元を参照）。
//
// 2系統:
//  - underlineStem: 下線部を参照する（P1〜P17 系。research/stem-patterns.md 2章）
//  - standaloneStem: 下線を参照しない単独問題（下線に紐づかない作品の補充用。BOARD.md M2e-02
//    「passage で覆えない作品は下線を参照しない単独問題として出す」）。作品名は書かない
//    （画像・作品自体はヒーロー画像等で既に見えているため、文面側で答えを追加露出させない）。
import type { QuestionType } from '../types'

export interface StemOptions {
  /** q4: true で「最も不適切なもの」、q13: true で「誤っている組合せ」（PassageUnderlineAsk.reversed と同じ意味）。 */
  reversed?: boolean
  /** q9 の出題文（例:「作者が葛飾北斎であるもの」）。engine/q9.ts の conditionText。 */
  conditionText?: string
}

const DEFAULT_Q9_CONDITION = '条件に合う作品'

/** 下線部を参照する設問文（research/stem-patterns.md 2章のテンプレート。P番号はコメントで対応を示す）。 */
export function underlineStem(type: QuestionType, underlineKey: string, opts: StemOptions = {}): string {
  const key = `下線部${underlineKey}`
  switch (type) {
    case 'q1': // P3 系（下線部◯に該当する語句を選ぶ、単一解）
      return `${key}に該当する作品の名称として最も適切なものを、次のうちから選べ。`
    case 'q2': // P1 系
      return `${key}に該当する作品が属する文化として最も適切なものを、次のうちから選べ。`
    case 'q3': // P9 系（選択肢自体が図版）
      return `${key}に該当する作品を、次の図版のうちから選べ。`
    case 'q4': // P2 系
      return opts.reversed
        ? `${key}に関する記述として最も適切でないものを、次のうちから選べ。`
        : `${key}に関する記述として最も適切なものを、次のうちから選べ。`
    case 'q5': // M2i ★2（画像→作者）
      return `${key}に該当する作品の作者として最も適切なものを、次のうちから選べ。`
    case 'q6': // P1 系
      return `${key}と同じ時代の文化に属する事項として最も適切なものを、次のうちから選べ。`
    case 'q8': // P3 系（組合せ）
      return `${key}に関して、作者（建立者）と様式（宗教背景）の組合せとして正しいものを、次のうちから選べ。`
    case 'q9': // P8/P10 系（下線部＋図版＋条件）
      return `${key}に関して、${opts.conditionText ?? DEFAULT_Q9_CONDITION}を、次の図版のうちから選べ。`
    case 'q10': // P5 系
      return `${key}に関する次のA・Bの記述の正誤の組合せとして正しいものを、次のうちから選べ。`
    case 'q12': // P6/P7 系（文字4択、writer 手書きが基本だが未設定時の既定値）
      return `${key}について、最も適切なものを、次のうちから選べ。`
    case 'q13': // P3/P17 系（語句の組合せ）
      return opts.reversed
        ? `${key}に該当する語句の組合せとして誤っているものを、次のうちから選べ。`
        : `${key}に該当する語句の組合せとして正しいものを、次のうちから選べ。`
    case 'q14': // P12/P14 系（年代順）
      return `${key}に関連する出来事を年代の古い順に正しく並べたものを、次のうちから選べ。`
    default:
      return `${key}に関して、最も適切なものを、次のうちから選べ。`
  }
}

/**
 * 下線を参照しない単独問題の設問文（BOARD.md M2e-02: passage で覆えない作品の補充用）。
 * 作品名・図柄の名称そのものは書かない（画像は既にヒーロー画像等で見えているため、文面側で
 * 答えを追加露出させない。research/stem-patterns.md 6章「答えの手掛かり度」と同じ考え方）。
 */
export function standaloneStem(type: QuestionType, opts: StemOptions = {}): string {
  switch (type) {
    case 'q1':
      return 'この作品の名称として最も適切なものを、次のうちから選べ。'
    case 'q2':
      return 'この作品が属する文化として最も適切なものを、次のうちから選べ。'
    case 'q3':
      return 'この作品に該当する図版を、次のうちから選べ。'
    case 'q4':
      return opts.reversed
        ? 'この作品に関する記述として最も適切でないものを、次のうちから選べ。'
        : 'この作品に関する記述として最も適切なものを、次のうちから選べ。'
    case 'q5':
      return 'この作品の作者として最も適切なものを、次のうちから選べ。'
    case 'q6':
      return 'この作品と同じ時代の文化に属する事項として最も適切なものを、次のうちから選べ。'
    case 'q8':
      return '作者（建立者）と様式（宗教背景）の組合せとして正しいものを、次のうちから選べ。'
    case 'q9':
      return `${opts.conditionText ?? DEFAULT_Q9_CONDITION}を、次の図版のうちから選べ。`
    case 'q10':
      return '次のA・Bの記述の正誤の組合せとして正しいものを、次のうちから選べ。'
    case 'q12':
      return '最も適切なものを、次のうちから選べ。'
    case 'q13':
      return opts.reversed
        ? '語句の組合せとして誤っているものを、次のうちから選べ。'
        : '語句の組合せとして正しいものを、次のうちから選べ。'
    case 'q14':
      return '正しい制作順を、次のうちから選べ。'
    default:
      return '最も適切なものを、次のうちから選べ。'
  }
}

/** underlineKey があれば underlineStem、無ければ standaloneStem（呼び出し側の分岐をまとめた便宜関数）。 */
export function buildEngineStem(type: QuestionType, underlineKey: string | undefined, opts: StemOptions = {}): string {
  return underlineKey ? underlineStem(type, underlineKey, opts) : standaloneStem(type, opts)
}
