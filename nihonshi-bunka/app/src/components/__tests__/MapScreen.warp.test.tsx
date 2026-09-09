// M2b-04 v2: ワープ廃止・完全直列化（BOARD.md「M2b v2」）。旧テスト（StageMapScreen.warp.test.tsx、
// ワープでこのワールド自身のボスを撃破すると★1〜3が解禁される）は、その挙動自体を廃止した
// ため意味を失った。M2b-06でStageMapScreenがMapScreen（絵巻風SVG・ドラッグ・雲・王冠）に
// 置き換わったため、同じ検証をここに引き継ぐ（builder メモ「旧方式を置き換えるならテストも書き直す」）。
// M2d-01（BOARD.md「M2d」）: MapScreen は面タイルを直接展開しなくなり、タップで
// onSelectWorld(eraId) を呼ぶワールドの入口だけを描くようになった（面ノードの状態判定は
// WorldMapScreen 側に移動。そちらの検証は WorldMapScreen.test.tsx 参照。builder メモ
// 「旧方式を置き換えるならテストも書き直す」を再度適用）。
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapScreen } from '../MapScreen'
import { eras, playableWorks } from '../../content'
import { createInitialProgress } from '../../engine/progress'
import { emptyEraStageProgress, worldOrder } from '../../engine/stages'
import type { ProgressState } from '../../types'

describe('MapScreen: ワープ廃止（完全直列解禁）', () => {
  it('後方ワールド（kitayama）のボスだけを疑似的にクリア状態にしても、直前までのワールドが未クリアならkitayamaは雲の下（入口も無い）', () => {
    const worlds = worldOrder(eras)
    const kitayamaIndex = worlds.indexOf('kitayama')
    expect(kitayamaIndex).toBeGreaterThan(0) // 先頭でないことの前提確認

    const progress: ProgressState = {
      ...createInitialProgress('2026-09-08'),
      stages: {
        kitayama: { ...emptyEraStageProgress(), boss: { cleared: true, bestScore: 7, clearedAt: '2026-09-08' } },
      },
    }
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectWorld={() => {}} />)
    // 完全直列化: kitayama自身のボスを（不整合な手作りデータで）クリア扱いにしても、
    // それより手前のワールドが未クリアのままなら kitayama は雲の下（要件4）。
    expect(screen.getByTestId('world-cloud-kitayama')).toBeInTheDocument()
    expect(screen.queryByTestId('world-block-kitayama')).not.toBeInTheDocument()
  })

  it('先頭ワールド（W1）は常に解禁されている（雲が無く、タップで onSelectWorld が呼ばれる）', () => {
    const progress = createInitialProgress('2026-09-08')
    const onSelectWorld = vi.fn()
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectWorld={onSelectWorld} />)
    const worlds = worldOrder(eras)
    const firstEraId = worlds[0]
    expect(screen.queryByTestId(`world-cloud-${firstEraId}`)).not.toBeInTheDocument()
    const entry = screen.getByTestId(`world-block-${firstEraId}`)
    expect(entry).not.toBeDisabled()
    entry.click()
    expect(onSelectWorld).toHaveBeenCalledWith(firstEraId)
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
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectWorld={() => {}} />)
    expect(screen.getByTestId(`world-crown-${firstEraId}`)).toBeInTheDocument()
  })

  it('要件3改め（M2d-01）: 面クリア数の要約に、記録済みのクリア面数が反映される', () => {
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
    render(<MapScreen eras={eras} imagePool={playableWorks} progress={progress} onSelectWorld={() => {}} />)
    const summary = screen.getByTestId(`world-progress-${firstEraId}`)
    expect(summary.textContent).toMatch(/^1\//)
  })
})
