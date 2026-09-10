// ステージ制 v4（★の定義 v4。オーナー指示 2026-09-10 夜、BOARD.md M2i、decisions.md
// 「2026-09-10（夜） ★の定義 v4」）。v3（M2e。★1〜3・下線起点のリード文つき）を置き換える。
//
// チケット文面の規則（実装漏れ防止のためそのまま転記。builder メモ
// 「依頼文の規則はdocstringに番号で転記してから完了報告する」）:
//
// ★の定義 v4（確定。M2i-05〈decisions.md 2026-09-11〉で★3・★4を修正、下記「M2i-05修正」参照）:
//  ★1 名前（Q1 画像→作品名・Q3 作品名→画像）: 全件対象
//  ★2 作者（Q5 画像→作者・Q9 作者→画像）: artist を持つ作品のみ
//  ★3 出土地・所在地（Q9 の findSite/location スロット・Q7 画像→出土地・所在地〈M2i-05③新設〉）:
//    findSite または（holderKind==='site' かつ location）を持つ作品のみ（博物館は出さない＝
//    M2b-14 の決定どおり。「findSite または location を持つ作品のみ」という文言と「博物館は
//    出さない」という決定が両立するよう、location 側は site 限定にした＝下記 hasStar 参照。
//    低確信点として完了報告に明記）
//  ★4 周辺知識（Q4 関連記述の正誤・Q9 の subject/patron/religion スロット・Q8 組合せ文。
//    M2i-05①でQ6同時代の事項を外した＝下記「M2i-05修正」参照）
//  ★5 技法・様式（Q9 の technique/style スロット・Q13 語句の組合せ・Q10 2文正誤）
//  ボス（本番形式、3リード文。すべてリード文なし＝ボス以外にリード文の問題は無い）
//  ★を持つ作品が0件の★はその文化では「なし」として飛ばす。ワールド固定なので文化名を当てる型
//  （Q2・Q12・Q9のeraスロット）はステージで使わない
//
// M2i-05修正（decisions.md 2026-09-11。reviewer fact-check-m2i.md の実測: ヘッダーだけで解ける
// 問題27.6%〈q6 100%・q9 43.6%〉、★3の同型連続率100%〈型がQ9の1種類しか無いため〉を受けた是正）:
//  ①★4からQ6（同時代の事項）を外す（誤答が他文化の事項なので、ワールド固定のステージでは
//    ヘッダーの文化名だけで100%解けていた。q6は模試・ボス専用のまま残す）
//  ②ステージのQ9の誤答は同era（＝ワールド）の作品を優先する（4件以上あれば全て同era、
//    未満なら同eraぶん＋足りない分だけ隣接文化から補う。generateQ9Question の preferSameEra
//    オプション、engine/q9.ts 参照）。ボス・自由出題・模試のQ9は対象外（従来どおり）
//  ③★3にQ7（画像→出土地・所在地。Q5と対称の構造、engine/q7.ts）を新設し、★3の型を
//    Q9（findSite/locationスロット）とQ7の2種類にする（同型連続率100%だった問題を緩和し、
//    1作品2問〈extraDoubleCount〉の際に型を変えられるようにする）
//
// ステージ生成規則 v4:
//  ワールドの出題可能作品を年代順に並べ、★ごとに「その★を持つ作品」を10件ずつに固定分割
//  （★1は全件、★2はartistあり、★3はfindSite/location…）。1面＝その作品群×その★の型で
//  1作品1問（10件未満なら問数はその件数）。合格＝10問なら8問以上、10問未満なら1ミス以内。
//  ★を持つ作品が0件の★は「なし」として飛ばす。面番号は★1の面→★2の面→…→ボスの順に通し
//  （1-1, 1-2, …, 1-ボス）。同じ作品×同じ型は1面1回、同型の連続を抑える（avoidType）、
//  再挑戦は選択肢と型を変える。
//
// ボス規則 v4:
//  その文化の出題可能作品をざっくり3群（年代順で3等分）に分け、群ごとに1本のリード文
//  （既存3〜4本を割り当て直す。足りなければwriterが書く）。問題はwriter手書きのask.stemがある
//  下線だけから作り、engineの汎用文（「下線部○に関わる／該当する作品を…」）は使わない
//  （型が合わず作れない下線は飛ばす）。下線はヒントになりすぎない。問数はN≤15で10、N>15で20、
//  クリアは8割（ステージと揃える）。文化伏せ型は模試専用にし、ボスでは使わない。
//
// 進捗データの引き継ぎ: ステージ分割が変わるため、stages（面クリア状況）のみリセットする
// （progress.ts の STORAGE_VERSION・migrate 参照）。図鑑（discoveredWorks）・SRS（items の箱・
// 間隔）・XP・missLog・模試履歴は保持する。
import { buildQuestion, canGenerateType } from './session'
import { buildChoices, shuffle, type RandomFn } from './distractors'
import { generateStatementPairQuestion } from './statementPair'
import { generatePairQuestion } from './pairs'
import { generateStatementQuestion } from './statements'
import { generateQ12Question } from './q12'
import { generateQ9Question, generateQ9QuestionFromIds } from './q9'
import { generateQ5Question } from './q5'
import { generateQ7Question, q7LocationValue } from './q7'
import { isCulturalHiddenAsk, pickThemeTargetId } from './themeSet'
import { standaloneStem } from './stems'
import type {
  Era,
  EraStageProgress,
  Passage,
  PassageUnderline,
  Q9Slot,
  Question,
  QuestionType,
  StageState,
  Work,
} from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** 「生成できるか／何件作れるか」だけを知りたいとき用の決定的 rng（session.ts の
 *  PROBE_RANDOM と同じ考え方）。件数表示・テストで使う。実際のプレイ用の乱数には使わない
 *  （毎回同じ問題になってしまう）。 */
