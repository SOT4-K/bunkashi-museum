// テーマセット（リード文＋下線部→図版問題）の組み立て。decisions.md 2026-09-04「模試型」
// と mock-exam-analysis.md 7章「修正の仕様（M2-09〜11）」:
//  下線部ごとに、対象作品から図版問題を自動生成する。優先順位は
//  Q9（画像4枚から条件）→ Q10（2文正誤）→ Q8（組合せ文）→ Q4（関連記述、正/逆パターン）→
//  Q1（画像→作品名、必ず生成できる保険）。
//  下線に ask（{ slot, type }）があれば、その type を最優先で試す（生成できなければ
//  上記の優先順位に落ちる。ask.slot は Q9 の条件スロットのヒントとして使う）。
//  制約:
//   - era をスロットにする Q9 は1セットに1問まで（一度使ったら以降は avoidSlots で避ける）
//   - 同じ型を連続させない（生成時に直前の型を avoidType として渡し、それでも同型しか
//     作れなければ許容する。仕上げに順序の入れ替えでも解消を試みる）
//   - セット内に Q10 を1問以上・Q9 を1問以上（生成後、無ければ生成可能な下線を探して強制的に作り直す）
//  生成できない下線（対象作品が出題プールに無い）はスキップし、console.warn で知らせる
//  （エラーにしない。M2 チケット「進め方」）。
import { buildChoices, type RandomFn } from './distractors'
import { buildQuestion } from './session'
import { generateStatementQuestion } from './statements'
import { generateComboQuestion } from './combos'
import { generateQ9Question, type Q9Slot } from './q9'
import { generateStatementPairQuestion } from './statementPair'
import { pickUnderlineTargetId } from './passage'
import type { Era, Passage, PassageUnderline, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

export interface ThemeQuestion {
  underlineKey: string
  question: Question
}

export interface ThemeBuildOptions {
  /** この下線の ask（省略時は engine が優先順位で決める）。 */
  ask?: { slot?: string; type?: string }
  /** true のとき Q9 の era スロットを試さない（1セットに1問までの制約）。 */
  avoidEraSlot?: boolean
  /** この型はできれば避ける（直前の設問と同じ型で連続させないため）。生成できる型が
   *  他に無ければ最終的にはこの型も使う（同型連続よりは何か出す方を優先する）。 */
  avoidType?: QuestionType
  /** true のとき Q9 を試さない（同じ作品が同セット内で既に Q9 の正解に使われている。
   *  reviewer 指摘 [中]-1, 2026-09-04 M2-11: 画像1件しか無い区分では同じ画像を正解とする
   *  Q9 が複数回出て「同じ問題が無限に出る」ように見える）。 */
  avoidQ9?: boolean
}

interface BuildResult {
  question: Question
  /** type が q9 のときに実際に使われたスロット（era 1問制限の判定に使う）。 */
  q9Slot?: Q9Slot
}

function isQ9Slot(value: string | undefined): value is Q9Slot {
  return value === 'holder' || value === 'artist' || value === 'technique' || value === 'era' || value === 'style'
}

/** 1作品に対して、優先順位（＋ ask・avoid オプション）に従って生成できる最初の設問を作る。q1 は必ず生成できる保険。 */
function buildThemeQuestionForWorkWithMeta(
  work: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: ThemeBuildOptions,
): BuildResult {
  const { ask, avoidEraSlot = false, avoidType, avoidQ9 = false } = opts
  const askSlot = isQ9Slot(ask?.slot) ? ask?.slot : undefined
  const avoidSlotsForQ9: Q9Slot[] = avoidEraSlot ? ['era'] : []

  const tryQ9 = (): BuildResult | null => {
    if (avoidQ9) return null
    const data = generateQ9Question(work, pool, eras, rng, { avoidSlots: avoidSlotsForQ9, preferredSlot: askSlot })
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correctWork, data.distractorWorks, rng)
    return {
      question: {
        type: 'q9',
        work,
        choiceWorks: items,
        correctIndex,
        isReview: false,
        conditionText: data.conditionText,
        reversed: data.reversed,
        q9Slot: data.slot,
      },
      q9Slot: data.slot,
    }
  }

  const tryQ10 = (): BuildResult | null => {
    const pair = generateStatementPairQuestion(work, pool, rng)
    if (!pair) return null
    return {
      question: {
        type: 'q10',
        work,
        choiceWorks: [],
        choicePairLabels: pair.labels,
        statementPair: { sentenceA: pair.sentenceA, sentenceB: pair.sentenceB },
        correctIndex: pair.correctIndex,
        isReview: false,
      },
    }
  }

  const tryQ8 = (): BuildResult | null => {
    const combo = generateComboQuestion(work, pool, rng)
    if (!combo) return null
    const { items, correctIndex } = buildChoices(combo.correct, combo.distractors, rng)
    return { question: { type: 'q8', work, choiceWorks: [], choiceCombos: items, correctIndex, isReview: false } }
  }

  const tryQ4 = (): BuildResult | null => {
    const statement = generateStatementQuestion(work, pool, rng)
    if (!statement) return null
    const { items, correctIndex } = buildChoices(statement.correct, statement.distractors, rng)
    return {
      question: { type: 'q4', work, choiceWorks: [], choiceStatements: items, correctIndex, isReview: false, reversed: false },
    }
  }

  const tryQ4Reversed = (): BuildResult | null => {
    const reversedStatement = generateStatementQuestion(work, pool, rng, { reversed: true })
    if (!reversedStatement) return null
    const { items, correctIndex } = buildChoices(reversedStatement.correct, reversedStatement.distractors, rng)
    return {
      question: { type: 'q4', work, choiceWorks: [], choiceStatements: items, correctIndex, isReview: false, reversed: true },
    }
  }

  const q1Fallback = (): BuildResult => ({ question: buildQuestion(work, 'q1', pool, eras, false, rng) })

  // ask.type があれば最優先で試す（生成できなければ次善の優先順位に落ちる）。
  // q11 は M3 候補で未実装のため、常に次善に落ちる。
  if (ask?.type === 'q9') {
    const r = tryQ9()
    if (r) return r
  } else if (ask?.type === 'q10') {
    const r = tryQ10()
    if (r) return r
  } else if (ask?.type === 'q4') {
    const r = tryQ4() ?? tryQ4Reversed()
    if (r) return r
  }

  // 通常の優先順位: Q9→Q10→Q8→Q4→Q4逆→Q1。avoidType はできれば避けるが、
  // 他に生成できる型が無ければ最終的には使う（同型連続よりは何か出す方を優先する）。
  const order: { type: QuestionType; build: () => BuildResult | null }[] = [
    { type: 'q9', build: tryQ9 },
    { type: 'q10', build: tryQ10 },
    { type: 'q8', build: tryQ8 },
    { type: 'q4', build: tryQ4 },
    { type: 'q4', build: tryQ4Reversed },
  ]

  for (const { type, build } of order) {
    if (avoidType && type === avoidType) continue
    const r = build()
    if (r) return r
  }
  if (avoidType) {
    for (const { build } of order) {
      const r = build()
      if (r) return r
    }
  }
  return q1Fallback()
}

