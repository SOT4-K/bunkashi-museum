// content/ 以下（app/ の外、nihonshi-bunka/content/）を Vite の import.meta.glob で読み込む。
// このファイル（app/src/content.ts）から見ると content/ は2階層上（app/src → app → nihonshi-bunka → content）。
// vite.config.ts の server.fs.allow に '..' を追加してある。
import type { Era, Passage, Work } from './types'
import { hasRealImage } from './utils/image'

const eraModules = import.meta.glob('../../content/eras.json', {
  eager: true,
  import: 'default',
}) as Record<string, Era[]>

const workModules = import.meta.glob('../../content/works/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Work[]>

// content/passages/ はテーマセット（リード文＋下線部→図版問題）用。M2 チケットで新設。
// ファイルが1つも無い環境（M2 コンテンツ投入前など）でも glob は空オブジェクトを返すため落ちない。
const passageModules = import.meta.glob('../../content/passages/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Passage[]>

const rawEras: Era[] = Object.values(eraModules)[0] ?? []

const rawWorks: Work[] = Object.values(workModules).flat()

const rawPassages: Passage[] = Object.values(passageModules).flat()

/**
 * status: reviewed のみ本番に含める仕様。ただし
 * - dev サーバー（vite dev）では常に draft も含める
 * - VITE_INCLUDE_DRAFT=1 のときはビルドでも draft を含める（M1 の暫定措置。全サンプルが draft のため）
 */
function shouldIncludeDraft(): boolean {
  return Boolean(import.meta.env.DEV) || import.meta.env.VITE_INCLUDE_DRAFT === '1'
}

export const eras: Era[] = [...rawEras].sort((a, b) => a.order - b.order)

export const works: Work[] = shouldIncludeDraft()
  ? rawWorks
  : rawWorks.filter((w) => w.status === 'reviewed')

/**
 * 出題に使える作品＝ライセンス記録済みの実画像がある「artifact」作品だけ。
 * プレースホルダ SVG は作品名を描いているため出題に使うと答えが見える（reviewer 指摘 R1, 2026-09-03）。
 * kind: person/text/concept（画像を持たない項目）は単独出題せず、リード文・誤文・Q9 の
 * 素材としてのみ使う（M2 チケット「テーマセット・モード」。works には残す＝素材プールは worksByEra 等で全件を見る）。
 * 図鑑・成績は全作品（未収集として表示）、学習・テーマセットの出題対象は playableWorks のみ。
 */
export const playableWorks: Work[] = works.filter((w) => hasRealImage(w) && (w.kind ?? 'artifact') === 'artifact')

/**
 * テーマセットの出題対象・素材プール（M2-16）。画像がある artifact（= playableWorks）に加え、
 * 画像を持たない person/text/concept も含める（語句組合せ・2文正誤・4択・適切/不適切な文の
 * 出題対象に戻す。research/nichidai-past-exams-analysis.md 5章）。ただし「画像→名前」を
 * 問う型（Q1/Q2/Q9等）の対象・distractor には使わない（そちらは playableWorks を
 * imagePool として別に渡す。engine/themeSet.ts の buildThemeSetQuestions 参照）。
 */
export const themeSetPool: Work[] = works.filter((w) => {
  const kind = w.kind ?? 'artifact'
  return kind === 'artifact' ? hasRealImage(w) : true
})

export const worksById: Record<string, Work> = Object.fromEntries(works.map((w) => [w.id, w]))

export const erasById: Record<string, Era> = Object.fromEntries(eras.map((e) => [e.id, e]))

export function worksByEra(eraId: string): Work[] {
  return works.filter((w) => w.era === eraId)
}

/**
 * passage 自体は status を持たない（M2 は素材となる作品側の status で事実上の検証を管理する設計）。
 * ただし全下線が reviewed 作品を持たない passage をそのまま公開すると、下線の大半が
 * buildThemeSetQuestions でスキップされ「図版問題を作れなかった」行き止まりになる
 * （reviewer 指摘・群B/群C 共通、2026-09-04）。本番ビルドでは
 * workIds を持つ下線について、1つ以上が playableWorks に含まれる passage のみ公開する
 * （dev/VITE_INCLUDE_DRAFT のときは検証中の内容を見るため常に全件含める）。
 *
 * kind: "image"（9章「画像リード型セット」）の Q12 下線は作品を直接問わない文字4択のため
 * workIds を持たない（省略）。Hayato 修正（2026-09-04 M2-13 統合時）: このとき
 * `u.workIds` が undefined になり `.some()` が例外を投げて本番ビルドがクラッシュしていた
 * （writer が9章のデータ形どおり workIds を省略 → 型は必須のまま → JSON には無い、という
 * 食い違い。テストは DEV 扱いで shouldIncludeDraft() が早期 true を返すため気づけなかった）。
 * workIds が無い／空の下線は「作品に依存しない」として素通しする。
 * また kind: "image" 自体の画像依存は leadWorkIds 側で判定する。
 *
 * M2-16: 画像なし項目（kind: person/text/concept）を文字問題の対象に戻したため、
 * 下線が生成できるかどうかは playableWorks（画像あり）だけでなく themeSetPool
 * （画像なし項目も含む）で判定する（画像なし項目だけを指す下線を持つ passage が
 * 本番ビルドで丸ごと非公開になってしまうのを防ぐ）。leadWorkIds（kind: "image" の
 * リード画像）は引き続き画像が必須なので playableWorks のまま判定する。
 */
const playableWorksById = new Set(playableWorks.map((w) => w.id))
const themeSetPoolById = new Set(themeSetPool.map((w) => w.id))

function isPassagePublishable(passage: Passage): boolean {
  if (shouldIncludeDraft()) return true
  if (passage.kind === 'image' && !(passage.leadWorkIds ?? []).some((id) => playableWorksById.has(id))) {
    return false
  }
  return passage.underlines.every((u) => {
    if (!u.workIds || u.workIds.length === 0) return true
    return u.workIds.some((id) => themeSetPoolById.has(id))
  })
}

/**
 * eras.json の order（時代順）→ 同一時代内は id 順。reviewer 指摘 [中]-6（2026-09-04 M2-11）:
 * id のローマ字順だと「飛鳥の次に元禄、その次が原始」のように時代がバラバラに並んでいた。
 */
const eraOrderIndex: Record<string, number> = Object.fromEntries(eras.map((e) => [e.id, e.order]))

export const passages: Passage[] = [...rawPassages].filter(isPassagePublishable).sort((a, b) => {
  const orderDiff = (eraOrderIndex[a.era] ?? 0) - (eraOrderIndex[b.era] ?? 0)
  return orderDiff !== 0 ? orderDiff : a.id.localeCompare(b.id)
})

export const passagesByEra: Record<string, Passage[]> = passages.reduce<Record<string, Passage[]>>((acc, p) => {
  ;(acc[p.era] ??= []).push(p)
  return acc
}, {})
