// 全ワールド共通「敵の砦」ボスノード（M2d-02。オーナー指示: 前方後円墳・富士山型といった
// 時代ランドマーク型のボスをやめ、「鬼ヶ島のシルエットみたいな、若干悪い敵のイメージ」の
// 全ワールド共通デザインに統一する）。
//
// 暗い岩山（ギザギザの輪郭）+ 門 + 角/炎のような突起、配色は黒紫+赤のアクセント
// （周囲の可愛い道端の飾りと対比して「ここだけ悪い」と分かるようにする）。
// 時代差は頂上の小さな旗1点だけ（FlagIcon。道端の飾りと同じアイコンを再利用し、新規アセットを
// 増やさない）。状態差（チケット文面のまま維持）:
//  - locked（未解禁）: 岩山・門とも無彩色寄りの灰。角/炎の突起も灰にし、目は描かない
//  - unlocked（挑戦可能）: 黒紫+赤アクセント。門の上の両目が赤く光る（SVG <animate> で明滅）
//  - cleared（クリア）: 黒紫+赤アクセントを保持。目は落ち着いた暗い色に変わる（挑戦可能時の
//    「光る目」との対比。王冠バッジは呼び出し側 WorldMapScreen が既存の 👑 絵文字を重ねる＝
//    既存の合格テスト・全体マップと同じ「クリア＝王冠」表現を流用する）
import type { ComponentType, SVGProps } from 'react'

export type BossFortressState = 'locked' | 'unlocked' | 'cleared'

interface BossFortressIconProps extends SVGProps<SVGSVGElement> {
  state: BossFortressState
  /** ワールドごとの旗アイコン（worldMotifCatalog.getMotifIcon の戻り値をそのまま渡す）。
   *  無ければ旗を描かない（防御的：未知の bossFlagId でも壊れない）。 */
  FlagIcon?: ComponentType<SVGProps<SVGSVGElement>> | null
}

export function BossFortressIcon({ state, FlagIcon, ...svgProps }: BossFortressIconProps) {
  const isLocked = state === 'locked'
  const rockFill = isLocked ? '#8b8b93' : '#241b2e'
  const rockShade = isLocked ? '#77777f' : '#150f1c'
  const accent = isLocked ? '#9a9aa2' : '#c0392b'
  const eyesOn = state === 'unlocked'

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" data-testid="boss-fortress" data-state={state} {...svgProps}>
      {/* 暗い岩山（ギザギザの輪郭）。鬼ヶ島の島影を意識した、上部が尖った岩の塊。 */}
      <path
        data-testid="boss-fortress-rock"
        fill={rockFill}
        d="M6 58 L9 42 L3 36 L13 31 L11 20 L20 24 L25 9 L31 17 L37 7 L41 21 L51 17 L48 29 L59 33 L51 39 L57 57 Z"
      />
      {/* 岩肌の陰影（右下を少し暗く、立体感を出す）。 */}
      <path data-testid="boss-fortress-shade" fill={rockShade} opacity="0.55" d="M41 21 L51 17 L48 29 L59 33 L51 39 L57 57 L34 57 Z" />
      {/* 角/炎のような突起（左右の頂上から伸びる）。 */}
      <path data-testid="boss-fortress-horn-left" fill={accent} d="M13 31 L15 15 L20 24 Z" />
      <path data-testid="boss-fortress-horn-right" fill={accent} d="M51 17 L54 3 L48 15 Z" />
      {/* 門（下部中央の暗いアーチ）。 */}
      <path data-testid="boss-fortress-gate" fill="#0e0a13" d="M25 58 L25 43 Q31 35 37 43 L37 58 Z" />
      {/* 目（門の上）。未解禁は描かない（灰の岩山に埋没させる）。挑戦可能は赤く光る（明滅）、
          クリアは落ち着いた暗赤（光らない）。 */}
      {!isLocked && (
        <>
          <circle
            data-testid="boss-fortress-eye"
            cx="28"
            cy="40"
            r={eyesOn ? 2.6 : 1.8}
            fill={eyesOn ? '#ff3b3b' : '#5a1f1f'}
          >
            {eyesOn && <animate attributeName="opacity" values="1;0.45;1" dur="1.3s" repeatCount="indefinite" />}
          </circle>
          <circle
            data-testid="boss-fortress-eye"
            cx="34"
            cy="40"
            r={eyesOn ? 2.6 : 1.8}
            fill={eyesOn ? '#ff3b3b' : '#5a1f1f'}
          >
            {eyesOn && <animate attributeName="opacity" values="1;0.45;1" dur="1.3s" repeatCount="indefinite" />}
          </circle>
        </>
      )}
      {/* 旗（頂上。時代差はここ1点だけ）。 */}
      {FlagIcon && (
        <g data-testid="boss-fortress-flag">
          <rect x="30.5" y="0" width="1.6" height="11" fill={isLocked ? '#9a9aa2' : '#5a1f1f'} />
          <circle cx="35" cy="4" r="6.5" fill="#f4ece0" stroke={isLocked ? '#9a9aa2' : '#c0392b'} strokeWidth="1" />
          <g transform="translate(29.7, -1.3) scale(0.166)">
            <FlagIcon width="64" height="64" />
          </g>
        </g>
      )}
    </svg>
  )
}
