import { describe, expect, it } from 'vitest'
import { generateEraItemQuestion } from '../eraItems'
import { makeWork, seededRandom } from './testFixtures'
import type { Era } from '../../types'

const eras: Era[] = [
  {
    id: 'asuka',
    name: '飛鳥文化',
    period: '',
    order: 1,
    summary: '',
    detail: '飛鳥文化の説明。',
    items: [
      { text: '三経義疏', category: 'scholarship' },
      { text: '鞍作鳥', category: 'person' },
    ],
  },
  {
    id: 'hakuho',
    name: '白鳳文化',
    period: '',
    order: 2,
    summary: '',
    detail: '白鳳文化の説明。',
    items: [
      { text: '柿本人麻呂', category: 'literature' },
      { text: '額田王', category: 'literature' },
      { text: '共通事項', category: 'other' }, // tenpyo にも同じ text を仕込む（重複除外の検証用）
    ],
  },
  {
    id: 'tenpyo',
    name: '天平文化',
    period: '',
    order: 3,
    summary: '',
    detail: '天平文化の説明。奈良時代の国際色豊かな仏教文化。',
    items: [
      { text: '古事記', category: 'literature' },
      { text: '日本書紀', category: 'literature' },
      { text: '万葉集', category: 'literature' },
      { text: '共通事項', category: 'other' }, // hakuho と重複
    ],
  },
  {
    id: 'konin-jogan',
    name: '弘仁・貞観文化',
    period: '',
    order: 4,
    summary: '',
    detail: '弘仁・貞観文化の説明。',
    items: [
      { text: '空海', category: 'religion' },
      { text: '最澄', category: 'religion' },
      { text: '密教', category: 'religion' },
    ],
  },
  {
    id: 'kokufu',
    name: '国風文化',
    period: '',
    order: 5,
    summary: '',
    detail: '国風文化の説明。',
    items: [
      { text: '源氏物語', category: 'literature' },
      { text: '枕草子', category: 'literature' },
      { text: '古今和歌集', category: 'literature' },
    ],
  },
]

const tenpyoWork = makeWork({ id: 'w1', era: 'tenpyo' })

describe('generateEraItemQuestion', () => {
  it('era.items が空なら null', () => {
    const noItemsEras: Era[] = [{ id: 'asuka', name: '飛鳥文化', period: '', order: 1, summary: '', detail: '', items: [] }]
    const w = makeWork({ id: 'w', era: 'asuka' })
    expect(generateEraItemQuestion(w, noItemsEras, seededRandom(1))).toBeNull()
  })

  it('era が eras に無ければ null', () => {
    const w = makeWork({ id: 'w', era: 'unknown-era' })
    expect(generateEraItemQuestion(w, eras, seededRandom(1))).toBeNull()
  })

  it('正しい事項は対象作品の era に属する（10 seed）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateEraItemQuestion(tenpyoWork, eras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.correct.eraId).toBe('tenpyo')
      expect(['古事記', '日本書紀', '万葉集', '共通事項']).toContain(result!.correct.text)
    }
  })

  it('複数文化に重複するテキスト（共通事項）は誤文には出ない（正文としては target の文化に属していれば可）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateEraItemQuestion(tenpyoWork, eras, seededRandom(seed))
      expect(result).not.toBeNull()
      const distractorTexts = result!.distractors.map((d) => d.text)
      expect(distractorTexts).not.toContain('共通事項')
    }
  })

  it('誤文はすべて別の文化に属し、正文と重複しない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateEraItemQuestion(tenpyoWork, eras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.distractors).toHaveLength(3)
      for (const d of result!.distractors) {
        expect(d.eraId).not.toBe('tenpyo')
        expect(d.text).not.toBe(result!.correct.text)
      }
      const texts = [result!.correct.text, ...result!.distractors.map((d) => d.text)]
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('誤文が3件そろわなければ null', () => {
    const scarceEras: Era[] = [
      { id: 'only', name: 'only', period: '', order: 1, summary: '', detail: '', items: [{ text: 'A', category: 'other' }] },
      { id: 'poor', name: 'poor', period: '', order: 2, summary: '', detail: '', items: [{ text: 'B', category: 'other' }] },
    ]
    const w = makeWork({ id: 'w', era: 'only' })
    expect(generateEraItemQuestion(w, scarceEras, seededRandom(1))).toBeNull()
  })
})
