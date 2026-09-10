import { describe, expect, it } from 'vitest'
import { buildChoices, pickEraDistractors, pickWorkDistractors, shuffle } from '../distractors'
import { makeWork, scarceCategoryWorks, seededRandom, testEras, testWorks } from './testFixtures'
import type { Work } from '../../types'

const eraOrderIndex = Object.fromEntries(testEras.map((e) => [e.id, e.order]))

describe('pickWorkDistractors', () => {
  it('confusables を優先して選ぶ', () => {
    const target = testWorks.find((w) => w.id === 'a1')!
    const rng = seededRandom(1)
    const distractors = pickWorkDistractors(target, testWorks, eraOrderIndex, 3, rng)
    expect(distractors.map((w) => w.id)).toContain('a2') // 唯一の confusable
  })

  it('重複なし・対象自身を含まない・件数どおり', () => {
    const target = testWorks.find((w) => w.id === 'a3')!
    const rng = seededRandom(2)
    const distractors = pickWorkDistractors(target, testWorks, eraOrderIndex, 3, rng)
    const ids = distractors.map((w) => w.id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
    expect(ids).not.toContain('a3')
  })

  it('confusable が無い場合は同カテゴリ・近い時代を優先する', () => {
    const target = testWorks.find((w) => w.id === 'a3')! // sculpture / tenpyo, confusable無し
    const rng = seededRandom(3)
    const distractors = pickWorkDistractors(target, testWorks, eraOrderIndex, 3, rng)
    // 同カテゴリ(sculpture)は a1,a2,a4,a5,a8。painting(a6)/architecture(a7)より優先されるはず。
    const nonSculpture = distractors.filter((w) => w.category !== 'sculpture')
    expect(nonSculpture.length).toBeLessThanOrEqual(1) // プールが尽きない限りほぼ同カテゴリで埋まる
  })

  it('プールが少ない場合でも要求件数を超えない', () => {
    const smallPool = testWorks.slice(0, 2) // a1, a2 のみ
    const target = testWorks.find((w) => w.id === 'a1')!
    const rng = seededRandom(4)
    const distractors = pickWorkDistractors(target, smallPool, eraOrderIndex, 3, rng)
    expect(distractors.length).toBeLessThanOrEqual(3)
    expect(distractors.map((w) => w.id)).not.toContain('a1')
  })

  it('同カテゴリの候補が尽きたら、全体ランダムより先に同じ時代・別カテゴリを使う', () => {
    // category: other は実データで3件しかなく、同カテゴリだけでは4択が埋まらない。
    // このとき「同じ時代・別カテゴリ」（b3/b4/b5）を使い切ってから、最後の手段として
    // 別の時代（b6）に落ちるはず。b3〜b5 で count(3) 分（confusable無し + 同カテゴリ1件 + 同時代2件）
    // 埋まるため、複数シードで回しても b6 は選ばれない。
    const scarceEraOrderIndex = Object.fromEntries(testEras.map((e) => [e.id, e.order]))
    const target = scarceCategoryWorks.find((w) => w.id === 'b1')!
    for (let seed = 0; seed < 30; seed++) {
      const rng = seededRandom(seed * 13 + 5)
      const distractors = pickWorkDistractors(target, scarceCategoryWorks, scarceEraOrderIndex, 3, rng)
      const ids = distractors.map((w) => w.id)
      expect(ids).toHaveLength(3)
      expect(ids).toContain('b2') // 唯一の同カテゴリ候補は必ず入る
      expect(ids).not.toContain('b6') // 他時代・他カテゴリは同時代の候補が尽きるまで使わない
      // 残り2枠は同じ時代・別カテゴリ（b3/b4/b5）から埋まる
      const sameEraFillers = ids.filter((id) => ['b3', 'b4', 'b5'].includes(id))
      expect(sameEraFillers).toHaveLength(2)
    }
  })

  it('同じ時代・別カテゴリも尽きたときだけ全体ランダム（他時代）を使う', () => {
    // b2（同カテゴリ）と b3（同時代・別カテゴリ）だけの小さいプールでは
    // count=3 を満たせないので b6（他時代・他カテゴリ）まで使う必要がある。
    const smallPool = scarceCategoryWorks.filter((w) => ['b1', 'b2', 'b3', 'b6'].includes(w.id))
    const scarceEraOrderIndex = Object.fromEntries(testEras.map((e) => [e.id, e.order]))
    const target = smallPool.find((w) => w.id === 'b1')!
    for (let seed = 0; seed < 10; seed++) {
      const rng = seededRandom(seed * 7 + 2)
      const distractors = pickWorkDistractors(target, smallPool, scarceEraOrderIndex, 3, rng)
      const ids = distractors.map((w) => w.id)
      expect(ids.sort()).toEqual(['b2', 'b3', 'b6'])
    }
  })
})

// M2i-05b③（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-1「q1/q3のヘッダー解答
// 可能率が19.8%/19.9%で未改善」の修正）: preferSameEra オプションは誤答を同era（＝ワールド、
// カテゴリ不問）優先で選ぶ。engine/stages.ts のステージ生成（q1/q3）だけが渡す
// （preferSameEra を渡さない既定の呼び出し元＝上の既存テストは挙動が変わらないことを確認済み）。
describe('pickWorkDistractors の preferSameEra オプション（M2i-05b③）', () => {
  const target = makeWork({ id: 'pse-target', era: 'tenpyo', category: 'sculpture' })

  it('同era（tenpyo）の候補が4件以上あれば、誤答は全て同eraから選ばれる（カテゴリ不問）', () => {
    const sameEraWorks: Work[] = [
      makeWork({ id: 'pse-same0', era: 'tenpyo', category: 'sculpture' }),
      makeWork({ id: 'pse-same1', era: 'tenpyo', category: 'painting' }), // 別カテゴリでも同eraなら候補に入る
      makeWork({ id: 'pse-same2', era: 'tenpyo', category: 'craft' }),
      makeWork({ id: 'pse-same3', era: 'tenpyo', category: 'sculpture' }),
    ]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture' }),
      makeWork({ id: 'pse-other2', era: 'asuka', category: 'sculpture' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const distractors = pickWorkDistractors(target, pool, eraOrderIndex, 3, seededRandom(seed), { preferSameEra: true })
      expect(distractors).toHaveLength(3)
      for (const d of distractors) expect(d.era).toBe('tenpyo')
    }
  })

  it('同eraの候補が4件未満（1件）なら、同era分＋足りない分だけ同カテゴリの他eraから補う（同era1件のみにはならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse-same0', era: 'tenpyo', category: 'sculpture' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture' }),
      makeWork({ id: 'pse-other2', era: 'konin-jogan', category: 'sculpture' }),
      makeWork({ id: 'pse-other3', era: 'asuka', category: 'sculpture' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const distractors = pickWorkDistractors(target, pool, eraOrderIndex, 3, seededRandom(seed), { preferSameEra: true })
      expect(distractors).toHaveLength(3)
      expect(distractors.map((d) => d.id)).toContain('pse-same0')
    }
  })

  it('preferSameEra を渡さない（既定）場合は従来どおり距離順（同カテゴリ）で選ぶ（同era限定にならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse2-same0', era: 'tenpyo', category: 'sculpture' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse2-other1', era: 'hakuho', category: 'sculpture' }),
      makeWork({ id: 'pse2-other2', era: 'konin-jogan', category: 'sculpture' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    const distractors = pickWorkDistractors(target, pool, eraOrderIndex, 3, seededRandom(1))
    expect(distractors).toHaveLength(3)
  })
})

describe('pickEraDistractors', () => {
  it('正解の時代を含まない', () => {
    const target = testEras[0]
    const rng = seededRandom(5)
    const distractors = pickEraDistractors(target, testEras, 3, rng)
    expect(distractors.map((e) => e.id)).not.toContain(target.id)
  })

  it('重複なし', () => {
    const target = testEras[0]
    const rng = seededRandom(6)
    const distractors = pickEraDistractors(target, testEras, 3, rng)
    const ids = distractors.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildChoices', () => {
  it('4件になり、correctIndex が正解を指す', () => {
    const correct = testWorks[0]
    const distractors = [testWorks[1], testWorks[2], testWorks[3]]
    const rng = seededRandom(7)
    const { items, correctIndex } = buildChoices(correct, distractors, rng)
    expect(items).toHaveLength(4)
    expect(items[correctIndex]).toBe(correct)
  })

  it('正解位置に偏りがない（多数試行で全4位置が出現する）', () => {
    const correct = testWorks[0]
    const distractors = [testWorks[1], testWorks[2], testWorks[3]]
    const positions = new Set<number>()
    for (let seed = 0; seed < 200; seed++) {
      const rng = seededRandom(seed * 97 + 1)
      const { correctIndex } = buildChoices(correct, distractors, rng)
      positions.add(correctIndex)
    }
    expect(positions.size).toBe(4)
  })
})

describe('shuffle', () => {
  it('元配列を変更しない（非破壊）', () => {
    const original = [1, 2, 3, 4, 5]
    const copy = [...original]
    shuffle(original, seededRandom(9))
    expect(original).toEqual(copy)
  })

  it('要素の集合は変わらない', () => {
    const original = [1, 2, 3, 4, 5]
    const shuffled = shuffle(original, seededRandom(10))
    expect([...shuffled].sort()).toEqual([...original].sort())
  })
})
