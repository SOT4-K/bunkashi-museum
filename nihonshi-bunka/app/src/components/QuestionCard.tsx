import { useState } from 'react'
import styles from './LearnScreen.module.css'
import { WorkImage } from './WorkImage'
import { ImageLightbox } from './ImageLightbox'
import { ExpandIcon } from './icons'
import { imageSrc } from '../utils/image'
import type { MissSelection } from '../engine/explain'
import type { Question, Work } from '../types'

const PROMPTS: Record<Question['type'], string> = {
  q1: 'この作品は？',
  q2: 'この作品の文化は？',
  q3: 'この作品の画像は？',
  q4: 'この作品に関する記述として正しいものは？',
  q6: 'この作品と同じ文化に属する事項は？',
  q8: '作者（建立者）と様式（宗教背景）の組合せとして正しいものは？',
  q9: '条件に合う作品は？',
  q10: '次の2つの記述の正誤の組合せとして正しいものは？',
  q12: '最も適切なものは？',
  q13: '正しい組合せはどれか？',
  q14: '正しい制作順はどれか？',
}

const Q4_REVERSED_PROMPT = 'この作品に関する記述として最も不適切なものは？'
const Q13_REVERSED_PROMPT = '誤っている組合せはどれか？'

/** 設問文。ask.stem（writer 手書き。8章「二段構え」・9章）があれば、それを最優先でそのまま使う
 *  （既存の自動合成 conditionText 等は使わない）。 */
function promptFor(question: Question): string {
  if (question.stem) return question.stem
  if (question.type === 'q4' && question.reversed) return Q4_REVERSED_PROMPT
  if (question.type === 'q13' && question.reversed) return Q13_REVERSED_PROMPT
  if (question.type === 'q9' && question.conditionText) return `${question.conditionText}を選べ`
  return PROMPTS[question.type]
}

