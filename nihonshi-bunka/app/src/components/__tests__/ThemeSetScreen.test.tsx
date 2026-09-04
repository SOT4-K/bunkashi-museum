import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
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

/** 「問題へ」ボタンを押して読解フェーズから設問フェーズへ進める共通処理。 */
function startQuiz() {
  fireEvent.click(screen.getByTestId('start-quiz-button'))
}

describe('ThemeSetScreen', () => {
  it('開始直後はリード文全文表示（読解フェーズ）で、下線がすべて表示される', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    expect(screen.getByTestId('passage-read-panel')).toBeInTheDocument()
    expect(screen.getByText('下線部A')).toBeInTheDocument()
    expect(screen.getByText('存在しない作品への言及')).toBeInTheDocument()
    expect(screen.queryByTestId('choice-button')).not.toBeInTheDocument()
  })

  it('「問題へ」を押すと設問フェーズになり、1問だけ出題される（workIds がプールに無い下線はスキップ）', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    startQuiz()
    expect(screen.getByText('1/1')).toBeInTheDocument()
  })

  it('各問の冒頭に「下線部○に関して」と下線部の文言が表示される', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    startQuiz()
    const prompt = screen.getByTestId('underline-prompt')
    expect(prompt.textContent).toContain('下線部a')
    expect(prompt.textContent).toContain('下線部A')
  })

  it('設問フェーズでも「リード文を見返す」で本文パネルが開閉する', () => {
    render(
      <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    startQuiz()
    expect(screen.getByText('テスト用リード文タイトル')).toBeInTheDocument()
    expect(screen.queryByTestId('context-panel')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('context-toggle'))
    expect(screen.getByTestId('context-panel')).toBeInTheDocument()
    expect(within(screen.getByTestId('context-panel')).getByText('下線部A')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('context-toggle'))
    expect(screen.queryByTestId('context-panel')).not.toBeInTheDocument()
  })

  describe('回答フロー', () => {
    beforeEach(() => {
      // 解説シートは回答から少し遅れて出る（LearnScreen と同じ仕様）。setTimeout だけ fake にする。
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('回答すると解説が出て、最後まで進むと結果画面になる', () => {
      render(
        <ThemeSetScreen passage={passage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
      )
      startQuiz()
      const choices = screen.getAllByTestId('choice-button')
      fireEvent.click(choices[0])
      act(() => {
        vi.advanceTimersByTime(500)
      })

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/^(◎ 正解|✗ 不正解)/)).toBeInTheDocument()
      fireEvent.click(within(dialog).getByTestId('next-button'))

      const summary = screen.getByTestId('theme-set-summary')
      expect(within(summary).getByText('正答')).toBeInTheDocument()
      expect(within(summary).getByText('獲得XP')).toBeInTheDocument()
    })
  })

  it('生成できる図版問題が無いリード文は読解フェーズを飛ばして「作れなかった」メッセージを出す', () => {
    const emptyPassage: Passage = { ...passage, underlines: [{ key: 'z', workIds: ['nowhere'] }] }
    render(
      <ThemeSetScreen passage={emptyPassage} pool={pool} eras={testEras} onAnswer={noopAnswer} onFinish={() => {}} />,
    )
    expect(screen.getByText(/からは今のところ図版問題を作れなかった/)).toBeInTheDocument()
    expect(screen.queryByTestId('passage-read-panel')).not.toBeInTheDocument()
  })
})
