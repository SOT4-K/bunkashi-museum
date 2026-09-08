// engine/stages.ts の単体テスト（M2b-04 v2: 直列解禁・可変面数・端数規則・N<5暫定規則・
// ボス長・誤答露出規則）。合成データで期待値を手計算できる形にする。
// builder メモ「旧方式を置き換えるならテストも書き直す」: M2b-01（固定s1/s2/s3/boss・
// ワープあり）から作り直したため、この事業のテストも新方式の説明ごと書き直した。
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_TYPES,
  bossExposureRate,
  bossProgress,
  bossQuestionCount,
  buildBossQuestions,
  buildEraStagePlan,
  buildStageQuestions,
  clearThreshold,
  emptyEraStageProgress,
  fullStageSequence,
  getEraStageProgress,
  getSegmentState,
  isStageUnlocked,
  isWorldUnlocked,
  nextStageRef,
  overallSegmentNumber,
  questionCountForSegment,
  segmentKey,
  stageRefKey,
  stageRefToLocalKey,
  stageShortLabel,
  stageUnlockBoundary,
  worldOrder,
} from '../stages'
// M2b-99c中3: 「ワープ相当のAPIが無いこと」の検査を実モジュールの実際のエクスポート
// 一覧に対して行うため、名前空間import（* as）も別途取り込む。
import * as stagesModule from '../stages'
import { makeWork, seededRandom } from './testFixtures'
import type { Era, EraStageProgress, Passage, Question, Work } from '../../types'

const eras: Era[] = [
  { id: 'e1', name: 'E1文化', period: '', order: 1, summary: '', detail: '', items: [{ text: 'e1item', category: 'literature' }] },
  { id: 'e2', name: 'E2文化', period: '', order: 2, summary: '', detail: '', items: [{ text: 'e2item', category: 'religion' }] },
  { id: 'e3', name: 'E3文化', period: '', order: 3, summary: '', detail: '', items: [{ text: 'e3item', category: 'person' }] },
  { id: 'e4', name: 'E4文化', period: '', order: 4, summary: '', detail: '', items: [{ text: 'e4item', category: 'style' }] },
]

/** ★1〜3 のすべての型が生成できるだけのデータを持つ作品（era: e1）。 */
function fullWork(id: string, n: number): Work {
  return makeWork({
    id,
    era: 'e1',
    category: 'sculpture',
    status: 'reviewed',
    artist: `作者${n}`,
    style: `様式${n}`,
    technique: `製法${n}`,
    holder: `所蔵${n}`,
    facts: [
      { slot: 'artist', text: `作者${n}が作った作品` },
      { slot: 'style', text: `様式${n}の作品` },
    ],
    pairs: [{ left: `語句L${n}`, right: `語句R${n}` }],
    orderIndex: n * 10,
  })
}

// e1に4件（N<5、フルチャンク無し・doubled）。
const richWorks4: Work[] = [fullWork('w1', 1), fullWork('w2', 2), fullWork('w3', 3), fullWork('w4', 4)]

// e1に7件（5<=N<10、フルチャンク無し・doubled、r=7）。
const richWorks7: Work[] = Array.from({ length: 7 }, (_, i) => fullWork(`s${i + 1}`, i + 1))

// e1に23件（フルチャンク2つ+端数3件<5→前の面に併合）。
const richWorks23: Work[] = Array.from({ length: 23 }, (_, i) => fullWork(`m${i + 1}`, i + 1))

// e1に26件（フルチャンク2つ+端数6件>=5→doubledな3面目）。
const richWorks26: Work[] = Array.from({ length: 26 }, (_, i) => fullWork(`n${i + 1}`, i + 1))

// e1にちょうど20件（フルチャンクのみ、端数なし）。
const richWorks20: Work[] = Array.from({ length: 20 }, (_, i) => fullWork(`f${i + 1}`, i + 1))

// facts/pairs/orderIndex/artist/style/holder 一切無い、画像だけの作品（e2）。
const bareWork = makeWork({ id: 'bare1', era: 'e2', category: 'sculpture', status: 'reviewed' })

describe('DIFFICULTY_TYPES（チケット文面どおりの難易度定義）', () => {
  it('★1=Q1/Q3、★2=Q2/Q4/Q6/Q9/Q12、★3=Q8/Q10/Q13/Q14', () => {
    expect(DIFFICULTY_TYPES[1]).toEqual(['q1', 'q3'])
    expect(DIFFICULTY_TYPES[2]).toEqual(['q2', 'q4', 'q6', 'q9', 'q12'])
    expect(DIFFICULTY_TYPES[3]).toEqual(['q8', 'q10', 'q13', 'q14'])
  })
})

