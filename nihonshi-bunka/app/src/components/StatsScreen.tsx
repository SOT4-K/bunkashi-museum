import { useState } from 'react'
import styles from './StatsScreen.module.css'
import { isItemMastered } from '../engine/srs'
import { migrate } from '../engine/progress'
import type { Era, ProgressState, Work } from '../types'

function wrongTotal(progress: ProgressState, workId: string): number {
  const item = progress.items[workId]
  if (!item) return 0
  return item.q1.wrong + item.q2.wrong + item.q3.wrong
}

export function StatsScreen({
  works,
  eras,
  progress,
  onImport,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  onImport: (next: ProgressState) => void
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')

  const sortedEras = [...eras].sort((a, b) => a.order - b.order).filter((e) => works.some((w) => w.era === e.id))

  const weakWorks = works
    .map((w) => ({ work: w, wrong: wrongTotal(progress, w.id) }))
    .filter((entry) => entry.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 10)

  function handleExport() {
    setText(JSON.stringify(progress, null, 2))
    setMessage('進捗を書き出した。')
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(text)
      const next = migrate(parsed)
      onImport(next)
      setMessage('進捗を読み込んだ。')
    } catch {
      setMessage('読み込めなかった。JSONの形式を確認してほしい。')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>時代別の習熟率</div>
        {sortedEras.map((era) => {
          const eraWorks = works.filter((w) => w.era === era.id)
          const mastered = eraWorks.filter((w) => {
            const item = progress.items[w.id]
            return item ? isItemMastered(item) : false
          }).length
          const ratio = eraWorks.length > 0 ? mastered / eraWorks.length : 0
          return (
            <div className={styles.eraRow} key={era.id}>
              <div className={styles.eraRowTop}>
                <span className="caption">{era.name}</span>
                <span>
                  {mastered} / {eraWorks.length}
                </span>
              </div>
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>弱点作品トップ10</div>
        {weakWorks.length === 0 ? (
          <p className={styles.empty}>まだ弱点は無い。</p>
        ) : (
          <div className={styles.weakList}>
            {weakWorks.map(({ work, wrong }) => (
              <div className={styles.weakRow} key={work.id}>
                <span>{work.title}</span>
                <span className={styles.weakCount}>誤答 {wrong}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>進捗データ</div>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="書き出すと進捗のJSONがここに表示される。貼り付けて読み込むこともできる。"
        />
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} onClick={handleExport}>
            進捗を書き出す
          </button>
          <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleImport}>
            進捗を読み込む
          </button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  )
}