/** 1作品に対して、優先順位に従って生成できる最初の設問を作る。q1 は必ず生成できる保険。
 *  ask・avoid オプションが要る場合は buildThemeSetQuestions を使う（内部では
 *  buildThemeQuestionForWorkWithMeta を使う）。 */
export function buildThemeQuestionForWork(
  work: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  opts: ThemeBuildOptions = {},
): Question {
  return buildThemeQuestionForWorkWithMeta(work, pool, eras, rng, opts).question
}

interface BuiltItem {
  underline: PassageUnderline
  target: Work
  result: BuildResult
}

/** 型が同じ要素が隣り合わないよう、可能な範囲で入れ替える（best-effort。完全には解消できないこともある）。 */
function reorderToAvoidConsecutiveSameType(items: BuiltItem[]): BuiltItem[] {
  const arr = items.slice()
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].result.question.type !== arr[i - 1].result.question.type) continue
      let swapIdx = -1
      for (let j = i + 1; j < arr.length; j++) {
        if (arr[j].result.question.type !== arr[i - 1].result.question.type) {
          swapIdx = j
          break
        }
      }
      if (swapIdx === -1) continue
      const tmp = arr[i]
      arr[i] = arr[swapIdx]
      arr[swapIdx] = tmp
      changed = true
    }
    if (!changed) break
  }
  return arr
}

