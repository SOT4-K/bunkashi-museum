// 「学習を始める」（ランダム学習。M2-21）の統合テスト。content.ts をモックし、
// ホームの「学習を始める」→ RandomLearnScreen（下線抜粋＋設問）→ 結果→ホーム、の流れと、
// ホーム下部の個別テーマセット選択（従来どおり ThemeSetScreen）が引き続き動くことを確認する。
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
  text: '本文の冒頭。[[a|下線A]]という記述が続く。',
  sources: ['x'],
  underlines: [{ key: 'a', workIds: ['lw1'] }],
}
const passageB: Passage = {
  id: 'flow-b',
  era: 'hakuho',
  title: 'テーマセットB',
  text: '本文の冒頭。[[a|下線B]]という記述が続く。',
  sources: ['x'],
  underlines: [{ key: 'a', workIds: ['lw2'] }],
}

vi.mock('../content', () => ({
  eras: testEras,
  works: [w1, w2],
  playableWorks: [w1, w2],
  // M2-16: ThemeSetScreen/RandomLearnScreen の pool は themeSetPool（画像なし項目も含む）を渡す。
  // このテストの作品は全て kind: artifact（既定）なので playableWorks と同じ内容でよい。
  themeSetPool: [w1, w2],
  passages: [passageA, passageB],
  passagesByEra: {},
  worksById: { lw1: w1, lw2: w2 },
}))

async function importApp() {
  const mod = await import('../App')
  return mod.default
}

describe('App: 「学習を始める」はランダム学習（全文化・下線プール・M2-21）を開始する', () => {
  beforeEach(() => {
    // このテスト環境では localStorage が未定義（progress.ts の loadProgress がその場合
    // createInitialProgress にフォールバックする設計）。App の再 render ごとに状態は
    // 常に初期化されるため、明示的なクリアは不要。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('「学習を始める」→ 下線抜粋＋設問（テーマセットの全文リードではない）→ 回答→ 結果→ ホームに戻る', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('学習を始める'))

    // ThemeSetScreen の全文リード表示（passage-read-panel）ではなく、下線抜粋（excerpt-panel）が出る。
    expect(screen.queryByTestId('passage-read-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('excerpt-panel')).toBeInTheDocument()
    expect(screen.getAllByTestId('choice-button').length).toBeGreaterThan(0)

    // 候補作品が2件（lw1・lw2）しかないため実際の問題数は1〜2問。尽きるまで回答して結果画面へ。
    for (let guard = 0; guard < 5; guard++) {
      if (screen.queryByTestId('random-learn-summary')) break
      fireEvent.click(screen.getAllByTestId('choice-button')[0])
      act(() => {
        vi.advanceTimersByTime(500)
      })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }

    const summary = screen.getByTestId('random-learn-summary')
    fireEvent.click(within(summary).getByText('ホームに戻る'))

    expect(screen.getByText('学習を始める')).toBeInTheDocument()
  })

  it('ホーム下部から個別にテーマセットを選んだときは、従来どおり ThemeSetScreen（全文リード表示）で遊べる', async () => {
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

    expect(screen.getByText('学習を始める')).toBeInTheDocument()
  })
})
