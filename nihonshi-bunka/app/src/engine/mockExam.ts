// 出題エンジン（大問IV形式・全15文化・重み付き抽選で問題セットを組み立てる）。
// M2-20 → M2-45 で「学習を始める」（ランダム学習。M2-21・engine/randomLearn.ts）を統合し、
// 「本番モード」という10問・大問IV形式1回分の専用UI（MockExamScreen・ホーム/図鑑の入口）を
// 持っていたが、M2b-18（2026-09-09オーナー判断「本番モードはなしでいい。模試モードに
// 踏襲された」）でその専用UIを廃止した。この engine 自体（buildMockExam・discoverableWorks）
// は模試タブ（TimeAttackScreen。TIME_ATTACK_EXAM_SIZE=20）・ステージ／ボス（stages.ts経由で
// themeSet.tsを共有）・間違いノート復習が使い続けるため残す。
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
import {
  buildThemeQuestionForWork,
  categoryOfQuestion,
  COMPOSITION_SEQUENCE,
  type FloorConversionCandidate,
  forceCategoryQuestion,
  imageCategoryCap,
  isCulturalHiddenAsk,
  pickThemeTargetId,
  planCategoryFloorConversions,
} from './themeSet'
import { generateOrderQuestion } from './order'
import { excerptSegmentsForUnderline, type PassageSegment } from './passage'
import type { RandomFn } from './distractors'
import type { Era, Passage, PassageUnderline, ProgressState, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

/** buildMockExam の既定セット数（1回2点×10問=20点満点の配分。呼び出し側が count 引数で
 *  明示的に上書きできる。現在の呼び出し元は全て count を明示するため、この既定値自体は
 *  今は使われていない値だが、関数の妥当なデフォルトとして残す）。 */
export const MOCK_EXAM_SIZE = 10
export const MOCK_EXAM_POINTS_PER_QUESTION = 2

/** 模試タブ（M2b-07。BOARD.md「M2b v2」9/8オーナー確認済みの既定③）: 全文化ランダム・
 *  本番配分20問のタイムアタック。buildMockExam の count 引数で明示的に上書きして使う。 */
export const TIME_ATTACK_EXAM_SIZE = 20

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
 * 全15文化・本番配分・重み付き抽選で問題セットを組み立てる（既定 count=MOCK_EXAM_SIZE=10。
 * 模試タブ（TimeAttackScreen）は TIME_ATTACK_EXAM_SIZE=20 を明示して呼ぶ）。
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
  // M2e-06: 図版カテゴリ（q9・q1）は1回の試験で imageCap 問まで（実測: 対策前は
  // mockExam 10問×30seedで平均3.07、目標「2±1」の上限をわずかに超えていた）。
  let imageCount = 0
  const imageCap = imageCategoryCap(count)
  for (const candidate of ordered) {
    if (built.length >= count) break
    // 同じ作品が複数 passage に重複して候補にある場合、1回の試験内では1問までにする
    // （buildCandidatePool の重複許可とセットの修正。15文化への偏りは eraWeight 側で扱う）。
    if (usedWorkIds.has(candidate.work.id)) continue
    const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
    // M2-45（M2-25 の解消）: 下線の ask を渡す（writer 手書きの stem・answerId 等を尊重する）。
    // M2e-02: ask.stem が無い／使われなかったときのために underlineKey も渡す
    // （engine/stems.ts の既定 stem が「下線部○」を必ず含むようにする）。
    const question = buildThemeQuestionForWork(candidate.work, pool, eras, rng, {
      ask: candidate.underline.ask,
      avoidEraSlot,
      avoidType: previousType,
      imagePool,
      desiredCategory,
      underlineKey: candidate.underline.key,
      // M2i-02④: 画像リード型 passage のリード画像と同じ画像を Q9 の正解にしない
      // （research/fact-check-m2e-tiers.md [中]-2 是正）。
      excludeQ9WorkIds: candidate.passage.kind === 'image' ? candidate.passage.leadWorkIds : undefined,
    })
    if (!question) continue
    // M2e-06: 図版上限に達していたらこの候補は捨て、次の候補（別の下線・別の作品）に譲る
    // （usedWorkIds に加えないので、同じ作品が後で別の型として再度候補に出ることを妨げない）。
    if (categoryOfQuestion(question) === 'image' && imageCount >= imageCap) continue
    usedWorkIds.add(candidate.work.id)
    if (question.q9Slot === 'era') avoidEraSlot = true
    previousType = question.type
    if (categoryOfQuestion(question) === 'image') imageCount++
    built.push({
      passage: candidate.passage,
      underline: candidate.underline,
      question: { ...question, passageId: candidate.passage.id, underlineKey: candidate.underline.key },
    })
  }

  // M2e-08（BOARD.md「型配分を問数に比例させる」）: 旧M2e-06はQ9・Q13それぞれに
  // 「0件のときだけ1問強制」という固定floor=1の個別ブロックを持っていたが、count（本番は
  // TIME_ATTACK_EXAM_SIZE=20）に比例しないため、count=20では語句組合せ平均1.0・逆適否0.67の
  // まま帯外（builder メモ feedback-m2e-06-partial-accept.md）だった。categoryFloor(count)
  // （20問なら床3）まで5カテゴリ全てをbest-effortで引き上げる一般化に置き換える
  // （themeSet.ts planCategoryFloorConversions）。
  if (built.length > 0) {
    const candidates: FloorConversionCandidate[] = built.map((b) => ({
      workId: b.question.work.id,
      type: b.question.type,
      category: categoryOfQuestion(b.question),
      // M2e-08b: この設問の下線に writer が明示的な ask を設定していれば記録する（donor選定には
      // 使わない。文化伏せ型なら donor から除外する。themeSet.ts planCategoryFloorConversions
      // 参照）。
      hasExplicitAsk: Boolean(b.underline?.ask),
      isCulturalHiddenAsk: isCulturalHiddenAsk(b.underline?.ask),
      tryConvert: (category) => {
        if (!b.passage || !b.underline) return null
        return forceCategoryQuestion(b.question.work, pool, eras, rng, category, { imagePool, underlineKey: b.underline.key })
      },
    }))
    const conversions = planCategoryFloorConversions(candidates, count)
    for (let i = 0; i < built.length; i++) {
      const forced = conversions[i]
      if (!forced) continue
      const b = built[i]
      built[i] = { ...b, question: { ...forced, passageId: b.passage!.id, underlineKey: b.underline!.key } }
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
