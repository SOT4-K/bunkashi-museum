import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

describe('QuestionCard: 正解・不正解の見え方（フィードバック 3 と 4）', () => {
  it('Q1不正解時: 正解の選択肢に「正解」ラベルと✓、選んだ選択肢に✗が同時に出る', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const wrongIndex = question.choiceWorks.findIndex((w) => w.id !== ashura.id)

    render(
      <QuestionCard
        question={question}
        answered={{ selection: { kind: 'choice', index: wrongIndex }, correct: false }}
        onChoice={() => {}}
        onUnknown={() => {}}
      />,
    )

    const buttons = screen.getAllByTestId('choice-button')
    const correctButton = buttons[question.correctIndex]
    const wrongButton = buttons[wrongIndex]

    // 正解の選択肢: 金の枠クラス + 大きな✓
    expect(correctButton.className).toMatch(/choiceCorrect/)
    expect(correctButton.textContent).toContain('✓')
    // 選んだ（誤答の）選択肢: 朱の枠クラス + ✗
    expect(wrongButton.className).toMatch(/choiceWrong/)
    expect(wrongButton.textContent).toContain('✗')
    // 正解の選択肢の上に「正解」ラベルが出る
    expect(screen.getByText('正解')).toBeInTheDocument()
  })

  it('Q1正解時: 選んだ（＝正解の）選択肢に✓と「正解」ラベルが出る', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)

    render(
      <QuestionCard
        question={question}
        answered={{ selection: { kind: 'choice', index: question.correctIndex }, correct: true }}
        onChoice={() => {}}
        onUnknown={() => {}}
      />,
    )

    const buttons = screen.getAllByTestId('choice-button')
    const correctButton = buttons[question.correctIndex]
    expect(correctButton.className).toMatch(/choiceCorrect/)
    expect(correctButton.textContent).toContain('✓')
    expect(screen.getByText('正解')).toBeInTheDocument()
    // ✗ はどこにも出ない
    expect(screen.queryByText('✗')).not.toBeInTheDocument()
  })

  it('未回答（答える前）は✓も✗も「正解」ラベルも出ない', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    expect(screen.queryByText('正解')).not.toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('Q3不正解時: 正解の画像に✓・「正解」ラベル、選んだ画像に✗が同時に出る', () => {
    const question = buildQuestion(ashura, 'q3', works, eras, false, () => 0.5)
    const wrongIndex = question.choiceWorks.findIndex((w) => w.id !== ashura.id)

    render(
      <QuestionCard
        question={question}
        answered={{ selection: { kind: 'choice', index: wrongIndex }, correct: false }}
        onChoice={() => {}}
        onUnknown={() => {}}
      />,
    )

    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons[question.correctIndex].textContent).toContain('✓')
    expect(buttons[wrongIndex].textContent).toContain('✗')
    expect(screen.getByText('正解')).toBeInTheDocument()
  })
})
