// 進捗（bunkashi.v1）の React 側ラッパー。localStorage への読み書きと、
// engine/progress.ts の純関数呼び出しをまとめる。
// 設計メモ: DESIGN.md は「useReducer + localStorage」を挙げているが、回答直後に
// XP増分・新発見/所蔵フラグをその場で UI（解説シート）に返す必要があるため、
// useState ベースの薄いストアにしている（reducer だと dispatch の戻り値が使えない）。
import { useCallback, useEffect, useState } from 'react'
import {
  createInitialProgress,
  dailyNewRemaining as calcDailyNewRemaining,
  loadProgress,
  recordAnswer,
  recordMiss as recordMissInState,
  recordMissReviewOutcome as recordMissReviewOutcomeInState,
  saveProgress,
  updateStreak,
} from '../engine/progress'
import { todayIso } from '../engine/srs'
import type { AnswerKind, ProgressState, QuestionType } from '../types'

export function useProgressStore() {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress(todayIso()))

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  const startSession = useCallback((today: string = todayIso()) => {
    setProgress((prev) => updateStreak(prev, today))
  }, [])

  const answer = useCallback(
    (workId: string, type: QuestionType, answer: AnswerKind, isReview: boolean, today: string = todayIso()) => {
      // setState の updater 関数はこの行の中で同期評価されるとは限らないため、
      // 現在の progress（クロージャ）から直接計算して setProgress に渡す。
      const result = recordAnswer(progress, workId, type, answer, isReview, today)
      setProgress(result.state)
      return result
    },
    [progress],
  )

  const dailyNewRemaining = useCallback(
    (today: string = todayIso()) => calcDailyNewRemaining(progress, today),
    [progress],
  )

  const importProgress = useCallback((next: ProgressState) => {
    setProgress(next)
  }, [])

  const resetProgress = useCallback(() => {
    setProgress(createInitialProgress(todayIso()))
  }, [])

  /** 間違いノートに1件記録する（M2-23。ランダム学習・本番モード専用。文化別練習は呼ばない）。 */
  const recordMiss = useCallback(
    (workId: string, type: QuestionType, today: string = todayIso(), passageId?: string, underlineKey?: string) => {
      setProgress((prev) => recordMissInState(prev, workId, type, today, passageId, underlineKey))
    },
    [],
  )

  /** 間違いノート復習セッションでの1問の結果を反映する（M2-23）。 */
  const recordMissReviewOutcome = useCallback((workId: string, correct: boolean) => {
    setProgress((prev) => recordMissReviewOutcomeInState(prev, workId, correct))
  }, [])

  return {
    progress,
    startSession,
    answer,
    dailyNewRemaining,
    importProgress,
    resetProgress,
    recordMiss,
    recordMissReviewOutcome,
  }
}
