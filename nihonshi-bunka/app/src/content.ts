// content/ 以下（app/ の外、nihonshi-bunka/content/）を Vite の import.meta.glob で読み込む。
// このファイル（app/src/content.ts）から見ると content/ は2階層上（app/src → app → nihonshi-bunka → content）。
// vite.config.ts の server.fs.allow に '..' を追加してある。
import type { Era, Work } from './types'

const eraModules = import.meta.glob('../../content/eras.json', {
  eager: true,
  import: 'default',
}) as Record<string, Era[]>

const workModules = import.meta.glob('../../content/works/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Work[]>

const rawEras: Era[] = Object.values(eraModules)[0] ?? []

const rawWorks: Work[] = Object.values(workModules).flat()

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

export const worksById: Record<string, Work> = Object.fromEntries(works.map((w) => [w.id, w]))

export const erasById: Record<string, Era> = Object.fromEntries(eras.map((e) => [e.id, e]))

export function worksByEra(eraId: string): Work[] {
  return works.filter((w) => w.era === eraId)
}
