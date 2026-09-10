import { useState } from 'react'
import styles from './HomeScreen.module.css'
import { SettingsSection } from './SettingsSection'
import { BottomSheet } from './BottomSheet'
import { isItemMastered } from '../engine/srs'
import { titleForLevel } from '../engine/progress'
import { nextStageRef, segmentCountsByDifficulty, stageRefToLocalKey, stageShortLabel, type StageLocalKey } from '../engine/stages'
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
  onSelectStage,
  onImportProgress,
  onResetProgress,
  onAcknowledgeResetNotice,
}: {
  /** content.ts の playableWorks。時代別習熟の集計と、次の面カード（ステージ計画）の両方に使う。 */
  works: Work[]
  eras: Era[]
  progress: ProgressState
  /** M2b-05: 「次の面」カードを押したときにその面を開始する。省略時はカード自体を出さない
   *  （既存呼び出し元互換。テスト用に段階的に呼び出し元を移行できるようにするため optional）。 */
  onSelectStage?: (eraId: string, key: StageLocalKey) => void
  /** M2b-11: 歯車→設定シート（旧成績タブ→旧ホーム直置きから移設）。onResetProgress を
   *  渡したときだけ歯車ボタン自体を表示する（既存呼び出し元互換）。 */
  onImportProgress?: (next: ProgressState) => void
  onResetProgress?: () => void
  /** M2b-05: v2初回起動時の「進捗をリセットしました」通知を1回だけ表示するための消込。 */
  onAcknowledgeResetNotice?: () => void
}) {
  const standalone = useStandalone()
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof localStorage !== 'undefined' && localStorage.getItem(ADD_TO_HOME_DISMISSED_KEY) === '1',
  )
  // M2b-11: ホームは「面カード」だけの入口にする（9/8オーナー午後フィードバック）。設定は
  // タブでなく歯車アイコン→ボトムシートに変更。
  const [settingsOpen, setSettingsOpen] = useState(false)

  const currentEra = pickCurrentEra(eras, works, progress)
  const stats = currentEra ? eraStats(currentEra, works, progress) : { total: 0, mastered: 0, discovered: 0 }
  const masteryRatio = stats.total > 0 ? stats.mastered / stats.total : 0

  function dismissBanner() {
    setBannerDismissed(true)
    localStorage.setItem(ADD_TO_HOME_DISMISSED_KEY, '1')
  }

  // M2b-05: ホームは「次にクリアする面」カードが主入口（チケット規則8。全ワールド撃破済み
  // なら null。9/8オーナー確認済みの既定⑥「15ワールド撃破で称号『館長』の演出のみ」）。
  const nextRef = onSelectStage ? nextStageRef(eras, works, progress.stages) : null
  const nextEraName = nextRef ? (eras.find((e) => e.id === nextRef.eraId)?.name ?? nextRef.eraId) : ''
  // M2i: 面番号はワールド内の通し番号（★ごとに面数が違うため difficulty ごとの面数を渡す）。
  const nextSegmentCounts = nextRef ? segmentCountsByDifficulty(nextRef.eraId, works) : {}
  const allWorldsCleared = Boolean(onSelectStage) && nextRef === null && eras.length > 0 && works.length > 0

  return (
    <div className={styles.screen}>
      {progress.resetNotice && onAcknowledgeResetNotice && (
        <div className={styles.resetNotice} data-testid="reset-notice-banner">
          <span>新バージョンのため進捗をリセットしました。</span>
          <button
            type="button"
            className={styles.bannerClose}
            data-testid="reset-notice-dismiss"
            onClick={onAcknowledgeResetNotice}
          >
            閉じる
          </button>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.streak}>連続 {progress.streak.count} 日</div>
        {onResetProgress && (
          <button
            type="button"
            className={styles.settingsGear}
            aria-label="設定"
            data-testid="settings-gear-button"
            onClick={() => setSettingsOpen(true)}
          >
            ⚙️
          </button>
        )}
      </div>

      {onSelectStage && nextRef && (
        <button
          type="button"
          className={styles.nextStageCard}
          data-testid="next-stage-card"
          onClick={() => onSelectStage(nextRef.eraId, stageRefToLocalKey(nextRef))}
        >
          <span className={styles.nextStageLabel}>次にクリアする面</span>
          <span className={styles.nextStageTitle}>
            {stageShortLabel(nextRef, nextSegmentCounts)} {nextEraName}
          </span>
          <span className={styles.nextStagePlay}>プレイ</span>
        </button>
      )}

      {allWorldsCleared && (
        <div className={styles.completeBanner} data-testid="all-worlds-cleared-banner">
          全ての展示室を制覇した！称号「館長」
        </div>
      )}

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

      {!standalone && !bannerDismissed && (
        <div className={styles.banner}>
          <div>ホーム画面に追加すると全画面で遊べる。共有ボタン → 「ホーム画面に追加」。</div>
          <button type="button" className={styles.bannerClose} onClick={dismissBanner}>
            閉じる
          </button>
        </div>
      )}

      {/* M2b-11: 設定（進捗の書き出し/読み込み・全リセット・画像の出典）は歯車→ボトムシートへ
          移設（旧: ホーム最下部に直置き）。onResetProgress を渡したときだけ歯車自体を出す
          （既存呼び出し元互換）ため、シートも同条件でだけ開ける。 */}
      {settingsOpen && onResetProgress && (
        <BottomSheet
          label="設定"
          footer={
            <button
              type="button"
              className={styles.settingsCloseButton}
              data-testid="settings-sheet-close"
              onClick={() => setSettingsOpen(false)}
            >
              閉じる
            </button>
          }
        >
          <SettingsSection progress={progress} onImport={onImportProgress ?? (() => {})} onReset={onResetProgress} />
        </BottomSheet>
      )}
    </div>
  )
}
