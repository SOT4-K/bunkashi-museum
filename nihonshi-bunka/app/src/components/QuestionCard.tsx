import { useState } from 'react'
import styles from './LearnScreen.module.css'
import { WorkImage } from './WorkImage'
import { ImageLightbox } from './ImageLightbox'
import { ExpandIcon } from './icons'
import { imageSrc } from '../utils/image'
import type { MissSelection } from '../engine/explain'
import type { Question, Work } from '../types'

const PROMPTS: Record<Question['type'], string> = {
  q1: 'この作品は？',
  q2: 'この作品の文化は？',
  q3: 'この作品の画像は？',
}

export function QuestionCard({
  question,
  answered,
  onChoice,
  onUnknown,
}: {
  question: Question
  answered: { selection: MissSelection; correct: boolean } | null
  onChoice: (index: number) => void
  onUnknown: () => void
}) {
  const disabled = Boolean(answered)
  const chosenIndex = answered?.selection.kind === 'choice' ? answered.selection.index : -1
  // 出題中の画像は答えのヒントを増やさないため、ライトボックスも常に mono・作品名なしで開く。
  const [lightboxWork, setLightboxWork] = useState<Work | null>(null)

  function classForIndex(index: number, isCorrectOption: boolean): string {
    if (!answered) return styles.choice
    if (isCorrectOption) return `${styles.choice} ${styles.choiceCorrect}`
    if (index === chosenIndex) return `${styles.choice} ${styles.choiceWrong}`
    return `${styles.choice} ${styles.choiceDim}`
  }

  if (question.type === 'q3') {
    return (
      <div>
        <div className={styles.titleHero}>
          <div className={`${styles.titleHeroText} caption-bold`}>{question.work.title}</div>
        </div>
        <p className={styles.prompt}>{PROMPTS.q3}</p>
        <div className={styles.imageGrid}>
          {question.choiceWorks.map((w, index) => {
            const isCorrectOption = index === question.correctIndex
            const isChosenWrong = Boolean(answered) && !isCorrectOption && index === chosenIndex
            const base = styles.imageChoice
            const extra = !answered
              ? ''
              : isCorrectOption
                ? styles.choiceCorrect
                : index === chosenIndex
                  ? styles.choiceWrong
                  : styles.choiceDim
            return (
              <div className={styles.imageChoiceWrap} key={w.id}>
                {answered && isCorrectOption && (
                  <span className={styles.imageCorrectLabel}>正解</span>
                )}
                <button
                  type="button"
                  data-testid="choice-button"
                  className={`${base} ${extra}`}
                  disabled={disabled}
                  onClick={() => onChoice(index)}
                  aria-label={`選択肢 ${index + 1}`}
                >
                  <WorkImage mono src={imageSrc(w)} alt="作品" />
                  {answered && isCorrectOption && (
                    <span className={`${styles.imageGlyph} ${styles.imageGlyphCorrect}`} aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {isChosenWrong && (
                    <span className={`${styles.imageGlyph} ${styles.imageGlyphWrong}`} aria-hidden="true">
                      ✗
                    </span>
                  )}
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  className={styles.expandButton}
                  aria-label="この画像を拡大表示"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxWork(w)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      e.preventDefault()
                      setLightboxWork(w)
                    }
                  }}
                >
                  <ExpandIcon width={14} height={14} />
                </span>
              </div>
            )
          })}
        </div>
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
        )}
        {lightboxWork && (
          <ImageLightbox
            src={imageSrc(lightboxWork)}
            alt="作品"
            mono
            onClose={() => setLightboxWork(null)}
          />
        )}
      </div>
    )
  }

  const choiceLabels =
    question.type === 'q2'
      ? (question.choiceEras ?? []).map((e) => e.name)
      : question.choiceWorks.map((w) => w.title)

  return (
    <div>
      <button type="button" className={styles.hero} onClick={() => setLightboxWork(question.work)} aria-label="この画像を拡大表示">
        <WorkImage mono src={imageSrc(question.work)} alt="作品" />
      </button>
      <p className={styles.prompt}>{PROMPTS[question.type]}</p>
      <div className={styles.choiceList}>
        {choiceLabels.map((label, index) => {
          const isCorrectOption = index === question.correctIndex
          const isChosenWrong = Boolean(answered) && !isCorrectOption && index === chosenIndex
          return (
            <div className={styles.choiceItem} key={label}>
              {answered && isCorrectOption && <span className={styles.correctLabel}>正解</span>}
              <button
                type="button"
                data-testid="choice-button"
                className={classForIndex(index, isCorrectOption)}
                disabled={disabled}
                onClick={() => onChoice(index)}
              >
                <span className={styles.choiceLabelText}>{label}</span>
                {answered && isCorrectOption && (
                  <span className={`${styles.choiceGlyph} ${styles.choiceGlyphCorrect}`} aria-hidden="true">
                    ✓
                  </span>
                )}
                {isChosenWrong && (
                  <span className={`${styles.choiceGlyph} ${styles.choiceGlyphWrong}`} aria-hidden="true">
                    ✗
                  </span>
                )}
              </button>
            </div>
          )
        })}
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
        )}
      </div>
      {lightboxWork && (
        <ImageLightbox src={imageSrc(lightboxWork)} alt="作品" mono onClose={() => setLightboxWork(null)} />
      )}
    </div>
  )
}
