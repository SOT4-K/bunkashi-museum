// engine/stages.ts の単体テスト（M2b-01）。合成データで期待値を手計算できる形にする。
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_TYPES,
  STAGE_SIZE_MAX,
  BOSS_SIZE,
  buildBossQuestions,
  buildStageQuestions,
  clearThreshold,
  emptyEraStageState,
  getEraStageState,
  isBossChallengeable,
  isStageUnlocked,
  isWorldUnlocked,
  worldOrder,
} from '../stages'
import { makeWork, seededRandom } from './testFixtures'
import type { Era, EraStageState, Passage, Work } from '../../types'

const eras: Era[] = [
  { id: 'e1', name: 'E1文化', period: '', order: 1, summary: '', detail: '', items: [{ text: 'e1item', category: 'literature' }] },
  { id: 'e2', name: 'E2文化', period: '', order: 2, summary: '', detail: '', items: [{ text: 'e2item', category: 'religion' }] },
  { id: 'e3', name: 'E3文化', period: '', order: 3, summary: '', detail: '', items: [{ text: 'e3item', category: 'person' }] },
  { id: 'e4', name: 'E4文化', period: '', order: 4, summary: '', detail: '', items: [{ text: 'e4item', category: 'style' }] },
]

/** ★1〜3 のすべての型が生成できるだけのデータを持つ作品（era: e1、4件）。 */
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

const richWorks: Work[] = [fullWork('w1', 1), fullWork('w2', 2), fullWork('w3', 3), fullWork('w4', 4)]

// facts/pairs/orderIndex/artist/style/holder 一切無い、画像だけの作品（e2）。
const bareWork = makeWork({ id: 'bare1', era: 'e2', category: 'sculpture', status: 'reviewed' })

describe('DIFFICULTY_TYPES（チケット文面どおりの難易度定義）', () => {
  it('★1=Q1/Q3、★2=Q2/Q4/Q6/Q9/Q12、★3=Q8/Q10/Q13/Q14', () => {
    expect(DIFFICULTY_TYPES[1]).toEqual(['q1', 'q3'])
    expect(DIFFICULTY_TYPES[2]).toEqual(['q2', 'q4', 'q6', 'q9', 'q12'])
    expect(DIFFICULTY_TYPES[3]).toEqual(['q8', 'q10', 'q13', 'q14'])
  })
})

describe('clearThreshold（reviewer指摘M2b-99中1修正: 最低1ミスは常に許容する）', () => {
  it('10問は9問以上でクリア（1問だけ間違えても良い）', () => {
    expect(clearThreshold(10)).toBe(9)
  })
  it('3〜9問も1ミスまでは許容する（旧実装は全問正解必須だった。decisions.md 2026-09-07の意図に合わせた）', () => {
    for (let n = 3; n <= 9; n++) expect(clearThreshold(n)).toBe(n - 1)
  })
  it('1〜2問は全問正解が必要（1ミス許容が意味をなさない極小値）', () => {
    expect(clearThreshold(1)).toBe(1)
    expect(clearThreshold(2)).toBe(2)
  })
  it('0問は0（生成できていない異常系。呼び出し側は0件を「なし」として扱う）', () => {
    expect(clearThreshold(0)).toBe(0)
  })
})

