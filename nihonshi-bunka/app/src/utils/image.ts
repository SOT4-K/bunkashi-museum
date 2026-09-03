// 作品画像の実体が無ければ、scripts/make-placeholders.mjs が生成したプレースホルダ
// （public/img/<id>.svg）にフォールバックする。
//
// content/images/ を Vite の import.meta.glob で丸ごと取り込むと、他の作業が置いた
// ライセンス未確認・無関係な画像まで dist に同梱されてしまう（実際に事故を起こした。
// .claude/agent-memory/builder/ の教訓を参照）。そのため「ライセンス記録済みかつ
// 作品から参照されている画像だけ」を scripts/sync-real-images.mjs が
// app/public/img/<id>.<ext> にコピーし、対応表を generated/real-images.json に書き出す
// 方式にしている。このファイルは import.meta.glob を使わない。
import type { Work } from '../types'
import realImages from '../generated/real-images.json'

const realImageMap = realImages as Record<string, string>

export function hasRealImage(work: Work): boolean {
  return Boolean(realImageMap[work.id])
}

export function imageSrc(work: Work): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const real = realImageMap[work.id]
  if (real) return `${base}img/${real}`
  return `${base}img/${work.id}.svg`
}
