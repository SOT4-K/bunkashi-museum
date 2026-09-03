import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WorkDetailSheet } from '../WorkDetailSheet'
import { works, eras, worksById } from '../../content'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

describe('WorkDetailSheet（作品詳細）', () => {
  it('画像が表示される', () => {
    // jsdom はレイアウトを計算しないため、押し潰れ（aspect-ratio が無視される）バグの
    // 再現・回帰確認は Playwright のスクリーンショット目視で行っている（報告参照）。
    // ここでは画像そのものが描画されること・拡大表示のボタンでラップされていることだけ確認する。
    render(
      <WorkDetailSheet work={ashura} eras={eras} worksById={worksById} onSelectConfusable={() => {}} onClose={() => {}} />,
    )
    const img = screen.getByAltText(ashura.title)
    expect(img).toBeInTheDocument()
    expect(img.parentElement?.tagName).toBe('BUTTON')
  })

  it('画像をタップするとライトボックスが開く', () => {
    render(
      <WorkDetailSheet work={ashura} eras={eras} worksById={worksById} onSelectConfusable={() => {}} onClose={() => {}} />,
    )
    expect(screen.queryByRole('dialog', { name: /拡大表示/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `${ashura.title}を拡大表示` }))
    expect(screen.getByRole('dialog', { name: /拡大表示/ })).toBeInTheDocument()
    // ライトボックスにも同じ作品名が alt に出る
    expect(screen.getAllByAltText(ashura.title).length).toBeGreaterThanOrEqual(2)
  })

  it('periodLabel・文化名・eraNote と、文化の detail の折りたたみが出る（DESIGN.md 10章）', () => {
    render(
      <WorkDetailSheet work={ashura} eras={eras} worksById={worksById} onSelectConfusable={() => {}} onClose={() => {}} />,
    )
    const tenpyoEra = eras.find((e) => e.id === 'tenpyo')!
    expect(screen.getByText(new RegExp(ashura.periodLabel.replace(/[()（）]/g, '.')))).toBeInTheDocument()
    expect(screen.getByText(ashura.eraNote)).toBeInTheDocument()
    // detail は <details> に隠れているが DOM 上には存在する（折りたたみなので視覚的に隠れるだけ）
    const summary = screen.getByText(`${tenpyoEra.name}について`)
    expect(summary.closest('details')).toBeInTheDocument()
    expect(screen.getByText(tenpyoEra.detail)).toBeInTheDocument()
  })
})
