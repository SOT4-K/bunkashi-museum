// 文化別練習の出題画面。M2-22。progress の answer()/startSession() は一切呼ばない
// （経験値・図鑑・SRSを更新しない、という要件をこの1点で担保する）。誤答した作品は
// セッション内でのみ型を変えて再出題する（1作品1回まで。LearnScreen と同じパターン）。
import { useEffect, useRef, useState } from 'react'
import styles from './LearnScreen.module.css'
import practiceStyles from './CultureListScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { buildPracticeSession, requeuePracticeQuestion } from '../engine/practiceSession'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
}

export function PracticeSessionScreen({
  eraId,
  eraName,
  pool,
  imagePool,
  eras,
  onFinish,
}: {
  eraId: string
  eraName: string
  /** 出題対象・素材プール（content.ts の themeSetPool）。 */
  pool: Work[]
  /** 画像で出題できる作品だけ（content.ts の playableWorks）。 */
  imagePool: Work[]
  eras: Era[]
  onFinish: () => void
}) {
  const startedRef = useRef(false)
  const [queue, setQueue] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const sheetTimerRef = useRef<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const retriedWorkIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    setQueue(buildPracticeSession(eraId, pool, imagePool, eras))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const current = queue[index]
  const total = queue.length
  const done = total > 0 && index >= total

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    setAnswered({ selection, correct })
    if (correct) setCorrectCount((prev) => prev + 1)
    if (!correct && !retriedWorkIds.current.has(current.work.id)) {
      retriedWorkIds.current.add(current.work.id)
      const requeued = requeuePracticeQuestion(current, pool, imagePool, eras)
      if (requeued) setQueue((prev) => [...prev, { ...requeued, isRetry: true }])
    }

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setShowSheet(true)
    } else {
      sheetTimerRef.current = window.setTimeout(() => setShowSheet(true), 450)
    }
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
    setIndex((prev) => prev + 1)
  }

  if (startedRef.current && total === 0) {
    return (
      <div className={styles.screen}>
        <p>「{eraName}」からは今のところ問題を作れなかった（作品の投入待ち）。</p>
        <button type="button" className={styles.doneButton} onClick={onFinish}>
          戻る
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className={styles.summaryScreen} data-testid="practice-summary">
        <div>
          <div className={styles.summaryNumber}>
            {correctCount} / {total}
          </div>
          <div className={styles.summaryLabel}>正答（記録されません）</div>
        </div>
        <button type="button" className={styles.doneButton} onClick={onFinish}>
          戻る
        </button>
      </div>
    )
  }

  if (!current) return null

  const isLast = index === total - 1

  return (
    <div className={styles.screen}>
      <p className={practiceStyles.notice}>「{eraName}」の練習。結果は記録されない。</p>
      <div className={styles.progressRow}>
        <span>
          {index + 1}/{total}
        </span>
        <span className={styles.dots}>
          {queue.map((_, i) => (
            <span key={i} className={`${styles.dot} ${i <= index ? styles.dotFilled : ''}`} />
          ))}
        </span>
      </div>

      <QuestionCard question={current} answered={answered} onChoice={handleChoice} onUnknown={handleUnknown} />

      {answered && showSheet && (
        <AnswerSheet
          question={current}
          selection={answered.selection}
          correct={answered.correct}
          eras={eras}
          isNewDiscovery={false}
          isNewlyMastered={false}
          nextLabel={isLast ? '結果を見る' : '次の問題'}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
