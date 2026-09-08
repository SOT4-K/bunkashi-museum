// reviewer指摘M2b-99重大3の回帰: 合格ライン④「ワールド撃破で展示室に王冠」を固定する。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MuseumScreen } from '../MuseumScreen'
import { works, eras } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageProgress } from '../../engine/stages'
import type { ItemProgress, ProgressState } from '../../types'

const ashura = works.find((w) => w.id === 'ashura-kofukuji')!

function discoveredItem(): ItemProgress {
  const cell = { box: 0, due: '2026-09-03', correct: 1, wrong: 0 }
  return { q1: cell, q2: cell, q3: cell, discoveredAt: '2026-09-01', masteredAt: null }
}

function seedProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  const base = createInitialProgress('2026-09-03')
  return { ...base, items: { [ashura.id]: discoveredItem() }, ...overrides }
}

describe('MuseumScreen: 文化ボス撃破の王冠バッジ', () => {
  it('ボス未撃破の文化には王冠が出ない', () => {
    render(<MuseumScreen works={works} eras={eras} progress={seedProgress()} onStart={() => {}} />)
    expect(screen.queryByLabelText('文化ボス撃破')).not.toBeInTheDocument()
  })

  it('ボス撃破済みの文化には王冠が出る', () => {
    const progress = seedProgress({
      stages: {
        [ashura.era]: {
          ...emptyEraStageProgress(),
          boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-08' },
        },
      },
    })
    render(<MuseumScreen works={works} eras={eras} progress={progress} onStart={() => {}} />)
    expect(screen.getByLabelText('文化ボス撃破')).toBeInTheDocument()
  })
})
