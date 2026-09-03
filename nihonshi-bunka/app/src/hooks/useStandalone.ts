import { useEffect, useState } from 'react'

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return true // SSR/テスト時は案内を出さない
  const byMediaQuery = window.matchMedia?.('(display-mode: standalone)').matches ?? false
  const byIosFlag = (window.navigator as NavigatorWithStandalone).standalone ?? false
  return byMediaQuery || byIosFlag
}

/** iOS Safari の「ホーム画面に追加」で standalone 起動しているかどうか。 */
export function useStandalone(): boolean {
  const [standalone, setStandalone] = useState(detectStandalone)

  useEffect(() => {
    const mql = window.matchMedia?.('(display-mode: standalone)')
    if (!mql) return
    const handler = () => setStandalone(detectStandalone())
    mql.addEventListener?.('change', handler)
    return () => mql.removeEventListener?.('change', handler)
  }, [])

  return standalone
}
