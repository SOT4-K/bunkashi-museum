// Hayato発見（Playwright実機確認、M2b-99受け入れ再検証中）: reviewer指摘M2b-99重大2を
// engine/stages.ts の isStageUnlocked では直したが、StageMapScreen.tsx 側が
// `worldUnlocked && isStageUnlocked(...)` と外側でも isWorldUnlocked を再度ANDしていたため、
// 呼び出し側で修正が無効化されていた（ワープでボスだけ倒しても★1〜3が🔒のまま）。
// engine層の単体テストだけでは検出できない「呼び出し側の二重ゲート」をコンポーネントレベルで
// 固定する。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageMapScreen } from '../StageMapScreen'
import { eras, passages, playableWorks, themeSetPool } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageState, worldOrder } from '../../engine/stages'
import type { ProgressState } from '../../types'

describe('StageMapScreen: ワープでこのワールド自身のボスを撃破すると★1〜3が解禁される', () => {
  it('直前ワールドのボスは未撃破のまま、後方ワールド（kitayama）のボスだけワープ撃破していれば、kitayamaの★1タイルは押せる', () => {
    const worlds = worldOrder(eras)
    const kitayamaIndex = worlds.indexOf('kitayama')
    expect(kitayamaIndex).toBeGreaterThan(0) // 先頭でないことの前提確認（先頭は元々常に解禁のため検証にならない）

    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        kitayama: { ...emptyEraStageState(), boss: { cleared: true, bestScore: 7, clearedAt: '2026-09-08' } },
      },
    }
    render(
      <StageMapScreen
        eras={eras}
        pool={themeSetPool}
        imagePool={playableWorks}
        passages={passages}
        progress={progress}
        onSelectStage={() => {}}
      />,
    )
    const tile = screen.getByTestId('stage-tile-kitayama-s1')
    expect(tile).not.toBeDisabled()
  })
})
