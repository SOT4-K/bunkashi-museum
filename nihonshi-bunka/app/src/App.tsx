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
import { selectLearnThemeSets } from './engine/themeSet'
import type { Passage } from './types'

// タブ遷移は React state のみで行い、history.pushState は使わない。
// そのため iOS のスワイプ戻るジェスチャーで戻れる「前の画面」が無く、
// アプリ内タブ遷移と二重に食い違うことは起きない（詳細は README の「画面遷移」節）。
export type TabId = 'home' | 'learn' | 'museum' | 'stats'

// 「学習を始める」で連続提示するテーマセットの本数（mock-exam-analysis.md 9章「M2-13」: 2〜3本）。
const LEARN_THEME_SET_COUNT = 3

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [activeThemeSet, setActiveThemeSet] = useState<Passage | null>(null)
  // 「学習を始める」からのテーマセット連続提示（M2-13）: 残りのセットの待ち行列。
  const [learnQueue, setLearnQueue] = useState<Passage[]>([])
  // true のとき、テーマセットが尽きたら自由出題（LearnScreen）に自動で続ける
  // （「学習を始める」経由のときだけ。ホーム下部の個別テーマセット選択では続けない）。
  const [inLearnFlow, setInLearnFlow] = useState(false)
  const { progress, startSession, answer, dailyNewRemaining, importProgress } = useProgressStore()

  /**
   * 「学習を始める」（mock-exam-analysis.md 9章 M2-13）: まずテーマセットを2〜3本連続で
   * 提示する（SRS の期限が来た作品を含むセット優先→習熟の低い区分）。1本も選べなければ
   * （テーマセット未投入・対象作品なし等）今までどおり直接フリー出題（LearnScreen）へ。
   */
  function goLearn() {
    const today = todayIso()
    const sets = selectLearnThemeSets(passages, playableWorks, eras, progress, today, LEARN_THEME_SET_COUNT)
    if (sets.length > 0) {
      startSession(today)
      setActiveThemeSet(sets[0])
      setLearnQueue(sets.slice(1))
      setInLearnFlow(true)
      return
    }
    setTab('learn')
  }

  function goThemeSet(passage: Passage) {
    startSession(todayIso())
    setActiveThemeSet(passage)
    setLearnQueue([])
    setInLearnFlow(false)
  }

  /** テーマセット1本の終了時。待ち行列に残りがあれば次へ、無ければ終了処理
   *  （「学習を始める」経由なら、どのセットにも入らなかった期限到来作品を拾うため
   *  自由出題セッションへ続ける。buildSession はその時点の progress を見るので、
   *  テーマセットで既に正解した作品は自然に due から外れる＝二重出題は起きない）。 */
  function handleThemeSetFinish() {
    if (learnQueue.length > 0) {
      const [next, ...rest] = learnQueue
      setActiveThemeSet(next)
      setLearnQueue(rest)
      return
    }
    setActiveThemeSet(null)
    if (inLearnFlow) {
      setInLearnFlow(false)
      setTab('learn')
    }
  }

  if (activeThemeSet) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <ThemeSetScreen
            key={activeThemeSet.id}
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
            onFinish={handleThemeSetFinish}
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
