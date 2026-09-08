// M2b-11: ホームは「次にクリアする面」カードだけを入口にする（9/8オーナー午後フィードバック）。
// 旧「本番モード」（mock-exam-button）「間違えた問題を復習」（miss-review-button）ボタンは
// ホームから削除し、模試タブ（ExamScreen）に統合した（M2b-12側の検証は ExamScreen.test.tsx）。
// 旧テスト（M2-45時代の本番モード/間違い復習ボタン検証）はここで「もう存在しない」ことの
// 固定に置き換える。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-08'

describe('HomeScreen: 本番モード・間違いノートのボタンは無い（M2b-11）', () => {
  it('本番モードボタン（mock-exam-button）はホームに存在しない', () => {
    render(<HomeScreen works={works} eras={eras} progress={createInitialProgress(today)} onSelectStage={() => {}} />)
    expect(screen.queryByTestId('mock-exam-button')).not.toBeInTheDocument()
    expect(screen.queryByText('本番モード')).not.toBeInTheDocument()
  })

  it('間違い復習ボタン（miss-review-button）はホームに存在しない（missLogに1件あっても）', () => {
    const progress = {
      ...createInitialProgress(today),
      missLog: [{ workId: 'w1', type: 'q1' as const, lastMissedAt: today, count: 1, correctStreak: 0 }],
    }
    render(<HomeScreen works={works} eras={eras} progress={progress} onSelectStage={() => {}} />)
    expect(screen.queryByTestId('miss-review-button')).not.toBeInTheDocument()
    expect(screen.queryByText(/間違えた問題を復習/)).not.toBeInTheDocument()
  })

  it('設定欄（settings-section）はホームに直置きされていない（歯車の中に移設。M2b-11）', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        onSelectStage={() => {}}
        onResetProgress={() => {}}
      />,
    )
    expect(screen.queryByTestId('settings-section')).not.toBeInTheDocument()
  })

  it('テーマセット一覧は表示しない（M2-45で削除、以降も維持）', () => {
    render(<HomeScreen works={works} eras={eras} progress={createInitialProgress(today)} onSelectStage={() => {}} />)
    expect(screen.queryByTestId('theme-set-button')).not.toBeInTheDocument()
    expect(screen.queryByText('テーマセット（模試型）')).not.toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
  })
})
