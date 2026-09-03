// ImageLightbox の状態計算（ズーム・パン・タップ判定）を UI から切り離した純関数群。
// Pointer Events / touch のハンドラは components/ImageLightbox.tsx 側で、ここの関数を
// 呼ぶだけにする（DOM に依存しないのでテストしやすい）。

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 4
export const DOUBLE_TAP_SCALE = 2

/** scale を [min, max] に収める */
export function clampScale(scale: number, min: number = MIN_SCALE, max: number = MAX_SCALE): number {
  return Math.min(max, Math.max(min, scale))
}

/** 2点間の距離（ピンチの指の間隔） */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** 2点の中点（ピンチの中心） */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * ピンチ操作中の新しい scale。startDistance はピンチ開始時の指の間隔、
 * currentDistance は現在の間隔。startDistance が 0 以下（測定不能）のときは
 * startScale をそのまま返す。
 */
export function scaleFromPinch(
  startScale: number,
  startDistance: number,
  currentDistance: number,
  min: number = MIN_SCALE,
  max: number = MAX_SCALE,
): number {
  if (startDistance <= 0) return clampScale(startScale, min, max)
  return clampScale(startScale * (currentDistance / startDistance), min, max)
}

/**
 * ホイール操作での新しい scale。deltaY が負（上スクロール/ズームイン方向）なら拡大、
 * 正なら縮小する。
 */
export function scaleFromWheel(
  currentScale: number,
  deltaY: number,
  min: number = MIN_SCALE,
  max: number = MAX_SCALE,
  sensitivity: number = 0.0015,
): number {
  const factor = Math.exp(-deltaY * sensitivity)
  return clampScale(currentScale * factor, min, max)
}

/** ダブルタップで次に切り替える scale（等倍なら拡大、拡大中なら等倍に戻す） */
export function nextDoubleTapScale(currentScale: number, zoomedScale: number = DOUBLE_TAP_SCALE): number {
  return currentScale > MIN_SCALE ? MIN_SCALE : zoomedScale
}

/**
 * 直前のタップ（時刻・位置）と今回のタップからダブルタップかどうかを判定する。
 * prev が null（1回目のタップ）なら false。
 */
export function isDoubleTap(
  prev: { time: number; point: Point } | null,
  time: number,
  point: Point,
  maxDelayMs: number = 300,
  maxDistancePx: number = 32,
): boolean {
  if (!prev) return false
  if (time - prev.time > maxDelayMs) return false
  return distance(prev.point, point) <= maxDistancePx
}

/**
 * pointerdown〜pointerup の移動量から「タップ」（ドラッグではない）かどうかを判定する。
 * ズーム中のドラッグや上スワイプと区別するために使う。
 */
export function isTap(start: Point, end: Point, thresholdPx: number = 10): boolean {
  return distance(start, end) <= thresholdPx
}

/**
 * 上スワイプで閉じるべきかどうか。ズーム中（scale > 1）はパン操作を優先するため
 * スワイプでは閉じない。
 */
export function shouldCloseOnSwipeUp(deltaY: number, scale: number, thresholdPx: number = 60): boolean {
  return scale <= MIN_SCALE && deltaY <= -thresholdPx
}

/**
 * ズーム中の画像がコンテナからはみ出しすぎないよう translate を制限する。
 * object-fit: contain で表示した画像がコンテナいっぱいに広がっている前提の簡易実装
 * （自前実装可、の指示どおり厳密なピクセル計算はしない）。scale <= 1 では常に (0, 0)。
 */
export function clampTranslate(translate: Point, scale: number, containerSize: Size): Point {
  if (scale <= MIN_SCALE) return { x: 0, y: 0 }
  const maxX = (containerSize.width * (scale - 1)) / 2
  const maxY = (containerSize.height * (scale - 1)) / 2
  return {
    x: Math.min(maxX, Math.max(-maxX, translate.x)),
    y: Math.min(maxY, Math.max(-maxY, translate.y)),
  }
}
