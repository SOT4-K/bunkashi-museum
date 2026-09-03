import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MuseumScreen } from '../MuseumScreen'
import { works, eras } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import type { ItemProgress, ProgressState } from '../../types'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

function discoveredItem(): ItemProgress {
  const cell = { box: 0, due: '2026-09-03', correct: 1, wrong: 0 }
  return { q1: cell, q2: cell, q3: cell, discoveredAt: '2026-09-01', masteredAt: null }
}

function seedProgress(): ProgressState {
  const base = createInitialProgress('2026-09-03')
  return { ...base, items: { [ashura.id]: discoveredItem() } }
}

describe('MuseumScreen: 図鑑グリッドのサムネイル拡大（虫眼鏡アイコン）', () => {
  it('発見済みタイルの拡大ボタンをタップするとライトボックスが開き、詳細シートは開かない', () => {
    render(<MuseumScreen works={works} eras={eras} progress={seedProgress()} onStart={() => {}} />)

    const expandButtons = screen.getAllByRole('button', { name: /を拡大表示/ })
    expect(expandButtons.length).toBeGreaterThan(0)
    fireEvent.click(expandButtons[0])

    expect(screen.getByRole('dialog', { name: /拡大表示/ })).toBeInTheDocument()
    // 作品詳細（BottomSheet, aria-label=作品名のみ）は開いていない
    expect(screen.queryByRole('dialog', { name: ashura.title })).not.toBeInTheDocument()
  })

  it('タイル本体をタップすると作品詳細シートが開く（従来どおり）', () => {
    render(<MuseumScreen works={works} eras={eras} progress={seedProgress()} onStart={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: ashura.title }))
    expect(screen.getByRole('dialog', { name: ashura.title })).toBeInTheDocument()
  })
})
