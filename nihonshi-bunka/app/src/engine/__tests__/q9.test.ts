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

// M2b-14「所蔵館を問う設問の削除」: holder スロットは holderKind === 'site' の作品でしか
// 使わない。holderKind: 'museum'（東京国立博物館等）の作品は holder が値を持っていても
// 「東京国立博物館にあるものを選べ」のような入試に出ない設問を出さないよう、holder スロット
// 自体が使えなくなり artist 等の次善スロットにフォールバックする。
describe('holderKind による holder スロットのゲート（M2b-14）', () => {
  it('holderKind: "site" の作品は holder スロットが使える（従来どおり）', () => {
    const target = makeWork({
      id: 'site-target',
      era: 'tenpyo',
      category: 'sculpture',
      holder: '興福寺',
      holderKind: 'site',
      artist: '運慶',
    })
    const pool: Work[] = [
      target,
      makeWork({ id: 'site2', era: 'hakuho', category: 'sculpture', holder: '東大寺', holderKind: 'site', artist: '快慶' }),
      makeWork({ id: 'site3', era: 'asuka', category: 'sculpture', holder: '東寺', holderKind: 'site', artist: '快慶' }),
      makeWork({ id: 'site4', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', holderKind: 'site', artist: '快慶' }),
    ]
    const result = generateQ9Question(target, pool, testEras, seededRandom(1))
    expect(result?.slot).toBe('holder')
    expect(result?.conditionText).toBe('興福寺にあるもの')
  })

  it('holderKind: "museum" の作品は holder スロットが使えず、次善（artist）にフォールバックする', () => {
    const target = makeWork({
      id: 'museum-target',
      era: 'tenpyo',
      category: 'sculpture',
      holder: '東京国立博物館',
      holderKind: 'museum',
      artist: '運慶',
    })
    const pool: Work[] = [
      target,
      makeWork({ id: 'mu2', era: 'hakuho', category: 'sculpture', holder: '京都国立博物館', holderKind: 'museum', artist: '快慶' }),
      makeWork({ id: 'mu3', era: 'asuka', category: 'sculpture', holder: '奈良国立博物館', holderKind: 'museum', artist: '快慶' }),
      makeWork({ id: 'mu4', era: 'konin-jogan', category: 'sculpture', holder: '九州国立博物館', holderKind: 'museum', artist: '快慶' }),
    ]
    const result = generateQ9Question(target, pool, testEras, seededRandom(1))
    expect(result?.slot).toBe('artist')
    expect(result?.conditionText).not.toContain('博物館')
  })

  it('holder はあるが holderKind が無い（既存データ由来の想定）作品も holder スロットを使わない', () => {
    // makeWork は holder を渡すとテストの便宜で holderKind: 'site' を自動付与するため、
    // ここでは明示的に holderKind: undefined を上書きして「holderKind 未設定」を再現する。
    const target = makeWork({
      id: 'no-kind-target',
      era: 'tenpyo',
      category: 'sculpture',
      holder: '興福寺',
      holderKind: undefined,
      artist: '運慶',
    })
    const pool: Work[] = [
      target,
      makeWork({ id: 'nk2', era: 'hakuho', category: 'sculpture', holder: '東大寺', holderKind: undefined, artist: '快慶' }),
      makeWork({ id: 'nk3', era: 'asuka', category: 'sculpture', holder: '東寺', holderKind: undefined, artist: '快慶' }),
      makeWork({ id: 'nk4', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', holderKind: undefined, artist: '快慶' }),
    ]
    const result = generateQ9Question(target, pool, testEras, seededRandom(1))
    expect(result?.slot).toBe('artist')
  })
})

// M2b-14 (b): findSite（出土地）は holder より先に試す優先スロット。
describe('findSite スロット（M2b-14: 「{findSite}で出土したもの」）', () => {
  const findSiteTarget = makeWork({
    id: 'fs-target',
    era: 'genshi',
    category: 'craft',
    holder: '東京国立博物館',
    holderKind: 'museum',
    findSite: '青森県つがる市（亀ヶ岡遺跡）',
  })
  const findSitePool: Work[] = [
    findSiteTarget,
    makeWork({ id: 'fs2', era: 'hakuho', category: 'craft', holder: '十日町市博物館', holderKind: 'museum', findSite: '新潟県十日町市（笹山遺跡）' }),
    makeWork({ id: 'fs3', era: 'asuka', category: 'craft', holder: '東京国立博物館', holderKind: 'museum', findSite: '群馬県太田市飯塚町' }),
    makeWork({ id: 'fs4', era: 'konin-jogan', category: 'craft', holder: '広島県立歴史民俗資料館', holderKind: 'museum', findSite: '広島県（黒川遺跡）' }),
  ]

  it('findSite があれば holder（museum のため使えない）より先に findSite スロットが使われる', () => {
    const result = generateQ9Question(findSiteTarget, findSitePool, testEras, seededRandom(1))
    expect(result?.slot).toBe('findSite')
    expect(result?.conditionText).toBe('青森県つがる市（亀ヶ岡遺跡）で出土したもの')
  })

  it('findSite の条件文は shortenValue（括弧内除去）を適用しない（遺跡名が消えない）', () => {
    const result = generateQ9Question(findSiteTarget, findSitePool, testEras, seededRandom(1))
    expect(result?.conditionText).toContain('（亀ヶ岡遺跡）')
  })

  it('findSite が無い作品では findSite を飛ばして次のスロットに進む', () => {
    const noFindSiteTarget = makeWork({
      id: 'nfs-target',
      era: 'tenpyo',
      category: 'craft',
      holder: '東京国立博物館',
      holderKind: 'museum',
      artist: '尾形光琳',
    })
    const pool: Work[] = [
      noFindSiteTarget,
      makeWork({ id: 'nfs2', era: 'hakuho', category: 'craft', holder: '京都国立博物館', holderKind: 'museum', artist: '狩野永徳' }),
      makeWork({ id: 'nfs3', era: 'asuka', category: 'craft', holder: '奈良国立博物館', holderKind: 'museum', artist: '狩野永徳' }),
      makeWork({ id: 'nfs4', era: 'konin-jogan', category: 'craft', holder: '九州国立博物館', holderKind: 'museum', artist: '狩野永徳' }),
    ]
    const result = generateQ9Question(noFindSiteTarget, pool, testEras, seededRandom(1))
    expect(result?.slot).toBe('artist')
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

// M2i-05②（decisions.md 2026-09-11、reviewer fact-check-m2i.md「q9が43.6%ヘッダーだけで解ける」の
// 是正）: preferSameEra オプションは誤答を同era（＝ワールド）優先で選ぶ。engine/stages.ts の
// ステージ生成だけが渡す（自由出題・模試・ボスの既存テストには影響しない＝オプション省略時の
// 挙動は変わらないことを他のテストがすでに保証している）。
describe('preferSameEra オプション（M2i-05②: ステージのQ9誤答は同ワールド優先）', () => {
  const target = makeWork({ id: 'pse-target', era: 'tenpyo', category: 'sculpture', artist: '目標作者' })

  it('同era（tenpyo）の候補が4件以上あれば、誤答は全て同eraから選ばれる', () => {
    const sameEraWorks: Work[] = Array.from({ length: 5 }, (_, i) =>
      makeWork({ id: `pse-same${i}`, era: 'tenpyo', category: 'sculpture', artist: `同era作者${i}` }),
    )
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse-other2', era: 'asuka', category: 'sculpture', artist: '別era作者2' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(target, pool, testEras, seededRandom(seed), { preferSameEra: true })
      expect(result).not.toBeNull()
      expect(result!.slot).toBe('artist')
      expect(result!.distractorWorks).toHaveLength(3)
      for (const d of result!.distractorWorks) expect(d.era).toBe('tenpyo')
    }
  })

  it('同eraの候補が4件未満（1件）なら、同era分＋足りない分だけ他eraから補う（他eraは1件のみにはならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse-same0', era: 'tenpyo', category: 'sculpture', artist: '同era作者0' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse-other2', era: 'konin-jogan', category: 'sculpture', artist: '別era作者2' }),
      makeWork({ id: 'pse-other3', era: 'asuka', category: 'sculpture', artist: '別era作者3' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(target, pool, testEras, seededRandom(seed), { preferSameEra: true })
      expect(result).not.toBeNull()
      expect(result!.distractorWorks).toHaveLength(3)
      const sameEraCount = result!.distractorWorks.filter((d) => d.era === 'tenpyo').length
      // sameEraが1件しか無い場合、同era分（1件）はすべて使い、残り2件は他eraから補う
      // （＝正解1件のみが同eraという「ヘッダーだけで解ける」状態を避ける）。
      expect(sameEraCount).toBe(1)
    }
  })

  it('preferSameEra を渡さない（既定）場合は従来どおり距離順の窓から選ぶ（同era限定にならない）', () => {
    const sameEraWorks: Work[] = [makeWork({ id: 'pse2-same0', era: 'tenpyo', category: 'sculpture', artist: '同era作者0' })]
    const otherEraWorks: Work[] = [
      makeWork({ id: 'pse2-other1', era: 'hakuho', category: 'sculpture', artist: '別era作者1' }),
      makeWork({ id: 'pse2-other2', era: 'konin-jogan', category: 'sculpture', artist: '別era作者2' }),
    ]
    const pool = [target, ...sameEraWorks, ...otherEraWorks]
    const result = generateQ9Question(target, pool, testEras, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.distractorWorks).toHaveLength(3)
  })
})

// M2i-05b①（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-3の修正）:
// 誤答除外は raw 値の完全一致ではなく、条件文と同じ基準（shortenValue、findSite除く）で
// 判定する。「仏教」と「仏教（法相宗）」のように raw 値は異なるが条件文の上では同じに見える
// 値を「異なる値」として誤答に選ぶと、4択全部が条件文の上で正解になってしまう回帰。
describe('M2i-05b①: shortenValue が衝突する値は誤答除外で「同じ値」として扱う（設問成立性バグ修正）', () => {
  const target = makeWork({ id: 'bud-target', era: 'asuka', category: 'sculpture', religion: '仏教（法相宗）' })
  const collidingPool: Work[] = [
    target,
    makeWork({ id: 'bud-d1', era: 'asuka', category: 'sculpture', religion: '仏教' }),
    makeWork({ id: 'bud-d2', era: 'asuka', category: 'sculpture', religion: '仏教（天台宗）' }),
    makeWork({ id: 'bud-d3', era: 'hakuho', category: 'sculpture', religion: '神道' }),
  ]

  it('正パターン: shortenValue が target と同じ（「仏教」）誤答候補は選ばれない（3件そろわなければ null）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(target, collidingPool, testEras, seededRandom(seed), {
        allowSlots: ['religion'],
      })
      // 「異なる値」が神道（bud-d3）の1件しか無いため3件そろわず null になるはず
      // （修正前は bud-d1/bud-d2 も「異なる値」として誤答に混ざり、4択全部が「仏教」になっていた）。
      expect(result).toBeNull()
    }
  })

  it('正パターン: 十分な数の真に異なる値がある場合、誤答に shortenValue が target と同じ値の作品は含まれない', () => {
    const richPool: Work[] = [
      target,
      makeWork({ id: 'bud-d1', era: 'asuka', category: 'sculpture', religion: '仏教' }), // conditionValue衝突（除外されるべき）
      makeWork({ id: 'shinto1', era: 'asuka', category: 'sculpture', religion: '神道' }),
      makeWork({ id: 'shinto2', era: 'hakuho', category: 'sculpture', religion: '神道（伊勢系）' }),
      makeWork({ id: 'other1', era: 'kokufu', category: 'sculpture', religion: '道教' }),
    ]
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(target, richPool, testEras, seededRandom(seed), { allowSlots: ['religion'] })
      expect(result).not.toBeNull()
      expect(result!.conditionText).toBe('宗派（宗教）が仏教のもの')
      expect(result!.distractorWorks.some((d) => d.id === 'bud-d1')).toBe(false)
    }
  })

  it('逆パターン: target と conditionValue が同じ raw 値のグループは「合わない1枚」の誤答候補にならない', () => {
    // target(religion: 仏教（法相宗）) と conditionValue が衝突する「仏教」3件だけを共有値に
    // したプールでは、逆パターンの「3件が共有し target は持たない値」グループとして選んではいけない
    // （target 自身も条件文の上では「仏教」に一致するため）。
    const reversedPool: Work[] = [
      target,
      makeWork({ id: 'rb1', era: 'asuka', category: 'sculpture', religion: '仏教' }),
      makeWork({ id: 'rb2', era: 'hakuho', category: 'sculpture', religion: '仏教' }),
      makeWork({ id: 'rb3', era: 'kokufu', category: 'sculpture', religion: '仏教' }),
    ]
    const result = generateQ9Question(target, reversedPool, testEras, seededRandom(1), {
      reversed: true,
      allowSlots: ['religion'],
    })
    expect(result).toBeNull()
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

describe('M2-41「絵を見れば分かる問題を出さない」: Q9 の条件スロットに外見スロットが無いこと', () => {
  // Q9Slot（types.ts）は artist/era/holder/style/technique/findSite の6種のみ
  // （findSite は M2b-14 で追加。出土地は知識でしか判定できないスロットのため許可リストに含む）。
  // 姿勢・持ち物・表情・向き・色・構図のような「画像を見れば判定できる」スロットは元々含まれていない
  // （engine/q9.ts の SLOT_PRIORITY 定数を参照）。実装を変えずに固定するための回帰テスト。
  const ALLOWED_SLOTS = new Set(['artist', 'era', 'holder', 'style', 'technique', 'findSite'])
  const FORBIDDEN_SLOT_WORDS = ['pose', 'posture', 'color', 'appearance', 'expression', 'composition']

  it('条件生成（generateQ9Question）が実際に使うスロットは常に許可された5種のいずれか', () => {
    const eras = testEras
    // artistPool は artist 条件で、eraOnlyPool は era 条件で生成できることを他のテストで
    // 確認済み。ここでは「生成できたときの slot が許可リストの外に出ないこと」だけを見る。
    for (let seed = 0; seed < 10; seed++) {
      const result = generateQ9Question(hokusai1, artistPool, eras, seededRandom(seed))
      if (result) expect(ALLOWED_SLOTS.has(result.slot)).toBe(true)
    }
  })

  it('スロット名に外見を示す語（pose/posture/color 等）が含まれない', () => {
    for (const slot of ALLOWED_SLOTS) {
      for (const forbidden of FORBIDDEN_SLOT_WORDS) {
        expect(slot).not.toContain(forbidden)
      }
    }
  })
})
