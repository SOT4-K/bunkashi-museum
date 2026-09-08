// M2b-05: ホームの主入口「次にクリアする面」カード（チケット規則8。nextStageRef を使う）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HomeScreen } from '../HomeScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageProgress } from '../../engine/stages'
import type { ProgressState, Work } from '../../types'

const w1: Work = makeWork({ id: 'hn1', era: 'asuka', category: 'sculpture' })

describe('HomeScreen: 次にクリアする面カード（M2b-05）', () => {
  it('onSelectStage を渡すと、先頭ワールドの★1-1をカードに表示し、押すと onSelectStage が呼ばれる', () => {
    const onSelectStage = vi.fn()
    render(
      <HomeScreen
        works={[w1]}
        eras={testEras}
        progress={createInitialProgress('2026-09-08')}
        hasMockExam={false}
        onStartMockExam={() => {}}
        onSelectStage={onSelectStage}
      />,
    )
    const card = screen.getByTestId('next-stage-card')
    expect(card).toHaveTextContent('1-1')
    expect(card).toHaveTextContent('★')
    fireEvent.click(card)
    expect(onSelectStage).toHaveBeenCalledWith('asuka', { kind: 'segment', difficulty: 1, segment: 1 })
  })

  it('onSelectStage を渡さなければカードを出さない（既存呼び出し元互換）', () => {
    render(
      <HomeScreen
        works={[w1]}
        eras={testEras}
        progress={createInitialProgress('2026-09-08')}
        hasMockExam={false}
        onStartMockExam={() => {}}
      />,
    )
    expect(screen.queryByTestId('next-stage-card')).not.toBeInTheDocument()
  })

  it('全ワールドのボスまでクリア済みなら、カードの代わりに制覇バナーを出す（既定⑥）', () => {
    const cleared = { cleared: true, bestScore: 1, clearedAt: '2026-09-08' }
    const stages: ProgressState['stages'] = {}
    for (const era of testEras) {
      // works=[w1]（asukaのみ1件）のため、asuka以外は面が0件でボスだけがシーケンスに乗る。
      // asuka自身は1件→3段とも面1（segmentKey "1-1"/"2-1"/"3-1"）が生成されるため、
      // それらも合わせてクリア済みにしないと nextStageRef が null にならない。
      stages[era.id] =
        era.id === 'asuka'
          ? { segments: { '1-1': cleared, '2-1': cleared, '3-1': cleared }, boss: cleared }
          : { ...emptyEraStageProgress(), boss: cleared }
    }
    const progress: ProgressState = { ...createInitialProgress('2026-09-08'), stages }
    render(
      <HomeScreen
        works={[w1]}
        eras={testEras}
        progress={progress}
        hasMockExam={false}
        onStartMockExam={() => {}}
        onSelectStage={() => {}}
      />,
    )
    expect(screen.queryByTestId('next-stage-card')).not.toBeInTheDocument()
    expect(screen.getByTestId('all-worlds-cleared-banner')).toHaveTextContent('館長')
  })
})
