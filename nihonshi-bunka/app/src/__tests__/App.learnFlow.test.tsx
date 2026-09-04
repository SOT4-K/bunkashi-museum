// 「学習を始める」のテーマセット連続提示（mock-exam-analysis.md 9章「M2-13」）の統合テスト。
// content.ts をモックし、テーマセット2本→自由出題（尽きればメッセージ）の一連の流れを確認する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { makeWork, testEras } from '../engine/__tests__/testFixtures'
import type { Passage, Work } from '../types'

const w1: Work = makeWork({ id: 'lw1', era: 'tenpyo', category: 'sculpture' })
const w2: Work = makeWork({ id: 'lw2', era: 'hakuho', category: 'sculpture' })

const passageA: Passage = {
  id: 'flow-a',
  era: 'tenpyo',
  title: 'テーマセットA',
  text: '本文。[[a|下線A]]。',
  sources: ['x'],
  underlines: [{ key: 'a', workIds: ['lw1'] }],
}
const passageB: Passage = {
  id: 'flow-b',
  era: 'hakuho',
  title: 'テーマセットB',
  text: '本文。[[a|下線B]]。',
  sources: ['x'],
  underlines: [{ key: 'a', workIds: ['lw2'] }],
}

vi.mock('../content', () => ({
  eras: testEras,
  works: [w1, w2],
  playableWorks: [w1, w2],
  passages: [passageA, passageB],
  passagesByEra: {},
}))

async function importApp() {
  const mod = await import('../App')
  return mod.default
}

describe('App: 「学習を始める」はテーマセットを連続提示し、尽きたら自由出題へ続ける（M2-13）', () => {
  beforeEach(() => {
    // このテスト環境では localStorage が未定義（progress.ts の loadProgress がその場合
    // createInitialProgress にフォールバックする設計）。App の再 render ごとに状態は
    // 常に初期化されるため、明示的なクリアは不要。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('2本のテーマセットを順番に消化し、その後フリー出題（対象が尽きていればメッセージ）に移る', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('学習を始める'))

    // 1本目: 読解フェーズ→設問→回答→結果→「ホームに戻る」
    expect(screen.getByTestId('passage-read-panel')).toBeInTheDocument()
    const firstTitle = screen.getByText(/テーマセット[AB]/).textContent
    fireEvent.click(screen.getByTestId('start-quiz-button'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const dialog1 = screen.getByRole('dialog')
    fireEvent.click(within(dialog1).getByTestId('next-button'))
    const summary1 = screen.getByTestId('theme-set-summary')
    fireEvent.click(within(summary1).getByText('ホームに戻る'))

    // 2本目に自動で進む（1本目と違うタイトル）
    expect(screen.getByTestId('passage-read-panel')).toBeInTheDocument()
    const secondTitle = screen.getByText(/テーマセット[AB]/).textContent
    expect(secondTitle).not.toBe(firstTitle)

    fireEvent.click(screen.getByTestId('start-quiz-button'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const dialog2 = screen.getByRole('dialog')
    fireEvent.click(within(dialog2).getByTestId('next-button'))
    const summary2 = screen.getByTestId('theme-set-summary')
    fireEvent.click(within(summary2).getByText('ホームに戻る'))

    // テーマセットが尽きたので自由出題（LearnScreen。学習タブ）に自動で移る。
    // 正誤はランダムなため（誤答だと lw1/lw2 が引き続き due になり得る）、遷移先の内容までは
    // 決め打ちにせず、「テーマセット画面を離れ、学習タブに切り替わった」ことだけ確認する。
    expect(screen.queryByTestId('passage-read-panel')).not.toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /学習/ })).toHaveAttribute('aria-current', 'page')
  })

  it('ホーム下部から個別にテーマセットを選んだときは、終了後に自由出題へは続けない（従来どおりホームに戻る）', async () => {
    const App = await importApp()
    render(<App />)

    const themeSetButtons = screen.getAllByTestId('theme-set-button')
    fireEvent.click(themeSetButtons[0])

    expect(screen.getByTestId('passage-read-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('start-quiz-button'))
    fireEvent.click(screen.getAllByTestId('choice-button')[0])
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('next-button'))
    const summary = screen.getByTestId('theme-set-summary')
    fireEvent.click(within(summary).getByText('ホームに戻る'))

    // 自由出題に自動遷移せず、ホーム画面に戻る（学習を始めるボタンが見える）
    expect(screen.getByText('学習を始める')).toBeInTheDocument()
  })
})
