import { describe, expect, it } from 'vitest'
import {
  XP_BOSS_CLEAR,
  XP_CORRECT,
  XP_REVIEW_CORRECT,
  createInitialProgress,
  dailyNewRemaining,
  migrate,
  recordAnswer,
  recordStageResult,
  updateStreak,
} from '../progress'

describe('createInitialProgress / migrate', () => {
  it('壊れたデータは初期状態にフォールバックする', () => {
    const result = migrate({ nonsense: true }, '2026-09-03')
    expect(result.version).toBe(4)
    expect(result.items).toEqual({})
    expect(result.missLog).toEqual([])
    expect(result.stages).toEqual({})
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
    expect(result.version).toBe(4)
    expect(result.xp).toBe(120)
    expect(result.items['ashura-kofukuji'].q1).toEqual(v1State.items['ashura-kofukuji'].q1)
    expect(result.items['ashura-kofukuji'].q4).toBeUndefined() // q4 は初出題まで作らない
    expect(result.missLog).toEqual([]) // v1/v2 データには無いため migrate が補う（M2-23）
    expect(result.stages).toEqual({}) // v1〜v3 データには無いため migrate が補う（M2b-01）
  })

  it('M2b-01: version 3（stages が無い）データを読んでも既存の進捗（xp・items）は消えない', () => {
    const v3State = {
      version: 3 as const,
      xp: 250,
      level: 3,
      streak: { count: 5, lastDate: '2026-09-06' },
      items: {
        'ashura-kofukuji': {
          q1: { box: 3, due: '2026-09-10', correct: 3, wrong: 0 },
          q2: { box: 0, due: '2026-09-03', correct: 0, wrong: 1 },
          q3: { box: 0, due: '2026-09-03', correct: 0, wrong: 0 },
          discoveredAt: '2026-09-01',
          masteredAt: null,
        },
      },
      bosses: {},
      newToday: { date: '2026-09-06', count: 1 },
      missLog: [],
    }
    const result = migrate(v3State, '2026-09-07')
    expect(result.version).toBe(4)
    expect(result.xp).toBe(250)
    expect(result.items['ashura-kofukuji'].q1.correct).toBe(3)
    expect(result.stages).toEqual({}) // v3 データには無いため補う
  })

  it('M2b-01: 現行 version（stages 持ち）のデータは stages ごとそのまま通る', () => {
    const state = {
      ...createInitialProgress('2026-09-07'),
      stages: {
        tenpyo: {
          s1: { cleared: true, bestScore: 9, clearedAt: '2026-09-06' },
          s2: { cleared: false, bestScore: 3, clearedAt: null },
          s3: { cleared: false, bestScore: 0, clearedAt: null },
          boss: { cleared: false, bestScore: 0, clearedAt: null },
        },
      },
    }
    const result = migrate(state, '2026-09-07')
    expect(result.stages).toEqual(state.stages)
  })

  it('reviewer指摘M2b-99軽1の回帰: eraごとに一部の段しか無い（s1のみ等）stagesを補完し、s2/s3/bossの欠落でアクセスエラーにならない', () => {
    const state = {
      ...createInitialProgress('2026-09-07'),
      stages: {
        tenpyo: { s1: { cleared: true, bestScore: 9, clearedAt: '2026-09-06' } },
      },
    }
    const result = migrate(state, '2026-09-07')
    expect(result.stages.tenpyo.s1).toEqual({ cleared: true, bestScore: 9, clearedAt: '2026-09-06' })
    expect(result.stages.tenpyo.s2).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
    expect(result.stages.tenpyo.s3).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
    expect(result.stages.tenpyo.boss).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
  })
})

describe('recordStageResult（M2b-01: ステージ／ボスの結果記録）', () => {
  it('ceil(0.9×問数) 以上正解で cleared になる（10問中9問=クリア、8問=未クリア）', () => {
    const state = createInitialProgress('2026-09-07')
    const cleared = recordStageResult(state, 'tenpyo', 's1', 9, 10, '2026-09-07')
    expect(cleared.stages.tenpyo.s1.cleared).toBe(true)
    expect(cleared.stages.tenpyo.s1.clearedAt).toBe('2026-09-07')

    const notCleared = recordStageResult(state, 'tenpyo', 's1', 8, 10, '2026-09-07')
    expect(notCleared.stages.tenpyo.s1.cleared).toBe(false)
    expect(notCleared.stages.tenpyo.s1.clearedAt).toBeNull()
  })

  it('reviewer指摘M2b-99中1の修正後: 5問ステージは4問正解（1ミスまで）でクリアになる', () => {
    const state = createInitialProgress('2026-09-07')
    expect(recordStageResult(state, 'tenpyo', 's2', 3, 5, '2026-09-07').stages.tenpyo.s2.cleared).toBe(false)
    expect(recordStageResult(state, 'tenpyo', 's2', 4, 5, '2026-09-07').stages.tenpyo.s2.cleared).toBe(true)
  })

  it('一度クリアしたら再挑戦して未達でも cleared は false に戻らない（bestScore・clearedAt は据え置き）', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', 's1', 10, 10, '2026-09-01')
    expect(state.stages.tenpyo.s1.cleared).toBe(true)
    state = recordStageResult(state, 'tenpyo', 's1', 3, 10, '2026-09-02')
    expect(state.stages.tenpyo.s1.cleared).toBe(true)
    expect(state.stages.tenpyo.s1.bestScore).toBe(10) // 再挑戦の3より高いベストを維持
    expect(state.stages.tenpyo.s1.clearedAt).toBe('2026-09-01') // 未達の再挑戦では更新されない
  })

  it('bestScore は自己ベスト（高い方）を保持する', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', 's1', 6, 10, '2026-09-01')
    state = recordStageResult(state, 'tenpyo', 's1', 8, 10, '2026-09-02')
    expect(state.stages.tenpyo.s1.bestScore).toBe(8)
    state = recordStageResult(state, 'tenpyo', 's1', 7, 10, '2026-09-03')
    expect(state.stages.tenpyo.s1.bestScore).toBe(8) // 下がった挑戦では更新しない
  })

  it('他のステージ・他の文化の状態を巻き込まない', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', 's1', 10, 10, '2026-09-01')
    state = recordStageResult(state, 'tenpyo', 's2', 1, 10, '2026-09-01')
    state = recordStageResult(state, 'hakuho', 's1', 1, 10, '2026-09-01')
    expect(state.stages.tenpyo.s1.cleared).toBe(true)
    expect(state.stages.tenpyo.s2.cleared).toBe(false)
    expect(state.stages.hakuho.s1.cleared).toBe(false)
  })

  it('ボスを初めてクリアすると XP_BOSS_CLEAR が加算される（通常ステージはボーナスXPが無い）', () => {
    const state = createInitialProgress('2026-09-07')
    const bossCleared = recordStageResult(state, 'tenpyo', 'boss', 9, 10, '2026-09-07')
    expect(bossCleared.xp).toBe(XP_BOSS_CLEAR)

    const stageCleared = recordStageResult(state, 'tenpyo', 's1', 10, 10, '2026-09-07')
    expect(stageCleared.xp).toBe(0)
  })

  it('ボスを2回目以降クリアしても XP_BOSS_CLEAR は重複加算されない', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', 'boss', 9, 10, '2026-09-01')
    expect(state.xp).toBe(XP_BOSS_CLEAR)
    state = recordStageResult(state, 'tenpyo', 'boss', 10, 10, '2026-09-02')
    expect(state.xp).toBe(XP_BOSS_CLEAR) // 変化なし
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
