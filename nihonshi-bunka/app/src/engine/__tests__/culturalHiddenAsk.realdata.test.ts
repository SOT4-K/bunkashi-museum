// M2e-08b（reviewer指摘 M2e-99b の修正確認）: 文化伏せ型（q12・stemが「この文化」
// 「A〜Eが述べている（同じ文化について述べている）」等で文化名を伏せて問う下線）が、
// M2e-08 の planCategoryFloorConversions（型配分の床を満たすための donor 変換）によって
// 無断で別の型（q13/q10/q4/q9等）に差し替えられていないことを、模試・ボス・テーマセット
// 単体の3経路すべてで実データ（content/passages/*.json）30 seedで確認する。
// reviewer実測（修正前）: 模試経路で下線紐づき設問の23.5%・ボスで22.4%が上書き、文化伏せ型は
// 模試経路で23件中7件（約30%）が汎用設問に置換されていた（テーマセット単体経路は0%。
// planCategoryFloorConversionsを呼ばないため元々このバグの影響を受けない）。
// content 増加中の事業のため、全 era × 30 seed ループは重めになりうる（builder メモ
// realdata-tests-need-generous-timeout-when-content-grows-concurrently.md）。タイムアウトを長めに取る。
import { describe, expect, it } from 'vitest'
import { buildMockExam, TIME_ATTACK_EXAM_SIZE } from '../mockExam'
import { buildBossQuestions } from '../stages'
import { buildThemeSetQuestions, isCulturalHiddenAsk } from '../themeSet'
import { createInitialProgress } from '../progress'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'
import type { Passage } from '../../types'

const today = '2026-09-05'
const progress = createInitialProgress(today)
const SEED_COUNT = 30

/** passage.id:underline.key → 文化伏せ型かどうかの一覧を作る（判定自体は themeSet.ts の
 *  isCulturalHiddenAsk を使う。engine 側の donor 除外ロジックと同じ定義で検査する）。 */
function culturalHiddenKeys(passages: Passage[]): Set<string> {
  const keys = new Set<string>()
  for (const passage of passages) {
    for (const underline of passage.underlines) {
      if (isCulturalHiddenAsk(underline.ask)) keys.add(`${passage.id}:${underline.key}`)
    }
  }
  return keys
}

describe('実データ: 文化伏せ型下線（q12・stemに「この文化」等）の維持率', () => {
  it('前提確認: 実データに文化伏せ型の下線が複数件ある（fixture自体が空でないこと）', () => {
    const keys = culturalHiddenKeys(reviewedPassages)
    expect(keys.size).toBeGreaterThanOrEqual(10)
  })

  it(
    'テーマセット単体経路（buildThemeSetQuestions）: 30 seedで文化伏せ型は常にq12のまま生成される' +
      '（この経路はplanCategoryFloorConversionsを呼ばないため、元々このバグの影響を受けない。' +
      'ベースラインとして0%上書きであることを確認する）',
    () => {
      const violations: { passageId: string; underlineKey: string; seed: number; type: string }[] = []
      const culturalPassages = reviewedPassages.filter((p) => p.underlines.some((u) => isCulturalHiddenAsk(u.ask)))
      expect(culturalPassages.length).toBeGreaterThan(0)
      for (const passage of culturalPassages) {
        const keys = new Set(passage.underlines.filter((u) => isCulturalHiddenAsk(u.ask)).map((u) => u.key))
        for (let seed = 0; seed < SEED_COUNT; seed++) {
          const items = buildThemeSetQuestions(passage, reviewedThemeSetPool, reviewedEras, seededRandom(seed), reviewedPlayableWorks)
          for (const item of items) {
            if (keys.has(item.underlineKey) && item.question.type !== 'q12') {
              violations.push({ passageId: passage.id, underlineKey: item.underlineKey, seed, type: item.question.type })
            }
          }
        }
      }
      expect(violations).toEqual([])
    },
    30000,
  )

  it(
    '模試経路（buildMockExam、本番実引数 TIME_ATTACK_EXAM_SIZE=20）: 30 seedで文化伏せ型は' +
      '100%維持される（修正前は23件中7件・約30%が汎用設問に置換されていた。M2e-08b修正確認）',
    () => {
      const keys = culturalHiddenKeys(reviewedPassages)
      const violations: { passageId: string | undefined; underlineKey: string; seed: number; type: string }[] = []
      let hitCount = 0
      for (let seed = 0; seed < SEED_COUNT; seed++) {
        const items = buildMockExam(
          reviewedPassages,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          progress,
          today,
          seededRandom(seed),
          TIME_ATTACK_EXAM_SIZE,
        )
        for (const item of items) {
          const key = `${item.question.passageId}:${item.question.underlineKey}`
          if (!keys.has(key)) continue
          hitCount++
          if (item.question.type !== 'q12') {
            violations.push({ passageId: item.question.passageId, underlineKey: item.question.underlineKey ?? '', seed, type: item.question.type })
          }
        }
      }
      // 文化伏せ型の下線が30 seedで一度も候補に出なかった場合はテストが何も検査していないことになる
      // （builder メモ「ゲートは対象0件を合格と報告しない」）。実際に出現していることを確認する。
      expect(hitCount).toBeGreaterThan(0)
      expect(violations).toEqual([])
    },
    30000,
  )

  it(
    'ボス経路（buildBossQuestions、本番実引数・実count）: M2i ボス規則v4「文化伏せ型は模試専用にし、' +
      'ボスでは使わない（ヘッダーに文化名が出るため）」により、文化伏せ型の下線は30 seedとも' +
      '一度もボスに出ない（0%。M2e-08b時点の「100%維持」からv4で方針が変わったため書き直し）',
    () => {
      const keys = culturalHiddenKeys(reviewedPassages)
      const erasWithCultural = reviewedEras.filter((era) =>
        reviewedPassages.some((p) => p.era === era.id && p.underlines.some((u) => isCulturalHiddenAsk(u.ask))),
      )
      expect(erasWithCultural.length).toBeGreaterThan(0)
      const violations: { eraId: string; underlineKey: string; seed: number; type: string }[] = []
      for (const era of erasWithCultural) {
        for (let seed = 0; seed < SEED_COUNT; seed++) {
          const boss = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
          for (const q of boss) {
            const key = `${q.passageId}:${q.underlineKey}`
            if (!keys.has(key)) continue
            violations.push({ eraId: era.id, underlineKey: q.underlineKey ?? '', seed, type: q.type })
          }
        }
      }
      expect(violations).toEqual([])
    },
    60000,
  )
})
