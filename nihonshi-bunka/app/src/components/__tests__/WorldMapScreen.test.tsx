// M2d-01（BOARD.md「M2d ワールド内マップと時代別ビジュアル」）。
// 検証: ①ノード状態（locked/unlocked/cleared）が engine/stages の判定と一致する
// （3状態を注入。合格ライン①）②「マップへ戻る」で onBack が呼ばれる③ノードタップで
// onSelectStage が正しい StageLocalKey で呼ばれる④飾りモチーフは theme.motifs が
// 空なら描かれない（無地ワールドの13本相当）、非空なら描かれる（合格ライン②の土台）。
//
// M2d-01b（様式手直し）: 管理セッション所見①「飾りが1画面3個・約24pxと小さい」への対応の
// 検証。飾りを4ノード（実データの原始・化政と同じ規模。works が2件＝1面のみ）のワールドに
// 5種の motifs で描かせ、⑤個数が8〜12個（チケット「1画面8〜12個」）⑥各飾りが40〜72px
// ⑦飾り同士が重ならない⑧ノード（タップ領域）と重ならない、を機械的に確認する。
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorldMapScreen } from '../WorldMapScreen'
import { makeWork, testEras } from '../../engine/__tests__/testFixtures'
import { createInitialProgress } from '../../engine/progress'
import { DEFAULT_WORLD_THEME } from '../../engine/worldTheme'
import type { ProgressState, Work, WorldTheme } from '../../types'

// asuka は testEras の先頭（order 1）＝常に解禁済み。2件で1面のみ（STAGE_CHUNK_SIZE=10未満）。
const works: Work[] = [
  makeWork({ id: 'wm1', era: 'asuka', category: 'sculpture' }),
  makeWork({ id: 'wm2', era: 'asuka', category: 'sculpture' }),
]

const plainTheme: WorldTheme = { eraId: 'asuka', ...DEFAULT_WORLD_THEME }
const decoratedTheme: WorldTheme = {
  eraId: 'asuka',
  palette: { sky: '#f4e4c1', ground: '#8a6b4a', road: '#c98b4a', accent: '#b5482e' },
  bossFlagId: 'dogu',
  motifs: [
    { id: 'dogu', label: '土偶' },
    { id: 'haniwa', label: '埴輪' },
  ],
}
// content/worlds.json の genshi と同じ5種（M2d-01b）。works は4ノード規模（実データの
// 原始・化政と同じ、1面のみ）。
const decoratedTheme5: WorldTheme = {
  eraId: 'asuka',
  palette: { sky: '#f4e4c1', ground: '#8a6b4a', road: '#c98b4a', accent: '#b5482e' },
  bossFlagId: 'dogu',
  motifs: [
    { id: 'dogu', label: '土偶' },
    { id: 'haniwa', label: '埴輪' },
    { id: 'tateana', label: '竪穴住居' },
    { id: 'dotaku', label: '銅鐸' },
    { id: 'kaizuka', label: '貝塚' },
  ],
}

