// M2-20/M2-23 → M2-45: HomeScreen の「本番モード」「間違えた問題を復習」ボタン。
// 「学習を始める」（ランダム学習）とテーマセット一覧は M2-45 で本番モードに統合・削除された。
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-04'

describe('HomeScreen: 本番モード・間違いノートのボタン（M2-45）', () => {
  it('missLogCount が0のときは間違い復習ボタンを出さない（非表示。旧仕様の disabled から変更）', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={true}
        onStartMockExam={() => {}}
        onStartMissReview={() => {}}
        missLogCount={0}
      />,
    )
    expect(screen.queryByTestId('miss-review-button')).not.toBeInTheDocument()
  })

  it('missLogCount > 0 なら件数付きラベルで押すと onStartMissReview が呼ばれる', () => {
    const onStartMissReview = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={true}
        onStartMockExam={() => {}}
        onStartMissReview={onStartMissReview}
        missLogCount={3}
      />,
    )
    const button = screen.getByTestId('miss-review-button')
    expect(button).toHaveTextContent('間違えた問題を復習（3問）')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(onStartMissReview).toHaveBeenCalled()
  })

  it('hasMockExam が true なら本番モードボタンが押せて onStartMockExam が呼ばれる', () => {
    const onStartMockExam = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={true}
        onStartMockExam={onStartMockExam}
      />,
    )
    const button = screen.getByTestId('mock-exam-button')
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    expect(onStartMockExam).toHaveBeenCalled()
  })

  it('hasMockExam が false なら本番モードボタンは押せない', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={false}
        onStartMockExam={() => {}}
      />,
    )
    expect(screen.getByTestId('mock-exam-button')).toBeDisabled()
  })

  it('テーマセット一覧は表示しない（M2-45で削除）', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={true}
        onStartMockExam={() => {}}
      />,
    )
    expect(screen.queryByTestId('theme-set-button')).not.toBeInTheDocument()
    expect(screen.queryByText('テーマセット（模試型）')).not.toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
  })
})
