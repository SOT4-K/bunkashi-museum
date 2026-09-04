// 実データ（content/）に対する buildMockExam のチェック。M2-20 → M2-45（全15文化に統合）。
// content 増加中の事業のため、全 seed ループは重めになりうる（builder メモ参照）。タイムアウトを長めに取る。
import { describe, expect, it } from 'vitest'
import { eras, passages, playableWorks, themeSetPool } from '../../content'
import { buildMockExam, MOCK_EXAM_SIZE } from '../mockExam'
import { createInitialProgress } from '../progress'
import { seededRandom } from './testFixtures'

const today = '2026-09-05'
const progress = createInitialProgress(today)

describe('実データ: buildMockExam', () => {
  // status: draft の除外は content.ts の shouldIncludeDraft()（本番ビルドのみ reviewed に絞る）
  // が担う。テスト実行は DEV 扱いのため draft も混在する仕様（__tests__/content.test.ts）。
  it(
    '10 seed とも1問以上・MOCK_EXAM_SIZE 問以下を作り、対象作品は themeSetPool に含まれる',
    () => {
      for (let seed = 0; seed < 10; seed++) {
        const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today, seededRandom(seed))
        expect(items.length).toBeGreaterThan(0)
        expect(items.length).toBeLessThanOrEqual(MOCK_EXAM_SIZE)
        for (const item of items) {
          expect(themeSetPool.some((w) => w.id === item.question.work.id)).toBe(true)
          expect(passages.some((p) => p.id === item.passage.id)).toBe(true)
        }
      }
    },
    30000,
  )

  it(
    '15文化のうち複数の文化から出題される（1文化に偏らない。5 seed 分の和集合で確認）',
    () => {
      const seenEras = new Set<string>()
      for (let seed = 0; seed < 5; seed++) {
        const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today, seededRandom(seed + 100))
        for (const item of items) seenEras.add(item.eraId)
      }
      expect(seenEras.size).toBeGreaterThan(1)
    },
    30000,
  )
})
