// 実データ（content/、reviewed限定）に対する M2e-02 の受け入れ条件②の検査:
// 「模試・ボスのリード文付き問題の設問文が下線部キーを含む」（BOARD.md M2e 節）。
// stages.realdata.test.ts / mockExam.realdata.test.ts と同じ reviewedFixtures（DEV フラグに
// 依存しない、本番ビルド相当のプール）を使う。
//
// ボスについての重要な注記（実データ調査で判明。完了報告にも明記）:
//  buildBossQuestions は目標問数（N≤15なら10問、対象作品数が少ないワールドが多い）に届かせるため、
//  passage の下線に紐づかない作品（kind: person/text/concept の「文字問題の素材」を含む。
//  M2-16 で pool に混在させた設計）まで出題対象にする（フォールバック3・4）。これらは
//  そもそもどの passage の下線からも参照されていない作品のため、「下線部○」を付けようがない
//  （付けると存在しない下線を捏造することになり、オーナー指摘の逆再発になる）。したがって
//  ボスの「100%」は「全設問」ではなく「下線に紐づく作品（passages が実際にカバーしている作品）」
//  を分母にする。下線に紐づかない作品は engine/stems.ts の単独問題テンプレートを使い、
//  「下線部」を含まないことを別途確認する（誤って下線ありと誤認させないことの検査）。
import { describe, expect, it } from 'vitest'
import { buildBossQuestions, buildStageQuestions } from '../stages'
import { buildMockExam, MOCK_EXAM_SIZE, TIME_ATTACK_EXAM_SIZE } from '../mockExam'
import { pickThemeTargetId } from '../themeSet'
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
  if (q.type === 'q14') return true
  if (q.passageId && q.underlineKey && legitimateNonUnderlineStems.has(`${q.passageId}::${q.underlineKey}`)) return true
  return typeof q.stem === 'string' && q.stem.includes('下線部')
}

/** era ごとに「passages の下線が実際にカバーしている作品 id」の集合（engine/stages.ts の
 *  buildEraCandidateByWorkId と同じ pickThemeTargetId ロジックを使い、テスト側で独立に再計算する）。 */
function coveredWorkIdsByEra(eraId: string): Set<string> {
  const availableIds = new Set(reviewedThemeSetPool.map((w) => w.id))
  const covered = new Set<string>()
  for (const passage of reviewedPassages.filter((p) => p.era === eraId)) {
    for (const underline of passage.underlines) {
      const id = pickThemeTargetId(underline, passage, availableIds)
      if (id) covered.add(id)
    }
  }
  return covered
}

const SEEDS = 15

