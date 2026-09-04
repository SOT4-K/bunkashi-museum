// M2-43: 解説シートに時代・文化・作者を必ず表示する（不明は「作者不明」。空欄禁止）。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnswerSheet } from '../AnswerSheet'
import { testEras, makeWork } from '../../engine/__tests__/testFixtures'
import { buildQuestion } from '../../engine/session'

describe('AnswerSheet: 作者の表示（M2-43）', () => {
  it('work.author が null のときは「作者不明」と表示する（空欄にしない）', () => {
    const work = makeWork({ id: 'noauthor-work', author: null })
    const question = buildQuestion(work, 'q1', [work], testEras, false, () => 0.5)

    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: question.correctIndex }}
        correct={true}
        eras={testEras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )

    const authorLine = screen.getByTestId('answer-author')
    expect(authorLine.textContent).toContain('作者不明')
  })

  it('work.author があればそのまま表示する（伝承の「伝〜」表記もそのまま）', () => {
    const work = makeWork({ id: 'author-work', author: '伝 巨勢金岡' })
    const question = buildQuestion(work, 'q1', [work], testEras, false, () => 0.5)

    render(
      <AnswerSheet
        question={question}
        selection={{ kind: 'choice', index: question.correctIndex }}
        correct={true}
        eras={testEras}
        isNewDiscovery={false}
        isNewlyMastered={false}
        nextLabel="次の問題"
        onNext={() => {}}
      />,
    )

    const authorLine = screen.getByTestId('answer-author')
    expect(authorLine.textContent).toContain('伝 巨勢金岡')
  })
})
