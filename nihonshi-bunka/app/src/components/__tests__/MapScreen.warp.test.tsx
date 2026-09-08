// M2b-04 v2: ワープ廃止・完全直列化（BOARD.md「M2b v2」）。旧テスト（StageMapScreen.warp.test.tsx、
// ワープでこのワールド自身のボスを撃破すると★1〜3が解禁される）は、その挙動自体を廃止した
// ため意味を失った。M2b-06でStageMapScreenがMapScreen（絵巻風SVG・ドラッグ・雲・王冠）に
// 置き換わったため、同じ検証をここに引き継ぐ（builder メモ「旧方式を置き換えるならテストも書き直す」）。
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '../MapScreen'
import { eras, playableWorks } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageProgress, worldOrder } from '../../engine/stages'
import type { ProgressState } from '../../types'

describe('MapScreen: ワープ廃止（完全直列解禁）', () => {
  it('後方ワールド（kitayama）のボスだけを疑似的にクリア状態にしても、直前までのワールドが未クリアならkitayamaの★1タイルは押せない（雲の下でもある）', () => {
    const worlds = worldOrder(eras)
    const kitayamaIndex = worlds.indexOf('kitayama')
    expect(kitayamaIndex).toBeGreaterThan(0) // 先頭でないことの前提確認

    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        kitayama: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 7, clearedAt: '2026-09-08' } },
      },
    }
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectStage={() => {}} />)
    // 完全直列化: kitayama自身のボスを（不整合な手作りデータで）クリア扱いにしても、
    // それより手前のワールドが未クリアのままなら kitayama は雲の下（要件4）。
    expect(screen.getByTestId('world-cloud-kitayama')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-tile-kitayama-1-1')).not.toBeInTheDocument()
  })

  it('先頭ワールド（W1）の★1-1は常に解禁されている（雲が無い）', () => {
    const progress = createInitialProgress('2026-09-08')
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectStage={() => {}} />)
    const worlds = worldOrder(eras)
    const firstEraId = worlds[0]
    expect(screen.queryByTestId(`world-cloud-${firstEraId}`)).not.toBeInTheDocument()
    const tile = screen.getByTestId(`stage-tile-${firstEraId}-1-1`)
    expect(tile).not.toBeDisabled()
    // 先頭ワールドのボスは、★1〜3を全くクリアしていない時点では未解禁。
    const bossTile = screen.getByTestId(`stage-tile-${firstEraId}-boss`)
    expect(bossTile).toBeDisabled()
    expect(screen.queryByTestId(`world-crown-${firstEraId}`)).not.toBeInTheDocument()
  })

  it('要件6: ボス撃破済みのワールドには王冠が出る', () => {
    const worlds = worldOrder(eras)
    const firstEraId = worlds[0]
    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        [firstEraId]: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 9, clearedAt: '2026-09-08' } },
      },
    }
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectStage={() => {}} />)
    expect(screen.getByTestId(`world-crown-${firstEraId}`)).toBeInTheDocument()
  })

  it('要件5: クリア済みの面はロックされておらずタップで再挑戦できる', () => {
    const worlds = worldOrder(eras)
    const firstEraId = worlds[0]
    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        [firstEraId]: {
          ...emptyEraStageProgress(),
          segments: { '1-1': { cleared: true, bestScore: 10, clearedAt: '2026-09-08' } },
        },
      },
    }
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectStage={() => {}} />)
    const tile = screen.getByTestId(`stage-tile-${firstEraId}-1-1`)
    expect(tile).not.toBeDisabled()
  })
})
