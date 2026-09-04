import { describe, expect, it } from 'vitest'
import { generateStatementPairQuestion, STATEMENT_PAIR_LABELS } from '../statementPair'
import { makeWork, seededRandom } from './testFixtures'

const rich = makeWork({
  id: 'rich',
  era: 'tenpyo',
  facts: [
    { slot: 'other', text: '正文A' },
    { slot: 'other', text: '正文B' },
    { slot: 'other', text: '正文C' },
  ],
  falseStatements: [
    { text: '誤文A', why: '理由A', verifiedFalse: true },
    { text: '誤文B', why: '理由B', verifiedFalse: true },
  ],
})

describe('generateStatementPairQuestion', () => {
  it('正文2件・誤文2件そろえば null にならない（10 seed）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateStatementPairQuestion(rich, [rich], seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.labels).toEqual(STATEMENT_PAIR_LABELS)
    }
  })

  it('correctIndex はラベル順（正正=0/正誤=1/誤正=2/誤誤=3）と実際の真偽が一致する', () => {
    for (let seed = 0; seed < 30; seed++) {
      const result = generateStatementPairQuestion(rich, [rich], seededRandom(seed))
      expect(result).not.toBeNull()
      const { sentenceA, sentenceB, correctIndex } = result!
      const expectedIndex = (sentenceA.actuallyTrue ? 0 : 2) + (sentenceB.actuallyTrue ? 0 : 1)
      expect(correctIndex).toBe(expectedIndex)
    }
  })

  it('誤りの文には why が付き、正しい文の why は null', () => {
    for (let seed = 0; seed < 30; seed++) {
      const result = generateStatementPairQuestion(rich, [rich], seededRandom(seed))
      for (const s of [result!.sentenceA, result!.sentenceB]) {
        if (s.actuallyTrue) {
          expect(s.why).toBeNull()
        } else {
          expect(s.why).not.toBeNull()
        }
      }
    }
  })

  it('facts が2件未満なら null', () => {
    const w = makeWork({
      id: 'few',
      facts: [{ slot: 'other', text: '正文のみ' }],
      falseStatements: [
        { text: 'A', why: 'a', verifiedFalse: true },
        { text: 'B', why: 'b', verifiedFalse: true },
      ],
    })
    expect(generateStatementPairQuestion(w, [w], seededRandom(1))).toBeNull()
  })

  it('誤文候補（falseStatements・他作品facts）が2件未満なら null', () => {
    const w = makeWork({
      id: 'few2',
      facts: [
        { slot: 'other', text: '正文1' },
        { slot: 'other', text: '正文2' },
      ],
      falseStatements: [{ text: 'A', why: 'a', verifiedFalse: true }],
    })
    expect(generateStatementPairQuestion(w, [w], seededRandom(1))).toBeNull()
  })

  it('A・B の本文は毎回異なるテキスト（正文同士・誤文同士が重複しない）', () => {
    for (let seed = 0; seed < 20; seed++) {
      const result = generateStatementPairQuestion(rich, [rich], seededRandom(seed))
      expect(result!.sentenceA.text).not.toBe(result!.sentenceB.text)
    }
  })
})
