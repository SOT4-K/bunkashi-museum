// 文化別練習（学習タブ）の時代3グループ分け。M2-22。
// research/nichidai-past-exams-analysis.md 8章「学習タブの並べ方: 時代3グループの中に文化を
// 並べる（古代: 原始・飛鳥・白鳳・天平・弘仁貞観・国風／中世: 院政期・鎌倉・北山・東山／
// 近世: 桃山・寛永期・元禄・宝暦天明・化政）」。この境目は eras.json の order フィールド
// （1始まり、時代順）にそのまま対応する（1〜6=古代、7〜10=中世、11〜15=近世）。
// 区分数が変わった場合もこの order による判定なら自動で追随する（id を決め打ちで並べない）。
import { isItemMastered } from './srs'
import type { Era, ProgressState, Work } from '../types'

export type EraGroupId = 'kodai' | 'chusei' | 'kinsei'

export interface EraGroup {
  id: EraGroupId
  label: string
  eras: Era[]
}

const KODAI_MAX_ORDER = 6
const CHUSEI_MAX_ORDER = 10

export function groupErasByPeriod(eras: Era[]): EraGroup[] {
  const sorted = [...eras].sort((a, b) => a.order - b.order)
  const groups: EraGroup[] = [
    { id: 'kodai', label: '古代', eras: sorted.filter((e) => e.order <= KODAI_MAX_ORDER) },
    { id: 'chusei', label: '中世', eras: sorted.filter((e) => e.order > KODAI_MAX_ORDER && e.order <= CHUSEI_MAX_ORDER) },
    { id: 'kinsei', label: '近世', eras: sorted.filter((e) => e.order > CHUSEI_MAX_ORDER) },
  ]
  return groups.filter((g) => g.eras.length > 0)
}

export interface CultureStats {
  total: number
  mastered: number
  masteryRatio: number
  /** 直近の正答率（q1/q2/q3 の累計 correct/(correct+wrong)）。一度も出題していなければ null。 */
  accuracyRatio: number | null
}

/** ある文化の習熟度（図鑑の所蔵率）と正答率。HomeScreen の eraStats と同じ考え方（M2-22）。 */
export function cultureStats(eraId: string, works: Work[], progress: ProgressState): CultureStats {
  const eraWorks = works.filter((w) => w.era === eraId)
  const total = eraWorks.length
  const mastered = eraWorks.filter((w) => {
    const item = progress.items[w.id]
    return item ? isItemMastered(item) : false
  }).length
  let correct = 0
  let wrong = 0
  for (const w of eraWorks) {
    const item = progress.items[w.id]
    if (!item) continue
    correct += item.q1.correct + item.q2.correct + item.q3.correct
    wrong += item.q1.wrong + item.q2.wrong + item.q3.wrong
  }
  const attempts = correct + wrong
  return {
    total,
    mastered,
    masteryRatio: total > 0 ? mastered / total : 0,
    accuracyRatio: attempts > 0 ? correct / attempts : null,
  }
}
