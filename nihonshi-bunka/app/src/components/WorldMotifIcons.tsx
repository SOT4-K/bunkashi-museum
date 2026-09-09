// ワールドマップの道端の飾り（M2d-01）。自作のフラット・丸み・線少なめの SVG イラスト
// （CLAUDE.md 禁止事項: 実際の出題画像は飾りに使わない。ここに定義するのは全て手描きの図形）。
// モチーフの中身（どのワールドにどれを置くか）は content/worlds.json 側のデータで持ち、
// このファイルは「id → 描画コンポーネント」のカタログのみを持つ（コードにワールド固有の
// 判断をハードコードしない）。
//
// モチーフ選定理由（LOG.md 転記用の根拠。builder が提案）:
//  - 原始（genshi）: 土偶・埴輪・竪穴住居・銅鐸・貝塚はチケット文面の指定どおり。
//    いずれも content/eras.json の genshi.items（縄文土器・土偶・貝塚・銅鐸・埴輪）に
//    実在する事項で、竪穴住居も教科書レベルの定番（縄文〜弥生の代表的な住居形式）。
//    史実の時代（旧石器〜古墳）と合わないモチーフは含めていない。
//  - 化政（kasei）: 富士・波・旅人・錦絵もチケット文面の指定どおり。葛飾北斎「冨嶽三十六景」
//    （富士・神奈川沖浪裏＝波）、歌川広重の東海道シリーズ（旅人）、多色刷り木版画そのもの
//    （錦絵）は content/works/kasei.json の実作品（kanagawa-oki-namiura 等）と整合する
//    化政文化の代表的主題。
import type { SVGProps } from 'react'

function MotifBase(props: SVGProps<SVGSVGElement>) {
  return <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true" {...props} />
}

/** 遮光器土偶を単純化: 丸い頭部（ゴーグル状の目）+ 台形の胴体。 */
export function DoguIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M20 58 L18 34 Q18 20 32 20 Q46 20 46 34 L44 58 Z" fill="#c07a4a" />
      <circle cx="32" cy="16" r="12" fill="#c07a4a" />
      <ellipse cx="26" cy="15" rx="4.5" ry="3" fill="#4a2f1f" />
      <ellipse cx="38" cy="15" rx="4.5" ry="3" fill="#4a2f1f" />
      <path d="M22 40 h20 M22 47 h20" stroke="#8a5330" strokeWidth="2" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 円筒埴輪+人物埴輪を単純化: 円筒の胴+丸い顔。 */
export function HaniwaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="20" y="26" width="24" height="32" rx="6" fill="#d99a5b" />
      <circle cx="32" cy="16" r="11" fill="#d99a5b" />
      <circle cx="28" cy="15" r="1.8" fill="#5b3a20" />
      <circle cx="36" cy="15" r="1.8" fill="#5b3a20" />
      <path d="M27 20 q5 3 10 0" stroke="#5b3a20" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="24" y="34" width="16" height="3" rx="1.5" fill="#b97b45" />
    </MotifBase>
  )
}

/** 竪穴住居: 三角の茅葺き屋根+入口の暗がり。 */
export function TateanaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 50 L32 14 L56 50 Z" fill="#a97848" />
      <path d="M8 50 L32 14 L56 50 L52 54 L32 20 L12 54 Z" fill="#8a5f38" />
      <path d="M27 50 v-14 q5 -4 10 0 v14 Z" fill="#3d2a1a" />
    </MotifBase>
  )
}

/** 銅鐸: 台形の鐘型+吊り手。 */
export function DotakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="26" y="8" width="12" height="8" rx="4" fill="#6f8f6a" />
      <path d="M20 20 h24 l4 34 q-16 6 -32 0 Z" fill="#7fae7a" />
      <path d="M20 20 h24 l1.5 8 h-27 Z" fill="#6f8f6a" />
    </MotifBase>
  )
}

/** 貝塚: 小さな盛り土+貝殻（扇形）を数個。 */
export function KaizukaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M6 54 Q32 32 58 54 Z" fill="#a88b5f" />
      <path d="M22 46 a5 5 0 0 1 8 0 Z" fill="#efe6d3" />
      <path d="M34 50 a4 4 0 0 1 7 0 Z" fill="#f4ece0" />
      <path d="M14 50 a4 4 0 0 1 7 0 Z" fill="#f4ece0" />
    </MotifBase>
  )
}

/** 富士山: 左右対称の三角+雪冠。 */
export function FujiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 54 L32 12 L56 54 Z" fill="#4a6fa5" />
      <path d="M32 12 L40 28 Q32 24 24 28 Z" fill="#f4f7fb" />
    </MotifBase>
  )
}

/** 北斎の波を単純化: 丸みの強い青いカーブ+白い泡の丸。 */
export function NamiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M6 46 Q16 22 30 34 Q40 42 30 50 Q46 50 52 34 Q58 46 58 54 L6 54 Z" fill="#3d6ea5" />
      <circle cx="16" cy="30" r="3" fill="#f4f7fb" />
      <circle cx="24" cy="26" r="2.4" fill="#f4f7fb" />
      <circle cx="44" cy="30" r="2.6" fill="#f4f7fb" />
    </MotifBase>
  )
}

/** 旅人: 菅笠+杖を持つ丸みの人影。 */
export function TabibitoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M16 24 Q32 8 48 24 Q32 20 16 24 Z" fill="#c9a86a" />
      <circle cx="32" cy="28" r="4" fill="#e8c99a" />
      <path d="M24 58 Q22 40 32 34 Q42 40 40 58 Z" fill="#5b7083" />
      <path d="M42 30 L48 56" stroke="#8a5f38" strokeWidth="2.4" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 錦絵: 額縁の中に多色の帯（多色刷り木版画）+ 隅の落款。 */
export function NishikieIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="10" width="48" height="44" rx="3" fill="#f4ece0" stroke="#8a5f38" strokeWidth="2" />
      <rect x="13" y="16" width="38" height="7" fill="#3d6ea5" />
      <rect x="13" y="26" width="38" height="7" fill="#4a6fa5" />
      <rect x="13" y="36" width="38" height="7" fill="#c0392b" />
      <rect x="40" y="44" width="10" height="6" rx="1" fill="#c0392b" />
    </MotifBase>
  )
}

