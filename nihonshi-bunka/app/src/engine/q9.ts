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
  /** M2i（★2〜★5固定スロット）: 指定した場合、このスロット集合だけを試す（SLOT_PRIORITY による
   *  既定の優先順位・avoidSlots は無視し、ここに列挙した順で試す）。省略時は従来どおり
   *  SLOT_PRIORITY（自由出題・模試・ボス向けの既定の優先順位）を使う。 */
  allowSlots?: Q9Slot[]
}

/** 試す順序（修正の仕様 M2-09〜11: holder→artist→technique→era。era は最後＝1セット1問までにする）。
 *  M2b-14: findSite（出土地）は holder より先に試す（出土地の設問は入試に出るため優先し、
 *  博物館収蔵の出土品でも「どこで出土したか」を問える）。
 *  M2i: ★2〜★5のステージ・ボスは allowSlots で明示的にスロットを固定するため、ここには
 *  location/subject/patron/religion（M2i で追加した新スロット）を含めない（自由出題・模試の
 *  既定挙動を変えないため。既存の呼び出し元は allowSlots を渡さず、この配列だけを見る）。 */
const SLOT_PRIORITY: Q9Slot[] = ['findSite', 'holder', 'artist', 'technique', 'era']

/** scripts/validate-content.mjs の HOLDER_WORDS と同じ語（重複実装。plain .mjs から TS を直接
 *  import できないため）。M2i 実データ回帰（hakuho-3-1: yamadadera-butsuzu の location「興福寺
 *  国宝館」が holderKind: 'site' でも「国宝館」という所蔵語を含んでいた）を受け、holderKind だけ
 *  では防げない所蔵語混入を値そのものでも弾く。 */
const MUSEUM_LIKE_WORDS = ['博物館', '美術館', '文庫', '記念館', '図書館', '資料館', '尚蔵館', '国宝館', 'コレクション']

/** value に所蔵語（博物館・美術館等）が含まれるか。engine/stages.ts の hasStar（★3判定）からも
 *  同じ語で判定できるよう export する。 */
export function containsMuseumWord(value: string): boolean {
  return MUSEUM_LIKE_WORDS.some((w) => value.includes(w))
}

function slotValue(work: Work, slot: Q9Slot): string | null {
  switch (slot) {
    case 'artist':
      return work.artist
    case 'era':
      return work.era
    case 'holder': {
      // M2b-14: holderKind === 'site'（寺社・堂・遺跡・城など）の作品でしか holder 条件を
      // 使わない。博物館・美術館等（holderKind: 'museum'）は「東京国立博物館にあるものを
      // 選べ」のような入試に出ない設問になるため、holder スロット自体を使えなくする
      // （値を null として返し、SLOT_PRIORITY の次の候補に進ませる）。
      // M2i実データ回帰: holderKind==='site'でも値そのものに所蔵語（「興福寺国宝館」等）が
      // 含まれることがあるため、そちらも弾く（MUSEUM_LIKE_WORDS参照）。
      if (work.holderKind !== 'site' || !work.holder) return null
      return containsMuseumWord(work.holder) ? null : work.holder
    }
    case 'findSite':
      return work.findSite ?? null
    case 'style':
      return work.style
    case 'technique':
      // technique は必須の string フィールドだが未設定は空文字（testFixtures.makeWork 参照）。
      // 空文字は「値が無い」として扱う。
      return work.technique || null
    case 'location': {
      // M2i ★3「出土地・所在地」: holder と同じく holderKind === 'site' の作品でしか使わない
      // （博物館収蔵品の所在地を問うと「東京国立博物館にあるものを選べ」になってしまうため。
      // M2b-14 の決定と同じ理由）。値は BOARD.md M2i の決定どおり work.location を使う
      // （holder より地名・寺社名が読み取りやすい表記のため）。所蔵語混入も holder と同様に弾く
      // （実データ回帰: yamadadera-butsuzu の location「興福寺国宝館」）。
      if (work.holderKind !== 'site' || !work.location) return null
      return containsMuseumWord(work.location) ? null : work.location
    }
    case 'subject':
      return work.subject ?? null
    case 'patron':
      return work.patron ?? null
    case 'religion':
      return work.religion ?? null
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
  // M2b-14: findSite は「青森県つがる市（亀ヶ岡遺跡）」のように括弧内が遺跡名の本体で、
  // shortenValue（括弧内除去）を適用すると肝心の遺跡名が消えてしまう。他スロットと違い
  // 短縮しない。
  if (slot === 'findSite') return `${rawValue}で出土したもの`
  const value = shortenValue(rawValue)
  switch (slot) {
    case 'artist':
      return `作者が${value}のもの`
    case 'era':
      return `${eraName}のもの`
    case 'holder':
      return `${value}にあるもの`
    case 'location':
      return `${value}にあるもの`
    case 'style':
      return `${value}の様式のもの`
    case 'technique':
      return `製法が${value}のもの`
    case 'subject':
      return `${value}を主題とするもの`
    case 'patron':
      return `発願者（建立者）が${value}のもの`
    case 'religion':
      return `宗派（宗教）が${value}のもの`
  }
}

/** 「〜でないもの」（逆パターン）版。slotLabel と同じ短縮・語尾統一を行う。 */
function slotLabelNegated(slot: Q9Slot, rawValue: string, eraName: string): string {
  if (slot === 'findSite') return `${rawValue}で出土したものでないもの`
  const value = shortenValue(rawValue)
  switch (slot) {
    case 'artist':
      return `作者が${value}でないもの`
    case 'era':
      return `${eraName}でないもの`
    case 'holder':
      return `${value}にないもの`
    case 'location':
      return `${value}にないもの`
    case 'style':
      return `${value}の様式でないもの`
    case 'technique':
      return `製法が${value}でないもの`
    case 'subject':
      return `${value}を主題としないもの`
    case 'patron':
      return `発願者（建立者）が${value}でないもの`
    case 'religion':
      return `宗派（宗教）が${value}でないもの`
  }
}

/** ask.slot / avoidSlots / allowSlots を反映した、実際に試すスロット順。preferredSlot があれば
 *  先頭に回す。allowSlots が指定されているときは SLOT_PRIORITY を無視し、allowSlots に列挙した
 *  順だけを試す（M2i: ★2〜★5のステージ・ボスがスロットを固定するために使う）。 */
function effectiveSlotOrder(opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot' | 'allowSlots'>): Q9Slot[] {
  const avoid = new Set(opts.avoidSlots ?? [])
  const base = (opts.allowSlots ?? SLOT_PRIORITY).filter((s) => !avoid.has(s))
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
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot' | 'allowSlots'>,
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
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot' | 'allowSlots'>,
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
