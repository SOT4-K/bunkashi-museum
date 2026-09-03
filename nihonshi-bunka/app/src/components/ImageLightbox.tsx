import { useEffect, useRef, useState } from 'react'
import styles from './ImageLightbox.module.css'
import { CloseIcon } from './icons'
import {
  clampTranslate,
  isDoubleTap,
  isTap,
  nextDoubleTapScale,
  scaleFromPinch,
  scaleFromWheel,
  shouldCloseOnSwipeUp,
  type Point,
} from '../engine/lightbox'

/**
 * 画像の全画面ポップアップ。出題中（answer hint を増やさないため mono=true）と
 * 解説・図鑑（カラー）の両方から使う共通コンポーネント。
 * ピンチズーム・ダブルタップズーム・ドラッグ移動は Pointer Events を自前実装
 * （ライブラリを増やさない。タップ判定・ズーム量の計算は engine/lightbox.ts の純関数）。
 * 開閉のアニメーション・タップ後の慣性なしのスナップは CSS 側の
 * transition/animation に任せ、prefers-reduced-motion は index.css のグローバル規則
 * （*, *::before, *::after の animation/transition duration を 0.001ms にする）で
 * 自動的に無効化される。
 */
export function ImageLightbox({
  src,
  alt,
  mono = false,
  title,
  onClose,
}: {
  src: string
  alt: string
  mono?: boolean
  /** 下に出す作品名。null/undefined なら出さない（出題中はヒントを増やさないため渡さない） */
  title?: string | null
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<Point>({ x: 0, y: 0 })
  const [gesturing, setGesturing] = useState(false)

  const stageRef = useRef<HTMLDivElement | null>(null)
  const pointersRef = useRef<Map<number, Point>>(new Map())
  const pinchRef = useRef<{ startDistance: number; startScale: number } | null>(null)
  const dragRef = useRef<{ start: Point; startTranslate: Point; startScale: number } | null>(null)
  const tapStartRef = useRef<Point | null>(null)
  const lastTapRef = useRef<{ time: number; point: Point } | null>(null)
  const singleTapTimerRef = useRef<number | null>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeNow()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function containerSize() {
    const rect = stageRef.current?.getBoundingClientRect()
    return { width: rect?.width ?? 0, height: rect?.height ?? 0 }
  }

  function twoPointers(): [Point, Point] | null {
    if (pointersRef.current.size !== 2) return null
    const [a, b] = [...pointersRef.current.values()]
    return [a, b]
  }

  function closeNow() {
    if (singleTapTimerRef.current) {
      window.clearTimeout(singleTapTimerRef.current)
      singleTapTimerRef.current = null
    }
    onClose()
  }

  function toggleZoomAt(_point: Point) {
    const next = nextDoubleTapScale(scale)
    setScale(next)
    // ダブルタップの起点に厳密に寄せる計算はせず、単純に中央基準でリセットする
    // （自前実装可、の指示の範囲での簡略化）
    setTranslate({ x: 0, y: 0 })
  }

  function handlePointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    setGesturing(true)

    if (pointersRef.current.size === 2) {
      const pts = twoPointers()
      if (pts) {
        pinchRef.current = { startDistance: distanceOf(pts), startScale: scale }
      }
      dragRef.current = null
    } else if (pointersRef.current.size === 1) {
      tapStartRef.current = { x: e.clientX, y: e.clientY }
      dragRef.current = { start: { x: e.clientX, y: e.clientY }, startTranslate: translate, startScale: scale }
    }
  }

  function distanceOf([a, b]: [Point, Point]) {
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = twoPointers()
      if (!pts) return
      const currentDistance = distanceOf(pts)
      const newScale = scaleFromPinch(pinchRef.current.startScale, pinchRef.current.startDistance, currentDistance)
      setScale(newScale)
      setTranslate((prev) => clampTranslate(prev, newScale, containerSize()))
      return
    }

    if (pointersRef.current.size === 1 && dragRef.current) {
      const point = { x: e.clientX, y: e.clientY }
      const dx = point.x - dragRef.current.start.x
      const dy = point.y - dragRef.current.start.y
      if (scale > 1) {
        const next = {
          x: dragRef.current.startTranslate.x + dx,
          y: dragRef.current.startTranslate.y + dy,
        }
        setTranslate(clampTranslate(next, scale, containerSize()))
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const wasSinglePointer = pointersRef.current.size === 1
    const start = tapStartRef.current
    const drag = dragRef.current
    pointersRef.current.delete(e.pointerId)

    if (pointersRef.current.size === 0) {
      setGesturing(false)
      pinchRef.current = null
    }

    if (wasSinglePointer && start && drag) {
      const end = { x: e.clientX, y: e.clientY }
      const deltaY = end.y - drag.start.y

      if (scale <= 1 && shouldCloseOnSwipeUp(deltaY, scale)) {
        dragRef.current = null
        tapStartRef.current = null
        closeNow()
        return
      }

      if (isTap(start, end)) {
        const now = performance.now()
        if (isDoubleTap(lastTapRef.current, now, end)) {
          lastTapRef.current = null
          if (singleTapTimerRef.current) {
            window.clearTimeout(singleTapTimerRef.current)
            singleTapTimerRef.current = null
          }
          toggleZoomAt(end)
        } else {
          lastTapRef.current = { time: now, point: end }
          singleTapTimerRef.current = window.setTimeout(() => {
            singleTapTimerRef.current = null
            onClose()
          }, 260)
        }
      }
    }

    dragRef.current = null
    tapStartRef.current = null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const newScale = scaleFromWheel(scale, e.deltaY)
    setScale(newScale)
    setTranslate((prev) => clampTranslate(prev, newScale, containerSize()))
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={`${alt}の拡大表示`}>
      <button type="button" className={styles.closeButton} onClick={closeNow} aria-label="閉じる" data-testid="lightbox-close">
        <CloseIcon />
      </button>
      <div
        ref={stageRef}
        className={styles.stage}
        data-testid="lightbox"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className={`${styles.imageWrap} ${mono ? styles.mono : ''} ${gesturing ? styles.noTransition : ''}`}
          style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})` }}
        >
          <img src={src} alt={alt} data-testid="lightbox-image" draggable={false} />
        </div>
      </div>
      {title != null && <div className={`${styles.caption} caption-bold`}>{title}</div>}
    </div>
  )
}
