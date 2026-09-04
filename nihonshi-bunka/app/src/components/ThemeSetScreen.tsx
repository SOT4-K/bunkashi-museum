// テーマセット（リード文＋下線部→図版問題）の学習画面。decisions.md 2026-09-04「模試型」と
// mock-exam-analysis.md 7章「修正の仕様（M2-09〜11）」:
//  セット開始→リード文を全文表示（下線a〜eを強調、模試のページと同じ見え方）→「問題へ」→
//  各問の冒頭に「下線部○に関して」＋下線部の文言を表示→全問終了で結果。
//  リード文は問題中も「リード文を見返す」で折りたたみ表示できる（既存機能を維持）。
// 出題は buildThemeSetQuestions で passage から一括生成する（SRS の復習キューではなく、
// 1つのリード文＝1セット）。
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './ThemeSetScreen.module.css'
import learnStyles from './LearnScreen.module.css'
import { QuestionCard } from './QuestionCard'
import { AnswerSheet } from './AnswerSheet'
import { WorkImage } from './WorkImage'
import { imageSrc } from '../utils/image'
import { appendOrderQuestionIfDue, buildThemeSetQuestions } from '../engine/themeSet'
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

type Phase = 'read' | 'quiz' | 'done'

export function ThemeSetScreen({
  passage,
  pool,
  imagePool = pool,
  sequenceIndex = 0,
  eras,
  onAnswer,
  onFinish,
}: {
  passage: Passage
  /** 出題対象・素材にできる作品（画像あり artifact ＋ 画像なし person/text/concept。M2-16）。 */
  pool: Work[]
  /** 画像で出題できる作品だけ（Q1/Q2/Q9 の対象・distractor、年代順並べ替えの候補）。
   *  省略時は pool と同じ（既存呼び出しとの後方互換）。 */
  imagePool?: Work[]
  /** 「学習を始める」等で連続提示するテーマセットの通し番号（0始まり）。3セットに1問の
   *  年代順並べ替え（M2-16）の頻度判定に使う。省略時は0（毎回1本目扱い＝並べ替えは出ない）。 */
  sequenceIndex?: number
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
  const themeQuestions = useMemo(() => {
    const base = buildThemeSetQuestions(passage, pool, eras, undefined, imagePool)
    return appendOrderQuestionIfDue(base, sequenceIndex, imagePool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage.id, sequenceIndex])
  const segments = useMemo(() => splitPassageText(passage.text), [passage.text])
  // 9章「画像リード型セット」: kind === "image" のとき、リード文の代わりに参照画像1〜2枚を表示する。
  const isImageLead = passage.kind === 'image'
  const leadWorks = useMemo(() => {
    if (!isImageLead || !passage.leadWorkIds) return []
    const byId = new Map(pool.map((w) => [w.id, w]))
    return passage.leadWorkIds.map((id) => byId.get(id)).filter((w): w is Work => Boolean(w))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passage.id, isImageLead])
  // 下線 key → 下線部の文言（下線部に結んだ問題文の冒頭「下線部○に関して」に使う）
  const underlineTextByKey = useMemo(() => {
    const map = new Map<string, string>()
    for (const seg of segments) {
      if (seg.type === 'underline') map.set(seg.key, seg.value)
    }
    return map
  }, [segments])

  const total = themeQuestions.length
  const [phase, setPhase] = useState<Phase>(total > 0 ? 'read' : 'done')
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

  const current = themeQuestions[index]

  function handleStartQuiz() {
    setPhase('quiz')
  }

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
    const nextIndex = index + 1
    setIndex(nextIndex)
    if (nextIndex >= total) setPhase('done')
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

  if (phase === 'read') {
    return (
      <div className={learnStyles.screen}>
        <div className={styles.header}>
          <div className={`${styles.title} caption-bold`}>{passage.title}</div>
        </div>
        {isImageLead && leadWorks.length > 0 && (
          <div className={styles.leadImageGrid} data-testid="lead-image-grid">
            {leadWorks.map((w) => (
              <div className={styles.leadImageItem} key={w.id}>
                <WorkImage mono src={imageSrc(w)} alt="作品" />
              </div>
            ))}
          </div>
        )}
        <div className={styles.readPanel} data-testid="passage-read-panel">
          {segments.map((seg, i) =>
            seg.type === 'underline' ? (
              <mark key={i} className={styles.underline}>
                {seg.value}
              </mark>
            ) : (
              <span key={i}>{seg.value}</span>
            ),
          )}
        </div>
        <button type="button" className={learnStyles.doneButton} data-testid="start-quiz-button" onClick={handleStartQuiz}>
          問題へ
        </button>
      </div>
    )
  }

  if (phase === 'done') {
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

  // phase === 'quiz'
  const isLast = index === total - 1
  // M2-16: 年代順並べ替え（appendOrderQuestionIfDue が追加する underlineKey: 'order'）は
  // 本文の下線に対応しないため「下線部○に関して」を出さない。
  const isRealUnderline = Boolean(current && underlineTextByKey.has(current.underlineKey))
  const underlineLabel = current ? (underlineTextByKey.get(current.underlineKey) ?? '') : ''

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
          {isImageLead && leadWorks.length > 0 && (
            <div className={styles.leadImageGrid} data-testid="lead-image-grid-context">
              {leadWorks.map((w) => (
                <div className={styles.leadImageItem} key={w.id}>
                  <WorkImage mono src={imageSrc(w)} alt="作品" />
                </div>
              ))}
            </div>
          )}
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

      {isRealUnderline && (
        <p className={styles.underlinePrompt} data-testid="underline-prompt">
          下線部{current.underlineKey}に関して: {underlineLabel}
        </p>
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
