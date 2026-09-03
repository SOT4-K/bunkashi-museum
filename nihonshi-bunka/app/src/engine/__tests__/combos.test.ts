import { describe, expect, it } from 'vitest'
import { conceptOverlaps, generateComboQuestion } from '../combos'
import { works as realWorks } from '../../content'
import { makeWork, seededRandom } from './testFixtures'

// コーパスが裏づける組合せは誤答に使わない（reviewer 指摘 2026-09-04）ため、
// 誤答候補として成立させたいフィクスチャは概念が重ならない値にしておく。
const target = makeWork({ id: 'target', artist: '葛飾北斎', style: '浮世絵（錦絵・風景画）', technique: '錦絵' })
const sameArtist = makeWork({ id: 'w2', artist: '葛飾北斎', style: '版本（絵手本）' })
const otherArtist1 = makeWork({ id: 'w3', artist: '運慶', style: '寄木造' })
const otherArtist2 = makeWork({ id: 'w4', artist: '雪舟', style: '水墨画' })
const otherArtist3 = makeWork({ id: 'w6', artist: '尾形光琳', style: '琳派' })
const noSlots = makeWork({ id: 'w5' }) // artist/style/religion すべて null（technique はデフォルト空文字）

const pool = [target, sameArtist, otherArtist1, otherArtist2, otherArtist3, noSlots]

describe('generateComboQuestion', () => {
  it('artist も patron も無ければ null（スロット1が取れない）', () => {
    const w = makeWork({ id: 'w', artist: null, patron: null, style: '何か', technique: '何か' })
    expect(generateComboQuestion(w, pool, seededRandom(1))).toBeNull()
  })

  it('style も religion も technique も無ければ null（スロット2が取れない）', () => {
    const w = makeWork({ id: 'w', artist: '誰か', style: null, religion: null, technique: '' })
    expect(generateComboQuestion(w, pool, seededRandom(1))).toBeNull()
  })

  it('patron しか無くても artist の代わりに使える', () => {
    const w = makeWork({ id: 'w', patron: '藤原頼通', style: '寄木造' })
    const others = [
      w,
      makeWork({ id: 'w2', patron: '聖武天皇', style: '塑像' }),
      makeWork({ id: 'w3', patron: '足利義満', style: '水墨画' }),
      makeWork({ id: 'w4', patron: '光明皇后', style: '乾漆' }),
    ]
    const result = generateComboQuestion(w, others, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.correct.text).toBe('藤原頼通・寄木造')
  })

  it('正解は target 自身の値の組合せ', () => {
    const result = generateComboQuestion(target, pool, seededRandom(1))
    expect(result).not.toBeNull()
    expect(result!.correct.text).toBe('葛飾北斎・浮世絵（錦絵・風景画）')
  })

  it('誤答の組合せに正解と同じ文字列は出ない（10 seed）', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateComboQuestion(target, pool, seededRandom(seed))
      expect(result).not.toBeNull()
      for (const d of result!.distractors) {
        expect(d.text).not.toBe(result!.correct.text)
      }
    }
  })

  it('誤答は3件で、互いに重複しない', () => {
    for (let seed = 0; seed < 10; seed++) {
      const result = generateComboQuestion(target, pool, seededRandom(seed))
      expect(result).not.toBeNull()
      expect(result!.distractors).toHaveLength(3)
      const texts = result!.distractors.map((d) => d.text)
      expect(new Set(texts).size).toBe(texts.length)
    }
  })

  it('候補となる他作品が無ければ null', () => {
    const alone = [target]
    expect(generateComboQuestion(target, alone, seededRandom(1))).toBeNull()
  })

  it('候補が少なすぎる（片方のスロットしかずらせない）場合は null', () => {
    // pool2（style候補）が無く、pool1（artist候補）が1件だけ → 単独スワップ1件のみで3件に届かない
    const w = makeWork({ id: 'w', artist: 'A', style: 'S' })
    const onlyOneOther = makeWork({ id: 'w2', artist: 'B', style: 'S' }) // style は同じなので pool2 に入らない
    const result = generateComboQuestion(w, [w, onlyOneOther], seededRandom(1))
    expect(result).toBeNull()
  })
})

describe('コーパスが裏づける組合せは誤答に使わない（reviewer 指摘 2026-09-04）', () => {
  it('conceptOverlaps は 2 文字以上の共通部分で同概念とみなす', () => {
    expect(conceptOverlaps('美人大首絵', '錦絵（美人画）')).toBe(true)
    expect(conceptOverlaps('浮世絵（錦絵・風景画）', '美人大首絵')).toBe(false)
    expect(conceptOverlaps('脱活乾漆像', '乾漆像（肖像彫刻）')).toBe(true)
  })

  it('実データで、生成された誤答の組合せを裏づける作品が存在しない', () => {
    const seeds = [0.05, 0.2, 0.37, 0.51, 0.68, 0.83, 0.96]
    for (const work of realWorks) {
      for (const seed of seeds) {
        const q = generateComboQuestion(work, realWorks, seededRandom(seed))
        if (!q) continue
        for (const d of q.distractors) {
          const [v1, v2] = d.text.split('・')
          const supported = realWorks.some(
            (w) =>
              (w.artist === v1 || w.patron === v1) &&
              [w.style, w.religion, w.technique].some((v) => Boolean(v) && conceptOverlaps(v2, v as string)),
          )
          expect(supported, `${work.id}: 「${d.text}」はコーパス上で真になりうる`).toBe(false)
        }
      }
    }
  })
})

describe('組合せとして成立する誤答の並び', () => {
  it('作者ずらしと様式ずらしの両方が候補にあれば、誤答が片側に偏らない', () => {
    for (let seed = 0; seed < 8; seed++) {
      const q = generateComboQuestion(target, pool, seededRandom(seed / 8 + 0.01))
      if (!q) continue
      const artists = new Set(q.distractors.map((d) => d.text.split('・')[0]))
      const correctArtist = q.correct.text.split('・')[0]
      expect(artists.size, '誤答の作者が1種類しかない').toBeGreaterThan(1)
      expect([...artists].some((a) => a !== correctArtist)).toBe(true)
    }
  })
})
