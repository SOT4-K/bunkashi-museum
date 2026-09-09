// WorldMotifIcons.tsx（コンポーネントのみ）とは別ファイルにしたカタログ（M2d-01）。
// react/only-export-components 対策（コンポーネント専用ファイルから定数/関数を外に出す）
// を兼ねる。ロジックは純関数のみ（JSX を返さない）。
import type { ComponentType, SVGProps } from 'react'
import {
  DoguIcon,
  DotakuIcon,
  FujiIcon,
  HaniwaIcon,
  KaizukaIcon,
  NamiIcon,
  NishikieIcon,
  TabibitoIcon,
  TateanaIcon,
} from './WorldMotifIcons'

/** id → 描画コンポーネント。content/worlds.json の motifs[].id を引く（未知の id は
 *  null を返し、呼び出し側（WorldMapScreen）はその飾りを描かず落ちない＝防御的）。 */
export const MOTIF_CATALOG: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  dogu: DoguIcon,
  haniwa: HaniwaIcon,
  tateana: TateanaIcon,
  dotaku: DotakuIcon,
  kaizuka: KaizukaIcon,
  fuji: FujiIcon,
  nami: NamiIcon,
  tabibito: TabibitoIcon,
  nishikie: NishikieIcon,
}

export function getMotifIcon(id: string): ComponentType<SVGProps<SVGSVGElement>> | null {
  return MOTIF_CATALOG[id] ?? null
}

/**
 * ボスノードの形（チケット「(c) ボスノードの形」）。CSS clip-path のポリゴン値。
 * 'default' は clip-path を使わず通常の角丸長方形にする（空文字列）。
 * 未知の値は 'default' にフォールバックする（getBossClipPath）。
 */
export const BOSS_SHAPES: Record<string, string> = {
  default: '',
  // 前方後円墳（鍵穴型）を単純化: 丸い後円部+方形の前方部。
  kofun: 'polygon(50% 0%, 74% 10%, 88% 32%, 88% 52%, 100% 52%, 100% 100%, 0% 100%, 0% 52%, 12% 52%, 12% 32%, 26% 10%)',
  // 富士山型: 左右対称の台形。
  fuji: 'polygon(50% 2%, 68% 32%, 86% 32%, 100% 100%, 0% 100%, 14% 32%, 32% 32%)',
}

export function getBossClipPath(shape: string): string {
  return BOSS_SHAPES[shape] ?? BOSS_SHAPES.default
}
