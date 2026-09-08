// 模試タブ（M2b-07。成績タブの置き換え。BOARD.md「M2b v2」）。
// ①開始 ②過去の記録一覧（日時・所要時間・得点） ③推移（折れ線） ④その回の間違いの復習
// （既存missLogを流用）の4セクションを持つ。時代別習熟の表示はここには置かない
// （図鑑タブ側に残す。成績タブの廃止に伴う移設）。
import { useState } from 'react'
import styles from './ExamScreen.module.css'
import { formatCountdown, MOCK_EXAM_POINTS_PER_QUESTION, TIME_ATTACK_EXAM_SIZE } from '../engine/mockExam'
import type { MockExamRecord } from '../types'

const TREND_WIDTH = 280
const TREND_HEIGHT = 80
const TREND_PADDING = 8

/**
 * 記録一覧の日時表示（M2b-99c軽4是正: date が日時ISOになったのを受けて「YYYY-MM-DD HH:MM」に
 * 整形する）。旧データ（'T'を含まない日付のみの文字列。移行前のlocalStorageに残っている
 * 場合がある）や不正な文字列はパースせずそのまま出す（表示が壊れず、日付のみのUTC解釈による
 * タイムゾーンずれで日付がずれる事故も避けられる）。
 */
function formatRecordDateTime(iso: string): string {
  if (!iso.includes('T')) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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
  /**
   * 「その回の間違いの復習」（既存missLogを流用。App.tsx側でworkIdを突き合わせる）。
   * M2b-99c軽5是正: missedWorkIds は非0件でも、missLog側で既に卒業済み（2回連続正解等）だと
   * 実際には復習する問題が0件になり得る（死にボタン）。App.tsx の goExamMissReview は
   * その場合何もせず false を返す（実際に開始できたら true。既存呼び出し元互換のため
   * 戻り値を返さない/undefinedの場合は「成功」とみなし何もしない＝後方互換）。
   */
  onReviewMisses: (missedWorkIds: string[]) => boolean | void
}) {
  const ordered = [...records].reverse()
  const latest = records[records.length - 1]
  const [noReviewableMisses, setNoReviewableMisses] = useState(false)

  function handleReviewMisses() {
    if (!latest) return
    const handled = onReviewMisses(latest.missedWorkIds)
    setNoReviewableMisses(handled === false)
  }

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
          <button type="button" className={styles.reviewButton} data-testid="exam-review-latest-misses" onClick={handleReviewMisses}>
            {`前回の間違いを復習（${latest.missedWorkIds.length}問）`}
          </button>
          {noReviewableMisses && (
            <p className={styles.empty} data-testid="exam-review-no-items">
              復習する問題がありません（すでに定着済み）。
            </p>
          )}
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
                <span>{formatRecordDateTime(record.date)}</span>
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
