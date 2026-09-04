import { useState } from 'react'
import styles from './App.module.css'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { LearnScreen } from './components/LearnScreen'
import { CultureListScreen } from './components/CultureListScreen'
import { PracticeSessionScreen } from './components/PracticeSessionScreen'
import { RandomLearnScreen } from './components/RandomLearnScreen'
import { MockExamScreen } from './components/MockExamScreen'
import { MissReviewScreen } from './components/MissReviewScreen'
import { MuseumScreen } from './components/MuseumScreen'
import { StatsScreen } from './components/StatsScreen'
import { ThemeSetScreen } from './components/ThemeSetScreen'
import { useProgressStore } from './store/useProgressStore'
import { eras, works, playableWorks, themeSetPool, passages, worksById } from './content'
import { todayIso } from './engine/srs'
import { buildRandomLearnSession, type RandomLearnItem } from './engine/randomLearn'
import { buildMockExam, type MockExamSection } from './engine/mockExam'
import { buildMissReviewSession, type MissReviewItem } from './engine/missLog'
import type { Passage } from './types'

// タブ遷移は React state のみで行い、history.pushState は使わない。
// そのため iOS のスワイプ戻るジェスチャーで戻れる「前の画面」が無く、
// アプリ内タブ遷移と二重に食い違うことは起きない（詳細は README の「画面遷移」節）。
export type TabId = 'home' | 'learn' | 'museum' | 'stats'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [activeThemeSet, setActiveThemeSet] = useState<Passage | null>(null)
  // ランダム学習（M2-21。ホームの「学習を始める」）の10問セット。
  const [activeRandomLearn, setActiveRandomLearn] = useState<RandomLearnItem[] | null>(null)
  // ランダム学習が1問も作れなかったとき（passages 未投入など）のフォールバック。
  const [activeFreeSession, setActiveFreeSession] = useState(false)
  // 本番モード（M2-20）。
  const [activeMockExam, setActiveMockExam] = useState<MockExamSection[] | null>(null)
  // 間違いノート復習（M2-23）。
  const [activeMissReview, setActiveMissReview] = useState<MissReviewItem[] | null>(null)
  // 学習タブ（文化別練習。M2-22）: 選択中の文化。null なら文化一覧を表示する。
  const [practiceEraId, setPracticeEraId] = useState<string | null>(null)
  const { progress, startSession, answer, dailyNewRemaining, importProgress, recordMiss, recordMissReviewOutcome } =
    useProgressStore()

  /**
   * 「学習を始める」（M2-21）: 全15文化の下線プールからランダムに10問（本番配分・SRS優先）。
   * 1問も作れなければ（passages 未投入等）自由出題（旧 buildSession）にフォールバックする。
   */
  function goLearn() {
    const today = todayIso()
    const items = buildRandomLearnSession(passages, themeSetPool, playableWorks, eras, progress, today)
    startSession(today)
    if (items.length > 0) {
      setActiveRandomLearn(items)
      return
    }
    setActiveFreeSession(true)
  }

  function goThemeSet(passage: Passage) {
    startSession(todayIso())
    setActiveThemeSet(passage)
  }

  /** 本番モード（M2-20）。作れなければ何もしない（passages が少なすぎる等）。 */
  function goMockExam() {
    const items = buildMockExam(passages, themeSetPool, playableWorks, eras)
    if (items.length === 0) return
    startSession(todayIso())
    setActiveMockExam(items)
  }

  /** 間違いノート復習（M2-23）。0件なら HomeScreen 側でボタンが disabled のため呼ばれない想定だが念のため防御する。 */
  function goMissReview() {
    const items = buildMissReviewSession(progress.missLog, worksById, themeSetPool, playableWorks, eras)
    if (items.length === 0) return
    startSession(todayIso())
    setActiveMissReview(items)
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

  if (activeThemeSet) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <ThemeSetScreen
            key={activeThemeSet.id}
            passage={activeThemeSet}
            pool={themeSetPool}
            imagePool={playableWorks}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onFinish={() => setActiveThemeSet(null)}
          />
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    )
  }

  if (activeRandomLearn) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <RandomLearnScreen
            items={activeRandomLearn}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onMiss={(workId, type, passageId, underlineKey) => recordMiss(workId, type, todayIso(), passageId, underlineKey)}
            onFinish={() => setActiveRandomLearn(null)}
          />
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    )
  }

  if (activeMockExam) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <MockExamScreen
            sections={activeMockExam}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onMiss={(workId, type, passageId, underlineKey) => recordMiss(workId, type, todayIso(), passageId, underlineKey)}
            onFinish={() => setActiveMockExam(null)}
          />
        </main>
        <TabBar active={tab} onChange={setTab} />
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
            onAnswer={sharedOnAnswer}
            onOutcome={recordMissReviewOutcome}
            onFinish={() => setActiveMissReview(null)}
          />
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    )
  }

  if (activeFreeSession) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <LearnScreen
            works={playableWorks}
            eras={eras}
            progress={progress}
            onAnswer={sharedOnAnswer}
            onStartSession={startSession}
            dailyNewRemaining={dailyNewRemaining}
            onFinish={() => setActiveFreeSession(false)}
          />
        </main>
        <TabBar active={tab} onChange={setTab} />
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
            today={todayIso()}
            dailyNewRemaining={dailyNewRemaining()}
            onStart={goLearn}
            themeSets={passages}
            onStartThemeSet={goThemeSet}
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
              onFinish={() => setPracticeEraId(null)}
            />
          ) : (
            <CultureListScreen works={playableWorks} eras={eras} progress={progress} onSelectEra={setPracticeEraId} />
          ))}
        {tab === 'museum' && (
          <MuseumScreen works={works} eras={eras} progress={progress} onStart={goLearn} />
        )}
        {tab === 'stats' && (
          <StatsScreen works={works} eras={eras} progress={progress} onImport={importProgress} />
        )}
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
