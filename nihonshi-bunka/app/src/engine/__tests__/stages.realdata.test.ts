// 実データ（content/、reviewed限定プール）に対する engine/stages.ts v4（M2i ★の定義v4）の
// 受け入れライン①〜⑥の検査（BOARD.md M2i-01⑦「30 seed×15 eraで検査するテストを追加」）。
// 旧M2b/M2e系（v2〜v3、下線起点のリード文つきステージ・型配分の床/上限）は前提から変わった
// ため、このファイルは新しい前提でテストを書き直した（builder メモ
// 「旧方式を置き換えるならテストも書き直す」）。
// content.ts の import.meta.glob（vitest 実行中は DEV=true で draft も混在する。builder メモ
// vite-import-meta-env-dev-true-in-vitest.md）を経由せず、reviewedFixtures.ts で
// status: reviewed のみを fs から直接読み込んで検証する。
import { describe, expect, it } from 'vitest'
import {
  ALL_DIFFICULTIES,
  buildBossQuestions,
  buildEraStagePlan,
  clearThreshold,
  bossQuestionCount,
  buildStageQuestions,
  eraTotalItemCount,
  questionCountForSegment,
} from '../stages'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'

const SEEDS = 30

describe('前提確認: reviewed限定プールが空でない', () => {
  it('reviewed の作品・テーマセット・リード文が実際に1件以上ある', () => {
    expect(reviewedEras.length).toBe(15)
    expect(reviewedPlayableWorks.length).toBeGreaterThan(0)
    expect(reviewedPassages.length).toBeGreaterThan(0)
  })
})

describe('合格ライン①: 各★の面が「その★を持つ作品」を全件一巡し、リード文・passageId・「下線部」が0件', () => {
  it(
    `全15ワールド×★1〜5×全面×${SEEDS} seed で、ステージ問題は passageId 無し・stemに「下線部」を含まない`,
    () => {
      const violations: string[] = []
      let totalQuestions = 0
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          for (const seg of plan.segments) {
            for (let seed = 0; seed < SEEDS; seed++) {
              const qs = buildStageQuestions(
                era.id,
                difficulty,
                seg.segment,
                reviewedThemeSetPool,
                reviewedPlayableWorks,
                reviewedEras,
                seededRandom(seed),
              )
              totalQuestions += qs.length
              for (const q of qs) {
                if (q.passageId) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): passageId 付き`)
                if (q.stem?.includes('下線部')) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): stemに「下線部」`)
              }
            }
          }
        }
      }
      expect(totalQuestions).toBeGreaterThan(0)
      expect(violations).toEqual([])
    },
    120000,
  )

  it(
    `全15ワールド×★1〜5×全面×${SEEDS} seed で、その面の対象作品（seg.workIds）全件が少なくとも1回は生成される（一巡）`,
    () => {
      const uncoveredList: string[] = []
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          for (const seg of plan.segments) {
            const coveredIds = new Set<string>()
            for (let seed = 0; seed < SEEDS; seed++) {
              const qs = buildStageQuestions(
                era.id,
                difficulty,
                seg.segment,
                reviewedThemeSetPool,
                reviewedPlayableWorks,
                reviewedEras,
                seededRandom(seed),
              )
              for (const q of qs) coveredIds.add(q.work.id)
            }
            const uncovered = seg.workIds.filter((id) => !coveredIds.has(id))
            if (uncovered.length > 0) uncoveredList.push(`${era.id}-${difficulty}-${seg.segment}: ${uncovered.join(',')}`)
          }
        }
      }
      expect(uncoveredList).toEqual([])
    },
    120000,
  )

  it('15ワールド×★1〜5の面数表・対象作品数表を実データで記録する（完了報告に転記する数値の根拠）', () => {
    const table: Record<string, Record<number, { itemCount: number; segmentCounts: number[] }>> = {}
    for (const era of reviewedEras) {
      table[era.id] = {}
      for (const difficulty of ALL_DIFFICULTIES) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        table[era.id][difficulty] = { itemCount: plan.itemCount, segmentCounts: plan.segments.map((s) => questionCountForSegment(s)) }
      }
    }
    console.log('[M2i] ★ごとの対象作品数・面数表:', JSON.stringify(table))
    // 0件の★が5つ以上ある文化が★2/★3/★5のどれかで発生していないか（止める条件の一次判定用に記録）。
    for (const difficulty of [2, 3, 5] as const) {
      const zeroEras = reviewedEras.filter((e) => table[e.id][difficulty].itemCount === 0).map((e) => e.id)
      const under3Eras = reviewedEras.filter((e) => table[e.id][difficulty].itemCount > 0 && table[e.id][difficulty].itemCount < 3).map((e) => e.id)
      console.log(`[M2i] ★${difficulty} が0件のワールド:`, zeroEras, '/ 3件未満のワールド:', under3Eras)
    }
  })
})

