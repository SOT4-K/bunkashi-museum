import { describe, expect, it } from 'vitest'
import { eraWeight, weightedSampleWithoutReplacement } from '../weighted'
import { seededRandom, testEras } from './testFixtures'
import type { Era } from '../../types'

describe('eraWeight', () => {
  it('weight が設定されていればその値を返す', () => {
    const eras: Era[] = [{ id: 'genshi', name: '原始', period: '', order: 1, summary: '', detail: '', items: [], weight: 0.5 }]
    expect(eraWeight('genshi', eras)).toBe(0.5)
  })

  it('weight が無ければ1', () => {
    expect(eraWeight('asuka', testEras)).toBe(1) // testEras は weight を持たない
  })

  it('0以下の weight は1として扱う（不正値のフォールバック）', () => {
    const eras: Era[] = [{ id: 'x', name: 'x', period: '', order: 1, summary: '', detail: '', items: [], weight: 0 }]
    expect(eraWeight('x', eras)).toBe(1)
  })

  it('era が見つからなければ1', () => {
    expect(eraWeight('unknown', testEras)).toBe(1)
  })
})

describe('weightedSampleWithoutReplacement', () => {
  it('count 件を重複なく返す', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const result = weightedSampleWithoutReplacement(items, () => 1, 3, seededRandom(1))
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
  })

  it('items が count 未満なら items 全件（重複なし）を返す', () => {
    const items = ['a', 'b']
    const result = weightedSampleWithoutReplacement(items, () => 1, 5, seededRandom(1))
    expect(new Set(result)).toEqual(new Set(items))
    expect(result).toHaveLength(2)
  })

  it('count が0以下なら空配列', () => {
    expect(weightedSampleWithoutReplacement(['a', 'b'], () => 1, 0, seededRandom(1))).toEqual([])
  })

  it('重みが極端に低い要素は高い要素より選ばれにくい（大量試行での統計的検証）', () => {
    const items = ['heavy', 'light']
    const weightOf = (item: string) => (item === 'heavy' ? 100 : 0.01)
    let heavyFirstCount = 0
    const trials = 200
    for (let seed = 0; seed < trials; seed++) {
      const [first] = weightedSampleWithoutReplacement(items, weightOf, 1, seededRandom(seed))
      if (first === 'heavy') heavyFirstCount++
    }
    // heavy が light の1万倍の重みなので、ほぼ毎回 heavy が選ばれるはず
    expect(heavyFirstCount).toBeGreaterThan(trials * 0.9)
  })

  it('重みが0以下でも候補として拾える（極小重みにフォールバックし、0件にならない）', () => {
    const items = ['only']
    const result = weightedSampleWithoutReplacement(items, () => 0, 1, seededRandom(1))
    expect(result).toEqual(['only'])
  })
})
