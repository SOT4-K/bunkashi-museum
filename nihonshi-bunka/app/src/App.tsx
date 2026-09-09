import { useMemo, useState } from 'react'
import styles from './App.module.css'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './components/HomeScreen'
import { MapScreen } from './components/MapScreen'
import { WorldMapScreen } from './components/WorldMapScreen'
import { StageScreen } from './components/StageScreen'
import { MissReviewScreen } from './components/MissReviewScreen'
import { MuseumScreen } from './components/MuseumScreen'
import { ExamScreen } from './components/ExamScreen'
import { TimeAttackScreen } from './components/TimeAttackScreen'
import { ConfirmDialog } from './components/ConfirmDialog'
import { useProgressStore } from './store/useProgressStore'
import { eras, playableWorks, themeSetPool, passages, worksById, worldThemesById } from './content'
import { getWorldTheme } from './engine/worldTheme'
import { todayIso } from './engine/srs'
import { buildMockExam, discoverableWorks, TIME_ATTACK_EXAM_SIZE, type MockExamItem } from './engine/mockExam'
import { buildMissReviewSession, type MissReviewItem } from './engine/missLog'
import { RETRY_XP_MULTIPLIER } from './engine/progress'
import {
  buildBossQuestions,
  buildEraStagePlan,
  buildStageQuestions,
  getEraStageProgress,
  getSegmentState,
  stageShortLabel,
  worldOrder,
  type StageLocalKey,
  type StageRef,
} from './engine/stages'
import type { MockExamRecord, Question } from './types'

