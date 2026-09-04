import { describe, expect, it } from 'vitest'
import { generateQ9Question } from '../q9'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Work } from '../../types'

// 作者条件で判定できる構成: hokusai1/hokusai2 は北斎、hiroshige1/hiroshige2/hiroshige3 は広重。
const hokusai1 = makeWork({ id: 'hokusai1', era: 'tenpyo', category: 'painting', artist: '葛飾北斎' })
const hokusai2 = makeWork({ id: 'hokusai2', era: 'hakuho', category: 'painting', artist: '葛飾北斎' })
const hiroshige1 = makeWork({ id: 'hiroshige1', era: 'asuka', category: 'painting', artist: '歌川広重' })
const hiroshige2 = makeWork({ id: 'hiroshige2', era: 'konin-jogan', category: 'painting', artist: '歌川広重' })
const hiroshige3 = makeWork({ id: 'hiroshige3', era: 'tenpyo', category: 'painting', artist: '歌川広重' })

const artistPool: Work[] = [hokusai1, hokusai2, hiroshige1, hiroshige2, hiroshige3]

// era のみで判定できる構成（artist/holder/style は無し）。同カテゴリ・別時代の作品が3件必要。
const eraOnlyTarget = makeWork({ id: 'e0', era: 'tenpyo', category: 'sculpture' })
const eraOnlyPool: Work[] = [
  eraOnlyTarget,
  makeWork({ id: 'e1', era: 'hakuho', category: 'sculpture' }),
  makeWork({ id: 'e2', era: 'asuka', category: 'sculpture' }),
  makeWork({ id: 'e3', era: 'konin-jogan', category: 'sculpture' }),
]

describe('generateQ9Question（正パターン）', () => {
  it('artist スロットで生成できる: correctWork は target、distractorWorks は artist が違う3件', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.reversed).toBe(false)
      expect(result!.slot).toBe('artist')
      expect(result!.correctWork.id).toBe('hokusai1')
      expect(result!.distractorWorks).toHaveLength(3)
      for (const d of result!.distractorWorks) {
        expect(d.artist).not.toBe('葛飾北斎')
        expect(d.id).not.toBe('hokusai1')
      }
    }
  })

  it('artist が無い作品では era スロットにフォールバックする', () => {
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.slot).toBe('era')
    expect(result!.correctWork.id).toBe('e0')
    for (const d of result!.distractorWorks) {
      expect(d.era).not.toBe('tenpyo')
    }
  })

  it('同カテゴリの候補が足りなければ null', () => {
    const lonely = makeWork({ id: 'lonely', era: 'tenpyo', category: 'garden' })
    const result = generateQ9Question(lonely, [lonely, ...artistPool], testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('distractorWorks に target 自身は含まれない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed))
      expect(result!.distractorWorks.some((d) => d.id === 'hokusai1')).toBe(false)
    }
  })
})

describe('generateQ9Question（逆パターン: 合わない1枚）', () => {
  it('distractorWorks 3件が同じ値を共有し、target はその値を持たない（正解は target のまま）', () => {
    // hiroshige1/hiroshige2/hiroshige3 が広重で共有。hokusai1 は北斎なので「合わない1枚」
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed), { reversed: true })
      expect(result).not.toBeNull()
      expect(result!.reversed).toBe(true)
      expect(result!.correctWork.id).toBe('hokusai1')
      expect(result!.distractorWorks).toHaveLength(3)
      const distractorArtists = new Set(result!.distractorWorks.map((d) => d.artist))
      expect(distractorArtists.size).toBe(1)
      expect(distractorArtists.has('葛飾北斎')).toBe(false)
    }
  })

  it('3件共有する値が見つからなければ null', () => {
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1), { reversed: true })
    // eraOnlyPool は3件とも別々の era なので、共有する値（3件以上）が無い
    expect(result).toBeNull()
  })
})
