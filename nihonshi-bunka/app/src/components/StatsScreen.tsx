import { useState } from 'react'
import styles from './StatsScreen.module.css'
import { CreditsSheet } from './CreditsSheet'
import { WorkDetailSheet } from './WorkDetailSheet'
import { isItemMastered } from '../engine/srs'
import { migrate } from '../engine/progress'
import { sortMissLogByCulture } from '../engine/missLog'
import type { Era, ProgressState, Work } from '../types'

const TYPE_LABELS_SHORT: Record<string, string> = {
  q1: '画像→作品名',
  q2: '画像→文化',
  q3: '作品名→画像',
  q4: '関連記述',
  q6: '同時代事項',
  q8: '組合せ文',
  q9: '図版',
  q10: '2文正誤',
  q12: '文字4択',
  q13: '語句組合せ',
  q14: '年代順',
}

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
  const [showCredits, setShowCredits] = useState(false)
  const [openWorkId, setOpenWorkId] = useState<string | null>(null)

  const worksById = Object.fromEntries(works.map((w) => [w.id, w]))
  const missLog = sortMissLogByCulture(progress.missLog ?? [], worksById, eras)
  const openWork = openWorkId ? worksById[openWorkId] : null

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
        <div className={styles.sectionLabel}>間違いノート（{missLog.length}件）</div>
        {missLog.length === 0 ? (
          <p className={styles.empty}>間違いなし。</p>
        ) : (
          <div className={styles.weakList} data-testid="miss-log-list">
            {missLog.map((entry) => {
              const work = worksById[entry.workId]
              const eraName = eras.find((e) => e.id === work?.era)?.name ?? work?.era ?? ''
              return (
                <button
                  type="button"
                  key={entry.workId}
                  className={styles.weakRow}
                  data-testid="miss-log-item"
                  onClick={() => setOpenWorkId(entry.workId)}
                  disabled={!work}
                >
                  <span>
                    {work?.title ?? entry.workId}（{eraName}）
                  </span>
                  <span className={styles.weakCount}>
                    {TYPE_LABELS_SHORT[entry.type] ?? entry.type}・{entry.lastMissedAt}・{entry.count}回
                  </span>
                </button>
              )
            })}
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

      <div className={styles.section}>
        <button type="button" className={styles.creditsLink} onClick={() => setShowCredits(true)}>
          画像の出典
        </button>
      </div>

      {showCredits && <CreditsSheet onClose={() => setShowCredits(false)} />}

      {openWork && (
        <WorkDetailSheet
          work={openWork}
          eras={eras}
          worksById={worksById}
          onSelectConfusable={(id) => {
            if (worksById[id]) setOpenWorkId(id)
          }}
          onClose={() => setOpenWorkId(null)}
        />
      )}
    </div>
  )
}
