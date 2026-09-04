// ランダム学習（ホームの「学習を始める」）の学習画面。M2-21。
// engine/randomLearn.ts が組み立てた10問（全15文化・本番配分・下線抜粋つき）を、
// テーマセットと同じ QuestionCard/AnswerSheet で1問ずつ出す。ThemeSetScreen と違い、
// 1本のリード文全文は見せず、下線を含む1〜2文の抜粋だけを毎回表示する
// （research/nichidai-past-exams-analysis.md 8章「各問は下線部を含む1〜2文＋設問」）。
import { useEffect, useRef, useState } from 'react'
import styles from './RandomLearnScreen.module.css'
import learnStyles from './LearnScreen.module.css'
import themeStyles from './ThemeSetScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { todayIso } from '../engine/srs'
import type { RandomLearnItem } from '../engine/randomLearn'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Question } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

export function RandomLearnScreen({
  items,
  eras,
  onAnswer,
  onMiss,
  onFinish,
}: {
  items: RandomLearnItem[]
  eras: Era[]
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  /** 不正解・「わからない」を間違いノートに記録する（M2-23）。省略可（テスト・旧呼び出し互換）。 */
  onMiss?: (workId: string, type: Question['type'], passageId: string | undefined, underlineKey: string | undefined) => void
  onFinish: () => void
}) {
  const today = todayIso()
  const total = items.length
  const [index, setIndex] = useState(0)
  const [answered, setAnswered] = useState<AnsweredState | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [xpTotal, setXpTotal] = useState(0)
  const sheetTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (sheetTimerRef.current) window.clearTimeout(sheetTimerRef.current)
    }
  }, [])

  const current = items[index]
  const eraName = current ? (eras.find((e) => e.id === current.eraId)?.name ?? current.eraId) : ''

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.question.work.id, current.question.type, answer, false, today)
    setAnswered({ selection, correct, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered })
    setXpTotal((prev) => prev + result.xpGained)
    if (correct) {
      setCorrectCount((prev) => prev + 1)
    } else if (onMiss) {
      onMiss(current.question.work.id, current.question.type, current.passageId, current.underlineKey)
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
    setIndex((prev) => prev + 1)
  }

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>今のところランダム学習を作れなかった（下線データの投入待ち）。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          ホームに戻る
        </button>
      </div>
    )
  }

  if (index >= total) {
    return (
      <div className={learnStyles.summaryScreen} data-testid="random-learn-summary">
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
        <div className={`${styles.eraLabel} caption`}>{eraName}</div>
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
      </div>

      <div className={themeStyles.readPanel} data-testid="excerpt-panel">
        {current.excerpt.map((seg, i) =>
          seg.type === 'underline' ? (
            <mark key={i} className={themeStyles.underlineCurrent}>
              {seg.value}
            </mark>
          ) : (
            <span key={i}>{seg.value}</span>
          ),
        )}
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
