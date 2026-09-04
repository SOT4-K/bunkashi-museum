import { describe, expect, it, vi } from 'vitest'
import { appendOrderQuestionIfDue, buildThemeQuestionForWork, buildThemeSetQuestions, selectLearnThemeSets } from '../themeSet'
import { createItemProgress } from '../srs'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Passage, ProgressState, Work } from '../../types'

// Q9（artist条件）が生成できる作品群。
const targetWithArtist = makeWork({ id: 't1', era: 'tenpyo', category: 'painting', artist: '葛飾北斎' })
const pool: Work[] = [
  targetWithArtist,
  makeWork({ id: 't2', era: 'hakuho', category: 'painting', artist: '歌川広重' }),
  makeWork({ id: 't3', era: 'asuka', category: 'painting', artist: '歌川広重' }),
  makeWork({ id: 't4', era: 'konin-jogan', category: 'painting', artist: '歌川広重' }),
]

// facts/falseStatements/artist/style/holder すべて無い、Q1 しか作れない作品。
const bareTarget = makeWork({ id: 'bare1', era: 'tenpyo', category: 'sculpture' })
const barePool: Work[] = [bareTarget, makeWork({ id: 'bare2', era: 'tenpyo', category: 'sculpture' })]

describe('buildThemeQuestionForWork', () => {
  it('Q9 が生成できる作品では q9 を優先して選ぶ', () => {
    const q = buildThemeQuestionForWork(targetWithArtist, pool, testEras, seededRandom(1))
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q9')
    expect(q!.work.id).toBe('t1')
  })

  it('画像を持つ対象（imagePool にある）では、どの拡張型も生成できなくても q1 にフォールバックする（必ず Question を返す）', () => {
    const q = buildThemeQuestionForWork(bareTarget, barePool, testEras, seededRandom(1))
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q1')
    expect(q!.choiceWorks).toHaveLength(2) // barePool には distractor が1件しか無い（4択に満たないがQ1は生成される）
  })

  it('生成される Question は常に画像を持つ（work.image か choiceWorks のどちらか）', () => {
    for (const [target, p] of [
      [targetWithArtist, pool],
      [bareTarget, barePool],
    ] as const) {
      const q = buildThemeQuestionForWork(target, p, testEras, seededRandom(2))
      expect(q).not.toBeNull()
      const hasPromptImage = Boolean(q!.work?.image)
      const hasChoiceImages = q!.choiceWorks.length > 0
      expect(hasPromptImage || hasChoiceImages).toBe(true)
    }
  })
})

describe('buildThemeSetQuestions', () => {
  const passage: Passage = {
    id: 'p1',
    era: 'tenpyo',
    title: 'テスト用リード文',
    text: '本文中に[[a|下線A]]と[[b|下線B]]がある。',
    sources: ['x'],
    underlines: [
      { key: 'a', workIds: ['t1'] },
      { key: 'b', workIds: ['not-in-pool'] },
    ],
  }

  it('workIds がプールに無い下線はスキップし、console.warn を呼ぶ', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = buildThemeSetQuestions(passage, pool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].underlineKey).toBe('a')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('生成した Question に passageId・underlineKey が付く', () => {
    const result = buildThemeSetQuestions(passage, pool, testEras, seededRandom(1))
    expect(result[0].question.passageId).toBe('p1')
    expect(result[0].question.underlineKey).toBe('a')
  })

  it('workIds に複数指定があれば、プールにある最初の作品を対象にする', () => {
    const multiPassage: Passage = {
      ...passage,
      underlines: [{ key: 'a', workIds: ['not-in-pool', 't2'] }],
    }
    const result = buildThemeSetQuestions(multiPassage, pool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.work.id).toBe('t2')
  })
})

