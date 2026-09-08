// scripts/validate-content.mjs の新チェック（修正の仕様 M2-09〜11）を直接検証する。
// このファイルは app/src の外（work/nihonshi-bunka/scripts/）にあるプレーン Node ESM
// スクリプトだが、下線先作品の答えが本文に書かれていないかのチェック（workTitleLeaksInText）と
// underlines[].ask の値検証（invalidAskFields）を純関数として export しているので、
// ここから直接 import して確認できる（import しても実ファイル読み込み・process.exit は
// 起きない。validate-content.mjs 側の「直接実行時のみ main() を呼ぶ」ガード参照）。
import { describe, expect, it } from 'vitest'
// @ts-expect-error 型定義の無いプレーン .mjs スクリプトを直接 import する
import { workTitleLeaksInText, invalidAskFields, answerLeaksInUnderlineText, findAppearanceWords, findHolderWords } from '../../../../scripts/validate-content.mjs'

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

describe('findAppearanceWords（M2-41「絵を見れば分かる問題を出さない」。実機フィードバック2 10.1章）', () => {
  it('オーナーが実機で発見した実例2件を検出する', () => {
    expect(findAppearanceWords('水瓶を手にする木彫の菩薩像はどれか')).toEqual(
      expect.arrayContaining(['水瓶', '手にする']),
    )
    expect(findAppearanceWords('片足を組み、頬に指をあてて考える姿である')).toEqual(
      expect.arrayContaining(['片足', '足を組', '頬に指']),
    )
  })

  it('「〜色の」のような色の記述を正規表現で検出する', () => {
    expect(findAppearanceWords('金色の光背を持つ')).toContain('◯色の')
    expect(findAppearanceWords('朱色の柱が並ぶ')).toContain('◯色の')
  })

  it('知識でしか判定できない記述（作者・所蔵・時代・製法・由来）には反応しない', () => {
    expect(findAppearanceWords('作者が葛飾北斎であるもの')).toEqual([])
    expect(findAppearanceWords('法隆寺に安置される、赤松の一木造の像')).toEqual([])
    expect(findAppearanceWords('化政期に刊行された連作の一図')).toEqual([])
  })

  it('text が無い・文字列でなければ空配列（例外を投げない）', () => {
    expect(findAppearanceWords(undefined)).toEqual([])
    expect(findAppearanceWords(null)).toEqual([])
    expect(findAppearanceWords('')).toEqual([])
  })
})

describe('findHolderWords（M2b-14「所蔵館を問う設問の削除」: facts/falseStatements/ask.stemの所蔵語検出）', () => {
  it('実際に見つかった3件の実例（doshoku-saie/fujin-raijin-sotatsu/yamadadera-butsuzu修正前）を検出する', () => {
    expect(findHolderWords('皇居三の丸尚蔵館が所蔵する')).toEqual(['尚蔵館'])
    expect(findHolderWords('現在は東京国立博物館が所蔵する')).toEqual(['博物館'])
    expect(findHolderWords('興福寺国宝館にある（もとは山田寺の本尊）')).toEqual(['国宝館'])
  })

  it('美術館・文庫・記念館・図書館・資料館・コレクションも検出する', () => {
    expect(findHolderWords('三井記念美術館が所蔵する')).toContain('美術館')
    expect(findHolderWords('市立記念館が所蔵する')).toContain('記念館')
    expect(findHolderWords('国立国会図書館にある')).toContain('図書館')
    expect(findHolderWords('広島県立歴史民俗資料館が所蔵する')).toContain('資料館')
    expect(findHolderWords('個人コレクションに含まれる')).toContain('コレクション')
  })

  it('寺社・堂・遺跡などの site 表現には反応しない（holderKind: site を誤検出しない）', () => {
    expect(findHolderWords('興福寺にある（もとは山田寺の本尊）')).toEqual([])
    expect(findHolderWords('青森県つがる市（亀ヶ岡遺跡）で出土した')).toEqual([])
    expect(findHolderWords('法隆寺金堂に安置される')).toEqual([])
  })

  it('作品の特定用の記法「（東京国立博物館蔵）」も語としては検出する（エラーにするかは呼び出し側の判断）', () => {
    // M2b-14チケット: passages内の「（東京国立博物館蔵）」2箇所は作品特定用の記法として残す
    // 決定のため、findHolderWords自体は検出するが scripts/validate-content.mjs 側で警告に留める
    // （エラーにしない）。ここでは検出関数自体が正しく反応することだけを確認する。
    expect(findHolderWords('次の屏風（東京国立博物館蔵）について述べた文として')).toContain('博物館')
  })

  it('text が無い・文字列でなければ空配列（例外を投げない）', () => {
    expect(findHolderWords(undefined)).toEqual([])
    expect(findHolderWords(null)).toEqual([])
    expect(findHolderWords('')).toEqual([])
  })
})
