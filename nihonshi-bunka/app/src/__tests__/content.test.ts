import { describe, expect, it } from 'vitest'
import { eras, works } from '../content'

describe('content (import.meta.glob 読み込み)', () => {
  it('eras.json を読み込める', () => {
    expect(eras.length).toBeGreaterThan(0)
    expect(eras[0].order).toBeLessThanOrEqual(eras[eras.length - 1].order)
  })

  it('works/*.json を読み込める（content/works/ は他の作業と共有のため件数は決め打ちしない）', () => {
    expect(works.length).toBeGreaterThanOrEqual(10)
    expect(works.filter((w) => w.era === 'tenpyo').length).toBe(10)
  })

  it('dev モード（VITE_INCLUDE_DRAFT 未設定でもテストは DEV 扱い）では draft も含む', () => {
    expect(works.every((w) => w.status === 'draft')).toBe(true)
  })
})
