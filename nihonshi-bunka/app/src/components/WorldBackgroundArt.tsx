// ワールドマップの遠景イラスト（M2d-01b。管理セッション所見③「空と地面の区別・遠景が無く、
// 時代の雰囲気が配色だけ」への対応）。WorldMotifIcons.tsx（道端の小さい飾り、40px前後）とは
// 別ファイル：こちらは画面幅いっぱいに一度だけ描く「遠景の帯」（自作フラット SVG。
// CLAUDE.md 禁止事項の実写真は使わない）。
//
// スクロールする道（WorldMapScreen.tsx の .canvas）とは別に、スクロールしない .screen 側に
// 固定で1枚だけ置く（スクロール位置によらず「空・遠景・地面」の3層がいつも同じ高さに見える、
// という単純な設計。ノード数が増えて道が長くなっても遠景イラスト自体は増やさない）。
// viewBox は画面比率に近い 0 0 390 320（横幅を100%に引き伸ばして使う想定。
// preserveAspectRatio="none" で親要素の幅・高さぴったりに伸縮させる。フラットな図形のみで
// 構成しているため多少の縦横比変化があっても違和感が出にくい）。
import type { SVGProps } from 'react'

function BackgroundBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 390 320"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

/** 原始文化: 山並み（重なる三角の稜線）+ 森（松の木のシルエットの列）。 */
export function GenshiBackdrop(props: SVGProps<SVGSVGElement>) {
  return (
    <BackgroundBase {...props}>
      {/* 遠い山並み（淡い色、奥行き） */}
      <path d="M0 190 L60 90 L120 190 Z" fill="#b98f5e" opacity="0.55" />
      <path d="M90 190 L170 60 L250 190 Z" fill="#a97c4a" opacity="0.6" />
      <path d="M210 190 L290 100 L390 190 Z" fill="#b98f5e" opacity="0.55" />
      {/* 手前の森（松の木のシルエット、濃い色） */}
      {[10, 45, 80, 115, 150, 185, 220, 255, 290, 325, 360].map((x, i) => (
        <path
          key={x}
          d={`M${x} ${210 - (i % 3) * 6} L${x + 16} ${170 - (i % 3) * 6} L${x + 32} ${210 - (i % 3) * 6} Z`}
          fill="#5c6b3d"
        />
      ))}
      {/* 地面（草・土）: 淡い草のタフト */}
      <rect x="0" y="205" width="390" height="115" fill="#8a6b4a" />
      {Array.from({ length: 16 }, (_, i) => 20 + i * 24).map((x, i) => (
        <path
          key={x}
          d={`M${x} ${230 + (i % 2) * 30} q4 -14 8 0 q4 -18 8 0`}
          stroke="#c9a15c"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
      ))}
    </BackgroundBase>
  )
}

/** 化政文化: 富士山（雪冠つき）+ 海（水平線と波の帯）。 */
export function KaiseiBackdrop(props: SVGProps<SVGSVGElement>) {
  return (
    <BackgroundBase {...props}>
      {/* 富士山（遠景、右寄り） */}
      <path d="M195 190 L275 55 L355 190 Z" fill="#5b7fac" opacity="0.85" />
      <path d="M275 55 L297 92 Q275 84 253 92 Z" fill="#f4f7fb" opacity="0.95" />
      {/* 対岸の低い山影（左） */}
      <path d="M0 190 L55 130 L110 190 Z" fill="#6f93b8" opacity="0.5" />
      {/* 海（水平線から手前へ） */}
      <rect x="0" y="185" width="390" height="60" fill="#3d6ea5" opacity="0.85" />
      {[0, 1, 2].map((row) => (
        <path
          key={row}
          d={`M0 ${205 + row * 12} Q20 ${200 + row * 12} 40 ${205 + row * 12} T80 ${205 + row * 12} T120 ${205 + row * 12} T160 ${205 + row * 12} T200 ${205 + row * 12} T240 ${205 + row * 12} T280 ${205 + row * 12} T320 ${205 + row * 12} T360 ${205 + row * 12} T390 ${205 + row * 12}`}
          stroke="#eaf3fb"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />
      ))}
      {/* 地面（砂浜） */}
      <rect x="0" y="245" width="390" height="75" fill="#e8d9b5" />
      {Array.from({ length: 20 }, (_, i) => 12 + i * 19).map((x, i) => (
        <circle key={x} cx={x} cy={265 + (i % 3) * 12} r="1.6" fill="#c9a15c" opacity="0.6" />
      ))}
    </BackgroundBase>
  )
}
