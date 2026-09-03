import { describe, expect, it } from 'vitest'
import {
  NEW_MAX_PER_SESSION,
  REVIEW_MAX,
  buildQuestion,
  buildQuestionOrFallback,
  buildSession,
  canGenerateType,
  interleaveByEra,
  requeueType,
  selectNewCandidates,
  selectReviewCandidates,
} from '../session'
import { createInitialProgress } from '../progress'
import { createItemProgress } from '../srs'
import type { Era, ProgressState, QuestionType } from '../../types'
import { makeWork, seededRandom, testEras, testWorks } from './testFixtures'

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
  // 2026-09-04 仕様変更（オーナー方針: Q4 中心のアプリなので新規出題を q1 固定にしない）。
  // testWorks は facts/artist/patron が無く testEras も items が無いため、
  // 新規で選べるのは常に生成できる q1/q2 のみになる（q4/q6/q8 は生成不可なので候補から外れる）。
  it('未出題の作品だけを返し、型は q1/q2 のいずれか（q3 は名前を知らないので出さない）', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, testEras, progress, 15, 10, seededRandom(4))
    expect(picks.every((p) => ['q1', 'q2'].includes(p.type))).toBe(true)
  })

  it('型が q1 に偏らない（生成可能な複数の型から重み付きで選ばれる）', () => {
    const progress = createInitialProgress(today)
    const seenTypes = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const picks = selectNewCandidates(testWorks, testEras, progress, 15, 10, seededRandom(seed))
      for (const p of picks) seenTypes.add(p.type)
    }
    expect(seenTypes.has('q2')).toBe(true)
  })

  it('work が q4/q6/q8 を生成できるときは新規出題でも選ばれうる', () => {
    const rich = makeWork({
      id: 'rich',
      era: 'tenpyo',
      artist: '誰か',
      style: '何か',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
      ],
    })
    const richPool = [
      rich,
      makeWork({ id: 'r2', era: 'tenpyo', artist: '誰か2', style: '何か2' }),
      makeWork({ id: 'r3', era: 'tenpyo', artist: '誰か3', style: '何か3' }),
    ]
    const richEras: Era[] = [
      { id: 'tenpyo', name: '天平文化', period: '', order: 1, summary: '', detail: '', items: [{ text: 'X', category: 'other' }] },
    ]
    const progress = createInitialProgress(today)
    const seenTypes = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      const picks = selectNewCandidates(richPool, richEras, progress, 15, 10, seededRandom(seed))
      for (const p of picks) seenTypes.add(p.type)
    }
    expect(seenTypes.has('q4')).toBe(true)
    expect(seenTypes.has('q3')).toBe(false) // 新規では q3 を出さない
  })

  it('セッション内上限（5件）を超えない', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, testEras, progress, 15, 10, seededRandom(5))
    expect(picks.length).toBeLessThanOrEqual(NEW_MAX_PER_SESSION)
  })

  it('日次残数が上限になる', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, testEras, progress, 2, 10, seededRandom(6))
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
  // 2026-09-04 仕様変更: q1〜q8 の範囲に拡張し、work が生成できる型（+ 元の型を除く）から重み付きで選ぶ。
  const work = testWorks[0] // facts/artist/patron 無し・testEras は items 無し → q4/q6/q8 は生成不可

  it('元の型とは異なる型を返す（testWorks では生成可能なのが q1/q2/q3 のみ）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const type = requeueType('q1', work, testWorks, testEras, seededRandom(seed))
      expect(type).not.toBe('q1')
      expect(['q2', 'q3']).toContain(type)
    }
  })

  it('q1/q3 のいずれかを返す（元が q2 のとき）', () => {
    const type = requeueType('q2', work, testWorks, testEras, seededRandom(1))
    expect(['q1', 'q3']).toContain(type)
  })

  it('work が q4 を生成できるなら、元の型と違えば q4 が選ばれうる', () => {
    const rich = makeWork({
      id: 'rich2',
      era: 'tenpyo',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
      ],
    })
    const seen = new Set<string>()
    for (let seed = 0; seed < 30; seed++) {
      seen.add(requeueType('q1', rich, [rich], testEras, seededRandom(seed)))
    }
    expect(seen.has('q4')).toBe(true)
    expect(seen.has('q1')).toBe(false) // 元の型は除外される
  })
})

