# M2-51 出典URL調査ログ（群A：担当44件）

対象: genshi.json(7) / asuka.json(8) / hakuho.json(7) / konin-jogan.json(8) / kokufu.json(7) / tenpyo.json(7)

## 結論（3行以内）
44件中31件で公的機関（文化庁・国立博物館・大学研究機関・寺社/宗派公式・都道府県市区町村公式）のURLをsourcesに追加できた。13件は探したが見つからなかった、または見つかったが直接確認できず不採用とした（内訳は下記）。全件で`node scripts/validate-content.mjs`のJSON構文チェックを通過し、既存の記述内容・事実は変更していない（sourcesの追加・訂正のみ）。

## URLを追加できた31件（出典は各JSONのsourcesを参照）
- genshi.json: zenpokoenfun（百舌鳥・古市古墳群公式）, kaizuka-jomon（品川区立品川歴史館）, basshi-jomon（富山県公式）, ishibocho（明治大学博物館）, kangou-shuraku（吉野ヶ里歴史公園公式）, kamekan-bo（同）, fukusohin-henka（大阪大学考古学研究室）
- asuka.json: tori-busshi（奈良文化財研究所公式ブログ）, shotoku-taishi（四天王寺公式）, sangyo-gisho（ジャパンサーチ）, asukadera-shitennoji（四天王寺公式）, garan-haichi（奈良県公式）, tenjukoku-shucho（奈良国立博物館、※後述の限界あり）
- hakuho.json: kitora-kofun-heki（文化庁）, hakuho-kajin（奈良県立万葉文化館）, fujiwarakyo（奈良文化財研究所）, kanji-zoei（奈良県公式）, horyuji-saiken-ronso（奈良県公式）, kokushi-hensan（国立公文書館）
- konin-jogan.json: saicho-kukai（比叡山延暦寺公式・高野山金剛峯寺公式）, sanpitsu（東寺公式）, mikkyo-kaiga（東寺公式）
- kokufu.json: kuya-genshin（六波羅蜜寺公式・天台宗公式）, raigozu（高野山霊宝館公式）, yamato-e（東京国立博物館）
- tenpyo.json: nanto-rokushu（唐招提寺公式）, kokubunji-daibutsu（東大寺公式・奈良女子大学）, gyoki-ganjin（唐招提寺公式）, kojiki-nihonshoki（国立公文書館）, fudoki（島根県公式）, manyoshu-kaifuso（奈良県立万葉文化館）

## 見つからなかった／不採用とした13件（「存在しない」と「見つけられなかった」を区別）

すべて「見つけられなかった」（対象事項を専門に解説する公的機関ページの存在自体が確認できなかった、または候補が見つかったが技術的事情で内容確認ができず不採用にした）に該当し、「そのような公的解説が世の中に存在しない」と断定できるものではない。

1. **donchou-kanroku（曇徴・観勒）**: 高句麗・百済からの渡来僧個人を単独で解説する公的機関ページは見当たらず。日本製紙連合会（業界団体）のページはあるが、指示の対象（文化庁・国立博物館・寺社公式・大学）に該当しないため不採用。
2. **hokugi-nancho-yoshiki（北魏様式・南朝様式）**: 様式分類そのものを解説する公的機関の独立ページは検索で当たらず。個別作品ページ（法隆寺金堂釈迦三尊像等）はあるが様式分類の説明ではない。
3. **kentoshi-hakuho（唐初期文化の影響）**: 奈良国立博物館「白鳳」展ページ（narahaku.go.jp/exhibition/special/201507_hakuho/）が候補として検索結果に出たが、WebFetchで403 Forbiddenとなり内容を直接確認できなかったため不採用。
4. **chokusen-kanshishu（凌雲集・文華秀麗集・経国集）**: 3書をまとめて解説する公的機関ページは見当たらず。
5. **kukai-saicho-chosaku（三教指帰・性霊集・顕戒論・山家学生式）**: 同上、著作を解説する公的機関ページは見当たらず。
6. **daigaku-besso（大学別曹）**: 勧学院・弘文院・奨学院・学館院・綜芸種智院を解説する公的機関ページは見当たらず。
7. **ichiboku-honpa（一木造・翻波式）**: 技法分類自体を解説する公的機関ページは見当たらず（artscape.jp＝DNP運営で公的機関に該当せず、不採用）。
8. **shinbutsu-shugo（神仏習合）**: 神護寺の公式サイトのドメインが見当たらず、文化庁の文化遺産オンライン該当ページ（online.bunka.go.jp/heritages/detail/160081）を確認したところ神護寺ではなく御調八幡宮の像であることが判明し不採用。
9. **kokufu-bungaku（古今和歌集・源氏物語・枕草子）**: 3作品をまとめて解説する公的機関ページは見当たらず。
10. **shinden-zukuri（寝殿造）**: 国立歴史民俗博物館が東三条殿模型を所蔵するとの言及はWebSearchの要約に出たが、該当ページURLを特定できなかった。
11. **sanseki（三跡）**: 小野道風・藤原佐理・藤原行成をまとめて解説する公的機関ページは見当たらず。
12. **honji-suijaku（本地垂迹説）**: 概念そのものを解説する公的機関ページは見当たらず。
13. **hiden-seyakuin（悲田院・施薬院、光明皇后）**: 法華寺公式ドメイン（hokkeji-nara.jp）は現在第三者（電話占いランキングサイト）に転用されており使用不可。興福寺公式サイト（kohfukuji.com）はWebFetchで証明書エラー（unable to verify the first certificate）が繰り返し発生し内容を確認できなかった。

## 教科書節名の確信度
44件すべて既存の「高校教科書（山川『詳説日本史』）〇〇文化の項」という節名表記をそのまま維持した（新規追加・訂正なし）。時代区分と項目名の対応（原始文化・飛鳥文化・白鳳文化・弘仁貞観文化・国風文化・天平文化）は一般的な教科書の章立てと一致しており確信度は高いが、**節見出しの正確な字句（例えば「白鳳の美術」等、版により細部が異なる可能性）までは実物の教科書で照合していない**（確信度: 中）。

## 調査の限界
- narahaku.go.jp（奈良国立博物館）とkohfukuji.com（興福寺）はいずれも複数回の直接fetchで失敗（403・証明書エラー）。tenjukoku-shuchoの奈良国立博物館URLはWebSearchのスニペット経由でのみ内容を確認しており、直接fetchでの確認ではない（サイトの表記が事実と異なるリスクはゼロではない）。
- 「見つからなかった」は検索クエリと時間の制約下での結果であり、検索の検出力の限界（別のキーワードや文化庁の別データベースで見つかる可能性）を否定しない。
- 過去問の転載はしていない。他事業のファイルは参照していない。
