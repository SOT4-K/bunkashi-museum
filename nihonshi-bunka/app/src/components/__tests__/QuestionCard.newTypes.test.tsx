import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')! // facts あり、artist/patron 無し（Q4 は可、Q8 は不可）
const namiura = works.find((w) => w.id === 'kanagawa-oki-namiura')! // artist・style あり（Q8 も可）

describe('QuestionCard: Q4（関連記述）', () => {
  it('問題文と4つの記述文が表示される', () => {
    const question = buildQuestion(ashura, 'q4', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(<QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByText('この作品に関する記述として正しいものは？')).toBeInTheDocument()
    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, s] of question!.choiceStatements!.entries()) {
      expect(buttons[i].textContent).toContain(s.text)
    }
  })
})

describe('QuestionCard: Q6（同時代の事項）', () => {
  it('問題文と4つの事項が表示される', () => {
    const question = buildQuestion(ashura, 'q6', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(<QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByText('この作品と同じ文化に属する事項は？')).toBeInTheDocument()
    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, it_] of question!.choiceEraItems!.entries()) {
      expect(buttons[i].textContent).toContain(it_.text)
    }
  })
})

describe('QuestionCard: Q8（組合せ文）', () => {
  it('問題文と4つの組合せ文が表示される', () => {
    const question = buildQuestion(namiura, 'q8', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(<QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, c] of question!.choiceCombos!.entries()) {
      expect(buttons[i].textContent).toContain(c.text)
    }
  })
})