export function QuestionCard({
  question,
  answered,
  onChoice,
  onUnknown,
}: {
  question: Question
  answered: { selection: MissSelection; correct: boolean } | null
  onChoice: (index: number) => void
  onUnknown: () => void
}) {
  const disabled = Boolean(answered)
  const chosenIndex = answered?.selection.kind === 'choice' ? answered.selection.index : -1
  // 出題中の画像は答えのヒントを増やさないため、ライトボックスも常に mono・作品名なしで開く。
  const [lightboxWork, setLightboxWork] = useState<Work | null>(null)

  function classForIndex(index: number, isCorrectOption: boolean): string {
    if (!answered) return styles.choice
    if (isCorrectOption) return `${styles.choice} ${styles.choiceCorrect}`
    if (index === chosenIndex) return `${styles.choice} ${styles.choiceWrong}`
    return `${styles.choice} ${styles.choiceDim}`
  }

  if (question.type === 'q3' || question.type === 'q9') {
    // Q9 は正解の作品自身も画像4枚のうちの1枚（＝答え）なので、Q3 と違って別枠でヒーロー画像を
    // 見せない（見せると答えが分かってしまう）。条件文（conditionText）だけを出題文にする。
    return (
      <div>
        {question.type === 'q3' && (
          <div className={styles.titleHero}>
            <div className={`${styles.titleHeroText} caption-bold`}>{question.work.title}</div>
          </div>
        )}
        <p className={styles.prompt}>{promptFor(question)}</p>
        <div className={styles.imageGrid}>
          {question.choiceWorks.map((w, index) => {
            const isCorrectOption = index === question.correctIndex
            const isChosenWrong = Boolean(answered) && !isCorrectOption && index === chosenIndex
            const base = styles.imageChoice
            const extra = !answered
              ? ''
              : isCorrectOption
                ? styles.choiceCorrect
                : index === chosenIndex
                  ? styles.choiceWrong
                  : styles.choiceDim
            return (
              <div className={styles.imageChoiceWrap} key={w.id}>
                {answered && isCorrectOption && (
                  <span className={styles.imageCorrectLabel}>正解</span>
                )}
                <button
                  type="button"
                  data-testid="choice-button"
                  className={`${base} ${extra}`}
                  disabled={disabled}
                  onClick={() => onChoice(index)}
                  aria-label={`選択肢 ${index + 1}`}
                >
                  <WorkImage mono src={imageSrc(w)} alt="作品" />
                  {answered && isCorrectOption && (
                    <span className={`${styles.imageGlyph} ${styles.imageGlyphCorrect}`} aria-hidden="true">
                      ✓
                    </span>
                  )}
                  {isChosenWrong && (
                    <span className={`${styles.imageGlyph} ${styles.imageGlyphWrong}`} aria-hidden="true">
                      ✗
                    </span>
                  )}
                </button>
                <span
                  role="button"
                  tabIndex={0}
                  className={styles.expandButton}
                  aria-label="この画像を拡大表示"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxWork(w)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      e.preventDefault()
                      setLightboxWork(w)
                    }
                  }}
                >
                  <ExpandIcon width={14} height={14} />
                </span>
              </div>
            )
          })}
        </div>
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
        )}
        {lightboxWork && (
          <ImageLightbox
            src={imageSrc(lightboxWork)}
            alt="作品"
            mono
            onClose={() => setLightboxWork(null)}
          />
        )}
      </div>
    )
  }

  const choiceLabels =
    question.type === 'q2'
      ? (question.choiceEras ?? []).map((e) => e.name)
      : question.type === 'q4' || question.type === 'q14'
        ? (question.choiceStatements ?? []).map((s) => s.text)
        : question.type === 'q6'
          ? (question.choiceEraItems ?? []).map((it) => it.text)
          : question.type === 'q8'
            ? (question.choiceCombos ?? []).map((c) => c.text)
            : question.type === 'q10'
              ? (question.choicePairLabels ?? [])
              : question.type === 'q12'
                ? (question.choiceQ12 ?? []).map((s) => s.text)
                : question.type === 'q13'
                  ? (question.choiceWordPairs ?? []).map((c) => c.text)
                  : question.choiceWorks.map((w) => w.title)

  // Q12（画像なし文字4択。9章「画像リード型セット」）はリード文自体が画像なので、
  // 設問ごとのヒーロー画像は出さない（そもそも question.work の画像＝答えではないことが多い）。
  // M2-16: 画像を持たない対象（kind: person/text/concept。Q4/Q8/Q10/Q13 の対象に戻した）は
  // ヒーロー画像を出さない（プレースホルダ SVG が作品名を描くため答えが分かってしまう。
  // kind ではなく hasRealImage で判定すると、画像取得前の artifact 作品（プレースホルダ表示中）
  // まで隠れてしまい既存の挙動が変わるため、判定は kind だけを見る）。Q14 は複数作品を束ねる
  // 仮の work のため常に出さない。
  const showHeroImage = question.type !== 'q12' && question.type !== 'q14' && (question.work.kind ?? 'artifact') === 'artifact'

  return (
    <div>
      {showHeroImage && (
        <button type="button" className={styles.hero} onClick={() => setLightboxWork(question.work)} aria-label="この画像を拡大表示">
          <WorkImage mono src={imageSrc(question.work)} alt="作品" />
        </button>
      )}
      <p className={styles.prompt}>{promptFor(question)}</p>
      {question.type === 'q10' && question.statementPair && (
        <div className={styles.statementPairBlock} data-testid="statement-pair">
          <p>A: {question.statementPair.sentenceA.text}</p>
          <p>B: {question.statementPair.sentenceB.text}</p>
        </div>
      )}
      {question.type === 'q14' && question.orderItems && (
        <div className={styles.orderImageRow} data-testid="order-items">
          {question.orderItems.map((item) => (
            <div className={styles.orderImageItem} key={item.work.id}>
              <WorkImage mono src={imageSrc(item.work)} alt={item.label} />
              <span className={styles.orderImageLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.choiceList}>
        {choiceLabels.map((label, index) => {
          const isCorrectOption = index === question.correctIndex
          const isChosenWrong = Boolean(answered) && !isCorrectOption && index === chosenIndex
          return (
            <div className={styles.choiceItem} key={label}>
              {answered && isCorrectOption && <span className={styles.correctLabel}>正解</span>}
              <button
                type="button"
                data-testid="choice-button"
                className={classForIndex(index, isCorrectOption)}
                disabled={disabled}
                onClick={() => onChoice(index)}
              >
                <span className={styles.choiceLabelText}>{label}</span>
                {answered && isCorrectOption && (
                  <span className={`${styles.choiceGlyph} ${styles.choiceGlyphCorrect}`} aria-hidden="true">
                    ✓
                  </span>
                )}
                {isChosenWrong && (
                  <span className={`${styles.choiceGlyph} ${styles.choiceGlyphWrong}`} aria-hidden="true">
                    ✗
                  </span>
                )}
              </button>
            </div>
          )
        })}
        {!answered && (
          <button type="button" data-testid="unknown-button" className={styles.choice} style={{ opacity: 0.7 }} onClick={onUnknown}>
            わからない
          </button>
        )}
      </div>
      {lightboxWork && (
        <ImageLightbox src={imageSrc(lightboxWork)} alt="作品" mono onClose={() => setLightboxWork(null)} />
      )}
    </div>
  )
}
