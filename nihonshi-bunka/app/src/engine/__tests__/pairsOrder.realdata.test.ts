// 実データ（content/）に対するプロパティテスト（M2-16）。DESIGN.md 10章の既存テスト
// （newTypes.realdata.test.ts）と同じ形式。pairs/orderIndex は writer が M2-17 で投入中の
// フィールドのため、生成できない作品があること自体は失敗ではない（件数を報告するだけ）。
import { describe, expect, it } from 'vitest'
import { works, eras, passages, themeSetPool, playableWorks } from '../../content'
import { generatePairQuestion } from '../pairs'
import { generateOrderQuestion } from '../order'
import { buildThemeSetQuestions } from '../themeSet'
import { seededRandom } from './testFixtures'

describe('実データ: Q13（語句の組合せ）の生成可否と衝突チェック', () => {
  it('works が実データとして読み込めている（前提）', () => {
    expect(works.length).toBeGreaterThan(0)
  })

  // content/works/ は writer が並行して増やし続けているため、全作品×全seedのループは
  // 件数の増加とともに遅くなる（full suite 実行時は CPU 競合でさらに伸びる）。
  // 既定の 5000ms タイムアウトだと現状の規模でも余裕が無いため明示的に延ばす
  // （newTypes.realdata.test.ts の Q8 テストも同じ理由で timeout しうる。既存ファイルのため
  // 本チケットでは変更しないが、報告に明記する）。
  it('生成できる全作品で、10 seed とも正解・誤答の組合せ文字列が重複しない', () => {
    const ungenerable: string[] = []
    for (const work of works) {
      let generatedAtLeastOnce = false
      for (let seed = 0; seed < 10; seed++) {
        const result = generatePairQuestion(work, works, seededRandom(seed))
        if (!result) continue
        generatedAtLeastOnce = true
        const texts = [result.correct.text, ...result.distractors.map((d) => d.text)]
        expect(new Set(texts).size, `${work.id} (seed ${seed}) の4択に重複テキストがある`).toBe(texts.length)
        expect(result.distractors).toHaveLength(3)
      }
      if (!generatedAtLeastOnce) ungenerable.push(work.id)
    }
    console.log(`[Q13] pairs が無い、または偽の組合せ・比較対象が足りず生成できない作品 (${ungenerable.length}/${works.length}件)`)
  }, 30000)
})

describe('実データ: Q14（年代順並べ替え）の生成可否', () => {
  it('generateOrderQuestion が実データで例外を投げない（orderIndex が無ければ null）', () => {
    const result = generateOrderQuestion(playableWorks, seededRandom(1))
    // M2-17 で orderIndex 投入中のため、現時点では null（生成不可）でも良い。
    // データが揃えば自動的に動き出す設計であることを確認する（例外を投げないことが本体）。
    if (result) {
      expect(result.displayItems).toHaveLength(3)
      expect(result.choices).toHaveLength(4)
    }
    console.log(`[Q14] generateOrderQuestion(playableWorks): ${result ? '生成できた' : 'まだ生成できない（orderIndex 不足）'}`)
  })
})

describe('実データ: buildThemeSetQuestions が全 passages で例外を投げない（M2-16 統合）', () => {
  it('全 passages を themeSetPool/playableWorks で組み立てても例外にならない', () => {
    const typeCounts: Record<string, number> = {}
    for (const passage of passages) {
      const result = buildThemeSetQuestions(passage, themeSetPool, eras, seededRandom(1), playableWorks)
      for (const item of result) {
        typeCounts[item.question.type] = (typeCounts[item.question.type] ?? 0) + 1
      }
    }
    console.log('[M2-16] 実データでの型の出現回数（全 passages 合計）:', typeCounts)
    // 少なくとも1つは何らかの設問が作れている（passages が空でない限り）
    if (passages.length > 0) {
      const total = Object.values(typeCounts).reduce((a, b) => a + b, 0)
      expect(total).toBeGreaterThan(0)
    }
  })
})
