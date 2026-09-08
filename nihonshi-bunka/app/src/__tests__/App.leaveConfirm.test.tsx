// M2-47「学習中の離脱確認」→ M2b-01 でステージ制に置き換え → M2b-05/06 で学習タブがマップ
// タブ（絵巻風SVG）に置き換わった。マップからステージを選んで挑戦中にタブを押すと確認
// ダイアログが出て、「はい」で中止してホームに戻る（このモードは本番モードと同じく
// progress を更新するため、途中離脱は記録の観点でも本番モードと同じ扱いにする）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { makeWork, testEras } from '../engine/__tests__/testFixtures'
import type { Work } from '../types'

const w1: Work = makeWork({ id: 'lc1', era: 'asuka', category: 'sculpture' })
const w2: Work = makeWork({ id: 'lc2', era: 'asuka', category: 'sculpture' })

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

describe('App: ステージ挑戦中にタブを押すと確認ダイアログが出る（M2b-01）', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('学習タブ→★1ステージ選択→挑戦中に「ホーム」を押すと確認ダイアログが出て、「いいえ」ならステージが続く', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('マップ'))
    fireEvent.click(screen.getByTestId('stage-tile-asuka-1-1'))
    expect(screen.getAllByTestId('choice-button').length).toBeGreaterThan(0)

    const tabButtons = screen.getByLabelText('タブ').querySelectorAll('button')
    fireEvent.click(tabButtons[0]) // ホーム

    expect(screen.getByRole('alertdialog')).toHaveTextContent('中止してホームに戻りますか？')
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel')) // いいえ

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('choice-button').length).toBeGreaterThan(0)
  })

  it('「はい」ならステージを中止してホームに戻る（進捗は記録されない）', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByText('マップ'))
    fireEvent.click(screen.getByTestId('stage-tile-asuka-1-1'))

    const tabButtons = screen.getByLabelText('タブ').querySelectorAll('button')
    fireEvent.click(tabButtons[0]) // ホーム
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // はい

    expect(screen.queryByTestId('choice-button')).not.toBeInTheDocument()
    // M2b-11: ホームの入口は「次にクリアする面」カードのみ（本番モードボタンはホームから削除）。
    expect(screen.getByTestId('next-stage-card')).toBeInTheDocument()

    // ホーム→学習タブに戻ると asuka の s1 はまだ未クリア（中止したので記録されない。
    // 作品2件×型2種=最大4問生成できるため「クリア済」ではなく件数表示のまま）
    fireEvent.click(screen.getByText('マップ'))
    expect(screen.getByTestId('stage-tile-asuka-1-1')).toHaveTextContent('問')
    expect(screen.getByTestId('stage-tile-asuka-1-1')).not.toHaveTextContent('クリア済')
  })
})
