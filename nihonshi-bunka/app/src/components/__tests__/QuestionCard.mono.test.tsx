import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

describe('QuestionCard（出題画面）の画像はモノクロ', () => {
  it('Q1: 出題中のメイン画像に mono クラスが付く', () => {
    const q = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(<QuestionCard question={q} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    const img = screen.getByRole('img')
    expect(img.className).toMatch(/mono/)
  })

  it('Q3: 4枚の画像選択肢すべてに mono クラスが付く', () => {
    const q = buildQuestion(ashura, 'q3', works, eras, false, () => 0.5)
    render(<QuestionCard question={q} answered={null} onChoice={() => {}} onUnknown={() => {}} />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(4)
    for (const img of images) {
      expect(img.className).toMatch(/mono/)
    }
  })
})
