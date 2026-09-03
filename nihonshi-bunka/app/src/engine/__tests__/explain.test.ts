import { describe, expect, it } from 'vitest'
import { explainMiss } from '../explain'
import { testEras, testWorks } from './testFixtures'
import type { Question } from '../../types'

const work = testWorks.find((w) => w.id === 'a1')! // confusable: a2
const other = testWorks.find((w) => w.id === 'a3')!
const confusableWork = testWorks.find((w) => w.id === 'a2')!

function makeQ1Question(choiceWorks = [work, other, confusableWork, testWorks[3]]): Question {
  return { type: 'q1', work, choiceWorks, correctIndex: choiceWorks.indexOf(work), isReview: false }
}

describe('explainMiss', () => {
  it('confusable に登録された作品を選んだ場合は howToTell を使う', () => {
    const q = makeQ1Question()
    const wrongIndex = q.choiceWorks.indexOf(confusableWork)
    const text = explainMiss(q, { kind: 'choice', index: wrongIndex }, testEras)
    expect(text).toContain(confusableWork.title)
    expect(text).toContain('x') // testFixtures の a1.confusables 内の a2 の howToTell は 'x'
  })

  it('confusable でない作品を選んだ場合はフォールバック文言', () => {
    const q = makeQ1Question()
    const wrongIndex = q.choiceWorks.indexOf(other)
    const text = explainMiss(q, { kind: 'choice', index: wrongIndex }, testEras)
    expect(text).toContain(other.title)
    expect(text).toMatch(/天平文化/)
  })

  it('「わからない」を選んだ場合は専用の文言', () => {
    const q = makeQ1Question()
    const text = explainMiss(q, { kind: 'unknown' }, testEras)
    expect(text).toBe('「わからない」を選んだ。')
  })

  it('正解を選んでいた場合は空文字', () => {
    const q = makeQ1Question()
    const correctIdx = q.choiceWorks.indexOf(work)
    const text = explainMiss(q, { kind: 'choice', index: correctIdx }, testEras)
    expect(text).toBe('')
  })

  it('Q2（文化選択）で誤った文化を選んだ場合', () => {
    const targetEra = testEras.find((e) => e.id === work.era)!
    const wrongEra = testEras.find((e) => e.id !== work.era)!
    const q: Question = {
      type: 'q2',
      work,
      choiceWorks: [],
      choiceEras: [targetEra, wrongEra, testEras[2], testEras[3]],
      correctIndex: 0,
      isReview: false,
    }
    const text = explainMiss(q, { kind: 'choice', index: 1 }, testEras)
    expect(text).toContain(wrongEra.name)
  })
})
