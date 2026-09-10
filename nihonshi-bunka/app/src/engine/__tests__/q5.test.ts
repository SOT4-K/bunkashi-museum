// engine/q5.ts の単体テスト（M2i ★2「作者」。これまで単体テストが無かったため、
// M2i-05b③〈preferSameEra追加〉に合わせて新設する。q7.test.ts〈画像→出土地・所在地。
// q5と対称の構造〉のテスト観点をなぞる）。
import { describe, expect, it } from 'vitest'
import { generateQ5Question } from '../q5'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Work } from '../../types'

describe('generateQ5Question', () => {
  const target = makeWork({ id: 't1', era: 'tenpyo', category: 'sculpture', artist: '目標作者' })

  it('正解は target の作者、誤答は3件・target とは異なる作者名', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', artist: '作者1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', artist: '作者2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', artist: '作者3' }),
    ]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ5Question(target, pool, testEras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.correctArtist).toBe('目標作者')
      expect(result!.distractorArtists).toHaveLength(3)
      expect(new Set(result!.distractorArtists)).toEqual(new Set(['作者1', '作者2', '作者3']))
    }
  })

  it('対象自身が artist を持たなければ null', () => {
    const noArtist = makeWork({ id: 'na1', era: 'tenpyo', category: 'sculpture' })
    const pool: Work[] = [
      noArtist,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', artist: '作者1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', artist: '作者2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', artist: '作者3' }),
    ]
    const result = generateQ5Question(noArtist, pool, testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('異なる作者名を持つ候補が3件に満たなければ null', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', artist: '作者1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', artist: '作者2' }),
    ]
    const result = generateQ5Question(target, pool, testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('同じ作者が複数作品にまたがっていても、正解値と重複しない名前として1つに数える', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', artist: '共有作者' }),
      makeWork({ id: 'd1b', era: 'hakuho', category: 'sculpture', artist: '共有作者' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', artist: '作者2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', artist: '作者3' }),
    ]
    const result = generateQ5Question(target, pool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(new Set(result!.distractorArtists).size).toBe(result!.distractorArtists.length)
  })

  it('target 自身は誤答候補に含まれない（同じ作者名でも自分を数えない）', () => {
    const pool: Work[] = [
      target,
      makeWork({ id: 'd1', era: 'hakuho', category: 'sculpture', artist: '作者1' }),
      makeWork({ id: 'd2', era: 'asuka', category: 'sculpture', artist: '作者2' }),
      makeWork({ id: 'd3', era: 'konin-jogan', category: 'sculpture', artist: '作者3' }),
    ]
    const result = generateQ5Question(target, pool, testEras, seededRandom(1))
    expect(result!.distractorArtists).not.toContain('目標作者')
  })
})

// M2i-05b③（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-1の修正）: preferSameEra
// オプションは誤答を同era（＝ワールド）優先で選ぶ。engine/stages.ts のステージ生成だけが渡す
// （preferSameEra を渡さない既定の呼び出し元＝上の既存テストは挙動が変わらないことを確認済み）。
describe('preferSameEra オプション（M2i-05b③: ステージのQ5誤答は同ワールド優先）', () => {
  const target = makeWork({ id: 'pse-target', era: 'tenpyo', category: 'sculpture', artist: '目標作者' })

  it('同era（tenpyo）の作者候補が4件以上あれば、誤答は全て同eraの作者から選ばれる', () => {
    const sameEraWorks: Work[] = Array.from({ length: 5 }, (_, i) =>
      makeWork({ id: `pse-same${i}`, era: 'tenpyo', category: 'sculpture', artist: `同era作者${i}` }),
    )
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse-other2', era: 'asuka', category: 'sculpture', artist: '別era作者2' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ5Question(target, pool, testEras, seededRandom(seed), { preferSameEra: true })
      expect(result).not.toBeNull()
      expect(result!.distractorArtists).toHaveLength(3)
      for (const name of result!.distractorArtists) expect(name.startsWith('同era作者')).toBe(true)
    }
  })

  it('同eraの作者候補が4件未満（1件）なら、同era分＋足りない分だけ他eraから補う（同era1件のみにはならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse-same0', era: 'tenpyo', category: 'sculpture', artist: '同era作者0' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse-other2', era: 'konin-jogan', category: 'sculpture', artist: '別era作者2' }),
      makeWork({ id: 'pse-other3', era: 'asuka', category: 'sculpture', artist: '別era作者3' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ5Question(target, pool, testEras, seededRandom(seed), { preferSameEra: true })
      expect(result).not.toBeNull()
      expect(result!.distractorArtists).toHaveLength(3)
      expect(result!.distractorArtists).toContain('同era作者0')
    }
  })

  it('preferSameEra を渡さない（既定）場合は従来どおり距離順の窓から選ぶ（同era限定にならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse2-same0', era: 'tenpyo', category: 'sculpture', artist: '同era作者0' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse2-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse2-other2', era: 'konin-jogan', category: 'sculpture', artist: '別era作者2' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    const result = generateQ5Question(target, pool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.distractorArtists).toHaveLength(3)
  })
})
