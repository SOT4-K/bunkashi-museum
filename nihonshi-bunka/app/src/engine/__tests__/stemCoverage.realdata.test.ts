// M2i（★の定義v4）受け入れ条件①・④の一部（設問文の出どころ）の実データ検査。
// 旧M2e-02/M2e-07（ステージにも「下線部」を含む問題を混ぜる・ボスの単独問題比率40%以下）は
// v4で前提から変わった（ステージはリード文を一切使わない。ボスはwriter手書きのask.stemが
// ある下線だけから作り、engineの汎用文は使わない）ため、このファイルは新しい前提でテストを
// 書き直した（builder メモ「旧方式を置き換えるならテストも書き直す」）。
import { describe, expect, it } from 'vitest'
import { ALL_DIFFICULTIES, buildBossQuestions, buildEraStagePlan, buildStageQuestions } from '../stages'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'

const SEEDS = 15

describe('M2i 受け入れ①: ステージはリード文を一切使わない（passageId・「下線部」が0件）', () => {
  it(
    '全15ワールド×★1〜5×全面×15 seedで、ステージ問題は passageId が無く、stem が「下線部」を含まない',
    () => {
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
                if (q.passageId) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.work.id}/${q.type} に passageId が付いている`)
                if (q.stem?.includes('下線部')) violations.push(`${era.id}-${difficulty}-${seg.segment}(seed${seed}): ${q.work.id}/${q.type} の stem が「下線部」を含む: "${q.stem}"`)
              }
            }
          }
        }
      }
      expect(violations).toEqual([])
    },
    120000,
  )
})

describe('M2i 受け入れ④: ボスは全問が writer の ask.stem 由来（engine の汎用文0件）', () => {
  it(
    '全15ワールド×15 seedで、ボスの全設問の stem が、その passageId/underlineKey が指す下線の ask.stem と一致する',
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
            const expectedStem = key ? askStemByPassageUnderline.get(key) : undefined
            if (!expectedStem || q.stem !== expectedStem) {
              violations.push(`${era.id}(seed${seed}): ${q.work.id}/${q.type} の stem がその下線の ask.stem と一致しない（passageId=${q.passageId} underlineKey=${q.underlineKey} stem="${q.stem}"）`)
            }
          }
        }
      }
      expect(total).toBeGreaterThan(0)
      expect(violations).toEqual([])
    },
    120000,
  )
})
