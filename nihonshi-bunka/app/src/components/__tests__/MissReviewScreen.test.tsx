import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MissReviewScreen } from '../MissReviewScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { MissReviewItem } from '../../engine/missLog'

const w1 = makeWork({ id: 'mr1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'mr2', era: 'hakuho', category: 'sculpture' })

const items: MissReviewItem[] = [
  {
    entry: { workId: 'mr1', type: 'q2', lastMissedAt: '2026-09-01', count: 2, correctStreak: 0 },
    question: { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: true },
  },
]

function noopAnswer() {
  return { xpGained: 15, isNewDiscovery: false, isNewlyMastered: false }
}

describe('MissReviewScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('0問なら「間違いなし」', () => {
    render(<MissReviewScreen items={[]} eras={testEras} onAnswer={noopAnswer} onOutcome={() => {}} onFinish={() => {}} />)
    expect(screen.getByText('間違いなし。')).toBeInTheDocument()
  })

  it('回答すると onOutcome(workId, correct) が呼ばれ、全問終了で結果画面が出る', () => {
    const onOutcome = vi.fn()
    const onFinish = vi.fn()
    render(<MissReviewScreen items={items} eras={testEras} onAnswer={noopAnswer} onOutcome={onOutcome} onFinish={onFinish} />)

    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    expect(onOutcome).toHaveBeenCalledWith('mr1', true)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    const summary = screen.getByTestId('miss-review-summary')
    fireEvent.click(within(summary).getByText('ホームに戻る'))
    expect(onFinish).toHaveBeenCalled()
  })
})
