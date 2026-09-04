// Q9「画像4枚が選択肢。条件に合う1枚を選ぶ／合わない1枚を選ぶ」。M2 チケット（テーマセット）新設。
// mock-exam-analysis.md T-C: 条件は作者・時代文化・所蔵・様式のいずれか。この優先順位で試す。
// 正パターン: target が条件に合う（正解）。distractor 3件は同カテゴリ・近い時代から、
//   条件に合わない（値が違う）ものだけを選ぶ。
// 逆パターン（reversed）: 同カテゴリ・近い時代の作品群の中で、target 以外の3件が同じ値を
//   共有する条件を探し、target はそれに当てはまらない（＝「合わない1枚」＝正解）。
import type { RandomFn } from './distractors'
import { shuffle } from './distractors'
import type { Era, Q9Slot, Work } from '../types'

export type { Q9Slot } from '../types'

export interface Q9QuestionData {
  reversed: boolean
  slot: Q9Slot
  conditionText: string
  correctWork: Work
  /** 常に3件 */
  distractorWorks: Work[]
}

export interface Q9GenerateOptions {
  reversed?: boolean
  /** このスロットは試さない（例: 1セットに1問までの era をすでに使った）。修正の仕様（M2-09〜11）。 */
  avoidSlots?: Q9Slot[]
  /** この下線の ask.slot（あれば最優先で試す。失敗すれば通常の優先順位に落ちる）。 */
  preferredSlot?: Q9Slot
}

/** 試す順序（修正の仕様 M2-09〜11: holder→artist→technique→era。era は最後＝1セット1問までにする）。 */
const SLOT_PRIORITY: Q9Slot[] = ['holder', 'artist', 'technique', 'era']

function slotValue(work: Work, slot: Q9Slot): string | null {
  switch (slot) {
    case 'artist':
      return work.artist
    case 'era':
      return work.era
    case 'holder':
      return work.holder ?? null
    case 'style':
      return work.style
    case 'technique':
      // technique は必須の string フィールドだが未設定は空文字（testFixtures.makeWork 参照）。
      // 空文字は「値が無い」として扱う。
      return work.technique || null
  }
}

/**
 * value から括弧内の補足（撮影者・年代等）と読点以降の説明を落とし、設問の条件文に使える
 * 短い語だけを残す。reviewer 指摘（2026-09-04 M2-11 [中]-3）: 長い technique/holder の値を
 * そのまま条件文に使うと、答えの説明（年号・技法の由来など）を先に与えてしまう。
 */
function shortenValue(value: string): string {
  return value
    .replace(/（[^）]*）/g, '')
    .split(/[、。]/)[0]
    .trim()
}

/**
 * 条件文（「〜のもの」の形。「〜でないもの」は slotLabelNegated）。
 * reviewer 指摘 [中]-3: 「の作品のもの」の重複、建築・庭園に「所蔵する」は不適切
 * （「〜にある」に統一）を修正。
 */
function slotLabel(slot: Q9Slot, rawValue: string, eraName: string): string {
  const value = shortenValue(rawValue)
  switch (slot) {
    case 'artist':
      return `作者が${value}のもの`
    case 'era':
      return `${eraName}のもの`
    case 'holder':
      return `${value}にあるもの`
    case 'style':
      return `${value}の様式のもの`
    case 'technique':
      return `製法が${value}のもの`
  }
}

/** 「〜でないもの」（逆パターン）版。slotLabel と同じ短縮・語尾統一を行う。 */
function slotLabelNegated(slot: Q9Slot, rawValue: string, eraName: string): string {
  const value = shortenValue(rawValue)
  switch (slot) {
    case 'artist':
      return `作者が${value}でないもの`
    case 'era':
      return `${eraName}でないもの`
    case 'holder':
      return `${value}にないもの`
    case 'style':
      return `${value}の様式でないもの`
    case 'technique':
      return `製法が${value}でないもの`
  }
}

/** ask.slot / avoidSlots を反映した、実際に試すスロット順。preferredSlot があれば先頭に回す。 */
function effectiveSlotOrder(opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot'>): Q9Slot[] {
  const avoid = new Set(opts.avoidSlots ?? [])
  const base = SLOT_PRIORITY.filter((s) => !avoid.has(s))
  if (opts.preferredSlot && !avoid.has(opts.preferredSlot) && base.includes(opts.preferredSlot)) {
    return [opts.preferredSlot, ...base.filter((s) => s !== opts.preferredSlot)]
  }
  return base
}

function eraOrderIndexOf(eras: Era[]): Record<string, number> {
  return Object.fromEntries(eras.map((e) => [e.id, e.order]))
}

function eraNameOf(eraId: string, eras: Era[]): string {
  return eras.find((e) => e.id === eraId)?.name ?? eraId
}

