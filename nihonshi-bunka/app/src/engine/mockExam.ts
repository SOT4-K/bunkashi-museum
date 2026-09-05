// 本番モード（大問IV形式の模試）。M2-20 → M2-45 で「学習を始める」（ランダム学習。M2-21・
// engine/randomLearn.ts）を統合した。research/nichidai-past-exams-analysis.md 10.5章:
//  「本番モードとランダム学習を統合: 本番モード＝全15文化から本番形式で10問（型の配分は
//  本番どおり、20点表示、結果に型別の正答率）。経験値・図鑑・SRS・間違いノートが更新される。
//  『時間を計る』トグル（既定オフ）」。
//
// 設問の選び方は旧 randomLearn.ts のロジックをそのまま引き継ぐ（全 passage の全下線から
// 対象作品を一意に持つ候補プールを作り、eras.json の weight × SRS 期限到来ボーナスで
// 重み付き非復元抽出する）。type の配分は themeSet.ts の COMPOSITION_SEQUENCE（本番配分）を
// 下線の位置ごとに割り当てる。
//
// M2-45 で M2-25 の指摘④（ランダム学習が writer 手書きの ask/stem を使わない）も解消する:
// 旧 randomLearn.ts は buildThemeQuestionForWork(candidate.work, ...) を ask オプション無しで
// 呼んでいたため、下線の ask（type/stem/answerId 等）を無視していた。ここでは
// `ask: candidate.underline.ask` を渡し、buildThemeSetQuestions と同じく ask を最優先で試す。
//
// kind: "image"（画像リード型）の passage も対象にする（旧 buildMockExam は「大問IVのリード文
// 形式に合わない」として除外していたが、M2-45「全15文化から」の対象は kind を問わない。
// themeSet.ts の pickThemeTargetId が leadWorkIds へのフォールバックを持つため、画像リード型の
// 下線も候補プールに自然に入る）。
import { weightedSampleWithoutReplacement, eraWeight } from './weighted'
import { selectReviewCandidates } from './session'
import { buildThemeQuestionForWork, COMPOSITION_SEQUENCE, pickThemeTargetId } from './themeSet'
import { generateOrderQuestion } from './order'
import { excerptSegmentsForUnderline, type PassageSegment } from './passage'
import type { RandomFn } from './distractors'
import type { Era, Passage, PassageUnderline, ProgressState, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** 本番と同じ10問・20点満点（1問2点）。 */
export const MOCK_EXAM_SIZE = 10
export const MOCK_EXAM_POINTS_PER_QUESTION = 2
/** 時間目安10分（分析5.4章）。あくまで目安の表示で、自動採点はしない。 */
export const MOCK_EXAM_TIME_SECONDS = 600

/** 復習期限が来ている作品を優先する倍率（judgment call。決め打ちの経験値。旧 randomLearn.ts から継承）。 */
const DUE_WEIGHT_BONUS = 4

export interface MockExamItem {
  /** 出題元のリード文（全文表示・下線ラベル表示に使う。M2-42）。
   *  reviewer指摘M2-99v3中4: Q14（年代順、下記）は特定の下線に紐づかない独立問題のため無い
   *  （undefined）。呼び出し側はこの場合リード文の抜粋・LeadPanelを表示しない。 */
  passage?: Passage
  eraId: string
  underlineKey: string
  /** 「下線部を含む1〜2文」の描画用セグメント（下線ハイライトつき。旧ランダム学習と同じ見え方）。
   *  passage が無い（Q14）ときは空配列。 */
  excerpt: PassageSegment[]
  question: Question
}

interface Candidate {
  passage: Passage
  underline: PassageUnderline
  work: Work
}

/** 全 passage の全下線から候補一覧を作る（reviewer指摘M2-24重大1の修正: 以前はここで
 *  「同じ作品は最初の下線のみ」に絞っていたため、複数の passage が同じ作品を下線に持つ場合
 *  （2本目のテーマセットは1本目と同じ作品プールを使うことが多く、実データではほぼ必ず重複する）、
 *  passages 配列で後に来る passage 側の下線が本番モードの候補から永久に消える実バグがあった
 *  （content.ts の並び順が era→id のため常に -01 が勝ち -02 が全滅する。実測: genshi-02/kanei-02/
 *  genroku-02 は下線が全滅、horeki-tenmei-03 は5本中1本しか残らない状態だった）。
 *  ここでは重複を許して全下線を候補として残し、1回の試験内での重複回避は buildMockExam 側の
 *  抽選ループで行う（「同じ作品は1回の試験で1問まで」という目的自体は維持し、15文化への偏りは
 *  eraWeight の重みで扱う）。旧 randomLearn.ts から移設。 */
function buildCandidatePool(passages: Passage[], pool: Work[]): Candidate[] {
  const availableIds = new Set(pool.map((w) => w.id))
  const byId = new Map(pool.map((w) => [w.id, w]))
  const candidates: Candidate[] = []
  for (const passage of passages) {
    for (const underline of passage.underlines) {
      const targetId = pickThemeTargetId(underline, passage, availableIds)
      if (!targetId) continue
      const work = byId.get(targetId)
      if (!work) continue
      candidates.push({ passage, underline, work })
    }
  }
  return candidates
}

interface BuiltItem {
  /** Q14（年代順、下記）に差し替えられた枠は passage/underline が無い（特定の下線に紐づかない
   *  独立問題のため。reviewer指摘M2-99v3中4）。 */
  passage: Passage | null
  underline: PassageUnderline | null
  question: Question
}

/**
 * reviewer指摘M2-25⑤の修正: 図鑑（MuseumScreen）・成績タブ（StatsScreen）の分母が
 * `works`（reviewed全件）を使っており、どの passage の下線からも対象にならない作品
 * （＝本番モードで永久に「発見」されえない作品）まで分母に含んでいた
 * （文化別練習は経験値・図鑑・SRSを更新しないため、discoveredAtの唯一の経路は本番モードの
 * buildCandidatePoolが対象にする作品だけ）。この関数は「本番モードで実際に発見されうる
 * 作品」の一覧を返す。App.tsx が works の代わりにこれを MuseumScreen/StatsScreen に渡す。
 */
export function discoverableWorks(passages: Passage[], pool: Work[]): Work[] {
  const seen = new Set<string>()
  const result: Work[] = []
  for (const candidate of buildCandidatePool(passages, pool)) {
    if (seen.has(candidate.work.id)) continue
    seen.add(candidate.work.id)
    result.push(candidate.work)
  }
  return result
}

/**
 * 本番モード（全15文化・本番配分・重み付き抽選）の10問セットを組み立てる。
 * passages/pool が空、またはどの下線からも設問を作れない場合は空配列を返す
 * （呼び出し側で「作れなかった」メッセージを出す。エラーにしない）。
 */
export function buildMockExam(
  passages: Passage[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  progress: ProgressState,
  today: string,
  rng: RandomFn = defaultRandom,
  count = MOCK_EXAM_SIZE,
): MockExamItem[] {
  if (passages.length === 0 || pool.length === 0) return []
  const candidates = buildCandidatePool(passages, pool)
  if (candidates.length === 0) return []

  const dueWorkIds = new Set(selectReviewCandidates(pool, progress, today, rng, eras).map((p) => p.work.id))
  const weightOf = (c: Candidate) => eraWeight(c.work.era, eras) * (dueWorkIds.has(c.work.id) ? DUE_WEIGHT_BONUS : 1)
  const ordered = weightedSampleWithoutReplacement(candidates, weightOf, candidates.length, rng)

  const built: BuiltItem[] = []
  const usedWorkIds = new Set<string>()
  let avoidEraSlot = false
  let previousType: QuestionType | undefined
  for (const candidate of ordered) {
    if (built.length >= count) break
    // 同じ作品が複数 passage に重複して候補にある場合、1回の試験内では1問までにする
    // （buildCandidatePool の重複許可とセットの修正。15文化への偏りは eraWeight 側で扱う）。
    if (usedWorkIds.has(candidate.work.id)) continue
    const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
    // M2-45（M2-25 の解消）: 下線の ask を渡す（writer 手書きの stem・answerId 等を尊重する）。
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
    built.push({
      passage: candidate.passage,
      underline: candidate.underline,
      question: { ...question, passageId: candidate.passage.id, underlineKey: candidate.underline.key },
    })
  }

  // 図版問題（Q9）は最低1問（analysis 7章）。desiredCategory の周期上は10問中2問が
  // 'image' 狙いになるが、生成失敗でフォールバックすると0になりうるため、0件のときだけ
  // 強制的に作り直す（best-effort。imagePool に無い作品ばかりの極端なケースでは諦める）。
  if (built.length > 0 && !built.some((b) => b.question.type === 'q9')) {
    for (let i = 0; i < built.length; i++) {
      const b = built[i]
      if (!b.passage || !b.underline) continue
      if (!imagePool.some((w) => w.id === b.question.work.id)) continue
      const forced = buildThemeQuestionForWork(b.question.work, pool, eras, rng, { ask: { type: 'q9' }, imagePool })
      if (forced && forced.type === 'q9') {
        built[i] = { ...b, question: { ...forced, passageId: b.passage.id, underlineKey: b.underline.key } }
        break
      }
    }
  }

  // reviewer指摘M2-25②③の修正: 実データでは全下線がask.type明示のため、desiredCategoryの
  // 'pairs'（Q13）・COMPOSITION_SEQUENCE経由のQ14は事実上発火せず、Q13・Q14が0%になっていた
  // （analysis 2章T1「語句の組合せ」約22%・T7「年代順」約5%を訓練できていなかった）。
  // Q9と同じ「最低1問」のbest-effort強制パターンをQ13にも適用する（work.pairsが無い/少ない
  // 作品ばかりの極端なケースでは諦める。壊れない設計）。
  if (built.length > 0 && !built.some((b) => b.question.type === 'q13')) {
    for (let i = 0; i < built.length; i++) {
      const b = built[i]
      if (!b.passage || !b.underline) continue
      if (!(b.question.work.pairs && b.question.work.pairs.length > 0)) continue
      const forced = buildThemeQuestionForWork(b.question.work, pool, eras, rng, { ask: { type: 'q13' } })
      if (forced && forced.type === 'q13') {
        built[i] = { ...b, question: { ...forced, passageId: b.passage.id, underlineKey: b.underline.key } }
        break
      }
    }
  }

  // Q14（年代順並べ替え）: 旧 ThemeSetScreen の appendOrderQuestionIfDue は「3セットに1問」を
  // 連続提示の通し番号（setIndex）で判定していたが、本番モードは1回ごとに独立した10問セットで
  // setIndex の概念が無い。同じ約1/3の頻度を rng で近似する（M2-16の意図「3セットに1問」を
  // 単発の試験生成に翻訳したもの）。generateOrderQuestion が null を返す（orderIndex を持つ
  // 作品が3件そろわない）ときは何もしない（壊れない設計）。
  // reviewer指摘M2-99v3中4の修正: Q14は特定の下線に紐づかない独立問題なので、差し替える枠の
  // passage/underlineを引き継がない（passage: null。呼び出し側は表示を出さない）。また
  // orderItemsの作品が他の枠と重複すると「1回の試験で同じ作品は1問まで」が破れるため、
  // 重複するときはこの試験では追加を諦める（壊れない設計。次のシードで再挑戦されるだけ）。
  if (built.length > 0 && rng() < 1 / 3) {
    const orderData = generateOrderQuestion(imagePool, rng, 3, eras)
    const lastIndex = built.length - 1
    const otherWorkIds = new Set(built.slice(0, lastIndex).map((b) => b.question.work.id))
    const collides = orderData?.displayItems.some((item) => otherWorkIds.has(item.work.id)) ?? false
    if (orderData && !collides) {
      const nominalWork = orderData.displayItems[0].work
      const question: Question = {
        type: 'q14',
        work: nominalWork,
        choiceWorks: [],
        choiceStatements: orderData.choices,
        correctIndex: orderData.correctIndex,
        isReview: false,
        orderItems: orderData.displayItems,
      }
      built[lastIndex] = { passage: null, underline: null, question }
    }
  }

  return built.map((b) => ({
    passage: b.passage ?? undefined,
    eraId: b.passage ? b.passage.era : b.question.work.era,
    underlineKey: b.underline ? b.underline.key : '',
    excerpt: b.passage && b.underline ? excerptSegmentsForUnderline(b.passage.text, b.underline.key) : [],
    question: b.question,
  }))
}

/** 秒数を「m:ss」表示に整形する（残り時間の目安表示。M2-20）。負数は 0:00 に丸める。 */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${String(rest).padStart(2, '0')}`
}
