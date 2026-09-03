import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkImage } from '../WorkImage'

describe('WorkImage', () => {
  it('mono=true でグレースケール用クラスが付く', () => {
    render(<WorkImage mono src="a.svg" alt="作品" />)
    const img = screen.getByRole('img')
    expect(img.className).toMatch(/mono/)
  })

  it('mono=false（既定）ではグレースケール用クラスが付かない', () => {
    render(<WorkImage src="a.svg" alt="作品" />)
    const img = screen.getByRole('img')
    expect(img.className).not.toMatch(/mono/)
  })
})
