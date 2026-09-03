import type { Era, Work } from '../../types'

export function makeWork(overrides: Partial<Work> & { id: string }): Work {
  return {
    title: overrides.id,
    reading: overrides.id,
    era: 'tenpyo',
    category: 'sculpture',
    location: '',
    author: null,
    technique: '',
    keyPoints: [],
    explanation: '',
    confusables: [],
    image: { file: `${overrides.id}.webp`, credit: '', license: '', sourceUrl: '', sourceName: '' },
    sources: [],
    examTags: [],
    status: 'draft',
    ...overrides,
  }
}

export const testEras: Era[] = [
  { id: 'asuka', name: '飛鳥文化', period: '', order: 1, summary: '' },
  { id: 'hakuho', name: '白鳳文化', period: '', order: 2, summary: '' },
  { id: 'tenpyo', name: '天平文化', period: '', order: 3, summary: '' },
  { id: 'konin-jogan', name: '弘仁・貞観文化', period: '', order: 4, summary: '' },
]

export const testWorks: Work[] = [
  makeWork({ id: 'a1', era: 'tenpyo', category: 'sculpture', confusables: [{ id: 'a2', howToTell: 'x' }] }),
  makeWork({ id: 'a2', era: 'tenpyo', category: 'sculpture', confusables: [{ id: 'a1', howToTell: 'y' }] }),
  makeWork({ id: 'a3', era: 'tenpyo', category: 'sculpture' }),
  makeWork({ id: 'a4', era: 'hakuho', category: 'sculpture' }),
  makeWork({ id: 'a5', era: 'asuka', category: 'sculpture' }),
  makeWork({ id: 'a6', era: 'tenpyo', category: 'painting' }),
  makeWork({ id: 'a7', era: 'tenpyo', category: 'architecture' }),
  makeWork({ id: 'a8', era: 'konin-jogan', category: 'sculpture' }),
]

// category: other のように母数が少ないカテゴリ（実データで3件）でも、同カテゴリの
// 候補が尽きた後は「同じ時代・別カテゴリ」を優先し、いきなり他時代に飛ばないことを
// 確認するための固定セット。b1 が出題対象。
export const scarceCategoryWorks: Work[] = [
  makeWork({ id: 'b1', era: 'tenpyo', category: 'other' }), // 出題対象
  makeWork({ id: 'b2', era: 'asuka', category: 'other' }), // 同カテゴリだが遠い時代（唯一の同カテゴリ候補）
  makeWork({ id: 'b3', era: 'tenpyo', category: 'sculpture' }), // 同じ時代・別カテゴリ
  makeWork({ id: 'b4', era: 'tenpyo', category: 'painting' }), // 同じ時代・別カテゴリ
  makeWork({ id: 'b5', era: 'tenpyo', category: 'architecture' }), // 同じ時代・別カテゴリ
  makeWork({ id: 'b6', era: 'hakuho', category: 'craft' }), // 別の時代・別カテゴリ（最後の手段でのみ選ばれるべき）
]

/** テスト用の決定的な疑似乱数（mulberry32）。同じ seed なら同じ列を返す。 */
export function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
