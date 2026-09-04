// M2-20/M2-23: HomeScreen の「本番モード」「間違えた問題を復習」ボタン。
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-04'

describe('HomeScreen: 本番モード・間違いノートのボタン', () => {
  it('missLogCount が0のときは「間違いなし」で押せない', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        today={today}
        dailyNewRemaining={5}
        onStart={() => {}}
        onStartMissReview={() => {}}
        missLogCount={0}
      />,
    )
    const button = screen.getByTestId('miss-review-button')
    expect(button).toHaveTextContent('間違いなし')
    expect(button).toBeDisabled()
  })

  it('missLogCount > 0 なら件数付きラベルで押すと onStartMissReview が呼ばれる', () => {
    const onStartMissReview = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        today={today}
        dailyNewRemaining={5}
        onStart={() => {}}
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

  it('themeSets があり onStartMockExam があれば本番モードボタンを出す', () => {
    const onStartMockExam = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        today={today}
        dailyNewRemaining={5}
        onStart={() => {}}
        themeSets={[{ id: 'p1', era: 'tenpyo', title: 'X', text: '', sources: [], underlines: [] }]}
        onStartMockExam={onStartMockExam}
      />,
    )
    const button = screen.getByTestId('mock-exam-button')
    fireEvent.click(button)
    expect(onStartMockExam).toHaveBeenCalled()
  })

  it('themeSets が空なら本番モードボタンを出さない', () => {
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        today={today}
        dailyNewRemaining={5}
        onStart={() => {}}
        themeSets={[]}
        onStartMockExam={() => {}}
      />,
    )
    expect(screen.queryByTestId('mock-exam-button')).not.toBeInTheDocument()
  })
})
