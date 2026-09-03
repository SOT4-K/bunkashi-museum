import styles from './CreditsSheet.module.css'
import { BottomSheet } from './BottomSheet'
import manifest from '../../../content/images/manifest.json'

// content/images/manifest.json を直接 import する（画像本体は sync-real-images.mjs
// 経由で public/img/ にコピーするが、manifest はテキストデータなので import で足りる。
// DESIGN.md 6章「アプリ内の『クレジット』画面に自動で一覧表示」の実装。
interface ManifestImage {
  id?: string
  title?: string
  sourceName?: string
  sourceUrl?: string
  license?: string
  attributionText?: string
}

interface Manifest {
  images?: ManifestImage[]
}

const typedManifest = manifest as Manifest

export function CreditsSheet({ onClose }: { onClose: () => void }) {
  const entries = (typedManifest.images ?? []).filter((img) => img.attributionText)

  return (
    <BottomSheet
      label="画像の出典"
      footer={
        <button type="button" className={styles.closeButton} onClick={onClose}>
          閉じる
        </button>
      }
    >
      <div className={`${styles.title} caption-bold`}>画像の出典</div>
      {entries.length === 0 ? (
        <p className={styles.empty}>出典情報がまだ無い。</p>
      ) : (
        <div className={styles.list}>
          {entries.map((entry, i) => (
            <div className={styles.item} key={entry.id ?? i}>
              <div className={styles.itemTitle}>{entry.title ?? entry.id}</div>
              <div className={styles.attribution}>{entry.attributionText}</div>
              {entry.sourceUrl && (
                <a className={styles.link} href={entry.sourceUrl} target="_blank" rel="noreferrer noopener">
                  {entry.sourceName ?? entry.sourceUrl}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  )
}
