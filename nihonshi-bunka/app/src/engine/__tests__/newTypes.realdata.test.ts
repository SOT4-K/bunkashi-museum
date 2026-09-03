// 実データ（content/）に対するプロパティテスト。DESIGN.md 10章の受け入れ条件:
//  「全作品×全型で生成しても正文と誤文が衝突しない」ことを機械的に確認する。
//  あわせて「生成できない作品（誤文不足・スロット不足）」の id 一覧を出す（ビルダーの
//  完了報告に添付するため console.log で見えるようにしておく）。
import { describe, expect, it } from 'vitest'
import { works, eras } from '../../content'
import { generateStatementQuestion } from '../statements'
import { generateEraItemQuestion } from '../eraItems'
import { generateComboQuestion } from '../combos'
import { seededRandom } from './testFixtures'

describe('実データ: Q4/Q6/Q8 の生成可否と衝突チェック', () => {
  it('works/eras が実データとして読み込めている（前提）', () => {
    expect(works.length).toBeGreaterThan(0)
    expect(eras.length).toBeGreaterThan(0)
  })

  it('Q4: 生成できる全作品で、10 seed とも正文・誤文のテキストが重複しない', () => {
    const ungenerable: string[] = []
    for (const work of works) {
      let generatedAtLeastOnce = false
      for (let seed = 0; seed < 10; seed++) {
        const result = generateStatementQuestion(work, works, seededRandom(seed))
        if (!result) continue
        generatedAtLeastOnce = true
        const texts = [result.correct.text, ...result.distractors.map((d) => d.text)]
        expect(new Set(texts).size, `${work.id} (seed ${seed}) の4択に重複テキストがある`).toBe(texts.length)
        expect(result.distractors).toHaveLength(3)
      }
      if (!generatedAtLeastOnce) ungenerable.push(work.id)
    }
    console.log(`[Q4] 生成できない作品 (${ungenerable.length}件):`, ungenerable)
  })

  it('Q6: 生成できる全作品で、10 seed とも正文・誤文のテキストが重複しない', () => {
    const ungenerable: string[] = []
    for (const work of works) {
      let generatedAtLeastOnce = false
      for (let seed = 0; seed < 10; seed++) {
        const result = generateEraItemQuestion(work, eras, seededRandom(seed))
        if (!result) continue
        generatedAtLeastOnce = true
        const texts = [result.correct.text, ...result.distractors.map((d) => d.text)]
        expect(new Set(texts).size, `${work.id} (seed ${seed}) の4択に重複テキストがある`).toBe(texts.length)
        expect(result.distractors).toHaveLength(3)
        for (const d of result.distractors) {
          expect(d.eraId, `${work.id}: 誤文の文化が正解と同じ`).not.toBe(result.correct.eraId)
        }
      }
      if (!generatedAtLeastOnce) ungenerable.push(work.id)
    }
    console.log(`[Q6] 生成できない作品 (${ungenerable.length}件):`, ungenerable)
  })

  it('Q8: 生成できる全作品で、10 seed とも正解・誤答の組合せ文字列が重複しない', () => {
    const ungenerable: string[] = []
    for (const work of works) {
      let generatedAtLeastOnce = false
      for (let seed = 0; seed < 10; seed++) {
        const result = generateComboQuestion(work, works, seededRandom(seed))
        if (!result) continue
        generatedAtLeastOnce = true
        const texts = [result.correct.text, ...result.distractors.map((d) => d.text)]
        expect(new Set(texts).size, `${work.id} (seed ${seed}) の4択に重複テキストがある`).toBe(texts.length)
        expect(result.distractors).toHaveLength(3)
      }
      if (!generatedAtLeastOnce) ungenerable.push(work.id)
    }
    console.log(`[Q8] 生成できない作品 (${ungenerable.length}件):`, ungenerable)
  })
})
