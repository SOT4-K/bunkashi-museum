// M2b-05: 「画像の出典」は成績タブ（StatsScreen、廃止）からホーム最下部の設定
// （SettingsSection）に移設した。
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SettingsSection } from '../SettingsSection'
import { createInitialProgress } from '../../engine/progress'
import manifest from '../../../../content/images/manifest.json'

describe('画像の出典（クレジット画面）', () => {
  it('設定セクションから開き、manifest.json の attributionText が一覧表示される', () => {
    const progress = createInitialProgress('2026-09-03')
    render(<SettingsSection progress={progress} onImport={() => {}} onReset={() => {}} />)

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
    render(<SettingsSection progress={progress} onImport={() => {}} onReset={() => {}} />)
    fireEvent.click(screen.getByText('画像の出典'))
    expect(screen.getByRole('dialog', { name: '画像の出典' })).toBeInTheDocument()
    fireEvent.click(screen.getByText('閉じる'))
    expect(screen.queryByRole('dialog', { name: '画像の出典' })).not.toBeInTheDocument()
  })
})
