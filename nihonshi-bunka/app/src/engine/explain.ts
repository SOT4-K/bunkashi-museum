// 不正解時に解説シートの先頭へ出す「なぜ違うか」1文。DESIGN.md 3章「解説」1項:
//  選んだ作品が正解作品の confusables に登録されていれば howToTell を使う。
//  無ければ「これは<選んだ作品名>（<文化>）」。Q2（文化選択）や「わからない」の場合は文言を変える。
import type { Era, Question } from '../types'

export type MissSelection = { kind: 'choice'; index: number } | { kind: 'unknown' }

function eraName(eraId: string, eras: Era[]): string {
  return eras.find((e) => e.id === eraId)?.name ?? eraId
}

/**
 * 不正解時の「なぜ違うか」1文を組み立てる。正解時や未対応の入力では空文字を返す。
 */
export function explainMiss(question: Question, selection: MissSelection, eras: Era[]): string {
  if (selection.kind === 'unknown') {
    return '「わからない」を選んだ。'
  }

  if (question.type === 'q2') {
    const chosenEra = question.choiceEras?.[selection.index]
    if (!chosenEra) return ''
    if (chosenEra.id === question.work.era) return '' // 正解を選んでいた場合は何も言わない
    return `これは${chosenEra.name}の作品ではない。`
  }

  const chosenWork = question.choiceWorks[selection.index]
  if (!chosenWork) return ''
  if (chosenWork.id === question.work.id) return '' // 正解時

  const confusable = question.work.confusables.find((c) => c.id === chosenWork.id)
  if (confusable) {
    return `これは${chosenWork.title}。${confusable.howToTell}`
  }
  return `これは${chosenWork.title}（${eraName(chosenWork.era, eras)}）。`
}
