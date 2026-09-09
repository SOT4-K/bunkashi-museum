// WorldMotifIcons.tsx（コンポーネントのみ）とは別ファイルにしたカタログ（M2d-01）。
// react/only-export-components 対策（コンポーネント専用ファイルから定数/関数を外に出す）
// を兼ねる。ロジックは純関数のみ（JSX を返さない）。
import type { ComponentType, SVGProps } from 'react'
import {
  AkaeIcon,
  BunjingaIcon,
  ButsutoIcon,
  ButsuzoIcon,
  ChagamaIcon,
  ChawanIcon,
  ChojugigaIcon,
  DaibutsuIcon,
  DengakumenIcon,
  DoguIcon,
  DotakuIcon,
  EmakimonoIcon,
  ErekiteruIcon,
  FudomyooIcon,
  FujiIcon,
  FujinraijinIcon,
  GinkakuIcon,
  GojunotoIcon,
  GokoshoIcon,
  GorintoIcon,
  GozantoIcon,
  HaikutanzakuIcon,
  HaniwaIcon,
  HoodoIcon,
  IchibokuzukuributsuIcon,
  IroetsuboIcon,
  JunihitoeIcon,
  JuzuIcon,
  KaitaishinshoIcon,
  KaizukaIcon,
  KakitsubataIcon,
  KanamojiIcon,
  KangofuIcon,
  KaresansuiIcon,
  KarashishiIcon,
  KatsurarikyuIcon,
  KawarayaneIcon,
  KenzuishisenIcon,
  KinbyobuIcon,
  KinkakuIcon,
  KokubunjitoIcon,
  KongorikishiIcon,
  KonjikidoIcon,
  KumadoriIcon,
  MakiesuzuribakoIcon,
  MandalaIcon,
  ManyotanzakuIcon,
  MokkanIcon,
  NamiIcon,
  NandaimonIcon,
  NanbansenIcon,
  NishikieIcon,
  NomenIcon,
  OgiIcon,
  OkubieIcon,
  RengeIcon,
  RokushojitoIcon,
  SanpitsukanIcon,
  SesshuSuibokugaIcon,
  ShibiIcon,
  ShindenzukuriIcon,
  ShojiIcon,
  ShosoinIcon,
  SuibokugaIcon,
  SuienIcon,
  TabibitoIcon,
  TakamatsuzukaIcon,
  TateanaIcon,
  TenshuIcon,
  TerakoyatsukueIcon,
  ToshoguIcon,
  UkiyoehangiIcon,
  YakushijitoIcon,
  YoroikabutoIcon,
} from './WorldMotifIcons'
import { GenshiBackdrop, KaiseiBackdrop } from './WorldBackgroundArt'

/** id → 遠景イラスト（M2d-01b）。content/worlds.json の backgroundId を引く。未知の id・
 *  未指定は null（呼び出し側は遠景を描かない＝防御的。既定は13ワールドと同じ「無し」）。 */
export const BACKGROUND_CATALOG: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  'genshi-hills': GenshiBackdrop,
  'kasei-fuji-sea': KaiseiBackdrop,
}

export function getBackgroundArt(id: string | undefined): ComponentType<SVGProps<SVGSVGElement>> | null {
  if (!id) return null
  return BACKGROUND_CATALOG[id] ?? null
}

/** id → 描画コンポーネント。content/worlds.json の motifs[].id を引く（未知の id は
 *  null を返し、呼び出し側（WorldMapScreen）はその飾りを描かず落ちない＝防御的）。 */
export const MOTIF_CATALOG: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  // 原始
  dogu: DoguIcon,
  haniwa: HaniwaIcon,
  tateana: TateanaIcon,
  dotaku: DotakuIcon,
  kaizuka: KaizukaIcon,
  // 化政
  fuji: FujiIcon,
  nami: NamiIcon,
  tabibito: TabibitoIcon,
  nishikie: NishikieIcon,
  // 飛鳥（M2d-02）
  kawarayane: KawarayaneIcon,
  gojunoto: GojunotoIcon,
  butsuzo: ButsuzoIcon,
  renge: RengeIcon,
  kenzuishisen: KenzuishisenIcon,
  // 白鳳
  yakushijito: YakushijitoIcon,
  butsuto: ButsutoIcon,
  takamatsuzuka: TakamatsuzukaIcon,
  suien: SuienIcon,
  manyotanzaku: ManyotanzakuIcon,
  // 天平
  daibutsu: DaibutsuIcon,
  shosoin: ShosoinIcon,
  shibi: ShibiIcon,
  kokubunjito: KokubunjitoIcon,
  mokkan: MokkanIcon,
  // 弘仁・貞観
  mandala: MandalaIcon,
  gokosho: GokoshoIcon,
  fudomyoo: FudomyooIcon,
  ichibokuzukuributsu: IchibokuzukuributsuIcon,
  sanpitsukan: SanpitsukanIcon,
  // 国風
  hoodo: HoodoIcon,
  shindenzukuri: ShindenzukuriIcon,
  kanamoji: KanamojiIcon,
  junihitoe: JunihitoeIcon,
  ogi: OgiIcon,
  // 院政
  emakimono: EmakimonoIcon,
  konjikido: KonjikidoIcon,
  chojugiga: ChojugigaIcon,
  rokushojito: RokushojitoIcon,
  dengakumen: DengakumenIcon,
  // 鎌倉
  kongorikishi: KongorikishiIcon,
  nandaimon: NandaimonIcon,
  yoroikabuto: YoroikabutoIcon,
  gorinto: GorintoIcon,
  juzu: JuzuIcon,
  // 北山
  kinkaku: KinkakuIcon,
  suibokuga: SuibokugaIcon,
  nomen: NomenIcon,
  kangofu: KangofuIcon,
  gozanto: GozantoIcon,
  // 東山
  ginkaku: GinkakuIcon,
  karesansui: KaresansuiIcon,
  chawan: ChawanIcon,
  sesshusuibokuga: SesshuSuibokugaIcon,
  shoji: ShojiIcon,
  // 桃山
  tenshu: TenshuIcon,
  kinbyobu: KinbyobuIcon,
  chagama: ChagamaIcon,
  nanbansen: NanbansenIcon,
  karashishi: KarashishiIcon,
  // 寛永
  toshogu: ToshoguIcon,
  katsurarikyu: KatsurarikyuIcon,
  fujinraijin: FujinraijinIcon,
  akae: AkaeIcon,
  makiesuzuribako: MakiesuzuribakoIcon,
  // 元禄
  ukiyoehangi: UkiyoehangiIcon,
  kakitsubata: KakitsubataIcon,
  kumadori: KumadoriIcon,
  haikutanzaku: HaikutanzakuIcon,
  iroetsubo: IroetsuboIcon,
  // 宝暦・天明
  okubie: OkubieIcon,
  erekiteru: ErekiteruIcon,
  kaitaishinsho: KaitaishinshoIcon,
  bunjinga: BunjingaIcon,
  terakoyatsukue: TerakoyatsukueIcon,
}

export function getMotifIcon(id: string): ComponentType<SVGProps<SVGSVGElement>> | null {
  return MOTIF_CATALOG[id] ?? null
}
