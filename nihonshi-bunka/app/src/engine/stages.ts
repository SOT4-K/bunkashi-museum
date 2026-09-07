// ステージ制（マリオ型）。オーナー発案 2026-09-07（BOARD.md M2b-01）:
//  文化を古い順にワールド化し、設問の型による3段の難易度のステージと、テーマセット形式の
//  ボスを置く。既存データ（15区分・全区分reviewedテーマセット・型11種）で成立させる。
//  難易度は「設問の型」で定義する（コンテンツは触らない）。既存の session.ts / themeSet.ts の
//  生成器と canGenerateType をそのまま流用し、新しい生成ロジックは最小限にする。
//
// チケット文面の難易度定義（実装漏れ防止のためそのまま転記。builder メモ
// 「依頼文の規則はdocstringに番号で転記してから完了報告する」）:
//  ★1 見分ける＝Q1 画像→作品名・Q3 作品名→画像
//  ★2 結びつける＝Q2 画像→文化・Q4 関連記述の正誤・Q6 同時代の事項・Q9 条件に合う画像・Q12 文化名当て
//  ★3 組み合わせて判断＝Q8 組合せ文・Q10 2文正誤・Q13 語句の組合せ・Q14 年代順
//
// 注記（低確信点。完了報告にも明記）: Q12（画像なし文字4択）は writer が passage の下線に
// 手書きした answerText/distractorTexts が無いと生成できない（engine/q12.ts）。ステージは
// 特定の passage に紐づかず「その文化の出題可能作品」から直接生成するため、Q12 は型リストに
// 残すが実際には常に生成 0 件になる（★2 は q2/q4/q6/q9 の4型で成立する）。ボス（テーマセット
// 経由）では Q12 が出うる。
//
// 構造（チケット文面）: ワールド W = eras.json の順。ステージ W-1(★1)→W-2(★2)→W-3(★3)→W-ボス。
//  ステージ＝最大10問（その文化の出題可能作品から、その段の型だけで生成。同じ作品×同じ型は
//  1ステージ1回まで。10問作れない文化は5問以上で成立させ、クリア閾値は ceil(0.9×問数)）。
//  段の型が1問も作れない文化はその段を「なし」と表示して飛ばす（呼び出し側が0件で判定）。
//  ボス＝10問固定: その文化のreviewedテーマセット1本（2本以上あれば毎回ランダム）＋残りを
//  本番モード生成器をその文化に限定して補う（型配分は本番どおり）。クリア＝9/10以上。
//
// 解禁・ワープ: W-1から順に解禁。ステージクリアで次のステージ、ボス撃破で次のワールド。
//  ワープ: 未解禁ワールドのボスにも直接挑戦でき、撃破すればそのワールドはクリア扱い
//  （W-1〜3は後から遊べる＝ボス撃破後は全ステージが解禁される）。
import { buildQuestion, canGenerateType } from './session'
import { buildChoices, shuffle, type RandomFn } from './distractors'
import { generateStatementPairQuestion } from './statementPair'
import { generatePairQuestion } from './pairs'
import { generateOrderQuestion } from './order'
import { buildThemeSetQuestions, buildThemeQuestionForWork, pickThemeTargetId, COMPOSITION_SEQUENCE } from './themeSet'
import type { Era, EraStageState, Passage, PassageUnderline, Question, QuestionType, StageState, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** 「生成できるか／何件作れるか」だけを知りたいとき用の決定的 rng（session.ts の
 *  PROBE_RANDOM と同じ考え方）。StageMapScreen の件数表示・「なし」判定・テストで使う。
 *  実際のプレイ用の乱数には使わない（毎回同じ問題になってしまう）。 */
export const PROBE_RANDOM: RandomFn = () => 0

export type Difficulty = 1 | 2 | 3
export type StageKey = 's1' | 's2' | 's3' | 'boss'

export const DIFFICULTY_TYPES: Record<Difficulty, QuestionType[]> = {
  1: ['q1', 'q3'],
  2: ['q2', 'q4', 'q6', 'q9', 'q12'],
  3: ['q8', 'q10', 'q13', 'q14'],
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '★1 見分ける',
  2: '★2 結びつける',
  3: '★3 組み合わせて判断',
}

export const STAGE_SIZE_MAX = 10
/** 10問作れない文化は5問以上で成立させる（チケット文面）。実際に生成できた数がこれ未満に
 *  なることはある（実データでの下振れは完了報告に明記する）。「なし」判定は0件のときだけ。 */
export const STAGE_SIZE_TARGET_MIN = 5

export const BOSS_SIZE = 10

/** クリア閾値 = ceil(0.9 × 問数)。ボス(10問固定)も ceil(9)=9 で同じ式に一致する。 */
export function clearThreshold(questionCount: number): number {
  return Math.ceil(questionCount * 0.9)
}

export function emptyStageState(): StageState {
  return { cleared: false, bestScore: 0, clearedAt: null }
}

export function emptyEraStageState(): EraStageState {
  return { s1: emptyStageState(), s2: emptyStageState(), s3: emptyStageState(), boss: emptyStageState() }
}

/** stages に該当 era のエントリが無いとき用のデフォルト値を補って返す（未プレイ扱い）。 */
export function getEraStageState(stages: Record<string, EraStageState>, eraId: string): EraStageState {
  return stages[eraId] ?? emptyEraStageState()
}

/** ワールド順（eras.json の order 昇順）の eraId 一覧。 */
export function worldOrder(eras: Era[]): string[] {
  return [...eras].sort((a, b) => a.order - b.order).map((e) => e.id)
}

// --- Q10/Q13/Q14 の直接生成（session.ts の canGenerateType/buildQuestion は
// テーマセット専用としてこの3型を常に false/null にするため、themeSet.ts と同じ考え方で
// 各型の生成器を直接呼ぶ） ---

function buildStatementPairQuestion(work: Work, pool: Work[], rng: RandomFn): Question | null {
  const pair = generateStatementPairQuestion(work, pool, rng)
  if (!pair) return null
  return {
    type: 'q10',
    work,
    choiceWorks: [],
    choicePairLabels: pair.labels,
    statementPair: { sentenceA: pair.sentenceA, sentenceB: pair.sentenceB },
    correctIndex: pair.correctIndex,
    isReview: false,
  }
}

function buildWordPairQuestion(work: Work, pool: Work[], rng: RandomFn): Question | null {
  const data = generatePairQuestion(work, pool, rng)
  if (!data) return null
  const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
  return { type: 'q13', work, choiceWorks: [], choiceWordPairs: items, correctIndex, isReview: false, reversed: false }
}

/** Q14（年代順）は1問が3作品にまたがるため、単一作品×型のループでは扱えない。
 *  era 内の orderIndex 保持作品から、使い切るまで（3件そろわなくなるまで）繰り返し作る。
 *  「同じ作品×同じ型は1ステージ1回まで」は、一度使った3件を候補から除外することで守る。 */
function buildOrderQuestions(eraWorks: Work[], eras: Era[], rng: RandomFn, maxCount: number): Question[] {
  const out: Question[] = []
  let remaining = eraWorks.filter((w) => typeof w.orderIndex === 'number')
  while (remaining.length >= 3 && out.length < maxCount) {
    const data = generateOrderQuestion(remaining, rng, 3, eras)
    if (!data) break
    const usedIds = new Set(data.displayItems.map((d) => d.work.id))
    remaining = remaining.filter((w) => !usedIds.has(w.id))
    const nominalWork = data.displayItems[0].work
    out.push({
      type: 'q14',
      work: nominalWork,
      choiceWorks: [],
      choiceStatements: data.choices,
      correctIndex: data.correctIndex,
      isReview: false,
      orderItems: data.displayItems,
    })
  }
  return out
}

/**
 * eraId・difficulty から、その段の型だけで最大 STAGE_SIZE_MAX 問を作る
 * （同じ作品×同じ型は1回まで）。pool は content.ts の themeSetPool 相当（distractor 素材。
 * 画像なし項目も含む）、imagePool は playableWorks 相当（出題対象自身は画像必須）。
 * 0問しか作れないときは空配列（呼び出し側は「なし」として飛ばす）。
 */
export function buildStageQuestions(
  eraId: string,
  difficulty: Difficulty,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
): Question[] {
  const types = DIFFICULTY_TYPES[difficulty]
  const eraWorks = shuffle(
    imagePool.filter((w) => w.era === eraId),
    rng,
  )
  const questions: Question[] = []

  for (const work of eraWorks) {
    for (const type of types) {
      // q12: 生成不能（上記コメント参照）。q14: 複数作品にまたがるため下で個別処理。
      if (type === 'q12' || type === 'q14') continue
      let q: Question | null = null
      if (type === 'q10') q = buildStatementPairQuestion(work, pool, rng)
      else if (type === 'q13') q = buildWordPairQuestion(work, pool, rng)
      else if (canGenerateType(type, work, pool, eras)) q = buildQuestion(work, type, pool, eras, false, rng)
      if (q) questions.push(q)
    }
  }
  if (types.includes('q14')) {
    questions.push(...buildOrderQuestions(eraWorks, eras, rng, STAGE_SIZE_MAX))
  }
  return shuffle(questions, rng).slice(0, STAGE_SIZE_MAX)
}

interface EraCandidate {
  passage: Passage
  underline: PassageUnderline
  work: Work
}

/** mockExam.ts の buildCandidatePool と同じ考え方だが、渡された passages（呼び出し側で
 *  該当 era に絞り込み済み）だけを対象にする。 */
function buildEraCandidatePool(eraPassages: Passage[], pool: Work[]): EraCandidate[] {
  const availableIds = new Set(pool.map((w) => w.id))
  const byId = new Map(pool.map((w) => [w.id, w]))
  const out: EraCandidate[] = []
  for (const passage of eraPassages) {
    for (const underline of passage.underlines) {
      const targetId = pickThemeTargetId(underline, passage, availableIds)
      if (!targetId) continue
      const work = byId.get(targetId)
      if (!work) continue
      out.push({ passage, underline, work })
    }
  }
  return out
}

/**
 * ボス（10問固定）: その文化の reviewed テーマセット1本（2本以上あれば毎回ランダムに選ぶ）
 * ＋残りを本番モード生成器（themeSet.ts）をその文化の passage に限定して補う
 * （型配分は本番どおり＝ COMPOSITION_SEQUENCE を使う）。
 * その文化に reviewed passage が1つも無ければ空配列を返す（呼び出し側は「ボスを作れない」と
 * 扱う。実データでは全15区分に最低1本あることを stages.realdata.test.ts で確認している）。
 */
export function buildBossQuestions(
  eraId: string,
  passages: Passage[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  count = BOSS_SIZE,
): Question[] {
  const eraPassages = passages.filter((p) => p.era === eraId)
  if (eraPassages.length === 0) return []
  const chosenPassage = eraPassages[Math.floor(rng() * eraPassages.length)]

  // 1本の passage の中で複数の下線が同じ作品を対象にすることがある（実データで確認済み。
  // stages.realdata.test.ts で検出）。「同じ作品は1回の試験で1問まで」（mockExam.ts と同じ
  // 規則）をここでも守るため、テーマセット内で先に出た方だけを残す。
  const themeQuestions: Question[] = []
  const themeSeenIds = new Set<string>()
  for (const tq of buildThemeSetQuestions(chosenPassage, pool, eras, rng, imagePool)) {
    if (themeSeenIds.has(tq.question.work.id)) continue
    themeSeenIds.add(tq.question.work.id)
    themeQuestions.push({ ...tq.question, passageId: chosenPassage.id, underlineKey: tq.underlineKey })
  }
  const built: Question[] = themeQuestions.slice(0, count)
  const usedWorkIds = new Set(built.map((q) => q.work.id))

  if (built.length < count) {
    const candidates = shuffle(buildEraCandidatePool(eraPassages, pool), rng)
    let previousType: QuestionType | undefined = built.length > 0 ? built[built.length - 1].type : undefined
    let avoidEraSlot = built.some((q) => q.type === 'q9' && q.q9Slot === 'era')
    for (const candidate of candidates) {
      if (built.length >= count) break
      if (usedWorkIds.has(candidate.work.id)) continue
      const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
      const question = buildThemeQuestionForWork(candidate.work, pool, eras, rng, {
        ask: candidate.underline.ask,
        avoidEraSlot,
        avoidType: previousType,
        imagePool,
        desiredCategory,
      })
      if (!question) continue
      usedWorkIds.add(candidate.work.id)
      if (question.q9Slot === 'era') avoidEraSlot = true
      previousType = question.type
      built.push({ ...question, passageId: candidate.passage.id, underlineKey: candidate.underline.key })
    }
  }
  return built
}

// --- 解禁・ワープ（純関数） ---

/** ワールド（worldIndex、0始まり）が解禁されているか。0番目は常に解禁。以降は直前ワールドの
 *  ボス撃破（bossCleared）が条件。ワープで先にボスだけ倒した場合もここでカウントされる
 *  （bosses[eraId].cleared を見ているだけで、経路は問わない）。 */
export function isWorldUnlocked(worldIndex: number, worlds: string[], stages: Record<string, EraStageState>): boolean {
  if (worldIndex <= 0) return true
  const prevEraId = worlds[worldIndex - 1]
  if (prevEraId === undefined) return false
  return getEraStageState(stages, prevEraId).boss.cleared
}

/** ステージ（1〜3）が解禁されているか。ワールドが解禁済みで、かつ
 *  ①1番目のステージ、②直前のステージをクリア済み、③そのワールドのボスを既に撃破済み
 *  （ワープでボスを先に倒した後は「W-1〜3は後から遊べる」＝全ステージ解禁）のいずれか。 */
export function isStageUnlocked(
  worldIndex: number,
  stageNum: 1 | 2 | 3,
  worlds: string[],
  stages: Record<string, EraStageState>,
): boolean {
  if (!isWorldUnlocked(worldIndex, worlds, stages)) return false
  const eraId = worlds[worldIndex]
  if (eraId === undefined) return false
  const es = getEraStageState(stages, eraId)
  if (stageNum === 1) return true
  if (es.boss.cleared) return true
  const prevStage = stageNum === 2 ? es.s1 : es.s2
  return prevStage.cleared
}

/** ボスは常にワープ挑戦できる（ワールドの解禁状態やステージの完了状況を問わない）。
 *  「なし」（そもそも生成できない）かどうかは呼び出し側が buildBossQuestions の件数で判定する。 */
export function isBossChallengeable(): boolean {
  return true
}
