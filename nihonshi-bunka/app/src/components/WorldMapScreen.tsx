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
//
// M2d-01b（様式手直し）: 管理セッションが research/screenshots/m2d-01/ を見た所見3点への対応。
//  ① 飾りが1画面3個・約24pxと少なすぎる → buildDecorations() で「縦の等間隔の行×左右2本」に
//     並べ直し、1画面（約750px）あたり8〜12個・40〜72px になるよう行間隔・オフセットを調整
//     （道の両脇・ノードのタップ領域からは幾何学的なクリアランス判定で自動的に避ける）。
//  ② 画面下1/4に出ていた用途不明の矩形 → 原因は .canvas 内の groundStrip が「スクロールする
//     道」の最下部（canvas 座標）に固定されていたこと。道が短いワールド（例: 現状の原始・化政
//     はどちらも1面のみ）では canvas がビューポートより低いため、地面の帯が画面の途中に
//     浮いて見えていた。groundStrip は削除し、地面は下記③のスクロールしない層に描き直した。
//  ③ 空・遠景・地面の3層が無い → スクロールしない .screen 側（.viewport の外）に
//     WorldBackgroundArt.tsx の遠景イラスト（原始=山並みと森、化政=富士と海）を1枚固定し、
//     .screen の背景グラデーションと合わせて「空／遠景／地面」の3層にした
//     （backgroundId が無いワールド＝他13ワールドは今まで通り無地の配色のみ。触っていない）。
//
// M2d-02（残り13ワールドの飾り＋ボス統一）: ボスノードは時代ごとのランドマーク形状
// （旧: 原始=前方後円墳、化政=富士山型の CSS clip-path）をやめ、全15ワールド共通の
// 「敵の砦」シルエット（BossFortressIcon。暗い岩山+門+角/炎の突起、黒紫+赤アクセント）に
// 統一した。時代差は頂上の旗アイコン1点（theme.bossFlagId、道端の飾りと同じカタログを
// 再利用）のみで出す。未解禁=灰・挑戦可能=赤い目が光る・クリア=王冠（既存の👑演出を維持）の
// 状態差は変えていない。
import { useRef, useState, type CSSProperties } from 'react'
import styles from './WorldMapScreen.module.css'
import { getMotifIcon } from './worldMotifCatalog'
import { BossFortressIcon } from './BossFortressIcon'
import { GenshiBackdrop, KaiseiBackdrop } from './WorldBackgroundArt'
import {
  eraTotalItemCount,
  fullStageSequence,
  isStageRefCleared,
  stageRefKey,
  stageUnlockBoundary,
  worldOrder,
  worldSegmentPlans,
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

// --- 道端の飾り（M2d-01b。管理セッション所見①「1画面3個・約24pxと小さい」への対応） ---
/** 飾りを並べる縦の行の間隔（px）。同じ側（左 or 右）の飾り同士がこの間隔で並ぶため、
 *  DECORATION_SIZES の最大値（72px）より十分大きく取り、隣接する飾り同士が重ならないようにする。 */
const DECORATION_ROW_STEP = 92
/** 飾りの中心を道の中心線から左右にずらす距離（px）。NODE_SWING（ノードの振れ幅）より
 *  大きく取り、ノードのタップ領域と横方向に重ならないようにする。 */
const DECORATION_OFFSET = NODE_SWING + 68
/** 飾りのサイズ（px）。チケット「40〜72px」の範囲でサイズを変えて自然な密度感を出す。 */
const DECORATION_SIZES = [44, 68, 52, 60, 48, 72, 56, 64]
/** 飾りとノード（タップ領域）の最小クリアランス（px）。ノード半径＋飾り半径に加えて
 *  この余白を確保できないスロットは描かない（防御的：将来ノードのレイアウトが変わっても
 *  タップ領域に重なった飾りが出ない）。 */
const DECORATION_NODE_MARGIN = 6

interface Point {
  x: number
  y: number
}

interface Decoration {
  x: number
  y: number
  size: number
  label: string
  id: string
}

interface WorldMapNode {
  ref: StageRef
  key: StageLocalKey
  isBoss: boolean
  /** ★1〜3を通した面番号（ボスは空文字）。 */
  overallLabel: string
  difficulty?: Difficulty
}

/** M2i: ★ごとに対象作品（面数）が違うため、そのワールドで実際に面を持つ★（worldSegmentPlans。
 *  0件の★は含まない）だけを順に並べ、通し番号を振る。 */
function buildNodes(eraId: string, worldIndex: number, imagePool: Work[]): WorldMapNode[] {
  const nodes: WorldMapNode[] = []
  let overall = 0
  for (const { difficulty, plan } of worldSegmentPlans(eraId, imagePool)) {
    for (const seg of plan.segments) {
      overall++
      nodes.push({
        ref: { kind: 'segment', eraId, worldIndex, difficulty, segment: seg.segment },
        key: { kind: 'segment', difficulty, segment: seg.segment },
        isBoss: false,
        overallLabel: String(overall),
        difficulty,
      })
    }
  }
  if (eraTotalItemCount(eraId, imagePool) > 0) {
    nodes.push({
      ref: { kind: 'boss', eraId, worldIndex },
      key: { kind: 'boss' },
      isBoss: true,
      overallLabel: '',
    })
  }
  return nodes
}

/** 遠景（M2d-01b③）。backgroundId が無ければ何も描かない（他13ワールド）。
 *  oxlint react(static-components)（「render 中に動的な変数をコンポーネントとして使うな」の
 *  検知）を避けるため、カタログ（worldMotifCatalog.getBackgroundArt）の戻り値を変数に入れて
 *  JSX タグにするのではなく、既知の2値（M2d-01b の対象は原始・化政の2ワールドのみ）を
 *  switch で直接分岐して import 済みの実コンポーネントを返す。 */
function BackgroundArtLayer({ backgroundId }: { backgroundId?: string }) {
  switch (backgroundId) {
    case 'genshi-hills':
      return (
        <div className={styles.backgroundArt} aria-hidden="true">
          <GenshiBackdrop />
        </div>
      )
    case 'kasei-fuji-sea':
      return (
        <div className={styles.backgroundArt} aria-hidden="true">
          <KaiseiBackdrop />
        </div>
      )
    default:
      return null
  }
}

/** 面番号が小さいほど下（先に進む）、ボスが最上部（全体マップの原始=最下部→上へ、と同じ向き）。 */
function nodeCenter(index: number, total: number): Point {
  const y = PADDING_Y + (total - 1 - index) * NODE_HEIGHT + NODE_HEIGHT / 2
  const x = CONTENT_WIDTH / 2 + (index % 2 === 0 ? -NODE_SWING : NODE_SWING)
  return { x, y }
}

/**
 * 道端の飾りを並べる（M2d-01b）。ノード間の「隙間」ごとにではなく、canvas 全体を一定間隔
 * （DECORATION_ROW_STEP）の縦の行に区切り、各行の左右（道の中心線からのオフセット固定）に
 * 1個ずつ候補を置く。canvas の高さが伸びれば（面数が増えれば）飾りの総数も自然に増える
 * （特定のノード数を前提に固定個数を決め打ちしない）。
 * ノード（タップ領域）と重なる候補はクリアランス判定で除外する（防御的）。
 * theme.motifs が空なら飾りを描かない（無地の13ワールドは今まで通り）。
 */
function buildDecorations(nodes: WorldMapNode[], theme: WorldTheme, contentHeight: number): Decoration[] {
  if (theme.motifs.length === 0 || nodes.length === 0) return []

  const nodeCircles = nodes.map((n, i) => ({
    p: nodeCenter(i, nodes.length),
    r: (n.isBoss ? BOSS_SIZE : NODE_SIZE) / 2,
  }))

  const decorations: Decoration[] = []
  let motifCursor = 0
  const startY = PADDING_Y - DECORATION_ROW_STEP / 2
  const endY = contentHeight - PADDING_BOTTOM + DECORATION_ROW_STEP / 2
  for (let y = startY; y <= endY; y += DECORATION_ROW_STEP) {
    for (const side of [-1, 1] as const) {
      const x = CONTENT_WIDTH / 2 + side * DECORATION_OFFSET
      const size = DECORATION_SIZES[motifCursor % DECORATION_SIZES.length]
      const tooCloseToNode = nodeCircles.some(
        ({ p, r }) => Math.hypot(p.x - x, p.y - y) < r + size / 2 + DECORATION_NODE_MARGIN,
      )
      if (tooCloseToNode) continue
      const motif = theme.motifs[motifCursor % theme.motifs.length]
      decorations.push({ x, y, size, label: motif.label, id: motif.id })
      motifCursor++
    }
  }
  return decorations
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

  const decorations = buildDecorations(nodes, theme, contentHeight)

  const themeStyle = {
    '--wm-sky': theme.palette.sky,
    '--wm-ground': theme.palette.ground,
    '--wm-road': theme.palette.road,
    '--wm-accent': theme.palette.accent,
  } as CSSProperties

  return (
    <div className={styles.screen} style={themeStyle}>
      {/* 遠景（M2d-01b③）。.viewport（スクロールする道）の外＝スクロールしない層に固定で
          1枚だけ置く。backgroundId が無いワールド（他13ワールド）は何も描かない。 */}
      <BackgroundArtLayer backgroundId={theme.backgroundId} />
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
                  style={{ left: d.x - d.size / 2, top: d.y - d.size / 2, width: d.size, height: d.size }}
                  title={d.label}
                >
                  <Icon width="100%" height="100%" />
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
                  }}
                  onClick={() => onSelectStage(n.key)}
                >
                  {n.isBoss && (
                    <BossFortressIcon
                      state={tileState}
                      FlagIcon={theme.bossFlagId ? getMotifIcon(theme.bossFlagId) : null}
                      className={styles.bossArt}
                    />
                  )}
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
