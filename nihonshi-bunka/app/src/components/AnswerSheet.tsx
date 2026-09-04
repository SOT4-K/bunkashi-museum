import { useState } from 'react'
import styles from './AnswerSheet.module.css'
import { BottomSheet } from './BottomSheet'
import { WorkImage } from './WorkImage'
import { ImageLightbox } from './ImageLightbox'
import { imageSrc } from '../utils/image'
import { explainMiss, type MissSelection } from '../engine/explain'
import type { Era, Question, Work } from '../types'

function excerpt(text: string, maxSentences = 2): string {
  const sentences = text.split('。').filter((s) => s.trim().length > 0)
  if (sentences.length === 0) return text
  return sentences.slice(0, maxSentences).join('。') + '。'
}

function eraNameOf(eraId: string, eras: Era[]): string {
  return eras.find((e) => e.id === eraId)?.name ?? eraId
}

export function AnswerSheet({
  question,
  selection,
  correct,
  eras,
  isNewDiscovery,
  isNewlyMastered,
  nextLabel,
  onNext,
}: {
  question: Question
  selection: MissSelection
  correct: boolean
  eras: Era[]
  isNewDiscovery: boolean
  isNewlyMastered: boolean
  nextLabel: string
  onNext: () => void
}) {
  const work = question.work
  const whyWrong = correct ? '' : explainMiss(question, selection, eras)
  const isUnknown = selection.kind === 'unknown'

  const otherWorks =
    question.type === 'q1' || question.type === 'q3' || question.type === 'q9'
      ? question.choiceWorks.filter((w) => w.id !== work.id)
      : []
  const otherEras =
    question.type === 'q2' ? (question.choiceEras ?? []).filter((e) => e.id !== work.era) : []

  // q12/q13/q14 は work.title ではなく writer 手書き・生成済みの選択肢テキストが「正解」
  // （M2-99 reviewer 指摘: 「正解は{work.title}」が常に表示され、文字4択の設問では
  //  正解の選択肢と無関係な作品名が出てしまっていた）
  const correctAnswerLabel =
    question.type === 'q12'
      ? (question.choiceQ12?.find((s) => s.correct)?.text ?? work.title)
      : question.type === 'q13'
        ? (question.choiceWordPairs?.find((c) => c.correct)?.text ?? work.title)
        : question.type === 'q14'
          ? (question.choiceStatements?.find((c) => c.correct)?.text ?? work.title)
          : work.title

  const targetEra = eras.find((e) => e.id === work.era)
  // Q6 の「正解の文化」の detail を1〜2文だけ添える（DESIGN.md 10章「解説の拡張」）
  const correctEraDetailExcerpt =
    question.type === 'q6' && targetEra?.detail ? excerpt(targetEra.detail, 2) : ''

  const [lightboxWork, setLightboxWork] = useState<Work | null>(null)

  return (
    <BottomSheet
      label="解説"
      footer={
        <button type="button" data-testid="next-button" className={styles.nextButton} onClick={onNext}>
          {nextLabel}
        </button>
      }
    >
      <div
        className={`${styles.judgement} ${correct ? styles.judgementCorrect : styles.judgementWrong}`}
        data-testid="judgement"
      >
        {isUnknown ? (
          <span>未回答</span>
        ) : correct ? (
          <span className="caption-bold">◎ 正解</span>
        ) : (
          <span className="caption-bold">
            ✗ 不正解 — 正解は「{correctAnswerLabel}」
          </span>
        )}
      </div>
      {whyWrong && <p className={styles.whyWrong}>{whyWrong}</p>}

      {(work.periodLabel || targetEra) && (
        <div className={styles.periodBlock}>
          <div className={`${styles.periodLabel} caption-bold`}>
            {work.periodLabel}
            {work.periodLabel && targetEra ? '・' : ''}
            {targetEra?.name ?? ''}
          </div>
          {work.eraNote && <p className={styles.eraNote}>{work.eraNote}</p>}
        </div>
      )}

      <div className={styles.correctBlock}>
        <button
          type="button"
          className={styles.correctImage}
          onClick={() => setLightboxWork(work)}
          aria-label={`${work.title}を拡大表示`}
        >
          <WorkImage src={imageSrc(work)} alt={work.title} />
        </button>
        <div className={styles.correctMeta}>
          <div className={`${styles.workTitle} caption-bold`}>{work.title}</div>
          <div className={styles.workReading}>{work.reading}</div>
          <div className={styles.workFacts}>
            {eraNameOf(work.era, eras)}・{work.location}
            {work.technique ? `・${work.technique}` : ''}
          </div>
          {/* M2-43: 解説シートに時代・文化・作者を必ず表示する（不明は「作者不明」。空欄禁止）。
              時代（work.periodLabel）・文化（targetEra.name）は periodBlock で既に表示している。 */}
          <div className={styles.workAuthor} data-testid="answer-author">
            作者: {work.author ?? '作者不明'}
          </div>
        </div>
      </div>

      {work.keyPoints.length > 0 && (
        <ul className={styles.keyPoints}>
          {work.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}

      <p className={styles.explanation}>{work.explanation}</p>

      {isNewDiscovery && <p className={styles.sectionLabel}>図鑑に追加した。</p>}
      {isNewlyMastered && <p className={styles.sectionLabel}>図鑑に所蔵した。</p>}

      {(otherWorks.length > 0 || otherEras.length > 0) && (
        <div>
          <div className={styles.sectionLabel}>他の選択肢</div>
          <div className={styles.otherList}>
            {otherWorks.map((w) => {
              const confusable = work.confusables.find((c) => c.id === w.id)
              return (
                <div className={styles.otherItem} key={w.id}>
                  <button
                    type="button"
                    className={styles.otherImage}
                    onClick={() => setLightboxWork(w)}
                    aria-label={`${w.title}を拡大表示`}
                  >
                    <WorkImage src={imageSrc(w)} alt={w.title} />
                  </button>
                  <div className={styles.otherMeta}>
                    <div className={`${styles.otherTitle} caption`}>{w.title}</div>
                    <div>{eraNameOf(w.era, eras)}</div>
                    <div>{excerpt(w.explanation, 2)}</div>
                    {confusable && <div className={styles.otherHowTo}>見分け方: {confusable.howToTell}</div>}
                  </div>
                </div>
              )
            })}
            {otherEras.map((e) => (
              <div className={styles.otherItem} key={e.id}>
                <div className={styles.otherMeta}>
                  <div className={`${styles.otherTitle} caption`}>{e.name}</div>
                  <div>{e.summary}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'q4' && question.choiceStatements && question.choiceStatements.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>4つの記述</div>
          <div className={styles.statementList}>
            {question.choiceStatements.map((s, i) => (
              <div className={styles.statementItem} key={i}>
                <span className={s.correct ? styles.statementCorrect : styles.statementWrong}>
                  {s.correct ? '○ 正しい' : '× 誤り'}
                </span>
                <span className={styles.statementText}>{s.text}</span>
                {!s.correct && s.why && <div className={styles.statementWhy}>{s.why}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'q6' && question.choiceEraItems && question.choiceEraItems.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>4つの事項</div>
          <div className={styles.statementList}>
            {question.choiceEraItems.map((it, i) => (
              <div className={styles.statementItem} key={i}>
                <span className={it.correct ? styles.statementCorrect : styles.statementWrong}>
                  {it.correct ? '○' : '×'} {it.eraName}
                </span>
                <span className={styles.statementText}>{it.text}</span>
              </div>
            ))}
          </div>
          {correctEraDetailExcerpt && <p className={styles.explanation}>{correctEraDetailExcerpt}</p>}
        </div>
      )}

      {question.type === 'q9' && question.conditionText && (
        <p className={styles.examNote}>条件: {question.conditionText}</p>
      )}

      {question.type === 'q4' && question.reversed && (
        <p className={styles.examNote}>この設問は「最も不適切なもの（誤っているもの）」を選ぶ形式。</p>
      )}

      {question.type === 'q10' && question.statementPair && (
        <div>
          <div className={styles.sectionLabel}>2つの記述</div>
          <div className={styles.statementList}>
            {(['A', 'B'] as const).map((label) => {
              const sentence = label === 'A' ? question.statementPair!.sentenceA : question.statementPair!.sentenceB
              return (
                <div className={styles.statementItem} key={label}>
                  <span className={sentence.actuallyTrue ? styles.statementCorrect : styles.statementWrong}>
                    {label}: {sentence.actuallyTrue ? '○ 正しい' : '× 誤り'}
                  </span>
                  <span className={styles.statementText}>{sentence.text}</span>
                  {!sentence.actuallyTrue && sentence.why && <div className={styles.statementWhy}>{sentence.why}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {question.type === 'q12' && question.choiceQ12 && question.choiceQ12.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>4つの選択肢</div>
          <div className={styles.statementList}>
            {question.choiceQ12.map((s, i) => (
              <div className={styles.statementItem} key={i}>
                <span className={s.correct ? styles.statementCorrect : styles.statementWrong}>{s.correct ? '○ 正しい' : '× 誤り'}</span>
                <span className={styles.statementText}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'q13' && question.choiceWordPairs && question.choiceWordPairs.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>4つの組合せ</div>
          <div className={styles.statementList}>
            {question.choiceWordPairs.map((c, i) => (
              <div className={styles.statementItem} key={i}>
                <span className={c.correct ? styles.statementCorrect : styles.statementWrong}>
                  {c.correct ? '○' : '×'}
                </span>
                <span className={styles.statementText}>{c.text}</span>
              </div>
            ))}
          </div>
          {question.reversed && <p className={styles.examNote}>この設問は「誤っている組合せ」を選ぶ形式。</p>}
        </div>
      )}

      {question.type === 'q14' && question.orderItems && (
        <div>
          <div className={styles.sectionLabel}>正しい制作順</div>
          <div className={styles.statementList}>
            {question.choiceStatements
              ?.filter((s) => s.correct)
              .map((s, i) => (
                <div className={styles.statementItem} key={i}>
                  <span className={styles.statementText}>{s.text}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {question.type === 'q8' && question.choiceCombos && question.choiceCombos.length > 0 && (
        <div>
          <div className={styles.sectionLabel}>4つの組合せ</div>
          <div className={styles.statementList}>
            {question.choiceCombos.map((c, i) => (
              <div className={styles.statementItem} key={i}>
                <span className={c.correct ? styles.statementCorrect : styles.statementWrong}>
                  {c.correct ? '○' : '×'}
                </span>
                <span className={styles.statementText}>{c.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {work.examNote && <p className={styles.examNote}>入試での注意: {work.examNote}</p>}

      {lightboxWork && (
        <ImageLightbox
          src={imageSrc(lightboxWork)}
          alt={lightboxWork.title}
          title={lightboxWork.title}
          onClose={() => setLightboxWork(null)}
        />
      )}

      {/* M2-43: 「次の問題」ボタン（footer、高さ56px＋セーフエリア）が解説の末尾を隠さないよう、
          本文にボタン高さ分の余白を確保する。 */}
      <div className={styles.bottomSpacer} aria-hidden="true" />
    </BottomSheet>
  )
}
