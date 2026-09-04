// M2-45: HomeScreen の空状態の文言（本番モードが組み立てられないときのメッセージ）。
// 旧「学習を始める」（dailyNewRemaining ベースの「また明日」判定）は本番モード統合で無くなった。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { eras } from '../../content'
import { createInitialProgress } from '../../engine/progress'

const today = '2026-09-03'

describe('HomeScreen（空状態の文言。M2-45）', () => {
  it('本番ビルドで作品が0件のときは「出題できる作品がまだない」', () => {
    const progress = createInitialProgress(today)
    render(
      <HomeScreen works={[]} eras={eras} progress={progress} hasMockExam={false} onStartMockExam={() => {}} />,
    )
    expect(screen.getByText('出題できる作品がまだない。')).toBeInTheDocument()
  })

  it('作品はあるが本番モードがまだ組み立てられない（passages 未投入）ときは「リード文の投入待ち」', () => {
    const progress = createInitialProgress(today)
    const works = [
      {
        id: 'w1',
        title: 'x',
        reading: 'x',
        era: 'tenpyo',
        category: 'sculpture' as const,
        location: '',
        author: null,
        technique: '',
        keyPoints: [],
        explanation: '',
        confusables: [],
        image: { file: 'x.webp', credit: '', license: '', sourceUrl: '', sourceName: '' },
        sources: [],
        examTags: [],
        status: 'reviewed' as const,
        artist: null,
        patron: null,
        style: null,
        religion: null,
        periodLabel: '',
        eraNote: '',
        facts: [],
        falseStatements: [],
      },
    ]
    render(
      <HomeScreen works={works} eras={eras} progress={progress} hasMockExam={false} onStartMockExam={() => {}} />,
    )
    expect(screen.getByText('リード文の投入待ち。')).toBeInTheDocument()
    expect(screen.queryByText('出題できる作品がまだない。')).not.toBeInTheDocument()
  })
})