describe('buildStageQuestions', () => {
  it('★1（Q1/Q3）は4作品×2型=最大8問、同じ作品×同じ型は重複しない', () => {
    const qs = buildStageQuestions('e1', 1, richWorks, richWorks, eras, seededRandom(1))
    expect(qs.length).toBeGreaterThan(0)
    expect(qs.length).toBeLessThanOrEqual(8)
    const keys = qs.map((q) => `${q.work.id}:${q.type}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const q of qs) expect(['q1', 'q3']).toContain(q.type)
  })

  it('★2（Q2/Q4/Q6/Q9/Q12）は必要なデータがそろっている作品で生成できる。Q12は仕組み上ステージ内では常に0件', () => {
    const qs = buildStageQuestions('e1', 2, richWorks, richWorks, eras, seededRandom(2))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) {
      expect(['q2', 'q4', 'q6', 'q9']).toContain(q.type)
      expect(q.type).not.toBe('q12')
    }
  })

  it('★3（Q8/Q10/Q13/Q14）はfacts/pairs/orderIndexがそろっている作品で生成できる', () => {
    const qs = buildStageQuestions('e1', 3, richWorks, richWorks, eras, seededRandom(3))
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) expect(['q8', 'q10', 'q13', 'q14']).toContain(q.type)
  })

  it('件数は STAGE_SIZE_MAX（10）を超えない', () => {
    for (const difficulty of [1, 2, 3] as const) {
      const qs = buildStageQuestions('e1', difficulty, richWorks, richWorks, eras, seededRandom(difficulty))
      expect(qs.length).toBeLessThanOrEqual(STAGE_SIZE_MAX)
    }
  })

  it('10 seed とも「同じ作品×同じ型」の重複が無い（★1〜3すべて）', () => {
    for (const difficulty of [1, 2, 3] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const qs = buildStageQuestions('e1', difficulty, richWorks, richWorks, eras, seededRandom(seed))
        const keys = qs.map((q) => `${q.work.id}:${q.type}`)
        expect(new Set(keys).size).toBe(keys.length)
      }
    }
  })

  it('型が1問も作れない文化はその段が0件になる（「なし」判定は呼び出し側が0件で行う）', () => {
    // bareWork は facts/pairs/orderIndex/artist/style/holder が無いため、★3の4型すべてが
    // 生成不能（q8: artist/style無し、q10: facts無し、q13: pairs無し、q14: orderIndex無し）。
    const qs = buildStageQuestions('e2', 3, [bareWork], [bareWork], eras, seededRandom(1))
    expect(qs).toEqual([])
  })

  it('一方、同じ作品で★1（Q1/Q3）はデータ不要なので生成できる（0件にならない）', () => {
    const qs = buildStageQuestions('e2', 1, [bareWork], [bareWork], eras, seededRandom(1))
    expect(qs.length).toBeGreaterThan(0)
  })

  it('対象文化に出題対象が無ければ0件', () => {
    const qs = buildStageQuestions('e3', 1, richWorks, richWorks, eras, seededRandom(1))
    expect(qs).toEqual([])
  })
})

describe('buildBossQuestions', () => {
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

  it('選んだテーマセットで足りない分を、同じ文化の他の passage から補って埋める（型配分は本番どおり）', () => {
    const boss = buildBossQuestions('e1', [passageX, passageY], richWorks, richWorks, eras, seededRandom(1), BOSS_SIZE)
    expect(boss.length).toBe(4) // w1〜w4 の4作品しか候補が無いため、最大でも4問
    const ids = boss.map((q) => q.work.id)
    expect(new Set(ids).size).toBe(4) // 重複しない
    for (const id of ['w1', 'w2', 'w3', 'w4']) expect(ids).toContain(id)
  })

  it('その文化に reviewed passage が無ければ空配列（ボスを作れない＝止める条件のケース）', () => {
    const boss = buildBossQuestions('e1', [{ ...passageX, era: 'e2' }], richWorks, richWorks, eras, seededRandom(1))
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
      const boss = buildBossQuestions('e1', [single1, single2], richWorks, richWorks, eras, seededRandom(seed))
      for (const q of boss) if (q.passageId) seenPassageIds.add(q.passageId)
    }
    expect(seenPassageIds.has('p1')).toBe(true)
    expect(seenPassageIds.has('p2')).toBe(true)
  })

  it('1本のpassage内で同じ作品を対象にする下線が複数あっても、ボスの中で重複しない（実データで検出したケースの再現）', () => {
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
    const boss = buildBossQuestions('e1', [dup, passageY], richWorks, richWorks, eras, seededRandom(1))
    const ids = boss.map((q) => q.work.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('解禁・ワープ（純関数）', () => {
  const worlds = worldOrder(eras)

  it('worldOrder は eras.json の order 昇順', () => {
    expect(worlds).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('ワールド0（e1）は常に解禁。ワールド1（e2）は e1 のボス撃破まで未解禁', () => {
    const stages: Record<string, EraStageState> = {}
    expect(isWorldUnlocked(0, worlds, stages)).toBe(true)
    expect(isWorldUnlocked(1, worlds, stages)).toBe(false)

    const cleared: Record<string, EraStageState> = {
      e1: { ...emptyEraStageState(), boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-07' } },
    }
    expect(isWorldUnlocked(1, worlds, cleared)).toBe(true)
  })

  it('ステージ1は常に解禁（ワールドが解禁されていれば）。ステージ2はステージ1クリアが条件', () => {
    const stages: Record<string, EraStageState> = {}
    expect(isStageUnlocked(0, 1, worlds, stages)).toBe(true)
    expect(isStageUnlocked(0, 2, worlds, stages)).toBe(false)
    expect(isStageUnlocked(0, 3, worlds, stages)).toBe(false)

    const s1Cleared: Record<string, EraStageState> = {
      e1: { ...emptyEraStageState(), s1: { cleared: true, bestScore: 8, clearedAt: '2026-09-07' } },
    }
    expect(isStageUnlocked(0, 2, worlds, s1Cleared)).toBe(true)
    expect(isStageUnlocked(0, 3, worlds, s1Cleared)).toBe(false)
  })

  it('ワープ: ボスを先に撃破すると、そのワールドのステージ1〜3が全て解禁される（未クリアのまま「後から遊べる」）', () => {
    const bossCleared: Record<string, EraStageState> = {
      e1: { ...emptyEraStageState(), boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-07' } },
    }
    expect(isStageUnlocked(0, 1, worlds, bossCleared)).toBe(true)
    expect(isStageUnlocked(0, 2, worlds, bossCleared)).toBe(true)
    expect(isStageUnlocked(0, 3, worlds, bossCleared)).toBe(true)
    // 次のワールド（e2）も解禁される
    expect(isWorldUnlocked(1, worlds, bossCleared)).toBe(true)
  })

  it(
    'reviewer指摘M2b-99重大2の回帰: ワープ先のワールド（直前ワールドのボスは未撃破）自身の' +
      'ボスを先に倒した場合も、そのワールドのステージ1〜3が解禁される。旧実装は' +
      'isWorldUnlocked（直前ワールドのボス撃破）を先に見てしまい、ワープ本来のケース' +
      '（直前ワールドは未クリアのまま）では到達不能だった',
    () => {
      // e3（worldIndex 2）を、e1・e2のボスを一切クリアせずに直接ワープ撃破したケース。
      const warpedFar: Record<string, EraStageState> = {
        e3: { ...emptyEraStageState(), boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-07' } },
      }
      // isWorldUnlocked自体は（直前ワールド未クリアのため）falseのまま——ワープは
      // 「そのワールドの中身」だけを解禁する仕様で、他ワールドの解禁順は変えない。
      expect(isWorldUnlocked(2, worlds, warpedFar)).toBe(false)
      // それでもe3自身のステージ1〜3は、e3のボスを既に撃破しているので解禁される。
      expect(isStageUnlocked(2, 1, worlds, warpedFar)).toBe(true)
      expect(isStageUnlocked(2, 2, worlds, warpedFar)).toBe(true)
      expect(isStageUnlocked(2, 3, worlds, warpedFar)).toBe(true)
      // e3のボスを撃破した効果で次のワールド（e4、worldIndex 3）は正規の順序どおり解禁される
      // （「ボス撃破で次のワールド解禁」は経路を問わない。ワープの効果はe3自身の中身を
      // 開けることだけで、e4の解禁はそれとは別の既存ルールの帰結）。
      expect(isWorldUnlocked(3, worlds, warpedFar)).toBe(true)
      // 一方、間に挟まるe2（worldIndex 1）はe1のボス未撃破のままなので相変わらず未解禁。
      expect(isStageUnlocked(1, 1, worlds, warpedFar)).toBe(false)
    },
  )

  it('ボスは常にワープ挑戦できる（ワールド・ステージの状態を問わない）', () => {
    expect(isBossChallengeable()).toBe(true)
  })

  it('未解禁ワールドのステージは、そのワールドのボスが未クリアなら常に false（ワールド自体が未解禁のため）', () => {
    const stages: Record<string, EraStageState> = {}
    expect(isStageUnlocked(2, 1, worlds, stages)).toBe(false)
  })

  it('getEraStageState は未プレイの文化にデフォルト値を返す（全て未クリア・0点）', () => {
    const es = getEraStageState({}, 'e1')
    expect(es.s1).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
    expect(es.boss).toEqual({ cleared: false, bestScore: 0, clearedAt: null })
  })
})
