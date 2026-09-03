import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImageLightbox } from '../ImageLightbox'

describe('ImageLightbox', () => {
  it('画像とダイアログが表示される', () => {
    render(<ImageLightbox src="a.webp" alt="阿修羅像" onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const img = screen.getByTestId('lightbox-image')
    expect(img).toHaveAttribute('src', 'a.webp')
    expect(img).toHaveAttribute('alt', '阿修羅像')
  })

  it('mono=true のとき画像の親にグレースケール用クラスが付く', () => {
    render(<ImageLightbox src="a.webp" alt="作品" mono onClose={() => {}} />)
    const img = screen.getByTestId('lightbox-image')
    expect(img.parentElement?.className).toMatch(/mono/)
  })

  it('mono=false（既定）ではグレースケール用クラスが付かない', () => {
    render(<ImageLightbox src="a.webp" alt="作品" onClose={() => {}} />)
    const img = screen.getByTestId('lightbox-image')
    expect(img.parentElement?.className).not.toMatch(/mono/)
  })

  it('title を渡すと下に作品名が出る（出題中はヒントを増やさないよう title を渡さない運用）', () => {
    render(<ImageLightbox src="a.webp" alt="作品" title="阿修羅像" onClose={() => {}} />)
    expect(screen.getByText('阿修羅像')).toBeInTheDocument()
  })

  it('title を渡さないと作品名は出ない', () => {
    render(<ImageLightbox src="a.webp" alt="作品" onClose={() => {}} />)
    expect(screen.queryByText('阿修羅像')).not.toBeInTheDocument()
  })

  it('右上の × ボタンで閉じる', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="a.webp" alt="作品" onClose={onClose} />)
    fireEvent.click(screen.getByTestId('lightbox-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape キーで閉じる', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="a.webp" alt="作品" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('背景（ステージ）を動かさずタップすると（一定時間後に）閉じる', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ImageLightbox src="a.webp" alt="作品" onClose={onClose} />)
    const stage = screen.getByTestId('lightbox')

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 101, clientY: 100 })

    expect(onClose).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('横方向のドラッグ（大きく動く）はタップともスワイプ閉じるとも判定せず閉じない', () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    render(<ImageLightbox src="a.webp" alt="作品" onClose={onClose} />)
    const stage = screen.getByTestId('lightbox')

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 50, clientY: 200 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 150, clientY: 200 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 250, clientY: 200 })

    vi.advanceTimersByTime(500)
    expect(onClose).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('上スワイプ（十分な距離）で閉じる', () => {
    const onClose = vi.fn()
    render(<ImageLightbox src="a.webp" alt="作品" onClose={onClose} />)
    const stage = screen.getByTestId('lightbox')

    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 400 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 100, clientY: 300 })
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 100, clientY: 300 })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
