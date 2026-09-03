import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-03'

describe('HomeScreen（空状態の文言）', () => {
  it('本番ビルドで作品が0件のときは「出題できる作品がまだない」（「また明日」ではない）', () => {
    const progress = createInitialProgress(today)
    render(
      <HomeScreen
        works={[]}
        eras={eras}
        progress={progress}
        today={today}
        dailyNewRemaining={5}
        onStart={() => {}}
      />,
    )
    expect(screen.getByText('出題できる作品がまだない。')).toBeInTheDocument()
    expect(screen.queryByText('今日の分は学習し終えた。また明日。')).not.toBeInTheDocument()
  })

  it('作品はあるが今日の新規上限が0で復習も無いときは「また明日」', () => {
    const progress = createInitialProgress(today)
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={progress}
        today={today}
        dailyNewRemaining={0}
        onStart={() => {}}
      />,
    )
    expect(screen.getByText('今日の分は学習し終えた。また明日。')).toBeInTheDocument()
    expect(screen.queryByText('出題できる作品がまだない。')).not.toBeInTheDocument()
  })
})