export const PROBE_RANDOM: RandomFn = () => 0

export type Difficulty = 1 | 2 | 3 | 4 | 5

export const ALL_DIFFICULTIES: Difficulty[] = [1, 2, 3, 4, 5]

export const DIFFICULTY_TYPES: Record<Difficulty, QuestionType[]> = {
  1: ['q1', 'q3'],
  2: ['q5', 'q9'],
  3: ['q9', 'q7'],
  4: ['q4', 'q9', 'q8'],
  5: ['q9', 'q13', 'q10'],
}

/** ★2〜5でQ9を使うときに固定するスロット（★1はQ9を使わないため無し）。eraスロットは
 *  ワールド固定のステージでは絶対に使わない（ヘッダーの文化名だけで解けてしまうため）。 */
const DIFFICULTY_Q9_SLOTS: Partial<Record<Difficulty, Q9Slot[]>> = {
  2: ['artist'],
  3: ['findSite', 'location'],
  4: ['subject', 'patron', 'religion'],
  5: ['technique', 'style'],
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '★1 名前',
  2: '★2 作者',
  3: '★3 出土地・所在地',
  4: '★4 周辺知識',
  5: '★5 技法・様式',
}

/**
 * 画像そのものを見せる／選択肢に画像を並べる型。engine/practiceSession.ts・engine/missLog.ts と
 * 同じ定数（意図的に同じ名前・同じ範囲で重複定義。他エンジンファイルも各々ローカルに持つ既存の
 * 書き方に揃える）。q5（M2i、画像→作者）・q7（M2i-05③、画像→出土地・所在地）は対象自身の
 * ヒーロー画像を見せるため画像必須。
 */
const IMAGE_DEPENDENT_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q5', 'q7', 'q9']

/** 10件ずつに固定分割する（チケット規則）。 */
export const STAGE_CHUNK_SIZE = 10

/**
 * クリア閾値（★の定義v4、BOARD.md M2i-01④・ボス規則v4「クリアは8割（ステージと揃える）」）:
 *  10問（フル分割の面）は8問以上。10問未満の面は1ミス以内（n-1問以上）。ボス（N>15で20問）も
 *  同じ80%基準に揃えるため、10問以上は floor(n*0.8) で統一する（n=10→8、n=20→16）。
 *  n<=2（1ミス許容が意味をなさない極小値）は全問正解のままにする。
 */
export function clearThreshold(questionCount: number): number {
  const n = questionCount
  // オーナー規則（BOARD.md M2i v4）: 10問未満は常に1ミス以内で解放。
  // n=1 だけは「1ミス許容」が「0問正解で合格」になり成立しないため、唯一の例外として全問正解を要求する
  // （M2i-99 [中]-2 で n<=2 が誤って n=2 でもノーミス必須になっていたバグを修正、fact-check-m2i.md 参照）
  if (n <= 0) return 0
  if (n === 1) return 1
  if (n < 10) return n - 1
  return Math.floor(n * 0.8)
}

export function emptyStageState(): StageState {
  return { cleared: false, bestScore: 0, clearedAt: null }
}

export function emptyEraStageProgress(): EraStageProgress {
  return { segments: {}, boss: emptyStageState() }
}

/** stages に該当 era のエントリが無いとき用のデフォルト値を補って返す（未プレイ扱い）。 */
export function getEraStageProgress(stages: Record<string, EraStageProgress>, eraId: string): EraStageProgress {
  return stages[eraId] ?? emptyEraStageProgress()
}

/** 面IDは「era+難易度+分割番号」。era側は呼び出し元（progress.ts の stages のキー）が既に
 *  eraId で分けているため、ここでは difficulty-segment の部分だけを作る（例 "1-1" "2-3"）。 */
export function segmentKey(difficulty: Difficulty, segment: number): string {
  return `${difficulty}-${segment}`
}

export function getSegmentState(era: EraStageProgress, difficulty: Difficulty, segment: number): StageState {
  return era.segments[segmentKey(difficulty, segment)] ?? emptyStageState()
}

/** ワールド順（eras.json の order 昇順）の eraId 一覧。 */
export function worldOrder(eras: Era[]): string[] {
  return [...eras].sort((a, b) => a.order - b.order).map((e) => e.id)
}

// --- ★の判定（v4: ★ごとに対象作品を固定する） ---

