// ステージ制 v2（マリオ型。オーナー実機フィードバック 2026-09-08、BOARD.md M2b-04）。
// M2b-01 の固定 s1/s2/s3/boss・ワープありを、直列解禁・可変面数に作り直す。
//
// チケット文面の規則（実装漏れ防止のためそのまま転記。builder メモ
// 「依頼文の規則はdocstringに番号で転記してから完了報告する」）:
//  1. 解禁を完全に直列にする：W-1→W-2→…→W-ボス→次ワールドの1面。ワープは削除。
//     ボスはそのワールドの全ステージをクリアするまで挑めない。
//  2. 表記：ステージIDは「era+難易度+分割番号」の形で持つ（例: genshi-1-1, genshi-2-1,
//     genshi-3-2）。UI表記（ワールド番号-面番号＋★の数）はM2b-05担当。engineはワールド
//     番号・面番号・難易度・ボスかどうかを判別できるデータ構造を返せばよい。
//  3. ステージ生成規則：ワールドの対象項目（出題可能な画像あり作品）を年代順（orderIndex）に
//     並べ、10件ずつに固定分割する。★1の面数=ceil(N/10)、★2・★3も同じ分割で同じ面数
//     （3段とも同じ分割・同じ面数）。1-1は常に同じ10作品（再挑戦しても対象は固定、
//     問題文・型・選択肢だけ変わる）。各面10問（1作品1問）が基本、クリア=9問以上正解相当
//     （clearThreshold）。端数の面（10件未満で余る最終面）: 件数が5件以上ならその件数×2問
//     （型を変えて2回）で10問に近づける。5件未満なら前の面に併合する。N<5のワールド全体は
//     暫定規則: 2N問・クリア閾値は1ミス許容（M2c-04の画像追加で解消する前提。実装上は
//     「端数×2問」と同じ式に帰着する＝下記 partitionIntoSegments 参照）。
//  4. ボス: N（そのワールドの対象項目数）≤15なら10問固定、N>15なら20問固定。本番モード
//     生成器をそのワールドの文化に限定して使い、reviewedテーマセットのリード文＋下線問題を
//     核に残りを補う。クリア閾値90%（ceil(0.9×N)、N<10でも最低1ミス許容。clearThreshold）。
//  5. 誤答露出規則: ボスの誤答選択肢を優先してそのワールドの項目から選ぶ。10〜20問の選択肢を
//     合わせるとワールドの全項目が最低1回は画面（正解or誤答）に出るようにする。厳密な保証が
//     難しい場合は「優先的に選ぶ」実装＋実測でよい（bossExposureRate でテストする）。
//  6. 体力ゲージ用の進捗値: ボス戦で「あと何問で決着か」をUIが出せるよう、現在の正解数・
//     不正解数・残り問数を返す構造にする（bossProgress）。
//  7. 進捗スキーマの移行: 面IDが変わるため旧M2bの進捗とは互換性がない。v2公開時に全リセット
//     する（progress.ts の STORAGE_VERSION・migrate 参照）。
//  8. 新しい面ID体系での「次に挑戦する面」を返す関数を用意する（nextStageRef。ホーム画面用）。
//
// 難易度は「設問の型」で定義する（コンテンツは触らない。M2b-01から変更なし）:
//  ★1 見分ける＝Q1 画像→作品名・Q3 作品名→画像
//  ★2 結びつける＝Q2 画像→文化・Q4 関連記述の正誤・Q6 同時代の事項・Q9 条件に合う画像・Q12 文化名当て
//  ★3 組み合わせて判断＝Q8 組合せ文・Q10 2文正誤・Q13 語句の組合せ・Q14 年代順
//
// 注記（低確信点。完了報告にも明記）: Q12（画像なし文字4択）は writer が passage の下線に
// 手書きした answerText/distractorTexts が無いと生成できない。ステージは特定の passage に
// 紐づかず「その文化の出題可能作品」から直接生成するため、Q12 は型リストに残すが実際には
// 常に生成0件になる（M2b-01から変更なし）。
import { buildQuestion, canGenerateType } from './session'
import { buildChoices, shuffle, type RandomFn } from './distractors'
import { generateStatementPairQuestion } from './statementPair'
import { generatePairQuestion } from './pairs'
import { generateOrderQuestion } from './order'
import { buildThemeQuestionForWork, buildThemeSetQuestions, pickThemeTargetId, COMPOSITION_SEQUENCE } from './themeSet'
import { underlineStem, standaloneStem } from './stems'
import type {
  Era,
  EraStageProgress,
  Passage,
  PassageUnderline,
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

export type Difficulty = 1 | 2 | 3

export const DIFFICULTY_TYPES: Record<Difficulty, QuestionType[]> = {
  1: ['q1', 'q3'],
  2: ['q2', 'q4', 'q6', 'q9', 'q12'],
  3: ['q8', 'q10', 'q13', 'q14'],
}

/** buildBossQuestions の最終補充パス用（M2b-99c中1）。q12（passage下線頼みで常に0件。
 *  上部の注記参照）・q14（3作品またがりで単一作品ループでは扱えない。buildOrderQuestions
 *  専用）を除いた「1作品から直接1問作れる型」の全体集合。tryBuildStageQuestionForWork
 *  （session.buildQuestion 経由）で生成できる型はこの範囲。 */
const ALL_PER_WORK_TYPES: QuestionType[] = [...DIFFICULTY_TYPES[1], ...DIFFICULTY_TYPES[2], ...DIFFICULTY_TYPES[3]].filter(
  (t) => t !== 'q12' && t !== 'q14',
)

/**
 * M2b-09（バグ修正）: 画像そのものを見せる／選択肢に画像を並べる型。engine/practiceSession.ts・
 * engine/missLog.ts と同じ定数（意図的に同じ名前・同じ範囲で重複定義。他エンジンファイルも
 * 各々ローカルに持つ既存の書き方に揃える）。
 *  - q1: 対象の画像がヒーロー画像として出る（プレースホルダ SVG は作品名を描くため、
 *    画像を持たない作品を対象にすると答えが直接見えてしまう）
 *  - q2: 対象の画像がヒーロー画像として出る（選択肢自体はテキスト＝文化名だが対象は画像必須）
 *  - q3・q9: 対象自身に加え、選択肢（choiceWorks）も画像として描画される
 * （QuestionCard.tsx の showHeroImage・`type==='q3'||type==='q9'` 分岐参照）。
 * この型を生成・出題する対象／誤答候補は必ず imagePool（画像あり作品のみ）から選ぶ。
 */
const IMAGE_DEPENDENT_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q9']

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: '★1 見分ける',
  2: '★2 結びつける',
  3: '★3 組み合わせて判断',
}