// 修正の仕様（M2-09〜11）: ask（下線から出したい設問の型・条件スロット）のテスト用フィクスチャ。
// facts/falseStatements を持たせて Q10・Q4 も生成できるようにする。
function richWork(overrides: Partial<Work> & { id: string }): Work {
  return makeWork({
    facts: [
      { slot: 'other', text: `${overrides.id}正文1` },
      { slot: 'other', text: `${overrides.id}正文2` },
      { slot: 'other', text: `${overrides.id}正文3` },
    ],
    falseStatements: [
      { text: `${overrides.id}誤文1`, why: 'x', verifiedFalse: true },
      { text: `${overrides.id}誤文2`, why: 'x', verifiedFalse: true },
      { text: `${overrides.id}誤文3`, why: 'x', verifiedFalse: true },
    ],
    ...overrides,
  })
}

describe('ask（下線から出したい設問の型・条件スロット。修正の仕様 M2-09〜11）', () => {
  const askTargetA = richWork({ id: 'ask-a', era: 'tenpyo', category: 'sculpture', holder: '興福寺', artist: '運慶' })
  const askPool: Work[] = [
    askTargetA,
    makeWork({ id: 'ask-b', era: 'hakuho', category: 'sculpture', holder: '東大寺', artist: '快慶' }),
    makeWork({ id: 'ask-c', era: 'asuka', category: 'sculpture', holder: '東寺', artist: '快慶' }),
    makeWork({ id: 'ask-d', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', artist: '快慶' }),
  ]

  it('ask.type を指定すると、通常の優先順位（Q9優先）より先にその型を試す', () => {
    // askTargetA は holder/artist 条件で Q9 も生成できるが、ask.type: q4 を指定すれば q4 になる
    const passageWithAsk: Passage = {
      id: 'ask-p1',
      era: 'tenpyo',
      title: 'ask type テスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['ask-a'], ask: { slot: 'artist', type: 'q4' } }],
    }
    const result = buildThemeSetQuestions(passageWithAsk, askPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q4')
    expect(result[0].question.reversed).not.toBe(true)
  })

  it('ask.reversed が true のとき Q4 は「最も不適切なもの」型（誤文が正解）で生成される（reviewer指摘[重大]-1, 2026-09-04 M2-14）', () => {
    const passageWithReversedAsk: Passage = {
      id: 'ask-p1-reversed',
      era: 'tenpyo',
      title: 'ask reversed テスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['ask-a'], ask: { type: 'q4', reversed: true, stem: '最も不適切なものはどれか' } }],
    }
    const result = buildThemeSetQuestions(passageWithReversedAsk, askPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q4')
    expect(result[0].question.reversed).toBe(true)
    // 反転型では、正解の選択肢は falseStatements 由来（誤文）でなければならない
    const q = result[0].question
    const correctText = q.choiceStatements?.[q.correctIndex]?.text
    expect(correctText).toContain('誤文')
  })

  it('ask.slot を指定すると、Q9 の条件スロットとして優先的に試される', () => {
    // askTargetA は holder が優先スロットのはずだが、ask.slot: artist を指定すれば artist になる
    const passageWithAsk: Passage = {
      id: 'ask-p2',
      era: 'tenpyo',
      title: 'ask slot テスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['ask-a'], ask: { slot: 'artist', type: 'q9' } }],
    }
    const result = buildThemeSetQuestions(passageWithAsk, askPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q9')
    expect(result[0].question.q9Slot).toBe('artist')
  })

  it('ask.type で指定した型が生成できなければ、通常の優先順位に落ちる', () => {
    // ask.type: q10 だが facts/falseStatements が無いので Q10 は生成できない → 次善（Q9）に落ちる
    const bare = makeWork({ id: 'ask-bare', era: 'tenpyo', category: 'sculpture', holder: '興福寺' })
    const bareAskPool = [bare, ...askPool.slice(1)]
    const passageWithAsk: Passage = {
      id: 'ask-p3',
      era: 'tenpyo',
      title: 'ask fallback テスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['ask-bare'], ask: { slot: 'holder', type: 'q10' } }],
    }
    const result = buildThemeSetQuestions(passageWithAsk, bareAskPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q9')
  })
})

describe('era をスロットにする Q9 は1セットに1問まで（修正の仕様 M2-09〜11）', () => {
  // holder/artist/style/technique を持たず、era でしか Q9 を生成できない作品群（category: garden）。
  const eraSetA = makeWork({ id: 'era-a', era: 'tenpyo', category: 'garden' })
  const eraSetB = makeWork({ id: 'era-b', era: 'hakuho', category: 'garden' })
  const eraSetOthers = [
    makeWork({ id: 'era-c', era: 'asuka', category: 'garden' }),
    makeWork({ id: 'era-d', era: 'konin-jogan', category: 'garden' }),
  ]
  const eraSetPool = [eraSetA, eraSetB, ...eraSetOthers]

  it('1セット内で era 条件の Q9 は最初の1問だけ（2問目以降は era に落ちず q1 になる）', () => {
    const passage: Passage = {
      id: 'era-set-p',
      era: 'tenpyo',
      title: 'era 1問までテスト',
      text: '本文。[[a|下線A]]と[[b|下線B]]。',
      sources: ['x'],
      underlines: [
        { key: 'a', workIds: ['era-a'] },
        { key: 'b', workIds: ['era-b'] },
      ],
    }
    for (let seed = 0; seed < 5; seed++) {
      const result = buildThemeSetQuestions(passage, eraSetPool, testEras, seededRandom(seed))
      expect(result).toHaveLength(2)
      const eraQ9Count = result.filter((r) => r.question.type === 'q9' && r.question.q9Slot === 'era').length
      expect(eraQ9Count).toBeLessThanOrEqual(1)
      // 2問とも era 以外に条件を作れないため、2問目は q1 にフォールバックしているはず
      const types = result.map((r) => r.question.type)
      expect(types.filter((t) => t === 'q9').length).toBeLessThanOrEqual(1)
    }
  })
})

describe('型の混ぜ方: 同じ型を連続させない（修正の仕様 M2-09〜11。best-effort）', () => {
  it('4作品とも Q9(holder)・Q10 の両方を生成できるとき、隣り合う設問の型が重複しない', () => {
    const s1 = richWork({ id: 's1', era: 'tenpyo', category: 'sculpture', holder: '興福寺', artist: '運慶' })
    const s2 = richWork({ id: 's2', era: 'hakuho', category: 'sculpture', holder: '東大寺', artist: '運慶' })
    const s3 = richWork({ id: 's3', era: 'asuka', category: 'sculpture', holder: '東寺', artist: '運慶' })
    const s4 = richWork({ id: 's4', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', artist: '運慶' })
    const setPool = [s1, s2, s3, s4]
    const passage: Passage = {
      id: 'mix-p',
      era: 'tenpyo',
      title: '型の混ぜ方テスト',
      text: '本文。[[a|A]][[b|B]][[c|C]][[d|D]]',
      sources: ['x'],
      underlines: [
        { key: 'a', workIds: ['s1'] },
        { key: 'b', workIds: ['s2'] },
        { key: 'c', workIds: ['s3'] },
        { key: 'd', workIds: ['s4'] },
      ],
    }
    const result = buildThemeSetQuestions(passage, setPool, testEras, seededRandom(3))
    expect(result).toHaveLength(4)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].question.type).not.toBe(result[i - 1].question.type)
    }
    // Q9・Q10 の両方が使われている（優先順位の固定を崩している証拠）
    const types = new Set(result.map((r) => r.question.type))
    expect(types.has('q9')).toBe(true)
    expect(types.has('q10')).toBe(true)
  })
})

describe('セット内に Q9・Q10 を1問以上保証する（修正の仕様 M2-09〜11）', () => {
  it('ask で全下線が Q9 を避けた結果セットに Q9 が無ければ、生成可能な下線を探して Q9 に作り直す', () => {
    // reserve は holder/artist を持ち Q9 も生成できるが、ask: q4 で Q9 を試させない。
    const reserve = richWork({ id: 'rsv', era: 'tenpyo', category: 'sculpture', holder: '興福寺', artist: '運慶' })
    // plain系は holder/artist/style/technique を持たず、era も全員同じなので Q9 は生成不能。
    const plain2 = richWork({ id: 'p2', era: 'tenpyo', category: 'sculpture' })
    const plain3 = richWork({ id: 'p3', era: 'tenpyo', category: 'sculpture' })
    const plain4 = richWork({ id: 'p4', era: 'tenpyo', category: 'sculpture' })
    const guaranteePool = [reserve, plain2, plain3, plain4]
    const passage: Passage = {
      id: 'guarantee-q9-p',
      era: 'tenpyo',
      title: 'Q9保証テスト',
      text: '本文。[[a|A]][[b|B]][[c|C]][[d|D]]',
      sources: ['x'],
      underlines: [
        { key: 'a', workIds: ['rsv'], ask: { slot: 'artist', type: 'q4' } },
        { key: 'b', workIds: ['p2'] },
        { key: 'c', workIds: ['p3'] },
        { key: 'd', workIds: ['p4'] },
      ],
    }
    const result = buildThemeSetQuestions(passage, guaranteePool, testEras, seededRandom(2))
    expect(result).toHaveLength(4)
    const q9Item = result.find((r) => r.question.type === 'q9')
    expect(q9Item).toBeDefined()
    // Q9 を生成できるのは reserve（下線 a）だけなので、そこが差し替えられているはず。
    expect(q9Item?.underlineKey).toBe('a')
  })

  it('Q9 優先の結果セットに Q10 が無ければ、生成可能な下線を探して Q10 に作り直す', () => {
    // g1 は Q9（holder）・Q10 の両方を生成できるが、優先順位で常に Q9 が選ばれてしまう。
    // g2〜g4 は holder のみ（Q10 不可）なので、通常の生成では Q10 が1問も出ない。
    const g1 = richWork({ id: 'g1', era: 'tenpyo', category: 'sculpture', holder: '興福寺' })
    const g2 = makeWork({ id: 'g2', era: 'hakuho', category: 'sculpture', holder: '東大寺' })
    const g3 = makeWork({ id: 'g3', era: 'asuka', category: 'sculpture', holder: '東寺' })
    const g4 = makeWork({ id: 'g4', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺' })
    const guaranteePool = [g1, g2, g3, g4]
    const passage: Passage = {
      id: 'guarantee-q10-p',
      era: 'tenpyo',
      title: 'Q10保証テスト',
      text: '本文。[[a|A]][[b|B]][[c|C]][[d|D]]',
      sources: ['x'],
      underlines: [
        { key: 'a', workIds: ['g1'] },
        { key: 'b', workIds: ['g2'] },
        { key: 'c', workIds: ['g3'] },
        { key: 'd', workIds: ['g4'] },
      ],
    }
    const result = buildThemeSetQuestions(passage, guaranteePool, testEras, seededRandom(4))
    expect(result).toHaveLength(4)
    const q10Item = result.find((r) => r.question.type === 'q10')
    expect(q10Item).toBeDefined()
    // Q10 を生成できるのは g1（下線 a）だけなので、そこが差し替えられているはず。
    expect(q10Item?.underlineKey).toBe('a')
  })
})

// 8章「二段構え」: ask.stem・answerId・distractorIds（writer 手書き）のテスト。
describe('8章「二段構え」: ask.stem・answerId・distractorIds', () => {
  const kondo = richWork({ id: 'kondo', era: 'tenpyo', category: 'sculpture', holder: '興福寺', artist: '運慶' })
  const other1 = makeWork({ id: 'other1', era: 'hakuho', category: 'sculpture', holder: '東大寺', artist: '快慶' })
  const other2 = makeWork({ id: 'other2', era: 'asuka', category: 'sculpture', holder: '東寺', artist: '快慶' })
  const other3 = makeWork({ id: 'other3', era: 'konin-jogan', category: 'sculpture', holder: '唐招提寺', artist: '快慶' })
  const stemPool: Work[] = [kondo, other1, other2, other3]

  it('ask.type が実際に生成できたとき、ask.stem がそのまま question.stem になる', () => {
    const passage: Passage = {
      id: 'stem-p',
      era: 'tenpyo',
      title: '二段構えテスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [
        {
          key: 'a',
          workIds: ['kondo'],
          ask: { type: 'q9', stem: '下線部aの北円堂に安置され、運慶が製作した彫刻はどれか', answerId: 'kondo', distractorIds: ['other1', 'other2', 'other3'] },
        },
      ],
    }
    const result = buildThemeSetQuestions(passage, stemPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q9')
    expect(result[0].question.stem).toBe('下線部aの北円堂に安置され、運慶が製作した彫刻はどれか')
    // answerId が示す作品（kondo）が選択肢に含まれる（正解の作品）
    expect(result[0].question.choiceWorks.some((w) => w.id === 'kondo')).toBe(true)
    expect(result[0].question.choiceWorks[result[0].question.correctIndex].id).toBe('kondo')
  })

  it('answerId が pool に無ければ、stem を付けずに次善の型にフォールバックする', () => {
    const passage: Passage = {
      id: 'stem-fallback-p',
      era: 'tenpyo',
      title: '二段構えフォールバックテスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [
        {
          key: 'a',
          workIds: ['kondo'],
          ask: { type: 'q9', stem: '存在しない作品を指す stem', answerId: 'not-in-pool' },
        },
      ],
    }
    const result = buildThemeSetQuestions(passage, stemPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).not.toBe('q1') // kondo は q10/q8/q4 も生成できるため q1 まで落ちないはず
    expect(result[0].question.stem).toBeUndefined()
  })

  it('distractorIds が不足していれば、既存の同カテゴリ・近い時代ロジックで補充する', () => {
    const passage: Passage = {
      id: 'stem-partial-p',
      era: 'tenpyo',
      title: '不足補充テスト',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['kondo'], ask: { type: 'q9', stem: 's', answerId: 'kondo', distractorIds: ['other1'] } }],
    }
    const result = buildThemeSetQuestions(passage, stemPool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q9')
    expect(result[0].question.choiceWorks).toHaveLength(4)
  })
})

// 9章「画像リード型セット」: kind: "image" のテーマセット。
describe('9章「画像リード型セット」: kind: "image"・leadWorkIds・q12', () => {
  const leadWork = makeWork({ id: 'lead1', era: 'tenpyo', category: 'painting' })
  const imagePool: Work[] = [leadWork, makeWork({ id: 'other-lead', era: 'hakuho', category: 'painting' })]

  it('kind: "image" で下線の workIds が空でも、leadWorkIds を対象にする', () => {
    const passage: Passage = {
      id: 'image-p',
      era: 'tenpyo',
      title: '画像リードテスト',
      kind: 'image',
      leadWorkIds: ['lead1'],
      text: '(1)は僧が道場で[[a|踊念仏]]を行う場面。',
      sources: ['x'],
      underlines: [
        {
          key: 'a',
          workIds: [],
          ask: { type: 'q12', stem: 'この絵巻の主人公として最も適切なものはどれか', answerText: '空也上人', distractorTexts: ['一遍上人', '法然', '親鸞'] },
        },
      ],
    }
    const result = buildThemeSetQuestions(passage, imagePool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).toBe('q12')
    expect(result[0].question.work.id).toBe('lead1')
    expect(result[0].question.stem).toBe('この絵巻の主人公として最も適切なものはどれか')
    expect(result[0].question.choiceQ12).toHaveLength(4)
  })

  it('q12 の answerText/distractorTexts が無ければ、次善（q1 等）にフォールバックする', () => {
    const passage: Passage = {
      id: 'image-fallback-p',
      era: 'tenpyo',
      title: '画像リード不足テスト',
      kind: 'image',
      leadWorkIds: ['lead1'],
      text: '(1)は[[a|場面]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: [], ask: { type: 'q12', stem: 's' } }],
    }
    const result = buildThemeSetQuestions(passage, imagePool, testEras, seededRandom(1))
    expect(result).toHaveLength(1)
    expect(result[0].question.type).not.toBe('q12')
    expect(result[0].question.work.id).toBe('lead1')
  })
})

// 9章「『学習を始める』のテーマセット化（M2-13）」
describe('selectLearnThemeSets（「学習を始める」のテーマセット選定）', () => {
  const today = '2026-09-04'
  const w1 = makeWork({ id: 'lw1', era: 'tenpyo', category: 'sculpture' })
  const w2 = makeWork({ id: 'lw2', era: 'hakuho', category: 'sculpture' })
  const w3 = makeWork({ id: 'lw3', era: 'asuka', category: 'sculpture' })
  const w4 = makeWork({ id: 'lw4', era: 'konin-jogan', category: 'sculpture' })
  const learnPool: Work[] = [w1, w2, w3, w4]

  const passageA: Passage = {
    id: 'learn-a',
    era: 'tenpyo',
    title: 'A',
    text: '本文。[[a|A]]',
    sources: ['x'],
    underlines: [{ key: 'a', workIds: ['lw1'] }],
  }
  const passageB: Passage = {
    id: 'learn-b',
    era: 'hakuho',
    title: 'B',
    text: '本文。[[a|A]]',
    sources: ['x'],
    underlines: [{ key: 'a', workIds: ['lw2'] }],
  }
  const passageC: Passage = {
    id: 'learn-c',
    era: 'asuka',
    title: 'C',
    text: '本文。[[a|A]]',
    sources: ['x'],
    underlines: [{ key: 'a', workIds: ['lw3'] }],
  }

  function emptyProgress(): ProgressState {
    return { version: 2, xp: 0, level: 1, streak: { count: 0, lastDate: null }, items: {}, bosses: {}, newToday: { date: today, count: 0 } }
  }

  it('空配列を渡せば空配列', () => {
    expect(selectLearnThemeSets([], learnPool, testEras, emptyProgress(), today)).toEqual([])
  })

  it('count 以下しか passages が無くても落ちない（重複せず全件以下を返す）', () => {
    const result = selectLearnThemeSets([passageA], learnPool, testEras, emptyProgress(), today, 3)
    expect(result).toHaveLength(1)
  })

  it('SRS の期限が来た作品を含むセットを優先する', () => {
    const progress = emptyProgress()
    // lw2（passageB の対象）だけ期限到来にする
    progress.items['lw2'] = createItemProgress(today)
    const result = selectLearnThemeSets([passageA, passageB, passageC], learnPool, testEras, progress, today, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('learn-b')
  })

  it('期限到来作品が無ければ、count 件を返す（習熟の低い区分から）', () => {
    const result = selectLearnThemeSets([passageA, passageB, passageC], learnPool, testEras, emptyProgress(), today, 2)
    expect(result).toHaveLength(2)
  })

  it('count を超えない', () => {
    const result = selectLearnThemeSets([passageA, passageB, passageC], learnPool, testEras, emptyProgress(), today, 2)
    expect(result.length).toBeLessThanOrEqual(2)
  })
})

// M2-16: 出題配分（COMPOSITION_SEQUENCE）と画像なし項目のプール分離、年代順並べ替えの追加。
describe('M2-16: desiredCategory（型構成カテゴリの割り当て）', () => {
  // pairs・facts・falseStatements・holder・artist をすべて持ち、q13/q10/q4/q9 のどれでも
  // 生成できる作品（image-eligible）。
  const richPairsWork = makeWork({
    id: 'rich-pairs',
    era: 'tenpyo',
    category: 'sculpture',
    holder: '興福寺',
    artist: '運慶',
    pairs: [{ left: '仏師', right: '運慶' }],
    facts: [
      { slot: 'other', text: 'rich正文1' },
      { slot: 'other', text: 'rich正文2' },
      { slot: 'other', text: 'rich正文3' },
    ],
    falseStatements: [
      { text: 'rich誤文1', why: 'x', verifiedFalse: true },
      { text: 'rich誤文2', why: 'x', verifiedFalse: true },
      { text: 'rich誤文3', why: 'x', verifiedFalse: true },
    ],
  })
  const otherPairsWorks: Work[] = [
    makeWork({
      id: 'op1',
      era: 'hakuho',
      category: 'sculpture',
      holder: '東大寺',
      artist: '快慶',
      pairs: [{ left: '書物', right: '徒然草' }],
    }),
    makeWork({
      id: 'op2',
      era: 'asuka',
      category: 'sculpture',
      holder: '東寺',
      artist: '快慶',
      pairs: [{ left: '様式', right: '寝殿造' }],
    }),
    makeWork({
      id: 'op3',
      era: 'konin-jogan',
      category: 'sculpture',
      holder: '唐招提寺',
      artist: '快慶',
      pairs: [{ left: '原料', right: '有田' }],
    }),
  ]
  const richPool: Work[] = [richPairsWork, ...otherPairsWorks]

  it('desiredCategory: "pairs" は Q9 より優先され、pairs があれば q13 になる', () => {
    const q = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), { desiredCategory: 'pairs' })
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q13')
    expect(q!.reversed).toBe(false)
  })

  it('desiredCategory: "q10" は Q9 より優先され、facts/falseStatements があれば q10 になる', () => {
    const q = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), { desiredCategory: 'q10' })
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q10')
  })

  it('desiredCategory: "q4"/"q4-reversed" はそれぞれ reversed フラグの異なる q4 になる', () => {
    const normal = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), { desiredCategory: 'q4' })
    const reversed = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), {
      desiredCategory: 'q4-reversed',
    })
    expect(normal!.type).toBe('q4')
    expect(normal!.reversed).toBe(false)
    expect(reversed!.type).toBe('q4')
    expect(reversed!.reversed).toBe(true)
  })

  it('desiredCategory: "image" は q9 になる（画像を持つ対象のとき）', () => {
    const q = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), { desiredCategory: 'image' })
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q9')
  })

  it('desiredCategory が生成できなければ通常の優先順位（Q9優先）に落ちる', () => {
    // pairs を持たない作品に desiredCategory: "pairs" を指定 → Q9 にフォールバックする
    const q = buildThemeQuestionForWork(targetWithArtist, pool, testEras, seededRandom(1), { desiredCategory: 'pairs' })
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q9')
  })

  it('ask が明示されていれば desiredCategory より優先される', () => {
    const q = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), {
      ask: { type: 'q10' },
      desiredCategory: 'pairs',
    })
    expect(q).not.toBeNull()
    expect(q!.type).toBe('q10')
  })

  it('desiredCategory の結果が avoidType と同じ型なら使わず、通常の優先順位に落ちる（同型連続を避ける）', () => {
    // desiredCategory: "pairs" は生成できれば q13 になるはずだが、avoidType: "q13" のときは
    // 使わない（直前が q13 で連続してしまうため）。通常の優先順位（Q9優先）に落ちる。
    const q = buildThemeQuestionForWork(richPairsWork, richPool, testEras, seededRandom(1), {
      desiredCategory: 'pairs',
      avoidType: 'q13',
    })
    expect(q).not.toBeNull()
    expect(q!.type).not.toBe('q13')
  })
})

