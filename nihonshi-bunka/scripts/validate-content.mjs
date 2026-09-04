#!/usr/bin/env node
// content/ の整合性チェック。DESIGN.md 6章・7章:
//  必須項目・era の存在・confusables[].id の参照先の存在・id の重複・status の値。
//  status: reviewed の作品は manifest.json に同じ id のエントリ（file・license・
//  sourceUrl・attributionText 必須）と画像実体が無ければエラー（本番ビルドに含まれる
//  のに出典を欠くのを防ぐ）。draft はエントリ無しでも警告のみ（M1 は全件 draft）。
//  confusables が1件以下の作品は警告（DESIGN.md 3章: ディストラクタの質に関わる）。
// M2 チケット「テーマセット・モード」で追加:
//  work.kind（'artifact'省略時デフォルト|'person'|'text'|'concept'）。person/text/concept は
//  image/location/technique/confusables を必須から外す（facts/explanation/sources/category/status は必須のまま）。
//  work.holder / work.subject（任意、型チェックのみ）。
//  eras.json の各要素の weight（数値、省略時は1。無くても警告のみ）。
//  content/passages/<era>.json（リード文＋下線部）の検証（下記 validatePassages 参照）。
// npm run build の prebuild で必ず走る。エラーがあれば exit code 1 で失敗させる
// （警告のみなら exit 0）。
//
// 実行: node scripts/validate-content.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const worksDir = join(root, 'content', 'works')
const erasPath = join(root, 'content', 'eras.json')
const imagesDir = join(root, 'content', 'images')
const manifestPath = join(imagesDir, 'manifest.json')
const passagesDir = join(root, 'content', 'passages')

// status: reviewed で必須の manifest フィールド
const REQUIRED_MANIFEST_FIELDS = ['file', 'license', 'sourceUrl', 'attributionText']

// 全 kind 共通で必須の項目
const COMMON_REQUIRED_FIELDS = ['id', 'title', 'reading', 'era', 'category', 'explanation', 'sources', 'examTags', 'status']

// kind: artifact（省略時デフォルト）のみ必須の項目（画像で出題するための項目）
const ARTIFACT_ONLY_REQUIRED_FIELDS = ['location', 'technique', 'keyPoints', 'confusables', 'image']

const VALID_CATEGORIES = new Set([
  'architecture',
  'sculpture',
  'painting',
  'craft',
  'calligraphy',
  'garden',
  'other',
])

const VALID_STATUS = new Set(['draft', 'reviewed'])
const VALID_KINDS = new Set(['artifact', 'person', 'text', 'concept'])

// underlines[].ask（下線から出したい設問の型・条件スロット。省略可）。
// app/src/types.ts の PassageUnderlineAsk と揃える（M2-09〜11 修正の仕様・8章「二段構え」・9章）。
const VALID_ASK_SLOTS = new Set(['holder', 'artist', 'technique', 'era', 'subject'])
// q13（語句の組合せ。M2-16）は app/src/types.ts の PassageUnderlineAsk.type に追加した。
const VALID_ASK_TYPES = new Set(['q9', 'q10', 'q4', 'q11', 'q12', 'q13'])
const VALID_PASSAGE_KINDS = new Set(['text', 'image'])

// 純関数として export し、app/src 側の Vitest から直接検証できるようにする
// （このファイル自体は node scripts/validate-content.mjs として直接実行する想定だが、
// 下記 main() の呼び出しはこのファイルが「直接実行されたとき」だけに限定してあるので、
// import しても副作用（実ファイル読み込み・process.exit）は起きない）。

/** 本文（マーカー記法込みの全文）に work.title が部分文字列として含まれるか。
 *  下線先作品の答えが本文に書かれているのを機械的に防ぐチェックに使う（7章の指摘）。 */
export function workTitleLeaksInText(work, text) {
  return Boolean(work && work.title && typeof text === 'string' && text.includes(work.title))
}

/** underlines[].ask の値が正しいか（type が許可された列挙値か。slot は8章「二段構え」から
 *  省略可になった＝ある場合だけ列挙値を検査する）。不正な項目名の配列（'slot' | 'type'）を返す。
 *  問題無ければ空配列。 */
