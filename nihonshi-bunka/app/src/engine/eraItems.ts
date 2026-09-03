// Q6「画像→この作品と同じ文化に属する事項を選べ」の正文・誤文選択。DESIGN.md 10章:
//  正文 = target の文化（era）の items からランダムに1つ。
//  誤文 = 別の文化の items から、近い時代（era.order の差が小さい方）を優先。
//         同じ text が複数の文化の items に登場するものは（target の文化でも真になりうるため）誤文候補から除外する。
//  誤文が3件そろわなければ null。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, EraItemOption, Work } from '../types'

export interface EraItemQuestionData {
  correct: EraItemOption
  /** 常に3件 */
  distractors: EraItemOption[]
  /** 出題対象の作品が属する文化（解説シートで detail の要約を出すために渡す） */
  era: Era
}

/** text -> それを持つ文化の数。2つ以上の文化にまたがる事項は誤文に使わない。 */
function buildTextEraCount(eras: Era[]): Map<string, number> {
  const count = new Map<string, number>()
  for (const era of eras) {
    for (const item of era.items) {
      count.set(item.text, (count.get(item.text) ?? 0) + 1)
    }
  }
  return count
}

export function generateEraItemQuestion(target: Work, eras: Era[], rng: RandomFn): EraItemQuestionData | null {
  const targetEra = eras.find((e) => e.id === target.era)
  if (!targetEra || targetEra.items.length === 0) return null

  const textEraCount = buildTextEraCount(eras)
  const correctItem = targetEra.items[Math.floor(rng() * targetEra.items.length)]
  const correct: EraItemOption = {
    text: correctItem.text,
    correct: true,
    eraId: targetEra.id,
    eraName: targetEra.name,
  }

  const otherErasByDistance = eras
    .filter((e) => e.id !== targetEra.id)
    .map((e) => ({ e, dist: Math.abs(e.order - targetEra.order) }))
    .sort((a, b) => a.dist - b.dist)

  const usedTexts = new Set([correct.text])
  const distractors: EraItemOption[] = []
  for (const { e } of otherErasByDistance) {
    if (distractors.length >= 3) break
    const eligible = e.items.filter((it) => (textEraCount.get(it.text) ?? 0) <= 1 && !usedTexts.has(it.text))
    for (const it of shuffle(eligible, rng)) {
      if (distractors.length >= 3) break
      distractors.push({ text: it.text, correct: false, eraId: e.id, eraName: e.name })
      usedTexts.add(it.text)
    }
  }

  if (distractors.length < 3) return null
  return { correct, distractors, era: targetEra }
}
