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
  /** 出題元のリード文（全文表示・下線ラベル表示に使う。M2-42）。 */
  passage: Passage
  eraId: string
  underlineKey: string
  /** 「下線部を含む1〜2文」の描画用セグメント（下線ハイライトつき。旧ランダム学習と同じ見え方）。 */
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
  passage: Passage
  underline: PassageUnderline
  question: Question
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
      if (!imagePool.some((w) => w.id === b.question.work.id)) continue
      const forced = buildThemeQuestionForWork(b.question.work, pool, eras, rng, { ask: { type: 'q9' }, imagePool })
      if (forced && forced.type === 'q9') {
        built[i] = { ...b, question: { ...forced, passageId: b.passage.id, underlineKey: b.underline.key } }
        break
      }
    }
  }

  return built.map((b) => ({
    passage: b.passage,
    eraId: b.passage.era,
    underlineKey: b.underline.key,
    excerpt: excerptSegmentsForUnderline(b.passage.text, b.underline.key),
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
