// Q4「画像→この作品に関する記述として正しいものを選べ」の正文・誤文選択。DESIGN.md 10章:
//  正文 = target.facts からランダムに1つ。
//  誤文 = 優先順に (a) target.falseStatements（verifiedFalse のみ）
//         (b) 他作品の facts で同じ slot の文。ただし
//             - fact.shared に target の id が含まれるもの（target にも当てはまる＝真）
//             - target 自身の facts と同文のもの
//             - target の同 slot の値と一致するもの（slot が era/period なら era が同じ）
//         は除外する。
//  誤文が3件そろわなければ null（Q4 を出さない）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { StatementOption, Work } from '../types'

export interface StatementQuestionData {
  correct: StatementOption
  /** 常に3件（揃わない場合は generateStatementQuestion が null を返す） */
  distractors: StatementOption[]
}

/** slot 名から Work の対応フィールドへのマッピング。'other' や未知の slot は値の同一性を判定できない。 */
const SLOT_FIELD: Partial<Record<string, keyof Work>> = {
  patron: 'patron',
  artist: 'artist',
  technique: 'technique',
  style: 'style',
  religion: 'religion',
  location: 'location',
}

/**
 * candidateWork の slot の値が target にとっても真かどうか（＝誤文として使えない）を判定する。
 * era/period は「era が同じなら真」というブロックルール（DESIGN.md 10章「誤文の作り方」）。
 */
function slotValueMatchesTarget(target: Work, candidateWork: Work, slot: string): boolean {
  if (slot === 'era' || slot === 'period') {
    return candidateWork.era === target.era
  }
  const field = SLOT_FIELD[slot]
  if (!field) return false
  const targetValue = target[field]
  const candidateValue = candidateWork[field]
  if (targetValue == null || candidateValue == null) return false
  return targetValue === candidateValue
}

function pickCorrectFact(target: Work, rng: RandomFn): StatementOption | null {
  if (target.facts.length === 0) return null
  const fact = target.facts[Math.floor(rng() * target.facts.length)]
  return { text: fact.text, correct: true, why: null }
}

/**
 * 誤文候補プールを (a) falseStatements 由来 / (b) 他作品の facts 由来 に分けて返す
 * （優先順位を保ったまま呼び出し側で必要数だけ使うため）。除外規則の単体テストのため export する。
 */
export function verifiedFalseStatementCandidates(target: Work): StatementOption[] {
  return target.falseStatements
    .filter((f) => f.verifiedFalse)
    .map((f) => ({ text: f.text, correct: false, why: f.why }))
}

export function otherWorkFactCandidates(target: Work, pool: Work[]): StatementOption[] {
  const ownTexts = new Set(target.facts.map((f) => f.text))
  const candidates: StatementOption[] = []
  for (const w of pool) {
    if (w.id === target.id) continue
    for (const fact of w.facts) {
      if (fact.shared?.includes(target.id)) continue
      if (ownTexts.has(fact.text)) continue
      if (slotValueMatchesTarget(target, w, fact.slot)) continue
      candidates.push({ text: fact.text, correct: false, why: `これは${w.title}の説明。` })
    }
  }
  return candidates
}

function dedupeByText(options: StatementOption[], excludeTexts: Set<string>): StatementOption[] {
  const seen = new Set(excludeTexts)
  const out: StatementOption[] = []
  for (const o of options) {
    if (seen.has(o.text)) continue
    seen.add(o.text)
    out.push(o)
  }
  return out
}

export function generateStatementQuestion(
  target: Work,
  pool: Work[],
  rng: RandomFn,
): StatementQuestionData | null {
  const correct = pickCorrectFact(target, rng)
  if (!correct) return null

  const excludeTexts = new Set([correct.text])
  const verified = dedupeByText(shuffle(verifiedFalseStatementCandidates(target), rng), excludeTexts)

  let chosen: StatementOption[] = verified
  if (chosen.length < 3) {
    const usedTexts = new Set([...excludeTexts, ...chosen.map((c) => c.text)])
    const fromOthers = dedupeByText(shuffle(otherWorkFactCandidates(target, pool), rng), usedTexts)
    chosen = [...chosen, ...fromOthers]
  }

  if (chosen.length < 3) return null
  return { correct, distractors: chosen.slice(0, 3) }
}