/** 同カテゴリ・近い時代順に並べた target 以外の作品。 */
function nearbyCandidates(target: Work, pool: Work[], eraOrderIndex: Record<string, number>): Work[] {
  const targetOrder = eraOrderIndex[target.era] ?? 0
  return pool
    .filter((w) => w.id !== target.id && w.category === target.category)
    .map((w) => ({ w, dist: Math.abs((eraOrderIndex[w.era] ?? 0) - targetOrder) }))
    .sort((a, b) => a.dist - b.dist)
    .map((x) => x.w)
}

function generateNormal(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot'>,
): Q9QuestionData | null {
  const eraOrderIndex = eraOrderIndexOf(eras)
  const near = nearbyCandidates(target, pool, eraOrderIndex)
  for (const slot of effectiveSlotOrder(opts)) {
    const value = slotValue(target, slot)
    if (!value) continue
    const candidates = near.filter((w) => slotValue(w, slot) !== value)
    if (candidates.length < 3) continue
    // reviewer 指摘 [中]-2（2026-09-04 M2-11）: Math.max だと常に全件を返し、直前の
    // nearbyCandidates による時代距離ソートが無効化されていた。Math.min が正しい
    // （近い時代から最大6件の窓を取り、そこからシャッフルして3件選ぶ）。
    const window = candidates.slice(0, Math.min(candidates.length, 6))
    const distractorWorks = shuffle(window, rng).slice(0, 3)
    if (distractorWorks.length < 3) continue
    return {
      reversed: false,
      slot,
      conditionText: slotLabel(slot, value, eraNameOf(target.era, eras)),
      correctWork: target,
      distractorWorks,
    }
  }
  return null
}

function generateReversed(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot'>,
): Q9QuestionData | null {
  const eraOrderIndex = eraOrderIndexOf(eras)
  const near = nearbyCandidates(target, pool, eraOrderIndex)
  for (const slot of effectiveSlotOrder(opts)) {
    const targetValue = slotValue(target, slot)
    const groups = new Map<string, Work[]>()
    for (const w of near) {
      const v = slotValue(w, slot)
      if (!v || v === targetValue) continue
      const list = groups.get(v) ?? []
      list.push(w)
      groups.set(v, list)
    }
    const eligible = shuffle(
      [...groups.entries()].filter(([, list]) => list.length >= 3),
      rng,
    )
    if (eligible.length === 0) continue
    const [value, list] = eligible[0]
    const distractorWorks = shuffle(list, rng).slice(0, 3)
    return {
      reversed: true,
      slot,
      conditionText: slotLabelNegated(slot, value, eraNameOf(distractorWorks[0].era, eras)),
      correctWork: target,
      distractorWorks,
    }
  }
  return null
}

export function generateQ9Question(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Q9GenerateOptions = {},
): Q9QuestionData | null {
  return opts.reversed ? generateReversed(target, pool, eras, rng, opts) : generateNormal(target, pool, eras, rng, opts)
}

/**
 * 8章「二段構え」: writer が answerId/distractorIds を直接指定した Q9。stem が既に
 * 「〜はどれか」で完結しているため conditionText は使わない（空文字を返す）。
 * distractorIds が3件そろわなければ、同カテゴリ・近い時代の候補（q9.ts 既存ロジック）で
 * 不足分だけ補充する。answerId が pool に見つからなければ null（呼び出し側で次善にフォールバック）。
 */
export function generateQ9QuestionFromIds(
  pool: Work[],
  answerId: string,
  distractorIds: string[] | undefined,
  eras: Era[],
  rng: RandomFn,
): Q9QuestionData | null {
  const correctWork = pool.find((w) => w.id === answerId)
  if (!correctWork) return null

  const byId = new Map(pool.map((w) => [w.id, w]))
  const explicit: Work[] = []
  const seen = new Set<string>([correctWork.id])
  for (const id of distractorIds ?? []) {
    const w = byId.get(id)
    if (!w || seen.has(w.id)) continue
    explicit.push(w)
    seen.add(w.id)
  }

  let distractorWorks = explicit.slice(0, 3)
  if (distractorWorks.length < 3) {
    const eraOrderIndex = eraOrderIndexOf(eras)
    const near = nearbyCandidates(correctWork, pool, eraOrderIndex).filter((w) => !seen.has(w.id))
    const need = 3 - distractorWorks.length
    const window = shuffle(near.slice(0, Math.max(need, 6)), rng)
    for (const w of window) {
      if (distractorWorks.length >= 3) break
      distractorWorks.push(w)
      seen.add(w.id)
    }
  }
  if (distractorWorks.length < 3) return null

  return {
    reversed: false,
    // slot は「1セットに1問まで」の era 判定にのみ使う内部情報。二段構えの条件は stem に
    // 既に書かれているため、era 以外の任意の値でよい。
    slot: 'artist',
    conditionText: '',
    correctWork,
    distractorWorks,
  }
}
