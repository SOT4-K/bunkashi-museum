// 実データ（content/）に対する buildMockExam のチェック。M2-20。
import { describe, expect, it } from 'vitest'
import { eras, passages, playableWorks, themeSetPool } from '../../content'
import { buildMockExam, MOCK_EXAM_SIZE } from '../mockExam'
import { seededRandom } from './testFixtures'

describe('実データ: buildMockExam', () => {
  // status: draft の除外は content.ts の shouldIncludeDraft()（本番ビルドのみ reviewed に絞る）
  // が担う。テスト実行は DEV 扱いのため draft も混在する仕様（__tests__/content.test.ts）。
  // ここでは上流のフィルタ済み配列をそのまま使っていることだけを確認する。
  it(
    '10 seed とも1問以上・MOCK_EXAM_SIZE 問以下を作る',
    () => {
      for (let seed = 0; seed < 10; seed++) {
        const sections = buildMockExam(passages, themeSetPool, playableWorks, eras, seededRandom(seed))
        const total = sections.reduce((sum, s) => sum + s.questions.length, 0)
        expect(total).toBeGreaterThan(0)
        expect(total).toBeLessThanOrEqual(MOCK_EXAM_SIZE)
        for (const section of sections) {
          for (const q of section.questions) {
            expect(themeSetPool.some((w) => w.id === q.question.work.id)).toBe(true)
          }
        }
      }
    },
    30000,
  )
})
