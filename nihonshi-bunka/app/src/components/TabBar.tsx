import styles from './TabBar.module.css'
import { HomeIcon, LearnIcon, MuseumIcon, StatsIcon } from './icons'
import type { TabId } from '../App'

const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'home', label: 'ホーム', Icon: HomeIcon },
  { id: 'learn', label: '学習', Icon: LearnIcon },
  { id: 'museum', label: '図鑑', Icon: MuseumIcon },
  { id: 'stats', label: '成績', Icon: StatsIcon },
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
