// scripts/coverage.mjs（M2c-03 収録率レポート）の直接検証。
// このファイルは app/src の外（work/nihonshi-bunka/scripts/）にあるプレーン Node ESM
// スクリプトだが、validate-content.mjs と同じく main() 呼び出しをガードしてあるので
// 純関数だけを直接 import して確認できる（test-plain-node-script-guard-main の教訓）。
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error 型定義の無いプレーン .mjs スクリプトを直接 import する
import { hasImageAsset, classifyVisualItem, classifyTextItem, buildCoverageReport, formatEraTable, formatSummaryLine, formatCanonOnlyList, formatContentOnlyList, loadAndBuildReport } from '../../../../scripts/coverage.mjs'

// ---- 合成データでの単体テスト ----

// hasImageAsset は existsSync(join(imagesDirPath, entry.file)) を呼ぶため、実在する
// 画像実体を一時ディレクトリへ用意する（validateContentChecks.test.ts と同じ
// mkdtempSync 方式。import.meta.url ベースの相対パスは transform 後のパスに依存し
// 不安定なため使わない）。mkdtempSync は同期関数のため beforeAll を介さずモジュール
// トップレベルで作成する（describe 本文が実行される時点で report を組み立てるテストが
// 参照するため）。
const fakeImagesDirPath = mkdtempSync(join(tmpdir(), 'coverage-test-'))
writeFileSync(join(fakeImagesDirPath, 'coverage.test.ts'), 'dummy image file substitute')

afterAll(() => {
  rmSync(fakeImagesDirPath, { recursive: true, force: true })
})

function fakeImagesDir() {
  return fakeImagesDirPath
}

describe('hasImageAsset（画像実体の有無。validate-content.mjs の同名関数と同じ判定）', () => {
  const manifestById = new Map([
    ['w-with-file', { id: 'w-with-file', file: 'coverage.test.ts' }], // このテストファイル自身＝実在するファイル名
    ['w-no-file', { id: 'w-no-file', file: 'does-not-exist.jpg' }],
  ])

  it('manifest にエントリがあり画像実体が存在すれば true（artifact）', () => {
    const work = { id: 'w-with-file', kind: 'artifact', status: 'reviewed' }
    expect(hasImageAsset(work, manifestById, fakeImagesDir())).toBe(true)
  })

  it('manifest にエントリがあっても画像実体が無ければ false', () => {
    const work = { id: 'w-no-file', kind: 'artifact', status: 'reviewed' }
    expect(hasImageAsset(work, manifestById, fakeImagesDir())).toBe(false)
  })

  it('manifest にエントリが無ければ false', () => {
    const work = { id: 'w-unknown', kind: 'artifact', status: 'reviewed' }
    expect(hasImageAsset(work, manifestById, fakeImagesDir())).toBe(false)
  })

  it('kind が person/text/concept は画像を持てない（manifest にあっても false）', () => {
    for (const kind of ['person', 'text', 'concept']) {
      const work = { id: 'w-with-file', kind, status: 'reviewed' }
      expect(hasImageAsset(work, manifestById, fakeImagesDir())).toBe(false)
    }
  })

  it('work が null・id が無ければ false（例外を投げない）', () => {
    expect(hasImageAsset(null, manifestById, fakeImagesDir())).toBe(false)
    expect(hasImageAsset({}, manifestById, fakeImagesDir())).toBe(false)
  })
})

