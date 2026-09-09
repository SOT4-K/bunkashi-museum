// マップタブ（M2b-06。学習タブ/StageMapScreenの置き換え。BOARD.md「M2b v2」）。
// 絵巻風の道と時代ごとのランドマークを自前SVGで表現し、ドラッグ（タッチ/マウス）で
// 全体を見回せるキャンバスにする（ライセンス不明の画像・外部アセットは使わない。
// CLAUDE.md禁止事項）。要件（チケットM2b-06）:
//  1. ゲーム風の地図（自前SVG、絵巻風の道と時代ごとの小さなランドマーク）
//  2. ドラッグで全体を見回せる（タッチ/マウスのパン。ピンチ拡大は任意→今回は実装しない）
//  3. 現在プレイ中のワールドは全面が見える（未クリアの面はロック表示）
//  4. 先（未到達）のワールドは雲で隠す、そのワールドのボス撃破で雲が晴れる
//  5. クリア済みの面はタップで再挑戦できる（成績は更新するがクリア状態は下がらない）
//  6. 撃破済みボスに王冠
//  7. 縦長で原始（最初のワールド）が最下部、上へ登る構成（9/8オーナー確認済みの既定④）
//
// M2d-01（BOARD.md「M2d ワールド内マップと時代別ビジュアル」）: 要件3「現在プレイ中の
// ワールドは全面が見える」は、この画面がその場に面タイルを展開する形から、
// タップして WorldMapScreen（新規2階層目の画面）へ入る形に変わった（設計要点「2階層」）。
// このファイルは①雲・直列解禁・王冠の判定（変更なし）②ワールド単位の進捗要約＋
// タップで onSelectWorld(eraId) を呼ぶだけの入口、に役割を絞った。個別の面タイル
// （★1-1 等）の状態判定・レンダリングは WorldMapScreen.tsx に移した。
import { useRef, useState } from 'react'
import styles from './MapScreen.module.css'
import {
  buildEraStagePlan,
  getEraStageProgress,
  getSegmentState,
  isWorldUnlocked,
  nextStageRef,
  worldOrder,
} from '../engine/stages'
import type { Era, ProgressState, Work } from '../types'

/** 1ワールド分の縦幅（px）。ランドマーク＋面タイルのパネルが収まる余白を含む。 */
const WORLD_HEIGHT = 260
const PADDING_Y = 60
/**
 * M2b-99e[重大]是正: 最下段ワールド（worldIndex=0、原始文化）の worldPanel は
 * `top: center.y - 20` から下へ実測 約272px 伸びる（3難易度行＋ボスタイル＋帯）のに対し、
 * 旧実装は contentHeight の下端余白が PADDING_Y(60px) しか無く、パネル下端が
 * contentHeight を約82px 超えてボスタイルがドラッグしても画面外に出せなかった
 * （clampPan の minY が contentHeight を基準に計算されるため）。パネル高＋余裕を
 * 下側だけ追加で確保する（他ワールドの間隔・ランドマーク位置は変えない）。
 */
const PADDING_BOTTOM = 260
const CONTENT_WIDTH = 340
/** ランドマークの左右の振れ幅（絵巻の道が蛇行する演出）。 */
const LANDMARK_SWING = 64

interface Point {
  x: number
  y: number
}

function clampPan(pan: Point, contentWidth: number, contentHeight: number, viewportWidth: number, viewportHeight: number): Point {
  // コンテンツがビューポートより大きい方向だけドラッグを許す。小さい方向は 0 に固定
  // （中央寄せのまま動かさない）。
  const minX = Math.min(0, viewportWidth - contentWidth)
  const minY = Math.min(0, viewportHeight - contentHeight)
  return {
    x: Math.max(minX, Math.min(0, pan.x)),
    y: Math.max(minY, Math.min(0, pan.y)),
  }
}

