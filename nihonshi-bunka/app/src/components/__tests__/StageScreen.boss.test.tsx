// M2b-05: ボス戦の体力ゲージ（bossProgress）。isBoss=true のときだけ表示し、
// 正解・不正解のたびに残り問数が減ることを確認する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { StageScreen } from '../StageScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { Question } from '../../types'

const w1 = makeWork({ id: 'bg1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'bg2', era: 'tenpyo', category: 'sculpture' })

const questions: Question[] = [
  { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: false },
  { type: 'q1', work: w2, choiceWorks: [w1, w2], correctIndex: 1, isReview: false },
]

function makeAnswer() {
  return vi.fn().mockReturnValue({ xpGained: 10, isNewDiscovery: false, isNewlyMastered: false })
}

describe('StageScreen: ボス戦の体力ゲージ（M2b-05）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('isBoss=false（通常ステージ）ではゲージを出さない', () => {
    render(
      <StageScreen
        title="1-1 ★"
        questions={questions}
        pool={[w1, w2]}
        passages={[]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('boss-gauge')).not.toBeInTheDocument()
  })

  it('isBoss=true では残り問数が回答のたびに減る', () => {
    render(
      <StageScreen
        title="1 ボス"
        questions={questions}
        pool={[w1, w2]}
        passages={[]}
        eras={testEras}
        isBoss
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={vi.fn()}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByTestId('boss-gauge')).toHaveTextContent('残り 2 問')

    fireEvent.click(screen.getAllByTestId('choice-button')[0]) // 1問目: 正解
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByTestId('boss-gauge')).toHaveTextContent('残り 1 問')

    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0]) // 2問目: correctIndex=1なので誤答
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    expect(screen.getByTestId('boss-gauge')).toHaveTextContent('残り 0 問')
  })
})