describe('WorldMapScreen', () => {
  it('未着手: 先頭の面ノードは解禁（unlocked）、それ以外はロック、ボスもロック', () => {
    const progress = createInitialProgress('2026-09-09')
    const onSelectStage = vi.fn()
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={progress}
        theme={plainTheme}
        onSelectStage={onSelectStage}
        onBack={() => {}}
      />,
    )
    const s1 = screen.getByTestId('stage-tile-asuka-1-1')
    expect(s1).not.toBeDisabled()
    expect(s1.dataset.state).toBe('unlocked')

    const s2 = screen.getByTestId('stage-tile-asuka-2-1')
    expect(s2).toBeDisabled()
    expect(s2.dataset.state).toBe('locked')

    const boss = screen.getByTestId('stage-tile-asuka-boss')
    expect(boss).toBeDisabled()
    expect(boss.dataset.state).toBe('locked')
  })

  it('途中: ★1-1のみクリア済みなら、1-1はcleared、2-1はunlocked、ボスはlocked', () => {
    const progress: ProgressState = {
      ...createInitialProgress('2026-09-09'),
      stages: {
        asuka: {
          segments: { '1-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' } },
          boss: { cleared: false, bestScore: 0, clearedAt: null },
        },
      },
    }
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={progress}
        theme={plainTheme}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByTestId('stage-tile-asuka-1-1').dataset.state).toBe('cleared')
    expect(screen.getByTestId('stage-tile-asuka-2-1').dataset.state).toBe('unlocked')
    expect(screen.getByTestId('stage-tile-asuka-2-1')).not.toBeDisabled()
    expect(screen.getByTestId('stage-tile-asuka-boss').dataset.state).toBe('locked')
  })

  it('全クリア: 全面＋ボスがclearedで、ボスに王冠(👑)が出る', () => {
    const progress: ProgressState = {
      ...createInitialProgress('2026-09-09'),
      stages: {
        asuka: {
          segments: {
            '1-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
            '2-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
            '3-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
          },
          boss: { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
        },
      },
    }
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={progress}
        theme={plainTheme}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    for (const id of ['stage-tile-asuka-1-1', 'stage-tile-asuka-2-1', 'stage-tile-asuka-3-1', 'stage-tile-asuka-boss']) {
      expect(screen.getByTestId(id).dataset.state).toBe('cleared')
      expect(screen.getByTestId(id)).not.toBeDisabled()
    }
    expect(screen.getByTestId('stage-tile-asuka-boss')).toHaveTextContent('👑')
  })

  it('「マップへ戻る」で onBack が呼ばれる', () => {
    const onBack = vi.fn()
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={plainTheme}
        onSelectStage={() => {}}
        onBack={onBack}
      />,
    )
    screen.getByTestId('world-map-back').click()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('解禁済みノードをタップすると onSelectStage が正しい key で呼ばれる', () => {
    const onSelectStage = vi.fn()
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={plainTheme}
        onSelectStage={onSelectStage}
        onBack={() => {}}
      />,
    )
    screen.getByTestId('stage-tile-asuka-1-1').click()
    expect(onSelectStage).toHaveBeenCalledWith({ kind: 'segment', difficulty: 1, segment: 1 })
  })

  it('無地パレット（motifs空）のワールドは飾りを描かない', () => {
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={plainTheme}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.queryByTestId(/world-motif-/)).not.toBeInTheDocument()
  })

  it('飾りモチーフを持つワールドは道端に飾りが描かれる（実出題画像は使わない自作SVG）', () => {
    const { container } = render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={decoratedTheme}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    const motifNodes = container.querySelectorAll('[data-testid^="world-motif-asuka-"]')
    expect(motifNodes.length).toBeGreaterThan(0)
    // 飾りは svg 内で <img> や実写真の src を一切参照しない（装飾は手描き SVG のみ）。
    expect(container.querySelector('[data-testid^="world-motif-"] img')).toBeNull()
  })

  it('飾りは1画面規模（4ノード＝実データの原始・化政相当）で8〜12個、40〜72pxの範囲', () => {
    const { container } = render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={decoratedTheme5}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    const motifEls = Array.from(container.querySelectorAll<HTMLElement>('[data-testid^="world-motif-asuka-"]'))
    expect(motifEls.length).toBeGreaterThanOrEqual(8)
    expect(motifEls.length).toBeLessThanOrEqual(12)
    for (const el of motifEls) {
      const w = parseFloat(el.style.width)
      const h = parseFloat(el.style.height)
      expect(w).toBeGreaterThanOrEqual(40)
      expect(w).toBeLessThanOrEqual(72)
      expect(h).toBe(w)
    }
  })

  it('飾り同士・飾りとノード（タップ領域）が重ならない', () => {
    const { container } = render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={works}
        progress={createInitialProgress('2026-09-09')}
        theme={decoratedTheme5}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    type Box = { left: number; top: number; right: number; bottom: number }
    const boxOf = (el: HTMLElement): Box => {
      const left = parseFloat(el.style.left)
      const top = parseFloat(el.style.top)
      const w = parseFloat(el.style.width)
      const h = parseFloat(el.style.height)
      return { left, top, right: left + w, bottom: top + h }
    }
    const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

    const motifBoxes = Array.from(container.querySelectorAll<HTMLElement>('[data-testid^="world-motif-asuka-"]')).map(
      boxOf,
    )
    const nodeBoxes = Array.from(container.querySelectorAll<HTMLElement>('[data-testid^="stage-tile-asuka-"]')).map(
      boxOf,
    )

    for (let i = 0; i < motifBoxes.length; i++) {
      for (let j = i + 1; j < motifBoxes.length; j++) {
        expect(overlaps(motifBoxes[i], motifBoxes[j])).toBe(false)
      }
      for (const nodeBox of nodeBoxes) {
        expect(overlaps(motifBoxes[i], nodeBox)).toBe(false)
      }
    }
  })

  it('対象作品0件のワールドは「出題できる面がまだない」を表示しノードを作らない', () => {
    render(
      <WorldMapScreen
        eraId="asuka"
        eras={testEras}
        imagePool={[]}
        progress={createInitialProgress('2026-09-09')}
        theme={plainTheme}
        onSelectStage={() => {}}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText('出題できる面がまだない。')).toBeInTheDocument()
    expect(screen.queryByTestId('stage-tile-asuka-1-1')).not.toBeInTheDocument()
  })

  // M2d-02: ボスノードは時代のランドマーク（前方後円墳・富士山型）をやめ、全ワールド共通の
  // 「敵の砦」（BossFortressIcon）にした。ここでは3状態（灰/赤い目/王冠）と旗（bossFlagId）が
  // 正しく描き分けられることを直接検証する（clip-path ではなく SVG 内の要素で表現するため）。
  describe('ボスノード: 全ワールド共通「敵の砦」（M2d-02）', () => {
    it('未解禁（locked）: 目を描かない', () => {
      render(
        <WorldMapScreen
          eraId="asuka"
          eras={testEras}
          imagePool={works}
          progress={createInitialProgress('2026-09-09')}
          theme={decoratedTheme}
          onSelectStage={() => {}}
          onBack={() => {}}
        />,
      )
      const boss = screen.getByTestId('stage-tile-asuka-boss')
      expect(boss.dataset.state).toBe('locked')
      const fortress = boss.querySelector('[data-testid="boss-fortress"]')
      expect(fortress).not.toBeNull()
      expect(fortress?.getAttribute('data-state')).toBe('locked')
      expect(boss.querySelectorAll('[data-testid="boss-fortress-eye"]').length).toBe(0)
    })

    it('挑戦可能（unlocked）: 赤く光る目が2つ描かれる', () => {
      const progress: ProgressState = {
        ...createInitialProgress('2026-09-09'),
        stages: {
          asuka: {
            segments: {
              '1-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
              '2-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
              '3-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
            },
            boss: { cleared: false, bestScore: 0, clearedAt: null },
          },
        },
      }
      render(
        <WorldMapScreen
          eraId="asuka"
          eras={testEras}
          imagePool={works}
          progress={progress}
          theme={decoratedTheme}
          onSelectStage={() => {}}
          onBack={() => {}}
        />,
      )
      const boss = screen.getByTestId('stage-tile-asuka-boss')
      expect(boss.dataset.state).toBe('unlocked')
      const eyes = boss.querySelectorAll('[data-testid="boss-fortress-eye"]')
      expect(eyes.length).toBe(2)
      for (const eye of eyes) expect(eye.getAttribute('fill')).toBe('#ff3b3b')
    })

    it('クリア（cleared）: 王冠（👑）が表示される', () => {
      const progress: ProgressState = {
        ...createInitialProgress('2026-09-09'),
        stages: {
          asuka: {
            segments: {
              '1-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
              '2-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
              '3-1': { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
            },
            boss: { cleared: true, bestScore: 2, clearedAt: '2026-09-09' },
          },
        },
      }
      render(
        <WorldMapScreen
          eraId="asuka"
          eras={testEras}
          imagePool={works}
          progress={progress}
          theme={decoratedTheme}
          onSelectStage={() => {}}
          onBack={() => {}}
        />,
      )
      const boss = screen.getByTestId('stage-tile-asuka-boss')
      expect(boss.dataset.state).toBe('cleared')
      expect(boss).toHaveTextContent('👑')
      // クリア時の目は光らない暗赤（挑戦可能時の光る赤との対比）。
      const eyes = boss.querySelectorAll('[data-testid="boss-fortress-eye"]')
      expect(eyes.length).toBe(2)
      for (const eye of eyes) expect(eye.getAttribute('fill')).toBe('#5a1f1f')
    })

    it('theme.bossFlagId のアイコンが頂上の旗として描かれる', () => {
      render(
        <WorldMapScreen
          eraId="asuka"
          eras={testEras}
          imagePool={works}
          progress={createInitialProgress('2026-09-09')}
          theme={decoratedTheme}
          onSelectStage={() => {}}
          onBack={() => {}}
        />,
      )
      const boss = screen.getByTestId('stage-tile-asuka-boss')
      expect(boss.querySelector('[data-testid="boss-fortress-flag"]')).not.toBeNull()
    })

    it('bossFlagId が無いテーマでは旗を描かない（防御的）', () => {
      render(
        <WorldMapScreen
          eraId="asuka"
          eras={testEras}
          imagePool={works}
          progress={createInitialProgress('2026-09-09')}
          theme={plainTheme}
          onSelectStage={() => {}}
          onBack={() => {}}
        />,
      )
      const boss = screen.getByTestId('stage-tile-asuka-boss')
      expect(boss.querySelector('[data-testid="boss-fortress-flag"]')).toBeNull()
    })
  })
})
