import { useMemo, useState } from 'react'
import styles from './App.module.css'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { StageMapScreen } from './components/StageMapScreen'
import { StageScreen } from './components/StageScreen'
import { MockExamScreen } from './components/MockExamScreen'
import { MissReviewScreen } from './components/MissReviewScreen'
import { MuseumScreen } from './components/MuseumScreen'
import { StatsScreen } from './components/StatsScreen'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useProgressStore } from './store/useProgressStore'
import { eras, playableWorks, themeSetPool, passages, worksById } from './content'
import { todayIso } from './engine/srs'
import { buildMockExam, discoverableWorks, type MockExamItem } from './engine/mockExam'
import { buildMissReviewSession, type MissReviewItem } from './engine/missLog'
import { buildBossQuestions, buildStageQuestions, DIFFICULTY_LABELS, type StageLocalKey } from './engine/stages'
import type { Question } from './types'

// タブ遷移は React state のみで行い、history.pushState は使わない。
// そのため iOS のスワイプ戻るジェスチャーで戻れる「前の画面」が無く、
// アプリ内タブ遷移と二重に食い違うことは起きない（詳細は README の「画面遷移」節）。
export type TabId = 'home' | 'learn' | 'museum' | 'stats'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  // 本番モード（M2-20 → M2-45 でランダム学習を統合）。
  const [activeMockExam, setActiveMockExam] = useState<MockExamItem[] | null>(null)
  // 間違いノート復習（M2-23）。
  const [activeMissReview, setActiveMissReview] = useState<MissReviewItem[] | null>(null)
  // 学習タブ（ステージマップ。M2b-01）: 挑戦中のステージ／ボス。null ならマップを表示する。
  // stageNonce は「もう一度」で StageScreen を強制的に作り直す（内部 state をリセットする）ための key。
  interface ActiveStage {
    eraId: string
    key: StageLocalKey
    title: string
    questions: Question[]
  }
  const [activeStage, setActiveStage] = useState<ActiveStage | null>(null)
  const [stageNonce, setStageNonce] = useState(0)
  // M2-47: 学習中（本番モード・ステージ／ボス・間違い復習のいずれか）にタブを押したときの確認待ち。
  const [pendingLeave, setPendingLeave] = useState(false)
  const {
    progress,
    startSession,
    answer,
    importProgress,
    resetProgress,
    recordMiss,
    recordMissReviewOutcome,
    recordStageResult,
  } = useProgressStore()

  const hasActiveSession = Boolean(activeMockExam || activeMissReview || activeStage)

  /** M2-47: 学習中にタブ（ホーム含む）を押したら確認する。「はい」なら記録せず中止。 */
  function handleTabChange(next: TabId) {
    if (hasActiveSession) {
      setPendingLeave(true)
      return
    }
    setTab(next)
  }

  function confirmLeave() {
    setActiveMockExam(null)
    setActiveMissReview(null)
    setActiveStage(null)
    setPendingLeave(false)
    setTab('home')
  }

  function cancelLeave() {
    setPendingLeave(false)
  }

  // reviewer指摘M2-25⑤の修正: 図鑑・成績タブの分母は「本番モードで実際に発見されうる作品」
  // （discoverableWorks）に絞る。works（reviewed全件）をそのまま使うと、どの passage の下線
  // からも対象にならない作品（文化別練習は経験値・図鑑・SRSを更新しないため発見経路が無い）が
  // 永久に「未発見」のまま分母に残り続ける。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- passages/themeSetPool は content.ts の
  // モジュール定数（実行中に変化しない）ため、空の依存配列で初回のみ計算する
  const museumWorks = useMemo(() => discoverableWorks(passages, themeSetPool), [])

  /** 本番モード（M2-20 → M2-45: 全15文化・重み付き抽選）。作れなければ何もしない（passages が無い等）。 */
  function goMockExam() {
    const today = todayIso()
    const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today)
    if (items.length === 0) return
    startSession(today)
    setActiveMockExam(items)
  }

  /** 間違いノート復習（M2-23）。0件なら HomeScreen 側でボタンを出さないため呼ばれない想定だが念のため防御する。 */
  function goMissReview() {
    const items = buildMissReviewSession(progress.missLog, worksById, themeSetPool, playableWorks, eras)
    if (items.length === 0) return
    startSession(todayIso())
    setActiveMissReview(items)
  }

  /** ステージ制（M2b-01→M2b-04 v2）: eraId・key から見出しと問題を組み立てる。 */
  function buildStageFor(eraId: string, key: StageLocalKey): { title: string; questions: Question[] } {
    const eraName = eras.find((e) => e.id === eraId)?.name ?? eraId
    if (key.kind === 'boss') {
      return { title: `${eraName} ボス`, questions: buildBossQuestions(eraId, passages, themeSetPool, playableWorks, eras) }
    }
    return {
      title: `${eraName} ${DIFFICULTY_LABELS[key.difficulty]} ${key.segment}`,
      questions: buildStageQuestions(eraId, key.difficulty, key.segment, themeSetPool, playableWorks, eras),
    }
  }

  function goStage(eraId: string, key: StageLocalKey) {
    const { title, questions } = buildStageFor(eraId, key)
    startSession(todayIso())
    setActiveStage({ eraId, key, title, questions })
    setStageNonce((n) => n + 1)
  }

  /** 結果画面の「もう一度」: 新しい乱数で同じステージ／ボスを組み直す（StageScreen は
   *  stageNonce を key にして再マウントし、内部 state をリセットする）。 */
  function retryStage() {
    if (!activeStage) return
    const { title, questions } = buildStageFor(activeStage.eraId, activeStage.key)
    setActiveStage({ ...activeStage, title, questions })
    setStageNonce((n) => n + 1)
  }

  /** 全問終了時に1回呼ばれる。クリア判定・自己ベスト・（ボスなら）XP をまとめて記録する。 */
  function handleStageComplete(correctCount: number, total: number) {
    if (!activeStage) return
    recordStageResult(activeStage.eraId, activeStage.key, correctCount, total, todayIso())
  }

  /** 進捗リセット（M2-46）。確定後はホームへ戻る。 */
  function handleResetProgress() {
    resetProgress()
    setTab('home')
  }

  const sharedOnAnswer = (
    workId: Parameters<typeof answer>[0],
    type: Parameters<typeof answer>[1],
    ans: Parameters<typeof answer>[2],
    isReview: Parameters<typeof answer>[3],
    today: Parameters<typeof answer>[4],
  ) => {
    const result = answer(workId, type, ans, isReview, today)
    return { xpGained: result.xpGained, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered }
  }

  const leaveDialog = pendingLeave && (
    <ConfirmDialog
      message="中止してホームに戻りますか？"
      confirmLabel="はい"
      cancelLabel="いいえ"
      onConfirm={confirmLeave}
      onCancel={cancelLeave}
    />
  )

  if (activeMockExam) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <MockExamScreen
            items={activeMockExam}
            pool={themeSetPool}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onMiss={(workId, type, passageId, underlineKey) => recordMiss(workId, type, todayIso(), passageId, underlineKey)}
            onFinish={() => setActiveMockExam(null)}
          />
        </main>
        <TabBar active={tab} onChange={handleTabChange} />
        {leaveDialog}
      </div>
    )
  }

  if (activeMissReview) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <MissReviewScreen
            items={activeMissReview}
            eras={eras}
            pool={themeSetPool}
            passages={passages}
            onAnswer={sharedOnAnswer}
            onOutcome={recordMissReviewOutcome}
            onFinish={() => setActiveMissReview(null)}
          />
        </main>
        <TabBar active={tab} onChange={handleTabChange} />
        {leaveDialog}
      </div>
    )
  }

  if (activeStage) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <StageScreen
            key={stageNonce}
            title={activeStage.title}
            questions={activeStage.questions}
            pool={themeSetPool}
            passages={passages}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onMiss={(workId, type, passageId, underlineKey) => recordMiss(workId, type, todayIso(), passageId, underlineKey)}
            onComplete={handleStageComplete}
            onFinish={() => setActiveStage(null)}
            onRetry={retryStage}
          />
        </main>
        <TabBar active={tab} onChange={handleTabChange} />
        {leaveDialog}
      </div>
    )
  }

  return (
    <div className={styles.app}>
      <main className={styles.main}>
        {tab === 'home' && (
          <HomeScreen
            works={playableWorks}
            eras={eras}
            progress={progress}
            hasMockExam={passages.length > 0}
            onStartMockExam={goMockExam}
            onStartMissReview={goMissReview}
            missLogCount={progress.missLog.length}
          />
        )}
        {tab === 'learn' && (
          <StageMapScreen eras={eras} pool={themeSetPool} imagePool={playableWorks} passages={passages} progress={progress} onSelectStage={goStage} />
        )}
        {tab === 'museum' && (
          <MuseumScreen works={museumWorks} eras={eras} progress={progress} onStart={goMockExam} />
        )}
        {tab === 'stats' && (
          <StatsScreen works={museumWorks} eras={eras} progress={progress} onImport={importProgress} onReset={handleResetProgress} />
        )}
      </main>
      <TabBar active={tab} onChange={handleTabChange} />
      {leaveDialog}
    </div>
  )
}
