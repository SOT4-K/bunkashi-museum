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
  type Difficulty,
} from '../stages'
import { shortenValue, slotValue } from '../q9'
import { q7LocationValue } from '../q7'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'
import type { Question, Q9Slot, Work } from '../../types'

const SEEDS = 30

// M2i-05b（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md）: 「ヘッダー（ワールドの文化名）
// だけで解ける」を、画像で出題する5型（q1/q3/q5/q7/q9）すべてに対して機械判定する。
//  - q1/q3/q9: 選択肢が作品（choiceWorks）そのものなので、出題ワールドのeraと一致する作品が
//    1件（＝正解のみ）しかなければ文化名だけで正解が確定する。
//  - q5/q7: 選択肢が文字列（作者名／出土地・所在地）なので、その値が「出題ワールドの作品の
//    どれかに実在するか」（reviewedPlayableWorks 全体を参照）で同era判定する（値そのものに
//    era情報は無いため、値→eraの対応を pool から逆引きする）。
// null を返す型（q4/q8/q10/q13等）は対象外（isSolvable の呼び出し側で除外する）。
function isHeaderSolvable(q: Question, pool: Work[]): boolean | null {
  const era = q.work.era
  if (q.type === 'q1' || q.type === 'q3' || q.type === 'q9') {
    const sameEraMatches = q.choiceWorks.filter((w) => w.era === era).length
    return sameEraMatches <= 1
  }
  if (q.type === 'q5') {
    const names = q.choiceArtists ?? []
    const sameEraCount = names.filter((name) => pool.some((w) => w.era === era && w.artist === name)).length
    return sameEraCount <= 1
  }
  if (q.type === 'q7') {
    const locs = q.choiceLocations ?? []
    const sameEraCount = locs.filter((loc) => pool.some((w) => w.era === era && q7LocationValue(w) === loc)).length
    return sameEraCount <= 1
  }
  return null
}

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

// M2i-05b①（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-1「27.6%→2.6%はq9単独の
// 値で、同じ物差し（q1/q3/q5/q7/q9合算）では9.3%」の是正）: M2i-05はq9にしか同era優先ロジックを
// 入れておらず、q1/q3/q5/q7は未改善のまま残っていた（[重大]-1・[重大]-2）。q1/q3
// （pickWorkDistractors の preferSameEra）・q5（generateQ5Question の preferSameEra）・q7
// （generateQ7Question の preferSameEra）にも同ワールド優先を実装し、この5型を合算した値で
// 受け入れ判定する（チケット M2i-05b の受け入れ条件どおり。q9単独やq1/q3/q5/q7抜きの数値を
// 「改善した」と報告しない、という前回の反省を踏まえる）。
// バケット分けは「対象作品数」を era 全体ではなく、その (era, difficulty) の buildEraStagePlan
// の itemCount で見る（preferSameEra は era×スロット単位で同era候補を探すため、era全体の件数より
// この粒度が実態に近い。低確信点: BOARD.md M2i-05 原文の「4件以上のワールド」はこの粒度までは
// 明記していない。完了報告に明記。M2i-05bチケットの表現に合わせ「4件以上は可能な限り0%に近づける」
// という緩い基準にする＝厳密な0%はハードゲートにしない）。
describe('合格ライン(M2i-05b①): ヘッダー解答可能率（q1/q3/q5/q7/q9合算）が全体5%以下', () => {
  it(
    `全15ワールド×★1〜5×全面×${SEEDS} seedで、q1/q3/q5/q7/q9合算のヘッダー解答可能率を` +
      `(era, difficulty)別に実測する`,
    () => {
      const perKey = new Map<string, { total: number; solvable: number }>()
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          const key = `${era.id}|${difficulty}`
          perKey.set(key, { total: 0, solvable: 0 })
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
                const solvable = isHeaderSolvable(q, reviewedPlayableWorks)
                if (solvable === null) continue
                const entry = perKey.get(key)!
                entry.total++
                if (solvable) entry.solvable++
              }
            }
          }
        }
      }
      const table: Record<string, { itemCount: number; total: number; solvable: number; ratePct: string }> = {}
      let overallTotal = 0
      let overallSolvable = 0
      const richViolations: string[] = []
      const knownLimitationSmallWorlds: string[] = []
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const key = `${era.id}|${difficulty}`
          const { total, solvable } = perKey.get(key)!
          if (total === 0) continue
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          const itemCount = plan.itemCount
          overallTotal += total
          overallSolvable += solvable
          const rate = solvable / total
          table[key] = { itemCount, total, solvable, ratePct: `${(rate * 100).toFixed(1)}%` }
          if (solvable === 0) continue
          if (itemCount < 4) {
            knownLimitationSmallWorlds.push(`${key}(itemCount=${itemCount}): ${solvable}/${total}=${(rate * 100).toFixed(1)}%`)
          } else {
            richViolations.push(`${key}(itemCount=${itemCount}): ${solvable}/${total}=${(rate * 100).toFixed(1)}%`)
          }
        }
      }
      const overallRate = overallTotal > 0 ? overallSolvable / overallTotal : 0
      console.log('[M2i-05b①] q1/q3/q5/q7/q9合算ヘッダー解答可能率（era×difficulty別）:', JSON.stringify(table))
      console.log(`[M2i-05b①] q1/q3/q5/q7/q9合算ヘッダー解答可能率（全体）: ${overallSolvable}/${overallTotal} = ${(overallRate * 100).toFixed(2)}%`)
      console.log('[M2i-05b①] 既知の限界（対象作品4件未満、除外せず記録のみ）:', knownLimitationSmallWorlds)
      // 4件以上のワールドは「可能な限り0%に近づける」（チケット文言。厳密な0%は数学的に保証できない
      // ケースがある＝itemCountがSAME_ERA_EXCLUSIVE_MIN(4)ちょうどだと同era候補が最大3件までしか
      // 集まらず隣接文化から1件だけ補う分岐に必ず入る。richViolationsに実測値を記録し、
      // 極端に高い値（50%超等）が無いことだけをハードゲートにする）。
      console.log('[M2i-05b①] 4件以上での残存（可能な限り0%目標、実測記録）:', richViolations)
      expect(overallTotal).toBeGreaterThan(0)
      for (const v of richViolations) {
        const pct = Number(v.match(/=([\d.]+)%$/)?.[1] ?? '100')
        expect(pct).toBeLessThan(50)
      }
      expect(overallRate).toBeLessThanOrEqual(0.05)
    },
    180000,
  )
})

