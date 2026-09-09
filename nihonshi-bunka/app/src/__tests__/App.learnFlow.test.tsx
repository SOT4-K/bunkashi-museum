// M2-45: 「学習を始める」（ランダム学習）とテーマセット一覧は本番モードに統合・削除された。
// M2b-11: ホームの「本番モード」ボタン（mock-exam-button）は削除し、ホームは「次にクリアする
// 面」カードだけの入口にした（9/8オーナー午後フィードバック）。
// M2b-18（2026-09-09 オーナー判断「本番モードはなしでいい。模試モードに踏襲された」）:
// 本番モード（MockExamScreen・goMockExam）自体を廃止した。それまで図鑑タブの空状態
// 「学習を始める」ボタンだけが唯一の入口として残っていたが、1件でも作品を発見すると
// 到達不能な死にコードになっていた（M2b-99e指摘）。ここでは新しい導線
// （空状態ボタン→ホームの「次にクリアする面」カードへ遷移）を検証する。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
  themeSetPool: [w1, w2],
  passages: [passageA, passageB],
  passagesByEra: {},
  worksById: { lw1: w1, lw2: w2 },
  worldThemesById: {},
}))

async function importApp() {
  const mod = await import('../App')
  return mod.default
}

describe('App: 本番モード廃止後の図鑑空状態導線（M2b-18）', () => {
  beforeEach(() => {
    // このテスト環境では localStorage が未定義（progress.ts の loadProgress がその場合
    // createInitialProgress にフォールバックする設計）。App の再 render ごとに状態は
    // 常に初期化されるため、明示的なクリアは不要。
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ホームに本番モードボタン・テーマセット一覧・旧「学習を始める」ボタンは無い（M2-45で削除・M2b-11でホームからも削除）', async () => {
    const App = await importApp()
    render(<App />)
    expect(screen.queryByTestId('theme-set-button')).not.toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
    expect(screen.queryByTestId('mock-exam-button')).not.toBeInTheDocument()
  })

  it('アプリのどの画面にも「本番モード」という文言が残っていない（M2b-18）', async () => {
    const App = await importApp()
    render(<App />)
    for (const tabLabel of ['ホーム', 'マップ', '図鑑', '模試']) {
      fireEvent.click(screen.getByRole('button', { name: tabLabel }))
      expect(screen.queryByText(/本番モード/)).not.toBeInTheDocument()
    }
  })

  it('図鑑タブの空状態（未発見作品0件）は「最初の面へ」ボタンを出し、押すとホームの「次にクリアする面」カードへ遷移する', async () => {
    const App = await importApp()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '図鑑' }))
    expect(screen.getByText('最初の作品を見つけよう。')).toBeInTheDocument()
    const startButton = screen.getByText('最初の面へ')

    fireEvent.click(startButton)

    // ホームタブに遷移し、「次にクリアする面」カードが見える（旧: ここで本番モードの
    // 出題セッションが始まっていた）。
    expect(screen.getByTestId('next-stage-card')).toBeInTheDocument()
    // タブバーの選択状態もホームになっている。
    expect(screen.getByRole('button', { name: 'ホーム' })).toHaveAttribute('aria-current', 'page')
  })
})
