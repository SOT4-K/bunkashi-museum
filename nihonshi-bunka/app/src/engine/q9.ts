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
  /** M2i-05②（decisions.md 2026-09-11、reviewer fact-check-m2i.md q9 43.6%がヘッダーだけで
   *  解けると指摘）: true のとき、試せるスロット（allowSlots/SLOT_PRIORITY の候補のうち3件以上
   *  誤答が作れるもの）の中から target と同じ era（＝ワールド、カテゴリは問わない）の誤答候補が
   *  最も多いスロットを選ぶ。選んだスロットで同era候補が4件以上あれば誤答は同era限定、未満なら
   *  同eraの分をすべて使い、足りない分（3-同era件数）だけ近い時代（隣接文化、カテゴリ一致）から
   *  補う。engine/stages.ts のステージ生成だけが渡す（自由出題・模試・ボスは既定どおり
   *  SLOT_PRIORITY の優先順位＋距離順の窓から選ぶ）。generateNormal のみ対応（generateReversed は
   *  本番でreversed:trueを渡す呼び出し元が無いため未対応）。 */
  preferSameEra?: boolean
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

/** M2i-05c①（decisions.md 2026-09-11、reviewer fact-check-m2i-05b.md [重大]-A(2)「条件値が
 *  『不詳』」の修正）: 値が「不詳」「不明」「未詳」を含む（＝実質的に値が判明していない）場合は
 *  値が無いのと同じ扱いにする。kamakura-daibutsu の patron:"不詳（民間の勧進によると考えられる）"
 *  を条件（「発願者が不詳のもの」）に使うと、誤答側もpatron未記録のため判別不能な設問になっていた
 *  （kamakura★4の70%で発生）。null にすることで、条件文にも誤答除外にも使われなくなる
 *  （effectiveSlotOrder が次の候補スロットに進む）。 */
const UNKNOWN_VALUE_WORDS = ['不詳', '不明', '未詳']

function isUnknownValue(value: string): boolean {
  return UNKNOWN_VALUE_WORDS.some((w) => value.includes(w))
}

/** M2i-05b受け入れ検証用に export（realdataテストが実際の条件文と同じ基準で
 *  「誤答が条件文の上では正解になっていないか」を検証するために使う）。 */
export function slotValue(work: Work, slot: Q9Slot): string | null {
  const raw = rawSlotValue(work, slot)
  if (!raw) return null
  return isUnknownValue(raw) ? null : raw
}

