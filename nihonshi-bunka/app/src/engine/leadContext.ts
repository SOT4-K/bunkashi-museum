// M2-42「全モードで同じ」: 文化別練習（PracticeSessionScreen）・間違いノート復習（MissReviewScreen）は
// 元々テーマセット（リード文＋下線）を経由せず、作品単体から Question を組み立てる設計
// （engine/practiceSession.ts・engine/missLog.ts のコメント参照。文脈から切り離すのが元の意図）。
// リード文ボタン・リード画像常時表示（M2-52）を「全モードで同じ」にするため、best-effort で
// 「この作品を対象にしている最初の下線」を passages から逆引きする。見つからなければ null を返し、
// 呼び出し側は既存の「省略時はボタンを出さない」パターンに従ってリード文ボタンを出さない
// （見つからない＝その作品を素材にした passage がまだ無い、または画像なし対象で下線から拾えない）。
import { pickThemeTargetId } from './themeSet'
import type { Passage, Work } from '../types'

export interface LeadContext {
  passage: Passage
  underlineKey: string
}

export function findLeadContextForWork(workId: string, passages: Passage[], pool: Work[]): LeadContext | null {
  const availableIds = new Set(pool.map((w) => w.id))
  for (const passage of passages) {
    for (const underline of passage.underlines) {
      const targetId = pickThemeTargetId(underline, passage, availableIds)
      if (targetId === workId) return { passage, underlineKey: underline.key }
    }
  }
  return null
}
