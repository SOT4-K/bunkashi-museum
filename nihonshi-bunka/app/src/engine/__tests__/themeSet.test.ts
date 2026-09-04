import { describe, expect, it, vi } from 'vitest'
import { buildThemeQuestionForWork, buildThemeSetQuestions } from '../themeSet'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Passage, Work } from '../../types'

// Q9（artist条件）が生成できる作品群。
const targetWithArtist = makeWork({ id: 't1', era: 'tenpyo', category: 'painting', artist: '葛飾北斎' })
const pool: Work[] = [
  targetWithArtist,
  makeWork({ id: 't2', era: 'hakuho', category: 'painting', artist: '歌川広重' }),
  makeWork({ id: 't3', era: 'asuka', category: 'painting', artist: '歌川広重' }),
  makeWork({ id: 't4', era: 'konin-jogan', category: 'painting', artist: '歌川広重' }),
]

// facts/falseStatements/artist/style/holder すべて無い、Q1 しか作れない作品。
const bareTarget = makeWork({ id: 'bare1', era: 'tenpyo', category: 'sculpture' })
const barePool: Work[] = [bareTarget, makeWork({ id: 'bare2', era: 'tenpyo', category: 'sculpture' })]

describe('buildThemeQuestionForWork', () => {
  it('Q9 が生成できる作品では q9 を優先して選ぶ', () => {
    const q = buildThemeQuestionForWork(targetWithArtist, pool, testEras, seededRandom(1))
    expect(q.type).toBe('q9')
    expect(q.work.id).toBe('t1')
  })

  it('どの拡張型も生成できない作品では q1 にフォールバックする（必ず Question を返す）', () => {
    const q = buildThemeQuestionForWork(bareTarget, barePool, testEras, seededRandom(1))
    expect(q.type).toBe('q1')
    expect(q.choiceWorks).toHaveLength(2) // barePool には distractor が1件しか無い（4択に満たないがQ1は生成される）
  })

  it('生成される Question は常に画像を持つ（work.image か choiceWorks のどちらか）', () => {
    for (const [target, p] of [
      [targetWithArtist, pool],
      [bareTarget, barePool],
    ] as const) {
      const q = buildThemeQuestionForWork(target, p, testEras, seededRandom(2))
      const hasPromptImage = Boolean(q.work?.image)
      const hasChoiceImages = q.choiceWorks.length > 0
      expect(hasPromptImage || hasChoiceImages).toBe(true)
    }
  })
})

describe('buildThemeSetQuestions', () => {
  const passage: Passage = {
    id: 'p1',
    era: 'tenpyo',
    title: 'テスト用リード文',
    text: '本文中に[[a|下線A]]と[[b|下線B]]がある。',
    sources: ['x'],
    underlines: [
      { key: 'a', workIds: ['t1'] },
      { key: 'b', workIds: ['not-in-pool'] },
    ],
  }

  it('workIds がプールに無い下線はスキップし、console.warn を呼ぶ', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = buildThemeSetQuestions(passage, pool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].underlineKey).toBe('a')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('生成した Question に passageId・underlineKey が付く', () => {
    const result = buildThemeSetQuestions(passage, pool, testEras, seededRandom(1))
    expect(result[0].question.passageId).toBe('p1')
    expect(result[0].question.underlineKey).toBe('a')
  })

  it('workIds に複数指定があれば、プールにある最初の作品を対象にする', () => {
    const multiPassage: Passage = {
      ...passage,
      underlines: [{ key: 'a', workIds: ['not-in-pool', 't2'] }],
    }
    const result = buildThemeSetQuestions(multiPassage, pool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.work.id).toBe('t2')
  })
})
