// M2-20 → M2-45: 本番モード（大問IV形式10問）。「学習を始める」（旧 randomLearn.ts）を統合し、
// 全15文化・重み付き抽選から出題する（旧仕様「kind: image を除外する」は撤廃）。
import { describe, expect, it } from 'vitest'
import { buildMockExam, discoverableWorks, formatCountdown, MOCK_EXAM_SIZE } from '../mockExam'
import { createInitialProgress } from '../progress'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Passage, Work } from '../../types'

const today = '2026-09-05'
const progress = createInitialProgress(today)

function work(id: string, era: string, extra: Partial<Work> = {}): Work {
  return makeWork({ id, era, category: 'painting', artist: `作者${id}`, ...extra })
}

const pool: Work[] = [
  work('mw1', 'asuka'),
  work('mw2', 'hakuho'),
  work('mw3', 'tenpyo'),
  work('mw4', 'konin-jogan'),
  work('mw5', 'asuka'),
  work('mw6', 'hakuho'),
  work('mw7', 'tenpyo'),
  work('mw8', 'konin-jogan'),
  work('mw9', 'asuka'),
  work('mw10', 'hakuho'),
  work('mw11', 'tenpyo'),
  work('mw12', 'konin-jogan'),
]

function textPassage(id: string, era: string, workIds: string[]): Passage {
  return {
    id,
    era,
    title: `模試用${id}`,
    text: workIds.map((w, i) => `本文${i}。[[u${i}|${w}への言及]]という記述である。`).join(''),
    sources: ['x'],
    underlines: workIds.map((w, i) => ({ key: `u${i}`, workIds: [w] })),
  }
}

const passages: Passage[] = [
  textPassage('mp1', 'asuka', ['mw1', 'mw5', 'mw9']),
  textPassage('mp2', 'hakuho', ['mw2', 'mw6', 'mw10']),
  textPassage('mp3', 'tenpyo', ['mw3', 'mw7', 'mw11']),
  textPassage('mp4', 'konin-jogan', ['mw4', 'mw8', 'mw12']),
]

