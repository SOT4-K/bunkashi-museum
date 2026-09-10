// engine/q7.ts の単体テスト（M2i-05③、★3「出土地・所在地」新設。Q5〈画像→作者。q5.ts〉と
// 対称の構造なので、q5 のテスト観点〈正解値・誤答3件・値不足でnull〉をなぞる）。
import { describe, expect, it } from 'vitest'
import { generateQ7Question, q7LocationValue } from '../q7'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Work } from '../../types'

describe('q7LocationValue（★3判定と同じ優先順位: findSite優先、無ければsite限定のlocation）', () => {
  it('findSite があればそれを返す', () => {
    const work = makeWork({ id: 'w1', findSite: '出土地X', holderKind: 'site', location: '所在地X' })
    expect(q7LocationValue(work)).toBe('出土地X')
  })

  it('findSite が無く holderKind===site かつ location があればそれを返す', () => {
    const work = makeWork({ id: 'w2', holder: '法隆寺', holderKind: 'site', location: '法隆寺（奈良）' })
    expect(q7LocationValue(work)).toBe('法隆寺（奈良）')
  })

  it('holderKind===museum の location は使わない（博物館は出さない、M2b-14）', () => {
    const work = makeWork({ id: 'w3', holder: '東京国立博物館', holderKind: 'museum', location: '東京国立博物館' })
    expect(q7LocationValue(work)).toBeNull()
  })

  it('location に所蔵語（国宝館等）が含まれる site も除外する（q9.ts containsMuseumWord と同じ）', () => {
    const work = makeWork({ id: 'w4', holder: '興福寺', holderKind: 'site', location: '興福寺国宝館' })
    expect(q7LocationValue(work)).toBeNull()
  })

  it('何も持たない作品は null', () => {
    const work = makeWork({ id: 'w5' })
    expect(q7LocationValue(work)).toBeNull()
  })
})

describe('generateQ7Question', () => {
  const target = makeWork({ id: 't1', era: 'tenpyo', category: 'sculpture', findSite: '出土地T' })

  it('正解は target の出土地・所在地、誤答は3件・target とは異なる値', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', findSite: '出土地1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', findSite: '出土地2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', findSite: '出土地3' }),
    ]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ7Question(target, pool, testEras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.correctLocation).toBe('出土地T')
      expect(result!.distractorLocations).toHaveLength(3)
      expect(new Set(result!.distractorLocations)).toEqual(new Set(['出土地1', '出土地2', '出土地3']))
    }
  })

  it('対象自身が値を持たなければ null', () => {
    const noLocation = makeWork({ id: 'nl1', era: 'tenpyo', category: 'sculpture' })
    const pool: Work[] = [
      noLocation,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', findSite: '出土地1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', findSite: '出土地2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', findSite: '出土地3' }),
    ]
    const result = generateQ7Question(noLocation, pool, testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('異なる値を持つ候補が3件に満たなければ null', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', findSite: '出土地1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', findSite: '出土地2' }),
    ]
    const result = generateQ7Question(target, pool, testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('同じ出土地・所在地を複数作品が共有していても、正解値と重複しない値として1つに数える', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', findSite: '共有出土地' }),
      makeWork({ id: 'd1b', era: 'hakuho', category: 'sculpture', findSite: '共有出土地' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', findSite: '出土地2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', findSite: '出土地3' }),
    ]
    const result = generateQ7Question(target, pool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    // distractorLocations は値の集合なので重複しない
    expect(new Set(result!.distractorLocations).size).toBe(result!.distractorLocations.length)
  })

  it('target 自身は誤答候補に含まれない（同じ値でも自分を数えない）', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', findSite: '出土地1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', findSite: '出土地2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', findSite: '出土地3' }),
    ]
    const result = generateQ7Question(target, pool, testEras, seededRandom(1))
    expect(result!.distractorLocations).not.toContain('出土地T')
  })
})
