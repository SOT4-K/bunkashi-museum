import { describe, expect, it } from 'vitest'
import { generateQ9Question, generateQ9QuestionFromIds } from '../q9'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Work } from '../../types'

// 作者条件で判定できる構成: hokusai1/hokusai2 は北斎、hiroshige1/hiroshige2/hiroshige3 は広重。
const hokusai1 = makeWork({ id: 'hokusai1', era: 'tenpyo', category: 'painting', artist: '葛飾北斎' })
const hokusai2 = makeWork({ id: 'hokusai2', era: 'hakuho', category: 'painting', artist: '葛飾北斎' })
const hiroshige1 = makeWork({ id: 'hiroshige1', era: 'asuka', category: 'painting', artist: '歌川広重' })
const hiroshige2 = makeWork({ id: 'hiroshige2', era: 'konin-jogan', category: 'painting', artist: '歌川広重' })
const hiroshige3 = makeWork({ id: 'hiroshige3', era: 'tenpyo', category: 'painting', artist: '歌川広重' })

const artistPool: Work[] = [hokusai1, hokusai2, hiroshige1, hiroshige2, hiroshige3]

// era のみで判定できる構成（artist/holder/style は無し）。同カテゴリ・別時代の作品が3件必要。
const eraOnlyTarget = makeWork({ id: 'e0', era: 'tenpyo', category: 'sculpture' })
const eraOnlyPool: Work[] = [
  eraOnlyTarget,
  makeWork({ id: 'e1', era: 'hakuho', category: 'sculpture' }),
  makeWork({ id: 'e2', era: 'asuka', category: 'sculpture' }),
  makeWork({ id: 'e3', era: 'konin-jogan', category: 'sculpture' }),
]

describe('generateQ9Question（正パターン）', () => {
  it('artist スロットで生成できる: correctWork は target、distractorWorks は artist が違う3件', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.reversed).toBe(false)
      expect(result!.slot).toBe('artist')
      expect(result!.correctWork.id).toBe('hokusai1')
      expect(result!.distractorWorks).toHaveLength(3)
      for (const d of result!.distractorWorks) {
        expect(d.artist).not.toBe('葛飾北斎')
        expect(d.id).not.toBe('hokusai1')
      }
    }
  })

  it('artist が無い作品では era スロットにフォールバックする', () => {
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.slot).toBe('era')
    expect(result!.correctWork.id).toBe('e0')
    for (const d of result!.distractorWorks) {
      expect(d.era).not.toBe('tenpyo')
    }
  })

  it('同カテゴリの候補が足りなければ null', () => {
    const lonely = makeWork({ id: 'lonely', era: 'tenpyo', category: 'garden' })
    const result = generateQ9Question(lonely, [lonely, ...artistPool], testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('distractorWorks に target 自身は含まれない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed))
      expect(result!.distractorWorks.some((d) => d.id === 'hokusai1')).toBe(false)
    }
  })
})

describe('generateQ9Question（逆パターン: 合わない1枚）', () => {
  it('distractorWorks 3件が同じ値を共有し、target はその値を持たない（正解は target のまま）', () => {
    // hiroshige1/hiroshige2/hiroshige3 が広重で共有。hokusai1 は北斎なので「合わない1枚」
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(seed), { reversed: true })
      expect(result).not.toBeNull()
      expect(result!.reversed).toBe(true)
      expect(result!.correctWork.id).toBe('hokusai1')
      expect(result!.distractorWorks).toHaveLength(3)
      const distractorArtists = new Set(result!.distractorWorks.map((d) => d.artist))
      expect(distractorArtists.size).toBe(1)
      expect(distractorArtists.has('葛飾北斎')).toBe(false)
    }
  })

  it('3件共有する値が見つからなければ null', () => {
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1), { reversed: true })
    // eraOnlyPool は3件とも別々の era なので、共有する値（3件以上）が無い
    expect(result).toBeNull()
  })
})

