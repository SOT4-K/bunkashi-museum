// Q14「年代順並べ替え」（T7。M2-16）の生成ロジック。orderIndex が無い/足りない区分では
// null を返してクラッシュしない（呼び出し側 themeSet.ts の appendOrderQuestionIfDue が
// 何もしない）ことをフォールバックの中心的な受け入れ条件として担保する。
import { describe, expect, it } from 'vitest'
import { generateOrderQuestion } from '../order'
import { makeWork, seededRandom } from './testFixtures'
import type { Era, Work } from '../../types'

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

  it(
    'Hayato修正: orderIndexの尺度が区分ごとに不統一（一部は区分内相対値10〜70、他は西暦年） ' +
      'でも、eras の order を第一キーにすることで区分をまたいだ正しい時代順になる',
    () => {
      // asuka(order=2)の相対値50は、tenpyo(order=4)の相対値20より「小さい」が、
      // 実際の時代順は asuka(飛鳥) → tenpyo(天平) が正しい。eras 省略時（旧挙動）は
      // orderIndex の大小だけで比較するため tenpyo(20) → asuka(50) と逆転してしまう。
      const makeEra = (id: string, order: number): Era => ({
        id,
        name: id,
        period: '',
        order,
        summary: '',
        detail: '',
        items: [],
      })
      const eras: Era[] = [makeEra('asuka', 2), makeEra('hakuho', 3), makeEra('tenpyo', 4)]
      const pool: Work[] = [
        makeWork({ id: 'asuka-work', era: 'asuka', orderIndex: 50 }),
        makeWork({ id: 'hakuho-work', era: 'hakuho', orderIndex: 20 }),
        makeWork({ id: 'tenpyo-work', era: 'tenpyo', orderIndex: 20 }),
      ]

      for (let seed = 0; seed < 10; seed++) {
        const data = generateOrderQuestion(pool, seededRandom(seed), 3, eras)
        expect(data).not.toBeNull()
        const byId = new Map(data!.displayItems.map((d) => [d.work.id, d.label]))
        const correctLabels = data!.choices[data!.correctIndex].text.split(' → ')
        const correctWorkOrder = correctLabels.map(
          (label) => [...byId.entries()].find(([, l]) => l === label)![0],
        )
        expect(correctWorkOrder).toEqual(['asuka-work', 'hakuho-work', 'tenpyo-work'])
      }
    },
  )

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
