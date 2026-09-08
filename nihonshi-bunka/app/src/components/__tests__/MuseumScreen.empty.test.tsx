// M2b-18: 本番モード（MockExamScreen/goMockExam）廃止に伴い、図鑑タブの空状態ボタンは
// ホームの「次にクリアする面」へ遷移する導線に変わった（呼び出し元 App.tsx が実際の
// タブ遷移を担う。ここではコンポーネント単体で文言とコールバックの発火だけを固定する）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MuseumScreen } from '../MuseumScreen'
import { eras } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { makeWork } from '../../engine/__tests__/testFixtures'
import type { Work } from '../../types'

const works: Work[] = [makeWork({ id: 'me1', era: 'asuka', category: 'sculpture' })]

describe('MuseumScreen: 空状態（未発見0件）', () => {
  it('旧「学習を始める」ではなく「最初の面へ」ボタンを出す', () => {
    render(<MuseumScreen works={works} eras={eras} progress={createInitialProgress('2026-09-09')} onStart={() => {}} />)
    expect(screen.getByText('最初の作品を見つけよう。')).toBeInTheDocument()
    expect(screen.getByText('最初の面へ')).toBeInTheDocument()
    expect(screen.queryByText('学習を始める')).not.toBeInTheDocument()
  })

  it('ボタンを押すと onStart が呼ばれる', () => {
    const onStart = vi.fn()
    render(<MuseumScreen works={works} eras={eras} progress={createInitialProgress('2026-09-09')} onStart={onStart} />)
    fireEvent.click(screen.getByText('最初の面へ'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
