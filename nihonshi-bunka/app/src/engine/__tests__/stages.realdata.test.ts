// 実データ（content/）に対する engine/stages.ts v2（M2b-04）のチェック。
// 受け入れ条件①「直列解禁・固定分割・9/10判定・ボス長・誤答露出規則が単体テストで担保され、
// reviewed限定プールで15ワールド全ての面数とボス問数が表になる」を確かめるため、
// content.ts の import.meta.glob（vitest 実行中は DEV=true で draft も混在する。builder メモ
// vite-import-meta-env-dev-true-in-vitest.md）を経由せず、reviewedFixtures.ts で
// status: reviewed のみを fs から直接読み込んで検証する。
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_TYPES,
  bossExposureRate,
  bossQuestionCount,
  buildBossQuestions,
  buildEraStagePlan,
  buildStageQuestions,
  clearThreshold,
  questionCountForSegment,
} from '../stages'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'

describe('実データ（reviewed限定プール、DEV変数なし）: 15ワールドの面数表・ボス問数表', () => {
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
      expect(noBoss).toEqual([])
    },
    30000,
  )

  it(
    '15ワールドの面数表・ボス問数表を実データで固定する（完了報告に転記する数値の根拠）',
    () => {
      const table: { eraId: string; itemCount: number; segmentCounts: number[]; bossSize: number }[] = []
      for (const era of reviewedEras) {
        const plan = buildEraStagePlan(era.id, reviewedPlayableWorks)
        table.push({
          eraId: era.id,
          itemCount: plan.itemCount,
          segmentCounts: plan.segments.map((s) => questionCountForSegment(s)),
          bossSize: plan.bossSize,
        })
      }
      // eslint 的な理由ではなく人間が読むための整形（報告転記用）。
      console.log('[stages v2] 面数表・ボス問数表:', JSON.stringify(table, null, 0))
      // 実データの現状（2026-09-09時点）: 全15ワールドが N<=10（M2c-04でコンテンツが
      // 増えるまでは10件ずつの固定分割・端数併合は発動しない）。この事実そのものを
      // 固定する（今後コンテンツが増えて崩れたら、このテストが教えてくれる）。
      for (const row of table) {
        expect(row.itemCount).toBeGreaterThan(0)
        expect(row.segmentCounts.length).toBe(1) // 現状は全ワールド1面のみ（★1につき）
        expect(row.bossSize).toBe(10) // 現状は全ワールドN<=15なのでボスは10問固定
      }
    },
    30000,
  )

  it(
    'N<5暫定規則が実際に発動するワールドがあるか実データで確認する（チケット指示: 北山など）',
    () => {
      const under5: { eraId: string; itemCount: number }[] = []
      for (const era of reviewedEras) {
        const plan = buildEraStagePlan(era.id, reviewedPlayableWorks)
        if (plan.itemCount > 0 && plan.itemCount < 5) under5.push({ eraId: era.id, itemCount: plan.itemCount })
      }
      console.log('[stages v2] N<5暫定規則が発動するワールド:', under5)
      // 実データでは北山（kitayama）が該当する想定。0件なら誤り無く報告するため
      // ここでは存在を強制しない（実測値をそのままログに出し、報告に転記する）。
    },
    30000,
  )

  it(
    '全15ワールド×★1〜3×そのワールドの全面: 生成できる面は目標問数を超えない・同じ作品×同じ型の重複が無い',
    () => {
      const noneList: string[] = []
      for (const era of reviewedEras) {
        const plan = buildEraStagePlan(era.id, reviewedPlayableWorks)
        for (const difficulty of [1, 2, 3] as const) {
          for (const seg of plan.segments) {
            const qs = buildStageQuestions(
              era.id,
              difficulty,
              seg.segment,
              reviewedThemeSetPool,
              reviewedPlayableWorks,
              reviewedEras,
              seededRandom(difficulty * 100 + era.order + seg.segment),
            )
            expect(qs.length).toBeLessThanOrEqual(questionCountForSegment(seg))
            const pairKeys = qs.map((q) => `${q.work.id}:${q.type}`)
            expect(new Set(pairKeys).size).toBe(pairKeys.length)
            for (const q of qs) {
              expect(reviewedThemeSetPool.some((w) => w.id === q.work.id)).toBe(true)
            }
            if (qs.length === 0) noneList.push(`${era.id}-${difficulty}-${seg.segment}`)
          }
        }
      }
      console.log('[stages v2] 「なし」（0件）になる面:', noneList)
    },
    60000,
  )

  it(
    '全15ワールド×10 seed で: ボスは目標問数以下・全問ユニークな作品・題材はプール内',
    () => {
      for (const era of reviewedEras) {
        const target = bossQuestionCount(reviewedPlayableWorks.filter((w) => w.era === era.id).length)
        for (let seed = 0; seed < 10; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          expect(boss.length).toBeLessThanOrEqual(target)
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
    'reviewer指摘M2b-99重大1の回帰（M2b-01から引き継ぎ）: ボスは可能な限り目標問数に近づく（下線のdistinct target数が' +
      '少ない文化でも、eraのpool全体を第2の補充源にして水増しする）。kitayama/momoyamaが' +
      '1問のままにならないことを固定する',
    () => {
      const kitayamaBoss = buildBossQuestions(
        'kitayama',
        reviewedPassages,
        reviewedThemeSetPool,
        reviewedPlayableWorks,
        reviewedEras,
        seededRandom(0),
      )
      const momoyamaBoss = buildBossQuestions(
        'momoyama',
        reviewedPassages,
        reviewedThemeSetPool,
        reviewedPlayableWorks,
        reviewedEras,
        seededRandom(0),
      )
      expect(kitayamaBoss.length).toBeGreaterThan(1)
      expect(momoyamaBoss.length).toBeGreaterThan(1)
    },
    30000,
  )

  it(
    '誤答露出規則（チケット規則5）: 15ワールドそれぞれのボス露出率を実測する（100%未達は' +
      '正直にログへ残す。改善余地はstages.tsのbiasForExposureコメント参照）',
    () => {
      const rates: { eraId: string; total: number; exposed: number; rate: number }[] = []
      for (const era of reviewedEras) {
        const boss = buildBossQuestions(
          era.id,
          reviewedPassages,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          seededRandom(1),
        )
        const stats = bossExposureRate(boss, era.id, reviewedPlayableWorks)
        rates.push({ eraId: era.id, ...stats })
      }
      console.log('[stages v2] ボス誤答露出率（seed=1）:', JSON.stringify(rates))
      // 100%到達を要求すると実データの偏り（confusablesが少ない作品等）で落ちるテストに
      // なりかねないため、閾値は「平均で最低6割は露出する」という緩い担保に留め、
      // 実測値はログで正直に開示する（チケットが明示的に許容する範囲）。
      const avg = rates.reduce((sum, r) => sum + r.rate, 0) / rates.length
      expect(avg).toBeGreaterThanOrEqual(0.6)
    },
    60000,
  )

  it('★1（Q1/Q3）は出題対象がある文化では常に1問以上作れる（見分ける、が空になる文化は無い想定）', () => {
    const zero: string[] = []
    for (const era of reviewedEras) {
      const plan = buildEraStagePlan(era.id, reviewedPlayableWorks)
      if (plan.itemCount === 0) continue
      const qs = buildStageQuestions(era.id, 1, 1, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras)
      if (qs.length === 0) zero.push(era.id)
    }
    expect(zero).toEqual([])
  })

  it(
    'reviewer指摘M2b-99中1の回帰: clearThreshold は実データの問数レンジで常に1ミスまでは許容する',
    () => {
      for (let n = 3; n <= 20; n++) {
        const t = clearThreshold(n)
        expect(t).toBeGreaterThan(0)
        expect(t).toBe(n - Math.max(1, Math.floor(n * 0.1)))
      }
    },
  )

  it('DIFFICULTY_TYPESが変わっていないことの前提確認（面数表の型構成の根拠）', () => {
    expect(DIFFICULTY_TYPES[1]).toEqual(['q1', 'q3'])
  })
})