/**
 * work が difficulty の★を持つか（BOARD.md M2i ★の定義v4）。
 *  ★1: 全件対象。
 *  ★2: artist を持つ作品のみ。
 *  ★3: findSite を持つ、または（holderKind==='site' かつ location を持つ）作品のみ。
 *    低確信点（完了報告に明記）: チケット文言は「findSite または location を持つ作品のみ」だが、
 *    BOARD.md M2i の本文は「博物館は出さない＝M2b-14の決定どおり」を明記している。location は
 *    holderKind==='museum' の作品でも収蔵館名が入っている（実データで26/74件）ため、素通しすると
 *    「東京国立博物館にあるもの」のような設問が生成されてしまう（M2b-14が禁止した形）。
 *    ここでは M2b-14 の決定を優先し、location 側は holderKind==='site' に限定した
 *    （findSite はもともと出土地そのものなので holderKind を問わない。判定は engine/q7.ts の
 *    q7LocationValue と共有し、Q7〈画像→出土地・所在地。M2i-05③〉の対象・正解値もこれで揃える）。
 *  ★4: 全件対象（Q4/Q9のsubject等/Q8のどれかが生成できることが多いため、★1と同様に
 *    「なし」を作らない簡易判定にした。実際に1問も作れない作品は tryBuildStageQuestionForWork が
 *    その作品をスキップするだけで面自体は壊れない。M2i-05①でQ6同時代の事項を外した＝
 *    DIFFICULTY_TYPES[4] 参照、hasStar 自体の判定は変わらない）。
 *  ★5: technique または style または pairs（1件以上）を持つ作品のみ。
 */
function hasStar(work: Work, difficulty: Difficulty): boolean {
  switch (difficulty) {
    case 1:
      return true
    case 2:
      return Boolean(work.artist)
    case 3:
      return q7LocationValue(work) !== null
    case 4:
      return true
    case 5:
      return Boolean(work.technique) || Boolean(work.style) || (work.pairs?.length ?? 0) > 0
  }
}

function sortByOrderIndex(works: Work[]): Work[] {
  return [...works].sort((a, b) => {
    const ao = a.orderIndex ?? Number.POSITIVE_INFINITY
    const bo = b.orderIndex ?? Number.POSITIVE_INFINITY
    if (ao !== bo) return ao - bo
    // orderIndex が同値/無い場合のタイブレーク。1-1が「常に同じ10作品」であるためには
    // 決定的な順序が要る（id の辞書順で固定する）。
    return a.id.localeCompare(b.id)
  })
}

/** その era の対象作品総数（★を問わない。ボス長の判定に使う）。 */
export function eraTotalItemCount(eraId: string, imagePool: Work[]): number {
  return imagePool.filter((w) => w.era === eraId).length
}

/** N≤15なら10問、N>15なら20問。N=0（対象項目が無い）はボスを作れないため0。 */
export function bossQuestionCount(itemCount: number): number {
  if (itemCount <= 0) return 0
  return itemCount <= 15 ? 10 : 20
}

// --- ステージ生成規則（10件ずつの固定分割＋端数規則） ---

export interface StageSegmentPlan {
  /** 1始まりの面番号（同じ難易度内でのみ意味を持つ）。 */
  segment: number
  /** この面の対象作品 id（年代順固定。1-1なら常に同じ10件、再挑戦しても対象は変わらない）。 */
  workIds: string[]
  /**
   * workIds の先頭から何件を「2問（型を変えて2回）」にするか（0件なら全作品1問）。
   * remainder+extraDoubleCount=10（＝questionCountForSegmentが常に10）になるよう
   * extraDoubleCount=10-remainderの作品だけを2問にする。ただしそもそも10件未満
   * （fullChunks===0 && remainder<5）は全件2問のまま（2N問）にする。
   */
  extraDoubleCount: number
}

export interface EraStagePlan {
  eraId: string
  difficulty: Difficulty
  /** その★を持つ対象作品総数（imagePool のうちその era・その★のもの）。 */
  itemCount: number
  segments: StageSegmentPlan[]
}

/**
 * 10件ずつの固定分割＋端数規則。
 *  - 余りが無い（N が10の倍数）: フルチャンクのみ（extraDoubleCount=0）。
 *  - 余り(remainder) < 5 かつ既にフルチャンクがある: 前の面に併合する。
 *  - 余り(remainder) < 5 かつ フルチャンクが無い（N<5）: 全件2問（extraDoubleCount=remainder）。
 *  - 余り(remainder) >= 5（フルチャンクの有無を問わない）: 10問に近づける。
 *    extraDoubleCount = 10-remainder 件だけを2問にし、合計が remainder + (10-remainder) = 10 になる。
 */
function partitionIntoSegments(sortedWorks: Work[]): StageSegmentPlan[] {
  const n = sortedWorks.length
  if (n === 0) return []
  const fullChunks = Math.floor(n / STAGE_CHUNK_SIZE)
  const remainder = n - fullChunks * STAGE_CHUNK_SIZE
  const segments: StageSegmentPlan[] = []
  for (let i = 0; i < fullChunks; i++) {
    segments.push({
      segment: i + 1,
      workIds: sortedWorks.slice(i * STAGE_CHUNK_SIZE, i * STAGE_CHUNK_SIZE + STAGE_CHUNK_SIZE).map((w) => w.id),
      extraDoubleCount: 0,
    })
  }
  if (remainder > 0) {
    if (remainder < 5 && fullChunks > 0) {
      const last = segments[segments.length - 1]
      last.workIds = [...last.workIds, ...sortedWorks.slice(fullChunks * STAGE_CHUNK_SIZE).map((w) => w.id)]
    } else {
      const remainderIds = sortedWorks.slice(fullChunks * STAGE_CHUNK_SIZE).map((w) => w.id)
      const extraDoubleCount = fullChunks === 0 && remainder < 5 ? remainder : STAGE_CHUNK_SIZE - remainder
      segments.push({
        segment: segments.length + 1,
        workIds: remainderIds,
        extraDoubleCount,
      })
    }
  }
  return segments
}

/** 面の目標問題数（先頭 extraDoubleCount 件は2問、残りは1問）。 */
export function questionCountForSegment(seg: StageSegmentPlan): number {
  return seg.workIds.length + seg.extraDoubleCount
}

