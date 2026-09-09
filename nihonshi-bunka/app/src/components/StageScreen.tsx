// ステージ／ボスの出題画面（M2b-01）。既存 QuestionCard・AnswerSheet・LeadPanel を流用する
// （実装スコープ c）。旧 MockExamScreen（M2b-18で廃止）と同じく progress の
// answer()/recordMiss() を呼ぶ（ステージ・ボスの結果はそれと同じ扱いで SRS・図鑑・XP を
// 更新する。2026-09-04 の「文化別練習は進捗を更新しない」方針をこのモードには適用しない＝新方針）。
import { useMemo, useRef, useState } from 'react'
import learnStyles from './LearnScreen.module.css'
import styles from './StageScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { LeadPanel } from './LeadPanel'
import { todayIso } from '../engine/srs'
import { bossProgress, clearThreshold } from '../engine/stages'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Passage, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

type Phase = 'quiz' | 'done'

export function StageScreen({
  title,
  questions,
  pool,
  passages,
  eras,
  isBoss = false,
  onAnswer,
  onMiss,
  onComplete,
  onFinish,
  onRetry,
}: {
  /** 画面上部に出す見出し（例:「1-1 ★★ 天平文化」「1 ボス 天平文化」。M2b-05: engine/stages.ts
   *  の stageShortLabel + era 名を呼び出し側（App.tsx）で組み立てて渡す）。 */
  title: string
  questions: Question[]
  /** LeadPanel の画像リード型解決用（content.ts の themeSetPool）。 */
  pool: Work[]
  passages: Passage[]
  eras: Era[]
  /** M2b-05: ボス戦なら体力ゲージ（bossProgress）を表示する。省略時は false（通常ステージ）。 */
  isBoss?: boolean
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  onMiss?: (workId: string, type: Question['type'], passageId: string | undefined, underlineKey: string | undefined) => void
  /** 全問終了時に1回だけ呼ぶ（正解数・全問数。呼び出し側で recordStageResult する）。 */
  onComplete: (correctCount: number, total: number) => void
  /** 結果画面の「次へ」（マップに戻る）。 */
  onFinish: () => void
  /** 結果画面の「もう一度」。呼び出し側で新しい乱数で同じステージを組み直す想定。 */
  onRetry: () => void
}) {
  const today = todayIso()
  const total = questions.length
  const [phase, setPhase] = useState<Phase>(total > 0 ? 'quiz' : 'done')
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const sheetTimerRef = useRef<number | null>(null)

  const current = questions[index]

  // M2e-02: ボス・通常ステージともに engine/stages.ts が passage 起点で問題を組み立てるように
  // なったため（buildBossQuestions・buildStageQuestions）、questionが下線から出た問題なら
  // passageId/underlineKey を直接持っている。作品から passages を逆引きする best-effort ロジック
  // （旧 engine/leadContext.ts findLeadContextForWork）は使わない（設問文と対応しない passage を
  // 見せると「リード文と設問が噛み合っていない」というオーナー指摘 2026-09-09 を再発させるため）。
  // 下線に紐づかない単独問題（passageId が無い）は元々どおりリード文を出さない。
  const leadContext = useMemo(() => {
    if (!current || !current.passageId) return null
    const passage = passages.find((p) => p.id === current.passageId)
    if (!passage) return null
    return { passage, underlineKey: current.underlineKey }
  }, [current, passages])

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.work.id, current.type, answer, false, today)
    setAnswered({ selection, correct, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered })
    if (correct) setCorrectCount((c) => c + 1)
    else {
      setIncorrectCount((c) => c + 1)
      if (onMiss) onMiss(current.work.id, current.type, current.passageId, current.underlineKey)
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) setShowSheet(true)
    else sheetTimerRef.current = window.setTimeout(() => setShowSheet(true), 450)
  }

  function handleChoice(choiceIndex: number) {
    if (!current || answered) return
    const correct = choiceIndex === current.correctIndex
    handleResult(correct ? 'correct' : 'incorrect', { kind: 'choice', index: choiceIndex })
  }

  function handleUnknown() {
    if (!current || answered) return
    handleResult('unknown', { kind: 'unknown' })
  }

  function handleNext() {
    if (sheetTimerRef.current) {
      window.clearTimeout(sheetTimerRef.current)
      sheetTimerRef.current = null
    }
    setAnswered(null)
    setShowSheet(false)
    const nextIndex = index + 1
    setIndex(nextIndex)
    if (nextIndex >= total) {
      setPhase('done')
      onComplete(correctCount, total)
    }
  }

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>「{title}」は今のところ問題を作れなかった（作品の投入待ち）。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          マップに戻る
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    const threshold = clearThreshold(total)
    const cleared = correctCount >= threshold
    return (
      <div className={learnStyles.summaryScreen} data-testid="stage-summary">
        <div>
          <div className={learnStyles.summaryNumber}>
            {correctCount} / {total}
          </div>
          <div className={learnStyles.summaryLabel} data-testid="stage-clear-label">
            {cleared ? 'クリア！' : `クリアには ${threshold}/${total} 問正解が必要`}
          </div>
        </div>
        <button type="button" className={learnStyles.doneButton} data-testid="stage-retry" onClick={onRetry}>
          もう一度
        </button>
        <button type="button" className={learnStyles.doneButton} data-testid="stage-next" onClick={onFinish}>
          次へ
        </button>
      </div>
    )
  }

  // phase === 'quiz'
  const isLast = index === total - 1

  return (
    <div className={learnStyles.screen}>
      <div className={learnStyles.progressRow}>
        <span>
          {title}　{index + 1}/{total}
        </span>
        <span className={learnStyles.dots}>
          {questions.map((_, i) => (
            <span key={i} className={`${learnStyles.dot} ${i <= index ? learnStyles.dotFilled : ''}`} />
          ))}
        </span>
      </div>

      {/* M2b-05: ボス戦の体力ゲージ（bossProgress。固定位置ではなく通常フローに置き、
          既存の固定バー（LeadPanel/QuestionCardの確認バー）との縦重なりを避ける。
          builder メモ css-fixed-bottom-bar-stacking-check）。 */}
      {isBoss &&
        (() => {
          const bp = bossProgress(total, correctCount, incorrectCount)
          const ratio = bp.total > 0 ? bp.correct / bp.total : 0
          return (
            <div className={styles.bossGauge} data-testid="boss-gauge">
              <div className={styles.bossGaugeTrack}>
                <div className={styles.bossGaugeFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
              <span className={styles.bossGaugeLabel}>
                残り {bp.remaining} 問・クリアに {bp.clearThreshold} 問正解
              </span>
            </div>
          )
        })()}

      <LeadPanel
        passage={leadContext?.passage}
        underlineKey={leadContext?.underlineKey}
        pool={pool}
        raiseAboveConfirmBar={!answered}
      />

      <QuestionCard question={current} answered={answered} onChoice={handleChoice} onUnknown={handleUnknown} />

      {answered && showSheet && (
        <AnswerSheet
          question={current}
          selection={answered.selection}
          correct={answered.correct}
          eras={eras}
          isNewDiscovery={answered.isNewDiscovery}
          isNewlyMastered={answered.isNewlyMastered}
          nextLabel={isLast ? '結果を見る' : '次の問題'}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
