import { useState } from 'react'
import styles from './AnswerSheet.module.css'
import { BottomSheet } from './BottomSheet'
import { WorkImage } from './WorkImage'
import { ImageLightbox } from './ImageLightbox'
import { imageSrc } from '../utils/image'
import { explainMiss, type MissSelection } from '../engine/explain'
import type { Era, Question, Work } from '../types'

function excerpt(text: string, maxSentences = 2): string {
  const sentences = text.split('。').filter((s) => s.trim().length > 0)
  if (sentences.length === 0) return text
  return sentences.slice(0, maxSentences).join('。') + '。'
}

function eraNameOf(eraId: string, eras: Era[]): string {
  return eras.find((e) => e.id === eraId)?.name ?? eraId
}

export function AnswerSheet({
  question,
  selection,
  correct,
  eras,
  isNewDiscovery,
  isNewlyMastered,
  nextLabel,
  onNext,
}: {
  question: Question
  selection: MissSelection
  correct: boolean
  eras: Era[]
  isNewDiscovery: boolean
  isNewlyMastered: boolean
  nextLabel: string
  onNext: () => void
}) {
  const work = question.work
  const whyWrong = correct ? '' : explainMiss(question, selection, eras)
  const isUnknown = selection.kind === 'unknown'

  const otherWorks = question.type === 'q2' ? [] : question.choiceWorks.filter((w) => w.id !== work.id)
  const otherEras =
    question.type === 'q2' ? (question.choiceEras ?? []).filter((e) => e.id !== work.era) : []

  const [lightboxWork, setLightboxWork] = useState<Work | null>(null)

  return (
    <BottomSheet
      label="解説"
      footer={
        <button type="button" data-testid="next-button" className={styles.nextButton} onClick={onNext}>
          {nextLabel}
        </button>
      }
    >
      <div
        className={`${styles.judgement} ${correct ? styles.judgementCorrect : styles.judgementWrong}`}
        data-testid="judgement"
      >
        {isUnknown ? (
          <span>未回答</span>
        ) : correct ? (
          <span className="caption-bold">◎ 正解</span>
        ) : (
          <span className="caption-bold">
            ✗ 不正解 — 正解は「{work.title}」
          </span>
        )}
      </div>
      {whyWrong && <p className={styles.whyWrong}>{whyWrong}</p>}

      <div className={styles.correctBlock}>
        <button
          type="button"
          className={styles.correctImage}
          onClick={() => setLightboxWork(work)}
          aria-label={`${work.title}を拡大表示`}
        >
          <WorkImage src={imageSrc(work)} alt={work.title} />
        </button>
        <div className={styles.correctMeta}>
          <div className={`${styles.workTitle} caption-bold`}>{work.title}</div>
          <div className={styles.workReading}>{work.reading}</div>
          <div className={styles.workFacts}>
            {eraNameOf(work.era, eras)}・{work.location}
            {work.technique ? `・${work.technique}` : ''}
          </div>
        </div>
      </div>

      {work.keyPoints.length > 0 && (
        <ul className={styles.keyPoints}>
          {work.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}

      <p className={styles.explanation}>{work.explanation}</p>

      {isNewDiscovery && <p className={styles.sectionLabel}>図鑑に追加した。</p>}
      {isNewlyMastered && <p className={styles.sectionLabel}>図鑑に所蔵した。</p>}

      {(otherWorks.length > 0 || otherEras.length > 0) && (
        <div>
          <div className={styles.sectionLabel}>他の選択肢</div>
          <div className={styles.otherList}>
            {otherWorks.map((w) => {
              const confusable = work.confusables.find((c) => c.id === w.id)
              return (
                <div className={styles.otherItem} key={w.id}>
                  <button
                    type="button"
                    className={styles.otherImage}
                    onClick={() => setLightboxWork(w)}
                    aria-label={`${w.title}を拡大表示`}
                  >
                    <WorkImage src={imageSrc(w)} alt={w.title} />
                  </button>
                  <div className={styles.otherMeta}>
                    <div className={`${styles.otherTitle} caption`}>{w.title}</div>
                    <div>{eraNameOf(w.era, eras)}</div>
                    <div>{excerpt(w.explanation, 2)}</div>
                    {confusable && <div className={styles.otherHowTo}>見分け方: {confusable.howToTell}</div>}
                  </div>
                </div>
              )
            })}
            {otherEras.map((e) => (
              <div className={styles.otherItem} key={e.id}>
                <div className={styles.otherMeta}>
                  <div className={`${styles.otherTitle} caption`}>{e.name}</div>
                  <div>{e.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {work.examNote && <p className={styles.examNote}>入試での注意: {work.examNote}</p>}

      {lightboxWork && (
        <ImageLightbox
          src={imageSrc(lightboxWork)}
          alt={lightboxWork.title}
          title={lightboxWork.title}
          onClose={() => setLightboxWork(null)}
        />
      )}
    </BottomSheet>
  )
}
