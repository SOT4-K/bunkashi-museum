import { useState } from 'react'
import styles from './HomeScreen.module.css'
import { previewSessionComposition } from '../engine/session'
import { isItemMastered } from '../engine/srs'
import { titleForLevel } from '../engine/progress'
import { useStandalone } from '../hooks/useStandalone'
import type { Era, Passage, ProgressState, Work } from '../types'

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
  today,
  dailyNewRemaining,
  onStart,
  themeSets = [],
  onStartThemeSet,
}: {
  works: Work[]
  eras: Era[]
  progress: ProgressState
  today: string
  dailyNewRemaining: number
  onStart: () => void
  /** テーマセット（リード文＋下線部→図版問題）一覧。省略時はセクションを出さない（既存呼び出し元互換）。 */
  themeSets?: Passage[]
  onStartThemeSet?: (passage: Passage) => void
}) {
  const standalone = useStandalone()
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(ADD_TO_HOME_DISMISSED_KEY) === '1',
  )

  const currentEra = pickCurrentEra(eras, works, progress)
  const stats = currentEra ? eraStats(currentEra, works, progress) : { total: 0, mastered: 0, discovered: 0 }
  const masteryRatio = stats.total > 0 ? stats.mastered / stats.total : 0
  const discoveryRatio = stats.total > 0 ? stats.discovered / stats.total : 0
  const bossReady = discoveryRatio >= 0.6

  const composition = previewSessionComposition(works, eras, progress, today, dailyNewRemaining)
  const canStart = composition.reviewCount + composition.newCount > 0
  // works が0件（本番ビルドで reviewed が無い等）と、単に今日の分をやり終えたのを区別する。
  // 前者を「また明日」と言うのは誤り（明日になっても出題できる作品は増えない）。
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

      <div>
        <button type="button" className={styles.startButton} onClick={onStart} disabled={!canStart}>
          <span>学習を始める</span>
          <span className={styles.startSub}>
            復習 {composition.reviewCount}・新規 {composition.newCount}
          </span>
        </button>
        {!canStart && (
          <div className={styles.bossLine}>
            {noWorksAvailable ? '出題できる作品がまだない。' : '今日の分は学習し終えた。また明日。'}
          </div>
        )}
      </div>

      {currentEra && (
        <div className={styles.bossLine}>
          {bossReady
            ? `${currentEra.name}の時代ボスに挑戦できる`
            : `時代ボスまで発見率 ${Math.round(discoveryRatio * 100)}%（60%で解放）`}
        </div>
      )}

      {themeSets.length > 0 && onStartThemeSet && (
        <div className={styles.eraBlock}>
          <div className={styles.eraLabel}>テーマセット（模試型）</div>
          <div className={styles.themeSetList}>
            {themeSets.map((p) => (
              <button
                type="button"
                key={p.id}
                className={styles.themeSetItem}
                data-testid="theme-set-button"
                onClick={() => onStartThemeSet(p)}
              >
                {p.title}
              </button>
            ))}
          </div>
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
