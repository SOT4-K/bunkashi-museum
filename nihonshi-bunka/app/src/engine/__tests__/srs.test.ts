import { describe, expect, it } from 'vitest'
import {
  addDays,
  applyAnswer,
  applyItemAnswer,
  createCell,
  createItemProgress,
  dueTypes,
  isDue,
  isItemMastered,
  nextDue,
} from '../srs'

describe('addDays / nextDue', () => {
  it('日数を正しく加算する（月またぎ）', () => {
    expect(addDays('2026-09-30', 3)).toBe('2026-10-03')
  })

  it('箱0は当日、箱1は翌日、箱5は30日後', () => {
    expect(nextDue(0, '2026-09-03')).toBe('2026-09-03')
    expect(nextDue(1, '2026-09-03')).toBe('2026-09-04')
    expect(nextDue(5, '2026-09-03')).toBe('2026-10-03')
  })
})

describe('applyAnswer', () => {
  it('正解で箱が1つ上がる', () => {
    const cell = createCell('2026-09-03')
    const next = applyAnswer(cell, 'correct', '2026-09-03')
    expect(next.box).toBe(1)
    expect(next.correct).toBe(1)
    expect(next.due).toBe('2026-09-04')
  })

  it('不正解で箱が0に戻る', () => {
    const cell = { box: 3, due: '2026-09-01', correct: 3, wrong: 0 }
    const next = applyAnswer(cell, 'incorrect', '2026-09-03')
    expect(next.box).toBe(0)
    expect(next.wrong).toBe(1)
    expect(next.due).toBe('2026-09-03')
  })

  it('「わからない」(unknown) も不正解と同じく箱が0に戻り、correctは増えない', () => {
    const cell = { box: 3, due: '2026-09-01', correct: 3, wrong: 0 }
    const next = applyAnswer(cell, 'unknown', '2026-09-03')
    expect(next.box).toBe(0)
    expect(next.correct).toBe(3)
    expect(next.due).toBe('2026-09-03')
  })

  it('箱は5を超えない', () => {
    const cell = { box: 5, due: '2026-09-01', correct: 10, wrong: 0 }
    const next = applyAnswer(cell, 'correct', '2026-09-03')
    expect(next.box).toBe(5)
  })
})

describe('isDue / dueTypes', () => {
  it('due が今日以前なら true', () => {
    expect(isDue({ box: 1, due: '2026-09-01', correct: 0, wrong: 0 }, '2026-09-03')).toBe(true)
    expect(isDue({ box: 1, due: '2026-09-05', correct: 0, wrong: 0 }, '2026-09-03')).toBe(false)
  })

  it('復習期日が来ている方向だけを返す', () => {
    const item = createItemProgress('2026-09-01')
    const types = dueTypes(item, '2026-09-01')
    expect(types.sort()).toEqual(['q1', 'q2', 'q3'])
  })
})

describe('isItemMastered / applyItemAnswer', () => {
  it('3方向とも箱4以上でないと習熟にならない', () => {
    let item = createItemProgress('2026-09-01')
    expect(isItemMastered(item)).toBe(false)
    for (let i = 0; i < 4; i++) item = applyItemAnswer(item, 'q1', 'correct', '2026-09-01')
    expect(isItemMastered(item)).toBe(false) // q2, q3 はまだ0
  })

  it('discoveredAt は初回正解時に一度だけセットされる', () => {
    let item = createItemProgress('2026-09-01')
    expect(item.discoveredAt).toBeNull()
    item = applyItemAnswer(item, 'q1', 'correct', '2026-09-01')
    expect(item.discoveredAt).toBe('2026-09-01')
    item = applyItemAnswer(item, 'q1', 'incorrect', '2026-09-05')
    expect(item.discoveredAt).toBe('2026-09-01') // 上書きされない
  })

  it('3方向すべてが箱4以上になった時点で masteredAt がセットされる', () => {
    let item = createItemProgress('2026-09-01')
    for (let i = 0; i < 4; i++) item = applyItemAnswer(item, 'q1', 'correct', '2026-09-01')
    for (let i = 0; i < 4; i++) item = applyItemAnswer(item, 'q2', 'correct', '2026-09-01')
    expect(item.masteredAt).toBeNull()
    for (let i = 0; i < 4; i++) item = applyItemAnswer(item, 'q3', 'correct', '2026-09-01')
    expect(isItemMastered(item)).toBe(true)
    expect(item.masteredAt).toBe('2026-09-01')
  })
})
