// リード文の `[[key|下線テキスト]]` マーカー解析。M2 チケット「テーマセット・モード」。
// scripts/validate-content.mjs も同じマーカー形式のキー整合チェックを行う（Node 単体で動く
// プレーン JS のため、ここのロジックを import はできず同等の正規表現を重複実装している。
// 変更するときは両方揃える。差分は無いか __tests__/passage.test.ts で固定している）。
import type { Passage, PassageUnderline } from '../types'

export const UNDERLINE_MARKER = /\[\[([a-zA-Z0-9_-]+)\|([^\]]*)\]\]/g

export type PassageSegment = { type: 'text'; value: string } | { type: 'underline'; key: string; value: string }

/** `[[key|text]]` マーカーを含む本文を、地の文と下線部のセグメント列に分解する。 */
export function splitPassageText(text: string): PassageSegment[] {
  const segments: PassageSegment[] = []
  let lastIndex = 0
  const re = new RegExp(UNDERLINE_MARKER)
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'underline', key: match[1], value: match[2] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments
}

/** 本文中に出現する下線キー（出現順、重複除去なし＝重複キーがあれば呼び出し側で検出可能）。 */
export function extractUnderlineKeys(text: string): string[] {
  return splitPassageText(text)
    .filter((s): s is Extract<PassageSegment, { type: 'underline' }> => s.type === 'underline')
    .map((s) => s.key)
}

export interface PassageConsistencyResult {
  ok: boolean
  /** underlines に無いのに本文に出現するキー */
  missingInUnderlines: string[]
  /** 本文に出現しないのに underlines にあるキー */
  missingInText: string[]
  /** 本文中で複数回使われているキー */
  duplicateInText: string[]
}

/** text 内のマーカーと underlines[].key が過不足なく一致するかを検証する（validate-content.mjs 用の仕様確認）。 */
export function checkPassageConsistency(passage: Pick<Passage, 'text' | 'underlines'>): PassageConsistencyResult {
  const textKeys = extractUnderlineKeys(passage.text)
  const textKeySet = new Set(textKeys)
  const underlineKeySet = new Set(passage.underlines.map((u) => u.key))

  const missingInUnderlines = [...textKeySet].filter((k) => !underlineKeySet.has(k))
  const missingInText = [...underlineKeySet].filter((k) => !textKeySet.has(k))

  const seen = new Set<string>()
  const duplicateInText: string[] = []
  for (const k of textKeys) {
    if (seen.has(k)) duplicateInText.push(k)
    seen.add(k)
  }

  return {
    ok: missingInUnderlines.length === 0 && missingInText.length === 0 && duplicateInText.length === 0,
    missingInUnderlines,
    missingInText,
    duplicateInText,
  }
}

/** 指定した下線キーの周辺テキスト（前後1セグメント程度）を「文脈再表示」用に抜き出す。プレーンテキストで返す。 */
export function excerptAroundUnderline(passage: Pick<Passage, 'text'>, key: string): string {
  const segments = splitPassageText(passage.text)
  const idx = segments.findIndex((s) => s.type === 'underline' && s.key === key)
  if (idx === -1) return ''
  return segments
    .map((s) => (s.type === 'underline' ? s.value : s.value))
    .join('')
}

/**
 * 指定した下線キーを含む1〜2文だけを抜き出す（M2-21「ランダム学習」9章。「下線部を含む
 * 1〜2文＋設問」の見え方）。文境界は「。」で判定する。対象の文が短い（40字未満）ときは
 * 前の文も含めて2文にする（文脈が薄すぎるのを避ける）。マーカーが見つからなければ本文全体を
 * そのまま返す（後方互換のフォールバック。呼び出し側で異常な underline key を渡した場合など）。
 * 戻り値は splitPassageText と同じ Segment 列（下線ハイライトの描画にそのまま使える）。
 */
export function excerptSegmentsForUnderline(text: string, key: string): PassageSegment[] {
  const re = new RegExp(UNDERLINE_MARKER)
  let match: RegExpExecArray | null
  let range: [number, number] | null = null
  while ((match = re.exec(text))) {
    if (match[1] === key) {
      range = [match.index, match.index + match[0].length]
      break
    }
  }
  if (!range) return splitPassageText(text)
  const [start, end] = range

  const sentenceStart = text.lastIndexOf('。', start) + 1
  const nextPeriod = text.indexOf('。', end)
  const sentenceEnd = nextPeriod === -1 ? text.length : nextPeriod + 1

  const MIN_LEN = 40
  if (sentenceEnd - sentenceStart < MIN_LEN && sentenceStart > 0) {
    const prevStart = text.lastIndexOf('。', sentenceStart - 2) + 1
    return splitPassageText(text.slice(prevStart, sentenceEnd).trim())
  }
  return splitPassageText(text.slice(sentenceStart, sentenceEnd).trim())
}

/**
 * underline に紐づく最初の「出題プールにある作品」を返す（テーマセット構築で使う）。
 * kind: "image" の q12 下線（9章）は作品を直接問わないため workIds を持たないことがある
 * （Hayato 修正、2026-09-04 M2-13 統合時: 未定義のまま .find() すると例外で本番ビルドが
 * 落ちていた）。その場合は null を返し、呼び出し側（themeSet.ts の pickThemeTargetId）で
 * passage.leadWorkIds へのフォールバックに委ねる。
 */
export function pickUnderlineTargetId(underline: PassageUnderline, availableIds: Set<string>): string | null {
  if (!underline.workIds || underline.workIds.length === 0) return null
  return underline.workIds.find((id) => availableIds.has(id)) ?? null
}
