import { describe, expect, it } from 'vitest'
import { generateStatementQuestion, otherWorkFactCandidates, verifiedFalseStatementCandidates } from '../statements'
import { makeWork, seededRandom } from './testFixtures'

// 阿修羅像／十大弟子像に相当する「patron を共有する2作品」＋独立した1作品、というミニ構成。
const withShared = makeWork({
  id: 'w1',
  facts: [
    { slot: 'patron', text: '光明皇后が建立した', shared: ['w2'] },
    { slot: 'era', text: '天平文化の作品', shared: ['w2', 'w3'] },
    { slot: 'technique', text: '乾漆像である' },
  ],
  falseStatements: [
    { text: '塑像である', why: '乾漆像。技法ずらし', verifiedFalse: true },
    { text: '白鳳文化の作品', why: '時代ずらし', verifiedFalse: true },
  ],
  patron: '光明皇后',
  technique: '乾漆像',
  era: 'tenpyo',
})

const shareTarget = makeWork({
  id: 'w2',
  facts: [
    { slot: 'patron', text: '光明皇后が建立した西金堂に安置された', shared: ['w1'] },
    { slot: 'era', text: '天平文化の作品', shared: ['w1', 'w3'] },
    { slot: 'other', text: '釈迦の十人の弟子を表す' },
  ],
  falseStatements: [],
  patron: '光明皇后',
  technique: '乾漆像',
  era: 'tenpyo',
})

const unrelated = makeWork({
  id: 'w3',
  facts: [
    { slot: 'era', text: '天平文化の作品', shared: ['w1', 'w2'] },
    { slot: 'location', text: '東大寺にある' },
    { slot: 'technique', text: '塑像である' },
  ],
  falseStatements: [],
  era: 'tenpyo',
  location: '東大寺',
  technique: '塑像',
})

const differentEra = makeWork({
  id: 'w4',
  facts: [
    { slot: 'patron', text: '藤原頼通が建立した' },
    { slot: 'location', text: '東大寺にある' }, // w3 と同じ location 値だが era が違う
  ],
  falseStatements: [],
  era: 'kokufu',
  location: '東大寺',
  patron: '藤原頼通',
})

const pool = [withShared, shareTarget, unrelated, differentEra]

describe('verifiedFalseStatementCandidates', () => {
  it('verifiedFalse でない誤文は含めない', () => {
    const w = makeWork({
      id: 'x',
      falseStatements: [
        { text: 'A', why: 'x', verifiedFalse: true },
        { text: 'B', why: 'y', verifiedFalse: false },
      ],
    })
    const candidates = verifiedFalseStatementCandidates(w)
    expect(candidates.map((c) => c.text)).toEqual(['A'])
  })
})

describe('otherWorkFactCandidates（除外規則）', () => {
  it('shared に対象作品の id を含む fact は除外する（w1 から見た w2 の patron 文）', () => {
    const candidates = otherWorkFactCandidates(withShared, pool)
    expect(candidates.some((c) => c.text === '光明皇后が建立した西金堂に安置された')).toBe(false)
  })

  it('shared に era を含む fact（両者とも天平）は除外する', () => {
    const candidates = otherWorkFactCandidates(withShared, pool)
    expect(candidates.some((c) => c.text === '天平文化の作品')).toBe(false)
  })

  it('対象作品自身の facts と同文のものは除外する', () => {
    // w1 自身が「乾漆像である」を facts に持つので、他作品由来でも同文なら使わない
    const dup = makeWork({ id: 'w5', facts: [{ slot: 'technique', text: '乾漆像である' }], era: 'tenpyo' })
    const candidates = otherWorkFactCandidates(withShared, [...pool, dup])
    expect(candidates.filter((c) => c.text === '乾漆像である')).toHaveLength(0)
  })

  it('slot の値が対象作品と一致する fact は除外する（technique が同じ塑像同士）', () => {
    const otherSame = makeWork({
      id: 'w6',
      facts: [{ slot: 'technique', text: '塑像で作られている' }],
      technique: '塑像',
      era: 'hakuho',
    })
    const target = makeWork({ id: 'w7', facts: [{ slot: 'other', text: 'x' }], technique: '塑像', era: 'hakuho' })
    const candidates = otherWorkFactCandidates(target, [target, otherSame])
    expect(candidates.some((c) => c.text === '塑像で作られている')).toBe(false)
  })

  it('slot が era/period は era が同じ作品からは取らない（location の値が同じでも era が違えば使える）', () => {
    // unrelated（w3, era=tenpyo, location=東大寺）と differentEra（w4, era=kokufu, location=東大寺）
    // は location の値が同じだが era が違うので、location の fact は除外されない
    const candidates = otherWorkFactCandidates(unrelated, pool)
    expect(candidates.some((c) => c.text === '藤原頼通が建立した')).toBe(true)
  })

  it('slot が location で候補作品の location が対象と一致するなら除外する', () => {
    const sameLocation = makeWork({ id: 'w8', facts: [{ slot: 'location', text: '興福寺にある' }], location: '興福寺', era: 'hakuho' })
    const target = makeWork({ id: 'w9', facts: [{ slot: 'other', text: 'x' }], location: '興福寺', era: 'tenpyo' })
    const candidates = otherWorkFactCandidates(target, [target, sameLocation])
    expect(candidates.some((c) => c.text === '興福寺にある')).toBe(false)
  })

  it('他作品由来の誤文には出典作品名を含む why が付く', () => {
    const candidates = otherWorkFactCandidates(withShared, pool)
    const fromUnrelated = candidates.find((c) => c.text === '東大寺にある')
    expect(fromUnrelated?.why).toBe(`これは${unrelated.title}の説明。`)
  })
})

