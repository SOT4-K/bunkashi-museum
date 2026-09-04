import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { makeWork } from '../../engine/__tests__/testFixtures'
import type { Question } from '../../types'

// kind: 'text' のため、実画像は無い（プレースホルダ SVG も答えの手がかりになるため出さない）。
const textWork = makeWork({ id: 'text-work', era: 'tenpyo', category: 'sculpture', kind: 'text' })
const artifactWork = makeWork({ id: 'artifact-work', era: 'tenpyo', category: 'sculpture' })

function makeQ13Question(overrides: Partial<Question> = {}): Question {
  return {
    type: 'q13',
    work: textWork,
    choiceWorks: [],
    choiceWordPairs: [
      { text: '仏師・運慶', correct: true },
      { text: '仏師・快慶', correct: false },
      { text: '仏師・定朝', correct: false },
      { text: '仏師・康弁', correct: false },
    ],
    correctIndex: 0,
    isReview: false,
    reversed: false,
    ...overrides,
  }
}

function makeQ14Question(overrides: Partial<Question> = {}): Question {
  const a = makeWork({ id: 'ord-a', orderIndex: 700 })
  const b = makeWork({ id: 'ord-b', orderIndex: 750 })
  const c = makeWork({ id: 'ord-c', orderIndex: 800 })
  return {
    type: 'q14',
    work: a,
    choiceWorks: [],
    choiceStatements: [
      { text: 'A → B → C', correct: true, why: null },
      { text: 'B → A → C', correct: false, why: null },
      { text: 'A → C → B', correct: false, why: null },
      { text: 'C → B → A', correct: false, why: null },
    ],
    correctIndex: 0,
    isReview: false,
    orderItems: [
      { label: 'A', work: a },
      { label: 'B', work: b },
      { label: 'C', work: c },
    ],
    ...overrides,
  }
}

describe('QuestionCard: Q13（語句の組合せ。T1。M2-16）', () => {
  it('choiceWordPairs の4件が選択肢として表示され、画像を持たない対象ではヒーロー画像を出さない', () => {
    const question = makeQ13Question()
    const { container } = render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, c] of question.choiceWordPairs!.entries()) {
      expect(buttons[i].textContent).toContain(c.text)
    }
    expect(container.querySelector('[aria-label="この画像を拡大表示"][class*="hero"]')).toBeNull()
  })

  it(
    'M2-99再検証の指摘: 画像を持つ対象（kind: artifact）でもQ13はヒーロー画像を出さない' +
      '（Q12と同じく文字だけで答える設問のため、画像を見せると認識だけで解けてしまう）',
    () => {
      const question = makeQ13Question({ work: artifactWork })
      const { container } = render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
      expect(container.querySelector('[aria-label="この画像を拡大表示"][class*="hero"]')).toBeNull()
    },
  )

  it('reversed のとき「誤っている組合せはどれか」の文言を表示する', () => {
    const question = makeQ13Question({ reversed: true })
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    expect(screen.getByText('誤っている組合せはどれか？')).toBeInTheDocument()
  })

  it('reversed でなければ通常の設問文を表示する', () => {
    const question = makeQ13Question()
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    expect(screen.getByText('正しい組合せはどれか？')).toBeInTheDocument()
  })
})

describe('QuestionCard: Q14（年代順並べ替え。T7。M2-16）', () => {
  it('orderItems のラベル付き画像3枚と、choiceStatements の4択が表示される', () => {
    const question = makeQ14Question()
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    const orderRow = screen.getByTestId('order-items')
    expect(orderRow).toBeInTheDocument()
    expect(orderRow.querySelectorAll('img')).toHaveLength(3)
    expect(screen.getByText('A')).toBeInTheDocument()

    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, c] of question.choiceStatements!.entries()) {
      expect(buttons[i].textContent).toContain(c.text)
    }
  })

  it('ヒーロー画像は出さない（複数作品を束ねる仮の work のため）', () => {
    const question = makeQ14Question()
    const { container } = render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    expect(container.querySelector('[aria-label="この画像を拡大表示"][class*="hero"]')).toBeNull()
  })
})
