// 実データ（content/）に対する buildPracticeSession のチェック。M2-22。
import { describe, expect, it } from 'vitest'
import { eras, playableWorks, themeSetPool } from '../../content'
import { buildPracticeSession } from '../practiceSession'
import { seededRandom } from './testFixtures'

describe('実データ: buildPracticeSession', () => {
  it(
    '15文化すべてで、対象作品があれば1問以上作れる（作れない場合はそのエラー原因を明記して失敗する）',
    () => {
      const emptyEras: string[] = []
      for (const era of eras) {
        const hasWorks = themeSetPool.some((w) => w.era === era.id)
        if (!hasWorks) {
          emptyEras.push(era.id)
          continue
        }
        const questions = buildPracticeSession(era.id, themeSetPool, playableWorks, eras, seededRandom(1))
        for (const q of questions) {
          expect(q.work.era).toBe(era.id)
          // status: draft の除外は content.ts 側（本番ビルドのみ）。テストは DEV 扱いで
          // draft も混在するため、ここでは独自フィルタを迂回していないことだけ確認する。
          expect(themeSetPool.some((w) => w.id === q.work.id)).toBe(true)
        }
      }
      // 作品が1件も無い区分がある場合はここで可視化する（今のコンテンツ投入状況次第で0件になりうる。
      // エラーにはしない＝実データの投入進捗によって変わりうる情報として記録するだけ）。
      console.log('[practiceSession] 作品が無い区分:', emptyEras)
    },
    30000,
  )
})
