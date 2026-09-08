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
    'M2b-99c中1: 15ワールド全てのボス問数の下限を実データで固定する（上限だけの検査をやめる）。' +
      '是正前（M2b-04時点、fact-check-m2b-v2.md）は insei/kitayama/momoyama=7・higashiyama=6・' +
      'kanei/genroku=8・kasei=9問だったが、最終補充パス（同一作品×別の型）を追加した結果、' +
      '2026-09-09時点の実データでは20 seed全てで全15ワールドが目標問数（10問）ちょうどに到達する' +
      '（実測。buildBossQuestionsのコメント参照）。',
    () => {
      // 是正後の下限（実測値。将来コンテンツが増えて崩れたらこのテストが検知する）。
      const MIN_BOSS_LEN: Record<string, number> = {
        genshi: 10,
        asuka: 10,
        hakuho: 10,
        tenpyo: 10,
        'konin-jogan': 10,
        kokufu: 10,
        insei: 10,
        kamakura: 10,
        kitayama: 10,
        higashiyama: 10,
        momoyama: 10,
        kanei: 10,
        genroku: 10,
        'horeki-tenmei': 10,
        kasei: 10,
      }
      const shortfalls: { eraId: string; seed: number; len: number }[] = []
      for (const era of reviewedEras) {
        const minExpected = MIN_BOSS_LEN[era.id]
        expect(minExpected, `MIN_BOSS_LEN に ${era.id} の実測値が無い（reviewedEras が変わった）`).toBeDefined()
        for (let seed = 0; seed < 20; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          if (boss.length < minExpected) shortfalls.push({ eraId: era.id, seed, len: boss.length })
        }
      }
      expect(shortfalls).toEqual([])
    },
    60000,
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
    'M2b-99c中4是正: 全15ワールド×★1〜3×そのワールドの全面は、目標問数を超えない・' +
      '同じ作品×同じ型の重複が無い・0件の面が無い（以前は上限のみの検査で0問でも通っていた。' +
      '0問の面は直列解禁の下でそのワールド以降を永久に詰ませる致命的回帰なので、下限として' +
      '実際にassertする。noneListはconsole.logだけで無視されていた）',
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
            expect(qs.length).toBeGreaterThan(0)
            const pairKeys = qs.map((q) => `${q.work.id}:${q.type}`)
            expect(new Set(pairKeys).size).toBe(pairKeys.length)
            for (const q of qs) {
              expect(reviewedThemeSetPool.some((w) => w.id === q.work.id)).toBe(true)
            }
            if (qs.length === 0) noneList.push(`${era.id}-${difficulty}-${seg.segment}`)
          }
        }
      }
      expect(noneList).toEqual([])
    },
    60000,
  )

  it(
    'M2b-99c中4是正: 「固定分割が全項目を漏れなく一巡する」を直接アサートする（以前は目視・' +
      'console.logのみ）。★1〜3×全面×seed0〜9の各生成結果に、その面のseg.workIds全件が' +
      '現れることを確認する（合格ライン①の「一巡」そのもの）',
    () => {
      const uncoveredList: string[] = []
      for (const era of reviewedEras) {
        const plan = buildEraStagePlan(era.id, reviewedPlayableWorks)
        for (const difficulty of [1, 2, 3] as const) {
          for (const seg of plan.segments) {
            for (let seed = 0; seed < 10; seed++) {
              const qs = buildStageQuestions(
                era.id,
                difficulty,
                seg.segment,
                reviewedThemeSetPool,
                reviewedPlayableWorks,
                reviewedEras,
                seededRandom(seed),
              )
              const coveredIds = new Set(qs.map((q) => q.work.id))
              const uncovered = seg.workIds.filter((id) => !coveredIds.has(id))
              if (uncovered.length > 0) {
                uncoveredList.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${uncovered.join(',')}`)
              }
            }
          }
        }
      }
      expect(uncoveredList).toEqual([])
    },
    60000,
  )

  it(
    '全15ワールド×10 seed で: ボスは目標問数以下・作品×型の組は重複しない・題材はプール内' +
      '（M2b-99c中1是正: 最終補充パスにより目標問数に足りないワールドは同一作品×別の型で' +
      '埋めるため、以前の「全問ユニークな作品」検査は「作品×型の組の一意性」に変更する）',
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
          const pairKeys = boss.map((q) => `${q.work.id}:${q.type}`)
          expect(new Set(pairKeys).size).toBe(pairKeys.length)
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
      '少ない文化でも、eraのpool全体を第2の補充源にして水増しする）。M2b-99c中1是正後は' +
      'kitayama/momoyamaも目標の10問ちょうどに到達する（是正前は1問のままにならないことのみ確認していた）',
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
      expect(kitayamaBoss.length).toBe(10)
      expect(momoyamaBoss.length).toBe(10)
    },
    30000,
  )

  it(
    'M2b-99c中2是正: 誤答露出規則（チケット規則5）を単一seedの平均ではなく、20 seedの' +
      '最小値でアサートする（以前は seed=1 のみ・平均0.6以上だったため、genshi/kamakuraの' +
      '露出率低下を他ワールドの100%が隠して回帰を検出できなかった）。実測の最小値は' +
      'genshi 0.857（6/7）・kamakura 0.8（4/5）、他13ワールドは1.0（fact-check-m2b-v2.mdの' +
      'seed=1限定・非シード100回の実測と同じ傾向。M2b-99c中1のボス問数改善により' +
      '以前ここで最小0.71/0.80だったgenshi/kamakura以外は全て1.0に改善した）。',
    () => {
      const MIN_EXPOSURE_RATE: Record<string, number> = {
        genshi: 0.7, // 実測min 6/7=0.857。将来コンテンツが増えるまでの安全マージンとして0.7
        kamakura: 0.7, // 実測min 4/5=0.8。同上
      }
      const DEFAULT_MIN_EXPOSURE_RATE = 0.9 // 実測min 1.0の13ワールド分の安全マージン
      const shortfalls: { eraId: string; seed: number; rate: number }[] = []
      const allRates: { eraId: string; total: number; exposed: number; rate: number }[] = []
      for (const era of reviewedEras) {
        const minExpected = MIN_EXPOSURE_RATE[era.id] ?? DEFAULT_MIN_EXPOSURE_RATE
        for (let seed = 0; seed < 20; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          const stats = bossExposureRate(boss, era.id, reviewedPlayableWorks)
          if (seed === 0) allRates.push({ eraId: era.id, ...stats })
          if (stats.rate < minExpected) shortfalls.push({ eraId: era.id, seed, rate: stats.rate })
        }
      }
      console.log('[stages v2] ボス誤答露出率（seed=0時点の参考値。実際は20 seedの最小値で判定）:', JSON.stringify(allRates))
      expect(shortfalls).toEqual([])
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
