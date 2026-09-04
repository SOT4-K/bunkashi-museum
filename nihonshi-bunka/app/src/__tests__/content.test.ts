import { describe, expect, it } from 'vitest'
import { eras, works } from '../content'

describe('content (import.meta.glob 読み込み)', () => {
  it('eras.json を読み込める', () => {
    expect(eras.length).toBeGreaterThan(0)
    expect(eras[0].order).toBeLessThanOrEqual(eras[eras.length - 1].order)
  })

  it('works/*.json を読み込める（content/works/ は他の作業と共有のため件数は決め打ちしない）', () => {
    expect(works.length).toBeGreaterThanOrEqual(10)
    // M2-16 補修: tenpyo の件数を toBe(10) と決め打ちしていたが、writer が並行して
    // 作品を追加し続けるため（実測 10→17 件に増加）テスト名の方針（決め打ちしない）に反して
    // 落ちるようになっていた。「M1 時点の最低件数は維持されている」という元の意図に合わせ、
    // 下限チェックに変える（このテストは builder の担当外だが、npm test を通す必要があるための
    // 最小修正。完了報告に明記する）。
    expect(works.filter((w) => w.era === 'tenpyo').length).toBeGreaterThanOrEqual(10)
  })

  it('dev モード（VITE_INCLUDE_DRAFT 未設定でもテストは DEV 扱い）では draft も含む', () => {
    // M2 以降、content/works/ は reviewed と draft が混在する（reviewer 検証を通った分だけ reviewed）。
    // draft が1件でも works に残っていれば、dev モードでフィルタされていないと確認できる
    // （reviewed のみに絞られていたら draft は works から消えているはず）。
    expect(works.some((w) => w.status === 'draft')).toBe(true)
    expect(works.some((w) => w.status === 'reviewed')).toBe(true)
  })
})
