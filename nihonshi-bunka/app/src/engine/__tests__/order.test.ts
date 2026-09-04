// Q14「年代順並べ替え」（T7。M2-16）の生成ロジック。orderIndex が無い/足りない区分では
// null を返してクラッシュしない（呼び出し側 themeSet.ts の appendOrderQuestionIfDue が
// 何もしない）ことをフォールバックの中心的な受け入れ条件として担保する。
import { describe, expect, it } from 'vitest'
import { generateOrderQuestion } from '../order'
import { makeWork, seededRandom } from './testFixtures'
import type { Work } from '../../types'

describe('generateOrderQuestion: フォールバック（orderIndex が無い/足りない）', () => {
  it('pool が空なら null', () => {
    expect(generateOrderQuestion([], seededRandom(1))).toBeNull()
  })

  it('orderIndex を持つ作品が1件も無ければ null', () => {
    const pool = [makeWork({ id: 'a' }), makeWork({ id: 'b' }), makeWork({ id: 'c' })]
    expect(generateOrderQuestion(pool, seededRandom(1))).toBeNull()
  })

  it('orderIndex を持つ作品が2件しか無ければ（count既定3）null', () => {
    const pool = [makeWork({ id: 'a', orderIndex: 10 }), makeWork({ id: 'b', orderIndex: 20 })]
    expect(generateOrderQuestion(pool, seededRandom(1))).toBeNull()
  })

  it('orderIndex が全件同じ値（区分が1つしかない）なら null（一意な順序が決まらない）', () => {
    const pool = [
      makeWork({ id: 'a', orderIndex: 10 }),
      makeWork({ id: 'b', orderIndex: 10 }),
      makeWork({ id: 'c', orderIndex: 10 }),
    ]
    expect(generateOrderQuestion(pool, seededRandom(1))).toBeNull()
  })
})

describe('generateOrderQuestion: 生成できるとき', () => {
  const pool: Work[] = [
    makeWork({ id: 'old', orderIndex: 700 }),
    makeWork({ id: 'mid', orderIndex: 750 }),
    makeWork({ id: 'new', orderIndex: 800 }),
    makeWork({ id: 'newest', orderIndex: 850 }),
  ]

  it('displayItems が count 件、ラベルが重複しない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const data = generateOrderQuestion(pool, seededRandom(seed))
      expect(data).not.toBeNull()
      expect(data!.displayItems).toHaveLength(3)
      const labels = data!.displayItems.map((d) => d.label)
      expect(new Set(labels).size).toBe(3)
      const workIds = data!.displayItems.map((d) => d.work.id)
      expect(new Set(workIds).size).toBe(3)
    }
  })

  it('choices は4件、correctIndex の選択肢が正しい制作順（orderIndex 昇順のラベル列）と一致する', () => {
    for (let seed = 0; seed < 10; seed++) {
      const data = generateOrderQuestion(pool, seededRandom(seed))
      expect(data).not.toBeNull()
      expect(data!.choices).toHaveLength(4)
      const correctCount = data!.choices.filter((c) => c.correct).length
      expect(correctCount).toBe(1)
      expect(data!.choices[data!.correctIndex].correct).toBe(true)

      // 正解の並びを実際に orderIndex でソートして再現し、選択肢のテキストと突き合わせる
      const byId = new Map(data!.displayItems.map((d) => [d.work.id, d.label]))
      const sortedLabels = [...data!.displayItems]
        .sort((a, b) => (a.work.orderIndex ?? 0) - (b.work.orderIndex ?? 0))
        .map((d) => byId.get(d.work.id))
      expect(data!.choices[data!.correctIndex].text).toBe(sortedLabels.join(' → '))
    }
  })

  it('choices のテキストが重複しない（誤答の並びが正解と異なる）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const data = generateOrderQuestion(pool, seededRandom(seed))
      expect(data).not.toBeNull()
      const texts = data!.choices.map((c) => c.text)
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('orderIndex が重複する作品は区分が1つとして扱われる（同じ orderIndex の中からランダムに1件）', () => {
    const withDup: Work[] = [
      makeWork({ id: 'a1', orderIndex: 10 }),
      makeWork({ id: 'a2', orderIndex: 10 }), // a1 と同じ区分（重複）
      makeWork({ id: 'b', orderIndex: 20 }),
      makeWork({ id: 'c', orderIndex: 30 }),
    ]
    const data = generateOrderQuestion(withDup, seededRandom(1))
    expect(data).not.toBeNull()
    // 選ばれた3件は orderIndex が互いに異なる（a1/a2 は両方選ばれない）
    const orderIndexes = data!.displayItems.map((d) => d.work.orderIndex)
    expect(new Set(orderIndexes).size).toBe(3)
  })

  it('count を指定すればその件数で生成する', () => {
    const bigPool: Work[] = [
      makeWork({ id: 'a', orderIndex: 1 }),
      makeWork({ id: 'b', orderIndex: 2 }),
      makeWork({ id: 'c', orderIndex: 3 }),
      makeWork({ id: 'd', orderIndex: 4 }),
    ]
    const data = generateOrderQuestion(bigPool, seededRandom(1), 4)
    expect(data).not.toBeNull()
    expect(data!.displayItems).toHaveLength(4)
    expect(data!.choices).toHaveLength(4)
  })
})
