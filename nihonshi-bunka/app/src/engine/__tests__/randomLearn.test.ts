// M2-21: ランダム学習（全15文化からの下線プール・10問）。
import { describe, expect, it } from 'vitest'
import { buildRandomLearnSession, RANDOM_LEARN_SESSION_SIZE } from '../randomLearn'
import { createInitialProgress, recordAnswer } from '../progress'
import { makeWork, seededRandom, testEras } from './testFixtures'
import type { Passage, Work } from '../../types'

function work(id: string, era: string, extra: Partial<Work> = {}): Work {
  return makeWork({ id, era, category: 'painting', artist: `作者${id}`, ...extra })
}

const w1 = work('rw1', 'asuka')
const w2 = work('rw2', 'hakuho')
const w3 = work('rw3', 'tenpyo')
const w4 = work('rw4', 'konin-jogan')
const pool: Work[] = [w1, w2, w3, w4]

function passageFor(id: string, era: string, workId: string): Passage {
  return {
    id,
    era,
    title: `テスト${id}`,
    text: `本文の冒頭。[[a|${workId}への言及]]という記述が続く語句である。`,
    sources: ['x'],
    underlines: [{ key: 'a', workIds: [workId] }],
  }
}

const passages: Passage[] = [
  passageFor('p1', 'asuka', w1.id),
  passageFor('p2', 'hakuho', w2.id),
  passageFor('p3', 'tenpyo', w3.id),
  passageFor('p4', 'konin-jogan', w4.id),
]

describe('buildRandomLearnSession', () => {
  it('passages が空なら空配列', () => {
    const progress = createInitialProgress('2026-09-04')
    expect(buildRandomLearnSession([], pool, pool, testEras, progress, '2026-09-04')).toEqual([])
  })

  it('pool が空なら空配列', () => {
    const progress = createInitialProgress('2026-09-04')
    expect(buildRandomLearnSession(passages, [], [], testEras, progress, '2026-09-04')).toEqual([])
  })

  it('候補数を超えない範囲で最大 count 問を組み立てる（対象作品はプール内の一意な作品に限る）', () => {
    const progress = createInitialProgress('2026-09-04')
    const items = buildRandomLearnSession(passages, pool, pool, testEras, progress, '2026-09-04', seededRandom(1), RANDOM_LEARN_SESSION_SIZE)
    expect(items.length).toBeGreaterThan(0)
    expect(items.length).toBeLessThanOrEqual(4) // 候補（=一意な作品）は4件しか無い
    const workIds = items.map((it) => it.question.work.id)
    expect(new Set(workIds).size).toBe(workIds.length) // 重複しない
  })

  it('各問に passageId・underlineKey・excerpt（下線ハイライト含む）が付く', () => {
    const progress = createInitialProgress('2026-09-04')
    const items = buildRandomLearnSession(passages, pool, pool, testEras, progress, '2026-09-04', seededRandom(2))
    for (const item of items) {
      expect(item.passageId).toBeTruthy()
      expect(item.underlineKey).toBe('a')
      expect(item.excerpt.some((seg) => seg.type === 'underline')).toBe(true)
      expect(item.question.passageId).toBe(item.passageId)
      expect(item.question.underlineKey).toBe(item.underlineKey)
    }
  })

  it('図版問題（Q9）が生成可能な状況では最低1問は含まれる', () => {
    const progress = createInitialProgress('2026-09-04')
    // artist を持つ作品が複数あるため Q9 が生成できるはず。複数 seed で確認する（乱数依存のため）。
    for (let seed = 0; seed < 5; seed++) {
      const items = buildRandomLearnSession(passages, pool, pool, testEras, progress, '2026-09-04', seededRandom(seed))
      expect(items.some((it) => it.question.type === 'q9')).toBe(true)
    }
  })

  it('SRS の期限が来ている作品を優先する（極端な重み差で決定的に確認）', () => {
    let progress = createInitialProgress('2026-09-04')
    // rw1 を過去に不正解にして due にする（box=0, due=today のまま）。他は未出題（新規扱い）。
    progress = recordAnswer(progress, w1.id, 'q1', 'incorrect', false, '2026-09-01').state
    // count=1 で複数 seed を回し、rw1 が高頻度で選ばれることを確認する（重みの効果があることの弱いチェック）。
    let rw1Count = 0
    const trials = 20
    for (let seed = 0; seed < trials; seed++) {
      const items = buildRandomLearnSession(passages, pool, pool, testEras, progress, '2026-09-04', seededRandom(seed), 1)
      if (items[0]?.question.work.id === w1.id) rw1Count++
    }
    // 4候補・均等なら期待値は 20/4=5 件。due bonus があれば明確に上回るはず。
    expect(rw1Count).toBeGreaterThan(5)
  })
})
