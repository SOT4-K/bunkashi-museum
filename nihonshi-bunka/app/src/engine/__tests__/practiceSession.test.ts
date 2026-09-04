// M2-22: 文化別練習（学習タブ）。
import { describe, expect, it } from 'vitest'
import { buildPracticeSession, PRACTICE_SESSION_SIZE, requeuePracticeQuestion } from '../practiceSession'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Work } from '../../types'

function work(id: string, era: string, extra: Partial<Work> = {}): Work {
  return makeWork({ id, era, category: 'painting', artist: `作者${id}`, ...extra })
}

const tenpyoWorks: Work[] = [work('ps1', 'tenpyo'), work('ps2', 'tenpyo'), work('ps3', 'tenpyo')]
const asukaWorks: Work[] = [work('ps4', 'asuka')]
const pool: Work[] = [...tenpyoWorks, ...asukaWorks]

describe('buildPracticeSession', () => {
  it('指定した文化の作品しか出題しない', () => {
    const questions = buildPracticeSession('tenpyo', pool, pool, testEras, seededRandom(1))
    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) {
      expect(q.work.era).toBe('tenpyo')
    }
  })

  it('対象文化の作品数が count 未満なら水増しせずその件数分だけ返す', () => {
    const questions = buildPracticeSession('asuka', pool, pool, testEras, seededRandom(1), PRACTICE_SESSION_SIZE)
    expect(questions.length).toBeLessThanOrEqual(asukaWorks.length)
  })

  it('対象文化が存在しなければ空配列', () => {
    expect(buildPracticeSession('nonexistent', pool, pool, testEras, seededRandom(1))).toEqual([])
  })

  it('画像を持たない作品（kind: person）には画像が要る型を使わない', () => {
    const textWork = work('ps5', 'tenpyo', { kind: 'person', facts: [{ slot: 'other', text: '何かの記述' }] })
    const questions = buildPracticeSession('tenpyo', [textWork], [], testEras, seededRandom(1))
    for (const q of questions) {
      expect(['q1', 'q2', 'q3', 'q9']).not.toContain(q.type)
    }
  })
})

describe('requeuePracticeQuestion', () => {
  it('直前と違う型を選ぶ（可能なとき）', () => {
    const target = work('ps1', 'tenpyo', {
      artist: '定朝',
      facts: [{ slot: 'artist', text: '定朝の作' }],
      falseStatements: [{ text: '運慶の作', why: 'x', verifiedFalse: true }],
    })
    const questions = buildPracticeSession('tenpyo', [target, ...asukaWorks], [target, ...asukaWorks], testEras, seededRandom(1), 1)
    expect(questions).toHaveLength(1)
    const original = questions[0]
    const requeued = requeuePracticeQuestion(original, [target, ...asukaWorks], [target, ...asukaWorks], testEras, seededRandom(2))
    if (requeued) {
      expect(requeued.type).not.toBe(original.type)
    }
  })
})
