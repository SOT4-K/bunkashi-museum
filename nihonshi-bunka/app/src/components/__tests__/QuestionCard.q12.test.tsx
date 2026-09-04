import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { makeWork } from '../../engine/__tests__/testFixtures'
import type { Question } from '../../types'

const leadWork = makeWork({ id: 'lead1', era: 'tenpyo', category: 'painting' })

function makeQ12Question(overrides: Partial<Question> = {}): Question {
  return {
    type: 'q12',
    work: leadWork,
    stem: 'この絵巻の主人公として最も適切なものはどれか',
    choiceWorks: [],
    choiceQ12: [
      { text: '空也上人', correct: true, why: null },
      { text: '一遍上人', correct: false, why: null },
      { text: '法然', correct: false, why: null },
      { text: '親鸞', correct: false, why: null },
    ],
    correctIndex: 0,
    isReview: false,
    ...overrides,
  }
}

describe('QuestionCard: Q12（画像なし文字4択。9章「画像リード型セット」）', () => {
  it('stem がそのまま設問文として表示され、ヒーロー画像は出さない', () => {
    const question = makeQ12Question()
    const { container } = render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByText('この絵巻の主人公として最も適切なものはどれか')).toBeInTheDocument()
    expect(container.querySelector('[aria-label="この画像を拡大表示"]')).toBeNull()
  })

  it('choiceQ12 の4件が選択肢として表示される', () => {
    const question = makeQ12Question()
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, c] of question.choiceQ12!.entries()) {
      expect(buttons[i].textContent).toContain(c.text)
    }
  })
})

describe('QuestionCard: ask.stem（8章「二段構え」）は既存の自動合成プロンプトより優先される', () => {
  it('q9 で stem があれば、conditionText 由来の "を選べ" 文ではなく stem をそのまま使う', () => {
    const question: Question = {
      type: 'q9',
      work: leadWork,
      stem: '下線部cの東寺に安置されている仏像として最も適切なものを選べ',
      choiceWorks: [leadWork, makeWork({ id: 'd1' }), makeWork({ id: 'd2' }), makeWork({ id: 'd3' })],
      correctIndex: 0,
      isReview: false,
      conditionText: '興福寺にあるもの',
    }
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    expect(screen.getByText('下線部cの東寺に安置されている仏像として最も適切なものを選べ')).toBeInTheDocument()
    expect(screen.queryByText('興福寺にあるものを選べ')).not.toBeInTheDocument()
  })
})