/** 10件ずつに固定分割する（チケット規則3）。 */
export const STAGE_CHUNK_SIZE = 10

/**
 * クリア閾値。M2b-01 reviewer指摘M2b-99中1の修正を引き継ぐ: 元の式 ceil(0.9×N) は N≤9 で
 * 常に N（＝全問正解）になり、decisions.md 2026-09-07「全問正解ではなく90%にした理由:
 * 1ミスでやり直しが続くと解説を読む前に離脱する懸念→オーナーが90%を選択」という決定の
 * 意図（1ミスは許容する）を N=10 以外では満たしていなかった。許容ミス数を
 * max(1, floor(N×0.1)) にし、N=10は従来どおり ceil(9)=9（1ミス許容）を維持しつつ、
 * N<10でも常に最低1ミスは許容する。N≤2（そもそも1ミスが意味をなさない極小値）は
 * 全問正解のままにする。M2b v2 の「N<5暫定規則: 1ミス許容」もこの式で満たされる
 * （例: N=2→2N=4問→clearThreshold(4)=3=「3問以上正解」。チケット文面の例と一致）。
 */
export function clearThreshold(questionCount: number): number {
  const n = questionCount
  if (n <= 2) return n
  const allowedMisses = Math.max(1, Math.floor(n * 0.1))
  return Math.max(1, n - allowedMisses)
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

/** チケット規則2「面IDはera+難易度+分割番号」。era側は呼び出し元（progress.ts の stages の
 *  キー）が既に eraId で分けているため、ここでは difficulty-segment の部分だけを作る
 *  （例 "1-1" "2-3"）。 */
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

// --- ステージ生成規則（チケット規則3） ---

export interface StageSegmentPlan {
  /** 1始まりの面番号（同じ難易度内でのみ意味を持つ）。 */
  segment: number
  /** この面の対象作品 id（年代順固定。1-1なら常に同じ10件、再挑戦しても変わらない）。 */
  workIds: string[]
  /**
   * workIds の先頭から何件を「2問（型を変えて2回）」にするか（0件なら全作品1問）。
   * M2b-99c中5是正: 以前は remainder>=5 のとき無条件で全件2問にしており、N=9で18問など
   * 「10問に近づける」の意図と逆に10から遠ざかっていた。修正後は
   * remainder+extraDoubleCount=10（＝questionCountForSegmentが常に10）になるよう
   * extraDoubleCount=10-remainderの作品だけを2問にする（実行セッションの解釈確定。
   * BOARD.md M2b-99c 中5参照）。ただし era全体がそもそも10件未満（N<5暫定規則、
   * fullChunks===0 && remainder<5）は decisions.md 2026-09-08 の「2N問」を維持するため
   * extraDoubleCount=workIds.length（全件2問）のまま変えない。
   */
  extraDoubleCount: number
}

export interface EraStagePlan {
  eraId: string
  /** 対象作品総数（imagePool のうちその era のもの）。ボス長・N<5判定の元になる値。 */
  itemCount: number
  /** ★1〜★3で共通の面リスト（チケット規則3「3段とも同じ分割・同じ面数」）。難易度による
   *  違いは面の中身（対象作品）ではなく、その面で使う設問の型（DIFFICULTY_TYPES）だけ。 */
  segments: StageSegmentPlan[]
  bossSize: number
}

/** N≤15なら10問、N>15なら20問（チケット規則4）。N=0（対象項目が無い）はボスを作れないため0。 */
export function bossQuestionCount(itemCount: number): number {
  if (itemCount <= 0) return 0
  return itemCount <= 15 ? 10 : 20
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

/**
 * 10件ずつの固定分割＋端数規則（チケット規則3、端数の問数配分はM2b-99c中5是正）。
 *  - 余りが無い（N が10の倍数）: フルチャンクのみ（extraDoubleCount=0）。
 *  - 余り(remainder) < 5 かつ既にフルチャンクがある: 前の面に併合（1面にする。
 *    併合後の面は10+remainder件で10問以上あるため2問化はしない＝extraDoubleCount=0）。
 *  - 余り(remainder) < 5 かつ フルチャンクが無い（era全体がN<5）: decisions.md
 *    2026-09-08の「N<5暫定規則: 2N問」を維持し、全件2問（extraDoubleCount=remainder）。
 *  - 余り(remainder) >= 5（フルチャンクの有無を問わない）: 目標10問に近づける
 *    （M2b-99c中5）。extraDoubleCount = 10-remainder 件だけを2問にし、
 *    合計が remainder + (10-remainder) = 10 になるようにする。
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

/** 面の目標問題数（先頭 extraDoubleCount 件は2問、残りは1問。チケット規則3・M2b-99c中5）。 */
export function questionCountForSegment(seg: StageSegmentPlan): number {
  return seg.workIds.length + seg.extraDoubleCount
}

/** ワールド（era）のステージ計画を組み立てる（純粋にデータの分割のみ。設問は作らない）。
 *  imagePool は content.ts の playableWorks 相当（出題対象自身は画像必須）。 */
export function buildEraStagePlan(eraId: string, imagePool: Work[]): EraStagePlan {
  const eraWorks = sortByOrderIndex(imagePool.filter((w) => w.era === eraId))
  const itemCount = eraWorks.length
  return {
    eraId,
    itemCount,
    segments: partitionIntoSegments(eraWorks),
    bossSize: bossQuestionCount(itemCount),
  }
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

/** その難易度の型（q12・q14を除く）の中から、まだこの作品で使っていない型を優先して
 *  1問だけ作る（同じ作品×同じ型は同じ呼び出し列の中で重複させない）。
 *  M2b-09是正: 画像が要る型（IMAGE_DEPENDENT_TYPES）は、対象自身が imagePool にある
 *  （＝画像を持つ）ときだけ候補にし、その型を作るときの pool 引数も imagePool に限定する
 *  （practiceSession.ts・missLog.ts・themeSet.ts と同じ考え方）。それ以外の型は従来どおり
 *  pool（themeSetPool 相当。画像なし項目も含む素材プール）を使う。 */
function tryBuildStageQuestionForWork(
  work: Work,
  types: QuestionType[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn,
  usedTypesForWork: Set<QuestionType>,
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
    else if (canGenerateType(type, work, usablePool, eras)) q = buildQuestion(work, type, usablePool, eras, false, rng)
    if (q) return q
  }
  return null
}

/** Q14（年代順）は1問が3作品にまたがるため、単一作品×型のループでは扱えない。難易度3の面で
 *  目標問数に足りないときの補充として、独立に末尾へ追加する（M2b-01から変更なし）。 */
function buildOrderQuestions(segWorks: Work[], eras: Era[], rng: RandomFn, maxCount: number): Question[] {
  const out: Question[] = []
  let remaining = segWorks.filter((w) => typeof w.orderIndex === 'number')
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
 * eraId・difficulty・segment から、その面の対象作品に対して設問を作る（チケット規則3）。
 * pool は content.ts の themeSetPool 相当（distractor 素材。画像なし項目も含む）、imagePool は
 * playableWorks 相当（出題対象自身は画像必須）。segment が存在しない（面数を超えた番号）、
 * または対象文化に出題対象が無ければ空配列。
 * M2e-02: passages（省略可・既定 []）を渡すと、その era の passages の下線が対象にする作品には
 * 「下線部○」を参照する設問文（passageId/underlineKey つき、components/StageScreen.tsx が
 * そのまま LeadPanel に渡せる）を、それ以外の作品には下線を参照しない単独問題の設問文
 * （engine/stems.ts）を付ける。省略時（後方互換。既存呼び出し・テスト）は全問が単独問題扱いになる。
 */
export function buildStageQuestions(
  eraId: string,
  difficulty: Difficulty,
  segment: number,
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  rng: RandomFn = defaultRandom,
  passages: Passage[] = [],
): Question[] {
  const plan = buildEraStagePlan(eraId, imagePool)
  const seg = plan.segments.find((s) => s.segment === segment)
  if (!seg) return []
  const idSet = new Set(seg.workIds)
  const segWorks = shuffle(
    imagePool.filter((w) => idSet.has(w.id)),
    rng,
  )
  const targetCount = questionCountForSegment(seg)
  const perWorkTypes = DIFFICULTY_TYPES[difficulty].filter((t) => t !== 'q12' && t !== 'q14')
  // M2b-99c中5: どの作品を2問にするかは seg.workIds（年代順固定）の先頭 extraDoubleCount 件で
  // 決める（1-1が常に同じ内容になる要件を保つため、出題順シャッフル後の segWorks ではなく
  // 分割計画側の順序で決定的に選ぶ）。
  const doubledIds = new Set(seg.workIds.slice(0, seg.extraDoubleCount))
  const eraPassages = passages.filter((p) => p.era === eraId)
  const candidateByWorkId = buildEraCandidateByWorkId(eraPassages, pool)

  const questions: Question[] = []
  for (const work of segWorks) {
    const usedTypesForWork = new Set<QuestionType>()
    const perWork = doubledIds.has(work.id) ? 2 : 1
    for (let i = 0; i < perWork; i++) {
      const q = tryBuildStageQuestionForWork(work, perWorkTypes, pool, imagePool, eras, rng, usedTypesForWork)
      if (q) {
        questions.push(attachLeadStem(q, candidateByWorkId.get(work.id)))
        usedTypesForWork.add(q.type)
      }
    }
  }
  if (DIFFICULTY_TYPES[difficulty].includes('q14') && questions.length < targetCount) {
    questions.push(...buildOrderQuestions(segWorks, eras, rng, targetCount - questions.length))
  }
  return shuffle(questions, rng)
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

/** buildEraCandidatePool を work.id → 最初に見つかった候補（passage・underline）の逆引きにする
 *  （M2e-02: 面/ボスの各作品が「どの下線から出せるか」を知るため。複数の下線が同じ作品を
 *  対象にすることがあるが、ここでは最初の1件だけを使う＝どれか1つの下線部キーが分かれば
 *  設問文に「下線部○」を付けられるため十分。厳密な優先順位は問わない）。 */
function buildEraCandidateByWorkId(eraPassages: Passage[], pool: Work[]): Map<string, EraCandidate> {
  const map = new Map<string, EraCandidate>()
  for (const candidate of buildEraCandidatePool(eraPassages, pool)) {
    if (!map.has(candidate.work.id)) map.set(candidate.work.id, candidate)
  }
  return map
}

/** 生成された Question に、下線起点なら「下線部○」を参照する設問文＋passageId/underlineKey を、
 *  下線に紐づかない補充問題なら下線を参照しない単独問題の設問文を付ける（M2e-02、engine/stems.ts）。
 *  既に stem が付いている（themeSet.ts 経由で writer 手書き ask.stem 等が既に入っている）場合は
 *  上書きしない。 */
function attachLeadStem(q: Question, candidate: EraCandidate | undefined): Question {
  if (q.stem) return q
  if (candidate) {
    return {
      ...q,
      passageId: candidate.passage.id,
      underlineKey: candidate.underline.key,
      stem: underlineStem(q.type, candidate.underline.key, { reversed: q.reversed, conditionText: q.conditionText }),
    }
  }
  return { ...q, stem: standaloneStem(q.type, { reversed: q.reversed, conditionText: q.conditionText }) }
}

/** 設問1件が画面に出す作品 id（正解・誤答選択肢・年代順の複数作品を含む）。誤答露出規則
 *  （チケット規則5）の実測・優先選定に使う。choiceStatements/choiceCombos/choiceQ12/
 *  choiceWordPairs はテキストのみで他作品の画像を出さないため対象外（q.work 自身は
 *  どの型でもリード/画像として画面に出るため常に含める）。 */
function questionExposedWorkIds(q: Question): string[] {
  const ids = [q.work.id]
  if (q.choiceWorks) ids.push(...q.choiceWorks.map((w) => w.id))
  if (q.orderItems) ids.push(...q.orderItems.map((oi) => oi.work.id))
  return ids
}

/** era の項目のうち、まだ画面に出ていない（exposed に無い）ものを items の先頭に押し出す。
 *  distractors.ts の pickWorkDistractors は「同カテゴリ・近い時代」を距離でソートしており、
 *  同じ era 内は距離0で同点になるため、Array.sort の安定性により元の並び順（＝ここで
 *  先頭に寄せた順）が保たれ、露出していない項目が選ばれやすくなる。厳密な保証ではなく
 *  「優先的に選ぶ」実装（チケット規則5が明示的に許容する範囲）。 */
function biasForExposure<T extends Work>(items: T[], eraId: string, exposed: Set<string>): T[] {
  const unexposedEraMates: T[] = []
  const rest: T[] = []
  for (const w of items) {
    if (w.era === eraId && !exposed.has(w.id)) unexposedEraMates.push(w)
    else rest.push(w)
  }
  return [...unexposedEraMates, ...rest]
}

/**
 * ボス: N≤15なら10問、N>15なら20問（チケット規則4。count を明示すればテスト等で上書きできる）。
 * M2e-02: 以前は「その文化の passage を1本ランダムに選ぶ」→その1本の下線が尽きたら
 * すぐフォールバックする設計だったため、下線に紐づかない作品の補充（フォールバック3・4、
 * 下記）が早く発生し、そこで生成される設問が「下線部○」を欠いていた
 * （research/stem-patterns.md 4.4）。ここではその文化の**全 passage の全下線**を候補にする
 * （パス1・2）。それでも targetCount に届かない場合だけ、下線に紐づかない作品を
 * engine/stems.ts の単独問題テンプレートで補う（パス3・4）。誤答は露出していないそのワールドの
 * 項目を優先する（チケット規則5、biasForExposure）。
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
  count?: number,
): Question[] {
  const itemCount = imagePool.filter((w) => w.era === eraId).length
  const targetCount = count ?? bossQuestionCount(itemCount)
  const eraPassages = passages.filter((p) => p.era === eraId)
  if (eraPassages.length === 0 || targetCount === 0) return []
  const candidateByWorkId = buildEraCandidateByWorkId(eraPassages, pool)

  // パス1（M2e-02改修）: 1本のpassageに絞らず、その文化の全passageを順に（ランダム順で）
  // buildThemeSetQuestions にかけて合算する。buildThemeSetQuestions 自身が持つ型構成の保証
  // （Q9/Q10各1問以上・同型連続回避）はpassage単位でそのまま活きる。「同じ作品は1回の試験で
  // 1問まで」（mockExam.ts と同じ規則）を全passage分の合算にも適用する（themeSeenIds）。
  const themeQuestions: Question[] = []
  const themeSeenIds = new Set<string>()
  for (const passage of shuffle(eraPassages, rng)) {
    if (themeQuestions.length >= targetCount) break
    for (const tq of buildThemeSetQuestions(passage, pool, eras, rng, imagePool)) {
      if (themeQuestions.length >= targetCount) break
      if (themeSeenIds.has(tq.question.work.id)) continue
      themeSeenIds.add(tq.question.work.id)
      themeQuestions.push({ ...tq.question, passageId: passage.id, underlineKey: tq.underlineKey })
    }
  }
  const built: Question[] = themeQuestions.slice(0, targetCount)
  const usedWorkIds = new Set(built.map((q) => q.work.id))
  const exposedIds = new Set<string>()
  for (const q of built) for (const id of questionExposedWorkIds(q)) exposedIds.add(id)

  if (built.length < targetCount) {
    const candidates = shuffle(buildEraCandidatePool(eraPassages, pool), rng)
    let previousType: QuestionType | undefined = built.length > 0 ? built[built.length - 1].type : undefined
    let avoidEraSlot = built.some((q) => q.type === 'q9' && q.q9Slot === 'era')
    for (const candidate of candidates) {
      if (built.length >= targetCount) break
      if (usedWorkIds.has(candidate.work.id)) continue
      const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
      const question = buildThemeQuestionForWork(candidate.work, biasForExposure(pool, eraId, exposedIds), eras, rng, {
        ask: candidate.underline.ask,
        avoidEraSlot,
        avoidType: previousType,
        imagePool: biasForExposure(imagePool, eraId, exposedIds),
        desiredCategory,
        underlineKey: candidate.underline.key,
      })
      if (!question) continue
      usedWorkIds.add(candidate.work.id)
      if (question.q9Slot === 'era') avoidEraSlot = true
      previousType = question.type
      built.push({ ...question, passageId: candidate.passage.id, underlineKey: candidate.underline.key })
      for (const id of questionExposedWorkIds(question)) exposedIds.add(id)
    }

    // reviewer指摘M2b-99重大1の修正（M2b-01から引き継ぎ）: 上のcandidatesは「そのeraの
    // passageの下線が指す作品」に限られるため、下線のdistinct target数が少ない文化（実測:
    // kitayama/momoyamaは1件）でボスが目標問数に届かないことがある。buildStageQuestionsと
    // 同じ「そのeraのpool全体」を第2の補充源にし、下線に紐づかない作品も候補にする。
    // M2e-02: それでも candidateByWorkId に載っている作品（パス2で他の型が失敗しただけの
    // 作品）は underlineKey を渡して「下線部○」を保つ。載っていない作品は
    // engine/stems.ts の単独問題テンプレートになる（buildThemeQuestionForWorkWithMeta 側の
    // 既定 stem 付与ロジックが underlineKey の有無で自動的に切り替える）。
    if (built.length < targetCount) {
      const eraWorks = shuffle(
        pool.filter((w) => w.era === eraId && !usedWorkIds.has(w.id)),
        rng,
      )
      for (const work of eraWorks) {
        if (built.length >= targetCount) break
        const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
        const candidate = candidateByWorkId.get(work.id)
        const question = buildThemeQuestionForWork(work, biasForExposure(pool, eraId, exposedIds), eras, rng, {
          avoidEraSlot,
          avoidType: previousType,
          imagePool: biasForExposure(imagePool, eraId, exposedIds),
          desiredCategory,
          underlineKey: candidate?.underline.key,
        })
        if (!question) continue
        usedWorkIds.add(work.id)
        if (question.q9Slot === 'era') avoidEraSlot = true
        previousType = question.type
        built.push(candidate ? { ...question, passageId: candidate.passage.id, underlineKey: candidate.underline.key } : question)
        for (const id of questionExposedWorkIds(question)) exposedIds.add(id)
      }
    }

    // M2b-99c中1: 上記2パスでも目標問数に届かないワールド（実測: insei/kitayama/momoyama/
    // higashiyama/kanei/genroku/kasei。fact-check-m2b-v2.md参照）向けの改善。「同一作品×別の
    // 問題型の組み合わせを増やす」（チケット文面の例）を採用し、既に使った作品でも
    // まだ使っていない型でなら再登場を許す（同じ作品×同じ型の完全重複はしない＝出題の質は
    // 落とさない）。usedTypesForWork は既に built に入っている全問題から作品ごとの使用済み
    // 型を復元する（テーマセット由来の問題も含めて漏れなく重複回避するため）。
    // M2e-02: この経路（tryBuildStageQuestionForWork）は themeSet.ts を経由しないため
    // stem が付かない。attachLeadStem で下線起点／単独問題いずれかの設問文を付ける。
    if (built.length < targetCount) {
      const usedTypesForWork = new Map<string, Set<QuestionType>>()
      for (const q of built) {
        const set = usedTypesForWork.get(q.work.id) ?? new Set<QuestionType>()
        set.add(q.type)
        usedTypesForWork.set(q.work.id, set)
      }
      const eraWorksAll = shuffle(
        pool.filter((w) => w.era === eraId),
        rng,
      )
      // 1周で複数の型を使い切れる作品もあるため、進展がある限り複数周する
      // （itemCount・型集合の大きさはどちらも高々十数件のため計算量は問題にならない）。
      let progressed = true
      while (built.length < targetCount && progressed) {
        progressed = false
        for (const work of eraWorksAll) {
          if (built.length >= targetCount) break
          const usedTypes = usedTypesForWork.get(work.id) ?? new Set<QuestionType>()
          const question = tryBuildStageQuestionForWork(work, ALL_PER_WORK_TYPES, pool, imagePool, eras, rng, usedTypes)
          if (!question) continue
          usedTypes.add(question.type)
          usedTypesForWork.set(work.id, usedTypes)
          built.push(attachLeadStem(question, candidateByWorkId.get(work.id)))
          for (const id of questionExposedWorkIds(question)) exposedIds.add(id)
          progressed = true
        }
      }
    }
  }
  return built
}

/** チケット規則5の実測用。ボスの1回の生成結果について、そのワールドの項目のうち
 *  何件が画面に出たか（正解 or 誤答choiceWorks/orderItemsとして）を返す。100%未達の場合の
 *  「次点の改善余地」は stages.realdata.test.ts のコメントを参照。 */
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

// --- 体力ゲージ用の進捗値（チケット規則6） ---

export interface BossProgress {
  total: number
  correct: number
  incorrect: number
  /** 未回答（残り）問数。 */
  remaining: number
  /** この total で何問正解すればクリアか（clearThreshold(total)）。 */
  clearThreshold: number
}

/** ボス戦の途中経過（何問目まで答えたか）から、体力ゲージ表示に要る値をまとめる
 *  （見た目自体はUI/M2b-05担当）。 */
export function bossProgress(total: number, correct: number, incorrect: number): BossProgress {
  return {
    total,
    correct,
    incorrect,
    remaining: Math.max(0, total - correct - incorrect),
    clearThreshold: clearThreshold(total),
  }
}

// --- 解禁（純関数。チケット規則1: 完全直列、ワープなし） ---

export type StageLocalKey = { kind: 'segment'; difficulty: Difficulty; segment: number } | { kind: 'boss' }

export type StageRef =
  | { kind: 'segment'; eraId: string; worldIndex: number; difficulty: Difficulty; segment: number }
  | { kind: 'boss'; eraId: string; worldIndex: number }

/** StageRef を一意に識別する文字列キー（チケット規則2の「era+難易度+分割番号」形式。
 *  例 "genshi-1-1" "genshi-boss"）。UI表示用の整形（「1-1」「W1 ★1」等）はM2b-05担当。 */
export function stageRefKey(ref: StageRef): string {
  return ref.kind === 'boss' ? `${ref.eraId}-boss` : `${ref.eraId}-${ref.difficulty}-${ref.segment}`
}

function sameLocalKey(ref: StageRef, key: StageLocalKey): boolean {
  if (key.kind === 'boss') return ref.kind === 'boss'
  return ref.kind === 'segment' && ref.difficulty === key.difficulty && ref.segment === key.segment
}

/** 1ワールド分の直列シーケンス: ★1の面を面番号順→★2→★3→ボス（チケット規則1・3）。
 *  ★1〜3は同じ面数（buildEraStagePlan.segments が共通）。
 *  M2b-99c中7: 対象作品0件のワールド（itemCount===0。将来のM2c-04でコンテンツが
 *  増減した際に起こりうる）は面もボスも作れない（buildStageQuestions/buildBossQuestions
 *  はどちらも空配列を返す）ため、そのままシーケンスに乗せると誰にも倒せないボスで
 *  以降全ワールドが恒久的に詰む。シーケンスから丸ごと除外する（＝「自動クリア」相当。
 *  isWorldUnlocked側の対応と対で見ること）。 */
function worldStageSequence(eraId: string, worldIndex: number, imagePool: Work[]): StageRef[] {
  const plan = buildEraStagePlan(eraId, imagePool)
  if (plan.itemCount === 0) return []
  const refs: StageRef[] = []
  for (const difficulty of [1, 2, 3] as Difficulty[]) {
    for (const seg of plan.segments) {
      refs.push({ kind: 'segment', eraId, worldIndex, difficulty, segment: seg.segment })
    }
  }
  refs.push({ kind: 'boss', eraId, worldIndex })
  return refs
}

/** 全ワールドを通した直列シーケンス（W-1の★1-1から最終ワールドのボスまで）。
 *  「解禁は完全に直列」（チケット規則1）を1本の配列で表現し、以降の解禁判定は
 *  「このシーケンス上で自分より前が全てクリア済みか」だけで決まる。 */
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

/** 指定した面（eraId・key）が解禁されているか（チケット規則1: 完全直列。ワープに相当する
 *  APIはこのモジュールに存在しない＝「そのワールド自身のボスを先に倒せば全ステージ解禁」
 *  のような経路はもう無い）。 */
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

/** 次に挑戦する面（ホーム画面のカード用。チケット規則8）。全ワールド・全面をクリア済みなら
 *  null（15ワールド撃破後の「館長」演出はM2b-05担当）。 */
export function nextStageRef(eras: Era[], imagePool: Work[], stages: Record<string, EraStageProgress>): StageRef | null {
  const sequence = fullStageSequence(eras, imagePool)
  const boundary = stageUnlockBoundary(sequence, stages)
  return boundary < sequence.length ? sequence[boundary] : null
}

/** StageRef を StageLocalKey に変換する（era側の情報を落とす）。ホーム画面が
 *  nextStageRef() の戻り値をそのまま App.tsx の goStage(eraId, key) に渡すために使う
 *  （チケット規則8。M2b-05）。 */
export function stageRefToLocalKey(ref: StageRef): StageLocalKey {
  return ref.kind === 'boss' ? { kind: 'boss' } : { kind: 'segment', difficulty: ref.difficulty, segment: ref.segment }
}

/**
 * ワールド内の通し面番号（M2b-99c中6是正）。以前は segment が★1〜3それぞれで1から
 * 振り直されるため、全難易度が同じ「1-1」になっていた（BOARD.mdの「1-1→1-2→…」という
 * 通し表記と食い違っていた）。segmentsPerWorld（そのワールドの buildEraStagePlan(...)
 * .segments.length。★1〜3で共通＝チケット規則3）を使い、★1の面がそのまま1,2,…、
 * ★2の面がsegmentsPerWorld+1,…と続く通し番号にする。
 */
export function overallSegmentNumber(difficulty: Difficulty, segment: number, segmentsPerWorld: number): number {
  return (difficulty - 1) * segmentsPerWorld + segment
}

/** UI表記「ワールド番号-面番号＋★の数」（M2b-05担当、チケット規則2の欄外注記どおりここに置く。
 *  面番号はM2b-99c中6是正でワールド内の通し番号）。
 *  例: segmentsPerWorld=3 のとき {kind:'segment', worldIndex:0, difficulty:2, segment:1} →
 *  "1-4 ★★"（★1の3面ぶん(1,2,3)の次の4）、{kind:'boss', worldIndex:0} → "1 ボス"。
 *  worldIndex は0始まりなので表示は+1する。segmentsPerWorld は呼び出し側が
 *  buildEraStagePlan(eraId, imagePool).segments.length を渡す（boss には無関係な引数）。 */
export function stageShortLabel(ref: StageRef, segmentsPerWorld: number): string {
  const world = ref.worldIndex + 1
  if (ref.kind === 'boss') return `${world} ボス`
  const overall = overallSegmentNumber(ref.difficulty, ref.segment, segmentsPerWorld)
  return `${world}-${overall} ${'★'.repeat(ref.difficulty)}`
}

/**
 * ワールド（worldIndex、0始まり）が解禁されているか。0番目は常に解禁。以降は直前ワールドの
 * ボス撃破が条件（マップの雲演出向け。M2b-06担当だが判定はここに置く）。
 * M2b-99c中7: 対象作品0件のワールドはボスを倒しようがない（worldStageSequenceでも
 * シーケンスから除外している）ため、次ワールドを詰まらせないよう「自動クリア」扱いにして
 * 遡る。0件ワールドが連続していても、実プレイで倒せる直近のワールドまで遡って判定する
 * （見つからなければ＝それより前が全て0件＝先頭ワールド相当として解禁する）。
 */
export function isWorldUnlocked(worldIndex: number, eras: Era[], imagePool: Work[], stages: Record<string, EraStageProgress>): boolean {
  if (worldIndex <= 0) return true
  const worlds = worldOrder(eras)
  for (let i = worldIndex - 1; i >= 0; i--) {
    const eraId = worlds[i]
    if (eraId === undefined) return false
    const itemCount = imagePool.filter((w) => w.era === eraId).length
    if (itemCount === 0) continue
    return getEraStageProgress(stages, eraId).boss.cleared
  }
  return true
}
