import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { PracticeSessionScreen } from '../PracticeSessionScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'

const pool = [
  makeWork({ id: 'pr1', era: 'tenpyo', category: 'sculpture' }),
  makeWork({ id: 'pr2', era: 'tenpyo', category: 'sculpture' }),
  makeWork({ id: 'pr3', era: 'tenpyo', category: 'sculpture' }),
  makeWork({ id: 'pr4', era: 'hakuho', category: 'sculpture' }),
]

describe('PracticeSessionScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('記録されない旨を画面上部に表示する', () => {
    render(<PracticeSessionScreen eraId="tenpyo" eraName="天平文化" pool={pool} imagePool={pool} eras={testEras} onFinish={() => {}} />)
    expect(screen.getByText(/記録されない/)).toBeInTheDocument()
  })

  it('対象文化の作品だけで出題し、全問終了で practice-summary が「記録されません」と表示する', () => {
    const onFinish = vi.fn()
    render(<PracticeSessionScreen eraId="tenpyo" eraName="天平文化" pool={pool} imagePool={pool} eras={testEras} onFinish={onFinish} />)

    // 誤答すると再出題が起きうるため、正解を選び続けて終わらせる（最大10ループでガード）。
    for (let guard = 0; guard < 15; guard++) {
      if (screen.queryByTestId('practice-summary')) break
      const buttons = screen.getAllByTestId('choice-button')
      fireEvent.click(buttons[0])
      act(() => {
        vi.advanceTimersByTime(500)
      })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }
    const summary = screen.getByTestId('practice-summary')
    expect(within(summary).getByText('正答（記録されません）')).toBeInTheDocument()
    fireEvent.click(within(summary).getByText('戻る'))
    expect(onFinish).toHaveBeenCalled()
  })
})
