import { useState } from 'react'
import styles from './MuseumScreen.module.css'
import { WorkDetailSheet } from './WorkDetailSheet'
import { WorkImage } from './WorkImage'
import { ImageLightbox } from './ImageLightbox'
import { ExpandIcon } from './icons'
import { imageSrc } from '../utils/image'
import { isItemMastered } from '../engine/srs'
import type { Era, ProgressState, Work } from '../types'

export function MuseumScreen({
  works,
  eras,
  progress,
  onStart,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  onStart: () => void
}) {
  const [openWorkId, setOpenWorkId] = useState<string | null>(null)
  const [lightboxWorkId, setLightboxWorkId] = useState<string | null>(null)
  const worksById = Object.fromEntries(works.map((w) => [w.id, w]))

  const anyDiscovered = works.some((w) => Boolean(progress.items[w.id]?.discoveredAt))

  if (!anyDiscovered) {
    return (
      <div className={styles.screen}>
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>最初の作品を見つけよう。</p>
          <button type="button" className={styles.emptyButton} onClick={onStart}>
            学習を始める
          </button>
        </div>
      </div>
    )
  }

  const sortedEras = [...eras].sort((a, b) => a.order - b.order).filter((e) => works.some((w) => w.era === e.id))
  const openWork = openWorkId ? worksById[openWorkId] : null
  const lightboxWork = lightboxWorkId ? worksById[lightboxWorkId] : null

  return (
    <div className={styles.screen}>
      {sortedEras.map((era) => {
        const eraWorks = works.filter((w) => w.era === era.id)
        const masteredCount = eraWorks.filter((w) => {
          const item = progress.items[w.id]
          return item ? isItemMastered(item) : false
        }).length
        return (
          <div className={styles.eraSection} key={era.id}>
            <div className={styles.eraHeading}>
              <div className={`${styles.eraName} caption`}>{era.name}</div>
              <div className={styles.eraCount}>
                {masteredCount} / {eraWorks.length} 所蔵
              </div>
            </div>
            <div className={styles.grid}>
              {eraWorks.map((work) => {
                const item = progress.items[work.id]
                const discovered = Boolean(item?.discoveredAt)
                const mastered = item ? isItemMastered(item) : false
                return (
                  <button
                    key={work.id}
                    type="button"
                    className={`${styles.tile} ${mastered ? styles.tileMastered : ''}`}
                    disabled={!discovered}
                    onClick={() => setOpenWorkId(work.id)}
                    aria-label={discovered ? work.title : '未発見'}
                  >
                    {discovered ? (
                      <>
                        <WorkImage className={styles.tileImage} src={imageSrc(work)} alt={work.title} />
                        <span
                          role="button"
                          tabIndex={0}
                          className={styles.expandButton}
                          aria-label={`${work.title}を拡大表示`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setLightboxWorkId(work.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              e.preventDefault()
                              setLightboxWorkId(work.id)
                            }
                          }}
                        >
                          <ExpandIcon width={16} height={16} />
                        </span>
                      </>
                    ) : (
                      <span className={styles.tileHiddenLabel}>{work.title}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      {openWork && (
        <WorkDetailSheet
          work={openWork}
          eras={eras}
          worksById={worksById}
          onSelectConfusable={(id) => {
            if (worksById[id] && progress.items[id]?.discoveredAt) setOpenWorkId(id)
          }}
          onClose={() => setOpenWorkId(null)}
        />
      )}

      {lightboxWork && (
        <ImageLightbox
          src={imageSrc(lightboxWork)}
          alt={lightboxWork.title}
          title={lightboxWork.title}
          onClose={() => setLightboxWorkId(null)}
        />
      )}
    </div>
  )
}
