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
import { buildChoices, shuffle, type RandomFn } from './distractors'
import { buildQuestion, selectReviewCandidates } from './session'
import { generateStatementQuestion } from './statements'
import { generateComboQuestion } from './combos'
import { generateQ9Question, generateQ9QuestionFromIds, type Q9Slot } from './q9'
import { generateQ12Question } from './q12'
import { generateStatementPairQuestion } from './statementPair'
import { pickUnderlineTargetId } from './passage'
import { isItemMastered } from './srs'
import type { Era, Passage, PassageUnderline, PassageUnderlineAsk, ProgressState, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

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
}

interface BuildResult {
  question: Question
  /** type が q9 のときに実際に使われたスロット（era 1問制限の判定に使う）。 */
  q9Slot?: Q9Slot
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
    // 8章「二段構え」: writer が answerId/distractorIds を指定していれば、それを最優先で
    // 使う（algorithmic な条件選定は試さない）。answerId が pool に無い・distractorIds が
    // 不足で埋まらない場合は null（＝生成失敗）とし、呼び出し側で次善の型にフォールバックさせる。
    if (ask?.answerId) {
      const explicit = generateQ9QuestionFromIds(pool, ask.answerId, ask.distractorIds, eras, rng)
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

  // Q12（画像なし文字4択。9章「画像リード型セット」）: ask.answerText/distractorTexts が
  // そろっているときだけ生成できる。writer 手書きのため engine は選択肢の合成をしない。
  const tryQ12 = (): BuildResult | null => {
    const data = generateQ12Question(ask, rng)
    if (!data) return null
    return {
      question: { type: 'q12', work, choiceWorks: [], choiceQ12: data.choices, correctIndex: data.correctIndex, isReview: false },
    }
  }

  const q1Fallback = (): BuildResult => ({ question: buildQuestion(work, 'q1', pool, eras, false, rng) })

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
    const targetId = pickThemeTargetId(underline, passage, availableIds)
    const target = targetId ? byId.get(targetId) : undefined
    if (!target) {
      // workIds が無い（kind:"image" の q12 下線、9章）ことがあるため join 前に防御する。
      console.warn(
        `[themeSet] passage "${passage.id}" underline "${underline.key}": 出題プールに対象作品が無い（workIds: ${(underline.workIds ?? []).join(', ')}）。スキップする。`,
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
  // Hayato 修正（2026-09-04 M2-13 統合時）: kind:"image"（9章「画像リード型セット」）は
  // 「Q10・Q4・Q12・Q9のいずれか」を writer が意図的に混ぜる設計で、Q9/Q10 各1問以上の
  // 制約（8章、text 型セット向け）は課されていない。この強制ループが writer 手書きの
  // q12（answerText/distractorTexts）を q9/q10 に上書きすると、stem は「(1)を描いた
  // 絵師は」のような文字4択の文面のまま、選択肢だけが画像4枚に化けて意味が壊れる
  // （実データ kasei-image-01 で確認）。kind:"image" では強制しない。
  const forceQ9AndQ10 = passage.kind !== 'image'
  if (forceQ9AndQ10 && items.length >= 2 && !items.some((it) => it.result.question.type === 'q9')) {
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
  if (forceQ9AndQ10 && items.length >= 2 && !items.some((it) => it.result.question.type === 'q10')) {
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