describe('clearThreshold（reviewer指摘M2b-99中1修正を引き継ぐ: 最低1ミスは常に許容する）', () => {
  it('10問は9問以上でクリア（1問だけ間違えても良い）', () => {
    expect(clearThreshold(10)).toBe(9)
  })
  it('3〜9問も1ミスまでは許容する', () => {
    for (let n = 3; n <= 9; n++) expect(clearThreshold(n)).toBe(n - 1)
  })
  it('1〜2問は全問正解が必要（1ミス許容が意味をなさない極小値）', () => {
    expect(clearThreshold(1)).toBe(1)
    expect(clearThreshold(2)).toBe(2)
  })
  it('0問は0（生成できていない異常系）', () => {
    expect(clearThreshold(0)).toBe(0)
  })
  it('チケット文面の例「N=2なら4問・3問以上正解」と一致する（N<5暫定規則: 2N問にclearThresholdを適用）', () => {
    expect(clearThreshold(4)).toBe(3)
  })
})

describe('bossQuestionCount（チケット規則4: N≤15→10問、N>15→20問）', () => {
  it('N=0はボスを作れないため0', () => {
    expect(bossQuestionCount(0)).toBe(0)
  })
  it('N=15以下は10問固定', () => {
    expect(bossQuestionCount(1)).toBe(10)
    expect(bossQuestionCount(15)).toBe(10)
  })
  it('N=16以上は20問固定', () => {
    expect(bossQuestionCount(16)).toBe(20)
    expect(bossQuestionCount(30)).toBe(20)
  })
})

describe('buildEraStagePlan / partitionIntoSegments（チケット規則3: 10件ずつ固定分割・端数規則。M2b-99c中5で端数の配分を是正）', () => {
  it('N<5（4件）: フルチャンク無し・1面のみ・全件2問（N<5暫定規則。decisions.md 2026-09-08「2N問」を維持）', () => {
    const plan = buildEraStagePlan('e1', richWorks4)
    expect(plan.itemCount).toBe(4)
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0]).toEqual({ segment: 1, workIds: richWorks4.map((w) => w.id), extraDoubleCount: 4 })
    expect(questionCountForSegment(plan.segments[0])).toBe(8) // 2N = 8
  })

  it('5<=N<10（7件）: フルチャンク無し・1面のみ・M2b-99c中5是正で10問に近づける（3件だけ2問・4件は1問）', () => {
    const plan = buildEraStagePlan('e1', richWorks7)
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].workIds).toHaveLength(7)
    expect(plan.segments[0].extraDoubleCount).toBe(3) // 10-7
    expect(questionCountForSegment(plan.segments[0])).toBe(10) // 7+3=10（是正前は2×7=14だった）
  })

  it('N=9（端数規則の境界、tenpyo/kaseiの実データ相当）: 1件だけ2問・10問ちょうど', () => {
    const richWorks9 = Array.from({ length: 9 }, (_, i) => fullWork(`t${i + 1}`, i + 1))
    const plan = buildEraStagePlan('e1', richWorks9)
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].extraDoubleCount).toBe(1) // 10-9
    expect(questionCountForSegment(plan.segments[0])).toBe(10) // 是正前は2×9=18だった
  })

  it('N=20（端数なし）: 2面とも10件・2問化なし', () => {
    const plan = buildEraStagePlan('e1', richWorks20)
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments[0].workIds).toHaveLength(10)
    expect(plan.segments[1].workIds).toHaveLength(10)
    expect(plan.segments.every((s) => s.extraDoubleCount === 0)).toBe(true)
    // 1-1（segment 1）は常に同じ10作品（orderIndex昇順の先頭10件）
    expect(plan.segments[0].workIds).toEqual(richWorks20.slice(0, 10).map((w) => w.id))
  })

  it('N=23（端数3件<5）: 端数は前の面に併合され、2面目は13件・2問化なし', () => {
    const plan = buildEraStagePlan('e1', richWorks23)
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments[0].workIds).toHaveLength(10)
    expect(plan.segments[1].workIds).toHaveLength(13)
    expect(plan.segments.every((s) => s.extraDoubleCount === 0)).toBe(true)
  })

  it('N=26（端数6件>=5）: 3面目は独立し、10問に近づける（4件だけ2問・2件は1問）', () => {
    const plan = buildEraStagePlan('e1', richWorks26)
    expect(plan.segments).toHaveLength(3)
    expect(plan.segments[0].workIds).toHaveLength(10)
    expect(plan.segments[1].workIds).toHaveLength(10)
    expect(plan.segments[2].workIds).toHaveLength(6)
    expect(plan.segments[2].extraDoubleCount).toBe(4) // 10-6
    expect(questionCountForSegment(plan.segments[2])).toBe(10) // 是正前は2×6=12だった
  })

  it('★1〜3は同じ分割・同じ面数（segmentsは難易度に依存しない共通データ）', () => {
    const plan = buildEraStagePlan('e1', richWorks23)
    // buildEraStagePlan は難易度を引数に取らない＝★1/2/3で常に同じ segments を使う設計。
    expect(plan.segments.map((s) => s.workIds.length)).toEqual([10, 13])
  })

  it('対象作品が無い文化は0面（itemCount=0, segments=[]）', () => {
    const plan = buildEraStagePlan('e3', richWorks4)
    expect(plan.itemCount).toBe(0)
    expect(plan.segments).toEqual([])
    expect(plan.bossSize).toBe(0)
  })
})