export function MapScreen({
  eras,
  /** content.ts の playableWorks（出題対象自身は画像必須）。面数・面の中身の計算に使う。 */
  imagePool,
  progress,
  onSelectWorld,
}: {
  eras: Era[]
  imagePool: Work[]
  progress: ProgressState
  /** M2d-01: ワールドの入口をタップしたら呼ぶ（App.tsx が WorldMapScreen を開く）。 */
  onSelectWorld: (eraId: string) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; pointerId: number } | null>(null)
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 })
  const [initialized, setInitialized] = useState(false)

  const sortedEras = [...eras].sort((a, b) => a.order - b.order)
  const worlds = worldOrder(eras)

  const contentHeight = worlds.length * WORLD_HEIGHT + PADDING_Y + PADDING_BOTTOM

  function landmarkCenter(worldIndex: number): Point {
    // worldIndex 0（最古のワールド）が最下部、番号が大きいほど上へ（既定④）。
    const y = PADDING_Y + (worlds.length - 1 - worldIndex) * WORLD_HEIGHT + WORLD_HEIGHT / 2
    const x = CONTENT_WIDTH / 2 + (worldIndex % 2 === 0 ? -LANDMARK_SWING : LANDMARK_SWING)
    return { x, y }
  }

  // 現在プレイ中のワールド（次に挑戦する面のワールド。全クリア済みなら最終ワールド）に
  // 初期スクロール位置を合わせる（1回だけ。containerRef のレイアウト確定後）。
  function applyInitialPanIfNeeded(node: HTMLDivElement | null) {
    if (!node || initialized) return
    containerRef.current = node
    const viewportHeight = node.clientHeight || 0
    const viewportWidth = node.clientWidth || 0
    if (viewportHeight === 0) return
    const next = nextStageRef(eras, imagePool, progress.stages)
    const currentWorldIndex = next ? next.worldIndex : Math.max(0, worlds.length - 1)
    const center = landmarkCenter(currentWorldIndex)
    const targetY = -(center.y - viewportHeight / 2)
    const targetX = -(center.x - viewportWidth / 2)
    setPan(clampPan({ x: targetX, y: targetY }, CONTENT_WIDTH, contentHeight, viewportWidth, viewportHeight))
    setInitialized(true)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // M2d-01 で発覚・修正: ここで無条件に setPointerCapture すると、Pointer Events 仕様上
    // 関連する mouse/click イベントも capture 先（この viewport）へリターゲットされ、
    // 子要素のボタン（ワールドの入口 .worldPanel 等）がタップされても click が発火しない
    // （ワールドタップで WorldMapScreen に入れない実機バグになる。実ブラウザの疑似クリック
    // シーケンスで再現・確認済み。jsdom のテストは pointer capture を再現しないため検出できない）。
    // ボタン上の pointerdown はパンを開始しない（クリックに譲る）。
    if ((e.target as HTMLElement).closest('button')) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== e.pointerId) return
    const node = containerRef.current
    const viewportWidth = node?.clientWidth ?? 0
    const viewportHeight = node?.clientHeight ?? 0
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    setPan(clampPan({ x: drag.panX + dx, y: drag.panY + dy }, CONTENT_WIDTH, contentHeight, viewportWidth, viewportHeight))
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) dragRef.current = null
  }

  if (sortedEras.length === 0) {
    return (
      <div className={styles.screen}>
        <p className={styles.empty}>出題できる文化がまだない。</p>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <p className={styles.notice} data-testid="map-notice">
        ドラッグして地図を見回せる。ワールドを順にクリアして日本文化を制覇しよう。
      </p>
      <div
        ref={applyInitialPanIfNeeded}
        className={styles.viewport}
        data-testid="map-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className={styles.canvas}
          data-testid="map-canvas"
          style={{ width: CONTENT_WIDTH, height: contentHeight, transform: `translate(${pan.x}px, ${pan.y}px)` }}
        >
          <svg
            className={styles.roadSvg}
            width={CONTENT_WIDTH}
            height={contentHeight}
            viewBox={`0 0 ${CONTENT_WIDTH} ${contentHeight}`}
            aria-hidden="true"
          >
            {/* 絵巻風の道: 各ワールドのランドマーク中心を滑らかに結ぶ（原始=最下部から上へ）。 */}
            <path
              d={worlds
                .map((_, i) => {
                  const p = landmarkCenter(i)
                  return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                })
                .join(' ')}
              className={styles.road}
              fill="none"
            />
            {worlds.map((eraId, i) => {
              const p = landmarkCenter(i)
              const unlocked = isWorldUnlocked(i, eras, imagePool, progress.stages)
              const bossCleared = getEraStageProgress(progress.stages, eraId).boss.cleared
              return (
                <g key={eraId}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={30}
                    className={unlocked ? styles.landmark : styles.landmarkLocked}
                  />
                  {bossCleared && (
                    <text x={p.x} y={p.y - 38} textAnchor="middle" className={styles.crownGlyph} data-testid={`world-crown-${eraId}`}>
                      👑
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {worlds.map((eraId, worldIndex) => {
            const era = sortedEras.find((e) => e.id === eraId)
            if (!era) return null
            const p = landmarkCenter(worldIndex)
            const unlocked = isWorldUnlocked(worldIndex, eras, imagePool, progress.stages)
            const plan = buildEraStagePlan(eraId, imagePool)
            const eraProgress = getEraStageProgress(progress.stages, eraId)

            if (!unlocked) {
              // 要件4: 先（未到達）のワールドは雲で隠す。
              return (
                <div
                  key={eraId}
                  className={styles.cloud}
                  data-testid={`world-cloud-${eraId}`}
                  style={{ left: p.x - 70, top: p.y - 46 }}
                >
                  <span className={styles.cloudGlyph} aria-hidden="true">
                    ☁️
                  </span>
                  <span className={styles.cloudLabel}>？？？</span>
                </div>
              )
            }

            // M2d-01: ワールド単位の進捗要約（面+ボス、全難易度合算）。個別の面の状態は
            // WorldMapScreen 側で判定する（このパネルはタップして入るだけの入口）。
            let clearedNodeCount = 0
            let totalNodeCount = 0
            if (plan.itemCount > 0) {
              for (const difficulty of [1, 2, 3] as const) {
                for (const seg of plan.segments) {
                  totalNodeCount += 1
                  if (getSegmentState(eraProgress, difficulty, seg.segment).cleared) clearedNodeCount += 1
                }
              }
              totalNodeCount += 1 // ボス
              if (eraProgress.boss.cleared) clearedNodeCount += 1
            }

            return (
              <button
                type="button"
                key={eraId}
                className={styles.worldPanel}
                data-testid={`world-block-${eraId}`}
                style={{ left: p.x - 100, top: p.y - 20 }}
                disabled={plan.itemCount === 0}
                onClick={() => onSelectWorld(eraId)}
              >
                <div className={styles.worldName}>
                  W{worldIndex + 1} {era.name}
                </div>
                {plan.itemCount === 0 ? (
                  <p className={styles.empty}>出題できる作品がまだない。</p>
                ) : (
                  <p className={styles.worldProgress} data-testid={`world-progress-${eraId}`}>
                    {clearedNodeCount}/{totalNodeCount} 面クリア ▶
                  </p>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
