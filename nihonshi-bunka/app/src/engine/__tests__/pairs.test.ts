// Q13「語句の組合せ」（T1。M2-16）の生成ロジック。pairs（{left, right, kind}）が無い/少ない
// 作品では null を返してクラッシュしない（呼び出し側 themeSet.ts が次善の型にフォールバックする）
// ことをフォールバックの中心的な受け入れ条件として担保する。
import { describe, expect, it } from 'vitest'
import { generatePairQuestion } from '../pairs'
import { makeWork, seededRandom } from './testFixtures'
import type { Work } from '../../types'

function withPairs(id: string, pairs: Work['pairs']): Work {
  return makeWork({ id, pairs })
}

describe('generatePairQuestion: フォールバック（pairs が無い/少ない）', () => {
  it('pairs が無い作品では null', () => {
    const target = makeWork({ id: 'no-pairs' })
    const pool = [target, withPairs('other', [{ left: '仏師', right: '運慶' }])]
    expect(generatePairQuestion(target, pool, seededRandom(1))).toBeNull()
  })

  it('pairs が空配列でも null', () => {
    const target = withPairs('empty-pairs', [])
    const pool = [target]
    expect(generatePairQuestion(target, pool, seededRandom(1))).toBeNull()
  })

  it('他作品に組合せ素材が無く、偽の組合せ（distractor）が3件そろわないときは null', () => {
    const target = withPairs('lonely', [{ left: '仏師', right: '運慶' }])
    const pool = [target] // target 以外に pairs を持つ作品が無い
    expect(generatePairQuestion(target, pool, seededRandom(1))).toBeNull()
  })

  it('reversed も同様: 他作品の実在する組合せが3件そろわなければ null', () => {
    const target = withPairs('lonely2', [{ left: '仏師', right: '運慶' }])
    const other = withPairs('o1', [{ left: '書物', right: '作者A' }])
    const pool = [target, other]
    expect(generatePairQuestion(target, pool, seededRandom(1), { reversed: true })).toBeNull()
  })
})

describe('generatePairQuestion: 生成できるとき', () => {
  // 他作品の left/right は target と重ならないカテゴリにして、swap 候補（chosen.left×他のright、
  // 他のleft×chosen.right）がどれも実在の組合せと衝突しない（＝安全な偽の組合せになる）ようにする。
  const target = withPairs('t1', [{ left: '仏師', right: '運慶', kind: 'person-role' }])
  const pool: Work[] = [
    target,
    withPairs('o1', [{ left: '書物', right: '徒然草' }]),
    withPairs('o2', [{ left: '様式', right: '寝殿造' }]),
    withPairs('o3', [{ left: '原料', right: '有田' }]),
    withPairs('o4', [{ left: '画家', right: '雪舟' }]),
  ]

  it('正解1件＋偽の組合せ3件を返し、テキストが重複しない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const data = generatePairQuestion(target, pool, seededRandom(seed))
      expect(data).not.toBeNull()
      expect(data!.reversed).toBe(false)
      expect(data!.distractors).toHaveLength(3)
      const texts = [data!.correct.text, ...data!.distractors.map((d) => d.text)]
      expect(new Set(texts).size).toBe(texts.length)
      expect(data!.correct.text).toBe('仏師・運慶')
      for (const d of data!.distractors) {
        expect(d.correct).toBe(false)
      }
    }
  })

  it('偽の組合せが実在する他作品の組合せと一致する場合は候補から除外する（偶然に真実になる誤答を出さない）', () => {
    // o5「画家・定朝」があるため right 値 '定朝' が swap 候補プールに入り、
    // chosen.left「仏師」と組み合わせた「仏師・定朝」が偽の組合せの候補になりうる。
    // ここに o6「仏師・定朝」という実在の組合せがあれば、その候補は安全でないため除外されるはず。
    const poolWithRealCombo: Work[] = [
      ...pool,
      withPairs('o5', [{ left: '画家', right: '定朝' }]),
      withPairs('o6', [{ left: '仏師', right: '定朝' }]),
    ]
    for (let seed = 0; seed < 10; seed++) {
      const data = generatePairQuestion(target, poolWithRealCombo, seededRandom(seed))
      if (!data) continue
      expect(data.distractors.map((d) => d.text)).not.toContain('仏師・定朝')
    }
  })

  it('reversed: 偽の組合せが正解（correct.text）、他作品の実在する組合せ3件が distractors', () => {
    for (let seed = 0; seed < 10; seed++) {
      const data = generatePairQuestion(target, pool, seededRandom(seed), { reversed: true })
      expect(data).not.toBeNull()
      expect(data!.reversed).toBe(true)
      expect(data!.distractors).toHaveLength(3)
      const texts = [data!.correct.text, ...data!.distractors.map((d) => d.text)]
      expect(new Set(texts).size).toBe(texts.length)
      // correct.text は target 自身の実在する組合せそのものではない（偽の組合せのはず）
      expect(data!.correct.text).not.toBe('仏師・運慶')
      // distractors は他作品の実在する組合せそのもの
      for (const d of data!.distractors) {
        expect(['書物・徒然草', '様式・寝殿造', '原料・有田', '画家・雪舟']).toContain(d.text)
      }
    }
  })

  it('乱数を変えても distractors が3件そろい、生成が安定して成功する（複数seed）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const data = generatePairQuestion(target, pool, seededRandom(seed))
      expect(data).not.toBeNull()
    }
  })
})
