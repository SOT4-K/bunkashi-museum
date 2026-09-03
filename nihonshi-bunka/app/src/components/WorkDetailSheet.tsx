import styles from './WorkDetailSheet.module.css'
import { BottomSheet } from './BottomSheet'
import { WorkImage } from './WorkImage'
import { imageSrc } from '../utils/image'
import type { Era, Work } from '../types'

export function WorkDetailSheet({
  work,
  eras,
  worksById,
  onSelectConfusable,
  onClose,
}: {
  work: Work
  eras: Era[]
  worksById: Record<string, Work>
  onSelectConfusable: (workId: string) => void
  onClose: () => void
}) {
  const eraName = eras.find((e) => e.id === work.era)?.name ?? work.era

  return (
    <BottomSheet
      label={work.title}
      footer={
        <button type="button" className={styles.closeButton} onClick={onClose}>
          閉じる
        </button>
      }
    >
      <div className={styles.image}>
        <WorkImage src={imageSrc(work)} alt={work.title} />
      </div>
      <div className={`${styles.title} caption-bold`}>{work.title}</div>
      <div className={styles.reading}>{work.reading}</div>
      <div className={styles.facts}>
        {eraName}・{work.location}
        {work.technique ? `・${work.technique}` : ''}
      </div>
      <p className={styles.explanation}>{work.explanation}</p>

      {work.confusables.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>紛らわしい作品</div>
          <div className={styles.confusableList}>
            {work.confusables.map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.confusableButton}
                onClick={() => onSelectConfusable(c.id)}
              >
                {worksById[c.id]?.title ?? c.id}
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
