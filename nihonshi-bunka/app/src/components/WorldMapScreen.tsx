// ワールドマップ画面（M2d-01。BOARD.md「M2d ワールド内マップと時代別ビジュアル」）。
// 全体マップ（MapScreen）でワールドをタップすると開く2階層目の画面。
// 要件（チケット文面）:
//  - 一本道（縦のジグザグ）に面ノード（1, 2, …／★1→★2→★3 の順）とボスノードを並べる
//  - ノード状態は全体マップと同じ記号系（灰ロック🔒／黄色パルス＝現在／緑チェック✓＝クリア／ボスは王冠👑）
//  - ノードをタップで既存の StageScreen へ（onSelectStage）
//  - 左上に「マップへ戻る」
//  - 時代テーマ（背景パレット・道端の飾りモチーフ・ボスノードの形）を content/worlds.json 由来の
//    WorldTheme で描く。飾りはタップ不可（装飾のみ）で、実際の出題画像は使わない
//    （CLAUDE.md 禁止事項）。motifs が空（無地パレットのみ）のワールドは飾りを描かない。
//  - 面の並び・解禁・クリア判定は既存 engine/stages をそのまま使う（進捗データの形式は変えない）
import { useRef, useState, type CSSProperties } from 'react'
import styles from './WorldMapScreen.module.css'
import { getBossClipPath, getMotifIcon } from './worldMotifCatalog'
import {
  buildEraStagePlan,
  fullStageSequence,
  isStageRefCleared,
  overallSegmentNumber,
  stageRefKey,
  stageUnlockBoundary,
  worldOrder,
  type Difficulty,
  type StageLocalKey,
  type StageRef,
} from '../engine/stages'
import type { Era, ProgressState, Work, WorldTheme } from '../types'

/** ノード間の縦幅（px）。 */
const NODE_HEIGHT = 96
const PADDING_Y = 70
/** ボスノードは通常ノードより大きいため、上下に余分な余白を足す。 */
const PADDING_BOTTOM = 110
const CONTENT_WIDTH = 340
/** 一本道が左右に振れる幅（ジグザグ演出）。 */
const NODE_SWING = 56
const NODE_SIZE = 56
const BOSS_SIZE = 78

interface Point {
  x: number
  y: number
}

interface WorldMapNode {
  ref: StageRef
  key: StageLocalKey
  isBoss: boolean
  /** ★1〜3を通した面番号（ボスは空文字）。 */
  overallLabel: string
  difficulty?: Difficulty
}

function buildNodes(eraId: string, worldIndex: number, imagePool: Work[]): WorldMapNode[] {
  const plan = buildEraStagePlan(eraId, imagePool)
  const segmentsPerWorld = plan.segments.length
  const nodes: WorldMapNode[] = []
  for (const difficulty of [1, 2, 3] as Difficulty[]) {
    for (const seg of plan.segments) {
      nodes.push({
        ref: { kind: 'segment', eraId, worldIndex, difficulty, segment: seg.segment },
        key: { kind: 'segment', difficulty, segment: seg.segment },
        isBoss: false,
        overallLabel: String(overallSegmentNumber(difficulty, seg.segment, segmentsPerWorld)),
        difficulty,
      })
    }
  }
  if (plan.itemCount > 0) {
    nodes.push({
      ref: { kind: 'boss', eraId, worldIndex },
      key: { kind: 'boss' },
      isBoss: true,
      overallLabel: '',
    })
  }
  return nodes
}

/** 面番号が小さいほど下（先に進む）、ボスが最上部（全体マップの原始=最下部→上へ、と同じ向き）。 */
function nodeCenter(index: number, total: number): Point {
  const y = PADDING_Y + (total - 1 - index) * NODE_HEIGHT + NODE_HEIGHT / 2
  const x = CONTENT_WIDTH / 2 + (index % 2 === 0 ? -NODE_SWING : NODE_SWING)
  return { x, y }
}

