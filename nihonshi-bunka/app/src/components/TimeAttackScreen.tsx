// 模試タブ（M2b-07。BOARD.md「M2b v2」9/8オーナー確認済みの既定③）のタイムアタック本体。
// 旧 MockExamScreen（本番モード。カウントダウンの任意トグル）は M2b-18 で廃止された。模試タブは
// 常にカウントアップで計時し、終了時に所要時間と得点を記録する。QuestionCard・AnswerSheet・
// LeadPanel は既存のものをそのまま流用する（変えないもの: 二段階回答・解説シート・
// リード文常設表示）。
import { useEffect, useRef, useState } from 'react'
import learnStyles from './LearnScreen.module.css'
import styles from './TimeAttackScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { LeadPanel } from './LeadPanel'
import { todayIso } from '../engine/srs'
import { formatCountdown, MOCK_EXAM_POINTS_PER_QUESTION, type MockExamItem } from '../engine/mockExam'
import { isCulturalHiddenAsk } from '../engine/themeSet'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

type Phase = 'quiz' | 'done'

export function TimeAttackScreen({
  items,
  pool,
  eras,
  onAnswer,
  onMiss,
  onComplete,
  onFinish,
  onReviewMisses,
}: {
  items: MockExamItem[]
  /** LeadPanel の画像リード型解決用（content.ts の themeSetPool）。 */
  pool: Work[]
  eras: Era[]
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  /** 不正解・「わからない」を間違いノートに記録する（既存の仕組みを流用）。 */
  onMiss?: (workId: string, type: Question['type'], passageId: string | undefined, underlineKey: string | undefined) => void
  /** 全問終了時に1回だけ呼ぶ（正解数・全問数・所要時間・その回に間違えた作品id）。
   *  呼び出し側で recordExamResult する。 */
  onComplete: (correctCount: number, total: number, elapsedSeconds: number, missedWorkIds: string[]) => void
  /** 結果画面の「模試タブに戻る」。 */
  onFinish: () => void
  /** 結果画面の「この回の間違いを復習」（missedWorkIds.length > 0 のときだけボタンを出す）。 */
  onReviewMisses: (missedWorkIds: string[]) => void
}) {
  const today = todayIso()
  const total = items.length
  const [phase, setPhase] = useState<Phase>(total > 0 ? 'quiz' : 'done')
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [missedWorkIds, setMissedWorkIds] = useState<string[]>([])
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const sheetTimerRef = useRef<number | null>(null)

  // カウントアップ計時（9/8オーナー確認済みの既定③）。quiz フェーズの間だけ動かす。
  useEffect(() => {
    if (phase !== 'quiz') return
    const timerId = window.setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(timerId)
  }, [phase])

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const current = items[index]
  // M2i-02③（fact-check-m2e-tiers.md [中]-1 是正）: 文化伏せ型（q12「この文化は…」）の設問中は
  // ヘッダーの文化名を伏せる（表示したままだと文化当てがヘッダーだけで解けてしまう）。
  const currentAsk = current?.passage?.underlines.find((u) => u.key === current.underlineKey)?.ask
  const hideEraName = isCulturalHiddenAsk(currentAsk)
  const eraName = current ? (hideEraName ? '？？？' : (eras.find((e) => e.id === current.eraId)?.name ?? current.eraId)) : ''

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.question.work.id, current.question.type, answer, false, today)
    setAnswered({ selection, correct, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered })
    if (correct) {
      setCorrectCount((prev) => prev + 1)
    } else {
      setMissedWorkIds((prev) => (prev.includes(current.question.work.id) ? prev : [...prev, current.question.work.id]))
      if (onMiss) onMiss(current.question.work.id, current.question.type, current.passage?.id, current.underlineKey)
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
    const correct = choiceIndex === current.question.correctIndex
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
      onComplete(correctCount, total, elapsedSeconds, missedWorkIds)
    }
  }

  const scorePoints = correctCount * MOCK_EXAM_POINTS_PER_QUESTION
  const fullPoints = total * MOCK_EXAM_POINTS_PER_QUESTION

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>模試を作れなかった（リード文の投入待ち）。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          戻る
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className={learnStyles.summaryScreen} data-testid="time-attack-summary">
        <div>
          <div className={learnStyles.summaryNumber}>
            {scorePoints} / {fullPoints}点
          </div>
          <div className={learnStyles.summaryLabel}>
            {correctCount} / {total} 問正解・{formatCountdown(elapsedSeconds)}
          </div>
        </div>
        {missedWorkIds.length > 0 && (
          <button
            type="button"
            className={learnStyles.doneButton}
            data-testid="time-attack-review-misses"
            onClick={() => onReviewMisses(missedWorkIds)}
          >
            この回の間違いを復習
          </button>
        )}
        <button type="button" className={learnStyles.doneButton} data-testid="time-attack-back" onClick={onFinish}>
          模試タブに戻る
        </button>
      </div>
    )
  }

  // phase === 'quiz'
  const isLast = index === total - 1

  return (
    <div className={learnStyles.screen}>
      <div className={styles.examHeader}>
        <span className={`${styles.examLabel} caption`}>{eraName}</span>
        <span className={styles.timer} data-testid="time-attack-timer">
          経過 {formatCountdown(elapsedSeconds)}
        </span>
      </div>
      <div className={learnStyles.progressRow}>
        <span>
          {index + 1}/{total}
        </span>
        <span className={learnStyles.dots}>
          {items.map((_, i) => (
            <span key={i} className={`${learnStyles.dot} ${i <= index ? learnStyles.dotFilled : ''}`} />
          ))}
        </span>
      </div>

      {current.passage && (
        <div className={styles.excerptPanel} data-testid="time-attack-excerpt-panel">
          {current.excerpt.map((seg, i) =>
            seg.type === 'underline' ? (
              <mark key={i} className={styles.underlineCurrent}>
                {seg.value}
              </mark>
            ) : (
              <span key={i}>{seg.value}</span>
            ),
          )}
        </div>
      )}

      <LeadPanel
        passage={current.passage}
        underlineKey={current.underlineKey}
        pool={pool}
        raiseAboveConfirmBar={!answered}
      />

      <QuestionCard question={current.question} answered={answered} onChoice={handleChoice} onUnknown={handleUnknown} />

      {answered && showSheet && (
        <AnswerSheet
          question={current.question}
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
