// M2b-07: 模試タブの開始/記録一覧/推移/前回の間違い復習。
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExamScreen } from '../ExamScreen'
import type { MockExamRecord } from '../../types'

describe('ExamScreen（M2b-07）', () => {
  it('records が0件なら「まだ記録が無い」「2回以上挑戦すると」の案内を出す', () => {
    render(<ExamScreen hasMockExam records={[]} onStart={() => {}} onReviewMisses={() => {}} />)
    expect(screen.getByText('まだ記録が無い。')).toBeInTheDocument()
    expect(screen.getByText(/2回以上挑戦すると/)).toBeInTheDocument()
    expect(screen.queryByTestId('exam-review-latest-misses')).not.toBeInTheDocument()
  })

  it('開始ボタンは hasMockExam=false のとき押せない', () => {
    render(<ExamScreen hasMockExam={false} records={[]} onStart={() => {}} onReviewMisses={() => {}} />)
    expect(screen.getByTestId('exam-start-button')).toBeDisabled()
  })

  it('開始ボタンを押すと onStart が呼ばれる', () => {
    const onStart = vi.fn()
    render(<ExamScreen hasMockExam records={[]} onStart={onStart} onReviewMisses={() => {}} />)
    fireEvent.click(screen.getByTestId('exam-start-button'))
    expect(onStart).toHaveBeenCalledTimes(1)
  })

  it('記録一覧を新しい順に表示し、2件以上あれば推移グラフを出す', () => {
    const records: MockExamRecord[] = [
      { date: '2026-09-01', elapsedSeconds: 300, correct: 12, total: 20, missedWorkIds: [] },
      { date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: ['w1', 'w2'] },
    ]
    render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={() => {}} />)
    const items = screen.getAllByTestId('exam-history-item')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('2026-09-05') // 新しい順
    expect(items[1]).toHaveTextContent('2026-09-01')
    expect(screen.getByTestId('exam-trend-chart')).toBeInTheDocument()
  })

  it('最新の記録に間違いがあれば「前回の間違いを復習」ボタンを出し、押すと onReviewMisses(missedWorkIds) が呼ばれる', () => {
    const onReviewMisses = vi.fn()
    const records: MockExamRecord[] = [
      { date: '2026-09-01', elapsedSeconds: 300, correct: 20, total: 20, missedWorkIds: [] },
      { date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: ['w1', 'w2'] },
    ]
    render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={onReviewMisses} />)
    const button = screen.getByTestId('exam-review-latest-misses')
    expect(button).toHaveTextContent('2問')
    fireEvent.click(button)
    expect(onReviewMisses).toHaveBeenCalledWith(['w1', 'w2'])
  })

  it('M2b-99c軽4: dateがISO日時（時刻を含む）なら「YYYY-MM-DD HH:MM」形式で時刻まで表示する', () => {
    const records: MockExamRecord[] = [{ date: '2026-09-05T14:30:00.000Z', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: [] }]
    render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={() => {}} />)
    const item = screen.getByTestId('exam-history-item')
    // タイムゾーンによって時刻の表示値が変わるため、日付部分と「時:分」の形自体を確認する
    // （固定の時刻文字列を決め打ちしない）。
    const expectedLocal = new Date('2026-09-05T14:30:00.000Z')
    const pad = (n: number) => String(n).padStart(2, '0')
    const expectedText = `${expectedLocal.getFullYear()}-${pad(expectedLocal.getMonth() + 1)}-${pad(expectedLocal.getDate())} ${pad(expectedLocal.getHours())}:${pad(expectedLocal.getMinutes())}`
    expect(item).toHaveTextContent(expectedText)
  })

  it('M2b-99c軽4: 旧形式（日付のみ、Tを含まない）はタイムゾーン変換せずそのまま表示する（後方互換）', () => {
    const records: MockExamRecord[] = [{ date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: [] }]
    render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={() => {}} />)
    expect(screen.getByTestId('exam-history-item')).toHaveTextContent('2026-09-05')
  })

  it(
    'M2b-99c軽5: onReviewMisses が false を返す（missLog側で既に卒業済みで復習する問題が無い）場合、' +
      '「復習する問題がありません」メッセージを出す（死にボタン対策）',
    () => {
      const onReviewMisses = vi.fn().mockReturnValue(false)
      const records: MockExamRecord[] = [{ date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: ['w1'] }]
      render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={onReviewMisses} />)
      expect(screen.queryByTestId('exam-review-no-items')).not.toBeInTheDocument()
      fireEvent.click(screen.getByTestId('exam-review-latest-misses'))
      expect(onReviewMisses).toHaveBeenCalledWith(['w1'])
      expect(screen.getByTestId('exam-review-no-items')).toHaveTextContent('復習する問題がありません')
    },
  )

  it('M2b-99c軽5: onReviewMisses が true（または戻り値なし、既存呼び出し元互換）ならメッセージを出さない', () => {
    const onReviewMisses = vi.fn().mockReturnValue(true)
    const records: MockExamRecord[] = [{ date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: ['w1'] }]
    render(<ExamScreen hasMockExam records={records} onStart={() => {}} onReviewMisses={onReviewMisses} />)
    fireEvent.click(screen.getByTestId('exam-review-latest-misses'))
    expect(screen.queryByTestId('exam-review-no-items')).not.toBeInTheDocument()
  })

  describe('全期間の間違いノート復習（M2b-11: 旧HomeScreenの「間違えた問題を復習」を統合）', () => {
    it('missLogCount が0、または onStartMissReview 省略時はボタンを出さない（既存呼び出し元互換）', () => {
      render(<ExamScreen hasMockExam records={[]} onStart={() => {}} onReviewMisses={() => {}} onStartMissReview={() => {}} missLogCount={0} />)
      expect(screen.queryByTestId('exam-review-all-misses')).not.toBeInTheDocument()

      render(<ExamScreen hasMockExam records={[]} onStart={() => {}} onReviewMisses={() => {}} missLogCount={3} />)
      expect(screen.queryAllByTestId('exam-review-all-misses')).toHaveLength(0)
    })

    it('missLogCount > 0 かつ onStartMissReview を渡すと件数付きラベルで押すと onStartMissReview が呼ばれる', () => {
      const onStartMissReview = vi.fn()
      render(
        <ExamScreen
          hasMockExam
          records={[]}
          onStart={() => {}}
          onReviewMisses={() => {}}
          onStartMissReview={onStartMissReview}
          missLogCount={5}
        />,
      )
      const button = screen.getByTestId('exam-review-all-misses')
      expect(button).toHaveTextContent('全期間の間違いを復習（5問）')
      fireEvent.click(button)
      expect(onStartMissReview).toHaveBeenCalledTimes(1)
    })

    it('「前回の間違いを復習」（直近1回分）と「全期間の間違いを復習」は共存できる', () => {
      const records: MockExamRecord[] = [{ date: '2026-09-05', elapsedSeconds: 250, correct: 16, total: 20, missedWorkIds: ['w1', 'w2'] }]
      render(
        <ExamScreen
          hasMockExam
          records={records}
          onStart={() => {}}
          onReviewMisses={() => {}}
          onStartMissReview={() => {}}
          missLogCount={4}
        />,
      )
      expect(screen.getByTestId('exam-review-latest-misses')).toHaveTextContent('2問')
      expect(screen.getByTestId('exam-review-all-misses')).toHaveTextContent('4問')
    })

    // M2b-99e[中]是正: 表示件数はMISS_REVIEW_MAX（10）を超えない（実セッションの上限と一致させる）。
    it('missLogCount が MISS_REVIEW_MAX(10) を超えても表示は10問でキャップされる', () => {
      render(
        <ExamScreen
          hasMockExam
          records={[]}
          onStart={() => {}}
          onReviewMisses={() => {}}
          onStartMissReview={() => true}
          missLogCount={23}
        />,
      )
      expect(screen.getByTestId('exam-review-all-misses')).toHaveTextContent('全期間の間違いを復習（10問）')
    })

    // M2b-99e[中]是正: missLogCount>0でも中身が全て卒業済み等で復習問題を作れないことがある
    // （onReviewMisses と同じ死にボタンの形）。onStartMissReview が false を返したらメッセージを出す。
    it('onStartMissReview が false を返すと「復習する問題がありません」を表示する（死にボタン対策）', () => {
      render(
        <ExamScreen
          hasMockExam
          records={[]}
          onStart={() => {}}
          onReviewMisses={() => {}}
          onStartMissReview={() => false}
          missLogCount={2}
        />,
      )
      expect(screen.queryByTestId('exam-review-all-no-items')).not.toBeInTheDocument()
      fireEvent.click(screen.getByTestId('exam-review-all-misses'))
      expect(screen.getByTestId('exam-review-all-no-items')).toHaveTextContent('復習する問題がありません')
    })
  })
})
