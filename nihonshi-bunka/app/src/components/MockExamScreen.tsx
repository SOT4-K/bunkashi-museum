// 本番モード（大問IV形式の模試）。M2-20。リード文A〜D→各リード文の下線から出題→
// 全10問終了で結果（20点満点・型別正答率）。engine/mockExam.ts が組み立てた
// MockExamSection[]（リード文ごとに束ねた ThemeQuestion）を、リード文が変わるたびに
// 全文表示（ThemeSetScreen と同じ「読解フェーズ」）→設問、という流れで消化する。
import { useEffect, useMemo, useRef, useState } from 'react'
import learnStyles from './LearnScreen.module.css'
import themeStyles from './ThemeSetScreen.module.css'
import styles from './MockExamScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { splitPassageText } from '../engine/passage'
import { todayIso } from '../engine/srs'
import { formatCountdown, MOCK_EXAM_POINTS_PER_QUESTION, MOCK_EXAM_TIME_SECONDS, type MockExamSection } from '../engine/mockExam'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Passage, Question, QuestionType } from '../types'

interface FlatItem {
  sectionLabel: string
  passage: Passage
  underlineKey: string
  question: Question
}

function flatten(sections: MockExamSection[]): FlatItem[] {
  const out: FlatItem[] = []
  for (const section of sections) {
    for (const q of section.questions) {
      out.push({ sectionLabel: section.label, passage: section.passage, underlineKey: q.underlineKey, question: q.question })
    }
  }
  return out
}

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

type Phase = 'read' | 'quiz' | 'done'

export function MockExamScreen({
  sections,
  eras,
  onAnswer,
  onMiss,
  onFinish,
}: {
  sections: MockExamSection[]
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
  const flat = useMemo(() => flatten(sections), [sections])
  const total = flat.length
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>(total > 0 ? 'read' : 'done')
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [typeStats, setTypeStats] = useState<Partial<Record<QuestionType, { correct: number; total: number }>>>({})
  const [secondsLeft, setSecondsLeft] = useState(MOCK_EXAM_TIME_SECONDS)
  const sheetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase === 'done') return
    const timerId = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(timerId)
  }, [phase])

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const current = flat[index]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const segments = useMemo(() => (current ? splitPassageText(current.passage.text) : []), [current?.passage.id])

  function handleStartQuiz() {
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
    if (nextIndex >= total) {
      setIndex(nextIndex)
      setPhase('done')
      return
    }
    const isNewSection = flat[nextIndex].sectionLabel !== flat[index].sectionLabel
    setIndex(nextIndex)
    setPhase(isNewSection ? 'read' : 'quiz')
  }

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

  if (phase === 'done') {
    const scorePoints = correctCount * MOCK_EXAM_POINTS_PER_QUESTION
    const fullPoints = total * MOCK_EXAM_POINTS_PER_QUESTION
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

  if (phase === 'read') {
    return (
      <div className={learnStyles.screen}>
        <div className={styles.examHeader}>
          <span className={styles.examLabel}>本番モード（大問IV形式）</span>
          <span className={styles.timer} data-testid="mock-exam-timer">
            残り目安 {formatCountdown(secondsLeft)}
          </span>
        </div>
        <div className={themeStyles.header}>
          <div className={`${themeStyles.title} caption-bold`}>
            {current.sectionLabel}. {current.passage.title}
          </div>
        </div>
        <div className={themeStyles.readPanel} data-testid="mock-exam-read-panel">
          {segments.map((seg, i) =>
            seg.type === 'underline' ? (
              <mark key={i} className={themeStyles.underline}>
                {seg.value}
              </mark>
            ) : (
              <span key={i}>{seg.value}</span>
            ),
          )}
        </div>
        <button type="button" className={learnStyles.doneButton} data-testid="mock-exam-start-quiz" onClick={handleStartQuiz}>
          問題へ
        </button>
      </div>
    )
  }

  // phase === 'quiz'
  const isLast = index === total - 1

  return (
    <div className={learnStyles.screen}>
      <div className={styles.examHeader}>
        <span className={styles.examLabel}>
          {current.sectionLabel}. {current.passage.title}
        </span>
        <span className={styles.timer} data-testid="mock-exam-timer">
          残り目安 {formatCountdown(secondsLeft)}
        </span>
      </div>
      <div className={learnStyles.progressRow}>
        <span>
          {index + 1}/{total}
        </span>
        <span className={learnStyles.dots}>
          {flat.map((_, i) => (
            <span key={i} className={`${learnStyles.dot} ${i <= index ? learnStyles.dotFilled : ''}`} />
          ))}
        </span>
      </div>

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