export function invalidAskFields(ask) {
  if (!ask || typeof ask !== 'object') return ['type']
  const invalid = []
  if (!ask.type || !VALID_ASK_TYPES.has(ask.type)) invalid.push('type')
  if ('slot' in ask && ask.slot != null && !VALID_ASK_SLOTS.has(ask.slot)) invalid.push('slot')
  return invalid
}

/** 下線の文（本文中の該当 [[key|...]] マーカーの中身）に、work の title/technique/subject が
 *  部分文字列として含まれているか。8章「二段構え」: 下線は一段外した手がかりで、
 *  答え（作品の材質・図様・作品名）を下線自体に書いてはいけない、の機械検査。
 *  含まれていたフィールド名の配列（'title' | 'technique' | 'subject'）を返す。無ければ空配列。 */
export function answerLeaksInUnderlineText(work, underlineText) {
  if (!work || typeof underlineText !== 'string' || !underlineText) return []
  const leaked = []
  for (const field of ['title', 'technique', 'subject']) {
    const value = work[field]
    if (value && typeof value === 'string' && underlineText.includes(value)) {
      leaked.push(field)
    }
  }
  return leaked
}

// リード文の下線マーカー。app/src/engine/passage.ts の UNDERLINE_MARKER と揃える
// （プレーン Node ESM のスクリプトからは TS を直接 import できないため重複実装。
// 変更する場合は両方揃え、app 側は __tests__/passage.test.ts で固定してある）。
const UNDERLINE_MARKER = /\[\[([a-zA-Z0-9_-]+)\|([^\]]*)\]\]/g

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'))
}

function extractUnderlineKeys(text) {
  const keys = []
  const re = new RegExp(UNDERLINE_MARKER)
  let match
  while ((match = re.exec(text))) {
    keys.push(match[1])
  }
  return keys
}

/** text 内の `[[key|value]]` マーカーから key → value（下線部の文言）の対応表を作る。 */
function underlineTextByKey(text) {
  const map = new Map()
  const re = new RegExp(UNDERLINE_MARKER)
  let match
  while ((match = re.exec(text))) {
    map.set(match[1], match[2])
  }
  return map
}

