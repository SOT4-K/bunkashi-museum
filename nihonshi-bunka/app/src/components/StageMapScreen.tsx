// ステージマップ（マリオ型。M2b-01→M2b-04 v2）。学習タブの入口。
// 注記（builder メモ「ホーム画面やUIの変更、次チケットの着手はしない」）: このコンポーネントは
// M2b-05/06 で「マップタブ」（絵巻風SVG・ドラッグ・雲・王冠）に置き換えられる想定。M2b-04では
// engine/stages.ts のスキーマ変更（可変面数・直列解禁）に合わせてコンパイルが通る最小限の
// 機械的な作り直しに留めている（見た目・体力ゲージ・雲演出などのデザインはM2b-05/06の担当）。
import { useMemo } from 'react'
import styles from './StageMapScreen.module.css'
import {
  buildEraStagePlan,
  fullStageSequence,
  getEraStageProgress,
  getSegmentState,
  questionCountForSegment,
  stageRefKey,
  stageUnlockBoundary,
  worldOrder,
  type Difficulty,
  type StageLocalKey,
} from '../engine/stages'
import type { Era, Passage, ProgressState, Work } from '../types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]

export function StageMapScreen({
  eras,
  // pool・passages は現状このコンポーネント自体は使わないが、呼び出し側（App.tsx）が
  // StageScreen と共通の props を渡す構成に揃えるため受け取る（将来M2b-05/06で
  // リード文プレビュー等に使う可能性があるため引数自体は残す。noUnusedParameters対応で
  // 先頭に _ を付ける）。
  pool: _pool,
  imagePool,
  passages: _passages,
  progress,
  onSelectStage,
}: {
  eras: Era[]
  /** content.ts の themeSetPool（distractor 素材。画像なし項目も含む）。 */
  pool: Work[]
  /** content.ts の playableWorks（出題対象自身は画像必須）。面数・面の中身の計算に使う。 */
  imagePool: Work[]
  passages: Passage[]
  progress: ProgressState
  onSelectStage: (eraId: string, key: StageLocalKey) => void
}) {
  const sortedEras = useMemo(() => [...eras].sort((a, b) => a.order - b.order), [eras])
  const worlds = useMemo(() => worldOrder(eras), [eras])
  const sequence = useMemo(() => fullStageSequence(eras, imagePool), [eras, imagePool])
  const boundary = useMemo(() => stageUnlockBoundary(sequence, progress.stages), [sequence, progress.stages])
  const unlockedKeys = useMemo(() => {
    const set = new Set<string>()
    for (let i = 0; i <= boundary && i < sequence.length; i++) set.add(stageRefKey(sequence[i]))
    return set
  }, [sequence, boundary])

  if (sortedEras.length === 0) {
    return (
      <div className={styles.screen}>
        <p className={styles.empty}>出題できる文化がまだない。</p>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <p className={styles.notice} data-testid="stage-map-notice">
        ワールドを順にクリアして日本文化を制覇しよう（直列解禁。ボスはそのワールドの全ステージをクリアするまで挑めない）。
      </p>
      {sortedEras.map((era) => {
        const worldIndex = worlds.indexOf(era.id)
        const plan = buildEraStagePlan(era.id, imagePool)
        const eraProgress = getEraStageProgress(progress.stages, era.id)
        const bossKey: StageLocalKey = { kind: 'boss' }
        const bossUnlocked = unlockedKeys.has(stageRefKey({ kind: 'boss', eraId: era.id, worldIndex }))

        return (
          <div className={styles.worldBlock} key={era.id} data-testid="world-block">
            <div className={styles.worldName}>
              W{worldIndex + 1} {era.name}
            </div>
            {plan.itemCount === 0 ? (
              <p className={styles.empty}>出題できる作品がまだない。</p>
            ) : (
              <div className={styles.stageRow}>
                {DIFFICULTIES.map((difficulty) => (
                  <div className={styles.difficultyGroup} key={difficulty} data-testid={`difficulty-group-${era.id}-${difficulty}`}>
                    <span className={styles.stageStar}>{'★'.repeat(difficulty)}</span>
                    {plan.segments.map((seg) => {
                      const key: StageLocalKey = { kind: 'segment', difficulty, segment: seg.segment }
                      const unlocked = unlockedKeys.has(stageRefKey({ kind: 'segment', eraId: era.id, worldIndex, difficulty, segment: seg.segment }))
                      const cleared = getSegmentState(eraProgress, difficulty, seg.segment).cleared
                      return (
                        <button
                          type="button"
                          key={`${difficulty}-${seg.segment}`}
                          className={`${styles.stageTile} ${cleared ? styles.cleared : ''}`}
                          data-testid={`stage-tile-${era.id}-${difficulty}-${seg.segment}`}
                          disabled={!unlocked}
                          title={`${worldIndex + 1}-${seg.segment} ${'★'.repeat(difficulty)}`}
                          onClick={() => onSelectStage(era.id, key)}
                        >
                          {!unlocked ? (
                            <span>🔒</span>
                          ) : cleared ? (
                            <span>クリア済</span>
                          ) : (
                            <span>
                              {worldIndex + 1}-{seg.segment}（{questionCountForSegment(seg)}問）
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
                <button
                  type="button"
                  className={`${styles.stageTile} ${styles.bossTile} ${eraProgress.boss.cleared ? styles.cleared : ''}`}
                  data-testid={`stage-tile-${era.id}-boss`}
                  disabled={!bossUnlocked}
                  title="ボス"
                  onClick={() => onSelectStage(era.id, bossKey)}
                >
                  <span>ボス</span>
                  {!bossUnlocked ? (
                    <span>🔒</span>
                  ) : eraProgress.boss.cleared ? (
                    <span>👑撃破済</span>
                  ) : (
                    <span>挑戦（{plan.bossSize}問）</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
