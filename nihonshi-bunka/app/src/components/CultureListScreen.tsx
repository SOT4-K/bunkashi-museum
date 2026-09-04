// 学習タブ: 文化別練習の入口。M2-22。時代3グループ（古代・中世・近世）の中に15文化を並べ、
// 各文化に習熟度（図鑑の所蔵率・直近の正答率）を表示する。タップでその文化だけの練習を始める
// （経験値・図鑑・SRSは更新されない。記録されないことをここと練習画面の両方で明記する）。
import styles from './CultureListScreen.module.css'
import { groupErasByPeriod, cultureStats } from '../engine/eraGroups'
import type { Era, ProgressState, Work } from '../types'

export function CultureListScreen({
  works,
  eras,
  progress,
  onSelectEra,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  onSelectEra: (eraId: string) => void
}) {
  const groups = groupErasByPeriod(eras).filter((g) => g.eras.some((e) => works.some((w) => w.era === e.id)))

  return (
    <div className={styles.screen}>
      <p className={styles.notice} data-testid="practice-notice">
        文化を選んでその範囲だけ練習できる。結果は記録されない（経験値・図鑑・SRSは更新されない）。
      </p>
      {groups.length === 0 && <p className={styles.empty}>出題できる作品がまだない。</p>}
      {groups.map((group) => (
        <div className={styles.groupBlock} key={group.id}>
          <div className={styles.groupLabel}>{group.label}</div>
          <div className={styles.cultureList}>
            {group.eras
              .filter((era) => works.some((w) => w.era === era.id))
              .map((era) => {
                const stats = cultureStats(era.id, works, progress)
                return (
                  <button
                    type="button"
                    key={era.id}
                    className={styles.cultureItem}
                    data-testid="culture-button"
                    onClick={() => onSelectEra(era.id)}
                  >
                    <span className={styles.cultureName}>{era.name}</span>
                    <span className={styles.cultureStats}>
                      所蔵 {stats.mastered}/{stats.total}・正答率{' '}
                      {stats.accuracyRatio === null ? '—' : `${Math.round(stats.accuracyRatio * 100)}%`}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
