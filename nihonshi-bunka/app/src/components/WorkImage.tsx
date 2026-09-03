import type { ImgHTMLAttributes } from 'react'
import styles from './WorkImage.module.css'

/**
 * 作品画像の共通 <img> ラッパー。mono=true で出題画面用のグレースケール表示にする
 * （入試の図版がモノクロ印刷であることに合わせた訓練。DESIGN.md 3章）。
 * 解説シート・図鑑・作品詳細では mono を付けずカラーのまま使う。
 */
export function WorkImage({
  mono = false,
  className,
  ...props
}: { mono?: boolean } & ImgHTMLAttributes<HTMLImageElement>) {
  const cls = mono ? `${styles.mono} ${className ?? ''}`.trim() : className
  return <img className={cls} {...props} />
}