describe('canGenerateType', () => {
  it('q1/q2/q3 は常に生成可能扱い', () => {
    const w = testWorks[0]
    expect(canGenerateType('q1', w, testWorks, testEras)).toBe(true)
    expect(canGenerateType('q2', w, testWorks, testEras)).toBe(true)
    expect(canGenerateType('q3', w, testWorks, testEras)).toBe(true)
  })

  it('facts/artist/patron/era.items が無い作品では q4/q6/q8 は生成不可', () => {
    const w = testWorks[0] // testFixtures の既定値は facts:[]・artist/patron:null、testEras の items:[]
    expect(canGenerateType('q4', w, testWorks, testEras)).toBe(false)
    expect(canGenerateType('q6', w, testWorks, testEras)).toBe(false)
    expect(canGenerateType('q8', w, testWorks, testEras)).toBe(false)
  })

  it('facts が3件以上あれば q4 は生成可能', () => {
    const w = makeWork({
      id: 'has-facts',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
      ],
    })
    expect(canGenerateType('q4', w, [w], testEras)).toBe(true)
  })
})

describe('buildQuestion / buildQuestionOrFallback（q4/q6/q8）', () => {
  it('データ不足の作品に q4 を指定すると null を返す', () => {
    const w = testWorks[0]
    const result = buildQuestion(w, 'q4', testWorks, testEras, false, seededRandom(1))
    expect(result).toBeNull()
  })

  it('buildQuestionOrFallback は null のとき q1 にフォールバックする', () => {
    const w = testWorks[0]
    const result = buildQuestionOrFallback(w, 'q4', testWorks, testEras, false, seededRandom(1))
    expect(result.type).toBe('q1')
    expect(result.choiceWorks).toHaveLength(4)
  })

  it('facts が揃っている作品では q4 の choiceStatements が4件そろう', () => {
    const w = makeWork({
      id: 'has-facts',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
      ],
    })
    const result = buildQuestion(w, 'q4', [w], testEras, false, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.choiceStatements).toHaveLength(4)
    expect(result!.choiceStatements!.filter((s) => s.correct)).toHaveLength(1)
  })
})

describe('selectReviewCandidates（拡張型 q4/q6/q8 の導入）', () => {
  it('q4 セルがまだ無く、work が q4 を生成できるなら復習候補になりうる', () => {
    const workWithFacts = makeWork({
      id: 'ext1',
      era: 'tenpyo',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
      ],
    })
    const pool = [workWithFacts]
    const base = createInitialProgress(today)
    // q1/q2/q3 はまだ復習期日ではない（未来）が discoveredAt はある＝既出扱いの item
    const item = { ...createItemProgress(today), q1: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 } }
    const progress: ProgressState = { ...base, items: { ext1: item } }
    let sawQ4 = false
    for (let seed = 0; seed < 30; seed++) {
      const picks = selectReviewCandidates(pool, progress, today, seededRandom(seed), testEras)
      if (picks.some((p) => p.type === 'q4')) sawQ4 = true
    }
    expect(sawQ4).toBe(true)
  })

  it('work が q4/q6/q8 のどれも生成できず、q1/q2/q3 も due でなければ復習候補にならない', () => {
    const w = testWorks[0]
    const base = createInitialProgress(today)
    const item = {
      ...createItemProgress(today),
      q1: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
      q2: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
      q3: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
    }
    const progress: ProgressState = { ...base, items: { [w.id]: item } }
    const picks = selectReviewCandidates(testWorks, progress, today, seededRandom(1), testEras)
    expect(picks.find((p) => p.work.id === w.id)).toBeUndefined()
  })
})
