import styles from './LearnScreen.module.css'
import { WorkImage } from './WorkImage'
import { imageSrc } from '../utils/image'
import type { MissSelection } from '../engine/explain'
import type { Question } from '../types'

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
            const base = styles.imageChoice
            const extra = !answered
              ? ''
              : isCorrectOption
                ? styles.choiceCorrect
                : index === chosenIndex
                  ? styles.choiceWrong
                  : styles.choiceDim
            return (
              <button
                key={w.id}
                type="button"
                data-testid="choice-button"
                className={`${base} ${extra}`}
                disabled={disabled}
                onClick={() => onChoice(index)}
                aria-label={`選択肢 ${index + 1}`}
              >
                <WorkImage mono src={imageSrc(w)} alt="作品" />
              </button>
            )
          })}
        </div>
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
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
      <div className={styles.hero}>
        <WorkImage mono src={imageSrc(question.work)} alt="作品" />
      </div>
      <p className={styles.prompt}>{PROMPTS[question.type]}</p>
      <div className={styles.choiceList}>
        {choiceLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            data-testid="choice-button"
            className={classForIndex(index, index === question.correctIndex)}
            disabled={disabled}
            onClick={() => onChoice(index)}
          >
            {label}
          </button>
        ))}
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
        )}
      </div>
    </div>
  )
}
