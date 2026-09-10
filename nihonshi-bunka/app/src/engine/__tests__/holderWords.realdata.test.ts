// M2b-14「所蔵館を問う設問の削除」受け入れ条件: 全型・全15ワールド・模試（本番モード）を
// 複数 seed で生成し、設問文・選択肢に「博物館」「美術館」等の所蔵語
// （holderKind: 'museum' の館名。scripts/validate-content.mjs の HOLDER_WORDS と同じ語）が
// 0件であることを固定する。reviewedFixtures（DEV フラグに依存しない reviewed 限定プール。
// builder メモ vite-import-meta-env-dev-true-in-vitest.md）を使い、stages.realdata.test.ts と
// 同じ生成経路（buildStageQuestions/buildBossQuestions/buildMockExam）を通す。
//
// 唯一の例外: passages/genroku.json の下線 genroku-01/b・genroku-02/d の ask.stem
// 「（東京国立博物館蔵）」は、同じ図の異なる模本を区別するための作品特定用の記法として
// M2b-14 チケットが明示的に残すことにしたもの（scripts/validate-content.mjs の
// findHolderWords も警告のみでエラーにしていない）。この2件の stem フィールドに限り
// 所蔵語の出現を許可し、それ以外（conditionText・各種選択肢・他の下線の stem）は
// 一切許容しない。
import { describe, expect, it } from 'vitest'
import { ALL_DIFFICULTIES, buildBossQuestions, buildEraStagePlan, buildStageQuestions } from '../stages'
import { buildMockExam } from '../mockExam'
import { createInitialProgress } from '../progress'
import { reviewedEras, reviewedPassages, reviewedPlayableWorks, reviewedThemeSetPool } from './reviewedFixtures'
import { seededRandom } from './testFixtures'
import type { Question } from '../../types'

// scripts/validate-content.mjs の HOLDER_WORDS と同じ語（重複実装。plain .mjs から
// TS を直接 import できないため validateContentChecks.test.ts と同じ理由で複製する）。
const MUSEUM_WORDS = ['博物館', '美術館', '文庫', '記念館', '図書館', '資料館', '尚蔵館', '国宝館', 'コレクション']

function findMuseumWords(text: string): string[] {
  return MUSEUM_WORDS.filter((w) => text.includes(w))
}

// M2b-14 チケットで明示的に許容された唯一の例外（作品の特定用の記法。上記コメント参照）。
const ALLOWED_STEM_EXCEPTIONS = new Set(['genroku-01:b', 'genroku-02:d'])

interface TextSample {
  field: string
  text: string
}

/** Question から実際に画面に表示されるテキストを全て集める（stem・conditionText・各型の選択肢）。
 *  choiceEraItems（Q6）は含めない: Q6 の選択肢は work.holder/facts とは無関係に
 *  eras.json の items[]（その文化の代表事項。文学・宗教・人物・様式・学問など）だけから
 *  作られる（engine/eraItems.ts）。「芸亭（石上宅嗣の図書館）＝奈良時代の公開図書館」のような
 *  正当な歴史事実がたまたま所蔵語と同じ単語（図書館）を含むことがあり、これは M2b-14 が
 *  問題にしている「作品の所蔵先の館名が設問に漏れる」こととは無関係（work の holder/findSite
 *  を一切参照しない出題経路のため、そもそも Q9 の holder ゲートと同じ問題が起きない）。 */
function collectDisplayTexts(q: Question): TextSample[] {
  const out: TextSample[] = []
  if (q.stem) out.push({ field: 'stem', text: q.stem })
  if (q.conditionText) out.push({ field: 'conditionText', text: q.conditionText })
  for (const s of q.choiceStatements ?? []) out.push({ field: 'choiceStatements', text: s.text })
  for (const s of q.choiceQ12 ?? []) out.push({ field: 'choiceQ12', text: s.text })
  for (const s of q.choiceCombos ?? []) out.push({ field: 'choiceCombos', text: s.text })
  if (q.statementPair) {
    out.push({ field: 'statementPair.sentenceA', text: q.statementPair.sentenceA.text })
    out.push({ field: 'statementPair.sentenceB', text: q.statementPair.sentenceB.text })
  }
  for (const s of q.choiceWordPairs ?? []) out.push({ field: 'choiceWordPairs', text: s.text })
  for (const s of q.choiceArtists ?? []) out.push({ field: 'choiceArtists', text: s })
  return out
}

