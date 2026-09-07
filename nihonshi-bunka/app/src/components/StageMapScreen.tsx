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
  worldOrder,
  type Difficulty,
  type StageKey,
} from '../engine/stages'
import type { Era, Passage, ProgressState, Work } from '../types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]

type StageCounts = Map<string, { s1: number; s2: number; s3: number; boss: number }>

// reviewer指摘M2b-99中3の修正: counts の useMemo はコンポーネントのマウント単位でしか効かない。
// App.tsx はタブ切り替えを条件レンダー（{tab === 'learn' && <StageMapScreen .../>}）で行うため
// タブを離れて戻るたびに StageMapScreen がアンマウント→再マウントされ、15ワールド×4段=60回の
// 問題生成（実測800ms前後）を毎回やり直していた。pool/imagePool/passages/eras は
// content.ts のモジュール定数（実行中は同じ配列参照）なので、passages の配列参照をキーにした
// モジュールスコープの WeakMap にキャッシュし、マウントをまたいで使い回す（テストで別の
// passages 配列を渡した場合は参照が違うので自然に再計算される＝テスト間の汚染はない）。
const stageCountsCache = new WeakMap<Passage[], StageCounts>()

function getStageCounts(
  sortedEras: Era[],
  pool: Work[],
  imagePool: Work[],
  passages: Passage[],
  eras: Era[],
): StageCounts {
  const cached = stageCountsCache.get(passages)
  if (cached) return cached
  const map: StageCounts = new Map()
  for (const era of sortedEras) {
    map.set(era.id, {
      s1: buildStageQuestions(era.id, 1, pool, imagePool, eras, PROBE_RANDOM).length,
      s2: buildStageQuestions(era.id, 2, pool, imagePool, eras, PROBE_RANDOM).length,
      s3: buildStageQuestions(era.id, 3, pool, imagePool, eras, PROBE_RANDOM).length,
      boss: buildBossQuestions(era.id, passages, pool, imagePool, eras, PROBE_RANDOM, BOSS_SIZE).length,
    })
  }
  stageCountsCache.set(passages, map)
  return map
}

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
  // 選択時（App.tsx）に別途引く。マウントをまたいだキャッシュは getStageCounts 側（上記）で行う。
  const counts = useMemo(
    () => getStageCounts(sortedEras, pool, imagePool, passages, eras),
    [sortedEras, pool, imagePool, passages, eras],
  )

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
                // Hayato修正（Playwright実機確認で発見）: isStageUnlocked自体が
                // isWorldUnlockedを内部で見ている（ワープでこのワールド自身のボスを撃破済み
                // なら通す）ため、ここで外側から worldUnlocked && … と二重にゲートすると
                // reviewer指摘M2b-99重大2の修正が呼び出し側で無効化されてしまっていた
                // （実機確認で北山ワープ後もステージが🔒のままになる再発を発見）。
                const unlocked = isStageUnlocked(worldIndex, n, worlds, progress.stages)
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
                {/* reviewer指摘M2b-99中4: 挑戦前から問数を出す（本来10問固定だが、文化によって
                    下振れうる。異常な少なさに気づけるように常時表示する）。 */}
                {c.boss === 0 ? (
                  <span>なし</span>
                ) : es.boss.cleared ? (
                  <span>👑撃破済</span>
                ) : (
                  <span>挑戦（{c.boss}問）</span>
                )}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
