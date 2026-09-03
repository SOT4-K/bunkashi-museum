import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './LearnScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { WorkImage } from './WorkImage'
import { imageSrc } from '../utils/image'
import { buildQuestionOrFallback, buildSession, requeueType } from '../engine/session'
import { todayIso } from '../engine/srs'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, ProgressState, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

export function LearnScreen({
  works,
  eras,
  progress,
  onAnswer,
  onStartSession,
  dailyNewRemaining,
  onFinish,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  onStartSession: (today: string) => void
  dailyNewRemaining: (today: string) => number
  onFinish: () => void
}) {
  const today = todayIso()
  const startedRef = useRef(false)
  const [queue, setQueue] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  // 解説シートは回答直後ではなく少し遅らせて出す。選択肢自体の判定演出（金/朱の枠・✓✗・
  // 「正解」ラベル）をユーザーが見てから解説に進めるようにするため（フィードバック改善 3・4）。
  const [showSheet, setShowSheet] = useState(false)
  const sheetTimerRef = useRef<number | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpTotal, setXpTotal] = useState(0)
  const [discoveries, setDiscoveries] = useState<Work[]>([])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    onStartSession(today)
    const initial = buildSession(works, eras, progress, today, dailyNewRemaining(today))
    setQueue(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = queue[index]
  const total = queue.length
  const done = total > 0 && index >= total

  const dots = useMemo(() => Array.from({ length: total }, (_, i) => i < index), [total, index])

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.work.id, current.type, answer, current.isReview, today)
    setAnswered({
      selection,
      correct,
      isNewDiscovery: result.isNewDiscovery,
      isNewlyMastered: result.isNewlyMastered,
    })
    setXpTotal((prev) => prev + result.xpGained)
    if (correct) {
      setCorrectCount((prev) => prev + 1)
      // 正解の演出（UI-DESIGN.md の「動きは1か所」の対象外＝回答という操作への直接の応答）。
      // Vibration API が無い環境（iOS Safari 等）では何もしない。
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(15)
      }
    }
    if (result.isNewDiscovery) {
      setDiscoveries((prev) => (prev.some((w) => w.id === current.work.id) ? prev : [...prev, current.work]))
    }
    if (!correct && !current.isRetry) {
      // 誤答の同セッション内再出題は 1 作品 1 回まで（無限に伸びるセッションを防ぐ）
      const nextType = requeueType(current.type)
      const requeued = { ...buildQuestionOrFallback(current.work, nextType, works, eras, current.isReview), isRetry: true }
      setQueue((prev) => [...prev, requeued])
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

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  if (total === 0) {
    return (
      <div className={styles.screen}>
        <p>今日出題できる作品が無い。図鑑を眺めて待とう。</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className={styles.summaryScreen} data-testid="session-summary">
        <div>
          <div className={styles.summaryNumber}>
            {correctCount} / {total}
          </div>
          <div className={styles.summaryLabel}>正答</div>
        </div>
        <div>
          <div className={styles.summaryNumber}>{xpTotal}</div>
          <div className={styles.summaryLabel}>獲得XP</div>
        </div>
        {discoveries.length > 0 && (
          <div>
            <div className={styles.summaryLabel}>新発見</div>
            <div className={styles.discoveryList}>
              {discoveries.map((w) => (
                <div className={styles.discoveryItem} key={w.id}>
                  <WorkImage src={imageSrc(w)} alt={w.title} />
                </div>
              ))}
            </div>
          </div>
        )}
        <button type="button" className={styles.doneButton} onClick={onFinish}>
          ホームに戻る
        </button>
      </div>
    )
  }

  const isLast = index === total - 1

  return (
    <div className={styles.screen}>
      <div className={styles.progressRow}>
        <span>
          {index + 1}/{total}
        </span>
        <span className={styles.dots}>
          {dots.map((filled, i) => (
            <span key={i} className={`${styles.dot} ${filled || i === index ? styles.dotFilled : ''}`} />
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
          isNewDiscovery={answered.isNewDiscovery}
          isNewlyMastered={answered.isNewlyMastered}
          nextLabel={isLast ? '結果を見る' : '次の問題'}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
