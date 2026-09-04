import { describe, expect, it } from 'vitest'
import { generateQ12Question } from '../q12'
import { seededRandom } from './testFixtures'
import type { PassageUnderlineAsk } from '../../types'

const q12Ask: PassageUnderlineAsk = {
  type: 'q12',
  stem: 'この絵巻の主人公として最も適切なものはどれか',
  answerText: '空也上人',
  distractorTexts: ['一遍上人', '法然', '親鸞'],
}

describe('generateQ12Question（9章「画像リード型セット」: 画像なし文字4択）', () => {
  it('answerText・distractorTexts がそろっていれば4択を生成する（writer 手書きをそのまま使う）', () => {
    const result = generateQ12Question(q12Ask, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.choices).toHaveLength(4)
    const texts = result!.choices.map((c) => c.text)
    expect(new Set(texts)).toEqual(new Set(['空也上人', '一遍上人', '法然', '親鸞']))
    expect(result!.choices[result!.correctIndex].text).toBe('空也上人')
    expect(result!.choices[result!.correctIndex].correct).toBe(true)
    for (const c of result!.choices) {
      if (c.text !== '空也上人') expect(c.correct).toBe(false)
    }
  })

  it('ask が無い・type が q12 でなければ null', () => {
    expect(generateQ12Question(undefined, seededRandom(1))).toBeNull()
    expect(generateQ12Question({ type: 'q9' }, seededRandom(1))).toBeNull()
  })

  it('answerText が無ければ null', () => {
    expect(generateQ12Question({ type: 'q12', distractorTexts: ['a', 'b', 'c'] }, seededRandom(1))).toBeNull()
  })

  it('distractorTexts が3件未満なら null', () => {
    expect(generateQ12Question({ type: 'q12', answerText: 'x', distractorTexts: ['a', 'b'] }, seededRandom(1))).toBeNull()
  })

  it('シャッフルしても正解の位置と内容の対応が一致する（複数 seed で確認）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ12Question(q12Ask, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.choices[result!.correctIndex].text).toBe('空也上人')
    }
  })
})
