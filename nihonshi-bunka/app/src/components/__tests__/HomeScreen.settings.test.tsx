// M2b-05: ホーム最下部の「設定」（旧成績タブから移設）。3回連続の確認を通さないと
// 全リセットが実行されないことを固定する（チケット規則: 1回目「本当に？」→2回目
// 「元に戻せません」→3回目「『リセット』と入力」相当の最終確認）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-08'

describe('HomeScreen: 設定セクション（M2b-05）', () => {
  it('onResetProgress を渡さなければ設定セクション自体を出さない（既存呼び出し元互換）', () => {
    render(
      <HomeScreen works={works} eras={eras} progress={createInitialProgress(today)} hasMockExam={false} onStartMockExam={() => {}} />,
    )
    expect(screen.queryByTestId('settings-section')).not.toBeInTheDocument()
  })

  it('1回目「本当に？」→2回目「元に戻せません」→3回目、正しい語を入力するまで確定できない', () => {
    const onReset = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={false}
        onStartMockExam={() => {}}
        onResetProgress={onReset}
      />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('本当に？')
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 1回目「続ける」

    expect(screen.getByRole('alertdialog')).toHaveTextContent('元に戻せません')
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 2回目「続ける」

    // 3回目: 未入力では確定ボタンが押せない。
    expect(screen.getByRole('alertdialog')).toHaveTextContent('リセット')
    const confirmButton = screen.getByTestId('confirm-dialog-confirm')
    expect(confirmButton).toBeDisabled()
    fireEvent.click(confirmButton)
    expect(onReset).not.toHaveBeenCalled()

    // 誤った文字列では依然として押せない。
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'りせっと' } })
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled()

    // 正しい語を入力すると確定できる。
    fireEvent.change(screen.getByTestId('reset-confirm-input'), { target: { value: 'リセット' } })
    expect(screen.getByTestId('confirm-dialog-confirm')).not.toBeDisabled()
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))
    expect(onReset).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('途中でキャンセルすれば onReset は呼ばれず、最初からやり直しになる', () => {
    const onReset = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={false}
        onStartMockExam={() => {}}
        onResetProgress={onReset}
      />,
    )
    fireEvent.click(screen.getByTestId('reset-progress-button'))
    fireEvent.click(screen.getByTestId('confirm-dialog-confirm')) // 1回目「続ける」
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel')) // 2回目でキャンセル
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(onReset).not.toHaveBeenCalled()
  })

  it('進捗の書き出し・読み込み（旧成績タブと同じ機能）', () => {
    const onImport = vi.fn()
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={createInitialProgress(today)}
        hasMockExam={false}
        onStartMockExam={() => {}}
        onResetProgress={() => {}}
        onImportProgress={onImport}
      />,
    )
    fireEvent.click(screen.getByText('進捗を書き出す'))
    const textarea = screen.getByPlaceholderText(/書き出すと進捗のJSON/) as HTMLTextAreaElement
    expect(JSON.parse(textarea.value).version).toBe(createInitialProgress(today).version)

    fireEvent.click(screen.getByText('進捗を読み込む'))
    expect(onImport).toHaveBeenCalledTimes(1)
  })
})
