// 模試タブ（M2b-07。成績タブの置き換え。BOARD.md「M2b v2」）。
// ①開始 ②過去の記録一覧（日時・所要時間・得点） ③推移（折れ線） ④その回の間違いの復習
// （既存missLogを流用）の4セクションを持つ。時代別習熟の表示はここには置かない
// （図鑑タブ側に残す。成績タブの廃止に伴う移設）。
import styles from './ExamScreen.module.css'
import { formatCountdown, MOCK_EXAM_POINTS_PER_QUESTION, TIME_ATTACK_EXAM_SIZE } from '../engine/mockExam'
import type { MockExamRecord } from '../types'

const TREND_WIDTH = 280
const TREND_HEIGHT = 80
const TREND_PADDING = 8

/** 得点率（%）の推移を簡易SVG折れ線で描く（既存のチャート的な仕組みが無いため自前実装）。 */
function TrendChart({ records }: { records: MockExamRecord[] }) {
  if (records.length < 2) return null
  const ratios = records.map((r) => (r.total > 0 ? r.correct / r.total : 0))
  const stepX = (TREND_WIDTH - TREND_PADDING * 2) / (ratios.length - 1)
  const points = ratios
    .map((ratio, i) => {
      const x = TREND_PADDING + i * stepX
      const y = TREND_PADDING + (1 - ratio) * (TREND_HEIGHT - TREND_PADDING * 2)
      return `${x},${y}`
    })
    .join(' ')
  return (
    <svg
      className={styles.trendSvg}
      width={TREND_WIDTH}
      height={TREND_HEIGHT}
      viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
      data-testid="exam-trend-chart"
      role="img"
      aria-label="得点率の推移"
    >
      <polyline points={points} fill="none" className={styles.trendLine} />
    </svg>
  )
}

export function ExamScreen({
  hasMockExam,
  records,
  onStart,
  onReviewMisses,
}: {
  /** 全文化から模試を組み立てられるか（content.ts の passages が1件以上あるか）。 */
  hasMockExam: boolean
  records: MockExamRecord[]
  onStart: () => void
  /** 「その回の間違いの復習」（既存missLogを流用。App.tsx側でworkIdを突き合わせる）。 */
  onReviewMisses: (missedWorkIds: string[]) => void
}) {
  const ordered = [...records].reverse()
  const latest = records[records.length - 1]

  return (
    <div className={styles.screen}>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>模試（全文化ランダム・タイムアタック）</div>
        <button
          type="button"
          className={styles.startButton}
          data-testid="exam-start-button"
          disabled={!hasMockExam}
          onClick={onStart}
        >
          <span>模試を始める</span>
          <span className={styles.startSub}>
            {TIME_ATTACK_EXAM_SIZE}問・{TIME_ATTACK_EXAM_SIZE * MOCK_EXAM_POINTS_PER_QUESTION}点満点・カウントアップ計時
          </span>
        </button>
        {!hasMockExam && <p className={styles.empty}>リード文の投入待ち。</p>}
      </div>

      {latest && latest.missedWorkIds.length > 0 && (
        <div className={styles.section}>
          <button
            type="button"
            className={styles.reviewButton}
            data-testid="exam-review-latest-misses"
            onClick={() => onReviewMisses(latest.missedWorkIds)}
          >
            {`前回の間違いを復習（${latest.missedWorkIds.length}問）`}
          </button>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionLabel}>推移</div>
        {records.length < 2 ? (
          <p className={styles.empty}>2回以上挑戦すると得点率の推移が表示される。</p>
        ) : (
          <TrendChart records={records} />
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>過去の記録（{records.length}件）</div>
        {records.length === 0 ? (
          <p className={styles.empty}>まだ記録が無い。</p>
        ) : (
          <div className={styles.historyList} data-testid="exam-history-list">
            {ordered.map((record, i) => (
              <div className={styles.historyRow} data-testid="exam-history-item" key={`${record.date}-${i}`}>
                <span>{record.date}</span>
                <span>{formatCountdown(record.elapsedSeconds)}</span>
                <span>
                  {record.correct} / {record.total}問
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
