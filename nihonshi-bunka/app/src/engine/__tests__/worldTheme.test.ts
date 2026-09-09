import { describe, expect, it } from 'vitest'
import { DEFAULT_WORLD_THEME, getWorldTheme } from '../worldTheme'
import type { WorldTheme } from '../../types'

describe('getWorldTheme', () => {
  it('データにある eraId はそのテーマを返す', () => {
    const theme: WorldTheme = {
      eraId: 'genshi',
      palette: { sky: '#fff', ground: '#000', road: '#111', accent: '#222' },
      bossShape: 'kofun',
      motifs: [{ id: 'dogu', label: '土偶' }],
    }
    expect(getWorldTheme({ genshi: theme }, 'genshi')).toBe(theme)
  })

  it('データに無い eraId は既定テーマ（無地パレット・motifs空）にフォールバックする', () => {
    const result = getWorldTheme({}, 'unknown-era')
    expect(result.eraId).toBe('unknown-era')
    expect(result.motifs).toEqual([])
    expect(result.palette).toEqual(DEFAULT_WORLD_THEME.palette)
    expect(result.bossShape).toBe('default')
  })
})
