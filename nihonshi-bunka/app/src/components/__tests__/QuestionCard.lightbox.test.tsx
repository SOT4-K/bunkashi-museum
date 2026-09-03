import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QuestionCard } from '../QuestionCard'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

describe('QuestionCard: 出題中の画像もライトボックスで拡大できる（答えのヒントは増やさない）', () => {
  it('Q1: メイン画像をタップするとモノクロのままライトボックスが開き、作品名は出ない', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(<QuestionCard question={question} answered={null} onChoice={() => {}} onUnknown={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'この画像を拡大表示' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // ライトボックス内の画像にも mono 用クラスが付く
    const lightboxImg = screen.getByTestId('lightbox-image')
    expect(lightboxImg.parentElement?.className).toMatch(/mono/)
    // 出題中はヒントを増やさないため、ライトボックス自体には作品名（キャプション）が出ない
    // （背後の選択肢一覧に作品名が含まれるのは Q1 の仕様どおりで無関係）
    expect(within(dialog).queryByText(ashura.title)).not.toBeInTheDocument()
  })

  it('Q3: 各画像に拡大ボタンがあり、タップすると選択せずライトボックスが開く', () => {
    const onChoice = () => {
      throw new Error('拡大ボタンのタップで選択が発火してはいけない')
    }
    const question = buildQuestion(ashura, 'q3', works, eras, false, () => 0.5)
    render(<QuestionCard question={question} answered={null} onChoice={onChoice} onUnknown={() => {}} />)

    const expandButtons = screen.getAllByRole('button', { name: 'この画像を拡大表示' })
    expect(expandButtons).toHaveLength(4)
    fireEvent.click(expandButtons[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
