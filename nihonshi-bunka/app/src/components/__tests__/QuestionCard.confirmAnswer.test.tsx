// M2-53: 選択肢をタップした瞬間に採点が確定するのは誤タップに弱いため、
// 「選択→『回答する』ボタンで確定」の二段階フローにする。
// この観点だけを検証する（既存の見た目・正誤判定ロジックは feedback.test.tsx 等に任せる）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'
import { generateStatementPairQuestion } from '../../engine/statementPair'
import { makeWork } from '../../engine/__tests__/testFixtures'
import type { Question } from '../../types'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!
// kasei.json の作品は artist・facts・falseStatements が揃っているため Q9/Q10 の実データテストに使える。
const namiura = works.find((w) => w.id === 'kanagawa-oki-namiura')!

function makeQ14Question(): Question {
  const a = makeWork({ id: 'confirm-ord-a', orderIndex: 700 })
  const b = makeWork({ id: 'confirm-ord-b', orderIndex: 750 })
  const c = makeWork({ id: 'confirm-ord-c', orderIndex: 800 })
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
  }
}

describe('QuestionCard: M2-53 選択→「回答する」で確定する二段階フロー（文字4択・Q1）', () => {
  it('選択肢をタップしただけではonChoiceが呼ばれず、まだ正誤色も出ない', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    fireEvent.click(screen.getAllByTestId('choice-button')[0])

    expect(onChoice).not.toHaveBeenCalled()
    expect(screen.queryByText('正解')).not.toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('選択が無いときは「回答する」ボタンが disabled', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    expect(screen.getByTestId('confirm-answer-button')).toBeDisabled()
  })

  it('選択→「回答する」タップで初めてonChoiceが呼ばれる（選んだ選択肢のindexで）', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    expect(screen.getByTestId('confirm-answer-button')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('confirm-answer-button'))

    expect(onChoice).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledWith(0)
  })

  it('別の選択肢をタップすると選び直せる（確定は最後にタップした方）', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    const buttons = screen.getAllByTestId('choice-button')
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))

    expect(onChoice).toHaveBeenCalledTimes(1)
    expect(onChoice).toHaveBeenCalledWith(1)
  })

  it('「わからない」も同じ流れ: タップだけでは確定せず、選択→「回答する」で確定する', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const onUnknown = vi.fn()
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={onUnknown} />)

    fireEvent.click(screen.getByTestId('unknown-button'))
    expect(onUnknown).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-answer-button')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    expect(onUnknown).toHaveBeenCalledTimes(1)
    expect(onChoice).not.toHaveBeenCalled()
  })

  it('「わからない」を選んだ後に選択肢をタップし直せる（確定はその選択肢）', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const onUnknown = vi.fn()
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={onUnknown} />)

    fireEvent.click(screen.getByTestId('unknown-button'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))

    expect(onChoice).toHaveBeenCalledWith(0)
    expect(onUnknown).not.toHaveBeenCalled()
  })
})

describe('QuestionCard: M2-53 同じ二段階フロー（画像4択・Q9）', () => {
  it('画像選択肢もタップだけでは確定せず、選択→「回答する」で初めてonChoiceが呼ばれる', () => {
    const question = buildQuestion(namiura, 'q9', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    const onChoice = vi.fn()
    render(<QuestionCard question={question!} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    const buttons = screen.getAllByTestId('choice-button')
    fireEvent.click(buttons[2])
    expect(onChoice).not.toHaveBeenCalled()
    expect(screen.getByTestId('confirm-answer-button')).not.toBeDisabled()

    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    expect(onChoice).toHaveBeenCalledWith(2)
  })

  it('画像4択でも「わからない」は選択→確定の同じ流れ', () => {
    const question = buildQuestion(namiura, 'q9', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    const onUnknown = vi.fn()
    render(<QuestionCard question={question!} answered={null} onChoice={() => {}} onUnknown={onUnknown} />)

    fireEvent.click(screen.getByTestId('unknown-button'))
    expect(onUnknown).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    expect(onUnknown).toHaveBeenCalledTimes(1)
  })
})

describe('QuestionCard: M2-53 同じ二段階フロー（Q10: 2文正誤の組合せ）', () => {
  it('ラベル選択肢もタップだけでは確定せず、選択→「回答する」で初めてonChoiceが呼ばれる', () => {
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
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    fireEvent.click(screen.getAllByTestId('choice-button')[1])
    expect(onChoice).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    expect(onChoice).toHaveBeenCalledWith(1)
  })
})

describe('QuestionCard: M2-53 同じ二段階フロー（Q14: 年代順）', () => {
  it('制作順の選択肢もタップだけでは確定せず、選択→「回答する」で初めてonChoiceが呼ばれる', () => {
    const question = makeQ14Question()
    const onChoice = vi.fn()
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    fireEvent.click(screen.getAllByTestId('choice-button')[3])
    expect(onChoice).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    expect(onChoice).toHaveBeenCalledWith(3)
  })
})

describe('QuestionCard: M2-53 設問が変わったら選択状態をリセットする', () => {
  it('前の設問で選んだままだった選択が、次の設問（answered が null に戻る）では未選択に戻る', () => {
    const q1 = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    const q2 = buildQuestion(namiura, 'q1', works, eras, false, () => 0.5)
    const onChoice = vi.fn()

    const { rerender } = render(
      <QuestionCard question={q1} answered={null} onChoice={onChoice} onUnknown={() => {}} />,
    )
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    expect(screen.getByTestId('confirm-answer-button')).not.toBeDisabled()

    // 次の問題へ（親が answered を null に戻し、新しい question を渡す想定）
    rerender(<QuestionCard question={q2} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    expect(screen.getByTestId('confirm-answer-button')).toBeDisabled()
  })
})