// content/passages/<era>.json（リード文＋下線部→図版問題。M2 チケット「テーマセット」）の検証。
//  各要素 {id, era, title, text, sources, underlines:[{key, workIds, note?, anchorKind?, ask?}],
//   kind?: "text"|"image", leadWorkIds?}。
//  - text 内の [[key|...]] マーカーと underlines[].key が過不足なく一致すること
//  - kind が省略時 "text": workIds が実在する作品 id であり、かつその作品が画像を持つ
//    （kind: artifact/省略 かつ manifest.json にエントリがあり画像実体が content/images/ にある）
//    こと（満たさなければエラー。「生成できない下線」を公開させないため）
//  - kind: "image"（9章「画像リード型セット」）: leadWorkIds が1件以上、すべて画像を持つ作品で
//    あること。underlines[].workIds は省略・空でもよい（leadWorkIds を対象にする）
//  - text（マーカー記法込みの全文）に、workIds が参照する作品の title が部分文字列として
//    含まれていたらエラー（下線先作品の答えが本文に書かれているのを機械的に防ぐ。
//    mock-exam-analysis.md 7章の修正の仕様）
//  - underlines[].ask（省略可）: type が q9/q10/q4/q11/q12、slot（あれば）が
//    holder/artist/technique/era/subject のいずれかであること（不正な値はエラー）
//  - ask.answerId/distractorIds（8章「二段構え」）: 出題プールにある playable な作品 id で
//    重複が無いこと。下線の文（[[key|...]] の中身）に answerId が指す作品の
//    title/technique/subject が部分文字列として含まれていたらエラー（二段構えの原則違反。
//    材質・図様・作品名を下線に書かない）
//  - ask.type === 'q12'（9章）: answerText と distractorTexts（3件）が必須
//  - 下線は1passageにつき3〜5個、text は200〜400字程度（目安。文字数は警告のみ）
function validatePassages({ worksById, hasImageAsset, hasThemeSetAsset, eraIds, errors, warnings }) {
  if (!existsSync(passagesDir)) {
    // M2 コンテンツ投入前は無くてもよい（エラーにしない）
    return
  }
  const files = readdirSync(passagesDir).filter((f) => f.endsWith('.json'))
  const seenIds = new Map()

  for (const file of files) {
    let passages
    try {
      passages = loadJson(join(passagesDir, file))
    } catch (e) {
      errors.push(`passages/${file}: JSON として読めない（${e.message}）`)
      continue
    }
    if (!Array.isArray(passages)) {
      errors.push(`passages/${file}: 配列である必要がある`)
      continue
    }

    for (const passage of passages) {
      const label = `passages/${file} / ${passage.id ?? '(id無し)'}`

      for (const field of ['id', 'era', 'title', 'text', 'sources', 'underlines']) {
        if (!(field in passage)) {
          errors.push(`${label}: 必須項目 "${field}" が無い`)
        }
      }
      if (!passage.id || !passage.text || !Array.isArray(passage.underlines)) continue

      if (seenIds.has(passage.id)) {
        errors.push(`${label}: id "${passage.id}" が ${seenIds.get(passage.id)} と重複している`)
      } else {
        seenIds.set(passage.id, `passages/${file}`)
      }

      if (passage.era && !eraIds.has(passage.era)) {
        errors.push(`${label}: era "${passage.era}" は content/eras.json に無い`)
      }

      // 文字数は目安（厳密チェックしない。警告のみ）
      const len = passage.text.length
      if (len < 150 || len > 500) {
        warnings.push(`${label}: 本文が ${len} 字（目安 200〜400 字から外れている）`)
      }

      // 下線数の目安
      if (passage.underlines.length < 3 || passage.underlines.length > 5) {
        warnings.push(`${label}: 下線が ${passage.underlines.length} 個（目安 3〜5 個）`)
      }

      // kind（省略時 "text"）・leadWorkIds（9章「画像リード型セット」）
      const passageKind = 'kind' in passage ? passage.kind : 'text'
      if ('kind' in passage && !VALID_PASSAGE_KINDS.has(passage.kind)) {
        errors.push(`${label}: kind "${passage.kind}" は text/image のいずれかである必要がある`)
      }
      const isImageLead = passageKind === 'image'
      let leadWorksOk = false
      if (isImageLead) {
        if (!Array.isArray(passage.leadWorkIds) || passage.leadWorkIds.length === 0) {
          errors.push(`${label}: kind が "image" のとき leadWorkIds が1件以上必要`)
        } else {
          for (const id of passage.leadWorkIds) {
            const work = worksById.get(id)
            if (!work) {
              errors.push(`${label}: leadWorkIds "${id}" は存在しない作品`)
              continue
            }
            if (!hasImageAsset(work)) {
              errors.push(`${label}: leadWorkIds "${id}" は画像で出題できない（manifest.json に無い、または画像実体が無い）`)
              continue
            }
            leadWorksOk = true
          }
        }
      }

      // text 内マーカーと underlines[].key の過不足一致
      const textKeys = extractUnderlineKeys(passage.text)
      const textKeySet = new Set(textKeys)
      const underlineKeySet = new Set(passage.underlines.map((u) => u.key).filter(Boolean))

      const dupInText = textKeys.filter((k, i) => textKeys.indexOf(k) !== i)
      if (dupInText.length > 0) {
        errors.push(`${label}: 本文中で下線キーが重複している: ${[...new Set(dupInText)].join(', ')}`)
      }
      for (const k of textKeySet) {
        if (!underlineKeySet.has(k)) {
          errors.push(`${label}: 本文のマーカー "[[${k}|...]]" に対応する underlines[].key が無い`)
        }
      }
      for (const k of underlineKeySet) {
        if (!textKeySet.has(k)) {
          errors.push(`${label}: underlines[].key "${k}" が本文中のマーカーに無い`)
        }
      }

      // underlines[].workIds の検証
      const underlineTexts = underlineTextByKey(passage.text)
      for (const underline of passage.underlines) {
        if (!underline.key) {
          errors.push(`${label}: underlines に key の無い要素がある`)
          continue
        }
        const hasOwnWorkIds = Array.isArray(underline.workIds) && underline.workIds.length > 0
        // kind: "image" の下線は workIds を省略・空にでき、その場合は leadWorkIds を対象にする（9章）。
        if (!hasOwnWorkIds && !(isImageLead && leadWorksOk)) {
          errors.push(`${label} / ${underline.key}: workIds が無いか空（kind が "image" で leadWorkIds が有効な場合を除く）`)
          continue
        }
        let hasGeneratable = isImageLead && leadWorksOk && !hasOwnWorkIds
        if (hasOwnWorkIds) {
          for (const workId of underline.workIds) {
            const work = worksById.get(workId)
            if (!work) {
              errors.push(`${label} / ${underline.key}: workIds "${workId}" は存在しない作品`)
              continue
            }
            // M2-16: 画像で出題できる（Q1/Q2/Q9等）か、文字問題の素材にできる（kind:
            // person/text/concept。Q4/Q10/Q13等）かのどちらかがあれば「生成できる可能性がある」
            // とみなす（実際に生成できるかは実行時判断。上のコメント参照）。
            if (hasThemeSetAsset(work)) hasGeneratable = true
            // 下線先作品の答えが本文に書かれていないか（図版問題の答えが本文に出ているのを防ぐ。
            // mock-exam-analysis.md 7章の指摘）。text 全体（マーカー記法込み）に、workIds が
            // 参照する作品の title が部分文字列として含まれていたらエラー。
            if (workTitleLeaksInText(work, passage.text)) {
              errors.push(
                `${label} / ${underline.key}: 本文に workIds "${workId}" の作品名 "${work.title}" がそのまま含まれている（図版問題の答えが本文に出てしまう）`,
              )
            }
          }
        }
        if (!hasGeneratable) {
          errors.push(
            `${label} / ${underline.key}: workIds のどれも設問を生成できない（画像で出題できず、kind も artifact のまま＝文字問題の素材にもできない）`,
          )
        }

        // ask（下線から出したい設問の型・条件スロット。省略可）。値が不正ならエラー。
        if ('ask' in underline && underline.ask != null) {
          const ask = underline.ask
          const invalid = invalidAskFields(ask)
          if (invalid.includes('type')) {
            errors.push(`${label} / ${underline.key}: ask.type "${ask.type}" は q9/q10/q4/q11/q12 のいずれかである必要がある`)
          }
          if (invalid.includes('slot')) {
            errors.push(
              `${label} / ${underline.key}: ask.slot "${ask.slot}" は holder/artist/technique/era/subject のいずれかである必要がある`,
            )
          }

          // 8章「二段構え」: answerId/distractorIds は出題プールにある playable な作品 id で、
          // 重複が無いこと。
          if ('answerId' in ask && ask.answerId != null) {
            const answerWork = worksById.get(ask.answerId)
            if (!answerWork || !hasImageAsset(answerWork)) {
              errors.push(`${label} / ${underline.key}: ask.answerId "${ask.answerId}" は出題プールにある作品である必要がある`)
            }
            // 下線の文に answerId が指す作品の title/technique/subject が含まれていないか
            // （8章: 材質・図様・作品名は下線に書かない、の機械検査）。
            if (answerWork) {
              const underlineText = underlineTexts.get(underline.key) ?? ''
              const leaked = answerLeaksInUnderlineText(answerWork, underlineText)
              for (const field of leaked) {
                errors.push(
                  `${label} / ${underline.key}: 下線の文に answerId "${ask.answerId}" の ${field}「${answerWork[field]}」が含まれている（二段構えの原則違反。下線は一段外した手がかりにする）`,
                )
              }
            }
          }
          if (Array.isArray(ask.distractorIds)) {
            const seen = new Set()
            for (const id of ask.distractorIds) {
              if (seen.has(id)) {
                errors.push(`${label} / ${underline.key}: ask.distractorIds に重複がある: ${id}`)
              }
              seen.add(id)
              const w = worksById.get(id)
              if (!w || !hasImageAsset(w)) {
                errors.push(`${label} / ${underline.key}: ask.distractorIds "${id}" は出題プールにある作品である必要がある`)
              }
            }
            if (ask.answerId && ask.distractorIds.includes(ask.answerId)) {
              errors.push(`${label} / ${underline.key}: ask.distractorIds に answerId と同じ作品 "${ask.answerId}" が含まれている`)
            }
          }

          // reviewer 指摘 [重大]-1（2026-09-04 M2-14）: stem が「最も不適切なもの」を問う文面
          // なのに ask.reversed が無いと、engine は通常型（正文1＋誤文3）を先に試して必ず
          // 成功するため、正解フラグが適切な（正しい）文に付いたまま出題され採点が反転する。
          if (ask.type === 'q4' && typeof ask.stem === 'string' && ask.stem.includes('不適切') && !ask.reversed) {
            errors.push(
              `${label} / ${underline.key}: ask.stem に「不適切」が含まれるが ask.reversed が true でない（正解が反転する）`,
            )
          }
          // q13（語句の組合せ。M2-16）も reversed（「誤っている組合せはどれか」）を持てる。
          if (ask.reversed && ask.type !== 'q4' && ask.type !== 'q13') {
            errors.push(`${label} / ${underline.key}: ask.reversed は ask.type が "q4"/"q13" のときのみ使える`)
          }

          // 9章「画像リード型セット」: q12 は answerText・distractorTexts（3件）が必須。
          if (ask.type === 'q12') {
            if (!ask.answerText || typeof ask.answerText !== 'string') {
              errors.push(`${label} / ${underline.key}: ask.type が "q12" のとき answerText が必要`)
            }
            if (!Array.isArray(ask.distractorTexts) || ask.distractorTexts.length !== 3) {
              errors.push(`${label} / ${underline.key}: ask.type が "q12" のとき distractorTexts は3件必要`)
            }
          }
        }
      }
    }
  }
}

