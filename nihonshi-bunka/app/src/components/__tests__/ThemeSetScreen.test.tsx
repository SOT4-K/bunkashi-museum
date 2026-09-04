import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ThemeSetScreen } from '../ThemeSetScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import type { Passage, Work } from '../../types'

const hokusai = makeWork({ id: 'h1', era: 'tenpyo', category: 'painting', artist: '葛飾北斎' })
const hiroshige1 = makeWork({ id: 'r1', era: 'hakuho', category: 'painting', artist: '歌川広重' })
const hiroshige2 = makeWork({ id: 'r2', era: 'asuka', category: 'painting', artist: '歌川広重' })
const hiroshige3 = makeWork({ id: 'r3', era: 'konin-jogan', category: 'painting', artist: '歌川広重' })
const pool: Work[] = [hokusai, hiroshige1, hiroshige2, hiroshige3]

const passage: Passage = {
  id: 'test-passage',
  era: 'tenpyo',
  title: 'テスト用リード文タイトル',
  text: '本文の冒頭。[[a|下線部A]]の説明が続く。[[b|存在しない作品への言及]]もある。',
  sources: ['出典X'],
  underlines: [
    { key: 'a', workIds: ['h1'], note: '北斎について' },
    { key: 'b', workIds: ['not-in-pool'] }, // pool に無いためスキップされるはず
  ],
}

function noopAnswer() {
  return { xpGained: 10, isNewDiscovery: false, isNewlyMastered: false }
}

describe('ThemeSetScreen', () => {
  it('プールに無い workIds の下線はスキップされ、1問だけ出題される', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('リード文タイトルが表示され、「リード文を見返す」で本文パネルが開閉する', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    expect(screen.getByText('テスト用リード文タイトル')).toBeInTheDocument()
    expect(screen.queryByTestId('context-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('context-toggle'))
    expect(screen.getByTestId('context-panel')).toBeInTheDocument()
    expect(screen.getByText('下線部A')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('context-toggle'))
    expect(screen.queryByTestId('context-panel')).not.toBeInTheDocument()
  })

  it('回答すると解説が出て、最後まで進むと結果画面になる', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    const choices = screen.getAllByTestId('choice-button')
    fireEvent.click(choices[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/^(◎ 正解|✗ 不正解)/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByTestId('next-button'))

    const summary = screen.getByTestId('theme-set-summary')
    expect(within(summary).getByText('正答')).toBeInTheDocument()
    expect(within(summary).getByText('獲得XP')).toBeInTheDocument()
  })

  it('生成できる図版問題が無いリード文は「作れなかった」メッセージを出す', () => {
    const emptyPassage: Passage = { ...passage, underlines: [{ key: 'z', workIds: ['nowhere'] }] }
    render(
      <ThemeSetScreen passage={emptyPassage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    expect(screen.getByText(/からは今のところ図版問題を作れなかった/)).toBeInTheDocument()
  })
})
