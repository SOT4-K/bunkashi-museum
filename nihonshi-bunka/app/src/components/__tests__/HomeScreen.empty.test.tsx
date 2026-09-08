// M2b-11: ホームから「本番モード」ボタン（hasMockExam/onStartMockExam）が削除されたため、
// それに紐付いていた空状態の文言（「出題できる作品がまだない」「リード文の投入待ち」）は
// もうホームには出ない（模試タブ ExamScreen.tsx 側に同等の案内が残る。ExamScreen.test.tsx）。
// ここでは、作品が0件でもホームがクラッシュせず表示され、旧文言が出ないことを固定する。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-03'

describe('HomeScreen（空状態。M2b-11）', () => {
  it('作品が0件でもクラッシュせず表示される（レベル・XP表示は出る）', () => {
    const progress = createInitialProgress(today)
    render(<HomeScreen works={[]} eras={eras} progress={progress} />)
    expect(screen.getByText(/Lv\.1/)).toBeInTheDocument()
    expect(screen.getByText('0 XP')).toBeInTheDocument()
  })

  it('旧「出題できる作品がまだない」「リード文の投入待ち」の文言はホームにもう出ない（本番モードUIごと削除）', () => {
    const progress = createInitialProgress(today)
    render(<HomeScreen works={[]} eras={eras} progress={progress} />)
    expect(screen.queryByText('出題できる作品がまだない。')).not.toBeInTheDocument()
    expect(screen.queryByText('リード文の投入待ち。')).not.toBeInTheDocument()
  })

  it('onSelectStage を渡さなければ次の面カードも出ない（works=0件・onSelectStageなしの組み合わせ）', () => {
    const progress = createInitialProgress(today)
    render(<HomeScreen works={[]} eras={eras} progress={progress} />)
    expect(screen.queryByTestId('next-stage-card')).not.toBeInTheDocument()
    expect(screen.queryByTestId('all-worlds-cleared-banner')).not.toBeInTheDocument()
  })
})
