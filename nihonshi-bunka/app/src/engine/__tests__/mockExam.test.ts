// M2-20: 本番モード（大問IV形式10問）。
import { describe, expect, it } from 'vitest'
import { buildMockExam, formatCountdown, MOCK_EXAM_SIZE } from '../mockExam'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Passage, Work } from '../../types'

function work(id: string, era: string, extra: Partial<Work> = {}): Work {
  return makeWork({ id, era, category: 'painting', artist: `作者${id}`, ...extra })
}

const pool: Work[] = [
  work('mw1', 'asuka'),
  work('mw2', 'hakuho'),
  work('mw3', 'tenpyo'),
  work('mw4', 'konin-jogan'),
  work('mw5', 'asuka'),
  work('mw6', 'hakuho'),
  work('mw7', 'tenpyo'),
  work('mw8', 'konin-jogan'),
  work('mw9', 'asuka'),
  work('mw10', 'hakuho'),
  work('mw11', 'tenpyo'),
  work('mw12', 'konin-jogan'),
]

function textPassage(id: string, era: string, workIds: string[]): Passage {
  return {
    id,
    era,
    title: `模試用${id}`,
    text: workIds.map((w, i) => `本文${i}。[[u${i}|${w}への言及]]という記述である。`).join(''),
    sources: ['x'],
    underlines: workIds.map((w, i) => ({ key: `u${i}`, workIds: [w] })),
  }
}

const passages: Passage[] = [
  textPassage('mp1', 'asuka', ['mw1', 'mw5', 'mw9']),
  textPassage('mp2', 'hakuho', ['mw2', 'mw6', 'mw10']),
  textPassage('mp3', 'tenpyo', ['mw3', 'mw7', 'mw11']),
  textPassage('mp4', 'konin-jogan', ['mw4', 'mw8', 'mw12']),
  { ...textPassage('mp-image', 'asuka', ['mw1']), kind: 'image', leadWorkIds: ['mw1'] },
]

describe('buildMockExam', () => {
  it('passages が空なら空配列', () => {
    expect(buildMockExam([], pool, pool, testEras)).toEqual([])
  })

  it('kind: "image" の passage は対象にしない（大問IVはリード文形式）', () => {
    const sections = buildMockExam([{ ...textPassage('only-image', 'asuka', ['mw1']), kind: 'image' }], pool, pool, testEras)
    expect(sections).toEqual([])
  })

  it('合計がちょうど MOCK_EXAM_SIZE 問になる（十分な下線がある場合）', () => {
    const sections = buildMockExam(passages, pool, pool, testEras, seededRandom(1))
    const total = sections.reduce((sum, s) => sum + s.questions.length, 0)
    expect(total).toBe(MOCK_EXAM_SIZE)
  })

  it('セクションには label（A, B, ...）と元の passage が付く', () => {
    const sections = buildMockExam(passages, pool, pool, testEras, seededRandom(2))
    expect(sections.length).toBeGreaterThan(0)
    expect(sections[0].label).toBe('A')
    for (const s of sections) {
      expect(s.passage.underlines.length).toBeGreaterThanOrEqual(s.questions.length > 0 ? 1 : 0)
    }
  })

  it('下線が少なすぎて1問も作れない passage しか無ければ空配列', () => {
    const emptyPassage: Passage = { id: 'empty', era: 'asuka', title: '空', text: '本文のみ。', sources: [], underlines: [] }
    expect(buildMockExam([emptyPassage], pool, pool, testEras)).toEqual([])
  })
})

describe('formatCountdown', () => {
  it('秒数を m:ss に整形する', () => {
    expect(formatCountdown(600)).toBe('10:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(5)).toBe('0:05')
  })

  it('負数は 0:00 に丸める', () => {
    expect(formatCountdown(-10)).toBe('0:00')
  })
})
