// 実データ（content/、reviewed限定）に対する M2e-02 の受け入れ条件②の検査:
// 「模試・ボスのリード文付き問題の設問文が100%下線部キーを含む」（BOARD.md M2e 節）。
// stages.realdata.test.ts / mockExam.realdata.test.ts と同じ reviewedFixtures（DEV フラグに
// 依存しない、本番ビルド相当のプール）を使う。
import { describe, expect, it } from 'vitest'
import { buildBossQuestions, buildStageQuestions } from '../stages'
import { buildMockExam, MOCK_EXAM_SIZE, TIME_ATTACK_EXAM_SIZE } from '../mockExam'
import { createInitialProgress } from '../progress'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'
import type { Question } from '../../types'

const today = '2026-09-09'
const progress = createInitialProgress(today)

/** research/stem-patterns.md 4.2「155本中152本（98%）が『下線部◯』を含む。残り3本は
 *  正当な別パターン（文化伏せ型 P13/P16・画像リード型 P11）」で確認済みの、writer が
 *  意図的に「下線部」を使わない文言で書いた3件（kamakura-02/e・kasei-image-01/a・e）。
 *  buildThemeQuestionForWorkWithMeta のラッパーは ask.stem が既にあれば上書きしない
 *  （writer 手書きが最優先）ため、この3件は engine/stems.ts の既定 stem に置き換わらない。
 *  実データから機械的に求める（ハードコードしない＝writer が増減させても自動で追随する）。 */
const legitimateNonUnderlineStems = new Set<string>()
for (const passage of reviewedPassages) {
  for (const underline of passage.underlines) {
    if (underline.ask?.stem && !underline.ask.stem.includes('下線部')) {
      legitimateNonUnderlineStems.add(`${passage.id}::${underline.key}`)
    }
  }
}

/** 設問文が「下線部○」を参照しているか。q14（年代順）は複数作品にまたがり特定の下線1本に
 *  紐づかないため、この検査からは除外する（mockExam.ts の passage:null と同じ既存の設計判断。
 *  reviewer 指摘 M2-99v3 中4 を参照）。writer が意図的に「下線部」を使わない文言を書いた
 *  既知の3件（上記 legitimateNonUnderlineStems）も対象外にする。 */
function referencesUnderline(q: Question): boolean {
  if (q.type === 'q14') return true // 対象外（分母に含めるが「満たす」扱いにする。下記コメント参照）
  if (q.passageId && q.underlineKey && legitimateNonUnderlineStems.has(`${q.passageId}::${q.underlineKey}`)) return true
  return typeof q.stem === 'string' && q.stem.includes('下線部')
}

const SEEDS = 15

describe('M2e-02 受け入れ②: 模試・ボスの設問文が下線部キーを含む率', () => {
  it(
    'ボス: 全15ワールド×15 seed で、q14 を除く全設問の stem が「下線部」を含む（100%）',
    () => {
      const perEra: Record<string, { total: number; withUnderline: number; standalone: number }> = {}
      for (const era of reviewedEras) {
        perEra[era.id] = { total: 0, withUnderline: 0, standalone: 0 }
        for (let seed = 0; seed < SEEDS; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          for (const q of boss) {
            if (q.type === 'q14') continue // 分母からも除く（複数作品にまたがり下線に紐づかない設計）
            perEra[era.id].total++
            if (referencesUnderline(q)) perEra[era.id].withUnderline++
            if (!q.passageId) perEra[era.id].standalone++
          }
        }
      }

      const failing = Object.entries(perEra).filter(([, v]) => v.total > 0 && v.withUnderline !== v.total)
      // 失敗時にどのワールドで何件欠けたかが分かるよう、テーブルごとエラーメッセージに含める。
      expect(failing, JSON.stringify(perEra, null, 2)).toEqual([])

      // 完了報告に転記する実測値（フォールバック3/4＝下線に紐づかない単独問題の発生率）。
      const totalAll = Object.values(perEra).reduce((a, v) => a + v.total, 0)
      const withUnderlineAll = Object.values(perEra).reduce((a, v) => a + v.withUnderline, 0)
      const standaloneAll = Object.values(perEra).reduce((a, v) => a + v.standalone, 0)
      // eslint-disable-next-line no-console -- 完了報告用の実測値を残す（アサーションではない）
      console.log('[M2e-02] ボス stem 下線部含有率:', `${withUnderlineAll}/${totalAll}`, JSON.stringify(perEra))
      console.log('[M2e-02] ボス 単独問題(下線に紐づかない)発生率:', `${standaloneAll}/${totalAll}`)
    },
    60000,
  )

  it(
    '模試（buildMockExam, MOCK_EXAM_SIZE=10）: 30 seed で、q14 を除く全設問の stem が「下線部」を含む（100%）',
    () => {
      let total = 0
      let withUnderline = 0
      let standalone = 0
      for (let seed = 0; seed < 30; seed++) {
        const items = buildMockExam(
          reviewedPassages,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          progress,
          today,
          seededRandom(seed),
          MOCK_EXAM_SIZE,
        )
        for (const item of items) {
          if (item.question.type === 'q14') continue
          total++
          if (referencesUnderline(item.question)) withUnderline++
          if (!item.passage) standalone++
        }
      }
      expect(withUnderline, `${withUnderline}/${total} が下線部を含む`).toBe(total)
      console.log('[M2e-02] 模試(10問) stem 下線部含有率:', `${withUnderline}/${total}`, '単独問題:', standalone)
    },
    30000,
  )

  it(
    '模試タブ（buildMockExam, TIME_ATTACK_EXAM_SIZE=20）: 15 seed でも同様に100%',
    () => {
      let total = 0
      let withUnderline = 0
      for (let seed = 0; seed < 15; seed++) {
        const items = buildMockExam(
          reviewedPassages,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          progress,
          today,
          seededRandom(seed + 500),
          TIME_ATTACK_EXAM_SIZE,
        )
        for (const item of items) {
          if (item.question.type === 'q14') continue
          total++
          if (referencesUnderline(item.question)) withUnderline++
        }
      }
      expect(withUnderline, `${withUnderline}/${total} が下線部を含む`).toBe(total)
      console.log('[M2e-02] 模試タブ(20問) stem 下線部含有率:', `${withUnderline}/${total}`)
    },
    30000,
  )

  it('通常ステージ（面）: passages を渡すと、下線が対象にする作品の stem に「下線部」が付く（passages 省略時は単独問題のまま＝後方互換）', () => {
    // buildStageQuestions は面の対象作品全件が下線に紐づくとは限らない設計のため、100%は求めない
    // （BOARD.md M2e-02 の合格ラインもボス・模試のみを対象にしている）。ここでは「passages を
    // 渡した経路が実際に少なくとも1件は下線部つきの stem を生成できる」ことだけを実データで確かめる。
    let sawUnderline = false
    let sawStandalone = false
    for (const era of reviewedEras) {
      for (let seed = 0; seed < 5; seed++) {
        const qs = buildStageQuestions(
          era.id,
          1,
          1,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          seededRandom(seed),
          reviewedPassages,
        )
        for (const q of qs) {
          if (q.stem?.includes('下線部')) sawUnderline = true
          else if (q.stem) sawStandalone = true
        }
      }
    }
    expect(sawUnderline).toBe(true)
    expect(sawStandalone).toBe(true)
  })
})
