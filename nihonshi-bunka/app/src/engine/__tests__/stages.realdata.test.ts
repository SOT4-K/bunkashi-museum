// 実データ（content/）に対する engine/stages.ts のチェック。M2b-01 実装スコープ (f)。
// 受け入れ条件①「15ワールドすべてで W-1〜3 とボスが reviewed 限定プール（DEV変数なし）で
// 生成でき、生成できない段は明示的に『なし』になる」を確かめるため、content.ts の
// import.meta.glob（vitest 実行中は DEV=true で draft も混在する。builder メモ
// vite-import-meta-env-dev-true-in-vitest.md）を経由せず、reviewedFixtures.ts で
// status: reviewed のみを fs から直接読み込んで検証する。
import { describe, expect, it } from 'vitest'
import {
  BOSS_SIZE,
  STAGE_SIZE_MAX,
  STAGE_SIZE_TARGET_MIN,
  buildBossQuestions,
  buildStageQuestions,
  clearThreshold,
} from '../stages'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'

describe('実データ（reviewed限定プール、DEV変数なし）: buildStageQuestions / buildBossQuestions', () => {
  it('reviewed の作品・テーマセットが実際に1件以上ある（fixture 自体が空でないことの前提確認）', () => {
    expect(reviewedEras.length).toBe(15)
    expect(reviewedPlayableWorks.length).toBeGreaterThan(0)
    expect(reviewedPassages.length).toBeGreaterThan(0)
  })

  it(
    '止める条件の確認: 全15ワールドでボスが1問以上作れる（reviewed テーマセットが無い文化が無いこと）',
    () => {
      const noBoss: string[] = []
      for (const era of reviewedEras) {
        const boss = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras)
        if (boss.length === 0) noBoss.push(era.id)
      }
      // 止める条件（チケット文面）: ボスが作れない文化があれば実装を止めて報告する。
      // ここでは実データで確認し、0件ならテストを失敗させて可視化する。
      expect(noBoss).toEqual([])
    },
    30000,
  )

  it(
    '全15ワールド×10 seed で: ボスは常に10問以下・全問ユニークな作品・題材はプール内',
    () => {
      for (const era of reviewedEras) {
        for (let seed = 0; seed < 10; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          expect(boss.length).toBeLessThanOrEqual(BOSS_SIZE)
          const workIds = boss.map((q) => q.work.id)
          expect(new Set(workIds).size).toBe(workIds.length)
          for (const q of boss) {
            expect(reviewedThemeSetPool.some((w) => w.id === q.work.id)).toBe(true)
          }
        }
      }
    },
    60000,
  )

  it(
    '全15ワールド×★1〜3: 生成できる段は最大10問・同じ作品×同じ型の重複が無い。生成できない段（0件）を記録する',
    () => {
      const noneList: string[] = []
      const belowTarget: string[] = []
      for (const era of reviewedEras) {
        for (const difficulty of [1, 2, 3] as const) {
          const qs = buildStageQuestions(
            era.id,
            difficulty,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(difficulty * 100 + era.order),
          )
          expect(qs.length).toBeLessThanOrEqual(STAGE_SIZE_MAX)
          const pairKeys = qs.map((q) => `${q.work.id}:${q.type}`)
          expect(new Set(pairKeys).size).toBe(pairKeys.length)
          for (const q of qs) {
            expect(reviewedThemeSetPool.some((w) => w.id === q.work.id)).toBe(true)
          }
          if (qs.length === 0) noneList.push(`${era.id}-s${difficulty}`)
          else if (qs.length < STAGE_SIZE_TARGET_MIN) belowTarget.push(`${era.id}-s${difficulty}(${qs.length})`)
        }
      }
      // 実データの現状を可視化する（0件・5件未満は完了報告に転記する。エラーにはしない
      // ＝チケット文面は「5問以上で成立させる」目安であり、0件のときだけ「なし」扱い）。
      console.log('[stages] 「なし」（0件）になる段:', noneList)
      console.log('[stages] 5問未満で成立する段（目安を下回るが0件ではない）:', belowTarget)
    },
    60000,
  )

  it('★1（Q1/Q3）は出題対象がある文化では常に1問以上作れる（見分ける、が空になる文化は無い想定）', () => {
    const zero: string[] = []
    for (const era of reviewedEras) {
      const hasWorks = reviewedPlayableWorks.some((w) => w.era === era.id)
      if (!hasWorks) continue
      const qs = buildStageQuestions(era.id, 1, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras)
      if (qs.length === 0) zero.push(era.id)
    }
    expect(zero).toEqual([])
  })

  it('clearThreshold は実データの問数レンジ（5〜10）で常に「全問正解しなくても良い」または「全問正解が必要」のどちらかになる（9割ルールの目視確認）', () => {
    for (let n = STAGE_SIZE_TARGET_MIN; n <= STAGE_SIZE_MAX; n++) {
      const t = clearThreshold(n)
      expect(t).toBeGreaterThan(0)
      expect(t).toBeLessThanOrEqual(n)
    }
    // 10問だけが「1問間違えてもクリア」になる（他は全問正解が必要）。チケット文面どおりの
    // 挙動であることを固定する（意外だが仕様どおり。低確信点として完了報告にも明記）。
    expect(clearThreshold(10)).toBe(9)
    for (let n = 5; n <= 9; n++) {
      expect(clearThreshold(n)).toBe(n)
    }
  })
})
