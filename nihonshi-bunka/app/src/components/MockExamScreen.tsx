// 本番モード（大問IV形式の模試）。M2-20 → M2-45 で「学習を始める」（旧 RandomLearnScreen）を
// 統合した。全15文化・本番配分の重み付き抽選で10問を組み立て（engine/mockExam.ts）、
// 開始画面の「時間を計る」トグル（既定オフ）→ 1問ずつ（下線抜粋＋設問。リード全文は
// LeadPanel の固定ボタンから見る。M2-42）→ 全問終了で結果（20点満点・型別正答率）。
import { useEffect, useRef, useState } from 'react'
import learnStyles from './LearnScreen.module.css'
import styles from './MockExamScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { LeadPanel } from './LeadPanel'
import { todayIso } from '../engine/srs'
import { formatCountdown, MOCK_EXAM_POINTS_PER_QUESTION, MOCK_EXAM_TIME_SECONDS, type MockExamItem } from '../engine/mockExam'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Question, QuestionType, Work } from '../types'

const TYPE_LABELS: Record<QuestionType, string> = {
  q1: '画像→作品名',
  q2: '画像→文化',
  q3: '作品名→画像',
  q4: '関連記述の正誤',
  q6: '同時代の事項',
  q8: '組合せ文',
  q9: '図版（条件）',
  q10: '2文正誤',
  q12: '文字4択',
  q13: '語句の組合せ',
  q14: '年代順',
}

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

type Phase = 'start' | 'quiz' | 'done'

export function MockExamScreen({
  items,
  pool,
  eras,
  onAnswer,
  onMiss,
  onFinish,
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
  /** 不正解・「わからない」を間違いノートに記録する（M2-23）。省略可。 */
  onMiss?: (workId: string, type: Question['type'], passageId: string | undefined, underlineKey: string | undefined) => void
  onFinish: () => void
}) {
  const today = todayIso()
  const total = items.length
  const [phase, setPhase] = useState<Phase>(total > 0 ? 'start' : 'done')
  const [timed, setTimed] = useState(false)
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [typeStats, setTypeStats] = useState<Partial<Record<QuestionType, { correct: number; total: number }>>>({})
  const [secondsLeft, setSecondsLeft] = useState(MOCK_EXAM_TIME_SECONDS)
  const sheetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'quiz' || !timed) return
    const timerId = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timerId)
  }, [phase, timed])

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const current = items[index]
  const eraName = current ? (eras.find((e) => e.id === current.eraId)?.name ?? current.eraId) : ''

  function handleStart() {
    setPhase('quiz')
  }

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.question.work.id, current.question.type, answer, false, today)
    setAnswered({ selection, correct, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered })
    if (correct) setCorrectCount((prev) => prev + 1)
    else if (onMiss) onMiss(current.question.work.id, current.question.type, current.passage.id, current.underlineKey)

    setTypeStats((prev) => {
      const prevStat = prev[current.question.type] ?? { correct: 0, total: 0 }
      return { ...prev, [current.question.type]: { correct: prevStat.correct + (correct ? 1 : 0), total: prevStat.total + 1 } }
    })

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
    if (nextIndex >= total) setPhase('done')
  }

  const scorePoints = correctCount * MOCK_EXAM_POINTS_PER_QUESTION
  const fullPoints = total * MOCK_EXAM_POINTS_PER_QUESTION

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>本番モードを作れなかった（リード文の投入待ち）。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          戻る
        </button>
      </div>
    )
  }

  if (phase === 'start') {
    return (
      <div className={learnStyles.screen}>
        <div className={styles.examHeader}>
          <span className={styles.examLabel}>本番モード（大問IV形式・全15文化）</span>
        </div>
        <p>{total}問・{fullPoints}点満点。型の配分は本番どおり。</p>
        <label className={styles.timedToggle}>
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
            data-testid="mock-exam-timed-toggle"
          />
          時間を計る（目安 {formatCountdown(MOCK_EXAM_TIME_SECONDS)}）
        </label>
        <button type="button" className={learnStyles.doneButton} data-testid="mock-exam-start" onClick={handleStart}>
          始める
        </button>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className={learnStyles.summaryScreen} data-testid="mock-exam-summary">
        <div>
          <div className={learnStyles.summaryNumber}>
            {scorePoints} / {fullPoints}点
          </div>
          <div className={learnStyles.summaryLabel}>
            {correctCount} / {total} 問正解
          </div>
        </div>
        <div className={styles.breakdown} data-testid="type-breakdown">
          <div className={learnStyles.summaryLabel}>型別の正答率</div>
          {(Object.keys(typeStats) as QuestionType[]).map((type) => {
            const stat = typeStats[type]
            if (!stat) return null
            return (
              <div className={styles.breakdownRow} key={type}>
                <span>{TYPE_LABELS[type] ?? type}</span>
                <span>
                  {stat.correct} / {stat.total}
                </span>
              </div>
            )
          })}
        </div>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          ホームに戻る
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
        {timed && (
          <span className={styles.timer} data-testid="mock-exam-timer">
            残り目安 {formatCountdown(secondsLeft)}
          </span>
        )}
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

      <div className={styles.excerptPanel} data-testid="mock-exam-excerpt-panel">
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

      <LeadPanel passage={current.passage} underlineKey={current.underlineKey} pool={pool} />

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
