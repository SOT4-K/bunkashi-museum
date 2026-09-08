import { describe, expect, it } from 'vitest'
import {
  EXAM_RECORDS_MAX,
  RETRY_XP_MULTIPLIER,
  STORAGE_VERSION,
  XP_BOSS_CLEAR,
  XP_CORRECT,
  XP_REVIEW_CORRECT,
  acknowledgeResetNotice,
  createInitialProgress,
  dailyNewRemaining,
  migrate,
  recordAnswer,
  recordExamResult,
  recordStageResult,
  updateStreak,
} from '../progress'
import type { MockExamRecord } from '../../types'

describe('createInitialProgress / migrate', () => {
  it('壊れたデータは初期状態にフォールバックする（resetNoticeは立てない＝真の初回と区別できないため）', () => {
    const result = migrate({ nonsense: true }, '2026-09-03')
    expect(result.version).toBe(STORAGE_VERSION)
    expect(result.items).toEqual({})
    expect(result.missLog).toEqual([])
    expect(result.stages).toEqual({})
    expect(result.resetNotice).toBe(false)
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

  it(
    'M2b-04 v2進捗移行テスト: 旧バージョン（version 4、s1/s2/s3/boss固定4マス）のデータを読むと' +
      '全リセットされ、resetNoticeが立つ（decisions.md 2026-09-08「v2公開時に進捗を全リセットする」）',
    () => {
      const v4State = {
        version: 4 as const,
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
        stages: {
          tenpyo: {
            s1: { cleared: true, bestScore: 9, clearedAt: '2026-09-06' },
            s2: { cleared: false, bestScore: 3, clearedAt: null },
            s3: { cleared: false, bestScore: 0, clearedAt: null },
            boss: { cleared: false, bestScore: 0, clearedAt: null },
          },
        },
        newToday: { date: '2026-09-06', count: 1 },
        missLog: [],
      }
      const result = migrate(v4State, '2026-09-09')
      expect(result.version).toBe(STORAGE_VERSION)
      // 全リセット: xp・items・stages すべて初期状態に戻る（旧スキーマの面数体系とは
      // 互換性が無いため、意味のある移行を試みない）。
      expect(result.xp).toBe(0)
      expect(result.items).toEqual({})
      expect(result.stages).toEqual({})
      expect(result.streak).toEqual({ count: 0, lastDate: null })
      expect(result.resetNotice).toBe(true)
    },
  )

  it('v3（missLog無し）・v1（stages自体存在しない）も同様に全リセットされる（v5未満は一律リセット）', () => {
    const v1State = {
      version: 1 as const,
      xp: 120,
      level: 2,
      streak: { count: 3, lastDate: '2026-09-02' },
      items: { a: { q1: { box: 1, due: '2026-09-03', correct: 1, wrong: 0 }, q2: { box: 0, due: '2026-09-03', correct: 0, wrong: 0 }, q3: { box: 0, due: '2026-09-03', correct: 0, wrong: 0 }, discoveredAt: null, masteredAt: null } },
      bosses: {},
      newToday: { date: '2026-09-03', count: 1 },
    }
    const result = migrate(v1State, '2026-09-09')
    expect(result.version).toBe(STORAGE_VERSION)
    expect(result.xp).toBe(0)
    expect(result.resetNotice).toBe(true)
  })

  it('acknowledgeResetNotice: resetNoticeをfalseに戻す（trueでなければ何もしない）', () => {
    const state = { ...createInitialProgress('2026-09-09'), resetNotice: true }
    expect(acknowledgeResetNotice(state).resetNotice).toBe(false)
    const already = createInitialProgress('2026-09-09')
    expect(acknowledgeResetNotice(already)).toEqual(already) // 変化なし（同一参照でなくてもよいが値は同じ）
  })

  it('M2b-04: 現行 version（可変面数のstages持ち）のデータはそのまま通る', () => {
    const state = {
      ...createInitialProgress('2026-09-09'),
      stages: {
        tenpyo: {
          segments: { '1-1': { cleared: true, bestScore: 9, clearedAt: '2026-09-06' } },
          boss: { cleared: false, bestScore: 0, clearedAt: null },
        },
      },
    }
    const result = migrate(state, '2026-09-09')
    expect(result.stages).toEqual(state.stages)
  })

  it('era ごとに一部の面しか無い（segmentsの一部欠落）stagesを補完し、bossの欠落でアクセスエラーにならない', () => {
    const state = {
      ...createInitialProgress('2026-09-09'),
      stages: {
        tenpyo: { segments: { '1-1': { cleared: true, bestScore: 9, clearedAt: '2026-09-06' } } },
      },
    }
    const result = migrate(state, '2026-09-09')
    expect(result.stages.tenpyo.segments['1-1']).toEqual({ cleared: true, bestScore: 9, clearedAt: '2026-09-06' })
    expect(result.stages.tenpyo.boss).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
  })
})

describe('recordStageResult（M2b-04 v2: StageLocalKeyでsegment/bossを指定）', () => {
  it('ceil(0.9×問数) 以上正解で cleared になる（10問中9問=クリア、8問=未クリア）', () => {
    const state = createInitialProgress('2026-09-09')
    const cleared = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 1 }, 9, 10, '2026-09-09')
    expect(cleared.stages.tenpyo.segments['1-1'].cleared).toBe(true)
    expect(cleared.stages.tenpyo.segments['1-1'].clearedAt).toBe('2026-09-09')

    const notCleared = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 1 }, 8, 10, '2026-09-09')
    expect(notCleared.stages.tenpyo.segments['1-1'].cleared).toBe(false)
    expect(notCleared.stages.tenpyo.segments['1-1'].clearedAt).toBeNull()
  })

  it('5問の面（doubled規則相当）は4問正解（1ミスまで）でクリアになる', () => {
    const state = createInitialProgress('2026-09-09')
    const key = { kind: 'segment' as const, difficulty: 2 as const, segment: 1 }
    expect(recordStageResult(state, 'tenpyo', key, 3, 5, '2026-09-09').stages.tenpyo.segments['2-1'].cleared).toBe(false)
    expect(recordStageResult(state, 'tenpyo', key, 4, 5, '2026-09-09').stages.tenpyo.segments['2-1'].cleared).toBe(true)
  })

  it('一度クリアしたら再挑戦して未達でも cleared は false に戻らない（bestScore・clearedAt は据え置き）', () => {
    const key = { kind: 'segment' as const, difficulty: 1 as const, segment: 1 }
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', key, 10, 10, '2026-09-01')
    expect(state.stages.tenpyo.segments['1-1'].cleared).toBe(true)
    state = recordStageResult(state, 'tenpyo', key, 3, 10, '2026-09-02')
    expect(state.stages.tenpyo.segments['1-1'].cleared).toBe(true)
    expect(state.stages.tenpyo.segments['1-1'].bestScore).toBe(10)
    expect(state.stages.tenpyo.segments['1-1'].clearedAt).toBe('2026-09-01')
  })

  it('bestScore は自己ベスト（高い方）を保持する', () => {
    const key = { kind: 'segment' as const, difficulty: 1 as const, segment: 1 }
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', key, 6, 10, '2026-09-01')
    state = recordStageResult(state, 'tenpyo', key, 8, 10, '2026-09-02')
    expect(state.stages.tenpyo.segments['1-1'].bestScore).toBe(8)
    state = recordStageResult(state, 'tenpyo', key, 7, 10, '2026-09-03')
    expect(state.stages.tenpyo.segments['1-1'].bestScore).toBe(8)
  })

  it('他の面（difficulty/segment違い）・他の文化の状態を巻き込まない', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 1 }, 10, 10, '2026-09-01')
    state = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 2, segment: 1 }, 1, 10, '2026-09-01')
    state = recordStageResult(state, 'hakuho', { kind: 'segment', difficulty: 1, segment: 1 }, 1, 10, '2026-09-01')
    expect(state.stages.tenpyo.segments['1-1'].cleared).toBe(true)
    expect(state.stages.tenpyo.segments['2-1'].cleared).toBe(false)
    expect(state.stages.hakuho.segments['1-1'].cleared).toBe(false)
  })

  it('複数面（1-1・1-2）を独立に記録できる（面数が可変になったための回帰）', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 1 }, 10, 10, '2026-09-01')
    state = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 2 }, 3, 10, '2026-09-01')
    expect(state.stages.tenpyo.segments['1-1'].cleared).toBe(true)
    expect(state.stages.tenpyo.segments['1-2'].cleared).toBe(false)
  })

  it('ボスを初めてクリアすると XP_BOSS_CLEAR が加算される（通常の面はボーナスXPが無い）', () => {
    const state = createInitialProgress('2026-09-09')
    const bossCleared = recordStageResult(state, 'tenpyo', { kind: 'boss' }, 9, 10, '2026-09-09')
    expect(bossCleared.xp).toBe(XP_BOSS_CLEAR)

    const stageCleared = recordStageResult(state, 'tenpyo', { kind: 'segment', difficulty: 1, segment: 1 }, 10, 10, '2026-09-09')
    expect(stageCleared.xp).toBe(0)
  })

  it('ボスを2回目以降クリアしても XP_BOSS_CLEAR は重複加算されない', () => {
    let state = createInitialProgress('2026-09-01')
    state = recordStageResult(state, 'tenpyo', { kind: 'boss' }, 9, 10, '2026-09-01')
    expect(state.xp).toBe(XP_BOSS_CLEAR)
    state = recordStageResult(state, 'tenpyo', { kind: 'boss' }, 10, 10, '2026-09-02')
    expect(state.xp).toBe(XP_BOSS_CLEAR)
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

  it('M2b v2「再挑戦はXP半分」: xpMultiplier=RETRY_XP_MULTIPLIER(0.5) で半分のXPになる（丸め）', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', false, '2026-09-03', RETRY_XP_MULTIPLIER)
    expect(result.xpGained).toBe(Math.round(XP_CORRECT * RETRY_XP_MULTIPLIER))
    expect(result.xpGained).toBe(5)
  })

  it('xpMultiplier を省略すると従来どおり等倍（既存呼び出し元は変更なし）', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', false, '2026-09-03')
    expect(result.xpGained).toBe(XP_CORRECT)
  })

  it('xpMultiplier を適用しても SRS・図鑑（discoveredAt）は通常どおり更新される（既定⑤）', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'correct', false, '2026-09-03', RETRY_XP_MULTIPLIER)
    expect(result.isNewDiscovery).toBe(true)
    expect(result.state.items['ashura-kofukuji'].q1.correct).toBe(1)
  })

  it('不正解では xpMultiplier に関わらず0（0 × 何倍しても0）', () => {
    const state = createInitialProgress('2026-09-03')
    const result = recordAnswer(state, 'ashura-kofukuji', 'q1', 'incorrect', false, '2026-09-03', RETRY_XP_MULTIPLIER)
    expect(result.xpGained).toBe(0)
  })
})