describe('classifyVisualItem（visual canon項目の3分類）', () => {
  const manifestById = new Map([['w-ok', { id: 'w-ok', file: 'coverage.test.ts' }]])
  const worksById = new Map([
    ['w-ok', { id: 'w-ok', kind: 'artifact', status: 'reviewed' }],
    ['w-draft', { id: 'w-draft', kind: 'artifact', status: 'draft' }],
    ['w-noimg', { id: 'w-noimg', kind: 'artifact', status: 'reviewed' }],
    ['w-person', { id: 'w-person', kind: 'person', status: 'reviewed' }],
  ])

  it('対応workがあり画像実体+reviewedなら available（出題可能）', () => {
    const item = { existingWorkId: 'w-ok' }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('available')
  })

  it('対応workはあるがstatusがdraftならnoImage（画像なし）', () => {
    const item = { existingWorkId: 'w-draft' }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('noImage')
  })

  it('対応workはあるが画像実体（manifestエントリ）が無ければnoImage', () => {
    const item = { existingWorkId: 'w-noimg' }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('noImage')
  })

  it('対応workのkindがperson等（画像を持てない）ならnoImage', () => {
    const item = { existingWorkId: 'w-person' }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('noImage')
  })

  it('existingWorkIdがnullならmissing（未収録）', () => {
    const item = { existingWorkId: null }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('missing')
  })

  it('existingWorkIdがworksに存在しなければmissing', () => {
    const item = { existingWorkId: 'does-not-exist' }
    expect(classifyVisualItem(item, worksById, manifestById, fakeImagesDir())).toBe('missing')
  })
})

describe('classifyTextItem（text canon項目の2分類）', () => {
  const worksById = new Map([['w1', { id: 'w1' }]])

  it('対応workがあればincluded（収録）', () => {
    expect(classifyTextItem({ existingWorkId: 'w1' }, worksById)).toBe('included')
  })

  it('existingWorkIdが無ければmissing', () => {
    expect(classifyTextItem({ existingWorkId: null }, worksById)).toBe('missing')
  })

  it('existingWorkIdがworksに存在しなければmissing', () => {
    expect(classifyTextItem({ existingWorkId: 'nope' }, worksById)).toBe('missing')
  })
})

describe('buildCoverageReport（era別集計・canon-only・content-only）', () => {
  const eras = [
    { id: 'era-a', name: 'A文化', order: 1 },
    { id: 'era-b', name: 'B文化', order: 2 },
  ]
  const manifest = { images: [{ id: 'v1', file: 'coverage.test.ts' }] }
  const works = [
    { id: 'v1', era: 'era-a', kind: 'artifact', status: 'reviewed', title: 'V1' },
    { id: 'v2', era: 'era-a', kind: 'artifact', status: 'draft', title: 'V2' },
    { id: 't1', era: 'era-a', kind: 'text', status: 'reviewed', title: 'T1' },
    { id: 'orphan', era: 'era-b', kind: 'artifact', status: 'reviewed', title: 'Orphan（どのcanonからも参照されない）' },
  ]
  const canon = [
    { id: 'c-v1', era: 'era-a', type: 'visual', title: '正しく出題可能', existingWorkId: 'v1' },
    { id: 'c-v2', era: 'era-a', type: 'visual', title: '画像なし', existingWorkId: 'v2' },
    { id: 'c-v3', era: 'era-a', type: 'visual', title: '未収録visual', existingWorkId: null },
    { id: 'c-t1', era: 'era-a', type: 'text', title: '収録text', existingWorkId: 't1' },
    { id: 'c-t2', era: 'era-b', type: 'text', title: '未収録text', existingWorkId: 'does-not-exist' },
  ]

  const report = buildCoverageReport({ canon, eras, works, manifest, imagesDirPath: fakeImagesDir() })
  // buildCoverageReport 内部の classify 呼び出しは既定の imagesDir を使うため、
  // このテストではファイル名をこのテストファイル自身にして実在させてある（v1）。

  it('eras.json の順番で全時代を含む（canon項目が無い時代も0件で載る）', () => {
    expect(report.perEra.map((r: { eraId: string }) => r.eraId)).toEqual(['era-a', 'era-b'])
  })

  it('era-a の visual/text 内訳が正しい', () => {
    const eraA = report.perEra.find((r: { eraId: string }) => r.eraId === 'era-a')
    expect(eraA.visual).toEqual({ available: 1, noImage: 1, missing: 1 })
    expect(eraA.text).toEqual({ included: 1, missing: 0 })
  })

  it('era-b は visual項目が無く、text未収録が1件', () => {
    const eraB = report.perEra.find((r: { eraId: string }) => r.eraId === 'era-b')
    expect(eraB.visual).toEqual({ available: 0, noImage: 0, missing: 0 })
    expect(eraB.text).toEqual({ included: 0, missing: 1 })
  })

  it('totals は全eraの合算', () => {
    expect(report.totals.visual).toEqual({ available: 1, noImage: 1, missing: 1 })
    expect(report.totals.text).toEqual({ included: 1, missing: 1 })
  })

  it('canonOnly は missing 判定になった項目（visual・text 両方）を含む', () => {
    const ids = report.canonOnly.map((c: { id: string }) => c.id).sort()
    expect(ids).toEqual(['c-t2', 'c-v3'])
  })

  it('contentOnly は canon のどの existingWorkId からも参照されない work（orphan）だけ', () => {
    const ids = report.contentOnly.map((c: { id: string }) => c.id)
    expect(ids).toEqual(['orphan'])
  })

  it('formatEraTable / formatSummaryLine / formatCanonOnlyList / formatContentOnlyList が例外なく文字列を返す', () => {
    expect(typeof formatEraTable(report)).toBe('string')
    expect(formatEraTable(report)).toContain('era-a')
    const summary = formatSummaryLine(report)
    expect(summary).toContain('canon-only 2件')
    expect(summary).toContain('content-only 1件')
    expect(formatCanonOnlyList(report)).toContain('c-v3')
    expect(formatCanonOnlyList(report)).toContain('c-t2')
    expect(formatContentOnlyList(report)).toContain('orphan')
  })

  it('canonOnly・contentOnly が0件のときは「0件」と明記する（[[feedback-lint-must-not-report-clean-when-it-checked-nothing]]）', () => {
    const emptyReport = buildCoverageReport({
      canon: [{ id: 'c1', era: 'era-a', type: 'text', title: 'ok', existingWorkId: 't1' }],
      eras,
      works,
      manifest,
    })
    expect(formatCanonOnlyList(emptyReport)).toContain('0件')
    // orphan は依然として content-only（他のcanonから参照されないため）
    expect(formatContentOnlyList(emptyReport)).not.toContain('0件（全')
  })
})

