// engine/stages.ts の単体テスト（M2i ★の定義v4: ★ごとに対象作品を固定分割・リード文なし・
// ボスはwriterのask.stemがある下線だけから3群で作る）。合成データで期待値を手計算できる形にする。
// builder メモ「旧方式を置き換えるならテストも書き直す」: v3（M2e。★1〜3共通の分割・下線起点の
// リード文つき）から作り直したため、この事業のテストも新方式の説明ごと書き直した。
import { describe, expect, it } from 'vitest'
import {
  ALL_DIFFICULTIES,
  DIFFICULTY_TYPES,
  bossExposureRate,
  bossProgress,
  bossQuestionCount,
  buildBossQuestions,
  buildEraStagePlan,
  buildStageQuestions,
  clearThreshold,
  emptyEraStageProgress,
  eraTotalItemCount,
  fullStageSequence,
  isStageUnlocked,
  isWorldUnlocked,
  nextStageRef,
  overallSegmentNumber,
  questionCountForSegment,
  segmentCountsByDifficulty,
  segmentKey,
  stageRefKey,
  stageRefToLocalKey,
  stageShortLabel,
  stageUnlockBoundary,
  worldOrder,
  worldSegmentPlans,
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

// M2i-05d①: location/findSite は q9.ts の新しい意味的包含判定（同じ寺院・遺跡内の別表記を
// 「同じ場所」とみなす、conditionValue同士の共通接頭辞3文字以上）の対象になったため、
// `所在地1`/`所在地2`のように先頭3文字が共通する値を複数作品に使うと、意図せず「全員同じ場所」
// 扱いになり Q9 の location/findSite スロットが誤答を作れず成立しなくなる
// （builder メモ existing-test-fixture-value-can-collide-with-new-broad-term-guard と同種）。
// n ごとに異なるアルファベットを先頭に置き、先頭3文字が常に作品間で異なるようにする。
const LOCATION_PREFIXES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** ★1〜5のすべての型が生成できるだけのデータを持つ作品（era: e1）。 */
function fullWork(id: string, n: number): Work {
  const locationPrefix = LOCATION_PREFIXES[(n - 1) % LOCATION_PREFIXES.length]
  return makeWork({
    id,
    era: 'e1',
    category: 'sculpture',
    status: 'reviewed',
    artist: `作者${n}`,
    findSite: `${locationPrefix}出土地${n}`,
    holder: `所蔵${n}`,
    location: `${locationPrefix}所在地${n}`,
    technique: `製法${n}`,
    style: `様式${n}`,
    subject: `主題${n}`,
    patron: `発願者${n}`,
    religion: `宗派${n}`,
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

// artist/findSite/location/technique/style/pairs 一切無い、画像だけの作品（e2）。
// ★1・★4だけを持ち、★2・★3・★5は持たない（hasStar の判定材料）。
const bareWork = makeWork({ id: 'bare1', era: 'e2', category: 'sculpture', status: 'reviewed' })

describe('DIFFICULTY_TYPES（★の定義v4。M2i-05で★3・★4を修正）', () => {
  it('★1=Q1/Q3、★2=Q5/Q9、★3=Q9/Q7、★4=Q4/Q9/Q8（Q6は模試・ボス専用に）、★5=Q9/Q13/Q10', () => {
    expect(DIFFICULTY_TYPES[1]).toEqual(['q1', 'q3'])
    expect(DIFFICULTY_TYPES[2]).toEqual(['q5', 'q9'])
    expect(DIFFICULTY_TYPES[3]).toEqual(['q9', 'q7'])
    expect(DIFFICULTY_TYPES[4]).toEqual(['q4', 'q9', 'q8'])
    expect(DIFFICULTY_TYPES[5]).toEqual(['q9', 'q13', 'q10'])
  })
  it('ALL_DIFFICULTIES は1〜5', () => {
    expect(ALL_DIFFICULTIES).toEqual([1, 2, 3, 4, 5])
  })
})

describe('clearThreshold（★の定義v4: 10問→8問以上、10問未満→1ミス以内、20問(ボス)→8割）', () => {
  it('10問は8問以上でクリア', () => {
    expect(clearThreshold(10)).toBe(8)
  })
  it('2〜9問は1ミスまで許容（M2i-99 [中]-2で修正: 以前はn<=2が誤って全問正解必須だった）', () => {
    for (let n = 2; n <= 9; n++) expect(clearThreshold(n)).toBe(n - 1)
  })
  it('1問だけは「1ミス許容」が成立しない唯一の例外として全問正解が必要', () => {
    expect(clearThreshold(1)).toBe(1)
  })
  it('0問は0（生成できていない異常系）', () => {
    expect(clearThreshold(0)).toBe(0)
  })
  it('20問（ボス、N>15）は8割=16問以上', () => {
    expect(clearThreshold(20)).toBe(16)
  })
})

describe('bossQuestionCount（N≤15→10問、N>15→20問）', () => {
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

describe('buildEraStagePlan（★ごとの対象作品の固定分割。10件ずつ＋端数規則）', () => {
  it('★1（全件対象）N<5（4件）: フルチャンク無し・1面のみ・全件2問', () => {
    const plan = buildEraStagePlan('e1', 1, richWorks4)
    expect(plan.itemCount).toBe(4)
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0]).toEqual({ segment: 1, workIds: richWorks4.map((w) => w.id), extraDoubleCount: 4 })
    expect(questionCountForSegment(plan.segments[0])).toBe(8) // 2N = 8
  })

  it('5<=N<10（7件）: フルチャンク無し・1面のみ・10問に近づける（3件だけ2問・4件は1問）', () => {
    const plan = buildEraStagePlan('e1', 1, richWorks7)
    expect(plan.segments).toHaveLength(1)
    expect(plan.segments[0].workIds).toHaveLength(7)
    expect(plan.segments[0].extraDoubleCount).toBe(3) // 10-7
    expect(questionCountForSegment(plan.segments[0])).toBe(10)
  })

  it('N=20（端数なし）: 2面とも10件・2問化なし。1面目は常に同じ10作品（orderIndex昇順の先頭10件）', () => {
    const plan = buildEraStagePlan('e1', 1, richWorks20)
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments[0].workIds).toHaveLength(10)
    expect(plan.segments[1].workIds).toHaveLength(10)
    expect(plan.segments.every((s) => s.extraDoubleCount === 0)).toBe(true)
    expect(plan.segments[0].workIds).toEqual(richWorks20.slice(0, 10).map((w) => w.id))
  })

  it('N=23（端数3件<5）: 端数は前の面に併合され、2面目は13件・2問化なし', () => {
    const plan = buildEraStagePlan('e1', 1, richWorks23)
    expect(plan.segments).toHaveLength(2)
    expect(plan.segments[0].workIds).toHaveLength(10)
    expect(plan.segments[1].workIds).toHaveLength(13)
  })

  it('N=26（端数6件>=5）: 3面目は独立し、10問に近づける（4件だけ2問・2件は1問）', () => {
    const plan = buildEraStagePlan('e1', 1, richWorks26)
    expect(plan.segments).toHaveLength(3)
    expect(plan.segments[2].workIds).toHaveLength(6)
    expect(plan.segments[2].extraDoubleCount).toBe(4) // 10-6
    expect(questionCountForSegment(plan.segments[2])).toBe(10)
  })

  it('対象作品が無い文化は0面（itemCount=0, segments=[]）', () => {
    const plan = buildEraStagePlan('e3', 1, richWorks4)
    expect(plan.itemCount).toBe(0)
    expect(plan.segments).toEqual([])
  })

  it('★2（artistを持つ作品のみ）: artistが無い作品は分割対象から外れる', () => {
    const mixed = [...richWorks4, bareWork].filter((w) => w.era === 'e1' || w.id === 'bare1')
    // bareWork は era e2 のため e1 の分割には影響しない（別途 e2 で確認）。
    const plan1 = buildEraStagePlan('e1', 2, richWorks4)
    expect(plan1.itemCount).toBe(4) // richWorks4 は全件 artist あり
    const plan2 = buildEraStagePlan('e2', 2, [bareWork])
    expect(plan2.itemCount).toBe(0) // bareWork は artist が無いため★2の対象外
    void mixed
  })

  it('★3（findSite/locationを持つ作品のみ、博物館は除外）: 何も持たない作品は対象外', () => {
    const plan = buildEraStagePlan('e2', 3, [bareWork])
    expect(plan.itemCount).toBe(0)
    const withFindSite = makeWork({ id: 'fs1', era: 'e2', status: 'reviewed', findSite: '出土地X' })
    expect(buildEraStagePlan('e2', 3, [withFindSite]).itemCount).toBe(1)
    // holderKind: 'museum' の location は★3の対象にしない（博物館は出さない、M2b-14の決定どおり）。
    const museumLocation = makeWork({ id: 'ml1', era: 'e2', status: 'reviewed', holder: '東京国立博物館', holderKind: 'museum', location: '東京国立博物館' })
    expect(buildEraStagePlan('e2', 3, [museumLocation]).itemCount).toBe(0)
    // holderKind: 'site' の location は対象になる。
    const siteLocation = makeWork({ id: 'sl1', era: 'e2', status: 'reviewed', holder: '法隆寺', holderKind: 'site', location: '法隆寺（奈良）' })
    expect(buildEraStagePlan('e2', 3, [siteLocation]).itemCount).toBe(1)
  })

  it('★4（周辺知識）は全件対象（★1と同じ分割になる）', () => {
    expect(buildEraStagePlan('e1', 4, richWorks4).itemCount).toBe(4)
    expect(buildEraStagePlan('e2', 4, [bareWork]).itemCount).toBe(1)
  })

  it('★5（technique/style/pairsのいずれかを持つ作品のみ）: 何も持たない作品は対象外', () => {
    expect(buildEraStagePlan('e2', 5, [bareWork]).itemCount).toBe(0)
    expect(buildEraStagePlan('e1', 5, richWorks4).itemCount).toBe(4)
  })
})

describe('worldSegmentPlans / segmentCountsByDifficulty（0件の★は含まない）', () => {
  it('richWorks4（全★を持つ）は★1〜5すべてが1面ずつ', () => {
    const plans = worldSegmentPlans('e1', richWorks4)
    expect(plans.map((p) => p.difficulty)).toEqual([1, 2, 3, 4, 5])
    const counts = segmentCountsByDifficulty('e1', richWorks4)
    expect(counts).toEqual({ 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 })
  })

  it('bareWork（★1・★4のみ）は★2・3・5が抜ける', () => {
    const plans = worldSegmentPlans('e2', [bareWork])
    expect(plans.map((p) => p.difficulty)).toEqual([1, 4])
    const counts = segmentCountsByDifficulty('e2', [bareWork])
    expect(counts).toEqual({ 1: 1, 4: 1 })
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

  it('★1はリード文を一切使わない（passageId無し、stemは「下線部」を含まない）', () => {
    const qs = buildStageQuestions('e1', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    for (const q of qs) {
      expect(q.passageId).toBeUndefined()
      expect(q.stem?.includes('下線部')).toBe(false)
    }
  })

  it('★2（Q5/Q9）はartistを持つ作品で生成できる。Q9はartistスロット固定', () => {
    const qs = buildStageQuestions('e1', 2, 1, richWorks4, richWorks4, eras, seededRandom(2))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q5', 'q9']).toContain(q.type)
      if (q.type === 'q9') expect(q.q9Slot).toBe('artist')
      if (q.type === 'q5') expect(q.choiceArtists).toHaveLength(4)
    }
  })

  it('★2はartistが無い作品では0件になる', () => {
    const qs = buildStageQuestions('e2', 2, 1, [bareWork], [bareWork], eras, seededRandom(1))
    expect(qs).toEqual([])
  })

  it('★3（Q9/Q7、findSite/locationスロット固定）はfindSite/locationを持つ作品で生成できる', () => {
    const qs = buildStageQuestions('e1', 3, 1, richWorks4, richWorks4, eras, seededRandom(3))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q9', 'q7']).toContain(q.type)
      if (q.type === 'q9') expect(['findSite', 'location']).toContain(q.q9Slot)
      if (q.type === 'q7') expect(q.choiceLocations).toHaveLength(4)
    }
  })

  it('★3はQ9とQ7の両方が出る（doubledな面。同型連続の是正、M2i-05③）', () => {
    const types = new Set<string>()
    for (let seed = 0; seed < 15; seed++) {
      const qs = buildStageQuestions('e1', 3, 1, richWorks4, richWorks4, eras, seededRandom(seed))
      for (const q of qs) types.add(q.type)
    }
    expect(types).toEqual(new Set(['q9', 'q7']))
  })

  it('★4（Q4/Q9/Q8、Q6は含まない。M2i-05①）はfacts/subject等がそろっている作品で生成できる', () => {
    const qs = buildStageQuestions('e1', 4, 1, richWorks4, richWorks4, eras, seededRandom(4))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q4', 'q9', 'q8']).toContain(q.type)
      expect(q.type).not.toBe('q6')
      if (q.type === 'q9') expect(['subject', 'patron', 'religion']).toContain(q.q9Slot)
    }
  })

  it('★5（Q9/Q13/Q10）はtechnique/style/pairs/factsがそろっている作品で生成できる', () => {
    const qs = buildStageQuestions('e1', 5, 1, richWorks4, richWorks4, eras, seededRandom(5))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q9', 'q13', 'q10']).toContain(q.type)
      if (q.type === 'q9') expect(['technique', 'style']).toContain(q.q9Slot)
    }
  })

  it('eraスロット（文化当て）のQ9は★2〜5のどの面でも一度も出ない（30 seed）', () => {
    for (const difficulty of [2, 3, 4, 5] as const) {
      for (let seed = 0; seed < 30; seed++) {
        const qs = buildStageQuestions('e1', difficulty, 1, richWorks20, richWorks20, eras, seededRandom(seed))
        for (const q of qs) expect(q.q9Slot).not.toBe('era')
      }
    }
  })

  it('doubledでない面（20件中の1面=10件）は1作品1問、10問を超えない', () => {
    for (const difficulty of [1, 2, 3, 4, 5] as const) {
      const qs = buildStageQuestions('e1', difficulty, 1, richWorks20, richWorks20, eras, seededRandom(difficulty))
      expect(qs.length).toBeLessThanOrEqual(10)
      const workIds = qs.map((q) => q.work.id)
      expect(new Set(workIds).size).toBe(workIds.length)
    }
  })

  it('doubledな面（4件×2）は同じ作品が最大2回まで、型は毎回異なる', () => {
    const qs = buildStageQuestions('e1', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    const countByWork = new Map<string, number>()
    for (const q of qs) countByWork.set(q.work.id, (countByWork.get(q.work.id) ?? 0) + 1)
    for (const count of countByWork.values()) expect(count).toBeLessThanOrEqual(2)
  })

  it(
    '同じ作品の2回目はできるだけ非隣接にする（best-effort。★1×N=4×2型という最も厳しい条件' +
      '〔8要素中4要素が同じ作品、型はq1/q3の2種類しか無いため型を交互にすると必然的に組合せが' +
      '限られる〕でも、隣接率は無対策（単純シャッフルのみ）の想定よりかなり低く抑えられる）',
    () => {
      let adjacentSameWork = 0
      let totalAdjacentPairs = 0
      for (let seed = 0; seed < 30; seed++) {
        const qs = buildStageQuestions('e1', 1, 1, richWorks4, richWorks4, eras, seededRandom(seed))
        for (let i = 1; i < qs.length; i++) {
          totalAdjacentPairs++
          if (qs[i].work.id === qs[i - 1].work.id) adjacentSameWork++
        }
      }
      // 単純シャッフルのみ（reorderなし）だと8要素中4作品×2回のペアが隣接する期待値は
      // 4/7≈57%程度になる（4組のペアのどれかが隣り合う確率）。reorder適用後の実測は
      // 大幅に下がることだけを回帰として固定する（低確信点: 数学的に0を保証するアルゴリズムでは
      // ない。既存のreorderToAvoidConsecutiveSameType＝engine/themeSet.tsと同じ「best-effort」
      // 思想を踏襲したため。完了報告に明記）。
      expect(adjacentSameWork / totalAdjacentPairs).toBeLessThan(0.15)
    },
  )

  it('存在しない面番号（segment）は0件', () => {
    const qs = buildStageQuestions('e1', 1, 99, richWorks4, richWorks4, eras, seededRandom(1))
    expect(qs).toEqual([])
  })

  it('10 seed とも「同じ作品×同じ型」の重複が無い（★1〜5すべて）', () => {
    for (const difficulty of [1, 2, 3, 4, 5] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const qs = buildStageQuestions('e1', difficulty, 1, richWorks4, richWorks4, eras, seededRandom(seed))
        const keys = qs.map((q) => `${q.work.id}:${q.type}`)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  it('対象文化に出題対象が無ければ0件（面自体が存在しない）', () => {
    const qs = buildStageQuestions('e3', 1, 1, richWorks4, richWorks4, eras, seededRandom(1))
    expect(qs).toEqual([])
  })
})

describe('M2b-09（画像なし作品混入バグの回帰防止）: pool（themeSetPool 相当。画像なし項目も含む）と' +
  'imagePool（playableWorks 相当。画像あり作品のみ）を分ける。画像型（Q1/Q3/Q5/Q7/Q9）の出題対象・' +
  '選択肢（choiceWorks）には imagePool に無い作品を一切使わない', () => {
  const imageWorks = richWorks4
  const noImageWorks: Work[] = [fullWork('ni1', 91), fullWork('ni2', 92)]
  const mixedPool: Work[] = [...imageWorks, ...noImageWorks]
  const imageEligibleIds = new Set(imageWorks.map((w) => w.id))
  const IMAGE_TYPES = new Set(['q1', 'q3', 'q5', 'q7', 'q9'])

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

  it('buildStageQuestions（★1）: 画像なし作品が出題対象・選択肢のどちらにも現れない', () => {
    const violations: string[] = []
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildStageQuestions('e1', 1, 1, mixedPool, imageWorks, eras, seededRandom(seed))
      violations.push(...collectViolations(qs))
    }
    expect(violations).toEqual([])
  })

  it('buildStageQuestions（★2, Q5/Q9含む）でも画像なし作品が出題対象・選択肢のどちらにも現れない', () => {
    const violations: string[] = []
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildStageQuestions('e1', 2, 1, mixedPool, imageWorks, eras, seededRandom(seed))
      violations.push(...collectViolations(qs))
    }
    expect(violations).toEqual([])
  })

  it('buildStageQuestions（★3, Q7/Q9含む）でも画像なし作品が出題対象・選択肢のどちらにも現れない', () => {
    const violations: string[] = []
    for (let seed = 0; seed < 30; seed++) {
      const qs = buildStageQuestions('e1', 3, 1, mixedPool, imageWorks, eras, seededRandom(seed))
      violations.push(...collectViolations(qs))
    }
    expect(violations).toEqual([])
  })
})

describe('buildBossQuestions（3群×リード文。writerのask.stemがある下線だけから作る）', () => {
  const askA = { type: 'q9' as const, stem: '下線部aに該当する作品を選べ。', slot: 'artist' as const }
  const askB = { type: 'q10' as const, stem: '下線部bに関するA・Bの正誤の組合せを選べ。' }
  const askC = { type: 'q4' as const, stem: '下線部cに関する記述として正しいものを選べ。' }
  const askD = { type: 'q13' as const, stem: '下線部dに該当する語句の組合せを選べ。' }

  function passageFor(id: string, works: Work[]): Passage {
    return {
      id,
      era: 'e1',
      title: id,
      text: works.map((_w, i) => `本文${i}[[u${i}|下線${i}]]`).join(''),
      sources: [],
      underlines: works.map((w, i) => ({ key: `u${i}`, workIds: [w.id], ask: [askA, askB, askC, askD][i % 4] })),
    }
  }

  it('ask.stemが無い下線は使われない（汎用文にフォールバックしない）', () => {
    const passage: Passage = {
      id: 'p-nostem',
      era: 'e1',
      title: 'p',
      text: '本文[[u0|下線0]]',
      sources: [],
      underlines: [{ key: 'u0', workIds: ['w1'] }], // ask 自体が無い
    }
    const boss = buildBossQuestions('e1', [passage], richWorks20, richWorks20, eras, seededRandom(1))
    expect(boss).toEqual([])
  })

  it('全問のstemがその下線のask.stemと完全一致する（汎用文が混ざらない）', () => {
    const passage = passageFor('p1', richWorks20.slice(0, 8))
    const boss = buildBossQuestions('e1', [passage], richWorks20, richWorks20, eras, seededRandom(1))
    expect(boss.length).toBeGreaterThan(0)
    for (const q of boss) {
      const idx = Number(q.underlineKey?.replace('u', ''))
      const expectedAsk = [askA, askB, askC, askD][idx % 4]
      expect(q.stem).toBe(expectedAsk.stem)
    }
  })

  it('文化伏せ型（q12「この文化は…」）の下線はボスに一切出ない', () => {
    const hiddenAsk = { type: 'q12' as const, stem: 'この文化について述べているものとして最も適切なものを選べ。', answerText: 'A', distractorTexts: ['B', 'C', 'D'] }
    const passage: Passage = {
      id: 'p-hidden',
      era: 'e1',
      title: 'p',
      text: richWorks20
        .slice(0, 4)
        .map((_, i) => `本文${i}[[u${i}|下線${i}]]`)
        .join(''),
      sources: [],
      underlines: richWorks20.slice(0, 4).map((w, i) => ({ key: `u${i}`, workIds: [w.id], ask: i === 0 ? hiddenAsk : askB })),
    }
    for (let seed = 0; seed < 10; seed++) {
      const boss = buildBossQuestions('e1', [passage], richWorks20, richWorks20, eras, seededRandom(seed))
      expect(boss.some((q) => q.underlineKey === 'u0')).toBe(false)
    }
  })

  it('リード画像に正解画像が含まれるQ9は生成しない（kind: image のpassage）', () => {
    const target = richWorks4[0]
    const passage: Passage = {
      id: 'p-image',
      era: 'e1',
      title: 'p',
      kind: 'image',
      leadWorkIds: [target.id],
      text: `画像の説明[[u0|下線0]]`,
      sources: [],
      underlines: [{ key: 'u0', ask: { type: 'q9', stem: '下線部0の図版を選べ。', answerId: target.id } }],
    }
    const boss = buildBossQuestions('e1', [passage], richWorks4, richWorks4, eras, seededRandom(1))
    expect(boss.some((q) => q.work.id === target.id && q.type === 'q9')).toBe(false)
  })

  it('その文化に passage が無ければ空配列', () => {
    const boss = buildBossQuestions('e1', [], richWorks20, richWorks20, eras, seededRandom(1))
    expect(boss).toEqual([])
  })

  it('count を明示すれば上書きできる（テスト用）', () => {
    const passage = passageFor('p2', richWorks20.slice(0, 8))
    const boss = buildBossQuestions('e1', [passage], richWorks20, richWorks20, eras, seededRandom(1), 3)
    expect(boss.length).toBeLessThanOrEqual(3)
  })

  it('同じ作品×同じ型の完全重複は無い', () => {
    const passage = passageFor('p3', richWorks20.slice(0, 8))
    const boss = buildBossQuestions('e1', [passage], richWorks20, richWorks20, eras, seededRandom(1))
    const pairKeys = boss.map((q) => `${q.work.id}:${q.type}`)
    expect(new Set(pairKeys).size).toBe(pairKeys.length)
  })

  it('bossExposureRate: 実測用ユーティリティが動く（total/exposed/rateを返す）', () => {
    const passage = passageFor('p4', richWorks4)
    const boss = buildBossQuestions('e1', [passage], richWorks4, richWorks4, eras, seededRandom(1))
    const stats = bossExposureRate(boss, 'e1', richWorks4)
    expect(stats.total).toBe(4)
    expect(stats.exposed).toBeGreaterThanOrEqual(0)
    expect(stats.rate).toBeGreaterThanOrEqual(0)
  })
})

describe('bossProgress（体力ゲージ用の進捗値）', () => {
  it('残り問数・クリア閾値を返す', () => {
    const p = bossProgress(10, 6, 1)
    expect(p).toEqual({ total: 10, correct: 6, incorrect: 1, remaining: 3, clearThreshold: 8 })
  })
  it('残りが0を下回らない', () => {
    const p = bossProgress(10, 10, 0)
    expect(p.remaining).toBe(0)
  })
})

describe('直列解禁（ワープなし。0件の★は丸ごと飛ばす）', () => {
  const worlds = worldOrder(eras)

  it('worldOrder は eras.json の order 昇順', () => {
    expect(worlds).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('fullStageSequence: e1（全★を持つ）は ★1-1→★2-1→★3-1→★4-1→★5-1→ボス の6件で1ワールド分', () => {
    const seq = fullStageSequence(eras.filter((e) => e.id === 'e1'), richWorks4)
    expect(seq).toEqual([
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 1, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 4, segment: 1 },
      { kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 5, segment: 1 },
      { kind: 'boss', eraId: 'e1', worldIndex: 0 },
    ])
  })

  it('bareWork（★1・★4のみ）のワールドは★2・3・5を飛ばして ★1-1→★4-1→ボス の3件になる', () => {
    const seq = fullStageSequence(eras.filter((e) => e.id === 'e2'), [bareWork])
    expect(seq).toEqual([
      { kind: 'segment', eraId: 'e2', worldIndex: 0, difficulty: 1, segment: 1 },
      { kind: 'segment', eraId: 'e2', worldIndex: 0, difficulty: 4, segment: 1 },
      { kind: 'boss', eraId: 'e2', worldIndex: 0 },
    ])
  })

  it('先頭ワールドの★1-1は常に解禁。★2-1は★1-1クリアが条件。ボスは全★クリアが条件', () => {
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

  it('対象作品0件のワールド（将来のコンテンツ増減）は面もボスも作れないため丸ごと除外', () => {
    const withGapImagePool: Work[] = [...richWorks4, makeWork({ id: 'g1', era: 'e3', status: 'reviewed', orderIndex: 100 })]
    const seq = fullStageSequence(eras, withGapImagePool)
    expect(seq.some((r) => r.eraId === 'e2')).toBe(false)
    expect(seq.filter((r) => r.eraId === 'e1')).toHaveLength(6)
    // e3（1件、★1・4のみ。findSite/artist/technique等が無いため）: ★1-1→★4-1→ボス の3件。
    expect(seq.filter((r) => r.eraId === 'e3')).toHaveLength(3)
  })

  it('eraTotalItemCount は★を問わない総数を返す（bareWorkはfindSite等を持たなくても1件と数える）', () => {
    expect(eraTotalItemCount('e2', [bareWork])).toBe(1)
    expect(eraTotalItemCount('e1', richWorks4)).toBe(4)
    expect(eraTotalItemCount('e3', richWorks4)).toBe(0)
  })

  it('isWorldUnlocked: 0件ワールドは自動クリア扱いになり、直近の実プレイ可能ワールドまで遡る', () => {
    const withGapImagePool: Work[] = [...richWorks4, makeWork({ id: 'g1', era: 'e3', status: 'reviewed', orderIndex: 100 })]
    expect(isWorldUnlocked(2, eras, withGapImagePool, {})).toBe(false)
    const e1BossCleared: Record<string, EraStageProgress> = {
      e1: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 9, clearedAt: 'd' } },
    }
    expect(isWorldUnlocked(2, eras, withGapImagePool, e1BossCleared)).toBe(true)
  })

  it('存在しない面番号を問い合わせても false（ワープ相当のAPI自体が無いことの確認）', () => {
    const imagePool = richWorks4
    expect(isStageUnlocked('e1', { kind: 'segment', difficulty: 1, segment: 2 }, eras, imagePool, {})).toBe(false)
  })

  it('stageUnlockBoundary / nextStageRef: 何もクリアしていなければ先頭要素、全クリアならnull', () => {
    const seqEras = eras.filter((e) => e.id === 'e1')
    const seq = fullStageSequence(seqEras, richWorks4)
    expect(stageUnlockBoundary(seq, {})).toBe(0)
    expect(nextStageRef(seqEras, richWorks4, {})).toEqual(seq[0])

    const allCleared: Record<string, EraStageProgress> = {
      e1: {
        segments: {
          [segmentKey(1, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
          [segmentKey(2, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
          [segmentKey(3, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
          [segmentKey(4, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
          [segmentKey(5, 1)]: { cleared: true, bestScore: 8, clearedAt: 'd' },
        },
        boss: { cleared: true, bestScore: 9, clearedAt: 'd' },
      },
    }
    expect(stageUnlockBoundary(seq, allCleared)).toBe(seq.length)
    expect(nextStageRef(seqEras, richWorks4, allCleared)).toBeNull()
  })

  it('stageRefKey は「era-難易度-面番号」/「era-boss」形式', () => {
    expect(stageRefKey({ kind: 'segment', eraId: 'genshi', worldIndex: 0, difficulty: 1, segment: 1 })).toBe('genshi-1-1')
    expect(stageRefKey({ kind: 'boss', eraId: 'genshi', worldIndex: 0 })).toBe('genshi-boss')
  })

  it(
    'ワープ相当のAPI（isBossChallengeable等）は存在しない（実モジュールの実際のエクスポート一覧を検査する）',
    () => {
      expect(Object.keys(stagesModule)).not.toContain('isBossChallengeable')
      expect(Object.keys(stagesModule)).toContain('isStageUnlocked')
      expect(Object.keys(stagesModule)).toContain('isWorldUnlocked')
    },
  )
})

describe('overallSegmentNumber / stageShortLabel（★ごとに面数が違うため通し番号は積算する）', () => {
  it('segmentCounts={1:1,2:1,3:1}のとき、★2の1面目は「4」（★1の1面ぶんの次）', () => {
    expect(overallSegmentNumber(2, 1, { 1: 1 })).toBe(2)
    expect(overallSegmentNumber(1, 1, {})).toBe(1)
  })

  it('0件の★（キー自体が無い）はスキップされて積算されない', () => {
    // ★2が0件（キー無し）のワールドで★3の1面目は、★1の面数ぶんだけずれる。
    expect(overallSegmentNumber(3, 1, { 1: 2 })).toBe(3)
  })

  it('stageShortLabel: segment型は「ワールド番号-通し番号 ★の数」、bossは「ワールド番号 ボス」', () => {
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 2, segment: 1 }, { 1: 1 })).toBe('1-2 ★★')
    expect(stageShortLabel({ kind: 'boss', eraId: 'e1', worldIndex: 3 }, {})).toBe('4 ボス')
  })

  it('実データ相当（segmentCountsByDifficulty）と組み合わせて通し番号が1から連番になる', () => {
    const counts = segmentCountsByDifficulty('e1', richWorks4)
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 1, segment: 1 }, counts)).toBe('1-1 ★')
    expect(stageShortLabel({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 5, segment: 1 }, counts)).toBe('1-5 ★★★★★')
  })
})

describe('stageRefToLocalKey', () => {
  it('eraId/worldIndexを落としてStageLocalKeyに変換する', () => {
    expect(stageRefToLocalKey({ kind: 'segment', eraId: 'e1', worldIndex: 0, difficulty: 3, segment: 2 })).toEqual({
      kind: 'segment',
      difficulty: 3,
      segment: 2,
    })
    expect(stageRefToLocalKey({ kind: 'boss', eraId: 'e1', worldIndex: 0 })).toEqual({ kind: 'boss' })
  })
})
