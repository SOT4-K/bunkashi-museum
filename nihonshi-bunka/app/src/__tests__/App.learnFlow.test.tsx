// M2-45: 「学習を始める」（ランダム学習）とテーマセット一覧は本番モードに統合・削除された。
// M2b-11: ホームの「本番モード」ボタン（mock-exam-button）は削除し、ホームは「次にクリアする
// 面」カードだけの入口にした（9/8オーナー午後フィードバック）。goMockExam（大問IV形式・
// MockExamScreen）のエンジン自体は図鑑タブの空状態「学習を始める」ボタンから引き続き
// 到達できるため、そちらを入口にしてMockExamScreenの流れ（下線抜粋＋設問→回答→結果→
// ホームに戻る）を検証する。
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
  // M2-16: MockExamScreen/PracticeSessionScreen の pool は themeSetPool（画像なし項目も含む）を渡す。
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

/** 図鑑タブ（作品未発見の空状態）の「学習を始める」から goMockExam を起動する（M2b-11）。 */
function startMockExamFromMuseum() {
  fireEvent.click(screen.getByRole('button', { name: '図鑑' }))
  fireEvent.click(screen.getByText('学習を始める'))
}

describe('App: 本番モード（M2-45で全15文化に統合。M2b-11でホームからは削除）', () => {
  beforeEach(() => {
    // このテスト環境では localStorage が未定義（progress.ts の loadProgress がその場合
    // createInitialProgress にフォールバックする設計）。App の再 render ごとに状態は
    // 常に初期化されるため、明示的なクリアは不要。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ホームに本番モードボタン・テーマセット一覧・「学習を始める」ボタンは無い（M2-45で削除・M2b-11でホームからも削除）', async () => {
    const App = await importApp()
    render(<App />)
    expect(screen.queryByTestId('theme-set-button')).not.toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-exam-button')).not.toBeInTheDocument()
  })

  it('図鑑タブの「学習を始める」→開始→下線抜粋＋設問→回答→結果→ホームに戻る', async () => {
    const App = await importApp()
    render(<App />)

    startMockExamFromMuseum()
    fireEvent.click(screen.getByTestId('mock-exam-start'))

    expect(screen.getByTestId('mock-exam-excerpt-panel')).toBeInTheDocument()
    expect(screen.getAllByTestId('choice-button').length).toBeGreaterThan(0)

    // 候補作品が2件（lw1・lw2）しかないため実際の問題数は1〜2問。尽きるまで回答して結果画面へ。
    for (let guard = 0; guard < 5; guard++) {
      if (screen.queryByTestId('mock-exam-summary')) break
      fireEvent.click(screen.getAllByTestId('choice-button')[0])
      fireEvent.click(screen.getByTestId('confirm-answer-button'))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      const dialog = screen.getByRole('dialog')
      fireEvent.click(within(dialog).getByTestId('next-button'))
    }

    const summary = screen.getByTestId('mock-exam-summary')
    fireEvent.click(within(summary).getByText('ホームに戻る'))

    // onFinish はタブを切り替えない（開始した図鑑タブのまま）。ホームに戻る導線自体は
    // タブバー側の責務なので、ここではモーダル/オーバーレイが閉じたことだけ確認する。
    expect(screen.queryByTestId('mock-exam-excerpt-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-exam-summary')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ホーム' }))
    expect(screen.getByTestId('next-stage-card')).toBeInTheDocument()
  })

  it('M2-47: 本番モードの途中でタブを押すと確認ダイアログが出て、「はい」で記録せず中止する', async () => {
    const App = await importApp()
    render(<App />)

    startMockExamFromMuseum()
    fireEvent.click(screen.getByTestId('mock-exam-start'))
    expect(screen.getByTestId('mock-exam-excerpt-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('タブ').querySelector('button')!)
    expect(screen.getByRole('alertdialog')).toHaveTextContent('中止してホームに戻りますか？')

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(screen.queryByTestId('mock-exam-excerpt-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('next-stage-card')).toBeInTheDocument()
  })
})
