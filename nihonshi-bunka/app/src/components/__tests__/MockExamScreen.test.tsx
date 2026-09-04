import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MockExamScreen } from '../MockExamScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { MockExamSection } from '../../engine/mockExam'

const w1 = makeWork({ id: 'me1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'me2', era: 'hakuho', category: 'sculpture' })

const sections: MockExamSection[] = [
  {
    label: 'A',
    passage: { id: 'sec-a', era: 'tenpyo', title: 'リード文A', text: '本文。[[a|下線A]]。', sources: [], underlines: [{ key: 'a', workIds: ['me1'] }] },
    questions: [
      {
        underlineKey: 'a',
        question: { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: false },
      },
    ],
  },
  {
    label: 'B',
    passage: { id: 'sec-b', era: 'hakuho', title: 'リード文B', text: '本文。[[a|下線B]]。', sources: [], underlines: [{ key: 'a', workIds: ['me2'] }] },
    questions: [
      {
        underlineKey: 'a',
        question: { type: 'q1', work: w2, choiceWorks: [w1, w2], correctIndex: 1, isReview: false },
      },
    ],
  },
]

function noopAnswer() {
  return { xpGained: 10, isNewDiscovery: false, isNewlyMastered: false }
}

describe('MockExamScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('0問なら「作れなかった」メッセージ', () => {
    render(<MockExamScreen sections={[]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    expect(screen.getByText(/作れなかった/)).toBeInTheDocument()
  })

  it('セクションごとに全文リード表示→問題へ→回答→次セクションのリード表示、と進む', () => {
    render(<MockExamScreen sections={sections} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)

    expect(screen.getByTestId('mock-exam-read-panel')).toBeInTheDocument()
    expect(screen.getByText('下線A')).toBeInTheDocument()
    expect(screen.getByTestId('mock-exam-timer')).toHaveTextContent('10:00')

    fireEvent.click(screen.getByTestId('mock-exam-start-quiz'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    // 2セクション目のリード表示に移る
    expect(screen.getByTestId('mock-exam-read-panel')).toBeInTheDocument()
    expect(screen.getByText('下線B')).toBeInTheDocument()
  })

  it('全問終了で結果画面に型別正答率と20点満点のスコアを表示する', () => {
    render(<MockExamScreen sections={sections} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)

    for (let i = 0; i < sections.length; i++) {
      fireEvent.click(screen.getByTestId('mock-exam-start-quiz'))
      fireEvent.click(screen.getAllByTestId('choice-button')[sections[i].questions[0].question.correctIndex])
      act(() => {
        vi.advanceTimersByTime(500)
      })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }

    const summary = screen.getByTestId('mock-exam-summary')
    expect(within(summary).getByText('4 / 4点')).toBeInTheDocument()
    expect(within(summary).getByText('2 / 2 問正解')).toBeInTheDocument()
    const breakdown = screen.getByTestId('type-breakdown')
    expect(within(breakdown).getByText('画像→作品名')).toBeInTheDocument()
    expect(within(breakdown).getByText('2 / 2')).toBeInTheDocument()
  })
})
