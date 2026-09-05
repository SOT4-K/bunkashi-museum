// 間違いノートの復習セッション。M2-23。engine/missLog.ts が組み立てた最大10問
// （直近と違う型・新しい選択肢で再出題）を1問ずつ出す。正解・不正解にかかわらず
// 経験値・図鑑・SRSは更新する（decisions.md 2026-09-04夜）。加えて2回連続正解で
// ノートから外すための onOutcome を呼ぶ（engine/missLog.ts の applyReviewOutcome）。
import { useEffect, useMemo, useRef, useState } from 'react'
import learnStyles from './LearnScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { LeadPanel } from './LeadPanel'
import { todayIso } from '../engine/srs'
import { findLeadContextForWork } from '../engine/leadContext'
import type { MissReviewItem } from '../engine/missLog'
import type { MissSelection } from '../engine/explain'
import type { AnswerKind, Era, Passage, Question, Work } from '../types'

interface AnsweredState {
  selection: MissSelection
  correct: boolean
  isNewDiscovery: boolean
  isNewlyMastered: boolean
}

export function MissReviewScreen({
  items,
  eras,
  onAnswer,
  onOutcome,
  onFinish,
  pool,
  passages,
}: {
  items: MissReviewItem[]
  eras: Era[]
  onAnswer: (
    workId: string,
    type: Question['type'],
    answer: AnswerKind,
    isReview: boolean,
    today: string,
  ) => { xpGained: number; isNewDiscovery: boolean; isNewlyMastered: boolean }
  /** 2回連続正解の判定・ノートからの除去（engine/missLog.ts の applyReviewOutcome）。 */
  onOutcome: (workId: string, correct: boolean) => void
  onFinish: () => void
  /** M2-42「全モードで同じ」: リード文ボタンの best-effort な文脈解決に使う。省略時はボタンを出さない
   *  （engine/leadContext.ts。間違い復習は元々 passage を経由せず作品単体から出題するため、
   *  ここでは事後的に「この作品を対象にする最初の下線」を逆引きする）。 */
  pool?: Work[]
  passages?: Passage[]
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
  const leadContext = useMemo(
    () => (current && passages && pool ? findLeadContextForWork(current.question.work.id, passages, pool) : null),
    [current, passages, pool],
  )

  function handleResult(answer: AnswerKind, selection: MissSelection) {
    if (!current) return
    const correct = answer === 'correct'
    const result = onAnswer(current.question.work.id, current.question.type, answer, true, today)
    setAnswered({ selection, correct, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered })
    setXpTotal((prev) => prev + result.xpGained)
    if (correct) setCorrectCount((prev) => prev + 1)
    onOutcome(current.entry.workId, correct)

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
    setIndex((prev) => prev + 1)
  }

  if (total === 0) {
    return (
      <div className={learnStyles.screen}>
        <p>間違いなし。</p>
        <button type="button" className={learnStyles.doneButton} onClick={onFinish}>
          ホームに戻る
        </button>
      </div>
    )
  }

  if (index >= total) {
    return (
      <div className={learnStyles.summaryScreen} data-testid="miss-review-summary">
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
      <div className={learnStyles.progressRow}>
        <span>間違い復習 {index + 1}/{total}</span>
        <span className={learnStyles.dots}>
          {items.map((_, i) => (
            <span key={i} className={`${learnStyles.dot} ${i <= index ? learnStyles.dotFilled : ''}`} />
          ))}
        </span>
      </div>

      <LeadPanel
        passage={leadContext?.passage}
        underlineKey={leadContext?.underlineKey}
        pool={pool ?? []}
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
