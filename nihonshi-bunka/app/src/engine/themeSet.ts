// テーマセット（リード文＋下線部→図版問題）の組み立て。decisions.md 2026-09-04「模試型」
// と mock-exam-analysis.md 7章「修正の仕様（M2-09〜11）」・2・5章「出題配分を本番に合わせる
// （M2-16）」:
//  下線部ごとに、対象作品から設問を自動生成する。優先順位は
//  Q9（画像4枚から条件）→ Q10（2文正誤）→ Q8（組合せ文）→ Q4（関連記述、正/逆パターン）→
//  Q13（語句の組合せ）→ Q1（画像→作品名、対象が画像を持つときだけの保険）。
//  下線に ask（{ slot, type }）があれば、その type を最優先で試す（生成できなければ
//  上記の優先順位に落ちる。ask.slot は Q9 の条件スロットのヒントとして使う）。
//  M2-16: セット内の型構成を本番の配分（語句組合せ1・2文正誤1・4択1・適切/不適切1・図版1）に
//  近づけるため、下線の位置ごとに「狙う型カテゴリ」（COMPOSITION_SEQUENCE）を割り当て、
//  ask が無い下線ではそのカテゴリを優先順位より先に試す（失敗すれば通常の優先順位に落ちる。
//  厳密な固定順ではなく目安）。
//  M2-16: 画像を持たない項目（kind: person/text/concept）も pool（文字問題の素材・対象）に
//  含める。ただし画像が要る型（Q9・Q1 の保険）は、対象が画像を持つ作品のときだけ試す
//  （imagePool で判定。既定は pool と同じ＝後方互換）。
//  制約:
//   - era をスロットにする Q9 は1セットに1問まで（一度使ったら以降は avoidSlots で避ける）
//   - 同じ型を連続させない（生成時に直前の型を avoidType として渡し、それでも同型しか
//     作れなければ許容する。仕上げに順序の入れ替えでも解消を試みる）
//   - セット内に Q10 を1問以上・Q9 を1問以上（生成後、無ければ生成可能な下線を探して強制的に作り直す）
//  生成できない下線（対象作品が出題プールに無い、または画像も facts/pairs も無く
//  どの型も生成できない）はスキップし、console.warn で知らせる（エラーにしない。M2 チケット「進め方」）。
import { buildChoices, shuffle, type RandomFn } from './distractors'
import { buildQuestion, selectReviewCandidates } from './session'
import { generateStatementQuestion } from './statements'
import { generateComboQuestion } from './combos'
import { generateQ9Question, generateQ9QuestionFromIds, type Q9Slot } from './q9'
import { generateQ12Question } from './q12'
import { generateStatementPairQuestion } from './statementPair'
import { generatePairQuestion } from './pairs'
import { generateOrderQuestion } from './order'
import { pickUnderlineTargetId } from './passage'
import { isItemMastered } from './srs'
import type { Era, Passage, PassageUnderline, PassageUnderlineAsk, ProgressState, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** M2-16: 1セットの型構成の目安（本番配分。analysis 5.1章）。下線の位置（0始まり）に
 *  index % length で割り当てる。5個の下線を持つセットなら各カテゴリちょうど1回になる。
 *  厳密な固定順ではない: ask で明示指定があればそちらが優先され、狙った型が生成できなければ
 *  通常の優先順位（Q9→Q10→Q8→Q4→Q13→Q1）に落ちる。 */
type ThemeCategory = 'pairs' | 'q10' | 'q4' | 'q4-reversed' | 'image'
const COMPOSITION_SEQUENCE: ThemeCategory[] = ['pairs', 'q10', 'q4', 'q4-reversed', 'image']

function desiredCategoryForIndex(index: number): ThemeCategory {
  return COMPOSITION_SEQUENCE[index % COMPOSITION_SEQUENCE.length]
}

export interface ThemeQuestion {
  underlineKey: string
  question: Question
}

export interface ThemeBuildOptions {
  /** この下線の ask（省略時は engine が優先順位で決める）。8章「二段構え」・9章「画像リード型」の
   *  stem/answerId/distractorIds/answerText/distractorTexts も含む。 */
  ask?: PassageUnderlineAsk
  /** true のとき Q9 の era スロットを試さない（1セットに1問までの制約）。 */
  avoidEraSlot?: boolean
  /** この型はできれば避ける（直前の設問と同じ型で連続させないため）。生成できる型が
   *  他に無ければ最終的にはこの型も使う（同型連続よりは何か出す方を優先する）。 */
  avoidType?: QuestionType
  /** true のとき Q9 を試さない（同じ作品が同セット内で既に Q9 の正解に使われている。
   *  reviewer 指摘 [中]-1, 2026-09-04 M2-11: 画像1件しか無い区分では同じ画像を正解とする
   *  Q9 が複数回出て「同じ問題が無限に出る」ように見える）。 */
  avoidQ9?: boolean
  /** 画像で出題できる作品だけのプール（Q9・Q1 の保険の候補・distractor に使う）。省略時は
   *  pool と同じ（既存呼び出し・テストとの後方互換。M2-16 で pool に画像なし項目
   *  〔kind: person/text/concept〕を含められるようにしたため、Q9/Q1 のような画像が要る型は
   *  この imagePool だけを見る）。 */
  imagePool?: Work[]
  /** M2-16: この下線に割り当てたい型構成カテゴリ（COMPOSITION_SEQUENCE）。ask が無いときだけ、
   *  通常の優先順位より先に試す（失敗すれば通常の優先順位に落ちる。best-effort）。 */
  desiredCategory?: ThemeCategory
}

interface BuildResult {
  question: Question
  /** type が q9 のときに実際に使われたスロット（era 1問制限の判定に使う）。 */
  q9Slot?: Q9Slot
}

/** work.id が imagePool に含まれるか（＝画像で出題できるか）。 */
function isImageEligible(work: Work, imagePool: Work[]): boolean {
  return imagePool.some((w) => w.id === work.id)
}

function isQ9Slot(value: string | undefined): value is Q9Slot {
  return value === 'holder' || value === 'artist' || value === 'technique' || value === 'era' || value === 'style'
}

/** ask.stem を BuildResult の question に付与する。8章「二段構え」: ask.type で明示的に
 *  指定した型が実際に生成できたときだけ使う（次善の型にフォールバックしたときは、
 *  stem がその型の文面と噛み合わないため付けない）。 */
function withStem(result: BuildResult | null, stem: string | undefined): BuildResult | null {
  if (!result || !stem) return result
  return { ...result, question: { ...result.question, stem } }
}

/** 1作品に対して、優先順位（＋ ask・avoid オプション）に従って生成できる最初の設問を作る。
 *  対象が画像を持つ作品（imagePool にある）なら q1 が必ず生成できる保険になるが、画像を
 *  持たない対象（kind: person/text/concept）は facts/falseStatements/pairs が無ければ
 *  null を返すことがある（呼び出し側 buildThemeSetQuestions がその下線をスキップする。M2-16）。 */
function buildThemeQuestionForWorkWithMeta(
  work: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: ThemeBuildOptions,
): BuildResult | null {
  const { ask, avoidEraSlot = false, avoidType, avoidQ9 = false, imagePool = pool, desiredCategory } = opts
  const askSlot = isQ9Slot(ask?.slot) ? ask?.slot : undefined
  const avoidSlotsForQ9: Q9Slot[] = avoidEraSlot ? ['era'] : []
  // M2-16: 対象自身が画像で出題できる作品かどうか（imagePool にあるか）。画像が要る型
  // （Q9・Q1 の保険）は、これが false のときは一切試さない（プレースホルダ SVG が
  // 作品名を描くため、画像を見せると答えが分かってしまう。content.ts の既存注記と同じ理由）。
  const targetIsImageEligible = isImageEligible(work, imagePool)

  const tryQ9 = (): BuildResult | null => {
    if (avoidQ9 || !targetIsImageEligible) return null
    // 8章「二段構え」: writer が answerId/distractorIds を指定していれば、それを最優先で
    // 使う（algorithmic な条件選定は試さない）。answerId が pool に無い・distractorIds が
    // 不足で埋まらない場合は null（＝生成失敗）とし、呼び出し側で次善の型にフォールバックさせる。
    // Q9 の候補・distractor は常に imagePool から選ぶ（画像を持たない項目を選択肢に混ぜない）。
    if (ask?.answerId) {
      const explicit = generateQ9QuestionFromIds(imagePool, ask.answerId, ask.distractorIds, eras, rng)
      if (!explicit) return null
      const { items, correctIndex } = buildChoices(explicit.correctWork, explicit.distractorWorks, rng)
      return {
        question: {
          type: 'q9',
          work,
          choiceWorks: items,
          correctIndex,
          isReview: false,
          conditionText: explicit.conditionText,
          reversed: explicit.reversed,
          q9Slot: explicit.slot,
        },
        q9Slot: explicit.slot,
      }
    }
    const data = generateQ9Question(work, imagePool, eras, rng, { avoidSlots: avoidSlotsForQ9, preferredSlot: askSlot })
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

  // Q12（画像なし文字4択。9章「画像リード型セット」）: ask.answerText/distractorTexts が
  // そろっているときだけ生成できる。writer 手書きのため engine は選択肢の合成をしない。
  const tryQ12 = (): BuildResult | null => {
    const data = generateQ12Question(ask, rng)
    if (!data) return null
    return {
      question: { type: 'q12', work, choiceWorks: [], choiceQ12: data.choices, correctIndex: data.correctIndex, isReview: false },
    }
  }

  // Q13（語句の組合せ。T1。M2-16）: work.pairs が無い/少ない作品では null（engine/pairs.ts）。
  const tryQ13 = (): BuildResult | null => {
    const data = generatePairQuestion(work, pool, rng)
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
    return {
      question: { type: 'q13', work, choiceWorks: [], choiceWordPairs: items, correctIndex, isReview: false, reversed: false },
    }
  }

  const tryQ13Reversed = (): BuildResult | null => {
    const data = generatePairQuestion(work, pool, rng, { reversed: true })
    if (!data) return null
    const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
    return {
      question: { type: 'q13', work, choiceWorks: [], choiceWordPairs: items, correctIndex, isReview: false, reversed: true },
    }
  }

  // q1 は対象が画像を持つ作品のときだけの保険（M2-16: 画像を持たない対象に Q1 は使えない。
  // プレースホルダ SVG が作品名を描くため答えが分かってしまう）。
  const q1Fallback = (): BuildResult | null =>
    targetIsImageEligible ? { question: buildQuestion(work, 'q1', imagePool, eras, false, rng) } : null

  // M2-16: 型構成カテゴリ → 実際に試す関数。
  const tryCategory = (category: ThemeCategory): BuildResult | null => {
    switch (category) {
      case 'pairs':
        return tryQ13() ?? tryQ13Reversed()
      case 'q10':
        return tryQ10()
      case 'q4':
        return tryQ4()
      case 'q4-reversed':
        return tryQ4Reversed()
      case 'image':
        return tryQ9()
    }
  }

  // ask.type があれば最優先で試す（生成できなければ次善の優先順位に落ちる）。
  // ask.stem があれば、実際にその型が生成できたときだけそのまま設問文として使う。
  // q11 は M3 候補で未実装のため、常に次善に落ちる。
  if (ask?.type === 'q9') {
    const r = withStem(tryQ9(), ask.stem)
    if (r) return r
  } else if (ask?.type === 'q10') {
    const r = withStem(tryQ10(), ask.stem)
    if (r) return r
  } else if (ask?.type === 'q4') {
    // reviewer 指摘 [重大]-1（2026-09-04 M2-14）: ask.reversed が無いと通常型が常に先に
    // 試されて必ず成功するため、「最も不適切なもの」を問う stem でも正文に正解フラグが
    // 付き採点が反転する。ask.reversed を尊重して型を固定する（フォールバックしない：
    // 反転して正文が正解のまま出るくらいなら、その下線は次善の型に譲る）。
    const r = withStem(ask.reversed ? tryQ4Reversed() : tryQ4(), ask.stem)
    if (r) return r
  } else if (ask?.type === 'q12') {
    const r = withStem(tryQ12(), ask.stem)
    if (r) return r
  } else if (ask?.type === 'q13') {
    const r = withStem(ask.reversed ? tryQ13Reversed() : tryQ13(), ask.stem)
    if (r) return r
  }

  // M2-16: ask が明示されていない下線は、まず「狙う型カテゴリ」（desiredCategory。
  // COMPOSITION_SEQUENCE）を試す。失敗すれば通常の優先順位に落ちる（best-effort）。
  if (!ask?.type && desiredCategory) {
    const r = tryCategory(desiredCategory)
    if (r) return r
  }

  // 通常の優先順位: Q9→Q10→Q8→Q4→Q4逆→Q13→Q13逆→Q1（画像を持つ対象のみ）。avoidType は
  // できれば避けるが、他に生成できる型が無ければ最終的には使う（同型連続よりは何か出す方を優先する）。
  const order: { type: QuestionType; build: () => BuildResult | null }[] = [
    { type: 'q9', build: tryQ9 },
    { type: 'q10', build: tryQ10 },
    { type: 'q8', build: tryQ8 },
    { type: 'q4', build: tryQ4 },
    { type: 'q4', build: tryQ4Reversed },
    { type: 'q13', build: tryQ13 },
    { type: 'q13', build: tryQ13Reversed },
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

/** 1作品に対して、優先順位に従って生成できる最初の設問を作る。対象が画像を持つ作品なら
 *  q1 が必ず生成できる保険になるが、画像を持たない対象は何も生成できないことがあり、その
 *  ときは null を返す（M2-16）。ask・avoid オプションが要る場合は buildThemeSetQuestions を
 *  使う（内部では buildThemeQuestionForWorkWithMeta を使う）。 */
export function buildThemeQuestionForWork(
  work: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  opts: ThemeBuildOptions = {},
): Question | null {
  return buildThemeQuestionForWorkWithMeta(work, pool, eras, rng, opts)?.question ?? null
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
 * 下線の対象作品 id を決める。通常は underline.workIds（先頭から見て pool にある最初の id）。
 * 9章「画像リード型セット」: passage.kind === "image" では下線に workIds が無くてもよく、
 * その場合は passage.leadWorkIds（リード画像。先頭から見て pool にある最初の id）を対象にする。
 */
export function pickThemeTargetId(underline: PassageUnderline, passage: Passage, availableIds: Set<string>): string | null {
  const fromUnderline = pickUnderlineTargetId(underline, availableIds)
  if (fromUnderline) return fromUnderline
  if (passage.kind === 'image' && passage.leadWorkIds && passage.leadWorkIds.length > 0) {
    return passage.leadWorkIds.find((id) => availableIds.has(id)) ?? null
  }
  return null
}

/**
 * passage の下線部ごとに設問を組み立てる。対象作品が pool に無い下線、または対象はあるが
 * どの型も生成できない下線（画像も facts/falseStatements/pairs も無い）はスキップする。
 * pool は「出題対象・素材にできる作品」（画像あり artifact ＋ 画像なし person/text/concept、
 * M2-16）。imagePool は画像で出題できる作品だけ（省略時は pool と同じ＝既存呼び出しとの
 * 後方互換。content.ts の themeSetPool / playableWorks 参照）。
 */
export function buildThemeSetQuestions(
  passage: Passage,
  pool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  imagePool: Work[] = pool,
): ThemeQuestion[] {
  const byId = new Map(pool.map((w) => [w.id, w]))
  const availableIds = new Set(pool.map((w) => w.id))

  const items: BuiltItem[] = []
  let eraSlotUsed = false
  let previousType: QuestionType | undefined
  // reviewer 指摘 [中]-1（2026-09-04 M2-11）: 画像1件しか無い区分（kitayama/momoyama 等）では
  // 同じ作品を正解とする Q9 が複数回出てしまう。同一作品の2回目以降の Q9 は避ける。
  const q9UsedWorkIds = new Set<string>()

  passage.underlines.forEach((underline, index) => {
    const targetId = pickThemeTargetId(underline, passage, availableIds)
    const target = targetId ? byId.get(targetId) : undefined
    if (!target) {
      // workIds が無い（kind:"image" の q12 下線、9章）ことがあるため join 前に防御する。
      console.warn(
        `[themeSet] passage "${passage.id}" underline "${underline.key}": 出題プールに対象作品が無い（workIds: ${(underline.workIds ?? []).join(', ')}）。スキップする。`,
      )
      return
    }
    const result = buildThemeQuestionForWorkWithMeta(target, pool, eras, rng, {
      ask: underline.ask,
      avoidEraSlot: eraSlotUsed,
      avoidType: previousType,
      avoidQ9: q9UsedWorkIds.has(target.id),
      imagePool,
      desiredCategory: desiredCategoryForIndex(index),
    })
    if (!result) {
      // M2-16: 画像を持たない対象（kind: person/text/concept）で facts/falseStatements/pairs も
      // 無ければ、どの型も生成できない。エラーにせずスキップする（既存の「進め方」どおり）。
      console.warn(
        `[themeSet] passage "${passage.id}" underline "${underline.key}": 対象作品 "${target.id}" からどの型も生成できなかった（画像も facts/falseStatements/pairs も無い）。スキップする。`,
      )
      return
    }
    if (result.q9Slot === 'era') eraSlotUsed = true
    if (result.question.type === 'q9') q9UsedWorkIds.add(target.id)
    previousType = result.question.type
    items.push({ underline, target, result })
  })

  // セット内に Q9 を1問以上（無ければ、生成可能な下線を探して Q9 優先で作り直す）。
  // 1下線しか無いセットでは「1問以上」の意味が薄く、唯一の設問（ask で明示的に選ばれたものかも
  // しれない）を強制的に上書きしてしまうため対象外にする。
  // Hayato 修正（2026-09-04 M2-13 統合時）: kind:"image"（9章「画像リード型セット」）は
  // 「Q10・Q4・Q12・Q9のいずれか」を writer が意図的に混ぜる設計で、Q9/Q10 各1問以上の
  // 制約（8章、text 型セット向け）は課されていない。この強制ループが writer 手書きの
  // q12（answerText/distractorTexts）を q9/q10 に上書きすると、stem は「(1)を描いた
  // 絵師は」のような文字4択の文面のまま、選択肢だけが画像4枚に化けて意味が壊れる
  // （実データ kasei-image-01 で確認）。kind:"image" では強制しない。
  // M2-16: 図版問題（Q9）はセットに必ず1問残す（analysis 7章）。text/person/concept しか
  // 生成できない下線しかない場合は無理に作らない（forced が null のときは何もしない）。
  const forceQ9AndQ10 = passage.kind !== 'image'
  if (forceQ9AndQ10 && items.length >= 2 && !items.some((it) => it.result.question.type === 'q9')) {
    for (const it of items) {
      const forced = buildThemeQuestionForWorkWithMeta(it.target, pool, eras, rng, {
        ask: { ...it.underline.ask, type: 'q9' },
        avoidEraSlot: eraSlotUsed,
        imagePool,
      })
      if (forced && forced.question.type === 'q9') {
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
  if (forceQ9AndQ10 && items.length >= 2 && !items.some((it) => it.result.question.type === 'q10')) {
    const q9Count = items.filter((it) => it.result.question.type === 'q9').length
    for (const it of items) {
      if (q9Count <= 1 && it.result.question.type === 'q9') continue
      const forced = buildThemeQuestionForWorkWithMeta(it.target, pool, eras, rng, {
        ask: { ...it.underline.ask, type: 'q10' },
        imagePool,
      })
      if (forced && forced.question.type === 'q10') {
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

const ORDER_QUESTION_FREQUENCY = 3

/**
 * 年代順並べ替え問題（T7/Q14）を3セットに1問の頻度で末尾に追加する（M2-16）。
 * setIndex は「学習を始める」等で連続提示するテーマセットの通し番号（0始まり）。
 * work.orderIndex が投入されていない/同じ区分に3件そろわない場合は
 * generateOrderQuestion が null を返すため、何もせず questions をそのまま返す
 * （データが揃えば自動的に動き出す。壊れない設計）。
 */
export function appendOrderQuestionIfDue(
  questions: ThemeQuestion[],
  setIndex: number,
  imagePool: Work[],
  rng: RandomFn = defaultRandom,
): ThemeQuestion[] {
  if (questions.length === 0) return questions
  if ((setIndex + 1) % ORDER_QUESTION_FREQUENCY !== 0) return questions
  const data = generateOrderQuestion(imagePool, rng)
  if (!data) return questions
  const nominalWork = data.displayItems[0].work
  const question: Question = {
    type: 'q14',
    work: nominalWork,
    choiceWorks: [],
    choiceStatements: data.choices,
    correctIndex: data.correctIndex,
    isReview: false,
    orderItems: data.displayItems,
  }
  return [...questions, { underlineKey: 'order', question }]
}

/** passage の下線が対象にする作品 id（重複除去）。「学習を始める」のセット選定（下記）で使う。 */
function passageTargetWorkIds(passage: Passage, pool: Work[]): Set<string> {
  const availableIds = new Set(pool.map((w) => w.id))
  const ids = new Set<string>()
  for (const underline of passage.underlines) {
    const id = pickThemeTargetId(underline, passage, availableIds)
    if (id) ids.add(id)
  }
  return ids
}

/**
 * 「学習を始める」（フリー出題）のテーマセット化。mock-exam-analysis.md 9章「『学習を始める』
 * （フリー出題）のテーマセット化（M2-13）」:
 *  ①SRS の期限が来た作品を含むセットを優先 ②残りは習熟の低い区分（eras.json の weight は
 *  平均習熟率の算出には使わない。区分内の所蔵率が低いものを優先する）から選ぶ。
 *  どのセットにも入っていない期限到来作品は、ここでは選ばない（呼び出し側が
 *  テーマセット消化後に通常の自由出題セッションを続けることで、SRS の due 判定に従って
 *  自然に単独出題される。buildSession は毎回その時点の progress を見るため、テーマセットで
 *  既に答えた作品は正解なら due から外れ、誤答ならそのまま due に残る＝二重の特別扱いは不要）。
 */
export function selectLearnThemeSets(
  passages: Passage[],
  pool: Work[],
  eras: Era[],
  progress: ProgressState,
  today: string,
  count = 3,
  rng: RandomFn = defaultRandom,
): Passage[] {
  if (passages.length === 0 || count <= 0) return []

  const dueWorkIds = new Set(selectReviewCandidates(pool, progress, today, rng, eras).map((p) => p.work.id))

  const scored = passages.map((passage) => {
    const targetIds = [...passageTargetWorkIds(passage, pool)]
    const dueCount = targetIds.filter((id) => dueWorkIds.has(id)).length
    const eraWorks = pool.filter((w) => w.era === passage.era)
    const masteredCount = eraWorks.filter((w) => {
      const item = progress.items[w.id]
      return item ? isItemMastered(item) : false
    }).length
    const masteryRatio = eraWorks.length > 0 ? masteredCount / eraWorks.length : 1
    return { passage, dueCount, masteryRatio }
  })

  // ①期限到来作品を含むセットを優先（dueCount 降順。同点はシャッフルで多様性を持たせる）
  const withDue = shuffle(
    scored.filter((s) => s.dueCount > 0),
    rng,
  ).sort((a, b) => b.dueCount - a.dueCount)
  // ②残りは習熟の低い区分から（masteryRatio 昇順）
  const withoutDue = shuffle(
    scored.filter((s) => s.dueCount === 0),
    rng,
  ).sort((a, b) => a.masteryRatio - b.masteryRatio)

  return [...withDue, ...withoutDue].slice(0, count).map((s) => s.passage)
}