// 修正の仕様（M2-09〜11）: スロット優先順位を holder→artist→technique→era に変更。
const multiSlotTarget = makeWork({ id: 'ms1', era: 'tenpyo', category: 'sculpture', holder: '興福寺', artist: '運慶' })
const multiSlotPool: Work[] = [
  multiSlotTarget,
  makeWork({ id: 'ms2', era: 'hakuho', category: 'sculpture', holder: '東大寺', artist: '快慶' }),
  makeWork({ id: 'ms3', era: 'asuka', category: 'sculpture', holder: '東寺', artist: '快慶' }),
  makeWork({ id: 'ms4', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', artist: '快慶' }),
]

describe('スロット優先順位（修正の仕様: holder→artist→technique→era）', () => {
  it('holder と artist の両方で生成できる作品では holder を優先する', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateQ9Question(multiSlotTarget, multiSlotPool, testEras, seededRandom(seed))
      expect(result?.slot).toBe('holder')
    }
  })

  it('technique のみで判定できる作品では technique スロットが使われる（style より先）', () => {
    const techTarget = makeWork({ id: 'te1', era: 'tenpyo', category: 'craft', technique: '乾漆' })
    const techPool: Work[] = [
      techTarget,
      makeWork({ id: 'te2', era: 'hakuho', category: 'craft', technique: '塑像' }),
      makeWork({ id: 'te3', era: 'asuka', category: 'craft', technique: '木造' }),
      makeWork({ id: 'te4', era: 'konin-jogan', category: 'craft', technique: '金銅' }),
    ]
    const result = generateQ9Question(techTarget, techPool, testEras, seededRandom(1))
    expect(result?.slot).toBe('technique')
  })

  it('technique が空文字（未設定）の作品では technique を飛ばして era にフォールバックする', () => {
    // testFixtures.makeWork のデフォルト technique は '' なので、eraOnlyTarget は
    // holder/artist/style/technique すべて「値なし」扱いになり era に落ちる。
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1))
    expect(result?.slot).toBe('era')
  })
})

describe('avoidSlots / preferredSlot オプション（修正の仕様: ask.slot・era 1セット1問まで）', () => {
  it('avoidSlots で指定したスロットは試さない（避けた結果 null になることもある）', () => {
    const result = generateQ9Question(eraOnlyTarget, eraOnlyPool, testEras, seededRandom(1), { avoidSlots: ['era'] })
    // eraOnlyPool は era でしか判定できない構成なので、era を避けると生成できない
    expect(result).toBeNull()
  })

  it('avoidSlots で holder を避けると、holder より優先度の低い artist にフォールバックする', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateQ9Question(multiSlotTarget, multiSlotPool, testEras, seededRandom(seed), {
        avoidSlots: ['holder'],
      })
      expect(result?.slot).toBe('artist')
    }
  })

  it('preferredSlot を指定すると、通常の優先順位より先にそのスロットを試す（ask.slot の反映）', () => {
    for (let seed = 0; seed < 5; seed++) {
      const result = generateQ9Question(multiSlotTarget, multiSlotPool, testEras, seededRandom(seed), {
        preferredSlot: 'artist',
      })
      expect(result?.slot).toBe('artist')
    }
  })

  it('preferredSlot がその作品で使えない値なら、通常の優先順位にフォールバックする', () => {
    // hokusai1 は style を持たないので、preferredSlot: style は使えず artist に落ちる
    const result = generateQ9Question(hokusai1, artistPool, testEras, seededRandom(1), { preferredSlot: 'style' })
    expect(result?.slot).toBe('artist')
  })
})

// 8章「二段構え」: writer が answerId/distractorIds を直接指定するデータ形。
describe('generateQ9QuestionFromIds（8章「二段構え」: writer 指定の answerId/distractorIds）', () => {
  it('distractorIds が3件そろっていれば、そのまま使う（algorithmic な選定はしない）', () => {
    const result = generateQ9QuestionFromIds(multiSlotPool, 'ms1', ['ms2', 'ms3', 'ms4'], testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.correctWork.id).toBe('ms1')
    expect(result!.conditionText).toBe('') // stem 側で表示するため conditionText は使わない
    expect(new Set(result!.distractorWorks.map((w) => w.id))).toEqual(new Set(['ms2', 'ms3', 'ms4']))
  })

  it('distractorIds が不足していれば、同カテゴリ・近い時代のロジックで不足分を補充する', () => {
    const result = generateQ9QuestionFromIds(multiSlotPool, 'ms1', ['ms2'], testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.distractorWorks).toHaveLength(3)
    expect(result!.distractorWorks.some((w) => w.id === 'ms2')).toBe(true)
    // 補充分は multiSlotPool の残り（ms3/ms4）から選ばれる
    for (const w of result!.distractorWorks) {
      expect(['ms2', 'ms3', 'ms4']).toContain(w.id)
    }
  })

  it('answerId が pool に無ければ null（生成失敗として扱い、呼び出し側で次善にフォールバックする）', () => {
    const result = generateQ9QuestionFromIds(multiSlotPool, 'not-in-pool', ['ms2', 'ms3', 'ms4'], testEras, seededRandom(1))
    expect(result).toBeNull()
  })

  it('distractorIds を省略しても補充ロジックだけで3件そろえば生成できる', () => {
    const result = generateQ9QuestionFromIds(multiSlotPool, 'ms1', undefined, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.distractorWorks).toHaveLength(3)
  })
})
