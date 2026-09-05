// M2-42「リード文の下線ラベルと常設表示」・M2-52「画像リード型のリード画像を常時表示」の
// 共有部品。全モード（本番モード・文化別練習・間違い復習）で同じ見え方にするため、
// MockExamScreen・PracticeSessionScreen・MissReviewScreen から共通で使う。
//  - スクロールしても押せる固定位置の「リード文」ボタン。押すと全文をシートで開き、
//    下線の直下に小さくキー文字（a/b/c…。本番の問題冊子と同じ見え方）を表示し、
//    現在の設問に対応する下線を強調する。
//  - kind: "image"（画像リード型）はリード画像を問題画面にも常に表示する（既定で開いた状態。
//    折りたたみは残すが既定は開く）。
// passage が無い（練習・復習で下線元が見つからない。engine/leadContext.ts 参照）ときは
// 何も描画しない（既存コードベースの「省略時は出さない」パターンに揃える）。
import { useState } from 'react'
import styles from './LeadPanel.module.css'
import { BottomSheet } from './BottomSheet'
import { WorkImage } from './WorkImage'
import { imageSrc } from '../utils/image'
import { splitPassageText } from '../engine/passage'
import type { Passage, Work } from '../types'

export function LeadPanel({
  passage,
  underlineKey,
  pool,
  raiseAboveConfirmBar,
}: {
  passage: Passage | null | undefined
  /** 現在の設問に対応する下線キー（強調表示に使う）。省略時はどれも強調しない。 */
  underlineKey?: string
  /** kind: "image" のリード画像を解決するための作品プール。 */
  pool: Work[]
  /** M2-53: QuestionCard の「回答する」固定バー（未回答の間だけ表示）と縦位置が重なるため、
   *  呼び出し元が「まだ回答していない（＝バーが出ている）」ときに true を渡すと、
   *  このボタンをバーの上まで押し上げる。省略時（answered 状態を持たない呼び出し元）は false 相当。 */
  raiseAboveConfirmBar?: boolean
}) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(true)

  if (!passage) return null

  const segments = splitPassageText(passage.text)
  const isImageLead = passage.kind === 'image'
  const leadWorks = isImageLead
    ? (passage.leadWorkIds ?? []).map((id) => pool.find((w) => w.id === id)).filter((w): w is Work => Boolean(w))
    : []

  return (
    <>
      {isImageLead && leadWorks.length > 0 && (
        <div className={styles.imageBlock}>
          <button
            type="button"
            className={styles.imageToggle}
            onClick={() => setImageOpen((v) => !v)}
            data-testid="lead-image-toggle"
          >
            {imageOpen ? 'リード画像を隠す' : 'リード画像を表示'}
          </button>
          {imageOpen && (
            <div className={styles.leadImageGrid} data-testid="lead-image-grid">
              {leadWorks.map((w, i) => (
                <div className={styles.leadImageItem} key={w.id}>
                  <WorkImage mono src={imageSrc(w)} alt="作品" />
                  {/* reviewer指摘（2026-09-05、tenpyo-02検証）: リード画像が2枚以上のとき
                      本文が「(1)」「(2)」で参照するが、番号がどこにも表示されず対応が
                      取れなかった。本番の問題冊子と同じ通し番号を付ける。 */}
                  {leadWorks.length > 1 && (
                    <span className={styles.leadImageNumber} data-testid="lead-image-number">
                      ({i + 1})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`${styles.fixedButton} ${raiseAboveConfirmBar ? styles.fixedButtonRaised : ''}`}
        onClick={() => setSheetOpen(true)}
        data-testid="lead-button"
      >
        リード文
      </button>

      {sheetOpen && (
        <BottomSheet
          label="リード文"
          footer={
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setSheetOpen(false)}
              data-testid="lead-sheet-close"
            >
              閉じる
            </button>
          }
        >
          <div className={`${styles.title} caption-bold`}>{passage.title}</div>
          <div className={styles.readPanel} data-testid="lead-sheet-text">
            {segments.map((seg, i) =>
              seg.type === 'underline' ? (
                <span className={styles.underlineWrap} key={i}>
                  <mark className={seg.key === underlineKey ? styles.underlineCurrent : styles.underline}>{seg.value}</mark>
                  <span className={styles.underlineLabel}>{seg.key}</span>
                </span>
              ) : (
                <span key={i}>{seg.value}</span>
              ),
            )}
          </div>
        </BottomSheet>
      )}
    </>
  )
}
