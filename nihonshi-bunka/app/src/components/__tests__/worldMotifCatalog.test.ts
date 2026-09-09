// M2d-01b: getBackgroundArt() の id 綴りミスは実行時エラーにならず「静かに遠景が出ない」
// だけになる（WorldMapScreen 側は null を返せば何も描かないだけの防御的設計のため）。
// カタログのキーと WorldMapScreen.tsx の switch 分岐・content/worlds.json の backgroundId が
// 食い違っていないかをここで直接検証する。
import { describe, expect, it } from 'vitest'
import { getBackgroundArt, getMotifIcon } from '../worldMotifCatalog'

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

describe('getMotifIcon（既存カタログの回帰確認）', () => {
  it('原始・化政の全モチーフ id がカタログに存在する', () => {
    for (const id of ['dogu', 'haniwa', 'tateana', 'dotaku', 'kaizuka', 'fuji', 'nami', 'tabibito', 'nishikie']) {
      expect(getMotifIcon(id)).not.toBeNull()
    }
  })

  it('M2d-02: 残り13ワールド分の全モチーフ id（各5種、計65種）がカタログに存在する', () => {
    const ids = [
      'kawarayane', 'gojunoto', 'butsuzo', 'renge', 'kenzuishisen',
      'yakushijito', 'butsuto', 'takamatsuzuka', 'suien', 'manyotanzaku',
      'daibutsu', 'shosoin', 'shibi', 'kokubunjito', 'mokkan',
      'mandala', 'gokosho', 'fudomyoo', 'ichibokuzukuributsu', 'sanpitsukan',
      'hoodo', 'shindenzukuri', 'kanamoji', 'junihitoe', 'ogi',
      'emakimono', 'konjikido', 'chojugiga', 'rokushojito', 'dengakumen',
      'kongorikishi', 'nandaimon', 'yoroikabuto', 'gorinto', 'juzu',
      'kinkaku', 'suibokuga', 'nomen', 'kangofu', 'gozanto',
      'ginkaku', 'karesansui', 'chawan', 'sesshusuibokuga', 'shoji',
      'tenshu', 'kinbyobu', 'chagama', 'nanbansen', 'karashishi',
      'toshogu', 'katsurarikyu', 'fujinraijin', 'akae', 'makiesuzuribako',
      'ukiyoehangi', 'kakitsubata', 'kumadori', 'haikutanzaku', 'iroetsubo',
      'okubie', 'erekiteru', 'kaitaishinsho', 'bunjinga', 'terakoyatsukue',
    ]
    expect(ids.length).toBe(65)
    for (const id of ids) expect(getMotifIcon(id), `motif ${id} が未定義`).not.toBeNull()
  })

  it('未知の id は null（防御的フォールバック）', () => {
    expect(getMotifIcon('no-such-motif')).toBeNull()
  })
})