describe('recordExamResult（M2b-07: 模試タブの記録）', () => {
  function makeRecord(overrides: Partial<MockExamRecord> = {}): MockExamRecord {
    return { date: '2026-09-08', elapsedSeconds: 120, correct: 15, total: 20, missedWorkIds: [], ...overrides }
  }

  it('examRecords に1件追加する', () => {
    const state = createInitialProgress('2026-09-08')
    const next = recordExamResult(state, makeRecord())
    expect(next.examRecords).toHaveLength(1)
    expect(next.examRecords[0]).toEqual(makeRecord())
  })

  it('EXAM_RECORDS_MAX を超えたら古い方から捨てる', () => {
    let state = createInitialProgress('2026-09-08')
    for (let i = 0; i < EXAM_RECORDS_MAX + 5; i++) {
      state = recordExamResult(state, makeRecord({ date: `record-${i}` }))
    }
    expect(state.examRecords).toHaveLength(EXAM_RECORDS_MAX)
    expect(state.examRecords[0].date).toBe(`record-5`)
    expect(state.examRecords[state.examRecords.length - 1].date).toBe(`record-${EXAM_RECORDS_MAX + 4}`)
  })

  it('他のフィールド（xp・items等）を変更しない', () => {
    const state = createInitialProgress('2026-09-08')
    const next = recordExamResult(state, makeRecord())
    expect(next.xp).toBe(state.xp)
    expect(next.items).toBe(state.items)
  })
})

describe('migrate: examRecords（M2b-07。missLogと同様、version自体は上げず既存データに補う）', () => {
  it('examRecords が無い既存データは [] を補う', () => {
    const state = createInitialProgress('2026-09-08')
    const { examRecords: _drop, ...withoutExamRecords } = state
    const result = migrate(withoutExamRecords, '2026-09-08')
    expect(result.examRecords).toEqual([])
  })

  it('examRecords がある既存データはそのまま通す', () => {
    const record: MockExamRecord = { date: '2026-09-08', elapsedSeconds: 60, correct: 10, total: 20, missedWorkIds: ['a'] }
    const state = { ...createInitialProgress('2026-09-08'), examRecords: [record] }
    const result = migrate(state, '2026-09-08')
    expect(result.examRecords).toEqual([record])
  })
})
