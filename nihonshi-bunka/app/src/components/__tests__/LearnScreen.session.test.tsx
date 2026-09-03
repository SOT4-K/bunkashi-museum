import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LearnScreen } from '../LearnScreen'
import { works, eras } from '../../content'
import { createInitialProgress, dailyNewRemaining as calcDailyNewRemaining, recordAnswer } from '../../engine/progress'
import { createItemProgress, todayIso, addDays } from '../../engine/srs'
import type { ProgressState } from '../../types'

function buildSeedProgress(): ProgressState {
  const today = todayIso()
  const past = addDays(today, -5)
  const tenpyoWorks = works.filter((w) => w.era === 'tenpyo')
  const base = createInitialProgress(today)
  const items = { ...base.items }
  // 7件を「復習期限が来ている」状態にしておく（review上限=7）。残りは新規候補として扱われる。
  for (const w of tenpyoWorks.slice(0, 7)) {
    items[w.id] = createItemProgress(past)
  }
  return { ...base, items }
}

describe('LearnScreen: 実データで1セッションを最後まで進める', () => {
  it('セッションが完了し、結果画面（正答数・XP・新発見）が表示される', () => {
    let progress = buildSeedProgress()

    const onAnswer = (
      workId: string,
      type: 'q1' | 'q2' | 'q3',
      answer: 'correct' | 'incorrect' | 'unknown',
      isReview: boolean,
      day: string,
    ) => {
      const result = recordAnswer(progress, workId, type, answer, isReview, day)
      progress = result.state
      return {
        xpGained: result.xpGained,
        isNewDiscovery: result.isNewDiscovery,
        isNewlyMastered: result.isNewlyMastered,
      }
    }

    render(
      <LearnScreen
        works={works}
        eras={eras}
        progress={progress}
        onAnswer={onAnswer}
        onStartSession={() => {}}
        dailyNewRemaining={(day) => calcDailyNewRemaining(progress, day)}
        onFinish={() => {}}
      />,
    )

    // 復習7件＋新規3件で最初は10問組まれるはず（誤答で増える場合もある）。
    expect(screen.getByText(/^1\//)).toBeInTheDocument()

    let guard = 0
    while (!screen.queryByTestId('session-summary')) {
      guard++
      if (guard > 60) throw new Error('セッションが60回answerしても終わらない（無限ループの疑い）')

      // 「わからない」以外の選択肢を1つ選ぶ（正解かどうかは問わない。誤答なら再出題され、
      // 解説シートに「なぜ違うか」と4選択肢の画像・説明が出る経路も自然に踏むことになる）。
      const choices = screen.getAllByTestId('choice-button')
      fireEvent.click(choices[0])

      // 解説シートが開く。判定文言のどれかが必ず出る。
      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByText(/^(正解|不正解)$/),
      ).toBeInTheDocument()

      fireEvent.click(within(dialog).getByTestId('next-button'))
    }

    const summary = screen.getByTestId('session-summary')
    expect(within(summary).getByText('正答')).toBeInTheDocument()
    expect(within(summary).getByText('獲得XP')).toBeInTheDocument()

    fireEvent.click(within(summary).getByText('ホームに戻る'))
  })
})
