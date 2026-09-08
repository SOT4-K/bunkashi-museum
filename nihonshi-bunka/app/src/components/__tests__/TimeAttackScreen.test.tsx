// M2b-07: 模試タブのタイムアタック本体。カウントアップ計時、全問終了時に
// onComplete(正解数, 全問数, 経過秒, その回の間違い作品id) を1回だけ呼ぶこと、
// 「この回の間違いを復習」ボタンの出現条件を確認する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { TimeAttackScreen } from '../TimeAttackScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { MockExamItem } from '../../engine/mockExam'

const w1 = makeWork({ id: 'ta1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'ta2', era: 'hakuho', category: 'sculpture' })

const items: MockExamItem[] = [
  { eraId: 'tenpyo', underlineKey: '', excerpt: [], question: { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: false } },
  { eraId: 'hakuho', underlineKey: '', excerpt: [], question: { type: 'q1', work: w2, choiceWorks: [w1, w2], correctIndex: 1, isReview: false } },
]

function makeAnswer() {
  return vi.fn().mockReturnValue({ xpGained: 10, isNewDiscovery: false, isNewlyMastered: false })
}

describe('TimeAttackScreen（M2b-07）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('カウントアップ計時が表示され、時間経過で増える', () => {
    render(
      <TimeAttackScreen
        items={items}
        pool={[w1, w2]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={vi.fn()}
        onReviewMisses={vi.fn()}
      />,
    )
    expect(screen.getByTestId('time-attack-timer')).toHaveTextContent('0:00')
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByTestId('time-attack-timer')).toHaveTextContent('0:03')
  })

  it('全問終了で onComplete(正解数, 全問数, 経過秒, 間違えたid) を1回だけ呼ぶ', () => {
    const onComplete = vi.fn()
    render(
      <TimeAttackScreen
        items={items}
        pool={[w1, w2]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={onComplete}
        onFinish={vi.fn()}
        onReviewMisses={vi.fn()}
      />,
    )
    act(() => vi.advanceTimersByTime(5000))

    // 1問目: correctIndex=0 を選ぶ→正解
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))

    // 2問目: correctIndex=1 なので index0 は誤答
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))

    expect(screen.getByTestId('time-attack-summary')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(1, 2, expect.any(Number), ['ta2'])
  })

  it('間違いが無ければ「間違いを復習」ボタンを出さない', () => {
    render(
      <TimeAttackScreen
        items={[items[0]]}
        pool={[w1, w2]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={vi.fn()}
        onReviewMisses={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTestId('choice-button')[0]) // correctIndex=0 → 正解
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))

    expect(screen.getByTestId('time-attack-summary')).toBeInTheDocument()
    expect(screen.queryByTestId('time-attack-review-misses')).not.toBeInTheDocument()
  })

  it('onFinish/onReviewMisses が結果画面のボタンから呼ばれる', () => {
    const onFinish = vi.fn()
    const onReviewMisses = vi.fn()
    render(
      <TimeAttackScreen
        items={items}
        pool={[w1, w2]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={onFinish}
        onReviewMisses={onReviewMisses}
      />,
    )
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getAllByTestId('choice-button')[0])
      fireEvent.click(screen.getByTestId('confirm-answer-button'))
      act(() => vi.advanceTimersByTime(500))
      fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))
    }
    fireEvent.click(screen.getByTestId('time-attack-review-misses'))
    expect(onReviewMisses).toHaveBeenCalledWith(['ta2'])

    fireEvent.click(screen.getByTestId('time-attack-back'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})
