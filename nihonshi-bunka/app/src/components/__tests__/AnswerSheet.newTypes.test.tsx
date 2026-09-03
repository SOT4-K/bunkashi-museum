import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnswerSheet } from '../AnswerSheet'
import { works, eras } from '../../content'
import { buildQuestion } from '../../engine/session'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!
const namiura = works.find((w) => w.id === 'kanagawa-oki-namiura')!

describe('AnswerSheet: 時代説明ブロック（DESIGN.md 10章「解説の拡張」）', () => {
  it('periodLabel と文化名、eraNote が判定行の下に出る（Q1 でも共通）', () => {
    const question = buildQuestion(ashura, 'q1', works, eras, false, () => 0.5)
    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: question.correctIndex }}
        correct={true}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText(new RegExp(ashura.periodLabel.replace(/[()（）]/g, '.')))).toBeInTheDocument()
    expect(screen.getByText(ashura.eraNote)).toBeInTheDocument()
  })
})

describe('AnswerSheet: Q4（関連記述）の解説', () => {
  it('4つの記述それぞれに正誤ラベルが付き、誤りには理由が出る', () => {
    const question = buildQuestion(ashura, 'q4', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(
      <AnswerSheet
        question={question!}
        selection={{ kind: 'choice', index: question!.correctIndex }}
        correct={true}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('4つの記述')).toBeInTheDocument()
    expect(screen.getAllByText('○ 正しい')).toHaveLength(1)
    expect(screen.getAllByText('× 誤り')).toHaveLength(3)
    for (const s of question!.choiceStatements!.filter((s) => !s.correct)) {
      expect(screen.getByText(s.why!)).toBeInTheDocument()
    }
  })
})

describe('AnswerSheet: Q6（同時代の事項）の解説', () => {
  it('各事項に文化名が付き、正解の文化の detail 要約が出る', () => {
    const question = buildQuestion(ashura, 'q6', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(
      <AnswerSheet
        question={question!}
        selection={{ kind: 'choice', index: question!.correctIndex }}
        correct={true}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('4つの事項')).toBeInTheDocument()
    const tenpyoEra = eras.find((e) => e.id === 'tenpyo')!
    // 正解ラベル（○ 天平文化）が出る
    expect(screen.getByText(new RegExp(`○ ${tenpyoEra.name}`))).toBeInTheDocument()
  })
})

describe('AnswerSheet: Q8（組合せ文）の解説', () => {
  it('4つの組合せに正誤が付く', () => {
    const question = buildQuestion(namiura, 'q8', works, eras, false, () => 0.5)
    expect(question).not.toBeNull()
    render(
      <AnswerSheet
        question={question!}
        selection={{ kind: 'choice', index: question!.correctIndex }}
        correct={true}
        eras={eras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )
    expect(screen.getByText('4つの組合せ')).toBeInTheDocument()
  })
})
