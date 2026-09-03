import { describe, expect, it } from 'vitest'
import {
  XP_CORRECT,
  XP_REVIEW_CORRECT,
  createInitialProgress,
  dailyNewRemaining,
  migrate,
  recordAnswer,
  updateStreak,
} from '../progress'

describe('createInitialProgress / migrate', () => {
  it('壊れたデータは初期状態にフォールバックする', () => {
    const result = migrate({ nonsense: true }, '2026-09-03')
    expect(result.version).toBe(1)
    expect(result.items).toEqual({})
  })

  it('null/undefined でも例外を投げない', () => {
    expect(() => migrate(null, '2026-09-03')).not.toThrow()
    expect(() => migrate(undefined, '2026-09-03')).not.toThrow()
  })

  it('現行 version のデータはそのまま通す', () => {
    const state = createInitialProgress('2026-09-03')
    const result = migrate(state, '2026-09-03')
    expect(result).toEqual(state)
  })
})

describe('updateStreak', () => {
  it('前日からの継続で+1', () => {
    const state = { ...createInitialProgress('2026-09-02'), streak: { count: 3, lastDate: '2026-09-02' } }
    const next = updateStreak(state, '2026-09-03')
    expect(next.streak.count).toBe(4)
  })

  it('間が空くと1にリセット', () => {
    const state = { ...createInitialProgress('2026-09-01'), streak: { count: 5, lastDate: '2026-09-01' } }
    const next = updateStreak(state, '2026-09-03')
    expect(next.streak.count).toBe(1)
  })

  it('同日内は変化しない', () => {
    const state = { ...createInitialProgress('2026-09-03'), streak: { count: 2, lastDate: '2026-09-03' } }
    const next = updateStreak(state, '2026-09-03')
    expect(next.streak.count).toBe(2)
  })
})

describe('recordAnswer', () => {
  it('新規正解で XP_CORRECT が加算される', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', false, '2026-09-03')
    expect(result.xpGained).toBe(XP_CORRECT)
    expect(result.state.xp).toBe(XP_CORRECT)
    expect(result.isNewDiscovery).toBe(true)
  })

  it('復習正解は XP_REVIEW_CORRECT', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', true, '2026-09-03')
    expect(result.xpGained).toBe(XP_REVIEW_CORRECT)
  })

  it('新規出題は newToday.count を増やす（日次上限計算に反映）', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', false, '2026-09-03')
    expect(dailyNewRemaining(result.state, '2026-09-03', 15)).toBe(14)
  })

  it('「わからない」(unknown) は XP が付かず、発見にもならない', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'unknown', false, '2026-09-03')
    expect(result.xpGained).toBe(0)
    expect(result.state.xp).toBe(0)
    expect(result.isNewDiscovery).toBe(false)
  })
})
