import type { ReactNode } from 'react'
import styles from './BottomSheet.module.css'

// 下からスライドするボトムシートの共通シェル。ドラッグでは閉じない
// （UI-DESIGN.md: 誤って閉じて解説を飛ばさせない）。閉じる操作は footer のボタンに限る。
export function BottomSheet({
  children,
  footer,
  label,
}: {
  children: ReactNode
  footer?: ReactNode
  label: string
}) {
  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={label}>
      <div className={styles.sheet}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
