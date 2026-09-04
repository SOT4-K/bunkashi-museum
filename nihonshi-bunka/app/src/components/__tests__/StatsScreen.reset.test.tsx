// M2-46: 進捗リセット（成績タブ）。警告を2回出してから localStorage の該当キーを削除しホームへ戻る
// （実際の削除・ホーム遷移は App.tsx 側の onReset が担う。ここでは2段階確認の分岐を検証する）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsScreen } from '../StatsScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import { createInitialProgress } from '../../engine/progress'

const w1 = makeWork({ id: 'rs1', era: 'tenpyo', title: '作品1' })

describe('StatsScreen: 進捗リセット（M2-46）', () => {
  it('onReset を渡さなければリセットボタンを出さない（既存呼び出し元互換）', () => {
    render(<StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-05')} onImport={() => {}} />)
    expect(screen.queryByTestId('reset-progress-button')).not.toBeInTheDocument()
  })

  it('1回目の警告→「キャンセル」で何も起きない', () => {
    const onReset = vi.fn()
    render(
      <StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-05')} onImport={() => {}} onReset={onReset} />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('経験値・図鑑・復習・間違いノートがすべて消え')
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('1回目の警告に「先に進捗を書き出す」導線がある', () => {
    const onReset = vi.fn()
    render(
      <StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-05')} onImport={() => {}} onReset={onReset} />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    expect(screen.getByTestId('reset-export-link')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('reset-export-link'))
    expect(screen.getByText('進捗を書き出した。')).toBeInTheDocument()
    // 書き出した後も1回目の確認は開いたまま（誤って進めない）
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('1回目「続ける」→2回目の警告→「キャンセル」で onReset は呼ばれない', () => {
    const onReset = vi.fn()
    render(
      <StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-05')} onImport={() => {}} onReset={onReset} />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 1回目「続ける」
    expect(screen.getByRole('alertdialog')).toHaveTextContent('本当にリセットしますか？')
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('2回とも確認すると onReset が呼ばれる', () => {
    const onReset = vi.fn()
    render(
      <StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-05')} onImport={() => {}} onReset={onReset} />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 1回目「続ける」
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 2回目「リセットする」
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
