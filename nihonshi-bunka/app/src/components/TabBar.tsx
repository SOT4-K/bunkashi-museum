import styles from './TabBar.module.css'
import { HomeIcon, MapIcon, MuseumIcon, ExamIcon } from './icons'
import type { TabId } from '../App'

// M2b-05: タブ構成をホーム／マップ／図鑑／模試の4つにする（学習・成績タブは廃止。
// BOARD.md「M2b v2」）。
const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'ホーム', Icon: HomeIcon },
  { id: 'map', label: 'マップ', Icon: MapIcon },
  { id: 'museum', label: '図鑑', Icon: MuseumIcon },
  { id: 'exam', label: '模試', Icon: ExamIcon },
]

export function TabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className={styles.bar} aria-label="タブ">
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`${styles.item} ${active === id ? styles.active : ''}`}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon />
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </nav>
  )
}
