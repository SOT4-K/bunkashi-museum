// reviewer指摘 M2-99v3 [中5]: 実データテストが全てDEV扱い（content.ts の shouldIncludeDraft() が
// テスト実行中は常に true を返すため、draft も混ざったプールで検証していた）で、本番ビルド
// （status: reviewed 限定）のプールを検証するテストが一本も無かった。
//
// このテストは content.ts の glob 呼び出しと同じ方法で content/ を直接読み込み、
// shouldIncludeDraft() を経由せず「status: reviewed のみ」に自前でフィルタして本番相当の
// プールを作る。M2-24 で higashiyama-02 の下線 c（Q9）の誤答に daigo-sanboin-teien を
// 追加したが、当時 daigo-sanboin-teien は draft だったため本番ビルドでは反映されず、
// 「誤答3件が全て建築で正解だけ庭園」という盲検の構造的欠陥が本番に残っていた
// （M2-99v3 [重大1]。M2-54 で daigo-sanboin-teien を reviewed に昇格して解消した）。
// この昇格が本番プールに実際に効くことを固定する。
import { describe, expect, it } from 'vitest'
import type { Era, Passage, Work } from '../../types'
import { generateQ9QuestionFromIds } from '../q9'
import { seededRandom } from './testFixtures'

const eraModules = import.meta.glob('../../../../content/eras.json', {
  eager: true,
  import: 'default',
}) as Record<string, Era[]>
const workModules = import.meta.glob('../../../../content/works/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Work[]>
const passageModules = import.meta.glob('../../../../content/passages/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Passage[]>

const eras: Era[] = Object.values(eraModules)[0] ?? []
const rawWorks: Work[] = Object.values(workModules).flat()
const rawPassages: Passage[] = Object.values(passageModules).flat()

// content.ts の本番ビルド相当（shouldIncludeDraft() = false）を自前で再現する。
const prodWorks = rawWorks.filter((w) => w.status === 'reviewed')
const prodPlayableWorks = prodWorks.filter((w) => {
  // hasRealImage は generated/real-images.json（画像同期後）に依存するため、ここでは
  // 「manifest 相当のライセンス済み画像を持つ」ことを image フィールドの有無で近似する。
  // このテストの関心は「status: reviewed かどうか」で、画像同期の正しさは別テストが担う。
  return Boolean(w.image) && (w.kind ?? 'artifact') === 'artifact'
})

describe('本番プール（status: reviewed 限定）: higashiyama-02 Q9', () => {
  const passage = rawPassages.find((p) => p.id === 'higashiyama-02')
  const underline = passage?.underlines.find((u) => u.key === 'c')

  it('前提: higashiyama-02 は公開済み、下線cはryoanji-sekiteiを対象とするQ9', () => {
    expect(passage?.status).toBe('reviewed')
    expect(underline?.ask?.type).toBe('q9')
    expect(underline?.ask?.answerId).toBe('ryoanji-sekitei')
  })

  it('daigo-sanboin-teien が本番プール（reviewed）に含まれる（M2-54で昇格）', () => {
    expect(prodWorks.some((w) => w.id === 'daigo-sanboin-teien')).toBe(true)
    expect(prodPlayableWorks.some((w) => w.id === 'daigo-sanboin-teien')).toBe(true)
  })

  it(
    '本番プールで誤答に daigo-sanboin-teien（庭園）が実際に入り、誤答が建築だけにならない（M2-99v3重大1の回帰）',
    () => {
      if (!underline?.ask || underline.ask.type !== 'q9') throw new Error('fixture broken')
      for (let seed = 0; seed < 5; seed++) {
        const q = generateQ9QuestionFromIds(
          prodPlayableWorks,
          underline.ask.answerId!,
          underline.ask.distractorIds,
          eras,
          seededRandom(seed),
        )
        expect(q).not.toBeNull()
        // daigo-sanboin-teien（category上は他の誤答と同じ"architecture"だが、実画像は
        // 池を中心とする庭園で見た目が明確に異なる）が本番プールでも実際に誤答へ入ることを固定する。
        // draft のままだと byId.get() が undefined を返し、この枠だけ nearbyCandidates の
        // 自動補充（同カテゴリの建築）にフォールバックしていた（M2-99v3重大1）。
        const distractorIds = q!.distractorWorks.map((w) => w.id)
        expect(distractorIds).toContain('daigo-sanboin-teien')
        expect(distractorIds.sort()).toEqual(['daigo-sanboin-teien', 'kinkaku', 'shokintei-katsura'])
      }
    },
  )
})