describe('generateStatementQuestion', () => {
  it('facts が空なら null（正文が作れない）', () => {
    const empty = makeWork({ id: 'empty', facts: [], falseStatements: [] })
    expect(generateStatementQuestion(empty, [empty], seededRandom(1))).toBeNull()
  })

  it('誤文が3件そろわなければ null', () => {
    const scarce = makeWork({
      id: 'scarce',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [{ text: '誤文1', why: 'x', verifiedFalse: true }],
    })
    expect(generateStatementQuestion(scarce, [scarce], seededRandom(1))).toBeNull()
  })

  it('falseStatements が3件以上あればそれだけで誤文3件を満たす', () => {
    const w = makeWork({
      id: 'w',
      facts: [{ slot: 'other', text: '正文' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
        { text: 'C', why: 'c', verifiedFalse: true },
        { text: 'D', why: 'd', verifiedFalse: true },
      ],
    })
    for (let seed = 0; seed < 10; seed++) {
      const result = generateStatementQuestion(w, [w], seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.distractors).toHaveLength(3)
      expect(result!.distractors.every((d) => d.why !== null)).toBe(true)
    }
  })

  it('正文・誤文のテキストがすべて重複しない（10 seed）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateStatementQuestion(withShared, pool, seededRandom(seed))
      expect(result).not.toBeNull()
      const texts = [result!.correct.text, ...result!.distractors.map((d) => d.text)]
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('生成された誤文は withShared の facts（shared 含む）と一致しない', () => {
    const ownTexts = new Set(withShared.facts.map((f) => f.text))
    for (let seed = 0; seed < 10; seed++) {
      const result = generateStatementQuestion(withShared, pool, seededRandom(seed))
      expect(result).not.toBeNull()
      for (const d of result!.distractors) {
        expect(ownTexts.has(d.text)).toBe(false)
      }
    }
  })
})

describe('generateStatementQuestion（reversed: 「最も不適切なもの」型）', () => {
  it('facts が3件未満なら null（正文3件がそろわない）', () => {
    const w = makeWork({
      id: 'few-facts',
      facts: [{ slot: 'other', text: '正文1' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
      ],
    })
    expect(generateStatementQuestion(w, [w], seededRandom(1), { reversed: true })).toBeNull()
  })

  it('誤文が1件も無ければ null', () => {
    const w = makeWork({
      id: 'no-false',
      facts: [
        { slot: 'other', text: '正文1' },
        { slot: 'other', text: '正文2' },
        { slot: 'other', text: '正文3' },
      ],
      falseStatements: [],
    })
    expect(generateStatementQuestion(w, [w], seededRandom(1), { reversed: true })).toBeNull()
  })

  it('correct が誤文（answer）、distractors が正文3件になる（10 seed で一貫）', () => {
    const w = makeWork({
      id: 'rev-ok',
      facts: [
        { slot: 'other', text: '正文1' },
        { slot: 'other', text: '正文2' },
        { slot: 'other', text: '正文3' },
        { slot: 'other', text: '正文4' },
      ],
      falseStatements: [{ text: '誤文1', why: 'x', verifiedFalse: true }],
    })
    for (let seed = 0; seed < 10; seed++) {
      const result = generateStatementQuestion(w, [w], seededRandom(seed), { reversed: true })
      expect(result).not.toBeNull()
      expect(result!.reversed).toBe(true)
      expect(result!.correct.correct).toBe(false) // 答え（correctフィールド）は誤文
      expect(result!.distractors).toHaveLength(3)
      expect(result!.distractors.every((d) => d.correct)).toBe(true) // distractors は正文
      const texts = [result!.correct.text, ...result!.distractors.map((d) => d.text)]
      expect(new Set(texts).size).toBe(texts.length)
    }
  })
})