describe('M2-16: pool（画像なし項目も含む）と imagePool（画像で出題できる作品だけ）の分離', () => {
  // kind: text（画像なし）の対象。facts/falseStatements はあるが image は無い扱い
  // （imagePool に含まれない）。
  const textWork = makeWork({
    id: 'text-1',
    era: 'tenpyo',
    category: 'literature',
    kind: 'text',
    facts: [
      { slot: 'other', text: 'text正文1' },
      { slot: 'other', text: 'text正文2' },
      { slot: 'other', text: 'text正文3' },
    ],
    falseStatements: [
      { text: 'text誤文1', why: 'x', verifiedFalse: true },
      { text: 'text誤文2', why: 'x', verifiedFalse: true },
      { text: 'text誤文3', why: 'x', verifiedFalse: true },
    ],
  })
  const imageWork = makeWork({ id: 'img-1', era: 'tenpyo', category: 'sculpture', artist: '運慶' })
  const fullPool: Work[] = [textWork, imageWork]
  const imagePool: Work[] = [imageWork]

  it('画像を持たない対象は Q9（desiredCategory: "image"）を試さず、次善の型（Q4等）に落ちる', () => {
    const q = buildThemeQuestionForWork(textWork, fullPool, testEras, seededRandom(1), {
      desiredCategory: 'image',
      imagePool,
    })
    expect(q).not.toBeNull()
    expect(q!.type).not.toBe('q9')
    expect(q!.type).not.toBe('q1')
  })

  it('画像を持たない対象で facts/falseStatements/pairs も無ければ null を返す（q1 は使えない）', () => {
    const bareTextWork = makeWork({ id: 'bare-text', kind: 'text' })
    const q = buildThemeQuestionForWork(bareTextWork, [bareTextWork, imageWork], testEras, seededRandom(1), { imagePool })
    expect(q).toBeNull()
  })

  it('buildThemeSetQuestions: 画像も facts/pairs も無い対象は console.warn してスキップする（エラーにしない）', () => {
    const bareTextWork = makeWork({ id: 'bare-text-2', kind: 'text' })
    const passage: Passage = {
      id: 'text-only-p',
      era: 'tenpyo',
      title: '画像なしのみのセット',
      text: '本文。[[a|下線]]。',
      sources: ['x'],
      underlines: [{ key: 'a', workIds: ['bare-text-2'] }],
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = buildThemeSetQuestions(passage, [bareTextWork], testEras, seededRandom(1), [])
    expect(result).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('buildThemeSetQuestions: imagePool を渡すと、画像なし対象は Q4 等の文字問題になり、画像を持つ対象は通常どおり生成される', () => {
    const passage: Passage = {
      id: 'mixed-pool-p',
      era: 'tenpyo',
      title: '混在プールのセット',
      text: '本文。[[a|下線A]][[b|下線B]]。',
      sources: ['x'],
      underlines: [
        { key: 'a', workIds: ['text-1'] },
        { key: 'b', workIds: ['img-1'] },
      ],
    }
    const result = buildThemeSetQuestions(passage, fullPool, testEras, seededRandom(1), imagePool)
    expect(result.length).toBeGreaterThan(0)
    const textItem = result.find((r) => r.question.work.id === 'text-1')
    expect(textItem).toBeDefined()
    expect(textItem!.question.type).not.toBe('q1')
    expect(textItem!.question.type).not.toBe('q9')
  })
})

describe('M2-16: appendOrderQuestionIfDue（年代順並べ替え。3セットに1問）', () => {
  const dummyQuestions = [
    { underlineKey: 'a', question: { type: 'q1' as const, work: makeWork({ id: 'w1' }), choiceWorks: [], correctIndex: 0, isReview: false } },
  ]
  const withOrderIndex: Work[] = [
    makeWork({ id: 'o1', orderIndex: 700 }),
    makeWork({ id: 'o2', orderIndex: 750 }),
    makeWork({ id: 'o3', orderIndex: 800 }),
  ]

  it('questions が空なら何もしない', () => {
    expect(appendOrderQuestionIfDue([], 2, withOrderIndex, seededRandom(1))).toEqual([])
  })

  it('(setIndex+1) % 3 !== 0 のときは何もしない（1本目・2本目）', () => {
    expect(appendOrderQuestionIfDue(dummyQuestions, 0, withOrderIndex, seededRandom(1))).toHaveLength(1)
    expect(appendOrderQuestionIfDue(dummyQuestions, 1, withOrderIndex, seededRandom(1))).toHaveLength(1)
  })

  it('3本目（setIndex=2）で orderIndex データがそろっていれば q14 を1問追加する', () => {
    const result = appendOrderQuestionIfDue(dummyQuestions, 2, withOrderIndex, seededRandom(1))
    expect(result).toHaveLength(2)
    const added = result[1]
    expect(added.question.type).toBe('q14')
    expect(added.underlineKey).toBe('order')
    expect(added.question.orderItems).toHaveLength(3)
    expect(added.question.choiceStatements).toHaveLength(4)
  })

  it('3本目でも orderIndex データが無ければ何も追加しない（壊れない）', () => {
    const noOrderIndexPool: Work[] = [makeWork({ id: 'p1' }), makeWork({ id: 'p2' }), makeWork({ id: 'p3' })]
    const result = appendOrderQuestionIfDue(dummyQuestions, 2, noOrderIndexPool, seededRandom(1))
    expect(result).toHaveLength(1)
  })

  it('6本目（setIndex=5）でも追加する（3の倍数ごと）', () => {
    const result = appendOrderQuestionIfDue(dummyQuestions, 5, withOrderIndex, seededRandom(1))
    expect(result).toHaveLength(2)
    expect(result[1].question.type).toBe('q14')
  })
})
