// M2-23: 間違いノート。
import { describe, expect, it } from 'vitest'
import {
  addMiss,
  applyReviewOutcome,
  buildMissReviewQuestion,
  buildMissReviewSession,
  MISS_REVIEW_GRADUATE_STREAK,
  sortMissLogByCulture,
} from '../missLog'
import { makeWork, testEras, seededRandom } from './testFixtures'
import type { MissLogEntry, Work } from '../../types'

describe('addMiss', () => {
  it('新規の作品は1件追加される', () => {
    const log = addMiss([], 'w1', 'q1', '2026-09-04')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ workId: 'w1', type: 'q1', count: 1, correctStreak: 0 })
  })

  it('既存の作品はエントリを増やさず count を増やし、型・日付・文脈を更新する', () => {
    let log = addMiss([], 'w1', 'q1', '2026-09-01')
    log = addMiss(log, 'w1', 'q4', '2026-09-04', 'p1', 'a')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ workId: 'w1', type: 'q4', count: 2, lastMissedAt: '2026-09-04', passageId: 'p1', underlineKey: 'a' })
  })

  it('復習中に一度でも正解した後に再度間違えても correctStreak は0に戻る', () => {
    let log = addMiss([], 'w1', 'q1', '2026-09-01')
    log = applyReviewOutcome(log, 'w1', true) // streak=1
    log = addMiss(log, 'w1', 'q1', '2026-09-05')
    expect(log[0].correctStreak).toBe(0)
  })
})

describe('applyReviewOutcome', () => {
  it(`${MISS_REVIEW_GRADUATE_STREAK}回連続正解でノートから外れる`, () => {
    let log: MissLogEntry[] = addMiss([], 'w1', 'q1', '2026-09-01')
    log = applyReviewOutcome(log, 'w1', true)
    expect(log).toHaveLength(1) // 1回目はまだ残る
    log = applyReviewOutcome(log, 'w1', true)
    expect(log).toHaveLength(0) // 2回連続で外れる
  })

  it('不正解が挟まると streak が0に戻る（連続でなければ外れない）', () => {
    let log: MissLogEntry[] = addMiss([], 'w1', 'q1', '2026-09-01')
    log = applyReviewOutcome(log, 'w1', true)
    log = applyReviewOutcome(log, 'w1', false)
    expect(log[0].correctStreak).toBe(0)
    log = applyReviewOutcome(log, 'w1', true)
    expect(log).toHaveLength(1)
  })

  it('存在しない workId は何もしない', () => {
    const log = addMiss([], 'w1', 'q1', '2026-09-01')
    expect(applyReviewOutcome(log, 'nope', true)).toEqual(log)
  })
})

describe('sortMissLogByCulture', () => {
  it('時代順（order）→ 同一時代内は最後に間違えた日が新しい順', () => {
    const w1 = makeWork({ id: 'w1', era: 'hakuho' }) // order 2
    const w2 = makeWork({ id: 'w2', era: 'asuka' }) // order 1
    const w3 = makeWork({ id: 'w3', era: 'asuka' })
    const worksById = { w1, w2, w3 }
    const log: MissLogEntry[] = [
      { workId: 'w1', type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 },
      { workId: 'w2', type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 },
      { workId: 'w3', type: 'q1', lastMissedAt: '2026-09-05', count: 1, correctStreak: 0 },
    ]
    const sorted = sortMissLogByCulture(log, worksById, testEras)
    expect(sorted.map((e) => e.workId)).toEqual(['w3', 'w2', 'w1'])
  })
})

describe('buildMissReviewQuestion', () => {
  const artifactWork = makeWork({
    id: 'aw1',
    era: 'tenpyo',
    artist: '定朝',
    patron: '藤原頼通',
    facts: [{ slot: 'artist', text: '定朝の作' }],
    falseStatements: [{ text: '運慶の作', why: 'x', verifiedFalse: true }],
  })
  const pool: Work[] = [
    artifactWork,
    makeWork({ id: 'aw2', era: 'tenpyo' }),
    makeWork({ id: 'aw3', era: 'hakuho' }),
    makeWork({ id: 'aw4', era: 'asuka' }),
  ]

  it('直近と違う型を選ぶ（可能なとき）', () => {
    const entry: MissLogEntry = { workId: artifactWork.id, type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 }
    const q = buildMissReviewQuestion(entry, artifactWork, pool, pool, testEras, seededRandom(1))
    expect(q).not.toBeNull()
    expect(q!.type).not.toBe('q1')
  })

  it('画像を持たない対象（kind: person）には画像が要る型を使わない', () => {
    const textWork = makeWork({
      id: 'tw1',
      era: 'tenpyo',
      kind: 'person',
      facts: [{ slot: 'other', text: '何かの記述' }],
    })
    const textPool: Work[] = [textWork, makeWork({ id: 'tw2', era: 'tenpyo', kind: 'text' })]
    const entry: MissLogEntry = { workId: textWork.id, type: 'q4', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 }
    const q = buildMissReviewQuestion(entry, textWork, textPool, [], testEras, seededRandom(2))
    if (q) {
      expect(['q1', 'q2', 'q3', 'q9']).not.toContain(q.type)
    }
  })
})

describe('buildMissReviewSession', () => {
  it('最後に間違えた日が古い順に、最大 max 問を組み立てる', () => {
    const w1 = makeWork({ id: 'w1', era: 'tenpyo' })
    const w2 = makeWork({ id: 'w2', era: 'hakuho' })
    const w3 = makeWork({ id: 'w3', era: 'asuka' })
    const pool = [w1, w2, w3]
    const worksById = { w1, w2, w3 }
    const log: MissLogEntry[] = [
      { workId: 'w2', type: 'q1', lastMissedAt: '2026-09-03', count: 1, correctStreak: 0 },
      { workId: 'w1', type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 },
      { workId: 'w3', type: 'q1', lastMissedAt: '2026-09-05', count: 1, correctStreak: 0 },
    ]
    const session = buildMissReviewSession(log, worksById, pool, pool, testEras, seededRandom(3), 2)
    expect(session).toHaveLength(2)
    expect(session[0].entry.workId).toBe('w1')
    expect(session[1].entry.workId).toBe('w2')
  })

  it('worksById に存在しない workId のエントリはスキップする（エラーにしない）', () => {
    const w1 = makeWork({ id: 'w1', era: 'tenpyo' })
    const log: MissLogEntry[] = [{ workId: 'ghost', type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 }]
    const session = buildMissReviewSession(log, { w1 }, [w1], [w1], testEras, seededRandom(4))
    expect(session).toEqual([])
  })
})
