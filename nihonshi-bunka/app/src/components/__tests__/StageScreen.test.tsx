// StageScreen（M2b-01）。MockExamScreen/PracticeSessionScreen と同じ QuestionCard/AnswerSheet を
// 流用しつつ、progress を更新する（onAnswer/onMiss を呼ぶ点は MockExamScreen と同じ）ことと、
// 完了時に onComplete(correctCount, total) を1回だけ呼ぶこと、結果画面の「もう一度／次へ」を確認する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { StageScreen } from '../StageScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { Question } from '../../types'

const w1 = makeWork({ id: 'sg1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'sg2', era: 'tenpyo', category: 'sculpture' })

const questions: Question[] = [
  { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: false },
  { type: 'q1', work: w2, choiceWorks: [w1, w2], correctIndex: 1, isReview: false },
]

function makeAnswer() {
  return vi.fn().mockReturnValue({ xpGained: 10, isNewDiscovery: false, isNewlyMastered: false })
}

describe('StageScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('0問なら「作れなかった」メッセージとマップに戻るボタンだけを出す', () => {
    const onFinish = vi.fn()
    render(
      <StageScreen
        title="天平文化 ★1"
        questions={[]}
        pool={[]}
        passages={[]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={onFinish}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText(/作れなかった/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('マップに戻る'))
    expect(onFinish).toHaveBeenCalled()
  })

  it('onAnswer/onMiss を呼び、全問終了で onComplete(正解数, 全問数) を1回だけ呼ぶ', () => {
    const onAnswer = makeAnswer()
    const onMiss = vi.fn()
    const onComplete = vi.fn()
    render(
      <StageScreen
        title="天平文化 ★1"
        questions={questions}
        pool={[w1, w2]}
        passages={[]}
        eras={testEras}
        onAnswer={onAnswer}
        onMiss={onMiss}
        onComplete={onComplete}
        onFinish={vi.fn()}
        onRetry={vi.fn()}
      />,
    )

    // 1問目: 正解を選ぶ（correctIndex=0）
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    expect(onAnswer).toHaveBeenCalledWith('sg1', 'q1', 'correct', false, expect.any(String))
    let dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    // 2問目: わざと不正解を選ぶ（correctIndex=1 なので index 0 は誤答）
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    expect(onAnswer).toHaveBeenCalledWith('sg2', 'q1', 'incorrect', false, expect.any(String))
    expect(onMiss).toHaveBeenCalledWith('sg2', 'q1', undefined, undefined)
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    expect(screen.getByTestId('stage-summary')).toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(1, 2)
  })

  it('結果画面: 2問中1問正解では「クリアには2/2問正解が必要」（ceil(0.9×2)=2）、「もう一度」「次へ」が押せる', () => {
    const onRetry = vi.fn()
    const onFinish = vi.fn()
    render(
      <StageScreen
        title="天平文化 ★1"
        questions={questions}
        pool={[w1, w2]}
        passages={[]}
        eras={testEras}
        onAnswer={makeAnswer()}
        onComplete={vi.fn()}
        onFinish={onFinish}
        onRetry={onRetry}
      />,
    )
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getAllByTestId('choice-button')[0]) // 常に選択肢0（1問目correct/2問目incorrect）
      fireEvent.click(screen.getByTestId('confirm-answer-button'))
      act(() => vi.advanceTimersByTime(500))
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }
    const summary = screen.getByTestId('stage-summary')
    expect(within(summary).getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByTestId('stage-clear-label')).toHaveTextContent('クリアには 2/2 問正解が必要')

    fireEvent.click(screen.getByTestId('stage-retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId('stage-next'))
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('全問正解なら「クリア！」と表示する', () => {
    render(
      <StageScreen
        title="天平文化 ★1"
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
    // 1問目: correctIndex=0 を選ぶ→正解。2問目: correctIndex=1 を選ぶ→正解。
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))

    fireEvent.click(screen.getAllByTestId('choice-button')[1])
    fireEvent.click(screen.getByTestId('confirm-answer-button'))
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(within(screen.getByRole('dialog')).getByTestId('next-button'))

    expect(screen.getByTestId('stage-clear-label')).toHaveTextContent('クリア！')
  })
})
