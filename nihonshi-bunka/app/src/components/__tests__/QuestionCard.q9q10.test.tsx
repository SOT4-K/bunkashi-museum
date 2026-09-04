import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'
import { generateStatementPairQuestion } from '../../engine/statementPair'
import type { Question } from '../../types'

// kasei.json の作品は artist・facts・falseStatements が揃っているため Q9/Q10 の実データテストに使える。
const namiura = works.find((w) => w.id === 'kanagawa-oki-namiura')!

describe('QuestionCard: Q9（画像4枚から条件に合う1枚）', () => {
  it('条件文が表示され、画像4枚の選択肢が並ぶ', () => {
    const question = buildQuestion(namiura, 'q9', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    expect(question!.conditionText).toBeTruthy()
    render(<QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByText(`${question!.conditionText}を選べ`)).toBeInTheDocument()
    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
  })

  it('正解作品自身の画像を別枠（ヒーロー画像）では見せない（答えが分かってしまうため）', () => {
    const question = buildQuestion(namiura, 'q9', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    const { container } = render(
      <QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={() => {}} />,
    )
    // hero ボタン（q1/q4/q6/q8 で使う単独の大きな画像ボタン）が無いことを確認
    expect(container.querySelector('[aria-label="この画像を拡大表示"][class*="hero"]')).toBeNull()
  })
})

describe('QuestionCard: Q10（2文正誤組合せ）', () => {
  it('A・B の文と4つのラベル選択肢が表示される', () => {
    const data = generateStatementPairQuestion(namiura, works, () => 0.3)
    expect(data).not.toBeNull()
    const question: Question = {
      type: 'q10',
      work: namiura,
      choiceWorks: [],
      choicePairLabels: data!.labels,
      statementPair: { sentenceA: data!.sentenceA, sentenceB: data!.sentenceB },
      correctIndex: data!.correctIndex,
      isReview: false,
    }
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByText(`A: ${data!.sentenceA.text}`)).toBeInTheDocument()
    expect(screen.getByText(`B: ${data!.sentenceB.text}`)).toBeInTheDocument()
    const buttons = screen.getAllByTestId('choice-button')
    expect(buttons).toHaveLength(4)
    for (const [i, label] of data!.labels.entries()) {
      expect(buttons[i].textContent).toContain(label)
    }
  })
})
