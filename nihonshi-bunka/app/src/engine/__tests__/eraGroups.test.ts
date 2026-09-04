// M2-22: 時代3グループ分け・文化ごとの習熟度/正答率。
import { describe, expect, it } from 'vitest'
import { groupErasByPeriod, cultureStats } from '../eraGroups'
import { createInitialProgress, recordAnswer } from '../progress'
import { makeWork, testEras } from './testFixtures'
import { eras as realEras } from '../../content'
import type { Era } from '../../types'

describe('groupErasByPeriod', () => {
  it('order 1〜6 は古代、7〜10 は中世、11〜15 は近世に分かれる', () => {
    const eras: Era[] = [
      { id: 'e1', name: '一', period: '', order: 1, summary: '', detail: '', items: [] },
      { id: 'e6', name: '六', period: '', order: 6, summary: '', detail: '', items: [] },
      { id: 'e7', name: '七', period: '', order: 7, summary: '', detail: '', items: [] },
      { id: 'e10', name: '十', period: '', order: 10, summary: '', detail: '', items: [] },
      { id: 'e11', name: '十一', period: '', order: 11, summary: '', detail: '', items: [] },
      { id: 'e15', name: '十五', period: '', order: 15, summary: '', detail: '', items: [] },
    ]
    const groups = groupErasByPeriod(eras)
    const kodai = groups.find((g) => g.id === 'kodai')
    const chusei = groups.find((g) => g.id === 'chusei')
    const kinsei = groups.find((g) => g.id === 'kinsei')
    expect(kodai?.eras.map((e) => e.id)).toEqual(['e1', 'e6'])
    expect(chusei?.eras.map((e) => e.id)).toEqual(['e7', 'e10'])
    expect(kinsei?.eras.map((e) => e.id)).toEqual(['e11', 'e15'])
  })

  it('order 順にソートされる（入力順がバラバラでも）', () => {
    const shuffled = [...testEras].reverse()
    const groups = groupErasByPeriod(shuffled)
    const allIds = groups.flatMap((g) => g.eras.map((e) => e.id))
    const sortedIds = [...testEras].sort((a, b) => a.order - b.order).map((e) => e.id)
    expect(allIds).toEqual(sortedIds)
  })

  it('該当する時代が無いグループは出力から除く', () => {
    const onlyKodai: Era[] = [{ id: 'e1', name: '一', period: '', order: 1, summary: '', detail: '', items: [] }]
    const groups = groupErasByPeriod(onlyKodai)
    expect(groups.map((g) => g.id)).toEqual(['kodai'])
  })

  it('実データ（eras.json）は15区分が3グループに過不足なく収まる', () => {
    const groups = groupErasByPeriod(realEras)
    const total = groups.reduce((sum, g) => sum + g.eras.length, 0)
    expect(total).toBe(realEras.length)
    expect(groups.length).toBe(3)
  })
})

describe('cultureStats', () => {
  const era = 'tenpyo'
  const w1 = makeWork({ id: 'cs1', era })
  const w2 = makeWork({ id: 'cs2', era })

  it('出題実績が無ければ accuracyRatio は null、masteryRatio は0', () => {
    const progress = createInitialProgress('2026-09-04')
    const stats = cultureStats(era, [w1, w2], progress)
    expect(stats.total).toBe(2)
    expect(stats.mastered).toBe(0)
    expect(stats.accuracyRatio).toBeNull()
  })

  it('q1/q2/q3 の累計 correct/wrong から正答率を計算する', () => {
    let progress = createInitialProgress('2026-09-04')
    progress = recordAnswer(progress, w1.id, 'q1', 'correct', false, '2026-09-04').state
    progress = recordAnswer(progress, w1.id, 'q1', 'incorrect', false, '2026-09-04').state
    const stats = cultureStats(era, [w1, w2], progress)
    expect(stats.accuracyRatio).toBe(0.5)
  })
})