/**
 * passage の下線部ごとに図版問題を組み立てる。対象作品が pool（出題プール）に無い下線はスキップする。
 * pool は「出題に使える作品」（画像あり・kind が artifact のもの）を渡す想定
 * （content.ts の playableWorks。person/text/concept は自動的に対象から外れる）。
 */
export function buildThemeSetQuestions(passage: Passage, pool: Work[], eras: Era[], rng: RandomFn = defaultRandom): ThemeQuestion[] {
  const byId = new Map(pool.map((w) => [w.id, w]))
  const availableIds = new Set(pool.map((w) => w.id))

  const items: BuiltItem[] = []
  let eraSlotUsed = false
  let previousType: QuestionType | undefined
  // reviewer 指摘 [中]-1（2026-09-04 M2-11）: 画像1件しか無い区分（kitayama/momoyama 等）では
  // 同じ作品を正解とする Q9 が複数回出てしまう。同一作品の2回目以降の Q9 は避ける。
  const q9UsedWorkIds = new Set<string>()

  for (const underline of passage.underlines) {
    const targetId = pickUnderlineTargetId(underline, availableIds)
    const target = targetId ? byId.get(targetId) : undefined
    if (!target) {
      console.warn(
        `[themeSet] passage "${passage.id}" underline "${underline.key}": 出題プールに対象作品が無い（workIds: ${underline.workIds.join(', ')}）。スキップする。`,
      )
      continue
    }
    const result = buildThemeQuestionForWorkWithMeta(target, pool, eras, rng, {
      ask: underline.ask,
      avoidEraSlot: eraSlotUsed,
      avoidType: previousType,
      avoidQ9: q9UsedWorkIds.has(target.id),
    })
    if (result.q9Slot === 'era') eraSlotUsed = true
    if (result.question.type === 'q9') q9UsedWorkIds.add(target.id)
    previousType = result.question.type
    items.push({ underline, target, result })
  }

  // セット内に Q9 を1問以上（無ければ、生成可能な下線を探して Q9 優先で作り直す）。
  // 1下線しか無いセットでは「1問以上」の意味が薄く、唯一の設問（ask で明示的に選ばれたものかも
  // しれない）を強制的に上書きしてしまうため対象外にする。
  if (items.length >= 2 && !items.some((it) => it.result.question.type === 'q9')) {
    for (const it of items) {
      const forced = buildThemeQuestionForWorkWithMeta(it.target, pool, eras, rng, {
        ask: { ...it.underline.ask, type: 'q9' },
        avoidEraSlot: eraSlotUsed,
      })
      if (forced.question.type === 'q9') {
        if (forced.q9Slot === 'era') eraSlotUsed = true
        it.result = forced
        break
      }
    }
  }

  // セット内に Q10 を1問以上（無ければ、生成可能な下線を探して Q10 優先で作り直す）。
  // reviewer 指摘 [中]-4（2026-09-04 M2-11）: このループが「その項目が現在 q9 かどうか」を
  // 見ずに差し替えると、直前の Q9 強制ループで作った（セット唯一の）Q9 を消しかねない。
  // セット内の q9 が1件しかない場合は、その項目を Q10 強制の対象から除外する。
  if (items.length >= 2 && !items.some((it) => it.result.question.type === 'q10')) {
    const q9Count = items.filter((it) => it.result.question.type === 'q9').length
    for (const it of items) {
      if (q9Count <= 1 && it.result.question.type === 'q9') continue
      const forced = buildThemeQuestionForWorkWithMeta(it.target, pool, eras, rng, {
        ask: { ...it.underline.ask, type: 'q10' },
      })
      if (forced.question.type === 'q10') {
        it.result = forced
        break
      }
    }
  }

  const ordered = reorderToAvoidConsecutiveSameType(items)

  return ordered.map(({ underline, result }) => ({
    underlineKey: underline.key,
    question: { ...result.question, passageId: passage.id, underlineKey: underline.key },
  }))
}
