// テーマセット（リード文＋下線部→図版問題）の学習画面。decisions.md 2026-09-04「模試型」。
// LearnScreen と同じ回答フロー（QuestionCard→AnswerSheet）を使うが、出題は buildThemeSetQuestions
// で passage から一括生成する（SRS の復習キューではなく、1つのリード文＝1セット）。
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './ThemeSetScreen.module.css'
import learnStyles from './LearnScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { buildThemeSetQuestions } from '../engine/themeSet'
import { splitPassageText } from '../engine/passage'
import { todayIso } from '../engine/srs'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Passage, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

export function ThemeSetScreen({
  passage,
  pool,
  eras,
  onAnswer,
  onFinish,
}: {
  passage: Passage
  pool: Work[]
  eras: Era[]
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  onFinish: () => void
}) {
  const today = todayIso()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const themeQuestions = useMemo(() => buildThemeSetQuestions(passage, pool, eras), [passage.id])
  const segments = useMemo(() => splitPassageText(passage.text), [passage.text])

  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpTotal, setXpTotal] = useState(0)
  const sheetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const total = themeQuestions.length
  const done = total > 0 && index >= total
  const current = themeQuestions[index]

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.question.work.id, current.question.type, answer, false, today)
    setAnswered({
      selection,
      correct,
      isNewDiscovery: result.isNewDiscovery,
      isNewlyMastered: result.isNewlyMastered,
    })
    setXpTotal((prev) => prev + result.xpGained)
    if (correct) setCorrectCount((prev) => prev + 1)

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
    setContextOpen(false)
    setIndex((prev) => prev + 1)
  }

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>「{passage.title}」からは今のところ図版問題を作れなかった（画像の投入待ち）。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          戻る
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className={learnStyles.summaryScreen} data-testid="theme-set-summary">
        <div>
          <div className={learnStyles.summaryNumber}>
            {correctCount} / {total}
          </div>
          <div className={learnStyles.summaryLabel}>正答</div>
        </div>
        <div>
          <div className={learnStyles.summaryNumber}>{xpTotal}</div>
          <div className={learnStyles.summaryLabel}>獲得XP</div>
        </div>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          ホームに戻る
        </button>
      </div>
    )
  }

  const isLast = index === total - 1

  return (
    <div className={learnStyles.screen}>
      <div className={styles.header}>
        <div className={`${styles.title} caption-bold`}>{passage.title}</div>
        <div className={learnStyles.progressRow}>
          <span>
            {index + 1}/{total}
          </span>
          <span className={learnStyles.dots}>
            {themeQuestions.map((_, i) => (
              <span key={i} className={`${learnStyles.dot} ${i <= index ? learnStyles.dotFilled : ''}`} />
            ))}
          </span>
        </div>
      </div>

      <button
        type="button"
        className={styles.contextToggle}
        onClick={() => setContextOpen((v) => !v)}
        data-testid="context-toggle"
      >
        {contextOpen ? 'リード文を閉じる' : 'リード文を見返す'}
      </button>

      {contextOpen && (
        <div className={styles.contextPanel} data-testid="context-panel">
          {segments.map((seg, i) =>
            seg.type === 'underline' ? (
              <mark key={i} className={seg.key === current.underlineKey ? styles.underlineCurrent : styles.underline}>
                {seg.value}
              </mark>
            ) : (
              <span key={i}>{seg.value}</span>
            ),
          )}
        </div>
      )}

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