describe('M2e-02 受け入れ②: 模試・ボスの設問文が下線部キーを含む率', () => {
  it(
    'ボス: 全15ワールド×15 seed で、下線がカバーする作品を対象にした設問は100%「下線部」を含む。' +
      '下線が無い作品（フォールバック3/4。文字問題の素材や、単に対象作品数が少ないワールドの補充）は' +
      '下線を参照しない単独問題テンプレートになり「下線部」を含まないことを確認する。',
    () => {
      const perEra: Record<
        string,
        { coveredTotal: number; coveredWithUnderline: number; standaloneTotal: number; standaloneWithoutUnderline: number }
      > = {}
      for (const era of reviewedEras) {
        const covered = coveredWorkIdsByEra(era.id)
        perEra[era.id] = { coveredTotal: 0, coveredWithUnderline: 0, standaloneTotal: 0, standaloneWithoutUnderline: 0 }
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
            if (q.type === 'q14') continue
            if (covered.has(q.work.id)) {
              perEra[era.id].coveredTotal++
              if (referencesUnderline(q)) perEra[era.id].coveredWithUnderline++
            } else {
              perEra[era.id].standaloneTotal++
              if (!q.stem?.includes('下線部')) perEra[era.id].standaloneWithoutUnderline++
            }
          }
        }
      }

      // 主張①: 下線がカバーする作品を対象にした設問は、全ワールドで100%「下線部」を含む
      // （＝下線に紐づく作品なのに設問文が対応していない、というオーナー指摘の再発が無いこと）。
      const failingCovered = Object.entries(perEra).filter(([, v]) => v.coveredTotal > 0 && v.coveredWithUnderline !== v.coveredTotal)
      expect(failingCovered, JSON.stringify(perEra, null, 2)).toEqual([])
      // 主張②: 下線が無い作品（単独問題）は「下線部」を捏造しない（100%標準テンプレート）。
      const failingStandalone = Object.entries(perEra).filter(
        ([, v]) => v.standaloneTotal > 0 && v.standaloneWithoutUnderline !== v.standaloneTotal,
      )
      expect(failingStandalone, JSON.stringify(perEra, null, 2)).toEqual([])

      // 完了報告に転記する実測値。
      const totals = Object.values(perEra).reduce(
        (a, v) => ({
          coveredTotal: a.coveredTotal + v.coveredTotal,
          standaloneTotal: a.standaloneTotal + v.standaloneTotal,
        }),
        { coveredTotal: 0, standaloneTotal: 0 },
      )
      // eslint-disable-next-line no-console -- 完了報告用の実測値を残す（アサーションではない）
      console.log('[M2e-02] ボス 実測（era別）:', JSON.stringify(perEra, null, 2))
      console.log(
        '[M2e-02] ボス 合計: 下線カバー問題',
        totals.coveredTotal,
        '（全件下線部を含む） / 単独問題（下線非カバー）',
        totals.standaloneTotal,
        `/ 全 ${totals.coveredTotal + totals.standaloneTotal} 問`,
      )
    },
    60000,
  )

  it(
    '模試（buildMockExam, MOCK_EXAM_SIZE=10）: 30 seed で、q14 を除く全設問の stem が「下線部」を含む（100%）。' +
      'buildMockExam は下線に紐づく作品のみを候補にする設計のため（buildCandidatePool）、' +
      'ボスと違い「下線が無い作品」は最初から出題対象にならない。',
    () => {
      let total = 0
      let withUnderline = 0
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
        }
      }
      expect(withUnderline, `${withUnderline}/${total} が下線部を含む`).toBe(total)
      console.log('[M2e-02] 模試(10問) stem 下線部含有率:', `${withUnderline}/${total}`)
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
    // buildStageQuestions は面の対象作品全件が下線に紐づくとは限らない設計のため、当初は100%を
    // 求めていなかった（BOARD.md M2e-02 の合格ラインもボス・模試のみを対象）。M2e-07（全15
    // ワールドの下線増補、2026-09-10 実測）で playableWorks（画像あり作品）側の覆え率が
    // 全era・全difficulty・全segmentで実測100%に達したため（stemCoverage.realdata.test.ts
    // 実行時に検証済み: 1800問中standalone 0件）、「面に単独問題が混ざる」という当初の前提は
    // 現状のデータでは成立しなくなった。これはM2e-07の目標超過達成であり退行ではないため、
    // sawStandalone の期待は外す（コード上の後方互換パス自体は次のブロックで確認する）。
    let sawUnderline = false
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
        }
      }
    }
    expect(sawUnderline).toBe(true)

    // passages 省略時（既存呼び出し・後方互換）は全問が単独問題になる（下線部を含まない）。
    let anyUnderlineWithoutPassages = false
    for (const era of reviewedEras.slice(0, 3)) {
      const qs = buildStageQuestions(era.id, 1, 1, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(1))
      if (qs.some((q) => q.stem?.includes('下線部'))) anyUnderlineWithoutPassages = true
    }
    expect(anyUnderlineWithoutPassages).toBe(false)
  })
})

/** era ごとに「passages の下線が実際にカバーしている作品 id」の集合（上の coveredWorkIdsByEra と
 *  同じロジック。M2e-99 差し戻し以降、themeSetPool を分母にするのが正しい定義）。 */
function coveredWorkIdsInThemeSetPoolByEra(eraId: string): Set<string> {
  const availableIds = new Set(reviewedThemeSetPool.map((w) => w.id))
  const covered = new Set<string>()
  for (const passage of reviewedPassages.filter((p) => p.era === eraId)) {
    for (const underline of passage.underlines) {
      const id = pickThemeTargetId(underline, passage, availableIds)
      if (id) covered.add(id)
    }
  }
  return covered
}

describe('M2e-07 受け入れ: themeSetPool 分母の覆え率60%以上・ボス単独問題比率40%以下（恒久テスト）', () => {
  it('全15ワールドで覆え率>=60%・単独問題比率<=40%（20 seed実測）', () => {
    const SEEDS = 20
    const rows: { era: string; coverageRate: number; standaloneRate: number }[] = []
    for (const era of reviewedEras) {
      const poolWorks = reviewedThemeSetPool.filter((w) => w.era === era.id)
      const covered = coveredWorkIdsInThemeSetPoolByEra(era.id)
      const coverageRate = poolWorks.length > 0 ? covered.size / poolWorks.length : 0
      let total = 0
      let standalone = 0
      for (let seed = 0; seed < SEEDS; seed++) {
        const qs = buildBossQuestions(era.id, reviewedPassages, reviewedThemeSetPool, reviewedPlayableWorks, reviewedEras, seededRandom(seed))
        for (const q of qs) {
          if (q.type === 'q14') continue
          total++
          if (!covered.has(q.work.id)) standalone++
        }
      }
      rows.push({ era: era.id, coverageRate, standaloneRate: total > 0 ? standalone / total : 0 })
    }
    rows.sort((a, b) => a.coverageRate - b.coverageRate)
    // eslint-disable-next-line no-console
    console.log(
      '[M2e-07実測]\n' +
        rows.map((r) => `${r.era}: 覆え率=${(r.coverageRate * 100).toFixed(1)}% 単独問題比率=${(r.standaloneRate * 100).toFixed(1)}%`).join('\n'),
    )
    const failing = rows.filter((r) => r.coverageRate < 0.6 || r.standaloneRate > 0.4)
    expect(failing, JSON.stringify(failing, null, 2)).toEqual([])
  })
})