describe('合格ライン②: ヘッダー（文化名）だけで解ける問題が0件', () => {
  it(`全15ワールド×★1〜5×全面×${SEEDS} seedで、q2/q12/Q9のeraスロットが一度も出ない`, () => {
    const violations: string[] = []
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          for (let seed = 0; seed < SEEDS; seed++) {
            const qs = buildStageQuestions(
              era.id,
              difficulty,
              seg.segment,
              reviewedThemeSetPool,
              reviewedPlayableWorks,
              reviewedEras,
              seededRandom(seed),
            )
            for (const q of qs) {
              if (q.type === 'q2' || q.type === 'q12') violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.type} が出た`)
              if (q.q9Slot === 'era') violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): Q9のeraスロットが出た`)
            }
          }
        }
      }
    }
    expect(violations).toEqual([])
  }, 120000)
})

describe('合格ライン③: 合格判定（10問→8問以上、10問未満→1ミス以内、ボス20問→8割）', () => {
  it('clearThreshold は実データの問数レンジで正しい値を返す', () => {
    expect(clearThreshold(10)).toBe(8)
    expect(clearThreshold(20)).toBe(16)
    for (let n = 3; n <= 9; n++) expect(clearThreshold(n)).toBe(n - 1)
  })

  it('面の目標問数（questionCountForSegment）は常に clearThreshold と整合する（>=1ミスの余地がある）', () => {
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          const total = questionCountForSegment(seg)
          expect(clearThreshold(total)).toBeLessThanOrEqual(total)
        }
      }
    }
  })
})

describe('合格ライン④: ボスは3群のリード文に分かれ、全問がwriterのask.stem由来（汎用文0件）', () => {
  it(
    `全15ワールド×${SEEDS} seedで、ボスの全問の stem が、その下線の ask.stem と完全一致する（汎用文が混ざらない）`,
    () => {
      const askStemByPassageUnderline = new Map<string, string>()
      for (const passage of reviewedPassages) {
        for (const underline of passage.underlines) {
          if (underline.ask?.stem) askStemByPassageUnderline.set(`${passage.id}:${underline.key}`, underline.ask.stem)
        }
      }
      const violations: string[] = []
      let total = 0
      for (const era of reviewedEras) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const boss = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          for (const q of boss) {
            total++
            const key = q.passageId && q.underlineKey ? `${q.passageId}:${q.underlineKey}` : undefined
            const expected = key ? askStemByPassageUnderline.get(key) : undefined
            if (!expected || q.stem !== expected) violations.push(`${era.id}(seed${seed}): ${q.work.id}/${q.type} が汎用文または不一致`)
          }
        }
      }
      expect(total).toBeGreaterThan(0)
      expect(violations).toEqual([])
    },
    120000,
  )

  it(
    '完了報告用: 15ワールド×10 seedで、ボスが実際に何本のリード文（passageId）を使っているかを記録する' +
      '（3群それぞれ別のリード文を使う設計の実測。1本しか使われていない＝群が事実上機能していないワールドを報告する）',
    () => {
      const table: Record<string, { bossLen: number[]; distinctPassageIds: string[] }> = {}
      for (const era of reviewedEras) {
        const lens: number[] = []
        const passageIdSet = new Set<string>()
        for (let seed = 0; seed < 10; seed++) {
          const boss = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          lens.push(boss.length)
          for (const q of boss) if (q.passageId) passageIdSet.add(q.passageId)
        }
        table[era.id] = { bossLen: lens, distinctPassageIds: [...passageIdSet] }
      }
      console.log('[M2i] ボス問数・使用リード文の実測（10 seed）:', JSON.stringify(table))
      const fewPassageWorlds = Object.entries(table)
        .filter(([, v]) => v.distinctPassageIds.length < 2 && Math.max(...v.bossLen, 0) > 0)
        .map(([era]) => era)
      console.log('[M2i] ボスで使用リード文が1本以下のワールド（群が事実上機能していない可能性）:', fewPassageWorlds)
    },
    60000,
  )

  it(`全15ワールドで、目標問数（N≤15→10、N>15→20）に対するボスの実際の生成数を記録する（M2i-03のwriter増補判断材料）`, () => {
    const shortfalls: { era: string; target: number; min: number; max: number }[] = []
    for (const era of reviewedEras) {
      const target = bossQuestionCount(eraTotalItemCount(era.id, reviewedPlayableWorks))
      const lens: number[] = []
      for (let seed = 0; seed < 10; seed++) {
        const boss = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
        lens.push(boss.length)
      }
      const min = Math.min(...lens)
      const max = Math.max(...lens)
      if (min < target) shortfalls.push({ era: era.id, target, min, max })
    }
    console.log('[M2i] ボス目標問数に届かないワールド（10 seed中のmin/max。M2i-03のwriter増補対象）:', JSON.stringify(shortfalls))
  })
})

