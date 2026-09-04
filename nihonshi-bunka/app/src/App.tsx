import { useState } from 'react'
import styles from './App.module.css'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { LearnScreen } from './components/LearnScreen'
import { MuseumScreen } from './components/MuseumScreen'
import { StatsScreen } from './components/StatsScreen'
import { ThemeSetScreen } from './components/ThemeSetScreen'
import { useProgressStore } from './store/useProgressStore'
import { eras, works, playableWorks, passages } from './content'
import { todayIso } from './engine/srs'
import type { Passage } from './types'

// タブ遷移は React state のみで行い、history.pushState は使わない。
// そのため iOS のスワイプ戻るジェスチャーで戻れる「前の画面」が無く、
// アプリ内タブ遷移と二重に食い違うことは起きない（詳細は README の「画面遷移」節）。
export type TabId = 'home' | 'learn' | 'museum' | 'stats'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [activeThemeSet, setActiveThemeSet] = useState<Passage | null>(null)
  const { progress, startSession, answer, dailyNewRemaining, importProgress } = useProgressStore()

  function goLearn() {
    setTab('learn')
  }

  function goThemeSet(passage: Passage) {
    startSession(todayIso())
    setActiveThemeSet(passage)
  }

  if (activeThemeSet) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <ThemeSetScreen
            passage={activeThemeSet}
            pool={playableWorks}
            eras={eras}
            onAnswer={(workId, type, ans, isReview, today) => {
              const result = answer(workId, type, ans, isReview, today)
              return {
                xpGained: result.xpGained,
                isNewDiscovery: result.isNewDiscovery,
                isNewlyMastered: result.isNewlyMastered,
              }
            }}
            onFinish={() => setActiveThemeSet(null)}
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
          />
        )}
        {tab === 'learn' && (
          <LearnScreen
            works={playableWorks}
            eras={eras}
            progress={progress}
            onAnswer={(workId, type, ans, isReview, today) => {
              const result = answer(workId, type, ans, isReview, today)
              return {
                xpGained: result.xpGained,
                isNewDiscovery: result.isNewDiscovery,
                isNewlyMastered: result.isNewlyMastered,
              }
            }}
            onStartSession={startSession}
            dailyNewRemaining={dailyNewRemaining}
            onFinish={() => setTab('home')}
          />
        )}
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
