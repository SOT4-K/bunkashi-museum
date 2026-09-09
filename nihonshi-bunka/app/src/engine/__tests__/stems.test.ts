// engine/stems.ts（M2e-02。research/stem-patterns.md 2章のテンプレートから生成する設問文）。
import { describe, expect, it } from 'vitest'
import { underlineStem, standaloneStem, buildEngineStem } from '../stems'
import type { QuestionType } from '../../types'

const ALL_TYPES: QuestionType[] = ['q1', 'q2', 'q3', 'q4', 'q6', 'q8', 'q9', 'q10', 'q12', 'q13', 'q14']

describe('underlineStem', () => {
  it('全ての型で「下線部{key}」を含む', () => {
    for (const type of ALL_TYPES) {
      expect(underlineStem(type, 'a')).toContain('下線部a')
    }
  })

  it('下線キーが変われば文言も変わる（key がそのまま反映される）', () => {
    expect(underlineStem('q4', 'c')).toContain('下線部c')
    expect(underlineStem('q4', 'x9')).toContain('下線部x9')
  })

  it('q4: reversed で「適切でない」、通常は「適切な」', () => {
    expect(underlineStem('q4', 'a', { reversed: true })).toContain('適切でない')
    expect(underlineStem('q4', 'a', { reversed: false })).not.toContain('適切でない')
    expect(underlineStem('q4', 'a')).toContain('適切な')
  })

  it('q13: reversed で「誤っている」、通常は「正しい」', () => {
    expect(underlineStem('q13', 'a', { reversed: true })).toContain('誤っている')
    expect(underlineStem('q13', 'a', { reversed: false })).toContain('正しい')
  })

  it('q9: conditionText を渡すとそのまま文中に使う。省略時は既定の条件文になる', () => {
    expect(underlineStem('q9', 'a', { conditionText: '作者が葛飾北斎であるもの' })).toContain('作者が葛飾北斎であるもの')
    expect(underlineStem('q9', 'a')).toContain('条件に合う作品')
  })
})

describe('standaloneStem', () => {
  it('どの型でも「下線部」を含まない（下線に紐づかない単独問題用）', () => {
    for (const type of ALL_TYPES) {
      expect(standaloneStem(type)).not.toContain('下線部')
    }
  })

  it('q4/q13 の reversed 分岐も underlineStem と同じ意味で切り替わる', () => {
    expect(standaloneStem('q4', { reversed: true })).toContain('適切でない')
    expect(standaloneStem('q13', { reversed: true })).toContain('誤っている')
    expect(standaloneStem('q13', { reversed: false })).toContain('正しい')
  })

  it('q9: conditionText を渡すとそのまま使う', () => {
    expect(standaloneStem('q9', { conditionText: '技法が蒔絵であるもの' })).toContain('技法が蒔絵であるもの')
  })
})

describe('buildEngineStem', () => {
  it('underlineKey があれば underlineStem、無ければ standaloneStem と同じ結果になる', () => {
    expect(buildEngineStem('q4', 'a')).toBe(underlineStem('q4', 'a'))
    expect(buildEngineStem('q4', undefined)).toBe(standaloneStem('q4'))
  })
})
