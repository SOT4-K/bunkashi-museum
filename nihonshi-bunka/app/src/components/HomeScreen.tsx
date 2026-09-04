import { useState } from 'react'
import styles from './HomeScreen.module.css'
import { isItemMastered } from '../engine/srs'
import { titleForLevel } from '../engine/progress'
import { useStandalone } from '../hooks/useStandalone'
import type { Era, ProgressState, Work } from '../types'

const ADD_TO_HOME_DISMISSED_KEY = 'bunkashi.addToHomeDismissed'

function eraStats(era: Era, works: Work[], progress: ProgressState) {
  const eraWorks = works.filter((w) => w.era === era.id)
  const total = eraWorks.length
  const mastered = eraWorks.filter((w) => {
    const item = progress.items[w.id]
    return item ? isItemMastered(item) : false
  }).length
  const discovered = eraWorks.filter((w) => Boolean(progress.items[w.id]?.discoveredAt)).length
  return { total, mastered, discovered }
}

function pickCurrentEra(eras: Era[], works: Work[], progress: ProgressState): Era | null {
  const sorted = [...eras].sort((a, b) => a.order - b.order)
  const withWorks = sorted.filter((e) => works.some((w) => w.era === e.id))
  if (withWorks.length === 0) return null
  const unfinished = withWorks.find((e) => {
    const stats = eraStats(e, works, progress)
    return stats.mastered < stats.total
  })
  return unfinished ?? withWorks[withWorks.length - 1]
}

export function HomeScreen({
  works,
  eras,
  progress,
  hasMockExam,
  onStartMockExam,
  onStartMissReview,
  missLogCount = 0,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  /** 本番モードが組み立てられるか（content.ts の passages が1件以上あるか）。M2-45。 */
  hasMockExam: boolean
  /** 本番モード（M2-20 → M2-45 でランダム学習を統合）。 */
  onStartMockExam: () => void
  /** 間違いノート復習（M2-23）。省略時はボタンを出さない（既存呼び出し元互換）。 */
  onStartMissReview?: () => void
  missLogCount?: number
}) {
  const standalone = useStandalone()
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(ADD_TO_HOME_DISMISSED_KEY) === '1',
  )

  const currentEra = pickCurrentEra(eras, works, progress)
  const stats = currentEra ? eraStats(currentEra, works, progress) : { total: 0, mastered: 0, discovered: 0 }
  const masteryRatio = stats.total > 0 ? stats.mastered / stats.total : 0
  // works が0件（本番ビルドで reviewed が無い等）と、本番モードがまだ組み立てられない
  // （passages 未投入）のを区別する（M2-45: 「今日の分」概念は本番モードには無い）。
  const noWorksAvailable = works.length === 0

  function dismissBanner() {
    setBannerDismissed(true)
    localStorage.setItem(ADD_TO_HOME_DISMISSED_KEY, '1')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.streak}>連続 {progress.streak.count} 日</div>

      {currentEra && (
        <div className={styles.eraBlock}>
          <div className={styles.eraLabel}>今日の展示室</div>
          <div className={`${styles.eraName} caption`}>{currentEra.name}</div>
          <div className={styles.masteryBar}>
            <div className={styles.masteryFill} style={{ width: `${Math.round(masteryRatio * 100)}%` }} />
          </div>
          <div className={styles.masteryLabel}>
            {stats.mastered} / {stats.total} 所蔵
          </div>
        </div>
      )}

      <div className={styles.titleLine}>
        <span>Lv.{progress.level}　{titleForLevel(progress.level)}</span>
        <span>{progress.xp} XP</span>
      </div>

      {/* M2-45: ホームの入口は「本番モード」「間違い復習」＋進捗表示だけにする（テーマセット
          一覧・ランダム学習の「学習を始める」は削除。分析10.5章）。 */}
      <div>
        <button
          type="button"
          className={styles.startButton}
          onClick={onStartMockExam}
          disabled={!hasMockExam}
          data-testid="mock-exam-button"
        >
          <span>本番モード</span>
          <span className={styles.startSub}>大問IV形式10問・20点満点</span>
        </button>
        {!hasMockExam && (
          <div className={styles.bossLine}>
            {noWorksAvailable ? '出題できる作品がまだない。' : 'リード文の投入待ち。'}
          </div>
        )}
      </div>

      {/* M2-45: 間違い復習は「0件なら非表示」（decisions.md 2026-09-04 22:30）。旧仕様
          （0件でも disabled で表示）から変更した。 */}
      {onStartMissReview && missLogCount > 0 && (
        <div>
          <button type="button" className={styles.themeSetItem} data-testid="miss-review-button" onClick={onStartMissReview}>
            {`間違えた問題を復習（${missLogCount}問）`}
          </button>
        </div>
      )}

      {!standalone && !bannerDismissed && (
        <div className={styles.banner}>
          <div>ホーム画面に追加すると全画面で遊べる。共有ボタン → 「ホーム画面に追加」。</div>
          <button type="button" className={styles.bannerClose} onClick={dismissBanner}>
            閉じる
          </button>
        </div>
      )}
    </div>
  )
}
