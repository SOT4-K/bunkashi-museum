// ホーム最下部の「設定」（M2b-05。BOARD.md「M2b v2」）。旧 StatsScreen（成績タブ、廃止）に
// あった「進捗の書き出し/読み込み」「進捗リセット」「画像の出典」をここに移設する。
// 進捗リセットは M2b-05 チケットの規則どおり3回連続の確認を通さないと実行されない
// （1回目「本当に？」→2回目「元に戻せません」→3回目「『リセット』と入力」相当の最終確認）。
import { useState } from 'react'
import styles from './SettingsSection.module.css'
import { CreditsSheet } from './CreditsSheet'
import { ConfirmDialog } from './ConfirmDialog'
import { migrate } from '../engine/progress'
import type { ProgressState } from '../types'

/** 3回確認の進捗（チケット規則）。0: 未着手 / 1〜3: それぞれの警告段階。 */
type ResetStage = 0 | 1 | 2 | 3

/** 3回目の最終確認で入力させる語（チケット文面「『リセット』と入力」）。 */
const RESET_CONFIRM_WORD = 'リセット'

export function SettingsSection({
  progress,
  onImport,
  onReset,
}: {
  progress: ProgressState
  onImport: (next: ProgressState) => void
  /** 全リセット（3回確認を通した後に1回だけ呼ぶ）。 */
  onReset: () => void
}) {
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const [showCredits, setShowCredits] = useState(false)
  const [resetStage, setResetStage] = useState<ResetStage>(0)
  const [resetInput, setResetInput] = useState('')

  function handleExport() {
    setText(JSON.stringify(progress, null, 2))
    setMessage('進捗を書き出した。')
  }

  function handleImport() {
    try {
      const parsed = JSON.parse(text)
      const next = migrate(parsed)
      onImport(next)
      setMessage('進捗を読み込んだ。')
    } catch {
      setMessage('読み込めなかった。JSONの形式を確認してほしい。')
    }
  }

  function closeReset() {
    setResetStage(0)
    setResetInput('')
  }

  return (
    <div className={styles.section} data-testid="settings-section">
      <div className={styles.sectionLabel}>設定</div>

      <div className={styles.subsection}>
        <div className={styles.subsectionLabel}>進捗データ</div>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="書き出すと進捗のJSONがここに表示される。貼り付けて読み込むこともできる。"
        />
        <div className={styles.buttonRow}>
          <button type="button" className={styles.button} onClick={handleExport}>
            進捗を書き出す
          </button>
          <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleImport}>
            進捗を読み込む
          </button>
        </div>
        {message && <p className={styles.message}>{message}</p>}
      </div>

      <button type="button" className={styles.creditsLink} onClick={() => setShowCredits(true)}>
        画像の出典
      </button>

      <button
        type="button"
        className={styles.resetButton}
        data-testid="reset-progress-button"
        onClick={() => setResetStage(1)}
      >
        進捗を全てリセット
      </button>

      {resetStage === 1 && (
        <ConfirmDialog
          message="本当に？"
          detail="経験値・図鑑・ステージの進み具合・模試の記録・間違いノートがすべて消える。"
          cancelLabel="キャンセル"
          confirmLabel="続ける"
          onCancel={closeReset}
          onConfirm={() => setResetStage(2)}
          extra={
            <button type="button" className={styles.exportLink} data-testid="reset-export-link" onClick={handleExport}>
              先に進捗を書き出す
            </button>
          }
        />
      )}

      {resetStage === 2 && (
        <ConfirmDialog
          message="元に戻せません。"
          detail="この操作は取り消せない。本当に続けるか、もう一度確認してほしい。"
          cancelLabel="キャンセル"
          confirmLabel="続ける"
          destructive
          onCancel={closeReset}
          onConfirm={() => setResetStage(3)}
        />
      )}

      {resetStage === 3 && (
        <ConfirmDialog
          message={`確認のため「${RESET_CONFIRM_WORD}」と入力してください。`}
          cancelLabel="キャンセル"
          confirmLabel="リセットする"
          destructive
          confirmDisabled={resetInput !== RESET_CONFIRM_WORD}
          onCancel={closeReset}
          onConfirm={() => {
            if (resetInput !== RESET_CONFIRM_WORD) return
            closeReset()
            onReset()
          }}
          extra={
            <input
              type="text"
              className={styles.textInput}
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder={RESET_CONFIRM_WORD}
              data-testid="reset-confirm-input"
              aria-label={`確認のため「${RESET_CONFIRM_WORD}」と入力`}
            />
          }
        />
      )}

      {showCredits && <CreditsSheet onClose={() => setShowCredits(false)} />}
    </div>
  )
}
