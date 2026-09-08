// M2b-04 v2: ワープ廃止・完全直列化（BOARD.md「M2b v2」）。旧テスト（M2b-99重大2の回帰、
// ワープでこのワールド自身のボスを撃破すると★1〜3が解禁される）は、その挙動自体を廃止した
// ため意味を失った。ファイル名はそのまま残し、「ワープ相当の経路がもう無い」ことを
// コンポーネントレベルで固定するテストに書き直す（builder メモ
// 「旧方式を置き換えるならテストも書き直す」）。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StageMapScreen } from '../StageMapScreen'
import { eras, passages, playableWorks, themeSetPool } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageProgress, worldOrder } from '../../engine/stages'
import type { ProgressState } from '../../types'

describe('StageMapScreen: ワープ廃止（完全直列解禁）', () => {
  it('後方ワールド（kitayama）のボスだけを疑似的にクリア状態にしても、直前までのワールドが未クリアならkitayamaの★1タイルは押せない', () => {
    const worlds = worldOrder(eras)
    const kitayamaIndex = worlds.indexOf('kitayama')
    expect(kitayamaIndex).toBeGreaterThan(0) // 先頭でないことの前提確認（先頭は元々常に解禁のため検証にならない）

    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        kitayama: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 7, clearedAt: '2026-09-08' } },
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
    // 完全直列化: kitayama自身のボスを（不整合な手作りデータで）クリア扱いにしても、
    // それより手前のワールドが未クリアのままなら kitayama の★1-1は依然として🔒。
    const tile = screen.getByTestId('stage-tile-kitayama-1-1')
    expect(tile).toBeDisabled()
  })

  it('先頭ワールド（W1）の★1-1は常に解禁されている', () => {
    const progress = createInitialProgress('2026-09-08')
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
    const worlds = worldOrder(eras)
    const firstEraId = worlds[0]
    const tile = screen.getByTestId(`stage-tile-${firstEraId}-1-1`)
    expect(tile).not.toBeDisabled()
    // 先頭ワールドのボスは、★1〜3を全くクリアしていない時点では未解禁。
    const bossTile = screen.getByTestId(`stage-tile-${firstEraId}-boss`)
    expect(bossTile).toBeDisabled()
  })
})