// タブ遷移は React state のみで行い、history.pushState は使わない。
// そのため iOS のスワイプ戻るジェスチャーで戻れる「前の画面」が無く、
// アプリ内タブ遷移と二重に食い違うことは起きない（詳細は README の「画面遷移」節）。
// M2b-05: 学習タブ→マップ（絵巻風SVG）、成績タブ→模試（タイムアタック）に置き換え
// （BOARD.md「M2b v2」）。
export type TabId = 'home' | 'map' | 'museum' | 'exam'

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  // 間違いノート復習（M2-23）。
  const [activeMissReview, setActiveMissReview] = useState<MissReviewItem[] | null>(null)
  // 学習タブ→マップ（M2b-01→M2b-06）: 挑戦中のステージ／ボス。null ならマップを表示する。
  // stageNonce は「もう一度」で StageScreen を強制的に作り直す（内部 state をリセットする）ための key。
  interface ActiveStage {
    eraId: string
    key: StageLocalKey
    title: string
    questions: Question[]
    isBoss: boolean
  }
  const [activeStage, setActiveStage] = useState<ActiveStage | null>(null)
  const [stageNonce, setStageNonce] = useState(0)
  // M2d-01: マップタブの2階層目。全体マップ（MapScreen）でワールドをタップすると
  // そのワールドの WorldMapScreen を開く。null なら全体マップを表示する。
  const [activeWorldEraId, setActiveWorldEraId] = useState<string | null>(null)
  // 模試タブ（M2b-07）: タイムアタック中の問題セット。null なら模試タブの開始/記録画面を表示する。
  const [activeExam, setActiveExam] = useState<MockExamItem[] | null>(null)
  // M2-47: 学習中（ステージ／ボス・間違い復習・模試のいずれか）にタブを押したときの確認待ち。
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
    recordExamResult,
    acknowledgeResetNotice,
  } = useProgressStore()

  const hasActiveSession = Boolean(activeMissReview || activeStage || activeExam)

  /** M2-47: 学習中にタブ（ホーム含む）を押したら確認する。「はい」なら記録せず中止。 */
  function handleTabChange(next: TabId) {
    if (hasActiveSession) {
      setPendingLeave(true)
      return
    }
    // M2d-01: マップタブを離れたら（他タブへ、または一旦ホームへ等）ワールドマップは閉じ、
    // 次にマップタブを開いたときは全体マップから始まるようにする。
    if (next !== 'map') setActiveWorldEraId(null)
    setTab(next)
  }

  function confirmLeave() {
    setActiveMissReview(null)
    setActiveStage(null)
    setActiveExam(null)
    setPendingLeave(false)
    setActiveWorldEraId(null)
    setTab('home')
  }

  function cancelLeave() {
    setPendingLeave(false)
  }

  // reviewer指摘M2-25⑤の修正: 図鑑・成績タブの分母は「出題エンジンで実際に発見されうる作品」
  // （discoverableWorks）に絞る。works（reviewed全件）をそのまま使うと、どの passage の下線
  // からも対象にならない作品（文化別練習は経験値・図鑑・SRSを更新しないため発見経路が無い）が
  // 永久に「未発見」のまま分母に残り続ける。
  // eslint-disable-next-line react-hooks/exhaustive-deps -- passages/themeSetPool は content.ts の
  // モジュール定数（実行中に変化しない）ため、空の依存配列で初回のみ計算する
  const museumWorks = useMemo(() => discoverableWorks(passages, themeSetPool), [])

  /**
   * 間違いノート復習（M2-23→M2b-11で模試タブへ移設）。missLogCount>0 でもボタンを出す条件
   * （M2b-11: onStartMissReview && missLogCount > 0）と実際に復習問題を作れるかは別
   * （M2b-99c軽5と同種の死にボタンが起こりうる。M2b-99e[中]指摘で発覚・是正）。
   * goExamMissReview と同じく戻り値で成否を返し、ExamScreen側でメッセージを出せるようにする。
   */
  function goMissReview(): boolean {
    const items = buildMissReviewSession(progress.missLog, worksById, themeSetPool, playableWorks, eras)
    if (items.length === 0) return false
    startSession(todayIso())
    setActiveMissReview(items)
    return true
  }

  /**
   * 模試タブ（M2b-07）「その回の間違いの復習」: missLog を workId でその回の分だけ絞り込む
   * （既存 buildMissReviewSession を流用。チケット「既存missLogを流用」）。
   * M2b-99c軽5是正: missedWorkIds は非0件でも missLog 側で既に卒業済み（2回連続正解等）だと
   * items が0件になりうる（死にボタン）。戻り値で成否を返し、ExamScreen側でメッセージを
   * 出せるようにする（false=復習する問題が無かった）。
   */
  function goExamMissReview(missedWorkIds: string[]): boolean {
    const idSet = new Set(missedWorkIds)
    const filtered = progress.missLog.filter((e) => idSet.has(e.workId))
    const items = buildMissReviewSession(filtered, worksById, themeSetPool, playableWorks, eras, undefined, filtered.length)
    if (items.length === 0) return false
    startSession(todayIso())
    setActiveMissReview(items)
    return true
  }

  /** worldIndex（0始まり）を含む StageRef を組み立てる（stageShortLabel の入力用。M2b-05）。 */
  function toStageRef(eraId: string, key: StageLocalKey): StageRef {
    const worldIndex = worldOrder(eras).indexOf(eraId)
    return key.kind === 'boss'
      ? { kind: 'boss', eraId, worldIndex }
      : { kind: 'segment', eraId, worldIndex, difficulty: key.difficulty, segment: key.segment }
  }

  /** ステージ制（M2b-01→M2b-04 v2→M2b-05）: eraId・key から見出しと問題を組み立てる。
   *  見出しは「1-1 ★★ 天平文化」形式（stageShortLabel＋era名。チケット規則2の欄外注記）。 */
  function buildStageFor(eraId: string, key: StageLocalKey): { title: string; questions: Question[] } {
    const eraName = eras.find((e) => e.id === eraId)?.name ?? eraId
    // M2b-99c中6: 面番号はワールド内の通し番号（★1〜3で共通のsegments.lengthを使う）。
    const segmentsPerWorld = buildEraStagePlan(eraId, playableWorks).segments.length
    const title = `${stageShortLabel(toStageRef(eraId, key), segmentsPerWorld)} ${eraName}`
    if (key.kind === 'boss') {
      return { title, questions: buildBossQuestions(eraId, passages, themeSetPool, playableWorks, eras) }
    }
    return {
      title,
      // M2e-02: passages を渡し、下線が対象にする作品には「下線部○」を参照する設問文
      // （passageId/underlineKey つき）を付ける。
      questions: buildStageQuestions(eraId, key.difficulty, key.segment, themeSetPool, playableWorks, eras, undefined, passages),
    }
  }

  function goStage(eraId: string, key: StageLocalKey) {
    const { title, questions } = buildStageFor(eraId, key)
    startSession(todayIso())
    setActiveStage({ eraId, key, title, questions, isBoss: key.kind === 'boss' })
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

  /** M2b v2「再挑戦はXP半分」（9/8オーナー確認済みの既定⑤）。既にクリア済みの面/ボスを
   *  再挑戦中かどうかを、今アクティブな面の progress.stages 上の cleared フラグで判定する
   *  （面クリアの記録は onComplete 時にしか更新されないため、プレイ中は不変）。 */
  function isActiveStageAlreadyCleared(): boolean {
    if (!activeStage) return false
    const era = getEraStageProgress(progress.stages, activeStage.eraId)
    return activeStage.key.kind === 'boss'
      ? era.boss.cleared
      : getSegmentState(era, activeStage.key.difficulty, activeStage.key.segment).cleared
  }

  const stageOnAnswer = (
    workId: Parameters<typeof answer>[0],
    type: Parameters<typeof answer>[1],
    ans: Parameters<typeof answer>[2],
    isReview: Parameters<typeof answer>[3],
    today: Parameters<typeof answer>[4],
  ) => {
    const xpMultiplier = isActiveStageAlreadyCleared() ? RETRY_XP_MULTIPLIER : 1
    const result = answer(workId, type, ans, isReview, today, xpMultiplier)
    return { xpGained: result.xpGained, isNewDiscovery: result.isNewDiscovery, isNewlyMastered: result.isNewlyMastered }
  }

  /** 全問終了時に1回呼ばれる。クリア判定・自己ベスト・（ボスなら）XP をまとめて記録する。 */
  function handleStageComplete(correctCount: number, total: number) {
    if (!activeStage) return
    recordStageResult(activeStage.eraId, activeStage.key, correctCount, total, todayIso())
  }

  /** 模試タブ（M2b-07）: 全文化ランダム・本番配分20問のタイムアタックを開始する
   *  （9/8オーナー確認済みの既定③）。作れなければ何もしない（passages が無い等）。 */
  function goExam() {
    const today = todayIso()
    const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today, undefined, TIME_ATTACK_EXAM_SIZE)
    if (items.length === 0) return
    startSession(today)
    setActiveExam(items)
  }

  /** 模試の1回分が終わったときに記録し、模試タブに戻る（ホームには戻らない）。 */
  function handleExamComplete(correctCount: number, total: number, elapsedSeconds: number, missedWorkIds: string[]) {
    // M2b-99c軽4是正: BOARD.mdの「日時」に合わせ、日付のみ(todayIso)ではなく時刻を含む
    // ISO日時を記録する（SRSの間隔計算に使うtodayIsoとは別軸。表示側はExamScreen.tsx）。
    const record: MockExamRecord = { date: new Date().toISOString(), elapsedSeconds, correct: correctCount, total, missedWorkIds }
    recordExamResult(record)
  }

  /** 進捗リセット（M2b-05: 3回確認を通した後に呼ばれる）。確定後はホームへ戻る。 */
  function handleResetProgress() {
    resetProgress()
    setActiveWorldEraId(null)
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
            isBoss={activeStage.isBoss}
            onAnswer={stageOnAnswer}
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

  if (activeExam) {
    return (
      <div className={styles.app}>
        <main className={styles.main}>
          <TimeAttackScreen
            items={activeExam}
            pool={themeSetPool}
            eras={eras}
            onAnswer={sharedOnAnswer}
            onMiss={(workId, type, passageId, underlineKey) => recordMiss(workId, type, todayIso(), passageId, underlineKey)}
            onComplete={handleExamComplete}
            onFinish={() => setActiveExam(null)}
            onReviewMisses={(missedWorkIds) => {
              setActiveExam(null)
              goExamMissReview(missedWorkIds)
            }}
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
            onSelectStage={goStage}
            onImportProgress={importProgress}
            onResetProgress={handleResetProgress}
            onAcknowledgeResetNotice={acknowledgeResetNotice}
          />
        )}
        {tab === 'map' && activeWorldEraId === null && (
          <MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectWorld={setActiveWorldEraId} />
        )}
        {tab === 'map' && activeWorldEraId !== null && (
          <WorldMapScreen
            eraId={activeWorldEraId}
            eras={eras}
            imagePool={playableWorks}
            progress={progress}
            theme={getWorldTheme(worldThemesById, activeWorldEraId)}
            onSelectStage={(key) => goStage(activeWorldEraId, key)}
            onBack={() => setActiveWorldEraId(null)}
          />
        )}
        {tab === 'museum' && (
          // M2b-18: 本番モード（MockExamScreen/goMockExam）を廃止。空状態ボタンは
          // ホームの「次にクリアする面」カードへ遷移させる（そこが唯一の学習開始入口）。
          <MuseumScreen works={museumWorks} eras={eras} progress={progress} onStart={() => setTab('home')} />
        )}
        {tab === 'exam' && (
          <ExamScreen
            hasMockExam={passages.length > 0}
            records={progress.examRecords}
            onStart={goExam}
            onReviewMisses={goExamMissReview}
            onStartMissReview={goMissReview}
            missLogCount={progress.missLog.length}
          />
        )}
      </main>
      <TabBar active={tab} onChange={handleTabChange} />
      {leaveDialog}
    </div>
  )
}