/** 1問の違反（例外を除いた所蔵語出現）を集めて where 付きの文字列にする。空なら違反無し。 */
function checkQuestion(q: Question, where: string): string[] {
  const violations: string[] = []
  const exceptionKey = q.passageId && q.underlineKey ? `${q.passageId}:${q.underlineKey}` : null
  for (const { field, text } of collectDisplayTexts(q)) {
    const words = findMuseumWords(text)
    if (words.length === 0) continue
    if (field === 'stem' && exceptionKey && ALLOWED_STEM_EXCEPTIONS.has(exceptionKey)) continue
    violations.push(`${where}: ${q.type}/${field} に所蔵語（${words.join('、')}）が含まれている（work=${q.work.id}）: "${text}"`)
  }
  return violations
}

describe('M2b-14: 生成された設問文・選択肢に所蔵語（博物館・美術館等）が0件', () => {
  it(
    '全15ワールド×★1〜5×全面×10 seed で、面クリアのQ1〜Q13の生成結果に所蔵語が無い',
    () => {
      const violations: string[] = []
      for (const era of reviewedEras) {
        for (const difficulty of ALL_DIFFICULTIES) {
          const plan = buildEraStagePlan(era.id, difficulty, reviewedPlayableWorks)
          for (const seg of plan.segments) {
            for (let seed = 0; seed < 10; seed++) {
              const qs = buildStageQuestions(
                era.id,
                difficulty,
                seg.segment,
                reviewedThemeSetPool,
                reviewedPlayableWorks,
                reviewedEras,
                seededRandom(seed),
              )
              for (const q of qs) {
                violations.push(...checkQuestion(q, `${era.id}-${difficulty}-${seg.segment}(seed${seed})`))
              }
            }
          }
        }
      }
      expect(violations).toEqual([])
    },
    120000,
  )

  it(
    '全15ワールドのボスを20 seedで生成した結果に所蔵語が無い（テーマセット・ask.stem込み）',
    () => {
      const violations: string[] = []
      for (const era of reviewedEras) {
        for (let seed = 0; seed < 20; seed++) {
          const boss = buildBossQuestions(
            era.id,
            reviewedPassages,
            reviewedThemeSetPool,
            reviewedPlayableWorks,
            reviewedEras,
            seededRandom(seed),
          )
          for (const q of boss) {
            violations.push(...checkQuestion(q, `${era.id}-boss(seed${seed})`))
          }
        }
      }
      expect(violations).toEqual([])
    },
    120000,
  )

  it(
    '模試（本番モード）を100 seedで生成した結果に所蔵語が無い（genroku-01/b・genroku-02/dの' +
      'stemのみ、作品特定用の記法として例外的に許容する。M2b-14チケット明記）',
    () => {
      const today = '2026-09-08'
      const progress = createInitialProgress(today)
      const violations: string[] = []
      let sawAllowedException = false
      for (let seed = 0; seed < 100; seed++) {
        const items = buildMockExam(
          reviewedPassages,
          reviewedThemeSetPool,
          reviewedPlayableWorks,
          reviewedEras,
          progress,
          today,
          seededRandom(seed),
        )
        for (const item of items) {
          const qViolations = checkQuestion(item.question, `mockExam(seed${seed})`)
          violations.push(...qViolations)
          const exceptionKey =
            item.question.passageId && item.question.underlineKey
              ? `${item.question.passageId}:${item.question.underlineKey}`
              : null
          if (exceptionKey && ALLOWED_STEM_EXCEPTIONS.has(exceptionKey)) sawAllowedException = true
        }
      }
      expect(violations).toEqual([])
      // 例外が実際に踏まれること自体は保証しない（模試は重み付き抽選のため100 seedでも
      // 選ばれない場合がある）。踏まれた場合にログへ残すだけ（デバッグ用）。
      if (sawAllowedException) {
        console.log('[M2b-14] 例外stem（genroku-01/b・genroku-02/d）が模試に出題された seed を確認した')
      }
    },
    120000,
  )
})
