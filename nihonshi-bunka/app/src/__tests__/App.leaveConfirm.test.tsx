// M2-47「学習中の離脱確認」: 文化別練習の途中でタブを押すと確認ダイアログが出て、
// 「はい」で中止してホームに戻る（記録は残らない設計のため、そもそも失うものは無いが、
// 途中で放り出す操作である点は本番モードと同じ扱いにする）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { makeWork, testEras } from '../engine/__tests__/testFixtures'
import type { Work } from '../types'

const w1: Work = makeWork({ id: 'lc1', era: 'tenpyo', category: 'sculpture' })
const w2: Work = makeWork({ id: 'lc2', era: 'tenpyo', category: 'sculpture' })

vi.mock('../content', () => ({
  eras: testEras,
  works: [w1, w2],
  playableWorks: [w1, w2],
  themeSetPool: [w1, w2],
  passages: [],
  passagesByEra: {},
  worksById: { lc1: w1, lc2: w2 },
}))

async function importApp() {
  const mod = await import('../App')
  return mod.default
}

describe('App: 文化別練習の途中でタブを押すと確認ダイアログが出る（M2-47）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('学習タブ→文化選択→練習中に「ホーム」を押すと確認ダイアログが出て、「いいえ」なら練習が続く', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('学習'))
    fireEvent.click(screen.getAllByTestId('culture-button')[0])
    expect(screen.getByText(/の練習。結果は記録されない/)).toBeInTheDocument()

    const tabButtons = screen.getByLabelText('タブ').querySelectorAll('button')
    fireEvent.click(tabButtons[0]) // ホーム

    expect(screen.getByRole('alertdialog')).toHaveTextContent('中止してホームに戻りますか？')
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel')) // いいえ

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByText(/の練習。結果は記録されない/)).toBeInTheDocument()
  })

  it('「はい」なら練習を中止してホームに戻る', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('学習'))
    fireEvent.click(screen.getAllByTestId('culture-button')[0])

    const tabButtons = screen.getByLabelText('タブ').querySelectorAll('button')
    fireEvent.click(tabButtons[0]) // ホーム
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // はい

    expect(screen.queryByText(/の練習。結果は記録されない/)).not.toBeInTheDocument()
    expect(screen.getByTestId('mock-exam-button')).toBeInTheDocument()
  })
})