describe('buildMockExam', () => {
  it('passages が空なら空配列', () => {
    expect(buildMockExam([], pool, pool, testEras, progress, today)).toEqual([])
  })

  it('pool が空なら空配列', () => {
    expect(buildMockExam(passages, [], [], testEras, progress, today)).toEqual([])
  })

  it('候補が十分にあれば MOCK_EXAM_SIZE 問ちょうど作る', () => {
    const items = buildMockExam(passages, pool, pool, testEras, progress, today, seededRandom(1))
    expect(items.length).toBe(MOCK_EXAM_SIZE)
  })

  it('候補が MOCK_EXAM_SIZE 未満なら作れるだけ作る（水増ししない）', () => {
    const small = textPassage('mp-small', 'asuka', ['mw1', 'mw2'])
    const items = buildMockExam([small], pool, pool, testEras, progress, today, seededRandom(1))
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(2)
  })

  it('各問には出題元の passage・eraId・下線抜粋（excerpt）が付く', () => {
    const items = buildMockExam(passages, pool, pool, testEras, progress, today, seededRandom(2))
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      // このフィクスチャの work() は orderIndex を持たないため generateOrderQuestion は常に
      // null を返し、Q14差し替え（passage無し）は発生しない前提。
      if (!item.passage) throw new Error('このテストのフィクスチャでは passage が必ず付くはず')
      expect(item.passage.id).toBeTruthy()
      expect(item.eraId).toBe(item.passage.era)
      expect(item.excerpt.length).toBeGreaterThan(0)
      expect(passages.some((p) => p.id === item.passage?.id)).toBe(true)
    }
  })

  it('下線が無い passage しか無ければ空配列', () => {
    const emptyPassage: Passage = { id: 'empty', era: 'asuka', title: '空', text: '本文のみ。', sources: [], underlines: [] }
    expect(buildMockExam([emptyPassage], pool, pool, testEras, progress, today)).toEqual([])
  })

  it('kind: "image" の passage も対象にする（M2-45: 除外していた旧仕様を撤廃）', () => {
    const imagePassage: Passage = {
      id: 'mp-image',
      era: 'asuka',
      kind: 'image',
      title: '画像リード',
      leadWorkIds: ['mw1'],
      text: '(1)は[[a|作者不明の作]]である。',
      sources: ['x'],
      underlines: [{ key: 'a', ask: { type: 'q4', stem: '(1)について述べた文として最も適切なものはどれか。' } }],
    }
    const items = buildMockExam([imagePassage], pool, pool, testEras, progress, today, seededRandom(3))
    expect(items.length).toBe(1)
    expect(items[0].passage?.kind).toBe('image')
  })

  it('M2-25 の解消: 下線の ask.stem（writer 手書き）をそのまま設問文に使う', () => {
    const passage: Passage = {
      id: 'mp-ask',
      era: 'asuka',
      title: '二段構え',
      text: '本文。[[a|手がかりの記述]]という下線がある。',
      sources: ['x'],
      underlines: [
        {
          key: 'a',
          workIds: ['mw1'],
          ask: { type: 'q9', stem: 'writer手書きの設問文', answerId: 'mw1', distractorIds: ['mw5', 'mw9', 'mw2'] },
        },
      ],
    }
    const items = buildMockExam([passage], pool, pool, testEras, progress, today, seededRandom(4))
    expect(items.length).toBe(1)
    expect(items[0].question.type).toBe('q9')
    expect(items[0].question.stem).toBe('writer手書きの設問文')
  })

  it('SRS の期限が来ている作品は優先されやすい（重み付き抽選が due を反映する）', () => {
    const dueProgress = createInitialProgress(today)
    // mw1 の q1 を「昨日まで」の due にしておく（selectReviewCandidates が拾う）。
    dueProgress.items['mw1'] = {
      q1: { box: 1, due: '2026-09-01', correct: 1, wrong: 0 },
      q2: { box: 0, due: today, correct: 0, wrong: 0 },
      q3: { box: 0, due: today, correct: 0, wrong: 0 },
      discoveredAt: today,
      masteredAt: null,
    }
    let mw1FirstCount = 0
    const trials = 30
    for (let seed = 0; seed < trials; seed++) {
      const items = buildMockExam(passages, pool, pool, testEras, dueProgress, today, seededRandom(seed))
      if (items[0]?.question.work.id === 'mw1') mw1FirstCount++
    }
    // 12件中1件が常に4倍の重みを持つ想定（due bonus）。無ければ 1/12 ≈ 8% 程度のはずなので、
    // 明確に高い比率（目安2割以上）で先頭に来ることを確認する（統計的な目安。決め打ちしすぎない）。
    expect(mw1FirstCount).toBeGreaterThan(trials * 0.15)
  })

  it('reviewer指摘M2-24重大1の回帰: 複数passageが同じ作品を下線に持っていても、2本目のpassageが候補から消えない（以前は必ず消えていた）', () => {
    // 2本目のテーマセット（本番と同じ運用）は1本目と同じ作品を参照することが多い実データを再現。
    const passageA = textPassage('dup-a', 'asuka', ['mw1', 'mw5', 'mw9'])
    const passageB = textPassage('dup-b', 'asuka', ['mw1', 'mw5', 'mw9'])
    let sawFromB = false
    for (let seed = 0; seed < 40 && !sawFromB; seed++) {
      const items = buildMockExam([passageA, passageB], pool, pool, testEras, progress, today, seededRandom(seed))
      if (items.some((i) => i.passage?.id === 'dup-b')) sawFromB = true
    }
    // 修正前は buildCandidatePool が passageA 側で全作品を「使用済み」にしてしまい、
    // passageB の下線が全滅して何回試しても出現しなかった（この assertion が red で再現する）。
    expect(sawFromB).toBe(true)
  })

  it('reviewer指摘M2-24重大1: それでも1回の試験内では同じ作品が2問出ない', () => {
    const passageA = textPassage('dup-a2', 'asuka', ['mw1', 'mw5', 'mw9'])
    const passageB = textPassage('dup-b2', 'asuka', ['mw1', 'mw5', 'mw9'])
    for (let seed = 0; seed < 20; seed++) {
      const items = buildMockExam([passageA, passageB], pool, pool, testEras, progress, today, seededRandom(seed))
      const workIds = items.map((i) => i.question.work.id)
      expect(new Set(workIds).size).toBe(workIds.length)
    }
  })
})

describe('discoverableWorks', () => {
  it('reviewer指摘M2-25⑤の修正: どの下線からも対象にならない作品は含まない', () => {
    // pool には 12 件あるが、passages が下線に持つのは asuka/hakuho/tenpyo/konin-jogan 各3件
    // （全12件）。ここでは一部の作品しか下線に持たない passage だけを渡す。
    const small = textPassage('mp-small', 'asuka', ['mw1', 'mw5'])
    const result = discoverableWorks([small], pool)
    const ids = result.map((w) => w.id).sort()
    expect(ids).toEqual(['mw1', 'mw5'])
    // mw9（同じ asuka だが下線に無い）は含まれない。
    expect(ids).not.toContain('mw9')
  })

  it('全passageを渡せば、下線が対象にする作品を重複なく返す', () => {
    const result = discoverableWorks(passages, pool)
    const ids = result.map((w) => w.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.sort()).toEqual(['mw1', 'mw10', 'mw11', 'mw12', 'mw2', 'mw3', 'mw4', 'mw5', 'mw6', 'mw7', 'mw8', 'mw9'])
  })
})

describe('formatCountdown', () => {
  it('秒数を m:ss に整形する', () => {
    expect(formatCountdown(600)).toBe('10:00')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(5)).toBe('0:05')
  })

  it('負数は 0:00 に丸める', () => {
    expect(formatCountdown(-10)).toBe('0:00')
  })
})