export function WorldMapScreen({
  eraId,
  eras,
  /** content.ts の playableWorks 相当。 */
  imagePool,
  progress,
  theme,
  onSelectStage,
  onBack,
}: {
  eraId: string
  eras: Era[]
  imagePool: Work[]
  progress: ProgressState
  theme: WorldTheme
  onSelectStage: (key: StageLocalKey) => void
  onBack: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [initialized, setInitialized] = useState(false)

  const era = eras.find((e) => e.id === eraId)
  const worldIndex = worldOrder(eras).indexOf(eraId)
  const nodes = buildNodes(eraId, worldIndex, imagePool)

  const sequence = fullStageSequence(eras, imagePool)
  const boundary = stageUnlockBoundary(sequence, progress.stages)
  const unlockedKeys = new Set<string>()
  for (let i = 0; i <= boundary && i < sequence.length; i++) unlockedKeys.add(stageRefKey(sequence[i]))

  const contentHeight = nodes.length * NODE_HEIGHT + PADDING_Y + PADDING_BOTTOM

  /** 初回のみ、現在挑戦中（未クリアの最初のノード。無ければ最後のノード）が
   *  ビューポート中央に来るようスクロール位置を合わせる（MapScreen の初期パンと同じ考え方だが
   *  ノード数が少なくネイティブ縦スクロールで足りるため、自前ドラッグ実装はしない）。 */
  function applyInitialScrollIfNeeded(node: HTMLDivElement | null) {
    if (!node || initialized || nodes.length === 0) return
    containerRef.current = node
    const viewportHeight = node.clientHeight || 0
    if (viewportHeight === 0) return
    let idx = nodes.findIndex((n) => !isStageRefCleared(n.ref, progress.stages))
    if (idx === -1) idx = nodes.length - 1
    const center = nodeCenter(idx, nodes.length)
    node.scrollTop = Math.max(0, center.y - viewportHeight / 2)
    setInitialized(true)
  }

  const decorations: { x: number; y: number; label: string; id: string }[] = []
  if (theme.motifs.length > 0) {
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodeCenter(i, nodes.length)
      const b = nodeCenter(i + 1, nodes.length)
      const side = i % 2 === 0 ? 1 : -1
      const motif = theme.motifs[i % theme.motifs.length]
      decorations.push({
        x: CONTENT_WIDTH / 2 + side * (NODE_SWING + 58),
        y: (a.y + b.y) / 2,
        label: motif.label,
        id: motif.id,
      })
    }
  }

  const themeStyle = {
    '--wm-sky': theme.palette.sky,
    '--wm-ground': theme.palette.ground,
    '--wm-road': theme.palette.road,
    '--wm-accent': theme.palette.accent,
  } as CSSProperties

  return (
    <div className={styles.screen} style={themeStyle}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} data-testid="world-map-back" onClick={onBack}>
          ← マップへ戻る
        </button>
        <div className={styles.worldTitle} data-testid="world-map-title">
          W{worldIndex + 1} {era?.name ?? eraId}
        </div>
      </div>

      {nodes.length === 0 ? (
        <p className={styles.empty}>出題できる面がまだない。</p>
      ) : (
        <div
          ref={applyInitialScrollIfNeeded}
          className={styles.viewport}
          data-testid="world-map-viewport"
        >
          <div className={styles.canvas} style={{ width: CONTENT_WIDTH, height: contentHeight }}>
            <div className={styles.groundStrip} aria-hidden="true" />
            <svg
              className={styles.roadSvg}
              width={CONTENT_WIDTH}
              height={contentHeight}
              viewBox={`0 0 ${CONTENT_WIDTH} ${contentHeight}`}
              aria-hidden="true"
            >
              <path
                d={nodes
                  .map((_, i) => {
                    const p = nodeCenter(i, nodes.length)
                    return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                  })
                  .join(' ')}
                className={styles.road}
                fill="none"
              />
            </svg>

            {decorations.map((d, i) => {
              const Icon = getMotifIcon(d.id)
              if (!Icon) return null
              return (
                <div
                  key={`${d.id}-${i}`}
                  className={styles.motif}
                  data-testid={`world-motif-${eraId}-${d.id}-${i}`}
                  style={{ left: d.x - 20, top: d.y - 20 }}
                  title={d.label}
                >
                  <Icon />
                </div>
              )
            })}

            {nodes.map((n, i) => {
              const p = nodeCenter(i, nodes.length)
              const refKey = stageRefKey(n.ref)
              const unlocked = unlockedKeys.has(refKey)
              const cleared = isStageRefCleared(n.ref, progress.stages)
              const tileState = !unlocked ? 'locked' : cleared ? 'cleared' : 'unlocked'
              const size = n.isBoss ? BOSS_SIZE : NODE_SIZE
              const stars = n.difficulty ? '★'.repeat(n.difficulty) : ''
              const title = n.isBoss ? 'ボス' : `${n.overallLabel} ${stars}`
              const testId =
                n.ref.kind === 'boss' ? `stage-tile-${eraId}-boss` : `stage-tile-${eraId}-${n.ref.difficulty}-${n.ref.segment}`
              return (
                <button
                  type="button"
                  key={refKey}
                  className={`${styles.node} ${n.isBoss ? styles.bossNode : ''} ${styles[tileState]}`}
                  data-testid={testId}
                  data-state={tileState}
                  disabled={!unlocked}
                  title={title}
                  style={{
                    left: p.x - size / 2,
                    top: p.y - size / 2,
                    width: size,
                    height: size,
                    clipPath: n.isBoss ? getBossClipPath(theme.bossShape) || undefined : undefined,
                  }}
                  onClick={() => onSelectStage(n.key)}
                >
                  {tileState === 'locked' && (
                    <span className={styles.tileIcon} aria-hidden="true">
                      🔒
                    </span>
                  )}
                  {tileState === 'cleared' && (
                    <span className={styles.tileIcon} aria-hidden="true">
                      {n.isBoss ? '👑' : '✓'}
                    </span>
                  )}
                  {tileState === 'unlocked' &&
                    (n.isBoss ? (
                      <span className={styles.tileLabel}>ボス</span>
                    ) : (
                      <>
                        <span className={styles.tileLabel}>{n.overallLabel}</span>
                        <span className={styles.tileStars}>{stars}</span>
                      </>
                    ))}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
