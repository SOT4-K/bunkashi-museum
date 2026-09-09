// M2d-02: 全ワールド共通「敵の砦」ボスノード。時代ランドマーク（前方後円墳・富士山型）を
// やめて全15ワールド共通のデザインにしたことを、色・目・旗の3点で機械的に確認する。
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { BossFortressIcon } from '../BossFortressIcon'
import { DoguIcon, TenshuIcon } from '../WorldMotifIcons'

describe('BossFortressIcon', () => {
  it('locked: 岩山が灰色で、目を描かない', () => {
    const { container } = render(<BossFortressIcon state="locked" />)
    const rock = container.querySelector('[data-testid="boss-fortress-rock"]')
    expect(rock?.getAttribute('fill')).toBe('#8b8b93')
    expect(container.querySelectorAll('[data-testid="boss-fortress-eye"]').length).toBe(0)
  })

  it('unlocked: 岩山が黒紫+赤アクセントで、目が2つ赤く光る色で描かれる', () => {
    const { container } = render(<BossFortressIcon state="unlocked" />)
    const rock = container.querySelector('[data-testid="boss-fortress-rock"]')
    expect(rock?.getAttribute('fill')).toBe('#241b2e')
    const horn = container.querySelector('[data-testid="boss-fortress-horn-left"]')
    expect(horn?.getAttribute('fill')).toBe('#c0392b')
    const eyes = container.querySelectorAll('[data-testid="boss-fortress-eye"]')
    expect(eyes.length).toBe(2)
    for (const eye of eyes) expect(eye.getAttribute('fill')).toBe('#ff3b3b')
  })

  it('cleared: 黒紫+赤アクセントを保つが、目は光らない暗赤になる', () => {
    const { container } = render(<BossFortressIcon state="cleared" />)
    const rock = container.querySelector('[data-testid="boss-fortress-rock"]')
    expect(rock?.getAttribute('fill')).toBe('#241b2e')
    const eyes = container.querySelectorAll('[data-testid="boss-fortress-eye"]')
    expect(eyes.length).toBe(2)
    for (const eye of eyes) expect(eye.getAttribute('fill')).toBe('#5a1f1f')
  })

  it('FlagIcon を渡すとワールドごとの旗が頂上に描かれ、時代によって内容が変わる', () => {
    const { container: withDogu } = render(<BossFortressIcon state="unlocked" FlagIcon={DoguIcon} />)
    const { container: withTenshu } = render(<BossFortressIcon state="unlocked" FlagIcon={TenshuIcon} />)
    expect(withDogu.querySelector('[data-testid="boss-fortress-flag"]')).not.toBeNull()
    expect(withTenshu.querySelector('[data-testid="boss-fortress-flag"]')).not.toBeNull()
    // 旗の中身（内包する<path>要素の数など）は異なるアイコンを描画しているため一致しない。
    expect(withDogu.querySelector('[data-testid="boss-fortress-flag"]')?.innerHTML).not.toBe(
      withTenshu.querySelector('[data-testid="boss-fortress-flag"]')?.innerHTML,
    )
  })

  it('FlagIcon を渡さないと旗を描かない（防御的）', () => {
    const { container } = render(<BossFortressIcon state="locked" />)
    expect(container.querySelector('[data-testid="boss-fortress-flag"]')).toBeNull()
  })
})