// M2i-05b①（設問成立性バグ修正、reviewer fact-check-m2i-05.md [重大]-3「Q9の6.0%で誤答が
// 条件文の上では正解になっている」の是正）: 誤答除外を shortenValue 基準（findSite除く）に
// 直したので、実データでも「4択のうち2件以上が条件文の上で同じ値になる」設問が0件であることを
// 確かめる（stages.ts が生成する q9 は常に normal パターン。q9.ts の slotValue/shortenValue を
// そのまま使い、条件文の生成ロジックと同じ基準で判定する）。
describe('合格ライン(M2i-05b①): Q9の「誤答が条件文の上では正解」になっている設問が0件', () => {
  function conditionValueForTest(slot: Q9Slot, rawValue: string): string {
    return slot === 'findSite' ? rawValue : shortenValue(rawValue)
  }

  it(`全15ワールド×★2〜5×全面×${SEEDS} seedで、Q9の4択のうち条件文の上で target と同じ値になる選択肢が0件`, () => {
    const violations: string[] = []
    let totalQ9 = 0
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        if (difficulty === 1) continue // ★1はQ9を使わない
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
              if (q.type !== 'q9' || !q.q9Slot || q.q9Slot === 'era') continue
              totalQ9++
              const targetRaw = slotValue(q.work, q.q9Slot)
              if (!targetRaw) continue
              const targetValue = conditionValueForTest(q.q9Slot, targetRaw)
              for (const choice of q.choiceWorks) {
                if (choice.id === q.work.id) continue
                const raw = slotValue(choice, q.q9Slot)
                if (raw && conditionValueForTest(q.q9Slot, raw) === targetValue) {
                  violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.q9Slot} "${choice.id}" が target "${q.work.id}" と条件文の上で同じ値「${targetValue}」`)
                }
              }
            }
          }
        }
      }
    }
    console.log(`[M2i-05b①] Q9出題数（★2〜5、全15ワールド×${SEEDS}seed）: ${totalQ9}`)
    expect(totalQ9).toBeGreaterThan(0)
    expect(violations).toEqual([])
  }, 180000)
})

describe('合格ライン③: 合格判定（10問→8問以上、10問未満→1ミス以内、ボス20問→8割）', () => {
  it('clearThreshold は実データの問数レンジで正しい値を返す', () => {
    expect(clearThreshold(10)).toBe(8)
    expect(clearThreshold(20)).toBe(16)
    for (let n = 2; n <= 9; n++) expect(clearThreshold(n)).toBe(n - 1)
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

  // M2i-05b④（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [中]-1の是正）: 前回（M2i-05）は
  // 「全体10%以下は★1/2/4/5に手を入れない限り数学的に両立しない」と判断したが、reviewerに
  // 同一の設問集合を並べ替えだけで最適化すると4.1%まで下げられると反証された（3パス隣接スワップ
  // 〈best-effort〉が弱いだけだった）。reorderToAvoidConsecutiveSameType を「残り件数の多い型を
  // 優先する貪欲＋再スタート」に置き換え（型セット・生成ロジック自体は変更していない）、
  // 全体10%以下・★3単独60%以下の両方をハードゲートにする。
  it(
    `M2i-05b④受け入れ: 同型連続率（隣接する2問が同じ型になる割合）を15ワールド×★1〜5×${SEEDS} seedで実測し、` +
      '全体10%以下・★3単独60%以下を確認する',
    () => {
      let adjacentPairs = 0
      let sameTypeAdjacent = 0
      const perDifficulty = new Map<Difficulty, { adjacentPairs: number; sameTypeAdjacent: number }>()
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          const entry = perDifficulty.get(difficulty) ?? { adjacentPairs: 0, sameTypeAdjacent: 0 }
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
                entry.adjacentPairs++
                if (qs[i].type === qs[i - 1].type) {
                  sameTypeAdjacent++
                  entry.sameTypeAdjacent++
                }
              }
            }
          }
          perDifficulty.set(difficulty, entry)
        }
      }
      const rate = adjacentPairs > 0 ? sameTypeAdjacent / adjacentPairs : 0
      const table: Record<number, string> = {}
      for (const [difficulty, v] of perDifficulty) {
        const r = v.adjacentPairs > 0 ? v.sameTypeAdjacent / v.adjacentPairs : 0
        table[difficulty] = `${v.sameTypeAdjacent}/${v.adjacentPairs}=${(r * 100).toFixed(1)}%`
      }
      console.log(`[M2i-05b④] 同型連続率（全体）: ${sameTypeAdjacent}/${adjacentPairs} = ${(rate * 100).toFixed(2)}%`)
      console.log('[M2i-05b④] 同型連続率（★別）:', JSON.stringify(table))
      const star3 = perDifficulty.get(3)!
      const star3Rate = star3.adjacentPairs > 0 ? star3.sameTypeAdjacent / star3.adjacentPairs : 0
      // ★3単独60%以下（M2i-05③の受け入れライン、引き続きハードゲート）。
      expect(star3Rate).toBeLessThanOrEqual(0.6)
      // 全体10%以下（M2i-05b④の受け入れライン、ハードゲート）。
      expect(rate).toBeLessThanOrEqual(0.1)
    },
    120000,
  )

  it('再挑戦（別seed）は同一問題（stem+選択肢の完全一致）にならない（★1・★3、各10ワールド×5面×隣接seedペアで確認）', () => {
    const violations: string[] = []
    let checked = 0
    for (const difficulty of [1, 3] as const) {
      for (const era of reviewedEras.slice(0, 10)) {
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments.slice(0, 5)) {
          for (let seed = 0; seed < 5; seed++) {
            const a = buildStageQuestions(era.id, difficulty, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
            const b = buildStageQuestions(
              era.id,
              difficulty,
              seg.segment,
              reviewedThemeSetPool,
              reviewedPlayableWorks,
              reviewedEras,
              seededRandom(seed + 1000),
            )
            checked++
            const serialize = (qs: typeof a) =>
              qs
                .map((q) => `${q.work.id}:${q.type}:${q.stem}:${(q.choiceWorks ?? []).map((w) => w.id).join(',')}:${(q.choiceLocations ?? []).join(',')}`)
                .join('|')
            if (a.length > 0 && serialize(a) === serialize(b)) violations.push(`${era.id}-${difficulty}-${seg.segment}`)
          }
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

describe('合格ライン(M2i-05③): ★3の面は対象作品5件以上のワールドで10問、Q7の誤答は実在の出土地・所在地', () => {
  it('★3でitemCount>=5のワールド×全面×5 seedで、面の実際の生成数がquestionCountForSegment（=10）を下回らない', () => {
    const shortfalls: string[] = []
    let checkedSegments = 0
    for (const era of reviewedEras) {
      const plan = buildEraStagePlan(era.id, 3, reviewedPlayableWorks)
      if (plan.itemCount < 5) continue
      for (const seg of plan.segments) {
        checkedSegments++
        const target = questionCountForSegment(seg)
        for (let seed = 0; seed < 5; seed++) {
          const qs = buildStageQuestions(era.id, 3, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          if (qs.length < target) shortfalls.push(`${era.id}-3-${seg.segment}(seed${seed}): ${qs.length}/${target}`)
        }
      }
    }
    console.log(`[M2i-05] ★3でitemCount>=5の面数: ${checkedSegments}`)
    expect(checkedSegments).toBeGreaterThan(0)
    expect(shortfalls).toEqual([])
  }, 60000)

  it(`全15ワールドの★3×${SEEDS} seedで、Q7の正解・誤答（choiceLocations）が実データのfindSite/locationに実在する（捏造0件）`, () => {
    const realValues = new Set<string>()
    for (const w of reviewedPlayableWorks) {
      if (w.findSite) realValues.add(w.findSite)
      if (w.holderKind === 'site' && w.location) realValues.add(w.location)
    }
    const violations: string[] = []
    let totalQ7 = 0
    for (const era of reviewedEras) {
      const plan = buildEraStagePlan(era.id, 3, reviewedPlayableWorks)
      for (const seg of plan.segments) {
        for (let seed = 0; seed < SEEDS; seed++) {
          const qs = buildStageQuestions(era.id, 3, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          for (const q of qs) {
            if (q.type !== 'q7') continue
            totalQ7++
            for (const loc of q.choiceLocations ?? []) {
              if (!realValues.has(loc)) violations.push(`${era.id}-3-${seg.segment}(seed${seed}): 捏造値「${loc}」`)
            }
          }
        }
      }
    }
    console.log(`[M2i-05] Q7出題数（★3、全15ワールド×${SEEDS}seed）: ${totalQ7}`)
    expect(totalQ7).toBeGreaterThan(0)
    expect(violations).toEqual([])
  }, 120000)
})

// M2i-05d（decisions.md 2026-09-11、reviewer fact-check-m2i-05c.md [重大]「文字列不一致だけで
// 判定するslotValueDiffersが、木造/錦絵/紙本墨画等の一般形（choiceのraw値がVを含む・区切り文字の
// 先頭要素と一致・locationは共通接頭辞）を素通りしていた」の是正。M2i-05cまでの受け入れテスト
// （semanticallySatisfies）は shortenValue後の完全一致＋手書きのreligion限定テーブルしか見ておらず、
// この一般形（466件、7.96%の面）を検出できなかった（reviewerに指摘された）。
// [中]-1: このテスト自体をraw値ベースの包含判定に書き換える。個別ワールドを名指しした期待値では
// なく、全15ワールド×★2〜5×100 seedで「意味的に条件を満たす誤答が0件」という一般ルールを
// ハードゲートにする（reviewerの指摘どおり、個別ケースだけを潰すテストにしない）。
describe('合格ライン(M2i-05d): Q9の「誤答が条件文の上で意味的にも正解」になっている設問が0件（raw値ベースの包含判定、全ワールド共通ルール）', () => {
  const SEMANTIC_SEEDS = 100
  const UNKNOWN_WORDS = ['不詳', '不明', '未詳']
  const VALUE_SPLIT_DELIMS_FOR_TEST = /[／・\s]+/
  const LOCATION_SHARED_PREFIX_MIN_FOR_TEST = 3

  function conditionValueForTest(slot: Q9Slot, rawValue: string): string {
    return slot === 'findSite' ? rawValue : shortenValue(rawValue)
  }
  function isUnknownRaw(raw: string): boolean {
    return UNKNOWN_WORDS.some((w) => raw.includes(w))
  }
  function sharedPrefixLength(a: string, b: string): number {
    let i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    return i
  }
  // choice の raw 値（生のフィールド値、shortenValue で括弧内を落とす前）が target の条件値 V
  // （conditionValueForTest 後）を意味的に満たすか。q9.ts の実装とは独立に、reviewer が実データ
  // （tenpyo「東大寺境内」⊃「東大寺法華堂」、insei/higashiyama/kasei/konin-jogan/horeki-tenmei
  // の「木造」⊂「木造・書院造」「錦絵」⊂「錦絵／三枚続」等）から導いた一般ルールをそのまま
  // 独立実装する（q9.ts の関数を直接呼ぶと実装のバグをテストが見逃す＝テストの意味が無くなる）。
  // 非対称: choice の raw 値が V を包含する方向のみ判定する（V が choice の raw より具体的・
  // 複合的なときに choice がその一部しか満たさないと断定できないため、逆方向は判定しない。
  // builder メモ semantic-check-needs-asymmetric-containment-not-mutual-membership と同種）。
  function semanticallySatisfies(slot: Q9Slot, targetRaw: string, choiceRaw: string): boolean {
    const v = conditionValueForTest(slot, targetRaw)
    const choiceValue = conditionValueForTest(slot, choiceRaw)
    if (v === choiceValue) return true
    if (choiceRaw.includes(v)) return true
    if (choiceRaw.split(VALUE_SPLIT_DELIMS_FOR_TEST)[0] === v) return true
    if ((slot === 'location' || slot === 'findSite') && sharedPrefixLength(choiceValue, v) >= LOCATION_SHARED_PREFIX_MIN_FOR_TEST) return true
    return false
  }

  it(`全15ワールド×★2〜5×全面×${SEMANTIC_SEEDS} seedで、Q9の誤答が意味的に条件を満たす設問、または条件文（conditionText）が「不詳/不明/未詳」を含む設問が0件`, () => {
    const semanticViolations: string[] = []
    const unknownConditionViolations: string[] = []
    let totalQ9 = 0
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        if (difficulty === 1) continue
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          for (let seed = 0; seed < SEMANTIC_SEEDS; seed++) {
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
              if (q.type !== 'q9' || !q.q9Slot || q.q9Slot === 'era') continue
              totalQ9++
              // M2i-05c①: 条件文自体が「不詳/不明/未詳」を含んではいけない（＝そもそも target の
              // 値としてこの種の値が使われていない、という直接的な検査。値が不明な作品は
              // slotValue が null を返すため、effectiveSlotOrder が別のスロットにフォールバックし、
              // conditionText には決して現れないはず）。
              if (q.conditionText && isUnknownRaw(q.conditionText)) {
                unknownConditionViolations.push(
                  `${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.work.id} の条件文「${q.conditionText}」が不詳系`,
                )
              }
              const targetRaw = slotValue(q.work, q.q9Slot)
              if (!targetRaw) continue
              for (const choice of q.choiceWorks) {
                if (choice.id === q.work.id) continue
                // 誤答側（選択肢）の実際の値自体が「不詳」等を含むのは問題ない（slotValue が
                // null を返すため target の値とは必ず「異なる」扱いになり、正しく誤答として
                // 選ばれているだけ。判別不能になるのは target 側が不詳のときだけ、それは
                // conditionText の検査で捕捉している）。ここでは意味的な包含関係のみ検査する。
                const choiceRaw = slotValue(choice, q.q9Slot)
                if (choiceRaw && semanticallySatisfies(q.q9Slot, targetRaw, choiceRaw)) {
                  semanticViolations.push(
                    `${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.q9Slot} "${choice.id}"="${choiceRaw}" が target "${q.work.id}"="${targetRaw}" を意味的に満たす`,
                  )
                }
              }
            }
          }
        }
      }
    }
    console.log(`[M2i-05d] Q9出題数（★2〜5、全15ワールド×${SEMANTIC_SEEDS}seed）: ${totalQ9}`)
    console.log('[M2i-05d] 意味的に条件を満たす誤答（raw値ベースの包含判定）:', semanticViolations)
    console.log('[M2i-05d] 条件文が不詳系を含む設問:', unknownConditionViolations)
    expect(totalQ9).toBeGreaterThan(0)
    expect(semanticViolations).toEqual([])
    expect(unknownConditionViolations).toEqual([])
  }, 600000)

  it(`horeki-tenmei★3で所蔵施設（博物館・記念館・記念会等）を問う設問が${SEMANTIC_SEEDS} seed中0件`, () => {
    const violations: string[] = []
    const plan = buildEraStagePlan('horeki-tenmei', 3, reviewedPlayableWorks)
    for (const seg of plan.segments) {
      for (let seed = 0; seed < SEMANTIC_SEEDS; seed++) {
        const qs = buildStageQuestions('horeki-tenmei', 3, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
        for (const q of qs) {
          if (q.type === 'q9' && (q.q9Slot === 'holder' || q.q9Slot === 'location') && q.conditionText?.includes('記念会')) {
            violations.push(`seed${seed}: ${q.work.id} の条件文「${q.conditionText}」`)
          }
        }
      }
    }
    expect(violations).toEqual([])
  }, 60000)
})

// M2i-05d④（decisions.md 2026-09-11、reviewer fact-check-m2i-05c.md [中]-3「★4 subjectの条件文が
// 日本語として壊れている」の是正）: shortenValue が読点で切った結果、動詞の連用形（〜し）で終わる
// 体言でない句がそのまま条件文（「〜を主題とするもの」）に入らないことを確認する。
describe('合格ライン(M2i-05d④): ★4のsubject条件文に連用形の破綻が無い', () => {
  it('全15ワールド×★4×全面×30 seedで、q9Slot=subjectのconditionTextが「し」等の連用形で終わらない', () => {
    const violations: string[] = []
    let totalSubjectQ9 = 0
    const NON_NOMINAL_ENDING_FOR_TEST = /[ぁ-ゖー]を主題とするもの$/
    for (const era of reviewedEras) {
      const plan = buildEraStagePlan(era.id, 4, reviewedPlayableWorks)
      for (const seg of plan.segments) {
        for (let seed = 0; seed < 30; seed++) {
          const qs = buildStageQuestions(era.id, 4, seg.segment, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          for (const q of qs) {
            if (q.type !== 'q9' || q.q9Slot !== 'subject' || !q.conditionText) continue
            totalSubjectQ9++
            if (NON_NOMINAL_ENDING_FOR_TEST.test(q.conditionText)) {
              violations.push(`${era.id}-4-${seg.segment}(seed${seed}): ${q.work.id} の条件文「${q.conditionText}」`)
            }
          }
        }
      }
    }
    console.log(`[M2i-05d④] subjectスロットのQ9出題数（★4、全15ワールド×30seed）: ${totalSubjectQ9}`)
    expect(violations).toEqual([])
  }, 180000)
})

// M2i-05c③（decisions.md 2026-09-11、reviewer fact-check-m2i-05b.md [重大]-B「⑤のフォールバックが
// 1問だけの面・ノーミス必須を新規に作った」の是正）: 面の目標問数（questionCountForSegment）が2以上
// なのに、実際の生成が1問に減ってしまう（＝clearThreshold(1)=1でノーミス必須になる）ケースが
// 0件であることを確認する（kitayama★2/★3で実測、200/200試行で決定的に再現していた回帰）。
describe('合格ライン(M2i-05c③): 目標問数2以上の面が実際に1問に減らない', () => {
  it(`全15ワールド×★2〜5×全面×${SEEDS} seedで、questionCountForSegment>=2の面はqs.length===1にならない`, () => {
    const violations: string[] = []
    let checkedSegments = 0
    for (const era of reviewedEras) {
      for (const difficulty of ALL_DIFFICULTIES) {
        if (difficulty === 1) continue // ★1はQ9を使わないため対象外（このバグの対象外）
        const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
        for (const seg of plan.segments) {
          const target = questionCountForSegment(seg)
          if (target < 2) continue
          checkedSegments++
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
            if (qs.length === 1) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): target=${target}だがqs.length=1`)
          }
        }
      }
    }
    console.log(`[M2i-05c③] target>=2の面数（★2〜5）: ${checkedSegments}`)
    expect(checkedSegments).toBeGreaterThan(0)
    expect(violations).toEqual([])
  }, 180000)
})
