// scripts/validate-content.mjs の新チェック（修正の仕様 M2-09〜11）を直接検証する。
// このファイルは app/src の外（work/nihonshi-bunka/scripts/）にあるプレーン Node ESM
// スクリプトだが、下線先作品の答えが本文に書かれていないかのチェック（workTitleLeaksInText）と
// underlines[].ask の値検証（invalidAskFields）を純関数として export しているので、
// ここから直接 import して確認できる（import しても実ファイル読み込み・process.exit は
// 起きない。validate-content.mjs 側の「直接実行時のみ main() を呼ぶ」ガード参照）。
import { describe, expect, it } from 'vitest'
// @ts-expect-error 型定義の無いプレーン .mjs スクリプトを直接 import する
import { workTitleLeaksInText, invalidAskFields, answerLeaksInUnderlineText } from '../../../../scripts/validate-content.mjs'

describe('workTitleLeaksInText（下線先作品の答えが本文に書かれていないかのチェック）', () => {
  it('本文に作品名がそのまま含まれていれば true', () => {
    const work = { title: '法隆寺金堂釈迦三尊像' }
    expect(workTitleLeaksInText(work, '本文中に[[a|法隆寺金堂釈迦三尊像]]がある。')).toBe(true)
  })

  it('本文中のマーカーの下線テキストが概念・場所であり、作品名を含まなければ false', () => {
    const work = { title: '法隆寺金堂釈迦三尊像' }
    expect(workTitleLeaksInText(work, '本文中に[[a|鞍作鳥（止利仏師）]]が北魏様式で仏像を制作した。')).toBe(false)
  })

  it('work や title が無い・text が文字列でないときは false（例外を投げない）', () => {
    expect(workTitleLeaksInText(null, '本文')).toBe(false)
    expect(workTitleLeaksInText({ title: '' }, '本文')).toBe(false)
    expect(workTitleLeaksInText({ title: 'X' }, undefined)).toBe(false)
  })
})

describe('invalidAskFields（underlines[].ask の値検証。8章「二段構え」で slot は省略可になった）', () => {
  it('slot・type とも許可された値なら空配列', () => {
    expect(invalidAskFields({ slot: 'holder', type: 'q9' })).toEqual([])
    expect(invalidAskFields({ slot: 'artist', type: 'q9' })).toEqual([])
    expect(invalidAskFields({ slot: 'technique', type: 'q4' })).toEqual([])
    expect(invalidAskFields({ slot: 'era', type: 'q9' })).toEqual([])
    expect(invalidAskFields({ slot: 'subject', type: 'q4' })).toEqual([])
    expect(invalidAskFields({ slot: 'holder', type: 'q10' })).toEqual([])
    expect(invalidAskFields({ slot: 'holder', type: 'q11' })).toEqual([])
  })

  it('q12（9章）は type として有効', () => {
    expect(invalidAskFields({ type: 'q12', answerText: 'x', distractorTexts: ['a', 'b', 'c'] })).toEqual([])
  })

  it('slot が無くても type さえあれば有効（8章の二段構えデータは stem に条件を書くため slot を省略することが多い）', () => {
    expect(invalidAskFields({ type: 'q9', stem: 'x', answerId: 'w1' })).toEqual([])
  })

  it('type が不正な値なら "type" を含む', () => {
    expect(invalidAskFields({ slot: 'holder', type: 'q99' })).toEqual(['type'])
  })

  it('slot が不正な値なら "slot" を含む', () => {
    expect(invalidAskFields({ slot: 'bogus', type: 'q9' })).toEqual(['slot'])
  })

  it('両方不正なら両方含む', () => {
    expect(invalidAskFields({ slot: 'bogus', type: 'q99' })).toEqual(['type', 'slot'])
  })

  it('ask が無い・空オブジェクトなら type のみ不正（slot は省略可になったため）', () => {
    expect(invalidAskFields(null)).toEqual(['type'])
    expect(invalidAskFields({})).toEqual(['type'])
  })
})

describe('answerLeaksInUnderlineText（8章「二段構え」: 下線に答えの材質・図様・作品名を書かない、の機械検査）', () => {
  const work = { title: '広隆寺弥勒菩薩半跏思惟像', technique: '赤松の一木造', subject: null }

  it('下線の文に作品名がそのまま含まれていれば "title" を含む', () => {
    expect(answerLeaksInUnderlineText(work, '広隆寺弥勒菩薩半跏思惟像で知られる寺院')).toEqual(['title'])
  })

  it('下線の文に technique がそのまま含まれていれば "technique" を含む', () => {
    expect(answerLeaksInUnderlineText(work, '赤松の一木造の仏像を安置する寺院')).toEqual(['technique'])
  })

  it('下線が寺院名など、答えの手がかりを含まなければ空配列', () => {
    expect(answerLeaksInUnderlineText(work, '広隆寺')).toEqual([])
  })

  it('work や underlineText が無ければ空配列（例外を投げない）', () => {
    expect(answerLeaksInUnderlineText(null, '本文')).toEqual([])
    expect(answerLeaksInUnderlineText(work, '')).toEqual([])
    expect(answerLeaksInUnderlineText(work, undefined)).toEqual([])
  })
})
