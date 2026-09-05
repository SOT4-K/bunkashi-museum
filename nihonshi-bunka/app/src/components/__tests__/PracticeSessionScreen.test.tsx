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
      fireEvent.click(screen.getByTestId('confirm-answer-button'))
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

describe('PracticeSessionScreen（M2-42: リード文ボタンの best-effort な文脈解決）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('passages を渡さなければリード文ボタンを出さない（既存呼び出し元互換）', () => {
    render(<PracticeSessionScreen eraId="tenpyo" eraName="天平文化" pool={pool} imagePool={pool} eras={testEras} onFinish={() => {}} />)
    expect(screen.queryByTestId('lead-button')).not.toBeInTheDocument()
  })

  it('出題対象を下線に持つ passage があれば、リード文ボタンから全文を見られる', () => {
    const passages = [
      {
        id: 'practice-lead',
        era: 'tenpyo',
        title: '天平のリード文',
        text: '本文。[[a|pr1への言及]]。[[b|pr2への言及]]。[[c|pr3への言及]]。[[d|pr4への言及]]という記述である。',
        sources: ['x'],
        // pickThemeTargetId は workIds の先頭から見て pool にある最初の id を返すため、
        // 出題された作品がどれでも拾えるよう、下線ごとに1作品だけを対象にする。
        underlines: [
          { key: 'a', workIds: ['pr1'] },
          { key: 'b', workIds: ['pr2'] },
          { key: 'c', workIds: ['pr3'] },
          { key: 'd', workIds: ['pr4'] },
        ],
      },
    ]
    render(
      <PracticeSessionScreen
        eraId="tenpyo"
        eraName="天平文化"
        pool={pool}
        imagePool={pool}
        eras={testEras}
        passages={passages}
        onFinish={() => {}}
      />,
    )
    // どの作品が出題されても pr1〜pr4 のいずれかは passage の下線が拾える（下線ごとに1作品ずつ対応）。
    expect(screen.getByTestId('lead-button')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('lead-button'))
    expect(screen.getByTestId('lead-sheet-text')).toHaveTextContent('という記述である')
  })
})
