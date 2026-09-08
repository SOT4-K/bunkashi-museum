// 下部タブ用の線画アイコン（24px、stroke ベース）。装飾用の塗りは使わない。
import type { SVGProps } from 'react'

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3.5 11.5 12 4l8.5 7.5" />
      <path d="M5.5 9.8V19a1 1 0 0 0 1 1H9.5a1 1 0 0 0 1-1v-4.2h3V19a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V9.8" />
    </Base>
  )
}

export function LearnIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4.5" y="4" width="15" height="16" rx="1.5" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </Base>
  )
}

export function MuseumIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Base>
  )
}

export function StatsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M5 19V10M12 19V5M19 19v-6" />
      <path d="M3.5 19h17" />
    </Base>
  )
}

/** マップタブ（M2b-06）: 折りたたんだ地図のアイコン。 */
export function MapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </Base>
  )
}

/** 模試タブ（M2b-07）: ストップウォッチのアイコン。 */
export function ExamIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 13V9M9.5 3.5h5M12 3.5V6" />
    </Base>
  )
}

/** ライトボックスの閉じるボタン（×） */
export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  )
}

/** 画像をライトボックスで拡大表示するトリガー（虫眼鏡）。選択・遷移の
    タップ領域と衝突する画像（Q3の選択肢、図鑑のタイル）に重ねて使う。 */
export function ExpandIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
      <path d="M10.5 8v5M8 10.5h5" />
    </Base>
  )
}