/** ワールド（era）の、指定した★のステージ計画を組み立てる（純粋にデータの分割のみ。設問は
 *  作らない）。imagePool は content.ts の playableWorks 相当（出題対象自身は画像必須）。 */
export function buildEraStagePlan(eraId: string, difficulty: Difficulty, imagePool: Work[]): EraStagePlan {
  const eraWorks = sortByOrderIndex(imagePool.filter((w) => w.era === eraId && hasStar(w, difficulty)))
  return { eraId, difficulty, itemCount: eraWorks.length, segments: partitionIntoSegments(eraWorks) }
}

/** そのワールドで実際に面を持つ★（0件の★は含まない）を★の若い順に並べたもの。
 *  面番号の通し番号付け（overallSegmentNumber）・ワールドマップのノード生成が共通で使う。 */
export function worldSegmentPlans(eraId: string, imagePool: Work[]): { difficulty: Difficulty; plan: EraStagePlan }[] {
  return ALL_DIFFICULTIES.map((difficulty) => ({ difficulty, plan: buildEraStagePlan(eraId, difficulty, imagePool) })).filter(
    ({ plan }) => plan.segments.length > 0,
  )
}

/** difficulty ごとの面数（0件の★は0）。overallSegmentNumber・UI表示に渡す軽量な形。 */
export function segmentCountsByDifficulty(eraId: string, imagePool: Work[]): Partial<Record<Difficulty, number>> {
  const out: Partial<Record<Difficulty, number>> = {}
  for (const { difficulty, plan } of worldSegmentPlans(eraId, imagePool)) out[difficulty] = plan.segments.length
  return out
}

// --- 設問の直接生成（q9/q5/q10/q13。session.ts の canGenerateType/buildQuestion は
// q9 のスロット制限を持たない／q5・q10・q13 を常に false/null にするため、ここで直接組み立てる） ---

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

/** Q5（画像→作者。M2i ★2）を組み立てる。誤答は同文化→隣接文化の実在の作者から選ぶ
 *  （engine/q5.ts）。artist が無い、または誤答が3件そろわなければ null。 */
function buildQ5QuestionForStage(work: Work, pool: Work[], eras: Era[], rng: RandomFn): Question | null {
  const data = generateQ5Question(work, pool, eras, rng)
  if (!data) return null
  const { items, correctIndex } = buildChoices(data.correctArtist, data.distractorArtists, rng)
  return { type: 'q5', work, choiceWorks: [], choiceArtists: items, correctIndex, isReview: false }
}

/** Q7（画像→出土地・所在地。M2i-05③ ★3）を組み立てる。誤答は同文化→隣接文化の実在の
 *  出土地・所在地から選ぶ（engine/q7.ts）。対象が値を持たない、または誤答が3件そろわなければ null。 */
function buildQ7QuestionForStage(work: Work, pool: Work[], eras: Era[], rng: RandomFn): Question | null {
  const data = generateQ7Question(work, pool, eras, rng)
  if (!data) return null
  const { items, correctIndex } = buildChoices(data.correctLocation, data.distractorLocations, rng)
  return { type: 'q7', work, choiceWorks: [], choiceLocations: items, correctIndex, isReview: false }
}

/** Q9をスロット固定（allowSlots）で組み立てる（M2i ★2〜5）。eraスロットは常に禁止する
 *  （ワールド固定のステージ・ボスではヘッダーの文化名だけで解けてしまうため）。誤答は同era
 *  （＝ワールド）を優先する（M2i-05②、preferSameEra。reviewer fact-check-m2i.md でq9の
 *  43.6%がヘッダーだけで解けると指摘されたための是正。engine/q9.ts 参照）。 */
function buildQ9QuestionForStage(work: Work, imagePool: Work[], eras: Era[], rng: RandomFn, allowSlots: Q9Slot[]): Question | null {
  const data = generateQ9Question(work, imagePool, eras, rng, { allowSlots, avoidSlots: ['era'], preferSameEra: true })
  if (!data) return null
  const { items, correctIndex } = buildChoices(data.correctWork, data.distractorWorks, rng)
  return {
    type: 'q9',
    work,
    choiceWorks: items,
    correctIndex,
    isReview: false,
    conditionText: data.conditionText,
    reversed: data.reversed,
    q9Slot: data.slot,
  }
}

/** 隣り合う2問が「同じ型」または「同じ作品（doubled規則で2回出る作品の2回目）」にならないよう、
 *  可能な範囲で入れ替える（best-effort。完全には解消できないこともある。BOARD.md M2i-01⑤
 *  「同じ作品の2回目は別型かつ非隣接」「同型連続を抑える」の両方をこの1関数で満たす。
 *  engine/themeSet.ts の reorderToAvoidConsecutiveSameType と似たアルゴリズムだが、
 *  ここでは Question[] を直接扱い、衝突条件に work.id も加えている）。 */
function collides(a: Question, b: Question): boolean {
  return a.type === b.type || a.work.id === b.work.id
}