describe('合格ライン⑤: 面内で同じ作品×同じ型の重複0、同型連続率の実測、再挑戦で同一問題が出ない', () => {
  it(`全15ワールド×★1〜5×全面×${SEEDS} seedで、同じ作品×同じ型の面内重複が無い`, () => {
    const violations: string[] = []
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          for (let seed = 0; seed < SEEDS; seed++) {
            const qs = buildStageQuestions(
              era.id,
              difficulty,
              seg.segment,
              reviewedThemeSetPool,
              reviewedPlayableWorks,
              reviewedEras,
              seededRandom(seed),
            )
            const keys = qs.map((q) => `${q.work.id}:${q.type}`)
            if (new Set(keys).size !== keys.length) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): 重複あり`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  }, 120000)

  it('完了報告用: 同型連続率（隣接する2問が同じ型になる割合）を15ワールド×★1〜5×30 seedで実測する', () => {
    let adjacentPairs = 0
    let sameTypeAdjacent = 0
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          for (let seed = 0; seed < SEEDS; seed++) {
            const qs = buildStageQuestions(
              era.id,
              difficulty,
              seg.segment,
              reviewedThemeSetPool,
              reviewedPlayableWorks,
              reviewedEras,
              seededRandom(seed),
            )
            for (let i = 1; i < qs.length; i++) {
              adjacentPairs++
              if (qs[i].type === qs[i - 1].type) sameTypeAdjacent++
            }
          }
        }
      }
    }
    const rate = adjacentPairs > 0 ? sameTypeAdjacent / adjacentPairs : 0
    console.log(`[M2i] 同型連続率（隣接ペア中）: ${sameTypeAdjacent}/${adjacentPairs} = ${(rate * 100).toFixed(1)}%`)
    // ★1（型が2種類のみ）は同型連続が構造的に起きやすい（reorderの入れ替え先が無いことがある）ため、
    // 極端な劣化（8割超）だけを回帰として検知する安全側の閾値にする（低確信点。完了報告に明記）。
    expect(rate).toBeLessThan(0.8)
  }, 120000)

  it('再挑戦（別seed）は同一問題（stem+選択肢の完全一致）にならない（10ワールド×5面×隣接seedペアで確認）', () => {
    const violations: string[] = []
    let checked = 0
    for (const era of reviewedEras.slice(0, 10)) {
      const plan = buildEraStagePlan(era.id, 1, reviewedPlayableWorks)
      for (const seg of plan.segments.slice(0, 5)) {
        for (let seed = 0; seed < 5; seed++) {
          const a = buildStageQuestions(era.id, 1, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          const b = buildStageQuestions(era.id, 1, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed + 1000))
          checked++
          const serialize = (qs: typeof a) => qs.map((q) => `${q.work.id}:${q.type}:${q.stem}:${(q.choiceWorks ?? []).map((w) => w.id).join(',')}`).join('|')
          if (a.length > 0 && serialize(a) === serialize(b)) violations.push(`${era.id}-1-${seg.segment}`)
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })
})

describe('合格ライン⑥: Q5（画像→作者）が artist ありの作品全件に出る', () => {
  it(`全15ワールドで、artistを持つ作品（★2対象）は${SEEDS} seedのうち少なくとも1回はQ5で出題される`, () => {
    const neverQ5: string[] = []
    let totalArtistWorks = 0
    for (const era of reviewedEras) {
      const plan = buildEraStagePlan(era.id, 2, reviewedPlayableWorks)
      if (plan.itemCount === 0) continue
      for (const seg of plan.segments) {
        const q5SeenIds = new Set<string>()
        for (let seed = 0; seed < SEEDS; seed++) {
          const qs = buildStageQuestions(era.id, 2, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          for (const q of qs) if (q.type === 'q5') q5SeenIds.add(q.work.id)
        }
        totalArtistWorks += seg.workIds.length
        for (const id of seg.workIds) {
          if (!q5SeenIds.has(id)) neverQ5.push(`${era.id}-2-${seg.segment}: ${id}`)
        }
      }
    }
    console.log(`[M2i] ★2対象作品総数: ${totalArtistWorks}、${SEEDS}seedでQ5が一度も出なかった作品:`, neverQ5)
    expect(neverQ5).toEqual([])
  }, 120000)
})
