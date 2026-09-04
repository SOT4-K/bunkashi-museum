import { describe, expect, it } from 'vitest'
import {
  checkPassageConsistency,
  excerptAroundUnderline,
  excerptSegmentsForUnderline,
  extractUnderlineKeys,
  pickUnderlineTargetId,
  splitPassageText,
} from '../passage'

const text = '平安時代後期、[[a|富貴寺大堂]]や[[b|白水阿弥陀堂]]のような阿弥陀堂建築が各地に建てられた。[[c|鳥獣人物戯画]]のような作品も生まれた。'

describe('splitPassageText', () => {
  it('地の文と下線部を出現順に分解する', () => {
    const segments = splitPassageText(text)
    expect(segments[0]).toEqual({ type: 'text', value: '平安時代後期、' })
    expect(segments[1]).toEqual({ type: 'underline', key: 'a', value: '富貴寺大堂' })
    expect(segments.some((s) => s.type === 'underline' && s.key === 'c')).toBe(true)
  })

  it('マーカーが無い本文はテキスト1件だけになる', () => {
    expect(splitPassageText('マーカーなし')).toEqual([{ type: 'text', value: 'マーカーなし' }])
  })

  it('セグメントを結合すると元の本文の可視テキストと一致する（マーカー記法を除く）', () => {
    const segments = splitPassageText(text)
    const joined = segments.map((s) => s.value).join('')
    expect(joined).toBe('平安時代後期、富貴寺大堂や白水阿弥陀堂のような阿弥陀堂建築が各地に建てられた。鳥獣人物戯画のような作品も生まれた。')
  })
})

describe('extractUnderlineKeys', () => {
  it('出現順にキーを返す', () => {
    expect(extractUnderlineKeys(text)).toEqual(['a', 'b', 'c'])
  })
})

describe('checkPassageConsistency', () => {
  it('本文のマーカーと underlines[].key が一致していれば ok', () => {
    const result = checkPassageConsistency({
      text,
      underlines: [
        { key: 'a', workIds: ['w1'] },
        { key: 'b', workIds: ['w2'] },
        { key: 'c', workIds: ['w3'] },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.missingInUnderlines).toEqual([])
    expect(result.missingInText).toEqual([])
  })

  it('underlines に無いキーが本文にあれば missingInUnderlines に入る', () => {
    const result = checkPassageConsistency({
      text,
      underlines: [
        { key: 'a', workIds: ['w1'] },
        { key: 'b', workIds: ['w2'] },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.missingInUnderlines).toEqual(['c'])
  })

  it('本文に出現しない underlines[].key は missingInText に入る', () => {
    const result = checkPassageConsistency({
      text,
      underlines: [
        { key: 'a', workIds: ['w1'] },
        { key: 'b', workIds: ['w2'] },
        { key: 'c', workIds: ['w3'] },
        { key: 'd', workIds: ['w4'] },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.missingInText).toEqual(['d'])
  })

  it('本文中で同じキーが2回使われていれば duplicateInText に入る', () => {
    const dupText = '[[a|X]]と[[a|Y]]'
    const result = checkPassageConsistency({ text: dupText, underlines: [{ key: 'a', workIds: ['w1'] }] })
    expect(result.ok).toBe(false)
    expect(result.duplicateInText).toEqual(['a'])
  })
})

describe('excerptAroundUnderline', () => {
  it('本文全体をプレーンテキストで返す（マーカー記法を除く）', () => {
    const excerpt = excerptAroundUnderline({ text }, 'b')
    expect(excerpt).toContain('白水阿弥陀堂')
    expect(excerpt).not.toContain('[[')
  })

  it('存在しないキーなら空文字', () => {
    expect(excerptAroundUnderline({ text }, 'zzz')).toBe('')
  })
})

const longSentenceText =
  '平安時代後期、地方の有力者によって阿弥陀堂建築である[[a|富貴寺大堂]]が豊後国に建立された。' +
  '同じころ陸奥国では奥州藤原氏によって[[b|白水阿弥陀堂]]をはじめとする阿弥陀堂が各地に建てられた。'

describe('excerptSegmentsForUnderline（M2-21: 下線を含む1〜2文だけを抜き出す）', () => {
  it('対象の下線を含む文だけを返す（他の文は含まない。各文が40字以上あるため前文を含めない）', () => {
    const segments = excerptSegmentsForUnderline(longSentenceText, 'a')
    const joined = segments.map((s) => s.value).join('')
    expect(joined).toContain('富貴寺大堂')
    expect(joined).not.toContain('白水阿弥陀堂')
  })

  it('対象の文が短ければ前の文も含めて2文にする', () => {
    // 「c」を含む文は短い（15字未満）ため、前の文（阿弥陀堂建築の文）も含まれる。
    const shortText = '前置き。[[a|短い下線]]あり。'
    const segments = excerptSegmentsForUnderline(shortText, 'a')
    const joined = segments.map((s) => s.value).join('')
    expect(joined).toContain('前置き')
    expect(joined).toContain('短い下線')
  })

  it('下線ハイライト用のセグメント種別を保つ（対象キーは type: underline）', () => {
    const segments = excerptSegmentsForUnderline(text, 'b')
    const underlineSeg = segments.find((s) => s.type === 'underline' && s.key === 'b')
    expect(underlineSeg).toEqual({ type: 'underline', key: 'b', value: '白水阿弥陀堂' })
  })

  it('存在しないキーなら本文全体にフォールバックする（異常な underline key への防御）', () => {
    const segments = excerptSegmentsForUnderline(text, 'zzz')
    expect(segments).toEqual(splitPassageText(text))
  })
})

describe('pickUnderlineTargetId', () => {
  it('workIds の先頭から見て出題プールにある最初の id を返す', () => {
    const available = new Set(['w2', 'w3'])
    expect(pickUnderlineTargetId({ key: 'a', workIds: ['w1', 'w2', 'w3'] }, available)).toBe('w2')
  })

  it('どれもプールに無ければ null', () => {
    const available = new Set(['w9'])
    expect(pickUnderlineTargetId({ key: 'a', workIds: ['w1', 'w2'] }, available)).toBeNull()
  })
})