function reorderToAvoidConsecutiveSameType(items: Question[]): Question[] {
  const arr = items.slice()
  for (let pass = 0; pass < 3; pass++) {
    let changed = false
    for (let i = 1; i < arr.length; i++) {
      if (!collides(arr[i], arr[i - 1])) continue
      let swapIdx = -1
      for (let j = i + 1; j < arr.length; j++) {
        // 入れ替え先の候補（arr[j]）を位置iへ動かしたとき、両隣（arr[i-1]・arr[i+1]。
        // arr[i+1]は末尾なら存在しない）のどちらとも衝突しないことを確認する。
        const nextNeighbor = arr[i + 1]
        if (!collides(arr[j], arr[i - 1]) && (!nextNeighbor || !collides(arr[j], nextNeighbor))) {
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

/** 下線（passage）に紐づかない単独問題の設問文を付ける（M2i: ステージはリード文を一切使わない
 *  ため、常に standaloneStem。passageId/underlineKey は付けない）。 */
function attachStandaloneStem(q: Question): Question {
  if (q.stem) return q
  return { ...q, stem: standaloneStem(q.type, { reversed: q.reversed, conditionText: q.conditionText }) }
}

/** その難易度の型の中から、まだこの作品で使っていない型を優先して1問だけ作る（同じ作品×同じ型は
 *  同じ呼び出し列の中で重複させない）。画像が要る型（IMAGE_DEPENDENT_TYPES）は、対象自身が
 *  imagePool にある（＝画像を持つ）ときだけ候補にし、その型を作るときの pool 引数も imagePool に
 *  限定する（practiceSession.ts・missLog.ts・themeSet.ts と同じ考え方）。 */
function tryBuildStageQuestionForWork(
  work: Work,
  types: QuestionType[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn,
  usedTypesForWork: Set<QuestionType>,
  q9AllowSlots: Q9Slot[] | undefined,
): Question | null {
  const imageEligible = imagePool.some((w) => w.id === work.id)
  const candidates = shuffle(
    types.filter((t) => !usedTypesForWork.has(t) && (imageEligible || !IMAGE_DEPENDENT_TYPES.includes(t))),
    rng,
  )
  for (const type of candidates) {
    const usablePool = IMAGE_DEPENDENT_TYPES.includes(type) ? imagePool : pool
    let q: Question | null = null
    if (type === 'q10') q = buildStatementPairQuestion(work, usablePool, rng)
    else if (type === 'q13') q = buildWordPairQuestion(work, usablePool, rng)
    else if (type === 'q5') q = buildQ5QuestionForStage(work, usablePool, eras, rng)
    else if (type === 'q7') q = buildQ7QuestionForStage(work, usablePool, eras, rng)
    else if (type === 'q9') q = q9AllowSlots ? buildQ9QuestionForStage(work, usablePool, eras, rng, q9AllowSlots) : null
    else if (canGenerateType(type, work, usablePool, eras)) q = buildQuestion(work, type, usablePool, eras, false, rng)
    if (q) return q
  }
  return null
}

/**
 * eraId・difficulty・segment から、その面の対象作品に対して設問を作る。
 * pool は content.ts の themeSetPool 相当（distractor 素材。画像なし項目も含む）、imagePool は
 * playableWorks 相当（出題対象自身は画像必須）。segment が存在しない（面数を超えた番号）、
 * または対象文化に出題対象が無ければ空配列。
 * M2i: ステージはリード文（passage）を一切使わない（passageId を付けない。standaloneStem 固定）。
 */
export function buildStageQuestions(
  eraId: string,
  difficulty: Difficulty,
  segment: number,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
): Question[] {
  const plan = buildEraStagePlan(eraId, difficulty, imagePool)
  const seg = plan.segments.find((s) => s.segment === segment)
  if (!seg) return []
  const idSet = new Set(seg.workIds)
  const segWorks = shuffle(
    imagePool.filter((w) => idSet.has(w.id)),
    rng,
  )
  const types = DIFFICULTY_TYPES[difficulty]
  const q9AllowSlots = DIFFICULTY_Q9_SLOTS[difficulty]
  // どの作品を2問にするかは seg.workIds（年代順固定）の先頭 extraDoubleCount 件で決める
  // （1-1が「常に同じ内容」であるためには、出題順シャッフル後の segWorks ではなく分割計画側の
  // 順序で決定的に選ぶ必要がある）。
  const doubledIds = new Set(seg.workIds.slice(0, seg.extraDoubleCount))

  const questions: Question[] = []
  for (const work of segWorks) {
    const usedTypesForWork = new Set<QuestionType>()
    const perWork = doubledIds.has(work.id) ? 2 : 1
    for (let i = 0; i < perWork; i++) {
      const q = tryBuildStageQuestionForWork(work, types, pool, imagePool, eras, rng, usedTypesForWork, q9AllowSlots)
      if (q) {
        questions.push(attachStandaloneStem(q))
        usedTypesForWork.add(q.type)
      }
    }
  }
  return reorderToAvoidConsecutiveSameType(shuffle(questions, rng))
}

// --- ボス（3群×リード文、writerのask.stemがある下線だけから作る） ---

interface BossCandidate {
  passage: Passage
  underline: PassageUnderline
  work: Work
}

/** ask.slot の値が Q9 の preferredSlot として使える値か（types.ts PassageUnderlineAsk.slot の
 *  範囲。実データはこの範囲に限られるが、JSON なので念のため実行時にも確認する）。 */
function isAskQ9Slot(value: string | undefined): value is Q9Slot {
  return value === 'holder' || value === 'artist' || value === 'technique' || value === 'era' || value === 'subject'
}

/** リード画像に正解画像が含まれるq9問題は生成しない（M2i-02④、
 *  research/fact-check-m2e-tiers.md [中]-2「リード画像に正解画像が並ぶ」の是正）。 */
function leadImageConflict(passage: Passage, workId: string): boolean {
  return passage.kind === 'image' && (passage.leadWorkIds ?? []).includes(workId)
}

/**
 * writer 手書きの ask.stem がある下線だけから、ask.type をそのまま使って1問を組み立てる
 * （ボス規則v4「engineの汎用文は使わない。型が合わず作れない下線は飛ばす」＝ここで null を
 * 返したら呼び出し側は次の候補に進み、フォールバックはしない）。
 */
function buildAskExactQuestion(
  passage: Passage,
  underline: PassageUnderline,
  work: Work,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn,
): Question | null {
  const ask = underline.ask
  if (!ask || !ask.stem) return null
  const stem = ask.stem
  switch (ask.type) {
    case 'q9': {
      if (!imagePool.some((w) => w.id === work.id)) return null
      if (leadImageConflict(passage, work.id)) return null
      const data = ask.answerId
        ? generateQ9QuestionFromIds(imagePool, ask.answerId, ask.distractorIds, eras, rng)
        : generateQ9Question(work, imagePool, eras, rng, {
            preferredSlot: isAskQ9Slot(ask.slot) ? ask.slot : undefined,
            avoidSlots: ['era'],
          })
      if (!data) return null
      if (leadImageConflict(passage, data.correctWork.id)) return null
      const { items, correctIndex } = buildChoices(data.correctWork, data.distractorWorks, rng)
      return {
        type: 'q9',
        work,
        choiceWorks: items,
        correctIndex,
        isReview: false,
        conditionText: data.conditionText,
        reversed: data.reversed,
        q9Slot: data.slot,
        stem,
      }
    }
    case 'q10': {
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
        stem,
      }
    }
    case 'q4': {
      const statement = generateStatementQuestion(work, pool, rng, { reversed: ask.reversed })
      if (!statement) return null
      const { items, correctIndex } = buildChoices(statement.correct, statement.distractors, rng)
      return {
        type: 'q4',
        work,
        choiceWorks: [],
        choiceStatements: items,
        correctIndex,
        isReview: false,
        reversed: Boolean(ask.reversed),
        stem,
      }
    }
    case 'q12': {
      const data = generateQ12Question(ask, rng)
      if (!data) return null
      return { type: 'q12', work, choiceWorks: [], choiceQ12: data.choices, correctIndex: data.correctIndex, isReview: false, stem }
    }
    case 'q13': {
      const data = generatePairQuestion(work, pool, rng, { reversed: ask.reversed })
      if (!data) return null
      const { items, correctIndex } = buildChoices(data.correct, data.distractors, rng)
      return {
        type: 'q13',
        work,
        choiceWorks: [],
        choiceWordPairs: items,
        correctIndex,
        isReview: false,
        reversed: Boolean(ask.reversed),
        stem,
      }
    }
    default:
      // q11 は M3 候補で未実装。文化伏せ型（q12「この文化」）はボスでは使わない方針だが、
      // 中身（answerText/distractorTexts）を機械判定できないため、ここでは全ての q12 を許容する
      // （文化伏せ型の除外は content 側＝M2i-03 writer がボス用リード文に含めない、で担保する）。
      return null
  }
}

/** その文化の出題可能作品を年代順にざっくり3等分する（ボス規則v4）。作品数が3件未満でも
 *  空の群は作らない（1〜3群になる）。 */
function bossWorkGroups(eraWorksSorted: Work[]): Work[][] {
  const n = eraWorksSorted.length
  if (n === 0) return []
  const size = Math.ceil(n / 3)
  const groups: Work[][] = []
  for (let i = 0; i < 3; i++) {
    const slice = eraWorksSorted.slice(i * size, (i + 1) * size)
    if (slice.length > 0) groups.push(slice)
  }
  return groups
}

/**
 * ボス: N≤15なら10問、N>15なら20問（count を明示すればテスト等で上書きできる）。
 * M2i: その文化の全passageの全下線のうち、ask.stemがある下線だけを候補にし、対象作品の年代位置
 * （bossWorkGroups の3群）ごとにグループ分けして、群を順番に回しながら1問ずつ組み立てる
 * （3本のリード文に分散させる意図。1本のリード文に集中してヒントが積み重なるのを避ける）。
 * ask.typeで指定された型が生成できない下線は飛ばす（engineの汎用文にフォールバックしない）。
 * 群に候補が無ければその群からは出さない（M2i-03のwriter増補待ち。完了報告に群ごとの不足を書く）。
 */
export function buildBossQuestions(
  eraId: string,
  passages: Passage[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  count?: number,
): Question[] {
  const eraWorksAll = sortByOrderIndex(imagePool.filter((w) => w.era === eraId))
  const targetCount = count ?? bossQuestionCount(eraWorksAll.length)
  if (targetCount === 0) return []
  const eraPassages = passages.filter((p) => p.era === eraId)
  if (eraPassages.length === 0) return []

  const groups = bossWorkGroups(eraWorksAll)
  if (groups.length === 0) return []
  const groupIndexByWorkId = new Map<string, number>()
  groups.forEach((g, gi) => g.forEach((w) => groupIndexByWorkId.set(w.id, gi)))

  const availableIds = new Set(pool.map((w) => w.id))
  const candidatesByGroup: BossCandidate[][] = groups.map(() => [])
  for (const passage of eraPassages) {
    for (const underline of passage.underlines) {
      if (!underline.ask?.stem) continue // ボス規則v4: 手書きstemの無い下線は使わない
      // ボス規則v4「文化伏せ型は模試専用にし、ボスでは使わない（ヘッダーに文化名が出るため）」。
      if (isCulturalHiddenAsk(underline.ask)) continue
      const targetId = pickThemeTargetId(underline, passage, availableIds)
      if (!targetId) continue
      const work = pool.find((w) => w.id === targetId)
      if (!work) continue
      const groupIndex = groupIndexByWorkId.get(work.id)
      if (groupIndex === undefined) continue // 対象がこのeraの出題可能作品（imagePool）に無い
      candidatesByGroup[groupIndex].push({ passage, underline, work })
    }
  }

  const built: Question[] = []
  const usedPairKeys = new Set<string>()
  const queues = candidatesByGroup.map((list) => shuffle(list, rng))
  let progressed = true
  while (built.length < targetCount && progressed) {
    progressed = false
    for (const queue of queues) {
      if (built.length >= targetCount) break
      while (queue.length > 0) {
        const c = queue.shift()!
        const q = buildAskExactQuestion(c.passage, c.underline, c.work, pool, imagePool, eras, rng)
        if (!q) continue // 型が合わず作れない下線は飛ばす（次の候補へ）
        const pairKey = `${c.work.id}:${q.type}`
        if (usedPairKeys.has(pairKey)) continue
        usedPairKeys.add(pairKey)
        built.push({ ...q, passageId: c.passage.id, underlineKey: c.underline.key })
        progressed = true
        break
      }
    }
  }
  return reorderToAvoidConsecutiveSameType(shuffle(built, rng))
}

/** 設問1件が画面に出す作品 id（正解・誤答選択肢・年代順の複数作品を含む）。誤答露出の実測・
 *  優先選定に使う。choiceStatements/choiceCombos/choiceQ12/choiceWordPairs/choiceArtists は
 *  テキストのみで他作品の画像を出さないため対象外（q.work 自身はどの型でもリード/画像として
 *  画面に出るため常に含める）。 */
function questionExposedWorkIds(q: Question): string[] {
  const ids = [q.work.id]
  if (q.choiceWorks) ids.push(...q.choiceWorks.map((w) => w.id))
  if (q.orderItems) ids.push(...q.orderItems.map((oi) => oi.work.id))
  return ids
}

/** era の項目のうち、ボスの1回の生成結果で何件が画面に出たか（正解 or 誤答choiceWorks）を返す。
 *  M2i では誤答露出率そのものは合格ラインに含まれないが、完了報告用の実測に使えるよう残す。 */
export function bossExposureRate(
  questions: Question[],
  eraId: string,
  imagePool: Work[],
): { total: number; exposed: number; rate: number } {
  const eraIds = new Set(imagePool.filter((w) => w.era === eraId).map((w) => w.id))
  const exposed = new Set<string>()
  for (const q of questions) {
    for (const id of questionExposedWorkIds(q)) {
      if (eraIds.has(id)) exposed.add(id)
    }
  }
  const total = eraIds.size
  return { total, exposed: exposed.size, rate: total > 0 ? exposed.size / total : 1 }
}

// --- 体力ゲージ用の進捗値 ---

export interface BossProgress {
  total: number
  correct: number
  incorrect: number
  /** 未回答（残り）問数。 */
  remaining: number
  /** この total で何問正解すればクリアか（clearThreshold(total)）。 */
  clearThreshold: number
}

/** ボス戦の途中経過（何問目まで答えたか）から、体力ゲージ表示に要る値をまとめる。 */
export function bossProgress(total: number, correct: number, incorrect: number): BossProgress {
  return {
    total,
    correct,
    incorrect,
    remaining: Math.max(0, total - correct - incorrect),
    clearThreshold: clearThreshold(total),
  }
}

// --- 解禁（純関数。完全直列、ワープなし） ---

export type StageLocalKey = { kind: 'segment'; difficulty: Difficulty; segment: number } | { kind: 'boss' }

export type StageRef =
  | { kind: 'segment'; eraId: string; worldIndex: number; difficulty: Difficulty; segment: number }
  | { kind: 'boss'; eraId: string; worldIndex: number }

/** StageRef を一意に識別する文字列キー（例 "genshi-1-1" "genshi-boss"）。 */
export function stageRefKey(ref: StageRef): string {
  return ref.kind === 'boss' ? `${ref.eraId}-boss` : `${ref.eraId}-${ref.difficulty}-${ref.segment}`
}

function sameLocalKey(ref: StageRef, key: StageLocalKey): boolean {
  if (key.kind === 'boss') return ref.kind === 'boss'
  return ref.kind === 'segment' && ref.difficulty === key.difficulty && ref.segment === key.segment
}

/** 1ワールド分の直列シーケンス: ★1の面を面番号順→★2→…→★5→ボス。0件の★は丸ごと飛ばす
 *  （BOARD.md M2i「★を持つ作品が0件の★はその文化では『なし』として飛ばす」）。
 *  対象作品0件のワールド自体（将来コンテンツが増減した場合）も面もボスも作れないため丸ごと除外し、
 *  誰にも倒せないボスで以降全ワールドが恒久的に詰むのを防ぐ（isWorldUnlocked側の対応と対で見ること）。 */
function worldStageSequence(eraId: string, worldIndex: number, imagePool: Work[]): StageRef[] {
  if (eraTotalItemCount(eraId, imagePool) === 0) return []
  const refs: StageRef[] = []
  for (const { difficulty, plan } of worldSegmentPlans(eraId, imagePool)) {
    for (const seg of plan.segments) {
      refs.push({ kind: 'segment', eraId, worldIndex, difficulty, segment: seg.segment })
    }
  }
  refs.push({ kind: 'boss', eraId, worldIndex })
  return refs
}

/** 全ワールドを通した直列シーケンス（W-1の★1-1から最終ワールドのボスまで）。
 *  以降の解禁判定は「このシーケンス上で自分より前が全てクリア済みか」だけで決まる。 */
export function fullStageSequence(eras: Era[], imagePool: Work[]): StageRef[] {
  const worlds = worldOrder(eras)
  return worlds.flatMap((eraId, worldIndex) => worldStageSequence(eraId, worldIndex, imagePool))
}

export function isStageRefCleared(ref: StageRef, stages: Record<string, EraStageProgress>): boolean {
  const era = getEraStageProgress(stages, ref.eraId)
  if (ref.kind === 'boss') return era.boss.cleared
  return getSegmentState(era, ref.difficulty, ref.segment).cleared
}

/** 直列解禁の境界。sequence[0..boundary-1] は全てクリア済み、sequence[boundary]（存在すれば）
 *  が次に挑戦できる面。境界以前（自分自身を含む）は解禁済み、境界より後は未解禁。
 *  全クリア済みなら sequence.length を返す。 */
export function stageUnlockBoundary(sequence: StageRef[], stages: Record<string, EraStageProgress>): number {
  for (let i = 0; i < sequence.length; i++) {
    if (!isStageRefCleared(sequence[i], stages)) return i
  }
  return sequence.length
}

/** 指定した面（eraId・key）が解禁されているか（完全直列。ワープに相当するAPIはこのモジュールに
 *  存在しない）。 */
export function isStageUnlocked(
  eraId: string,
  key: StageLocalKey,
  eras: Era[],
  imagePool: Work[],
  stages: Record<string, EraStageProgress>,
): boolean {
  const sequence = fullStageSequence(eras, imagePool)
  const idx = sequence.findIndex((r) => r.eraId === eraId && sameLocalKey(r, key))
  if (idx === -1) return false
  const boundary = stageUnlockBoundary(sequence, stages)
  return idx <= boundary
}

/** 次に挑戦する面（ホーム画面のカード用）。全ワールド・全面をクリア済みなら null。 */
export function nextStageRef(eras: Era[], imagePool: Work[], stages: Record<string, EraStageProgress>): StageRef | null {
  const sequence = fullStageSequence(eras, imagePool)
  const boundary = stageUnlockBoundary(sequence, stages)
  return boundary < sequence.length ? sequence[boundary] : null
}

/** StageRef を StageLocalKey に変換する（era側の情報を落とす）。 */
export function stageRefToLocalKey(ref: StageRef): StageLocalKey {
  return ref.kind === 'boss' ? { kind: 'boss' } : { kind: 'segment', difficulty: ref.difficulty, segment: ref.segment }
}

/**
 * ワールド内の通し面番号。★ごとに面数が異なる（v4: ★ごとに対象作品が違うため）ため、
 * segmentCounts（segmentCountsByDifficulty の戻り値。0件の★はキー自体が無い/0）を渡して、
 * difficulty より前の★の面数を積算する。
 */
export function overallSegmentNumber(difficulty: Difficulty, segment: number, segmentCounts: Partial<Record<Difficulty, number>>): number {
  let offset = 0
  for (const d of ALL_DIFFICULTIES) {
    if (d === difficulty) return offset + segment
    offset += segmentCounts[d] ?? 0
  }
  return offset + segment
}

/** UI表記「ワールド番号-面番号＋★の数」。面番号はワールド内の通し番号（overallSegmentNumber）。
 *  例: segmentCounts={1:3} のとき {kind:'segment', worldIndex:0, difficulty:2, segment:1} →
 *  "1-4 ★★"（★1の3面ぶん(1,2,3)の次の4）、{kind:'boss', worldIndex:0} → "1 ボス"。
 *  worldIndex は0始まりなので表示は+1する。 */
export function stageShortLabel(ref: StageRef, segmentCounts: Partial<Record<Difficulty, number>>): string {
  const world = ref.worldIndex + 1
  if (ref.kind === 'boss') return `${world} ボス`
  const overall = overallSegmentNumber(ref.difficulty, ref.segment, segmentCounts)
  return `${world}-${overall} ${'★'.repeat(ref.difficulty)}`
}

/**
 * ワールド（worldIndex、0始まり）が解禁されているか。0番目は常に解禁。以降は直前ワールドの
 * ボス撃破が条件。対象作品0件のワールドはボスを倒しようがないため「自動クリア」扱いにして遡る
 * （0件ワールドが連続していても、実プレイで倒せる直近のワールドまで遡って判定する）。
 */
export function isWorldUnlocked(worldIndex: number, eras: Era[], imagePool: Work[], stages: Record<string, EraStageProgress>): boolean {
  if (worldIndex <= 0) return true
  const worlds = worldOrder(eras)
  for (let i = worldIndex - 1; i >= 0; i--) {
    const eraId = worlds[i]
    if (eraId === undefined) return false
    if (eraTotalItemCount(eraId, imagePool) === 0) continue
    return getEraStageProgress(stages, eraId).boss.cleared
  }
  return true
}
