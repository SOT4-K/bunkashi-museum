import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { RandomLearnScreen } from '../RandomLearnScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { RandomLearnItem } from '../../engine/randomLearn'

const w1 = makeWork({ id: 'rl1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'rl2', era: 'hakuho', category: 'sculpture' })
const w3 = makeWork({ id: 'rl3', era: 'asuka', category: 'sculpture' })

function buildItem(work: typeof w1, passageId: string): RandomLearnItem {
  return {
    passageId,
    eraId: work.era,
    underlineKey: 'a',
    excerpt: [
      { type: 'text', value: '本文の冒頭。' },
      { type: 'underline', key: 'a', value: `${work.id}への言及` },
      { type: 'text', value: 'という記述である。' },
    ],
    question: {
      type: 'q1',
      work,
      choiceWorks: [w1, w2, w3],
      correctIndex: [w1, w2, w3].findIndex((w) => w.id === work.id),
      isReview: false,
      passageId,
      underlineKey: 'a',
    },
  }
}

const items: RandomLearnItem[] = [buildItem(w1, 'p1'), buildItem(w2, 'p2')]

function noopAnswer(workId: string) {
  return { xpGained: 10, isNewDiscovery: false, isNewlyMastered: workId === 'never' }
}

describe('RandomLearnScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('0問なら「作れなかった」メッセージを出す', () => {
    render(<RandomLearnScreen items={[]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    expect(screen.getByText(/作れなかった/)).toBeInTheDocument()
  })

  it('excerpt-panel に下線ハイライト付きの抜粋を表示し、テーマセットの全文リード表示は出さない', () => {
    render(<RandomLearnScreen items={items} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    expect(screen.getByTestId('excerpt-panel')).toBeInTheDocument()
    expect(screen.getByText(`${w1.id}への言及`)).toBeInTheDocument()
    expect(screen.queryByTestId('passage-read-panel')).not.toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('不正解のとき onMiss が work・type・passageId・underlineKey とともに呼ばれる', () => {
    const onMiss = vi.fn()
    render(<RandomLearnScreen items={items} eras={testEras} onAnswer={noopAnswer} onMiss={onMiss} onFinish={() => {}} />)
    const buttons = screen.getAllByTestId('choice-button')
    const wrongIndex = items[0].question.correctIndex === 0 ? 1 : 0
    fireEvent.click(buttons[wrongIndex])
    expect(onMiss).toHaveBeenCalledWith('rl1', 'q1', 'p1', 'a')
  })

  it('全問終了で結果画面（random-learn-summary）→ ホームに戻るで onFinish', () => {
    const onFinish = vi.fn()
    render(<RandomLearnScreen items={items} eras={testEras} onAnswer={noopAnswer} onFinish={onFinish} />)
    for (let i = 0; i < items.length; i++) {
      fireEvent.click(screen.getAllByTestId('choice-button')[items[i].question.correctIndex])
      act(() => {
        vi.advanceTimersByTime(500)
      })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }
    const summary = screen.getByTestId('random-learn-summary')
    expect(within(summary).getByText('2 / 2')).toBeInTheDocument()
    fireEvent.click(within(summary).getByText('ホームに戻る'))
    expect(onFinish).toHaveBeenCalled()
  })
})
