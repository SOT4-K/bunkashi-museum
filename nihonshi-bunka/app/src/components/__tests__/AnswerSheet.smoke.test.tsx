import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AnswerSheet } from '../AnswerSheet'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

describe('AnswerSheet（解説シート）', () => {
  it('Q1不正解時: 正解の画像・作品名・解説 と 他3選択肢の画像・説明・見分け方が出る', () => {
    // シャッフルを固定するため rng を index 順に返す単純な関数にする
    let n = 0
    const rng = () => {
      const seq = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.6, 0.4]
      return seq[n++ % seq.length]
    }
    const question = buildQuestion(ashura, 'q1', works, eras, false, rng)
    const wrongIndex = question.choiceWorks.findIndex((w) => w.id !== ashura.id)

    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: wrongIndex }}
        correct={false}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )

    // 不正解のときは先頭で「✗ 不正解 — 正解は〈作品名〉」と1行で明示する
    const judgement = screen.getByTestId('judgement')
    expect(judgement.textContent).toContain('✗ 不正解')
    expect(judgement.textContent).toContain(`正解は「${ashura.title}」`)
    expect(screen.getByText(ashura.title, { selector: '.caption-bold' })).toBeInTheDocument()
    expect(screen.getByText(ashura.explanation)).toBeInTheDocument()

    // 正解1枚 + 他の選択肢3枚 = 4枚の画像
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(4)
    // 出題中と違い、解説では作品名が alt に出る
    expect(images.some((img) => img.getAttribute('alt') === ashura.title)).toBe(true)
  })

  it('正解の画像・他の選択肢の画像はタップでライトボックスが開く', () => {
    let n = 0
    const rng = () => {
      const seq = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.6, 0.4]
      return seq[n++ % seq.length]
    }
    const question = buildQuestion(ashura, 'q1', works, eras, false, rng)
    const wrongIndex = question.choiceWorks.findIndex((w) => w.id !== ashura.id)

    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: wrongIndex }}
        correct={false}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )

    expect(screen.queryByRole('dialog', { name: /拡大表示/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `${ashura.title}を拡大表示` }))
    expect(screen.getByRole('dialog', { name: /拡大表示/ })).toBeInTheDocument()
  })

  it('Q1正解時: 判定が「◎ 正解」になり、なぜ違うかの文は出ない', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: question.correctIndex }}
        correct={true}
        eras={eras}
        isNewDiscovery={true}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('◎ 正解')).toBeInTheDocument()
    expect(screen.getByText('図鑑に追加した。')).toBeInTheDocument()
  })

  it('「わからない」を選んだ場合は専用の判定文言になる', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'unknown' }}
        correct={false}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('未回答')).toBeInTheDocument()
    expect(screen.getByText('「わからない」を選んだ。')).toBeInTheDocument()
  })
})
