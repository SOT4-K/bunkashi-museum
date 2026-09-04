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
    expect(result.version).toBe(3)
    expect(result.items).toEqual({})
    expect(result.missLog).toEqual([])
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

  it('version 1（q4/q6/q8 が無い ItemProgress）を version 2 に上げても既存の進捗は消えない', () => {
    const v1State = {
      version: 1 as const,
      xp: 120,
      level: 2,
      streak: { count: 3, lastDate: '2026-09-02' },
      items: {
        'ashura-kofukuji': {
          q1: { box: 2, due: '2026-09-05', correct: 2, wrong: 0 },
          q2: { box: 0, due: '2026-09-03', correct: 0, wrong: 1 },
          q3: { box: 0, due: '2026-09-03', correct: 0, wrong: 0 },
          discoveredAt: '2026-09-01',
          masteredAt: null,
        },
      },
      bosses: {},
      newToday: { date: '2026-09-03', count: 1 },
    }
    const result = migrate(v1State, '2026-09-03')
    expect(result.version).toBe(3)
    expect(result.xp).toBe(120)
    expect(result.items['ashura-kofukuji'].q1).toEqual(v1State.items['ashura-kofukuji'].q1)
    expect(result.items['ashura-kofukuji'].q4).toBeUndefined() // q4 は初出題まで作らない
    expect(result.missLog).toEqual([]) // v1/v2 データには無いため migrate が補う（M2-23）
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
