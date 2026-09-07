// ステージマップ（マリオ型。M2b-01）。学習タブの入口。ワールド＝文化（eras.json の順）を
// 縦に並べ、各ワールドに ★1/★2/★3 のステージとボスの4マスを置く。文化別練習（旧
// CultureListScreen/PracticeSessionScreen）の入口はここに吸収された（M2b-01 実装スコープ d）。
import { useMemo } from 'react'
import styles from './StageMapScreen.module.css'
import {
  BOSS_SIZE,
  DIFFICULTY_LABELS,
  PROBE_RANDOM,
  buildBossQuestions,
  buildStageQuestions,
  getEraStageState,
  isStageUnlocked,
  isWorldUnlocked,
  worldOrder,
  type Difficulty,
  type StageKey,
} from '../engine/stages'
import type { Era, Passage, ProgressState, Work } from '../types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]

export function StageMapScreen({
  eras,
  pool,
  imagePool,
  passages,
  progress,
  onSelectStage,
}: {
  eras: Era[]
  /** content.ts の themeSetPool（distractor 素材。画像なし項目も含む）。 */
  pool: Work[]
  /** content.ts の playableWorks（出題対象自身は画像必須）。 */
  imagePool: Work[]
  passages: Passage[]
  progress: ProgressState
  onSelectStage: (eraId: string, key: StageKey) => void
}) {
  const sortedEras = useMemo(() => [...eras].sort((a, b) => a.order - b.order), [eras])
  const worlds = useMemo(() => worldOrder(eras), [eras])

  // 件数表示・「なし」判定は PROBE_RANDOM（決定的）で行う。実際のプレイ用の乱数は
  // 選択時（App.tsx）に別途引く。
  const counts = useMemo(() => {
    const map = new Map<string, { s1: number; s2: number; s3: number; boss: number }>()
    for (const era of sortedEras) {
      map.set(era.id, {
        s1: buildStageQuestions(era.id, 1, pool, imagePool, eras, PROBE_RANDOM).length,
        s2: buildStageQuestions(era.id, 2, pool, imagePool, eras, PROBE_RANDOM).length,
        s3: buildStageQuestions(era.id, 3, pool, imagePool, eras, PROBE_RANDOM).length,
        boss: buildBossQuestions(era.id, passages, pool, imagePool, eras, PROBE_RANDOM, BOSS_SIZE).length,
      })
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pool/imagePool/passages/eras は
    // content.ts のモジュール定数（実行中に変化しない）。テストでは props が変わりうるため
    // sortedEras を通じて再計算のトリガーにする。
  }, [sortedEras, pool, imagePool, passages, eras])

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
        ワールドを順にクリアして日本文化を制覇しよう。文化ボスはいつでも挑戦できる（ワープ。撃破するとそのワールドはクリア扱いになる）。
      </p>
      {sortedEras.map((era, worldIndex) => {
        const es = getEraStageState(progress.stages, era.id)
        const c = counts.get(era.id)!
        const worldUnlocked = isWorldUnlocked(worldIndex, worlds, progress.stages)

        return (
          <div className={styles.worldBlock} key={era.id} data-testid="world-block">
            <div className={styles.worldName}>
              W{worldIndex + 1} {era.name}
            </div>
            <div className={styles.stageRow}>
              {DIFFICULTIES.map((n) => {
                const key: StageKey = `s${n}` as StageKey
                const count = c[key]
                const none = count === 0
                const unlocked = worldUnlocked && isStageUnlocked(worldIndex, n, worlds, progress.stages)
                const cleared = es[key].cleared
                return (
                  <button
                    type="button"
                    key={key}
                    className={`${styles.stageTile} ${cleared ? styles.cleared : ''}`}
                    data-testid={`stage-tile-${era.id}-${key}`}
                    disabled={none || !unlocked}
                    title={DIFFICULTY_LABELS[n]}
                    onClick={() => onSelectStage(era.id, key)}
                  >
                    <span className={styles.stageStar}>{'★'.repeat(n)}</span>
                    {none ? <span>なし</span> : !unlocked ? <span>🔒</span> : cleared ? <span>クリア済</span> : <span>{count}問</span>}
                  </button>
                )
              })}
              <button
                type="button"
                className={`${styles.stageTile} ${styles.bossTile} ${es.boss.cleared ? styles.cleared : ''}`}
                data-testid={`stage-tile-${era.id}-boss`}
                disabled={c.boss === 0}
                title="ボス（ワープ可）"
                onClick={() => onSelectStage(era.id, 'boss')}
              >
                <span>ボス</span>
                {c.boss === 0 ? <span>なし</span> : es.boss.cleared ? <span>👑撃破済</span> : <span>挑戦</span>}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
