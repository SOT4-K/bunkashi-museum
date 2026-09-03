import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsScreen } from '../StatsScreen'
import { eras, works } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import manifest from '../../../../content/images/manifest.json'

describe('画像の出典（クレジット画面）', () => {
  it('成績タブから開き、manifest.json の attributionText が一覧表示される', () => {
    const progress = createInitialProgress('2026-09-03')
    render(<StatsScreen works={works} eras={eras} progress={progress} onImport={() => {}} />)

    expect(screen.queryByText(/The Metropolitan Museum of Art/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('画像の出典'))

    const withAttribution = (manifest.images ?? []).filter((img) => img.attributionText)
    expect(withAttribution.length).toBeGreaterThan(0)
    for (const entry of withAttribution.slice(0, 3)) {
      expect(screen.getByText(entry.attributionText)).toBeInTheDocument()
    }
  })

  it('閉じるボタンでシートが消える', () => {
    const progress = createInitialProgress('2026-09-03')
    render(<StatsScreen works={works} eras={eras} progress={progress} onImport={() => {}} />)
    fireEvent.click(screen.getByText('画像の出典'))
    expect(screen.getByRole('dialog', { name: '画像の出典' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('閉じる'))
    expect(screen.queryByRole('dialog', { name: '画像の出典' })).not.toBeInTheDocument()
  })
})