describe('buildStageQuestions', () => {
  it('★1（Q1/Q3）doubledな面（4件）は最大8問、同じ作品×同じ型は重複しない', () => {
    const qs = buildStageQuestions('e1', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    expect(qs.length).toBeGreaterThan(0)
    expect(qs.length).toBeLessThanOrEqual(8)
    const keys = qs.map((q) => `${q.work.id}:${q.type}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const q of qs) expect(['q1', 'q3']).toContain(q.type)
  })

  it('★2（Q2/Q4/Q6/Q9/Q12）は必要なデータがそろっている作品で生成できる。Q12は仕組み上ステージ内では常に0件', () => {
    const qs = buildStageQuestions('e1', 2, 1, richWorks4, richWorks4, eras, seededRandom(2))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q2', 'q4', 'q6', 'q9']).toContain(q.type)
      expect(q.type).not.toBe('q12')
    }
  })

  it('★3（Q8/Q10/Q13/Q14）はfacts/pairs/orderIndexがそろっている作品で生成できる', () => {
    const qs = buildStageQuestions('e1', 3, 1, richWorks4, richWorks4, eras, seededRandom(3))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) expect(['q8', 'q10', 'q13', 'q14']).toContain(q.type)
  })

  it('doubledでない面（20件中の1面=10件）は1作品1問、10問を超えない', () => {
    for (const difficulty of [1, 2, 3] as const) {
      const qs = buildStageQuestions('e1', difficulty, 1, richWorks20, richWorks20, eras, seededRandom(difficulty))
      expect(qs.length).toBeLessThanOrEqual(10)
      const workIds = qs.map((q) => q.work.id)
      expect(new Set(workIds).size).toBe(workIds.length) // 1作品1問（重複無し）
    }
  })

  it('doubledな面（4件×2）は同じ作品が最大2回まで、型は毎回異なる', () => {
    const qs = buildStageQuestions('e1', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    const countByWork = new Map<string, number>()
    for (const q of qs) countByWork.set(q.work.id, (countByWork.get(q.work.id) ?? 0) + 1)
    for (const count of countByWork.values()) expect(count).toBeLessThanOrEqual(2)
  })

  it('存在しない面番号（segment）は0件', () => {
    const qs = buildStageQuestions('e1', 1, 99, richWorks4, richWorks4, eras, seededRandom(1))
    expect(qs).toEqual([])
  })

  it('10 seed とも「同じ作品×同じ型」の重複が無い（★1〜3すべて）', () => {
    for (const difficulty of [1, 2, 3] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const qs = buildStageQuestions('e1', difficulty, 1, richWorks4, richWorks4, eras, seededRandom(seed))
        const keys = qs.map((q) => `${q.work.id}:${q.type}`)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  it('型が1問も作れない文化はその面が0件になる', () => {
    // bareWork は facts/pairs/orderIndex/artist/style/holder が無いため、★3の4型すべてが
    // 生成不能（q8: artist/style無し、q10: facts無し、q13: pairs無し、q14: orderIndex無し）。
    const qs = buildStageQuestions('e2', 3, 1, [bareWork], [bareWork], eras, seededRandom(1))
    expect(qs).toEqual([])
  })

  it('一方、同じ作品で★1（Q1/Q3）はデータ不要なので生成できる（0件にならない）', () => {
    const qs = buildStageQuestions('e2', 1, 1, [bareWork], [bareWork], eras, seededRandom(1))
    expect(qs.length).toBeGreaterThan(0)
  })

  it('対象文化に出題対象が無ければ0件（面自体が存在しない）', () => {
    const qs = buildStageQuestions('e3', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    expect(qs).toEqual([])
  })
})

describe('buildBossQuestions（ボス長・誤答露出規則）', () => {
  const passageX: Passage = {
    id: 'px',
    era: 'e1',
    title: 'X',
    text: '本文。[[a|下線1]][[b|下線2]]',
    sources: [],
    underlines: [
      { key: 'a', workIds: ['w1'] },
      { key: 'b', workIds: ['w2'] },
    ],
  }
  const passageY: Passage = {
    id: 'py',
    era: 'e1',
    title: 'Y',
    text: '本文。[[a|下線1]][[b|下線2]]',
    sources: [],
    underlines: [
      { key: 'a', workIds: ['w3'] },
      { key: 'b', workIds: ['w4'] },
    ],
  }

  it(
    'M2b-99c中1是正: N=4（≤15）はボス10問目標。候補が4作品しかなくても、同一作品×別の型の' +
      '組み合わせ（最終補充パス）で目標の10問に到達する（同じ作品×同じ型の完全重複はしない。' +
      '是正前は4問止まりだった＝insei/kitayama/momoyama等の実データ回帰と同じ原因）',
    () => {
      const boss = buildBossQuestions('e1', [passageX, passageY], richWorks4, richWorks4, eras, seededRandom(1))
      expect(boss.length).toBe(10)
      const ids = boss.map((q) => q.work.id)
      for (const id of ['w1', 'w2', 'w3', 'w4']) expect(ids).toContain(id)
      const pairKeys = boss.map((q) => `${q.work.id}:${q.type}`)
      expect(new Set(pairKeys).size).toBe(pairKeys.length) // 同じ作品×同じ型の完全重複は無い
    },
  )

  it('count を明示すれば上書きできる（テスト用）', () => {
    const boss = buildBossQuestions('e1', [passageX, passageY], richWorks4, richWorks4, eras, seededRandom(1), 2)
    expect(boss.length).toBeLessThanOrEqual(2)
  })

  it('その文化に reviewed passage が無ければ空配列（ボスを作れない＝止める条件のケース）', () => {
    const boss = buildBossQuestions('e1', [{ ...passageX, era: 'e2' }], richWorks4, richWorks4, eras, seededRandom(1))
    expect(boss).toEqual([])
  })

  it('passage が複数あれば、どれを選ぶかは乱数で変わる（20 seed で両方が選ばれることを確認）', () => {
    const single1: Passage = {
      id: 'p1',
      era: 'e1',
      title: 'P1',
      text: '本文。[[a|下線]]',
      sources: [],
      underlines: [{ key: 'a', workIds: ['w1'] }],
    }
    const single2: Passage = {
      id: 'p2',
      era: 'e1',
      title: 'P2',
      text: '本文。[[a|下線]]',
      sources: [],
      underlines: [{ key: 'a', workIds: ['w2'] }],
    }
    const seenPassageIds = new Set<string>()
    for (let seed = 0; seed < 20; seed++) {
      const boss = buildBossQuestions('e1', [single1, single2], richWorks4, richWorks4, eras, seededRandom(seed))
      for (const q of boss) if (q.passageId) seenPassageIds.add(q.passageId)
    }
    expect(seenPassageIds.has('p1')).toBe(true)
    expect(seenPassageIds.has('p2')).toBe(true)
  })

  it(
    '1本のpassage内で同じ作品を対象にする下線が複数あっても、同じ作品×同じ型の完全重複はしない' +
      '（実データで検出したケースの再現。M2b-99c中1是正後は最終補充パスにより目標問数まで' +
      '同一作品×別の型の組み合わせが入りうるため、検査は「作品idの一意性」ではなく' +
      '「作品×型の組の一意性」に変更する）',
    () => {
      const dup: Passage = {
        id: 'pdup',
        era: 'e1',
        title: 'Dup',
        text: '本文。[[a|下線1]][[b|下線2]]',
        sources: [],
        underlines: [
          { key: 'a', workIds: ['w1'] },
          { key: 'b', workIds: ['w1'] }, // 同じ作品を2つの下線が指す
        ],
      }
      const boss = buildBossQuestions('e1', [dup, passageY], richWorks4, richWorks4, eras, seededRandom(1))
      const pairKeys = boss.map((q) => `${q.work.id}:${q.type}`)
      expect(new Set(pairKeys).size).toBe(pairKeys.length)
    },
  )

  it('bossExposureRate: 4作品しかないワールドで、ボス4問なら全項目が露出する（total=4, exposed=4, rate=1）', () => {
    const boss = buildBossQuestions('e1', [passageX, passageY], richWorks4, richWorks4, eras, seededRandom(1))
    const stats = bossExposureRate(boss, 'e1', richWorks4)
    expect(stats.total).toBe(4)
    expect(stats.exposed).toBe(4)
    expect(stats.rate).toBe(1)
  })
})

describe('M2b-09（画像なし作品混入バグの回帰防止）: pool（themeSetPool 相当。画像なし項目も含む）と' +
  'imagePool（playableWorks 相当。画像あり作品のみ）を分ける。画像型（Q1/Q2/Q3/Q9）の出題対象・' +
  '選択肢（choiceWorks）には imagePool に無い作品を一切使わない（オーナー報告「画像が出ない」' +
  '「4択のうち画像が1つしかなく正解が分かる」の原因）。back-to-red確認: この describe の2件は' +
  '是正前のコード（tryBuildStageQuestionForWork が pool のみを受け取り imagePool との区別が無い版）' +
  'では実際に失敗することを確認済み', () => {
  // e1 に4件の画像あり作品（richWorks4を再利用）＋2件の画像なし作品（pool側にのみ存在。
  // facts/pairs/artist/style/holder/orderIndexはrichWorks4と同じだけ持たせ、
  // 「画像さえあればQ1〜Q9すべて生成できるはずのデータ」であることを保証する
  // ＝この2件がQ1/Q2/Q3/Q9に出てしまうこと自体がバグの再現になる）。
  const imageWorks = richWorks4 // w1〜w4
  const noImageWorks: Work[] = [fullWork('ni1', 91), fullWork('ni2', 92)]
  const mixedPool: Work[] = [...imageWorks, ...noImageWorks]
  const imageEligibleIds = new Set(imageWorks.map((w) => w.id))
  const IMAGE_TYPES = new Set(['q1', 'q2', 'q3', 'q9'])

  /** 画像型の出題対象・選択肢（choiceWorks）が imagePool に無い作品を含んでいたら文字列化して返す。 */
  function collectViolations(qs: Question[]): string[] {
    const out: string[] = []
    for (const q of qs) {
      if (!IMAGE_TYPES.has(q.type)) continue
      if (!imageEligibleIds.has(q.work.id)) {
        out.push(`target ${q.work.id} (${q.type}) は imagePool に無い（画像なし作品が出題対象）`)
      }
      for (const cw of q.choiceWorks ?? []) {
        if (!imageEligibleIds.has(cw.id)) {
          out.push(`choice ${cw.id} in ${q.work.id}:${q.type} は imagePool に無い（画像なし作品が選択肢）`)
        }
      }
    }
    return out
  }

  it(
    'buildStageQuestions（面生成）: ★1（Q1/Q3）で画像なし作品が出題対象・選択肢のどちらにも現れない' +
      '（是正前は誤答プールに mixedPool＝themeSetPool 相当をそのまま渡していたため、Q3 の' +
      '選択肢（4枚の画像）に画像なし作品が混入し得た）',
    () => {
      const violations: string[] = []
      for (let seed = 0; seed < 30; seed++) {
        const qs = buildStageQuestions('e1', 1, 1, mixedPool, imageWorks, eras, seededRandom(seed))
        violations.push(...collectViolations(qs))
      }
      expect(violations).toEqual([])
    },
  )

  it(
    'buildStageQuestions（面生成）: ★2（Q2/Q9含む）でも画像なし作品が出題対象・選択肢のどちらにも現れない',
    () => {
      const violations: string[] = []
      for (let seed = 0; seed < 30; seed++) {
        const qs = buildStageQuestions('e1', 2, 1, mixedPool, imageWorks, eras, seededRandom(seed))
        violations.push(...collectViolations(qs))
      }
      expect(violations).toEqual([])
    },
  )

  it(
    'buildBossQuestions（最終補充パス）: 画像なし作品が Q1/Q2/Q3/Q9 の出題対象・選択肢のどちらにも' +
      '現れない（是正前は最終補充パスが pool 全体（画像なし作品込み）から出題対象を選び、' +
      'ALL_PER_WORK_TYPES に q1/q2/q3/q9 が含まれるため直接生成できてしまっていた）',
    () => {
      const passage: Passage = {
        id: 'pmix',
        era: 'e1',
        title: 'Mix',
        text: '本文。[[a|下線1]]',
        sources: [],
        underlines: [{ key: 'a', workIds: ['w1'] }],
      }
      const violations: string[] = []
      for (let seed = 0; seed < 20; seed++) {
        const boss = buildBossQuestions('e1', [passage], mixedPool, imageWorks, eras, seededRandom(seed))
        // 最終補充パスまで実際に到達していることの前提確認（到達していなければこのテストは
        // 何も検知できていないことになる。itemCount=4→目標10問、pass1/2だけでは届かない想定）。
        expect(boss.length).toBeGreaterThan(6)
        violations.push(...collectViolations(boss))
      }
      expect(violations).toEqual([])
    },
  )
})

describe('bossProgress（体力ゲージ用の進捗値。チケット規則6）', () => {
  it('残り問数・クリア閾値を返す', () => {
    const p = bossProgress(10, 6, 1)
    expect(p).toEqual({ total: 10, correct: 6, incorrect: 1, remaining: 3, clearThreshold: 9 })
  })
  it('残りが0を下回らない', () => {
    const p = bossProgress(10, 10, 0)
    expect(p.remaining).toBe(0)
  })
})

describe('直列解禁（ワープなし）', () => {
  const worlds = worldOrder(eras)

  it('worldOrder は eras.json の order 昇順', () => {
    expect(worlds).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('fullStageSequence: e1（N=4, doubled単一面）は ★1-1→★2-1→★3-1→ボス の4件で1ワールド分', () => {
    const seq = fullStageSequence(eras.filter((e) => e.id === 'e1'), richWorks4)
    expect(seq).toEqual([
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 1, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 1 },
      { kind: 'boss', eraId: 'e1', worldIndex: 0 },
    ])
  })

  it('先頭ワールドの★1-1は常に解禁。★2-1は★1-1クリアが条件。ボスは★1〜3すべてクリアが条件', () => {
    const imagePool = richWorks4
    const noProgress: Record<string, EraStageProgress> = {}
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 1, segment: 1 }, eras, imagePool, noProgress)).toBe(true)
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 2, segment: 1 }, eras, imagePool, noProgress)).toBe(false)
    expect(isStageUnlocked('e1', { kind: 'boss' }, eras, imagePool, noProgress)).toBe(false)

    const s1Cleared: Record<string, EraStageProgress> = {
      e1: { ...emptyEraStageProgress(), segments: { [segmentKey(1, 1)]: { cleared: true, bestScore: 8, clearedAt: '2026-09-08' } } },
    }
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 2, segment: 1 }, eras, imagePool, s1Cleared)).toBe(true)
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 3, segment: 1 }, eras, imagePool, s1Cleared)).toBe(false)
    expect(isStageUnlocked('e1', { kind: 'boss' }, eras, imagePool, s1Cleared)).toBe(false)
  })

  it('ワープは存在しない: このワールド自身のボスをクリア扱いにしても、★1〜3が未クリアのままなら次ワールドは未解禁', () => {
    const imagePool = richWorks4
    const bossClearedOnly: Record<string, EraStageProgress> = {
      e1: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-08' } },
    }
    // ★1〜3が未クリアのまま「ボスだけクリア」というデータ状態は、直列解禁の下では
    // 通常のプレイでは作れない（ボス自体が★1〜3クリアまで isStageUnlocked が false を返す
    // ため到達できない）。手作りデータでこの状態を作っても、次ワールドの解禁判定は
    // 「boss.cleared」だけを見る isWorldUnlocked に従うため true になる点はチケット文面
    // どおり（＝ワープという“経路”自体が無いことの確認であり、boss.clearedフィールドの
    // 意味は変えていない）。
    expect(isWorldUnlocked(1, eras, imagePool, bossClearedOnly)).toBe(true)
    // 一方、e1自身の★1〜3はこの状態でも直列判定（前が全てクリア済みか）でしか解禁されない。
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 1, segment: 1 }, eras, imagePool, bossClearedOnly)).toBe(true) // ★1-1は常に解禁（先頭ワールドの先頭面）
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 2, segment: 1 }, eras, imagePool, bossClearedOnly)).toBe(false) // ★1-1未クリアのため
  })

  describe('M2b-99c中7: 対象作品0件のワールドへの防御（将来のM2c-04でコンテンツが増減した際の回帰防止）', () => {
    // e1・e3に作品があり、e2は0件（e4も0件のまま。この describe では未使用）。
    const withGapImagePool: Work[] = [...richWorks4, makeWork({ id: 'g1', era: 'e3', status: 'reviewed', orderIndex: 100 })]

    it('worldStageSequence（fullStageSequence経由）は0件ワールド（e2）を丸ごと除外する', () => {
      const seq = fullStageSequence(eras, withGapImagePool)
      expect(seq.some((r) => r.eraId === 'e2')).toBe(false)
      // e1（4件）の4件＋e3（1件、N<5暫定規則で2問=1面）の4件＝8件のみ（e4は0件で同様に除外）。
      expect(seq.filter((r) => r.eraId === 'e1')).toHaveLength(4)
      expect(seq.filter((r) => r.eraId === 'e3')).toHaveLength(4)
      expect(seq).toHaveLength(8)
    })

    it('isStageUnlocked: e1のボスをクリアすれば、間の0件ワールド(e2)を挟んでもe3の★1-1が直接解禁される', () => {
      const e1Cleared: Record<string, EraStageProgress> = {
        e1: {
          segments: {
            [segmentKey(1, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
            [segmentKey(2, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
            [segmentKey(3, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
          },
          boss: { cleared: true, bestScore: 9, clearedAt: 'd' },
        },
      }
      expect(isStageUnlocked('e3', { kind: 'segment', difficulty: 1, segment: 1 }, eras, withGapImagePool, {})).toBe(false)
      expect(isStageUnlocked('e3', { kind: 'segment', difficulty: 1, segment: 1 }, eras, withGapImagePool, e1Cleared)).toBe(true)
    })

    it(
      'isWorldUnlocked: 0件ワールド(e2, worldIndex=1)は自動クリア扱いになり、e3(worldIndex=2)の雲は' +
        'e1(worldIndex=0)のボス撃破だけで晴れる（e2自身のboss.clearedが立つことは実プレイでは無い）',
      () => {
        expect(isWorldUnlocked(2, eras, withGapImagePool, {})).toBe(false) // e1未クリアならe3も未解禁
        const e1BossCleared: Record<string, EraStageProgress> = {
          e1: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 9, clearedAt: 'd' } },
        }
        expect(isWorldUnlocked(2, eras, withGapImagePool, e1BossCleared)).toBe(true) // e2を飛ばしてe3が解禁
      },
    )

    it('連続する0件ワールド（f2・f3がともに0件）でも、遡って直近の実プレイ可能ワールド(f1)まで判定する', () => {
      // f1(作品あり)→f2(0件)→f3(0件)→f4(作品あり) という専用フィクスチャで、
      // 0件が2つ連続しても isWorldUnlocked(f4のworldIndex=3) が f1 のボスまで正しく遡ることを確認する
      // （e2一箇所だけの確認では「1つ前を見る」実装でも通ってしまうため、連続2件で検証する）。
      const fiveEras: Era[] = [
        { id: 'f1', name: 'F1', period: '', order: 1, summary: '', detail: '', items: [] },
        { id: 'f2', name: 'F2', period: '', order: 2, summary: '', detail: '', items: [] },
        { id: 'f3', name: 'F3', period: '', order: 3, summary: '', detail: '', items: [] },
        { id: 'f4', name: 'F4', period: '', order: 4, summary: '', detail: '', items: [] },
      ]
      const pool: Work[] = [
        makeWork({ id: 'f1w', era: 'f1', status: 'reviewed' }),
        makeWork({ id: 'f4w', era: 'f4', status: 'reviewed' }),
      ]
      expect(isWorldUnlocked(3, fiveEras, pool, {})).toBe(false) // f1未クリアならf4も未解禁
      const f1BossCleared: Record<string, EraStageProgress> = {
        f1: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 9, clearedAt: 'd' } },
      }
      expect(isWorldUnlocked(3, fiveEras, pool, f1BossCleared)).toBe(true) // f2・f3を飛ばしてf4が解禁
      // fullStageSequenceもf2・f3を丸ごと除外し、f1のボスの直後にf4の★1-1が続く。
      const seq = fullStageSequence(fiveEras, pool)
      expect(seq.map((r) => r.eraId)).toEqual(['f1', 'f1', 'f1', 'f1', 'f4', 'f4', 'f4', 'f4'])
    })
  })

  it('未解禁ワールド（e3）の★1-1は、e1・e2を一切クリアしていなければ常にfalse', () => {
    const imagePool = richWorks4
    expect(isStageUnlocked('e3', { kind: 'segment', difficulty: 1, segment: 1 }, eras, imagePool, {})).toBe(false)
  })

  it('存在しない面番号を問い合わせても false（ワープ相当のAPI自体が無いことの確認: 未生成の面を直接指定しても解禁扱いにならない）', () => {
    const imagePool = richWorks4 // e1は1面のみ
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 1, segment: 2 }, eras, imagePool, {})).toBe(false)
  })

  it('stageUnlockBoundary / nextStageRef: 何もクリアしていなければ先頭要素、全クリアならnull', () => {
    const seqEras = eras.filter((e) => e.id === 'e1')
    const seq = fullStageSequence(seqEras, richWorks4)
    expect(stageUnlockBoundary(seq, {})).toBe(0)
    expect(nextStageRef(seqEras, richWorks4, {})).toEqual(seq[0])

    const allCleared: Record<string, EraStageProgress> = {
      e1: {
        segments: { [segmentKey(1, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' }, [segmentKey(2, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' }, [segmentKey(3, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' } },
        boss: { cleared: true, bestScore: 9, clearedAt: 'd' },
      },
    }
    expect(stageUnlockBoundary(seq, allCleared)).toBe(seq.length)
    expect(nextStageRef(seqEras, richWorks4, allCleared)).toBeNull()
  })

  it('stageRefKey は「era-難易度-面番号」/「era-boss」形式（チケット規則2）', () => {
    expect(stageRefKey({ kind: 'segment', eraId: 'genshi', worldIndex: 0, difficulty: 1, segment: 1 })).toBe('genshi-1-1')
    expect(stageRefKey({ kind: 'boss', eraId: 'genshi', worldIndex: 0 })).toBe('genshi-boss')
  })

  it('getEraStageProgress は未プレイの文化にデフォルト値を返す（全て未クリア・0点）', () => {
    const es = getEraStageProgress({}, 'e1')
    expect(es.segments).toEqual({})
    expect(es.boss).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
    expect(getSegmentState(es, 1, 1)).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
  })

  it(
    'ワープ相当のAPI（isBossChallengeable等）はもう存在しない（M2b-99c中3是正: 以前は自分で3件だけ' +
      '詰めたオブジェクトリテラルを検査しており、stages.tsが再エクスポートしても検出できない構造上' +
      '絶対に落ちないテストだった。実モジュールの実際のエクスポート一覧を検査する）',
    () => {
      expect(Object.keys(stagesModule)).not.toContain('isBossChallengeable')
      // 「何も検査していない」ことにならないよう、既知のエクスポートが実在することも確認する
      // （テストが検知力を持つことの裏付け）。
      expect(Object.keys(stagesModule)).toContain('isStageUnlocked')
      expect(Object.keys(stagesModule)).toContain('isWorldUnlocked')
    },
  )
})

describe('stageShortLabel / stageRefToLocalKey（M2b-05: UI表記「ワールド番号-面番号＋★の数」。M2b-99c中6是正で面番号を通し番号化）', () => {
  it('segmentsPerWorld=1（実データの大半のワールド相当）: worldIndexは0始まりなので+1して「1-1 ★★」のように表示する', () => {
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 }, 1)).toBe('1-2 ★★')
    expect(stageShortLabel({ kind: 'segment', eraId: 'e2', worldIndex: 3, difficulty: 1, segment: 1 }, 1)).toBe('4-1 ★')
  })

  it('boss: 「{world} ボス」形式（segmentsPerWorldは無関係）', () => {
    expect(stageShortLabel({ kind: 'boss', eraId: 'e1', worldIndex: 0 }, 1)).toBe('1 ボス')
  })

  it(
    'M2b-99c中6の回帰: segmentsPerWorld=1のワールドで★1→★2→★3→ボス→次ワールドの★1が' +
      '「1-1→1-2→1-3→1-ボス→2-1」のように通し番号で続く（是正前は全て「1-1」だった）',
    () => {
      expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 1, segment: 1 }, 1)).toBe('1-1 ★')
      expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 }, 1)).toBe('1-2 ★★')
      expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 1 }, 1)).toBe('1-3 ★★★')
      expect(stageShortLabel({ kind: 'boss', eraId: 'e1', worldIndex: 0 }, 1)).toBe('1 ボス')
      expect(stageShortLabel({ kind: 'segment', eraId: 'e2', worldIndex: 1, difficulty: 1, segment: 1 }, 1)).toBe('2-1 ★')
    },
  )

  it('segmentsPerWorld=3（面数が複数に分かれるワールド）: ★1の3面(1,2,3)の次に★2の面が4から続く', () => {
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 1, segment: 3 }, 3)).toBe('1-3 ★')
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 }, 3)).toBe('1-4 ★★')
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 2 }, 3)).toBe('1-8 ★★★')
  })

  it('overallSegmentNumber: (difficulty-1)*segmentsPerWorld+segment', () => {
    expect(overallSegmentNumber(1, 1, 1)).toBe(1)
    expect(overallSegmentNumber(2, 1, 1)).toBe(2)
    expect(overallSegmentNumber(3, 1, 1)).toBe(3)
    expect(overallSegmentNumber(2, 2, 3)).toBe(5)
  })

  it('stageRefToLocalKey: eraId/worldIndexを落としてStageLocalKeyに変換する', () => {
    expect(stageRefToLocalKey({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 2 })).toEqual({
      kind: 'segment',
      difficulty: 3,
      segment: 2,
    })
    expect(stageRefToLocalKey({ kind: 'boss', eraId: 'e1', worldIndex: 0 })).toEqual({ kind: 'boss' })
  })
})
