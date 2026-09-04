// M2-23: 間違いノート一覧（StatsScreen 内のセクション）と、進捗の書き出しに missLog が含まれること。
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatsScreen } from '../StatsScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import { createInitialProgress } from '../../engine/progress'
import type { MissLogEntry } from '../../types'

const w1 = makeWork({ id: 'sl1', era: 'tenpyo', title: '作品1' })

describe('StatsScreen: 間違いノート', () => {
  it('0件のときは「間違いなし」', () => {
    render(<StatsScreen works={[w1]} eras={testEras} progress={createInitialProgress('2026-09-04')} onImport={() => {}} />)
    expect(screen.getByText('間違いノート（0件）')).toBeInTheDocument()
    expect(screen.getByText('間違いなし。')).toBeInTheDocument()
  })

  it('missLog の内容（作品名・型・日付・回数）を一覧表示し、タップで解説シートを開く', () => {
    const missLog: MissLogEntry[] = [{ workId: 'sl1', type: 'q2', lastMissedAt: '2026-09-01', count: 3, correctStreak: 0 }]
    const progress = { ...createInitialProgress('2026-09-04'), missLog }
    render(<StatsScreen works={[w1]} eras={testEras} progress={progress} onImport={() => {}} />)
    expect(screen.getByText('間違いノート（1件）')).toBeInTheDocument()
    const item = screen.getByTestId('miss-log-item')
    expect(item).toHaveTextContent('作品1')
    expect(item).toHaveTextContent('3回')
    fireEvent.click(item)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('進捗の書き出し（JSON）に missLog が含まれる', () => {
    const missLog: MissLogEntry[] = [{ workId: 'sl1', type: 'q1', lastMissedAt: '2026-09-01', count: 1, correctStreak: 0 }]
    const progress = { ...createInitialProgress('2026-09-04'), missLog }
    render(<StatsScreen works={[w1]} eras={testEras} progress={progress} onImport={() => {}} />)
    fireEvent.click(screen.getByText('進捗を書き出す'))
    const textarea = screen.getByPlaceholderText(/書き出すと進捗のJSON/) as HTMLTextAreaElement
    const parsed = JSON.parse(textarea.value)
    expect(parsed.missLog).toEqual(missLog)
  })
})
