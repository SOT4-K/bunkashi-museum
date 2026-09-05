// 実データ（content/）に対する buildMockExam のチェック。M2-20 → M2-45（全15文化に統合）。
// content 増加中の事業のため、全 seed ループは重めになりうる（builder メモ参照）。タイムアウトを長めに取る。
import { describe, expect, it } from 'vitest'
import { eras, passages, playableWorks, themeSetPool, works } from '../../content'
import { buildMockExam, discoverableWorks, MOCK_EXAM_SIZE } from '../mockExam'
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
          // Q14（年代順）は特定の下線に紐づかない独立問題のため passage が無い（reviewer指摘
          // M2-99v3中4の修正）。それ以外の型は必ず出題元passageを持つ。
          if (item.question.type === 'q14') {
            expect(item.passage).toBeUndefined()
          } else {
            expect(passages.some((p) => p.id === item.passage?.id)).toBe(true)
          }
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

  // reviewer指摘 M2-25②③: 実データは全下線がask.type明示のため、desiredCategory経由でしか
  // 出ないQ13（語句組合せ・T1）とQ14（年代順・T7）が0%だった（analysis 2章の目安はT1≈22%・T7≈5%）。
  // buildMockExamにQ13の最低1問保証とQ14の約1/3頻度の強制ロジックを追加した効果を、
  // 100 seedの実測で確認する。writer手書きのask.type分布に制約されるため analysis 2章の
  // 比率そのものへの一致は保証できないが、「0%だったものが実際に出るようになったこと」と
  // 「型が極端に偏っていないこと」を固定する。
  it(
    '100 seed の型配分実測: Q13・Q14 が実際に出題され、既存の主要4型も出続ける',
    () => {
      const counts: Record<string, number> = {}
      let totalQuestions = 0
      for (let seed = 0; seed < 100; seed++) {
        const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today, seededRandom(seed + 1000))
        for (const item of items) {
          counts[item.question.type] = (counts[item.question.type] ?? 0) + 1
          totalQuestions++
        }
      }
      // M2-25③の修正確認: Q14（年代順）が全経路でデッドコード（0%）だった状態から回復している。
      expect(counts.q14 ?? 0).toBeGreaterThan(0)
      // M2-25②の修正確認: Q13（語句組合せ）も同様に0%だった。
      expect(counts.q13 ?? 0).toBeGreaterThan(0)
      // 既存の主要4型（実データのask.typeで使われている）が出続けることの回帰確認。
      for (const type of ['q9', 'q10', 'q4', 'q12']) {
        expect(counts[type] ?? 0).toBeGreaterThan(0)
      }
      // 目安: どの型も全体の1問未満〜大半を占めるような極端な偏りではないこと
      // （analysis 2章はどの型も単独で50%を超えない）。
      for (const type of Object.keys(counts)) {
        expect(counts[type] / totalQuestions).toBeLessThan(0.5)
      }
    },
    60000,
  )

  // reviewer指摘 M2-99v3中4: Q14への差し替えが①無関係な下線の抜粋・LeadPanelを引き継ぐ
  // ②orderItemsの作品が他の枠と重複しうる、という2つの不具合を実データで固定する。
  it(
    '100 seed の実データ確認: Q14は passage を持たず、1回の試験内で作品が重複しない',
    () => {
      for (let seed = 0; seed < 100; seed++) {
        const items = buildMockExam(passages, themeSetPool, playableWorks, eras, progress, today, seededRandom(seed + 2000))
        const workIds = items.map((i) => i.question.work.id)
        expect(new Set(workIds).size).toBe(workIds.length)
        for (const item of items) {
          if (item.question.type === 'q14') {
            expect(item.passage).toBeUndefined()
            expect(item.excerpt).toEqual([])
          }
        }
      }
    },
    60000,
  )

  // reviewer指摘 M2-25⑤: 図鑑・成績タブの分母が works（reviewed全件）そのままだと、
  // どの passage の下線からも対象にならない作品まで「永久に未発見」として分母に残る。
  it('実データ: discoverableWorks は works 全件より少なく、全件が works に含まれる（余計な作品を作り出さない）', () => {
    const result = discoverableWorks(passages, themeSetPool)
    expect(result.length).toBeGreaterThan(0)
    expect(result.length).toBeLessThan(works.length)
    for (const w of result) {
      expect(works.some((x) => x.id === w.id)).toBe(true)
    }
  })
})
