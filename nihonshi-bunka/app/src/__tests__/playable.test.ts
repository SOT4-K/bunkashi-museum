import { describe, it, expect } from 'vitest'
import { playableWorks, works } from '../content'
import { hasRealImage } from '../utils/image'

describe('出題プール（playableWorks）', () => {
  it('実画像のある作品だけを含む（プレースホルダは作品名を描くため出題に使わない）', () => {
    expect(playableWorks.length).toBeGreaterThan(0)
    expect(playableWorks.every(hasRealImage)).toBe(true)
    expect(works.length).toBeGreaterThanOrEqual(playableWorks.length)
  })
})
