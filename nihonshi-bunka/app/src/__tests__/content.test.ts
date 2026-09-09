import { describe, expect, it } from 'vitest'
import { eras, works, worldThemesById } from '../content'
import { getMotifIcon } from '../components/worldMotifCatalog'
import { worldOrder } from '../engine/stages'

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

describe('worlds.json（M2d-01 ワールドマップの時代テーマ）', () => {
  it('15ワールド全件にテーマの器がある', () => {
    for (const eraId of worldOrder(eras)) {
      expect(worldThemesById[eraId], `${eraId} のテーマが無い`).toBeDefined()
    }
  })

  // M2d-02: 残り13ワールドにも各5種のモチーフを追加したため、15ワールド全件が飾りを持つ
  // （無地パレットのみの世界は無くなった）。
  it('15ワールド全件が道端の飾りモチーフを持ち、全てカタログに実在する', () => {
    for (const eraId of worldOrder(eras)) {
      const theme = worldThemesById[eraId]
      expect(theme?.motifs.length ?? 0, `${eraId} に飾りが無い`).toBeGreaterThan(0)
      for (const m of theme.motifs) expect(getMotifIcon(m.id), `${eraId} の motif ${m.id} が未定義`).not.toBeNull()
    }
  })

  it('genshi の飾りはチケット指定の5種（土偶・埴輪・竪穴住居・銅鐸・貝塚）', () => {
    const ids = worldThemesById.genshi.motifs.map((m) => m.id).sort()
    expect(ids).toEqual(['dogu', 'dotaku', 'haniwa', 'kaizuka', 'tateana'])
  })

  it('kasei の飾りはチケット指定の4種（富士・波・旅人・錦絵）', () => {
    const ids = worldThemesById.kasei.motifs.map((m) => m.id).sort()
    expect(ids).toEqual(['fuji', 'nami', 'nishikie', 'tabibito'])
  })

  it('15ワールド全件が bossFlagId を持ち、その id は自ワールドの motifs に含まれ、カタログにも実在する（M2d-02: 新規アセットを増やさず道端の飾りを再利用する設計）', () => {
    for (const eraId of worldOrder(eras)) {
      const theme = worldThemesById[eraId]
      expect(theme?.bossFlagId, `${eraId} に bossFlagId が無い`).toBeDefined()
      const flagId = theme.bossFlagId as string
      expect(theme.motifs.some((m) => m.id === flagId), `${eraId} の bossFlagId(${flagId}) が motifs に無い`).toBe(
        true,
      )
      expect(getMotifIcon(flagId), `${eraId} の bossFlagId(${flagId}) がカタログに無い`).not.toBeNull()
    }
  })
})
