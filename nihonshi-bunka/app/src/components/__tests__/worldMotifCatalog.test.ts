// M2d-01b: getBackgroundArt() の id 綴りミスは実行時エラーにならず「静かに遠景が出ない」
// だけになる（WorldMapScreen 側は null を返せば何も描かないだけの防御的設計のため）。
// カタログのキーと WorldMapScreen.tsx の switch 分岐・content/worlds.json の backgroundId が
// 食い違っていないかをここで直接検証する。
import { describe, expect, it } from 'vitest'
import { getBackgroundArt, getBossClipPath, getMotifIcon } from '../worldMotifCatalog'

describe('getBackgroundArt', () => {
  it('原始・化政の backgroundId はそれぞれのコンポーネントを返す', () => {
    expect(getBackgroundArt('genshi-hills')).not.toBeNull()
    expect(getBackgroundArt('kasei-fuji-sea')).not.toBeNull()
    expect(getBackgroundArt('genshi-hills')).not.toBe(getBackgroundArt('kasei-fuji-sea'))
  })

  it('未知の id・未指定は null（無地の13ワールドは遠景を描かない）', () => {
    expect(getBackgroundArt('no-such-id')).toBeNull()
    expect(getBackgroundArt(undefined)).toBeNull()
  })
})

describe('getMotifIcon / getBossClipPath（既存カタログの回帰確認）', () => {
  it('原始・化政の全モチーフ id がカタログに存在する', () => {
    for (const id of ['dogu', 'haniwa', 'tateana', 'dotaku', 'kaizuka', 'fuji', 'nami', 'tabibito', 'nishikie']) {
      expect(getMotifIcon(id)).not.toBeNull()
    }
  })

  it('未知の bossShape は既定（空文字列＝角丸長方形）にフォールバックする', () => {
    expect(getBossClipPath('kofun')).not.toBe('')
    expect(getBossClipPath('fuji')).not.toBe('')
    expect(getBossClipPath('no-such-shape')).toBe('')
  })
})