function rawSlotValue(work: Work, slot: Q9Slot): string | null {
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
export function shortenValue(value: string): string {
  return value
    .replace(/（[^）]*）/g, '')
    .split(/[、。]/)[0]
    .trim()
}

/**
 * M2i-05b①（decisions.md 2026-09-11、reviewer fact-check-m2i-05.md [重大]-3「Q9の6.0%で誤答が
 * 条件文の上では正解になっている」の修正）: 条件文は findSite を除き shortenValue（括弧内除去）
 * した値を使う（slotLabel/slotLabelNegated 参照）。しかし誤答除外の値比較（candidateWorksForSlot・
 * generateNormal・generateReversed）は raw 値の完全一致で行っていたため、「仏教」と
 * 「仏教（法相宗）」のように raw 値は異なるが条件文の上では同じに見える値が「異なる値」として
 * 誤答に選ばれ、4択全部が条件を満たす設問が発生していた（実データ回帰: asuka★4
 * 「宗派が仏教のもの」で4択全部仏教）。条件文と同じ基準（findSite だけ raw のまま）で比較する。
 */
function conditionValue(slot: Q9Slot, rawValue: string): string {
  return slot === 'findSite' ? rawValue : shortenValue(rawValue)
}

/** M2i-05c②（decisions.md 2026-09-11、reviewer fact-check-m2i-05b.md [重大]-A(1)「宗派の上位/下位
 *  関係」の修正、対応(b)を採用）: 仏教は密教・浄土教・禅宗・真言宗・律宗等の下位区分（宗派）を持つ
 *  上位概念で、これらは shortenValue 後も別の文字列（「密教」「浄土教」等）のまま残るため
 *  slotValueDiffers（文字列比較）では「異なる値」＝誤答として選ばれてしまう。しかし意味の上では
 *  仏教の下位区分も全て「仏教」を満たすため、4択全部が条件を満たす設問になる（konin-jogan★4
 *  「宗派が仏教のもの」、30 seed中30回）。上位/下位を網羅した包含関係テーブルを持つのは
 *  自由記述フィールドの表記ゆれに対して脆いため、対応(b)（religionスロットの値が広い語のときは
 *  そもそも条件に使わない＝他のスロット・型にフォールバック）を採用する。「仏教」単体（法相宗等の
 *  補足付きも shortenValue で「仏教」になる）だけが実データで確認された広い語。 */
const BROAD_RELIGION_VALUES = new Set(['仏教'])

function isBroadReligionValue(slot: Q9Slot, rawValue: string): boolean {
  return slot === 'religion' && BROAD_RELIGION_VALUES.has(conditionValue(slot, rawValue))
}

/** work の slot 値が、target の条件文の上での値（conditionValue）と異なるか。値が無い（null）
 *  作品は「条件に合わない」として常に異なる扱いにする（従来どおり）。 */
function slotValueDiffers(work: Work, slot: Q9Slot, targetValue: string): boolean {
  const raw = slotValue(work, slot)
  if (!raw) return true
  return conditionValue(slot, raw) !== conditionValue(slot, targetValue)
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

/** 同era（＝ワールド）が4件以上あれば全て同eraから、未満なら同eraぶん＋足りない分だけ
 *  近い時代から補う（preferSameEra、M2i-05②）。 */
const SAME_ERA_EXCLUSIVE_MIN = 4

/** スロットごとの候補2種（preferSameEra専用）:
 *  categoryNear: 既存の near（同カテゴリ・全era、距離昇順）から value が違うものだけを残した集合
 *   （非preferSameEra時と同じ絞り込み。隣接文化から補うときの供給源にする）。
 *  sameEraAny: target と同era（カテゴリ不問）で value が違う作品。M2i-05②の文言「同ワールドの
 *   作品から誤答を作る」はカテゴリを問わないため、near のカテゴリ制限を外して同era全体から集める
 *   （実データ回帰: asuka の religion スロットのように、同カテゴリ内では target と同じ値の作品しか
 *   無く sameEra 候補が0件になるケースがあった。カテゴリを問わなければ候補が見つかることが多い）。 */
function candidateWorksForSlot(
  target: Work,
  pool: Work[],
  near: Work[],
  slot: Q9Slot,
  value: string,
): { categoryNear: Work[]; sameEraAny: Work[] } {
  // M2i-05b①: raw値の完全一致ではなく conditionValue（条件文と同じ基準）で「異なる値」を判定する。
  const categoryNear = near.filter((w) => slotValueDiffers(w, slot, value))
  const sameEraAny = pool.filter((w) => w.id !== target.id && w.era === target.era && slotValueDiffers(w, slot, value))
  return { categoryNear, sameEraAny }
}

/** sameEraAny が4件以上ならそれだけを使う。未満なら sameEraAny 全件＋足りない分
 *  （3-sameEraAny.length）だけ categoryNear の他era分（距離昇順）から補う。 */
function selectPreferSameEraWindow(target: Work, categoryNear: Work[], sameEraAny: Work[]): Work[] {
  if (sameEraAny.length >= SAME_ERA_EXCLUSIVE_MIN) return sameEraAny
  const adjacent = categoryNear.filter((w) => w.era !== target.era)
  const needed = Math.max(3 - sameEraAny.length, 0)
  return [...sameEraAny, ...adjacent.slice(0, needed)]
}

/** preferSameEra: 試せるスロット（value があり、categoryNear∪sameEraAny の併合が3件以上）の中から、
 *  同era候補（sameEraAny）が最も多いスロットを選ぶ（M2i-05②。SLOT_PRIORITY の優先順位より
 *  「ヘッダーだけで解けるのを避けられるか」を優先する。1つでも4件以上のスロットが見つかれば
 *  それ以上探さない＝早期終了）。 */
function generateNormalPreferSameEra(
  target: Work,
  pool: Work[],
  near: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot' | 'allowSlots'>,
): Q9QuestionData | null {
  let best: { slot: Q9Slot; value: string; categoryNear: Work[]; sameEraAny: Work[] } | null = null
  for (const slot of effectiveSlotOrder(opts)) {
    const value = slotValue(target, slot)
    if (!value) continue
    // M2i-05c②: 仏教のような上位語は下位区分（禅宗・浄土教等）も意味的に満たすため、
    // このスロットは条件として使わない（次のスロット・呼び出し元の他の型にフォールバック）。
    if (isBroadReligionValue(slot, value)) continue
    const { categoryNear, sameEraAny } = candidateWorksForSlot(target, pool, near, slot, value)
    const combinedCount = new Set([...categoryNear, ...sameEraAny].map((w) => w.id)).size
    if (combinedCount < 3) continue
    if (!best || sameEraAny.length > best.sameEraAny.length) best = { slot, value, categoryNear, sameEraAny }
    if (best.sameEraAny.length >= SAME_ERA_EXCLUSIVE_MIN) break
  }
  if (!best) return null
  const window = selectPreferSameEraWindow(target, best.categoryNear, best.sameEraAny)
  if (window.length < 3) return null
  const distractorWorks = shuffle(window, rng).slice(0, 3)
  if (distractorWorks.length < 3) return null
  return {
    reversed: false,
    slot: best.slot,
    conditionText: slotLabel(best.slot, best.value, eraNameOf(target.era, eras)),
    correctWork: target,
    distractorWorks,
  }
}

function generateNormal(
  target: Work,
  pool: Work[],
  eras: Era[],
  rng: RandomFn,
  opts: Pick<Q9GenerateOptions, 'avoidSlots' | 'preferredSlot' | 'allowSlots' | 'preferSameEra'>,
): Q9QuestionData | null {
  const eraOrderIndex = eraOrderIndexOf(eras)
  const near = nearbyCandidates(target, pool, eraOrderIndex)
  if (opts.preferSameEra) return generateNormalPreferSameEra(target, pool, near, eras, rng, opts)
  for (const slot of effectiveSlotOrder(opts)) {
    const value = slotValue(target, slot)
    if (!value) continue
    // M2i-05c②: 仏教のような上位語は条件として使わない（generateNormalPreferSameEra と同じ理由）。
    if (isBroadReligionValue(slot, value)) continue
    // M2i-05b①: raw値の完全一致ではなく conditionValue（条件文と同じ基準）で「異なる値」を判定する。
    const candidates = near.filter((w) => slotValueDiffers(w, slot, value))
    if (candidates.length < 3) continue
    // reviewer 指摘 [中]-2（2026-09-04 M2-11）: Math.max だと常に全件を返し、直前の
    // nearbyCandidates による時代距離ソートが無効化されていた。Math.min が正しい
    // （近い時代から最大6件の窓を取り、そこからシャッフルして3件選ぶ）。
    const window = candidates.slice(0, Math.min(candidates.length, 6))
    if (window.length < 3) continue
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
    // M2i-05c②: 仏教のような上位語は「合わない」判定も意味的に壊れる（下位区分の作品を
    // 「仏教でない」の正解にしてしまう）ため、reversed でも条件として使わない。
    if (targetValue && isBroadReligionValue(slot, targetValue)) continue
    // M2i-05b①: raw値そのものではなく conditionValue（条件文と同じ基準）でグループ化する。
    // raw値が違っても条件文の上では同じ値（例: 「仏教」「仏教（法相宗）」）になる作品を
    // 別グループのまま扱うと、target と条件文の上で同じ値を共有するグループを「合わない」
    // 誤答として選んでしまう（4択全部が条件文の上では正解になるバグと同根）。
    const groups = new Map<string, Work[]>()
    for (const w of near) {
      const v = slotValue(w, slot)
      if (!v) continue
      if (targetValue && conditionValue(slot, v) === conditionValue(slot, targetValue)) continue
      const key = conditionValue(slot, v)
      const list = groups.get(key) ?? []
      list.push(w)
      groups.set(key, list)
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
