import { describe, expect, it } from 'vitest'
import {
  clampScale,
  clampTranslate,
  distance,
  isDoubleTap,
  isTap,
  midpoint,
  nextDoubleTapScale,
  scaleFromPinch,
  scaleFromWheel,
  shouldCloseOnSwipeUp,
} from '../lightbox'

describe('clampScale', () => {
  it('範囲内はそのまま返す', () => {
    expect(clampScale(2)).toBe(2)
  })
  it('最小値未満は最小値に丸める', () => {
    expect(clampScale(0.2, 1, 4)).toBe(1)
  })
  it('最大値超は最大値に丸める', () => {
    expect(clampScale(10, 1, 4)).toBe(4)
  })
})

describe('distance / midpoint', () => {
  it('distance: 3-4-5 の直角三角形', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
  it('midpoint: 2点の中間座標', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 })).toEqual({ x: 5, y: 10 })
  })
})

describe('scaleFromPinch', () => {
  it('指が離れる（拡大）と scale が増える', () => {
    const s = scaleFromPinch(1, 100, 200)
    expect(s).toBe(2)
  })
  it('指が近づく（縮小）と scale が減る', () => {
    const s = scaleFromPinch(2, 200, 100)
    expect(s).toBe(1)
  })
  it('上限を超えない', () => {
    const s = scaleFromPinch(1, 100, 1000, 1, 4)
    expect(s).toBe(4)
  })
  it('下限を下回らない', () => {
    const s = scaleFromPinch(1, 100, 1, 1, 4)
    expect(s).toBe(1)
  })
  it('startDistance が 0 以下なら startScale をそのまま（0除算を避ける）', () => {
    expect(scaleFromPinch(1.5, 0, 200)).toBe(1.5)
  })
})

describe('scaleFromWheel', () => {
  it('deltaY が負（ズームイン方向）で scale が増える', () => {
    expect(scaleFromWheel(1, -100)).toBeGreaterThan(1)
  })
  it('deltaY が正（ズームアウト方向）で scale が減る', () => {
    expect(scaleFromWheel(2, 100)).toBeLessThan(2)
  })
  it('範囲を超えない', () => {
    expect(scaleFromWheel(1, -100000, 1, 4)).toBe(4)
    expect(scaleFromWheel(4, 100000, 1, 4)).toBe(1)
  })
})

describe('nextDoubleTapScale', () => {
  it('等倍のときはズーム倍率に切り替える', () => {
    expect(nextDoubleTapScale(1, 2)).toBe(2)
  })
  it('拡大中は等倍に戻す', () => {
    expect(nextDoubleTapScale(2.5, 2)).toBe(1)
  })
})

describe('isDoubleTap', () => {
  it('直前のタップが無ければ false', () => {
    expect(isDoubleTap(null, 1000, { x: 0, y: 0 })).toBe(false)
  })
  it('300ms 以内・近い位置なら true', () => {
    const prev = { time: 1000, point: { x: 100, y: 100 } }
    expect(isDoubleTap(prev, 1200, { x: 105, y: 102 })).toBe(true)
  })
  it('間隔が空きすぎたら false', () => {
    const prev = { time: 1000, point: { x: 100, y: 100 } }
    expect(isDoubleTap(prev, 1500, { x: 100, y: 100 })).toBe(false)
  })
  it('位置が離れすぎたら false', () => {
    const prev = { time: 1000, point: { x: 100, y: 100 } }
    expect(isDoubleTap(prev, 1100, { x: 300, y: 300 })).toBe(false)
  })
})

describe('isTap', () => {
  it('ほぼ動いていなければタップ', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true)
  })
  it('大きく動いたらタップではない（ドラッグ）', () => {
    expect(isTap({ x: 10, y: 10 }, { x: 100, y: 10 })).toBe(false)
  })
})

describe('shouldCloseOnSwipeUp', () => {
  it('等倍で十分上にスワイプしたら閉じる', () => {
    expect(shouldCloseOnSwipeUp(-100, 1)).toBe(true)
  })
  it('スワイプ量が閾値未満なら閉じない', () => {
    expect(shouldCloseOnSwipeUp(-10, 1)).toBe(false)
  })
  it('ズーム中はスワイプで閉じない（パン優先）', () => {
    expect(shouldCloseOnSwipeUp(-100, 2)).toBe(false)
  })
  it('下方向スワイプでは閉じない', () => {
    expect(shouldCloseOnSwipeUp(100, 1)).toBe(false)
  })
})

describe('clampTranslate', () => {
  it('等倍のときは常に (0, 0)', () => {
    expect(clampTranslate({ x: 50, y: 50 }, 1, { width: 300, height: 400 })).toEqual({ x: 0, y: 0 })
  })
  it('ズーム中は範囲内ならそのまま', () => {
    const t = clampTranslate({ x: 10, y: 10 }, 2, { width: 300, height: 400 })
    expect(t).toEqual({ x: 10, y: 10 })
  })
  it('ズーム中に範囲を超えたら境界に丸める', () => {
    const t = clampTranslate({ x: 1000, y: -1000 }, 2, { width: 300, height: 400 })
    expect(t.x).toBe(150) // (300*(2-1))/2
    expect(t.y).toBe(-200) // (400*(2-1))/2
  })
})
