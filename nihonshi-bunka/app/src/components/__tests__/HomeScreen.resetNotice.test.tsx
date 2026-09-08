// M2b-05: v2初回起動時の進捗リセット通知（チケット規則7）。1回だけ表示し、閉じると
// onAcknowledgeResetNotice が呼ばれる。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-08'

describe('HomeScreen: 進捗リセット通知（M2b-05）', () => {
  it('resetNotice が true かつ onAcknowledgeResetNotice を渡すと通知バナーを出す', () => {
    const onAck = vi.fn()
    const progress = { ...createInitialProgress(today), resetNotice: true }
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={progress}
        onAcknowledgeResetNotice={onAck}
      />,
    )
    expect(screen.getByTestId('reset-notice-banner')).toHaveTextContent('新バージョンのため進捗をリセットしました')
    fireEvent.click(screen.getByTestId('reset-notice-dismiss'))
    expect(onAck).toHaveBeenCalledTimes(1)
  })

  it('resetNotice が false なら通知バナーを出さない', () => {
    const progress = { ...createInitialProgress(today), resetNotice: false }
    render(
      <HomeScreen
        works={works}
        eras={eras}
        progress={progress}
        onAcknowledgeResetNotice={() => {}}
      />,
    )
    expect(screen.queryByTestId('reset-notice-banner')).not.toBeInTheDocument()
  })
})
