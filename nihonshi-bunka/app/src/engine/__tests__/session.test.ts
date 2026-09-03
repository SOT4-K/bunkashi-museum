import { describe, expect, it } from 'vitest'
import {
  NEW_MAX_PER_SESSION,
  REVIEW_MAX,
  buildSession,
  interleaveByEra,
  requeueType,
  selectNewCandidates,
  selectReviewCandidates,
} from '../session'
import { createInitialProgress } from '../progress'
import { createItemProgress } from '../srs'
import type { ProgressState, QuestionType } from '../../types'
import { seededRandom, testEras, testWorks } from './testFixtures'

const today = '2026-09-03'

function progressWithDueItems(workIds: string[]): ProgressState {
  const base = createInitialProgress(today)
  const items = { ...base.items }
  for (const id of workIds) {
    items[id] = createItemProgress('2026-09-01') // due は過去なので今日から見て復習期日超過
  }
  return { ...base, items }
}

describe('selectReviewCandidates', () => {
  it('復習期日が来ている作品のみを返す', () => {
    const progress = progressWithDueItems(['a1', 'a2'])
    const picks = selectReviewCandidates(testWorks, progress, today, seededRandom(1))
    expect(picks.every((p) => ['a1', 'a2'].includes(p.work.id))).toBe(true)
  })

  it('最大7件までしか返さない', () => {
    const progress = progressWithDueItems(testWorks.map((w) => w.id))
    const picks = selectReviewCandidates(testWorks, progress, today, seededRandom(2))
    expect(picks.length).toBeLessThanOrEqual(REVIEW_MAX)
  })

  it('復習期日が来ていなければ0件', () => {
    const base = createInitialProgress(today)
    const items = { ...base.items, a1: createItemProgress('2026-12-01') } // 未来
    const progress = { ...base, items }
    const picks = selectReviewCandidates(testWorks, progress, today, seededRandom(3))
    expect(picks).toHaveLength(0)
  })
})

describe('selectNewCandidates', () => {
  it('未出題の作品だけを返し、q1 から始める', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, progress, 15, 10, seededRandom(4))
    expect(picks.every((p) => p.type === 'q1')).toBe(true)
  })

  it('セッション内上限（5件）を超えない', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, progress, 15, 10, seededRandom(5))
    expect(picks.length).toBeLessThanOrEqual(NEW_MAX_PER_SESSION)
  })

  it('日次残数が上限になる', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, progress, 2, 10, seededRandom(6))
    expect(picks.length).toBeLessThanOrEqual(2)
  })
})

describe('interleaveByEra', () => {
  it('可能な限り同じ時代を連続させない', () => {
    const picks = testWorks.map((w) => ({ work: w, type: 'q1' as QuestionType }))
    const result = interleaveByEra(picks, seededRandom(7))
    let consecutive = 0
    for (let i = 1; i < result.length; i++) {
      if (result[i].work.era === result[i - 1].work.era) consecutive++
    }
    // tenpyo が5件/8件を占めるため完全な非連続は不可能だが、大幅に減っていること
    expect(consecutive).toBeLessThan(result.length - 1)
  })

  it('要素数・内容は変わらない', () => {
    const picks = testWorks.map((w) => ({ work: w, type: 'q1' as QuestionType }))
    const result = interleaveByEra(picks, seededRandom(8))
    expect(result).toHaveLength(picks.length)
    expect(new Set(result.map((p) => p.work.id))).toEqual(new Set(picks.map((p) => p.work.id)))
  })
})

describe('buildSession', () => {
  it('復習と新規をあわせて最大10問を組み立てる', () => {
    const progress = progressWithDueItems(['a1', 'a2', 'a3'])
    const questions = buildSession(testWorks, testEras, progress, today, 15, seededRandom(9))
    expect(questions.length).toBeGreaterThan(0)
    expect(questions.length).toBeLessThanOrEqual(10)
  })

  it('Q2 は choiceEras を、Q1/Q3 は choiceWorks を4件持つ', () => {
    const progress = createInitialProgress(today)
    const questions = buildSession(testWorks, testEras, progress, today, 15, seededRandom(10))
    for (const q of questions) {
      if (q.type === 'q2') {
        expect(q.choiceEras).toHaveLength(4)
      } else {
        expect(q.choiceWorks).toHaveLength(4)
      }
    }
  })

  it('新規が0件許可なら復習のみになる', () => {
    const progress = progressWithDueItems(['a1', 'a2'])
    const questions = buildSession(testWorks, testEras, progress, today, 0, seededRandom(11))
    expect(questions.every((q) => ['a1', 'a2'].includes(q.work.id))).toBe(true)
  })
})

describe('requeueType', () => {
  it('元の型とは異なる型を返す', () => {
    for (let seed = 0; seed < 20; seed++) {
      const type = requeueType('q1', seededRandom(seed))
      expect(type).not.toBe('q1')
    }
  })

  it('q1/q2/q3 のいずれかを返す', () => {
    const type = requeueType('q2', seededRandom(1))
    expect(['q1', 'q3']).toContain(type)
  })
})
