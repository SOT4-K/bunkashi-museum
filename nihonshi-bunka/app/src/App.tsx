import { useState } from 'react'
import styles from './App.module.css'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { CultureListScreen } from './components/CultureListScreen'
import { PracticeSessionScreen } from './components/PracticeSessionScreen'
import { MockExamScreen } from './components/MockExamScreen'
import { MissReviewScreen } from './components/MissReviewScreen'
import { MuseumScreen } from './components/MuseumScreen'
import { StatsScreen } from './components/StatsScreen'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useProgressStore } from './store/useProgressStore'
import { eras, works, playableWorks, themeSetPool, passages, worksById } from './content'
import { todayIso } from './engine/srs'
import { buildMockExam, type MockExamItem } from './engine/mockExam'
import { buildMissReviewSession, type MissReviewItem } from './engine/missLog'

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
  // 学習タブ（文化別練習。M2-22）: 選択中の文化。null なら文化一覧を表示する。
  const [practiceEraId, setPracticeEraId] = useState<string | null>(null)
  // M2-47: 学習中（本番モード・文化別練習・間違い復習のいずれか）にタブを押したときの確認待ち。
  const [pendingLeave, setPendingLeave] = useState(false)
  const { progress, startSession, answer, importProgress, resetProgress, recordMiss, recordMissReviewOutcome } =
    useProgressStore()

  const hasActiveSession = Boolean(activeMockExam || activeMissReview || practiceEraId)

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
    setPracticeEraId(null)
    setPendingLeave(false)
    setTab('home')
  }

  function cancelLeave() {
    setPendingLeave(false)
  }

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
        {tab === 'learn' &&
          (practiceEraId ? (
            <PracticeSessionScreen
              eraId={practiceEraId}
              eraName={eras.find((e) => e.id === practiceEraId)?.name ?? practiceEraId}
              pool={themeSetPool}
              imagePool={playableWorks}
              eras={eras}
              passages={passages}
              onFinish={() => setPracticeEraId(null)}
            />
          ) : (
            <CultureListScreen works={playableWorks} eras={eras} progress={progress} onSelectEra={setPracticeEraId} />
          ))}
        {tab === 'museum' && (
          <MuseumScreen works={works} eras={eras} progress={progress} onStart={goMockExam} />
        )}
        {tab === 'stats' && (
          <StatsScreen works={works} eras={eras} progress={progress} onImport={importProgress} onReset={handleResetProgress} />
        )}
      </main>
      <TabBar active={tab} onChange={handleTabChange} />
      {leaveDialog}
    </div>
  )
}
