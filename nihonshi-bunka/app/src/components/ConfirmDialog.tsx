// M2-46「進捗リセットの2段階確認」・M2-47「学習中の離脱確認」で共有する汎用の確認ダイアログ。
// BottomSheet と違い、下からのスライドシートではなく画面中央の小さなダイアログにする
// （破壊的操作・中断確認は「はい/いいえ」を一目で見せたいため）。
import type { ReactNode } from 'react'
import styles from './ConfirmDialog.module.css'

export function ConfirmDialog({
  message,
  detail,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  extra,
}: {
  message: string
  detail?: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** true のとき確認ボタンを破壊的操作の色にする（M2-46 の2回目確認）。 */
  destructive?: boolean
  /** 確認ボタンの上に置く追加の導線（M2-46「先に進捗を書き出す」）。省略可。 */
  extra?: ReactNode
}) {
  return (
    <div className={styles.backdrop} role="alertdialog" aria-modal="true" aria-label={message}>
      <div className={styles.box}>
        <p className={styles.message}>{message}</p>
        {detail && <p className={styles.detail}>{detail}</p>}
        {extra}
        <div className={styles.buttonRow}>
          <button type="button" className={styles.cancelButton} onClick={onCancel} data-testid="confirm-dialog-cancel">
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? styles.destructiveButton : styles.confirmButton}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