function main() {
  const errors = []
  const warnings = []

  let manifest = { images: [] }
  try {
    manifest = loadJson(manifestPath)
  } catch (e) {
    errors.push(`content/images/manifest.json が読めない（${e.message}）`)
  }
  const manifestById = new Map((manifest.images ?? []).filter((img) => img.id).map((img) => [img.id, img]))

  const eras = loadJson(erasPath)
  if (!Array.isArray(eras)) {
    console.error('content/eras.json は配列である必要がある')
    process.exit(1)
  }
  const eraIds = new Set(eras.map((e) => e.id))

  // weight（自由出題・時代ボスの重み）。省略時は1として扱う。数値でなければエラー、
  // 無いだけなら警告（既存コンテンツを壊さないため）。
  for (const era of eras) {
    if (!('weight' in era)) {
      warnings.push(`content/eras.json / ${era.id}: weight が無い（省略時は1として扱う）`)
    } else if (typeof era.weight !== 'number' || era.weight <= 0) {
      errors.push(`content/eras.json / ${era.id}: weight は正の数値である必要がある`)
    }
  }

  const workFiles = readdirSync(worksDir).filter((f) => f.endsWith('.json'))
  if (workFiles.length === 0) {
    errors.push('content/works/ に .json ファイルが1つも無い')
  }

  const allWorks = []
  const idToFile = new Map()

  for (const file of workFiles) {
    let works
    try {
      works = loadJson(join(worksDir, file))
    } catch (e) {
      errors.push(`${file}: JSON として読めない（${e.message}）`)
      continue
    }
    if (!Array.isArray(works)) {
      errors.push(`${file}: 配列である必要がある`)
      continue
    }
    for (const work of works) {
      allWorks.push(work)

      const label = `${file} / ${work.id ?? '(id無し)'}`

      // kind（省略時 artifact）。不正な値ならエラー、以降の判定にも使う
      const kind = 'kind' in work ? work.kind : 'artifact'
      if ('kind' in work && !VALID_KINDS.has(work.kind)) {
        errors.push(`${label}: kind "${work.kind}" は artifact/person/text/concept のいずれかである必要がある`)
      }
      const isArtifact = kind === 'artifact' || !VALID_KINDS.has(kind)

      // 必須項目（全 kind 共通 ＋ artifact のみ）
      const requiredFields = isArtifact ? [...COMMON_REQUIRED_FIELDS, ...ARTIFACT_ONLY_REQUIRED_FIELDS] : COMMON_REQUIRED_FIELDS
      for (const field of requiredFields) {
        if (!(field in work)) {
          errors.push(`${label}: 必須項目 "${field}" が無い`)
        }
      }

      // holder / subject（任意。型チェックのみ）
      if ('holder' in work && work.holder !== null && typeof work.holder !== 'string') {
        errors.push(`${label}: holder は string か null である必要がある`)
      }
      if ('subject' in work && work.subject !== null && typeof work.subject !== 'string') {
        errors.push(`${label}: subject は string か null である必要がある`)
      }

      // pairs（語句の組合せ問題 T1/Q13 の素材）・orderIndex（年代順並べ替え T7/Q14）は
      // M2-16 で追加した任意フィールド（writer が M2-17 で投入中）。型チェックのみ、
      // 無くてもエラー・警告にしない（無い作品は Q13/Q14 が自然にスキップされる設計）。
      if ('pairs' in work && work.pairs !== undefined) {
        if (!Array.isArray(work.pairs)) {
          errors.push(`${label}: pairs は配列である必要がある`)
        } else {
          work.pairs.forEach((p, i) => {
            if (!p || typeof p.a !== 'string' || !p.a || typeof p.b !== 'string' || !p.b) {
              errors.push(`${label}: pairs[${i}] は非空の a・b（string）を持つ必要がある`)
            }
          })
        }
      }
      if ('orderIndex' in work && work.orderIndex !== undefined && typeof work.orderIndex !== 'number') {
        errors.push(`${label}: orderIndex は number である必要がある`)
      }

      // id の重複
      if (work.id) {
        if (idToFile.has(work.id)) {
          errors.push(`${label}: id "${work.id}" が ${idToFile.get(work.id)} と重複している`)
        } else {
          idToFile.set(work.id, file)
        }
      }

      // era の存在
      if (work.era && !eraIds.has(work.era)) {
        errors.push(`${label}: era "${work.era}" は content/eras.json に無い`)
      }

      // category: artifact は視覚カテゴリの列挙値に限定（同カテゴリ・近時代のディストラクタ選定に使うため）。
      // person/text/concept は出題プールに入らずディストラクタ選定に使われないため、
      // 自由記述の分類（literature/person 等）を許す（非空文字列であることだけ確認）。
      if (isArtifact) {
        if (work.category && !VALID_CATEGORIES.has(work.category)) {
          errors.push(`${label}: category "${work.category}" は不正な値`)
        }
      } else if ('category' in work && typeof work.category !== 'string') {
        errors.push(`${label}: category は string である必要がある`)
      }

      // status
      if (work.status && !VALID_STATUS.has(work.status)) {
        errors.push(`${label}: status "${work.status}" は draft か reviewed である必要がある`)
      }

      // confusables[].id の参照先
      if (Array.isArray(work.confusables)) {
        for (const c of work.confusables) {
          if (!c.id) {
            errors.push(`${label}: confusables に id の無い要素がある`)
            continue
          }
          if (!c.howToTell) {
            errors.push(`${label}: confusables["${c.id}"] に howToTell が無い`)
          }
        }
        // ディストラクタの質: confusable が1件以下だと選択肢生成が同カテゴリ・
        // 全体ランダムに頼りがちになる（DESIGN.md 3章）。警告のみ（ブロックしない）。
        if (work.confusables.length <= 1) {
          warnings.push(`${label}: confusables が ${work.confusables.length} 件しかない（2件以上を推奨）`)
        }
      }

      // manifest.json との照合（画像のライセンス記録）。id で引く
      // （works 側の image.file は拡張子が違うことがあるため file 名では引かない）。
      // kind が person/text/concept の作品は画像を持たないため対象外。
      if (work.id && isArtifact) {
        const entry = manifestById.get(work.id)
        if (work.status === 'reviewed') {
          if (!entry) {
            errors.push(
              `${label}: status が reviewed だが content/images/manifest.json に id "${work.id}" のエントリが無い`,
            )
          } else {
            for (const field of REQUIRED_MANIFEST_FIELDS) {
              if (!entry[field]) {
                errors.push(`${label}: manifest["${work.id}"] に "${field}" が無い（reviewed には必須）`)
              }
            }
            if (entry.file && !existsSync(join(imagesDir, entry.file))) {
              errors.push(`${label}: manifest["${work.id}"].file "${entry.file}" の画像実体が content/images/ に無い`)
            }
          }
        } else if (!entry) {
          warnings.push(`${label}: manifest.json に id "${work.id}" のエントリが無い（draft のため警告のみ）`)
        }
      }
    }
  }

  // confusables[].id の参照先の存在チェック（全作品を読み終えてから）
  const allIds = new Set(allWorks.map((w) => w.id).filter(Boolean))
  for (const work of allWorks) {
    if (!Array.isArray(work.confusables)) continue
    for (const c of work.confusables) {
      if (c.id && !allIds.has(c.id)) {
        errors.push(`${work.id}: confusables の参照先 "${c.id}" が存在しない`)
      }
    }
  }

  // 作品ごとに「出題プールにある画像付き作品」かどうか（passages の workIds 検証に使う）
  const worksById = new Map(allWorks.filter((w) => w.id).map((w) => [w.id, w]))
  function hasImageAsset(work) {
    if (!work || !work.id) return false
    const kind = 'kind' in work ? work.kind : 'artifact'
    const isArtifactKind = kind === 'artifact' || !VALID_KINDS.has(kind)
    if (!isArtifactKind) return false
    const entry = manifestById.get(work.id)
    if (!entry || !entry.file) return false
    return existsSync(join(imagesDir, entry.file))
  }

  // M2-16: 画像を持たない項目（kind: person/text/concept）を文字問題（語句組合せ・2文正誤・
  // 4択・適切/不適切な文）の下線先に戻したため、「画像で出題できる」以外にも
  // 「文字問題の素材にできる」（= app/src/content.ts の themeSetPool と同じ判定）を
  // 生成可否の判定に加える。画像が要る型（Q9・Q1）は engine 側が imagePool だけを見るため、
  // ここでの緩和は「そのどちらの型かは分からないが、何かは生成できる可能性がある」を
  // ブロックしないためのもの（実際に生成できるかは buildThemeSetQuestions が実行時に判断し、
  // 生成できなければ console.warn でスキップする。M2 チケット「進め方」どおり）。
  function hasThemeSetAsset(work) {
    if (!work || !work.id) return false
    const kind = 'kind' in work ? work.kind : 'artifact'
    const isArtifactKind = kind === 'artifact' || !VALID_KINDS.has(kind)
    return isArtifactKind ? hasImageAsset(work) : true
  }

  validatePassages({ worksById, hasImageAsset, hasThemeSetAsset, eraIds, errors, warnings })

  if (warnings.length > 0) {
    console.warn(`content の警告 ${warnings.length} 件:`)
    for (const w of warnings) console.warn(`  - ${w}`)
  }

  if (errors.length > 0) {
    console.error(`content の検証エラー ${errors.length} 件:`)
    for (const e of errors) console.error(`  - ${e}`)
    process.exit(1)
  }

  console.log(`content OK: ${allWorks.length} 作品 / ${eras.length} 時代（警告 ${warnings.length} 件）`)
}

// このファイルが `node scripts/validate-content.mjs` として直接実行されたときだけ main() を走らせる。
// Vitest から workTitleLeaksInText / invalidAskFields を import するときに、実ファイルの読み込みや
// process.exit が副作用として起きないようにするため（app/src/engine/__tests__ 参照）。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}
