// M2-20 → M2-45: 本番モード（全15文化・重み付き抽選に統合）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MockExamScreen } from '../MockExamScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { MockExamItem } from '../../engine/mockExam'
import type { Passage } from '../../types'

const w1 = makeWork({ id: 'me1', era: 'tenpyo', category: 'sculpture' })
const w2 = makeWork({ id: 'me2', era: 'hakuho', category: 'sculpture' })

const passageA: Passage = {
  id: 'sec-a',
  era: 'tenpyo',
  title: 'リード文A',
  text: '本文。[[a|下線A]]。',
  sources: [],
  underlines: [{ key: 'a', workIds: ['me1'] }],
}
const passageB: Passage = {
  id: 'sec-b',
  era: 'hakuho',
  title: 'リード文B',
  text: '本文。[[a|下線B]]。',
  sources: [],
  underlines: [{ key: 'a', workIds: ['me2'] }],
}

const items: MockExamItem[] = [
  {
    passage: passageA,
    eraId: 'tenpyo',
    underlineKey: 'a',
    excerpt: [{ type: 'underline', key: 'a', value: '下線A' }],
    question: { type: 'q1', work: w1, choiceWorks: [w1, w2], correctIndex: 0, isReview: false },
  },
  {
    passage: passageB,
    eraId: 'hakuho',
    underlineKey: 'a',
    excerpt: [{ type: 'underline', key: 'a', value: '下線B' }],
    question: { type: 'q1', work: w2, choiceWorks: [w1, w2], correctIndex: 1, isReview: false },
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
    render(<MockExamScreen items={[]} pool={[w1, w2]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    expect(screen.getByText(/作れなかった/)).toBeInTheDocument()
  })

  it('開始画面→「時間を計る」オフの既定では時間制限UIを出さない→1問ずつ→結果', () => {
    render(<MockExamScreen items={items} pool={[w1, w2]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)

    expect(screen.getByTestId('mock-exam-timed-toggle')).not.toBeChecked()
    fireEvent.click(screen.getByTestId('mock-exam-start'))

    // 既定（時間を計るオフ）では残り時間の表示を出さない
    expect(screen.queryByTestId('mock-exam-timer')).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-exam-excerpt-panel')).toHaveTextContent('下線A')

    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    let dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    expect(screen.getByTestId('mock-exam-excerpt-panel')).toHaveTextContent('下線B')

    fireEvent.click(screen.getAllByTestId('choice-button')[1])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))

    const summary = screen.getByTestId('mock-exam-summary')
    expect(within(summary).getByText('4 / 4点')).toBeInTheDocument()
    expect(within(summary).getByText('2 / 2 問正解')).toBeInTheDocument()
    const breakdown = screen.getByTestId('type-breakdown')
    expect(within(breakdown).getByText('画像→作品名')).toBeInTheDocument()
    expect(within(breakdown).getByText('2 / 2')).toBeInTheDocument()
  })

  it('「時間を計る」をオンにすると残り時間表示が出る', () => {
    render(<MockExamScreen items={items} pool={[w1, w2]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    fireEvent.click(screen.getByTestId('mock-exam-timed-toggle'))
    fireEvent.click(screen.getByTestId('mock-exam-start'))
    expect(screen.getByTestId('mock-exam-timer')).toHaveTextContent('10:00')
  })

  it('M2-42: 固定の「リード文」ボタンから全文と現在の下線ラベルを見られる', () => {
    render(<MockExamScreen items={items} pool={[w1, w2]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />)
    fireEvent.click(screen.getByTestId('mock-exam-start'))

    fireEvent.click(screen.getByTestId('lead-button'))
    const text = screen.getByTestId('lead-sheet-text')
    expect(within(text).getByText('下線A')).toBeInTheDocument()
    expect(within(text).getByText('a')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('lead-sheet-close'))
    expect(screen.queryByTestId('lead-sheet-text')).not.toBeInTheDocument()
  })
})

describe('MockExamScreen（M2-52: 画像リード型のリード画像を常時表示）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('kind: "image" のセットは問題画面にリード画像を常に表示する（折りたたみ既定は開く）', () => {
    const imageWork = makeWork({ id: 'me-img', era: 'kasei' })
    const imagePassage: Passage = {
      id: 'sec-image',
      era: 'kasei',
      kind: 'image',
      title: '画像リード',
      leadWorkIds: ['me-img'],
      text: '(1)は[[a|作者不明の作]]である。',
      sources: [],
      underlines: [{ key: 'a' }],
    }
    const imageItems: MockExamItem[] = [
      {
        passage: imagePassage,
        eraId: 'kasei',
        underlineKey: 'a',
        excerpt: [{ type: 'text', value: '(1)は作者不明の作である。' }],
        question: { type: 'q4', work: imageWork, choiceWorks: [], choiceStatements: [], correctIndex: 0, isReview: false },
      },
    ]

    render(
      <MockExamScreen items={imageItems} pool={[imageWork]} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    fireEvent.click(screen.getByTestId('mock-exam-start'))

    // トグル操作なしで、既定で開いた状態のリード画像が問題画面に出ている
    expect(screen.getByTestId('lead-image-grid')).toBeInTheDocument()

    // 折りたたみは残す（既定は開いているが、隠す操作はできる）
    fireEvent.click(screen.getByTestId('lead-image-toggle'))
    expect(screen.queryByTestId('lead-image-grid')).not.toBeInTheDocument()
  })
})
