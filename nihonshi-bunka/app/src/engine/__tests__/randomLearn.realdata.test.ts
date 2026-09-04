// 実データ（content/）に対する buildRandomLearnSession のチェック。M2-21。
// content が並走 writer で増え続けるため、既定タイムアウトを超えないよう明示的に長めにする
// （builder記憶: realdata-tests-need-generous-timeout-when-content-grows-concurrently）。
import { describe, expect, it } from 'vitest'
import { eras, passages, playableWorks, themeSetPool } from '../../content'
import { createInitialProgress } from '../progress'
import { buildRandomLearnSession, RANDOM_LEARN_SESSION_SIZE } from '../randomLearn'
import { seededRandom } from './testFixtures'

describe('実データ: buildRandomLearnSession', () => {
  it('passages/themeSetPool が実データとして読み込めている（前提）', () => {
    expect(passages.length).toBeGreaterThan(0)
    expect(themeSetPool.length).toBeGreaterThan(0)
  })

  // status: draft を出題対象にしないことの保証は content.ts の shouldIncludeDraft() が担う
  // （本番ビルドでのみ reviewed に絞る。テスト実行は DEV 扱いのため draft も混在する仕様
  // ＝ __tests__/content.test.ts で明示的に確認済み）。ここではその上流のフィルタ済み配列
  // （themeSetPool/playableWorks/passages）をそのまま使っていること、独自に生データを
  // 読み直していないことを確認する。
  it(
    '10 seed とも1問以上・10問以下を作る',
    () => {
      const progress = createInitialProgress('2026-09-04')
      for (let seed = 0; seed < 10; seed++) {
        const items = buildRandomLearnSession(
          passages,
          themeSetPool,
          playableWorks,
          eras,
          progress,
          '2026-09-04',
          seededRandom(seed),
          RANDOM_LEARN_SESSION_SIZE,
        )
        expect(items.length).toBeGreaterThan(0)
        expect(items.length).toBeLessThanOrEqual(RANDOM_LEARN_SESSION_SIZE)
        for (const item of items) {
          // themeSetPool に含まれる作品しか対象にしない（独自フィルタを迂回していないこと）。
          expect(themeSetPool.some((w) => w.id === item.question.work.id)).toBe(true)
        }
      }
    },
    30000,
  )

  it(
    '図版問題（Q9）が最低1問は含まれる（10 seed）',
    () => {
      const progress = createInitialProgress('2026-09-04')
      for (let seed = 0; seed < 10; seed++) {
        const items = buildRandomLearnSession(
          passages,
          themeSetPool,
          playableWorks,
          eras,
          progress,
          '2026-09-04',
          seededRandom(seed),
        )
        expect(items.some((it) => it.question.type === 'q9'), `seed ${seed} で図版問題が0件`).toBe(true)
      }
    },
    30000,
  )
})
