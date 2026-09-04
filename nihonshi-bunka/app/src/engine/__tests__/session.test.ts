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
import type { Era, ProgressState, QuestionType, Work } from '../../types'
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

  it('復習期日が来ていなければ0件（q9 も生成できない単独プールで検証）', () => {
    // testWorks 全体を pool に渡すと、a1 は他時代の同カテゴリ作品があるため
    // q9（時代文化条件）が「まだ出題したことがない＝今すぐ導入してよい」型として拾われる
    // （M2 チケットで新設。era は常に値を持つため、同カテゴリ・他時代の作品が3件あれば
    // 常に生成できる。q4/q6/q8 と同じ「導入」の扱い）。ここでは a1 単独プールにして
    // q9 も生成不可にし、「due な型が無ければ0件」という本来の検証意図を保つ。
    const base = createInitialProgress(today)
    const items = { ...base.items, a1: createItemProgress('2026-12-01') } // 未来
    const progress = { ...base, items }
    const soloPool = testWorks.filter((w) => w.id === 'a1')
    const picks = selectReviewCandidates(soloPool, progress, today, seededRandom(3))
    expect(picks).toHaveLength(0)
  })
})

describe('selectNewCandidates', () => {
  // 2026-09-04 仕様変更（オーナー方針: Q4 中心のアプリなので新規出題を q1 固定にしない）。
  // testWorks は facts/artist/patron が無く testEras も items が無いため、
  // q4/q6/q8 は生成不可。ただし q9（M2 チケットで新設）は era（時代文化）条件だけでも
  // 生成できるため、他時代・同カテゴリの作品が3件以上ある testWorks では候補になりうる。
  it('未出題の作品だけを返し、型は q1/q2/q9 のいずれか（q3 は名前を知らないので出さない）', () => {
    const progress = createInitialProgress(today)
    const picks = selectNewCandidates(testWorks, testEras, progress, 15, 10, seededRandom(4))
    expect(picks.every((p) => ['q1', 'q2', 'q9'].includes(p.type))).toBe(true)
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

  // 修正の仕様（M2-09〜11）: フリー出題（学ぶ）でも Q9 の era 条件は連続させない。
  describe('Q9 の era 条件を連続させない', () => {
    // holder/artist/style/technique を持たず、era でしか Q9 を生成できない作品群（category: garden）。
    // era は testEras の4種を循環させ、どの作品から見ても同カテゴリ・別 era の候補が3件以上ある。
    const eraOnlyEras = ['asuka', 'hakuho', 'tenpyo', 'konin-jogan']
    const eraOnlyPool = Array.from({ length: 8 }, (_, i) =>
      makeWork({ id: `eo${i}`, era: eraOnlyEras[i % eraOnlyEras.length], category: 'garden' }),
    )

    function progressWithoutDueQ1Q2Q3(): ProgressState {
      const base = createInitialProgress(today)
      const items = { ...base.items }
      for (const w of eraOnlyPool) {
        // q1/q2/q3 は未来日付＝復習期日ではない。q4/q6/q8/q9 のセルは無い（未導入）ため、
        // canGenerateType で q9 だけが「導入してよい」候補として拾われる（q4/q6/q8 は生成不可）。
        items[w.id] = {
          ...createItemProgress(today),
          q1: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
          q2: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
          q3: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
        }
      }
      return { ...base, items }
    }

    it('復習候補の due 型が q9 だけになるよう仕込むと、実際に q9(era) だけが選ばれる（テスト前提の確認）', () => {
      const progress = progressWithoutDueQ1Q2Q3()
      const picks = selectReviewCandidates(eraOnlyPool, progress, today, seededRandom(1), testEras)
      expect(picks.length).toBeGreaterThan(0)
      expect(picks.every((p) => p.type === 'q9')).toBe(true)
    })

    it('隣り合う設問が両方とも era 条件の q9 になることはない（seed 0〜49 で確認）', () => {
      const progress = progressWithoutDueQ1Q2Q3()
      for (let seed = 0; seed < 50; seed++) {
        const questions = buildSession(eraOnlyPool, testEras, progress, today, 0, seededRandom(seed))
        for (let i = 1; i < questions.length; i++) {
          const prevIsEraQ9 = questions[i - 1].type === 'q9' && questions[i - 1].q9Slot === 'era'
          const currIsEraQ9 = questions[i].type === 'q9' && questions[i].q9Slot === 'era'
          expect(prevIsEraQ9 && currIsEraQ9).toBe(false)
        }
      }
    })
  })
})

describe('requeueType', () => {
  // 2026-09-04 仕様変更: q1〜q9 の範囲に拡張し、work が生成できる型（+ 元の型を除く）から重み付きで選ぶ。
  // testWorks は facts/artist/patron 無し・testEras は items 無し → q4/q6/q8 は生成不可。
  // q9（M2 チケットで新設）は era 条件だけでも生成できるため候補に入る。
  const work = testWorks[0]

  it('元の型とは異なる型を返す（testWorks では生成可能なのが q1/q2/q3/q9 のみ）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const type = requeueType('q1', work, testWorks, testEras, seededRandom(seed))
      expect(type).not.toBe('q1')
      expect(['q2', 'q3', 'q9']).toContain(type)
    }
  })

  it('q1/q3/q9 のいずれかを返す（元が q2 のとき）', () => {
    const type = requeueType('q2', work, testWorks, testEras, seededRandom(1))
    expect(['q1', 'q3', 'q9']).toContain(type)
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

  // 修正の仕様（M2-09〜11）: buildQuestion に avoidQ9EraSlot オプションを追加。
  describe('buildQuestion の avoidQ9EraSlot オプション', () => {
    // era でしか Q9 を生成できない作品（holder/artist/style/technique 無し）。
    const eraOnlyTarget = makeWork({ id: 'era-only', era: 'tenpyo', category: 'garden' })
    const eraOnlyPool: Work[] = [
      eraOnlyTarget,
      makeWork({ id: 'era-only-2', era: 'hakuho', category: 'garden' }),
      makeWork({ id: 'era-only-3', era: 'asuka', category: 'garden' }),
      makeWork({ id: 'era-only-4', era: 'konin-jogan', category: 'garden' }),
    ]

    it('avoidQ9EraSlot を指定しなければ era 条件の q9 が生成される（前提の確認）', () => {
      const result = buildQuestion(eraOnlyTarget, 'q9', eraOnlyPool, testEras, false, seededRandom(1))
      expect(result).not.toBeNull()
      expect(result!.q9Slot).toBe('era')
    })

    it('avoidQ9EraSlot: true を指定すると、era 以外に条件が無い作品では null になる', () => {
      const result = buildQuestion(eraOnlyTarget, 'q9', eraOnlyPool, testEras, false, seededRandom(1), {
        avoidQ9EraSlot: true,
      })
      expect(result).toBeNull()
    })

    it('buildQuestionOrFallback なら avoidQ9EraSlot で q9 が避けられたとき q1 に落ちる', () => {
      const result = buildQuestionOrFallback(eraOnlyTarget, 'q9', eraOnlyPool, testEras, false, seededRandom(1), {
        avoidQ9EraSlot: true,
      })
      expect(result.type).toBe('q1')
    })
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

  it('work が q4/q6/q8/q9 のどれも生成できず、q1/q2/q3 も due でなければ復習候補にならない', () => {
    const w = testWorks[0]
    // q9（era 条件）は同カテゴリの他作品が pool に無いと生成できない。ここでは w 単独プールにして
    // 「他に生成できる型が無い」ケースを検証する（testWorks 全体を渡すと q9 が候補になる。上のテスト参照）。
    const soloPool = testWorks.filter((x) => x.id === w.id)
    const base = createInitialProgress(today)
    const item = {
      ...createItemProgress(today),
      q1: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
      q2: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
      q3: { box: 1, due: '2099-01-01', correct: 1, wrong: 0 },
    }
    const progress: ProgressState = { ...base, items: { [w.id]: item } }
    const picks = selectReviewCandidates(soloPool, progress, today, seededRandom(1), testEras)
    expect(picks.find((p) => p.work.id === w.id)).toBeUndefined()
  })
})
