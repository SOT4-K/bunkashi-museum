import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CultureListScreen } from '../CultureListScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import { createInitialProgress } from '../../engine/progress'

const works = [
  makeWork({ id: 'cl1', era: 'asuka' }),
  makeWork({ id: 'cl2', era: 'tenpyo' }),
]

describe('CultureListScreen', () => {
  it('記録されないことを明記する文言を表示する', () => {
    render(<CultureListScreen works={works} eras={testEras} progress={createInitialProgress('2026-09-04')} onSelectEra={() => {}} />)
    expect(screen.getByTestId('practice-notice')).toHaveTextContent('記録されない')
  })

  it('作品がある文化だけをボタンとして表示する', () => {
    render(<CultureListScreen works={works} eras={testEras} progress={createInitialProgress('2026-09-04')} onSelectEra={() => {}} />)
    const buttons = screen.getAllByTestId('culture-button')
    const labels = buttons.map((b) => b.textContent)
    expect(labels.some((l) => l?.includes('飛鳥文化'))).toBe(true)
    expect(labels.some((l) => l?.includes('天平文化'))).toBe(true)
    // testEras には konin-jogan（弘仁・貞観文化）もあるが works に無いので出さない
    expect(labels.some((l) => l?.includes('弘仁'))).toBe(false)
  })

  it('文化をタップすると onSelectEra(eraId) が呼ばれる', () => {
    const onSelectEra = vi.fn()
    render(<CultureListScreen works={works} eras={testEras} progress={createInitialProgress('2026-09-04')} onSelectEra={onSelectEra} />)
    fireEvent.click(screen.getAllByTestId('culture-button')[0])
    expect(onSelectEra).toHaveBeenCalled()
  })
})
