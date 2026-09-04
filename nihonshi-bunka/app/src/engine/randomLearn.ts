// ランダム学習（ホームの「学習を始める」）。M2-21。decisions.md 2026-09-04夜「学習モードを
// 二本立てにする」・research/nichidai-past-exams-analysis.md 8章:
//  全15文化のリード文の下線を1つのプールにし、区分の重み（eras.json の weight。原始 0.5）と
//  SRS の期限（復習期限が来ている作品を優先）を考慮してランダムに10問選ぶ。各問は
//  「下線部を含む1〜2文＋設問」（本番と同じ見え方。ThemeSetScreen の全文リード表示とは違い、
//  下線ごとに短い抜粋だけを見せる）。型の配分は本番どおり（M2-16 の COMPOSITION_SEQUENCE を
//  再利用）で、図版問題（Q9）を最低1問は必ず入れる。経験値・図鑑・SRS を更新する
//  （呼び出し側が通常の onAnswer をそのまま使えばよい。テーマセットと同じ扱い）。
import { weightedSampleWithoutReplacement } from './weighted'
import { eraWeight } from './weighted'
import { selectReviewCandidates } from './session'
import { buildThemeQuestionForWork, COMPOSITION_SEQUENCE, pickThemeTargetId } from './themeSet'
import { excerptSegmentsForUnderline, type PassageSegment } from './passage'
import type { RandomFn } from './distractors'
import type { Era, Passage, PassageUnderline, ProgressState, Question, QuestionType, Work } from '../types'

const defaultRandom: RandomFn = () => Math.random()

export const RANDOM_LEARN_SESSION_SIZE = 10

/** 復習期限が来ている作品を優先する倍率（judgment call。決め打ちの経験値。DUE_BONUS倍）。 */
const DUE_WEIGHT_BONUS = 4

export interface RandomLearnItem {
  passageId: string
  eraId: string
  underlineKey: string
  /** 「下線部を含む1〜2文」の描画用セグメント（下線ハイライトつき）。 */
  excerpt: PassageSegment[]
  question: Question
}

interface Candidate {
  passage: Passage
  underline: PassageUnderline
  work: Work
}

/** 全 passage の全下線から、対象作品を一意に持つ候補一覧を作る（同じ作品は最初の下線のみ、
 *  15文化に偏りなく広げるため）。 */
function buildCandidatePool(passages: Passage[], pool: Work[]): Candidate[] {
  const availableIds = new Set(pool.map((w) => w.id))
  const byId = new Map(pool.map((w) => [w.id, w]))
  const seenWorkIds = new Set<string>()
  const candidates: Candidate[] = []
  for (const passage of passages) {
    for (const underline of passage.underlines) {
      const targetId = pickThemeTargetId(underline, passage, availableIds)
      if (!targetId) continue
      const work = byId.get(targetId)
      if (!work || seenWorkIds.has(work.id)) continue
      seenWorkIds.add(work.id)
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
 * 全15文化からのランダム10問セットを組み立てる。passages/pool が空、またはどの下線からも
 * 設問を作れない場合は空配列を返す（呼び出し側で自由出題等にフォールバックする）。
 */
export function buildRandomLearnSession(
  passages: Passage[],
  pool: Work[],
  imagePool: Work[],
  eras: Era[],
  progress: ProgressState,
  today: string,
  rng: RandomFn = defaultRandom,
  count = RANDOM_LEARN_SESSION_SIZE,
): RandomLearnItem[] {
  if (passages.length === 0 || pool.length === 0) return []
  const candidates = buildCandidatePool(passages, pool)
  if (candidates.length === 0) return []

  const dueWorkIds = new Set(selectReviewCandidates(pool, progress, today, rng, eras).map((p) => p.work.id))
  const weightOf = (c: Candidate) => eraWeight(c.work.era, eras) * (dueWorkIds.has(c.work.id) ? DUE_WEIGHT_BONUS : 1)
  const ordered = weightedSampleWithoutReplacement(candidates, weightOf, candidates.length, rng)

  const built: BuiltItem[] = []
  let avoidEraSlot = false
  let previousType: QuestionType | undefined
  for (const candidate of ordered) {
    if (built.length >= count) break
    const desiredCategory = COMPOSITION_SEQUENCE[built.length % COMPOSITION_SEQUENCE.length]
    const question = buildThemeQuestionForWork(candidate.work, pool, eras, rng, {
      avoidEraSlot,
      avoidType: previousType,
      imagePool,
      desiredCategory,
    })
    if (!question) continue
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
    passageId: b.passage.id,
    eraId: b.passage.era,
    underlineKey: b.underline.key,
    excerpt: excerptSegmentsForUnderline(b.passage.text, b.underline.key),
    question: b.question,
  }))
}