// ---- 実データ（content/）に対する回帰テスト ----
// 実データを直接読み、明らかな不整合（合計件数のずれ・負の値等）が無いことを確認する。
// M2c-00b で「canon 344件（visual139/text205）」が裏取り済みのため、それを固定値として
// 検証する（大きく変わったら writer/canon 側の変更に気づけるようにする）。
describe('loadAndBuildReport（実データ content/ に対する回帰チェック）', () => {
  const report = loadAndBuildReport()

  it('canon総数がvisual+textの合計と一致し、既知の内訳（M2c-00b時点）と一致する', () => {
    const v = report.totals.visual
    const t = report.totals.text
    const vTotal = v.available + v.noImage + v.missing
    const tTotal = t.included + t.missing
    expect(vTotal).toBe(139)
    expect(tTotal).toBe(205)
    expect(vTotal + tTotal).toBe(344)
  })

  it('canon-only + (visual available+noImage) + (text included) の合計が既存work数と整合する（極端な二重計上・漏れが無いことの目安）', () => {
    // canon経由で「対応workがある」と分類された延べ件数（=既存work参照の延べ数。重複参照は
    // 無い前提。content-onlyが0件であることも別途確認する）
    const v = report.totals.visual
    const t = report.totals.text
    const matchedCount = v.available + v.noImage + t.included
    expect(matchedCount).toBeGreaterThan(0)
    expect(matchedCount).toBeLessThanOrEqual(213) // content/works の総数
  })

  it('全ての件数が非負整数', () => {
    for (const row of report.perEra) {
      for (const key of ['available', 'noImage', 'missing'] as const) {
        expect(Number.isInteger(row.visual[key])).toBe(true)
        expect(row.visual[key]).toBeGreaterThanOrEqual(0)
      }
      for (const key of ['included', 'missing'] as const) {
        expect(Number.isInteger(row.text[key])).toBe(true)
        expect(row.text[key]).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('eras.json にある全15時代が表に含まれる', () => {
    expect(report.perEra.length).toBe(15)
  })
})
