// ワールドマップの時代テーマ（M2d-01、BOARD.md「M2d ワールド内マップと時代別ビジュアル」）。
// content/worlds.json はテーマデータの器（チケット文面どおり）。ここは純関数のみ
// （コードにモチーフの中身をハードコードしない。中身はデータ、描画は components/WorldMotifIcons.tsx）。
import type { WorldTheme } from '../types'

/**
 * worlds.json にまだ無い eraId（M2d-01 時点では15ワールド全件を用意しているが、将来
 * データ欠損があっても壊れないための安全網）向けの既定テーマ＝「無地のパレットのみ」
 * （チケット文面の13ワールドと同じ色。motifs は空配列）。
 */
export const DEFAULT_WORLD_THEME: Omit<WorldTheme, 'eraId'> = {
  palette: { sky: '#dbe6f0', ground: '#c9d6c0', road: '#8fa3b0', accent: '#5b7083' },
  bossShape: 'default',
  motifs: [],
}

/** eraId のテーマを引く。無ければ既定テーマ（無地）にフォールバックする。 */
export function getWorldTheme(themesById: Record<string, WorldTheme>, eraId: string): WorldTheme {
  return themesById[eraId] ?? { eraId, ...DEFAULT_WORLD_THEME }
}
