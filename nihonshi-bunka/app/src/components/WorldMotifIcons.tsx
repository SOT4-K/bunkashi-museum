// ワールドマップの道端の飾り（M2d-01）。自作のフラット・丸み・線少なめの SVG イラスト
// （CLAUDE.md 禁止事項: 実際の出題画像は飾りに使わない。ここに定義するのは全て手描きの図形）。
// モチーフの中身（どのワールドにどれを置くか）は content/worlds.json 側のデータで持ち、
// このファイルは「id → 描画コンポーネント」のカタログのみを持つ（コードにワールド固有の
// 判断をハードコードしない）。
//
// モチーフ選定理由（LOG.md 転記用の根拠。builder が提案）:
//  - 原始（genshi）: 土偶・埴輪・竪穴住居・銅鐸・貝塚はチケット文面の指定どおり。
//    いずれも content/eras.json の genshi.items（縄文土器・土偶・貝塚・銅鐸・埴輪）に
//    実在する事項で、竪穴住居も教科書レベルの定番（縄文〜弥生の代表的な住居形式）。
//    史実の時代（旧石器〜古墳）と合わないモチーフは含めていない。
//  - 化政（kasei）: 富士・波・旅人・錦絵もチケット文面の指定どおり。葛飾北斎「冨嶽三十六景」
//    （富士・神奈川沖浪裏＝波）、歌川広重の東海道シリーズ（旅人）、多色刷り木版画そのもの
//    （錦絵）は content/works/kasei.json の実作品（kanagawa-oki-namiura 等）と整合する
//    化政文化の代表的主題。
//
// M2d-02（残り13ワールド。各5種、根拠は content/eras.json の各時代 summary/detail/items に
// 実在する事項のみを選定。BOARD.md M2d 設計節のモチーフ例を踏まえつつ、史実と合わないものは
// 含めない）:
//  - 飛鳥（asuka）: 瓦屋根・五重塔・仏像シルエット・蓮弁文・遣隋使船。法隆寺建築と仏教伝来
//    （遣隋使＝小野妹子、items）に整合。
//  - 白鳳（hakuho）: 薬師寺東塔（水煙）・仏頭（興福寺仏頭、detail記載）・高松塚古墳壁画・
//    水煙・万葉の歌（柿本人麻呂・額田王、items）。
//  - 天平（tenpyo）: 大仏・正倉院（校倉造）・鴟尾・国分寺の塔（国分寺建立の詔、items）・
//    万葉の木簡（万葉集、items）。
//  - 弘仁・貞観（konin-jogan）: 曼荼羅・五鈷杵（密教法具）・不動明王・一木造の仏像・
//    三筆の巻物（items）。
//  - 国風（kokufu）: 平等院鳳凰堂・寝殿造・かな文字・十二単・扇。国文学と寝殿造文化（items）。
//  - 院政（insei）: 絵巻物・中尊寺金色堂・鳥獣戯画・六勝寺の塔・田楽面（items）。
//  - 鎌倉（kamakura）: 金剛力士像（東大寺南大門）・南大門・鎧兜・五輪塔・数珠（新仏教、items）。
//  - 北山（kitayama）: 金閣・水墨画・能面（観阿弥・世阿弥）・勘合符（日明貿易）・五山の塔（items）。
//  - 東山（higashiyama）: 銀閣・枯山水・茶碗（侘び茶）・雪舟の水墨画・書院造の障子（items）。
//  - 桃山（momoyama）: 天守・金屏風（濃絵）・茶釜（千利休）・南蛮船・唐獅子（items）。
//  - 寛永（kanei）: 東照宮（権現造）・桂離宮（数寄屋造）・風神雷神（俵屋宗達）・赤絵の壺・
//    蒔絵硯箱（本阿弥光悦、items）。
//  - 元禄（genroku）: 浮世絵の版木（菱川師宣）・燕子花（尾形光琳・琳派）・歌舞伎の隈取・
//    俳句の短冊（松尾芭蕉）・色絵の壺（野々村仁清、items）。
//  - 宝暦・天明（horeki-tenmei）: 大首絵（歌麿・写楽）・エレキテル（平賀源内）・解体新書・
//    文人画（大雅・蕪村）・寺子屋の机（items）。
import type { SVGProps } from 'react'

function MotifBase(props: SVGProps<SVGSVGElement>) {
  return <svg width="40" height="40" viewBox="0 0 64 64" aria-hidden="true" {...props} />
}

/** 遮光器土偶を単純化: 丸い頭部（ゴーグル状の目）+ 台形の胴体。 */
export function DoguIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M20 58 L18 34 Q18 20 32 20 Q46 20 46 34 L44 58 Z" fill="#c07a4a" />
      <circle cx="32" cy="16" r="12" fill="#c07a4a" />
      <ellipse cx="26" cy="15" rx="4.5" ry="3" fill="#4a2f1f" />
      <ellipse cx="38" cy="15" rx="4.5" ry="3" fill="#4a2f1f" />
      <path d="M22 40 h20 M22 47 h20" stroke="#8a5330" strokeWidth="2" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 円筒埴輪+人物埴輪を単純化: 円筒の胴+丸い顔。 */
export function HaniwaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="20" y="26" width="24" height="32" rx="6" fill="#d99a5b" />
      <circle cx="32" cy="16" r="11" fill="#d99a5b" />
      <circle cx="28" cy="15" r="1.8" fill="#5b3a20" />
      <circle cx="36" cy="15" r="1.8" fill="#5b3a20" />
      <path d="M27 20 q5 3 10 0" stroke="#5b3a20" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="24" y="34" width="16" height="3" rx="1.5" fill="#b97b45" />
    </MotifBase>
  )
}

/** 竪穴住居: 三角の茅葺き屋根+入口の暗がり。 */
export function TateanaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 50 L32 14 L56 50 Z" fill="#a97848" />
      <path d="M8 50 L32 14 L56 50 L52 54 L32 20 L12 54 Z" fill="#8a5f38" />
      <path d="M27 50 v-14 q5 -4 10 0 v14 Z" fill="#3d2a1a" />
    </MotifBase>
  )
}

/** 銅鐸: 台形の鐘型+吊り手。 */
export function DotakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="26" y="8" width="12" height="8" rx="4" fill="#6f8f6a" />
      <path d="M20 20 h24 l4 34 q-16 6 -32 0 Z" fill="#7fae7a" />
      <path d="M20 20 h24 l1.5 8 h-27 Z" fill="#6f8f6a" />
    </MotifBase>
  )
}

/** 貝塚: 小さな盛り土+貝殻（扇形）を数個。 */
export function KaizukaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M6 54 Q32 32 58 54 Z" fill="#a88b5f" />
      <path d="M22 46 a5 5 0 0 1 8 0 Z" fill="#efe6d3" />
      <path d="M34 50 a4 4 0 0 1 7 0 Z" fill="#f4ece0" />
      <path d="M14 50 a4 4 0 0 1 7 0 Z" fill="#f4ece0" />
    </MotifBase>
  )
}

/** 富士山: 左右対称の三角+雪冠。 */
export function FujiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 54 L32 12 L56 54 Z" fill="#4a6fa5" />
      <path d="M32 12 L40 28 Q32 24 24 28 Z" fill="#f4f7fb" />
    </MotifBase>
  )
}

/** 北斎の波を単純化: 丸みの強い青いカーブ+白い泡の丸。 */
export function NamiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M6 46 Q16 22 30 34 Q40 42 30 50 Q46 50 52 34 Q58 46 58 54 L6 54 Z" fill="#3d6ea5" />
      <circle cx="16" cy="30" r="3" fill="#f4f7fb" />
      <circle cx="24" cy="26" r="2.4" fill="#f4f7fb" />
      <circle cx="44" cy="30" r="2.6" fill="#f4f7fb" />
    </MotifBase>
  )
}

/** 旅人: 菅笠+杖を持つ丸みの人影。 */
export function TabibitoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M16 24 Q32 8 48 24 Q32 20 16 24 Z" fill="#c9a86a" />
      <circle cx="32" cy="28" r="4" fill="#e8c99a" />
      <path d="M24 58 Q22 40 32 34 Q42 40 40 58 Z" fill="#5b7083" />
      <path d="M42 30 L48 56" stroke="#8a5f38" strokeWidth="2.4" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 錦絵: 額縁の中に多色の帯（多色刷り木版画）+ 隅の落款。 */
export function NishikieIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="10" width="48" height="44" rx="3" fill="#f4ece0" stroke="#8a5f38" strokeWidth="2" />
      <rect x="13" y="16" width="38" height="7" fill="#3d6ea5" />
      <rect x="13" y="26" width="38" height="7" fill="#4a6fa5" />
      <rect x="13" y="36" width="38" height="7" fill="#c0392b" />
      <rect x="40" y="44" width="10" height="6" rx="1" fill="#c0392b" />
    </MotifBase>
  )
}

// --- 以下 M2d-02: 残り13ワールド、各5種 ---

/** 瓦屋根（飛鳥）: 波形の軒瓦+丸瓦の列。 */
export function KawarayaneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 42 Q32 18 56 42 L56 50 Q32 30 8 50 Z" fill="#8a5f38" />
      {[14, 24, 34, 44].map((x) => (
        <circle key={x} cx={x} cy={40 - Math.abs(x - 32) * 0.25} r="5" fill="#a97848" />
      ))}
      <rect x="8" y="48" width="48" height="8" fill="#6f4a2a" />
    </MotifBase>
  )
}

/** 五重塔（飛鳥）: 4段の屋根を重ねた塔。 */
export function GojunotoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      {[12, 22, 32, 42].map((y, i) => {
        const w = 34 - i * 4
        const x = 32 - w / 2
        return (
          <g key={y}>
            <path d={`M${x - 4} ${y + 8} L32 ${y} L${x + w + 4} ${y + 8} Z`} fill="#a03b2e" />
            <rect x={x} y={y + 8} width={w} height="6" fill="#c9a15c" />
          </g>
        )
      })}
      <rect x="26" y="50" width="12" height="8" fill="#6f4a2a" />
    </MotifBase>
  )
}

/** 仏像シルエット（飛鳥）: 丸い頭光+座像の輪郭。 */
export function ButsuzoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <circle cx="32" cy="20" r="10" fill="#c9a15c" />
      <path d="M14 52 Q14 30 32 30 Q50 30 50 52 Z" fill="#c9a15c" />
      <rect x="10" y="52" width="44" height="4" fill="#a97848" />
    </MotifBase>
  )
}

/** 蓮弁文（飛鳥）: 瓦や台座に使われる蓮の花弁模様。 */
export function RengeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <circle cx="32" cy="32" r="8" fill="#c9a15c" />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x = 32 + Math.cos(rad) * 16
        const y = 32 + Math.sin(rad) * 16
        return <ellipse key={deg} cx={x} cy={y} rx="7" ry="4" fill="#e8d9b5" transform={`rotate(${deg} ${x} ${y})`} />
      })}
    </MotifBase>
  )
}

/** 遣隋使船（飛鳥）: 帆掛け船。 */
export function KenzuishisenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M10 44 Q32 56 54 44 L48 52 Q32 58 16 52 Z" fill="#8a5f38" />
      <rect x="30" y="14" width="3" height="30" fill="#5b3a20" />
      <path d="M33 16 L50 30 L33 34 Z" fill="#e8d9b5" />
    </MotifBase>
  )
}

/** 薬師寺東塔（白鳳）: 3段の屋根+先端の水煙。 */
export function YakushijitoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      {[16, 28, 40].map((y, i) => {
        const w = 40 - i * 6
        const x = 32 - w / 2
        return (
          <g key={y}>
            <path d={`M${x - 3} ${y + 6} L32 ${y} L${x + w + 3} ${y + 6} Z`} fill="#4a6f7a" />
            <rect x={x} y={y + 6} width={w} height="6" fill="#c9d6c0" />
          </g>
        )
      })}
      <path d="M30 4 L34 4 L33 16 L31 16 Z" fill="#b5482e" />
      <rect x="24" y="46" width="16" height="10" fill="#6f4a2a" />
    </MotifBase>
  )
}

/** 仏頭（白鳳。興福寺仏頭）: 丸い頭部+穏やかな面立ち。 */
export function ButsutoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <circle cx="32" cy="34" r="18" fill="#c9a15c" />
      <ellipse cx="32" cy="17" rx="6" ry="7" fill="#c9a15c" />
      <ellipse cx="25" cy="32" rx="2" ry="1.2" fill="#5b3a20" />
      <ellipse cx="39" cy="32" rx="2" ry="1.2" fill="#5b3a20" />
      <path d="M26 42 q6 4 12 0" stroke="#5b3a20" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 高松塚古墳壁画（白鳳。飛鳥美人）: 彩色の衣を着た人物像。 */
export function TakamatsuzukaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M22 58 Q20 34 32 30 Q44 34 42 58 Z" fill="#c0392b" />
      <path d="M24 58 Q23 40 32 36 Q41 40 40 58 Z" fill="#4a6fa5" />
      <circle cx="32" cy="20" r="7" fill="#e8c99a" />
    </MotifBase>
  )
}

/** 水煙（白鳳。薬師寺東塔の相輪飾り）: 炎のような透かし彫り。 */
export function SuienIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path
        d="M32 6 Q40 18 34 26 Q44 30 36 40 Q46 44 32 58 Q18 44 28 40 Q20 30 30 26 Q24 18 32 6 Z"
        fill="#8a9a6a"
      />
    </MotifBase>
  )
}

/** 万葉の歌（白鳳。柿本人麻呂・額田王の和歌）: 短冊に書かれた歌。 */
export function ManyotanzakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="22" y="8" width="20" height="48" rx="2" fill="#f4ece0" stroke="#8a5f38" strokeWidth="2" />
      <path d="M28 16 v36 M34 16 v36" stroke="#5b3a20" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 大仏（天平。東大寺盧舎那仏）: 大きな座像+肉髻。 */
export function DaibutsuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="32" cy="16" rx="8" ry="9" fill="#c9a15c" />
      <circle cx="32" cy="9" r="3" fill="#c9a15c" />
      <path d="M12 56 Q12 26 32 26 Q52 26 52 56 Z" fill="#c9a15c" />
      <path d="M20 40 h24" stroke="#8a6b3a" strokeWidth="2" />
    </MotifBase>
  )
}

/** 正倉院（天平。校倉造）: 高床の丸太組み倉庫。 */
export function ShosoinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M6 30 L32 12 L58 30 Z" fill="#8a5f38" />
      <rect x="10" y="30" width="44" height="20" fill="#c9a15c" />
      {[34, 38, 42, 46].map((y) => (
        <line key={y} x1="10" y1={y} x2="54" y2={y} stroke="#8a5f38" strokeWidth="1.4" />
      ))}
      <rect x="16" y="52" width="6" height="6" fill="#5b3a20" />
      <rect x="42" y="52" width="6" height="6" fill="#5b3a20" />
    </MotifBase>
  )
}

/** 鴟尾（天平。寺院の大棟飾り）: 屋根の両端の反り返った飾り。 */
export function ShibiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="40" width="48" height="6" fill="#5b7083" />
      <path d="M14 40 Q8 24 18 16 Q16 28 22 38 Z" fill="#c9a15c" />
      <path d="M50 40 Q56 24 46 16 Q48 28 42 38 Z" fill="#c9a15c" />
    </MotifBase>
  )
}

/** 国分寺の塔（天平。国分寺建立の詔）: 2段の屋根の塔。 */
export function KokubunjitoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      {[18, 34].map((y, i) => {
        const w = 36 - i * 8
        const x = 32 - w / 2
        return (
          <g key={y}>
            <path d={`M${x - 3} ${y + 8} L32 ${y} L${x + w + 3} ${y + 8} Z`} fill="#b5482e" />
            <rect x={x} y={y + 8} width={w} height="8" fill="#e8d9b5" />
          </g>
        )
      })}
      <rect x="26" y="50" width="12" height="8" fill="#6f4a2a" />
    </MotifBase>
  )
}

/** 万葉の木簡（天平。万葉集）: 文字を記した木の札。 */
export function MokkanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="24" width="36" height="10" rx="1" fill="#c9a15c" />
      <path d="M18 29 h28" stroke="#5b3a20" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 曼荼羅（弘仁・貞観。密教）: 同心円+四方の点。 */
export function MandalaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#8a5f9a" strokeWidth="2" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="#c0392b" strokeWidth="2" />
      <circle cx="32" cy="32" r="5" fill="#c9a15c" />
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x = 32 + Math.cos(rad) * 22
        const y = 32 + Math.sin(rad) * 22
        return <circle key={deg} cx={x} cy={y} r="3" fill="#8a5f9a" />
      })}
    </MotifBase>
  )
}

/** 五鈷杵（弘仁・貞観。密教法具）: 両端に鈎爪のある杵。 */
export function GokoshoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="28" y="24" width="8" height="16" fill="#c9a15c" />
      <path d="M20 16 L32 24 L44 16 M20 48 L32 40 L44 48" stroke="#8a6b3a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 不動明王（弘仁・貞観。密教彫刻）: 火焔を背負う忿怒相のシルエット。 */
export function FudomyooIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M32 6 Q46 20 38 34 Q50 36 32 58 Q14 36 26 34 Q18 20 32 6 Z" fill="#b5482e" opacity="0.5" />
      <circle cx="32" cy="26" r="9" fill="#3d3550" />
      <path d="M18 56 Q18 38 32 36 Q46 38 46 56 Z" fill="#3d3550" />
    </MotifBase>
  )
}

/** 一木造の仏像（弘仁・貞観）: 太い一材から彫り出した量感のある立像。 */
export function IchibokuzukuributsuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M24 58 L22 22 Q22 10 32 10 Q42 10 42 22 L40 58 Z" fill="#8a6b3a" />
      <path d="M24 30 h16 M24 40 h16" stroke="#5b3a20" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 三筆の巻物（弘仁・貞観。空海・嵯峨天皇・橘逸勢）: 軸装の書。 */
export function SanpitsukanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="10" y="22" width="44" height="20" fill="#f4ece0" />
      <circle cx="10" cy="32" r="5" fill="#5b3a20" />
      <circle cx="54" cy="32" r="5" fill="#5b3a20" />
      <path d="M18 28 v8 M26 28 v8 M34 28 v8 M42 28 v8" stroke="#3d2a1a" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 平等院鳳凰堂（国風）: 左右の翼廊+中堂+鳳凰の飾り。 */
export function HoodoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="34" width="16" height="16" fill="#c9a15c" />
      <rect x="40" y="34" width="16" height="16" fill="#c9a15c" />
      <rect x="20" y="26" width="24" height="24" fill="#e8d9b5" />
      <path d="M18 26 L32 14 L46 26 Z" fill="#b5482e" />
      <circle cx="32" cy="12" r="2" fill="#c9a15c" />
    </MotifBase>
  )
}

/** 寝殿造（国風）: 母屋+渡殿。 */
export function ShindenzukuriIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="30" width="36" height="16" fill="#e8d9b5" />
      <path d="M10 30 L32 18 L54 30 Z" fill="#8a6b3a" />
      <rect x="6" y="42" width="14" height="6" fill="#c9d6c0" />
      <rect x="44" y="42" width="14" height="6" fill="#c9d6c0" />
    </MotifBase>
  )
}

/** かな文字（国風）: 流れるような仮名の筆致。 */
export function KanamojiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path
        d="M14 16 Q30 14 24 28 Q40 26 30 40 Q46 42 22 54"
        stroke="#3d2a1a"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </MotifBase>
  )
}

/** 十二単（国風）: 重ね着の衣のシルエット。 */
export function JunihitoeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M20 14 Q32 8 44 14 L50 58 L14 58 Z" fill="#c0392b" />
      <path d="M22 26 Q32 22 42 26 L46 58 L18 58 Z" fill="#e8b4a0" />
      <circle cx="32" cy="14" r="6" fill="#e8c99a" />
    </MotifBase>
  )
}

/** 扇（国風。檜扇・蒔絵扇）: 開いた扇。 */
export function OgiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M32 50 L10 22 A30 30 0 0 1 54 22 Z" fill="#f4ece0" stroke="#8a5f38" strokeWidth="2" />
      <path d="M32 50 L18 26 M32 50 L32 18 M32 50 L46 26" stroke="#8a5f38" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 絵巻物（院政）: 軸+場面の色帯。 */
export function EmakimonoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="24" width="48" height="16" fill="#f4ece0" />
      <circle cx="8" cy="32" r="6" fill="#5b3a20" />
      <circle cx="56" cy="32" r="6" fill="#5b3a20" />
      <rect x="20" y="28" width="8" height="8" fill="#c0392b" />
      <rect x="34" y="28" width="8" height="8" fill="#3d6ea5" />
    </MotifBase>
  )
}

/** 中尊寺金色堂（院政。奥州藤原氏）: 金色の小堂。 */
export function KonjikidoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="18" y="30" width="28" height="20" fill="#c9a15c" />
      <path d="M14 30 L32 16 L50 30 Z" fill="#b5482e" />
      <rect x="26" y="38" width="12" height="12" fill="#5b3a20" />
    </MotifBase>
  )
}

/** 鳥獣戯画（院政）: うさぎとかえるのシルエット。 */
export function ChojugigaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="22" cy="42" rx="10" ry="8" fill="#e8d9b5" />
      <path
        d="M16 34 Q14 22 18 20 Q20 28 20 34 M26 34 Q28 22 24 20 Q22 28 22 34"
        fill="#e8d9b5"
      />
      <circle cx="44" cy="46" r="9" fill="#7fae7a" />
      <circle cx="40" cy="40" r="2.4" fill="#3d5a3a" />
      <circle cx="48" cy="40" r="2.4" fill="#3d5a3a" />
    </MotifBase>
  )
}

/** 六勝寺の塔（院政。白河・鳥羽上皇の御願寺）: 細身の塔。 */
export function RokushojitoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="26" y="16" width="12" height="36" fill="#c9a15c" />
      {[16, 26, 36].map((y) => (
        <path key={y} d={`M20 ${y} L32 ${y - 6} L44 ${y} Z`} fill="#b5482e" />
      ))}
    </MotifBase>
  )
}

/** 田楽面（院政。田楽・猿楽の流行）: 素朴な仮面。 */
export function DengakumenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="32" cy="32" rx="18" ry="22" fill="#e8c99a" />
      <circle cx="25" cy="28" r="3" fill="#3d2a1a" />
      <circle cx="39" cy="28" r="3" fill="#3d2a1a" />
      <path d="M24 42 Q32 48 40 42" stroke="#8a3a2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 金剛力士像（鎌倉。運慶・快慶）: 筋骨隆々の仁王像。 */
export function KongorikishiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M22 58 L20 30 Q20 14 32 14 Q44 14 44 30 L42 58 Z" fill="#a97848" />
      <circle cx="32" cy="10" r="6" fill="#a97848" />
      <path d="M44 30 L54 18 L52 26 L44 34 Z" fill="#8a5f38" />
    </MotifBase>
  )
}

/** 南大門（鎌倉。東大寺、大仏様）: 太い柱2本+屋根。 */
export function NandaimonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="20" width="8" height="36" fill="#6f4a2a" />
      <rect x="42" y="20" width="8" height="36" fill="#6f4a2a" />
      <path d="M8 20 L32 8 L56 20 Z" fill="#8a5f38" />
      <rect x="8" y="18" width="48" height="6" fill="#8a5f38" />
    </MotifBase>
  )
}

/** 鎧兜（鎌倉。武士の文化）: 兜の吹き返し+胴の草摺。 */
export function YoroikabutoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M18 30 Q32 14 46 30 L44 20 Q32 6 20 20 Z" fill="#5b7083" />
      <rect x="20" y="30" width="24" height="6" fill="#3d4250" />
      <rect x="20" y="40" width="24" height="14" fill="#6f8f6a" />
    </MotifBase>
  )
}

/** 五輪塔（鎌倉。供養塔）: 方形・円・三角・半円・宝珠の5段。 */
export function GorintoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="22" y="46" width="20" height="10" fill="#9a9aa2" />
      <circle cx="32" cy="38" r="8" fill="#9a9aa2" />
      <path d="M20 30 L32 20 L44 30 Z" fill="#9a9aa2" />
      <ellipse cx="32" cy="16" rx="6" ry="4" fill="#9a9aa2" />
      <circle cx="32" cy="8" r="3" fill="#9a9aa2" />
    </MotifBase>
  )
}

/** 数珠（鎌倉。鎌倉新仏教の念仏・題目）: 珠を連ねた輪。 */
export function JuzuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      {Array.from({ length: 10 }, (_, i) => {
        const deg = (360 / 10) * i
        const rad = (deg * Math.PI) / 180
        const x = 32 + Math.cos(rad) * 18
        const y = 32 + Math.sin(rad) * 18
        return <circle key={i} cx={x} cy={y} r="4" fill="#6f4a2a" />
      })}
    </MotifBase>
  )
}

/** 金閣（北山。足利義満）: 金色の楼閣。 */
export function KinkakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="34" width="36" height="16" fill="#e8c94a" />
      <rect x="20" y="20" width="24" height="14" fill="#f0da6a" />
      <path d="M10 34 L32 22 L54 34 Z" fill="#8a6b3a" />
      <path d="M16 20 L32 10 L48 20 Z" fill="#8a6b3a" />
      <circle cx="32" cy="8" r="2" fill="#c9a15c" />
    </MotifBase>
  )
}

/** 水墨画（北山。明兆・如拙・周文）: 淡墨の山水。 */
export function SuibokugaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 46 L22 24 L32 38 L42 20 L58 46 Z" fill="#5b5b5b" opacity="0.7" />
      <path d="M6 50 h52" stroke="#3d3d3d" strokeWidth="2" opacity="0.5" />
    </MotifBase>
  )
}

/** 能面（北山。観阿弥・世阿弥）: 白く静かな面。 */
export function NomenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="32" cy="32" rx="16" ry="22" fill="#f4ece0" />
      <path d="M24 26 q2 -4 4 0 M36 26 q2 -4 4 0" stroke="#3d2a1a" strokeWidth="1.6" fill="none" />
      <path d="M28 42 q4 3 8 0" stroke="#8a3a2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 勘合符（北山。日明貿易）: 割印で切った証書。 */
export function KangofuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M10 20 h20 l4 6 -4 6 h-20 Z" fill="#f4ece0" stroke="#8a5f38" strokeWidth="1.6" />
      <path d="M34 32 h20 v14 h-20 l4 -7 Z" fill="#f4ece0" stroke="#8a5f38" strokeWidth="1.6" />
      <circle cx="20" cy="26" r="4" fill="#c0392b" />
    </MotifBase>
  )
}

/** 五山の塔（北山。五山・十刹の制）: 2基の小塔。 */
export function GozantoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="30" width="10" height="26" fill="#8a6b3a" />
      <rect x="40" y="24" width="10" height="32" fill="#8a6b3a" />
      <path d="M10 30 L19 20 L28 30 Z" fill="#6f4a2a" />
      <path d="M36 24 L45 14 L54 24 Z" fill="#6f4a2a" />
    </MotifBase>
  )
}

/** 銀閣（東山。足利義政）: 落ち着いた色の楼閣。 */
export function GinkakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="16" y="32" width="32" height="18" fill="#c9d6c0" />
      <rect x="22" y="18" width="20" height="14" fill="#dfe3ea" />
      <path d="M12 32 L32 20 L52 32 Z" fill="#6f8f6a" />
      <path d="M18 18 L32 8 L46 18 Z" fill="#6f8f6a" />
    </MotifBase>
  )
}

/** 枯山水（東山。龍安寺・大徳寺大仙院）: 白砂の同心円+石。 */
export function KaresansuiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="6" y="6" width="52" height="52" fill="#e8d9b5" />
      {[10, 16, 22].map((r) => (
        <circle key={r} cx="26" cy="34" r={r} fill="none" stroke="#c9a15c" strokeWidth="1.4" />
      ))}
      <ellipse cx="44" cy="24" rx="6" ry="4" fill="#8a8a8a" />
    </MotifBase>
  )
}

/** 茶碗（東山。侘び茶・村田珠光）: 素朴な碗。 */
export function ChawanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M14 32 Q14 50 32 50 Q50 50 50 32 Z" fill="#a97848" />
      <ellipse cx="32" cy="32" rx="18" ry="5" fill="#c9a15c" />
    </MotifBase>
  )
}

/** 雪舟の水墨画（東山。日本的な水墨画の大成）: 角ばった岩の山水。 */
export function SesshuSuibokugaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 50 L18 30 L26 40 L36 18 L44 34 L58 50 Z" fill="#4a4a4a" opacity="0.75" />
    </MotifBase>
  )
}

/** 書院造の障子（東山。東求堂同仁斎）: 格子の建具。 */
export function ShojiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="10" y="10" width="44" height="44" fill="#f4ece0" stroke="#8a5f38" strokeWidth="2" />
      {[22, 34, 46].map((x) => (
        <line key={x} x1={x} y1="10" x2={x} y2="54" stroke="#8a5f38" strokeWidth="1.4" />
      ))}
      {[22, 34, 46].map((y) => (
        <line key={y} x1="10" y1={y} x2="54" y2={y} stroke="#8a5f38" strokeWidth="1.4" />
      ))}
    </MotifBase>
  )
}

/** 天守（桃山。安土城・大坂城・姫路城）: 重層の城郭。 */
export function TenshuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="20" y="40" width="24" height="14" fill="#dfe3ea" />
      <path d="M16 40 L32 30 L48 40 Z" fill="#3d4250" />
      <rect x="24" y="24" width="16" height="10" fill="#dfe3ea" />
      <path d="M20 24 L32 16 L44 24 Z" fill="#3d4250" />
      <rect x="29" y="8" width="6" height="8" fill="#c9a15c" />
    </MotifBase>
  )
}

/** 金屏風（桃山。狩野永徳・長谷川等伯の濃絵）: 金地+彩色の折れ線。 */
export function KinbyobuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="8" y="12" width="48" height="40" fill="#e8c94a" />
      <line x1="24" y1="12" x2="24" y2="52" stroke="#b5942f" strokeWidth="1.6" />
      <line x1="40" y1="12" x2="40" y2="52" stroke="#b5942f" strokeWidth="1.6" />
      <path d="M14 40 Q24 24 34 40 Q44 26 52 38" stroke="#4a6b3a" strokeWidth="2" fill="none" />
    </MotifBase>
  )
}

/** 茶釜（桃山。千利休の茶の湯）: 丸い釜+つまみ。 */
export function ChagamaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="32" cy="38" rx="18" ry="14" fill="#3d3d3d" />
      <ellipse cx="32" cy="24" rx="8" ry="4" fill="#2a2a2a" />
      <circle cx="32" cy="20" r="2" fill="#8a8a8a" />
    </MotifBase>
  )
}

/** 南蛮船（桃山。南蛮貿易）: 大きな帆を張った船。 */
export function NanbansenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M10 46 Q32 56 54 46 L48 52 Q32 58 16 52 Z" fill="#5b3a20" />
      <rect x="30" y="12" width="3" height="34" fill="#3d2a1a" />
      <path d="M33 14 L50 22 L33 30 Z" fill="#e8d9b5" />
      <path d="M30 20 L16 26 L30 32 Z" fill="#e8d9b5" />
    </MotifBase>
  )
}

/** 唐獅子（桃山。狩野永徳「唐獅子図屏風」）: たてがみを持つ獅子。 */
export function KarashishiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      {Array.from({ length: 8 }, (_, i) => {
        const deg = (360 / 8) * i
        const rad = (deg * Math.PI) / 180
        const x = 32 + Math.cos(rad) * 18
        const y = 32 + Math.sin(rad) * 18
        return <circle key={i} cx={x} cy={y} r="5" fill="#a97848" />
      })}
      <circle cx="32" cy="32" r="12" fill="#e8c99a" />
    </MotifBase>
  )
}

/** 東照宮（寛永。日光、権現造）: 朱塗りの柱+金の破風。 */
export function ToshoguIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="12" y="24" width="8" height="30" fill="#c0392b" />
      <rect x="44" y="24" width="8" height="30" fill="#c0392b" />
      <path d="M6 24 L32 10 L58 24 Z" fill="#e8c94a" />
      <rect x="24" y="34" width="16" height="20" fill="#3d2a1a" />
    </MotifBase>
  )
}

/** 桂離宮（寛永。数寄屋造）: 素木の建物+庭の丸い植込み。 */
export function KatsurarikyuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="34" width="36" height="14" fill="#c9a15c" />
      <path d="M10 34 L32 22 L54 34 Z" fill="#8a6b3a" />
      <circle cx="46" cy="50" r="4" fill="#7fae7a" />
    </MotifBase>
  )
}

/** 風神雷神（寛永。俵屋宗達）: 雲に乗る風神・雷神の対。 */
export function FujinraijinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <circle cx="20" cy="30" r="10" fill="#e8d9b5" />
      <path d="M12 22 Q20 14 28 22" stroke="#3d6ea5" strokeWidth="3" fill="none" />
      <circle cx="46" cy="34" r="10" fill="#e8b4a0" />
      {[38, 46, 54].map((x) => (
        <circle key={x} cx={x} cy="24" r="3" fill="#c0392b" />
      ))}
    </MotifBase>
  )
}

/** 赤絵の壺（寛永。酒井田柿右衛門）: 白地に赤の文様。 */
export function AkaeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M22 20 h20 l4 10 q4 8 -4 26 h-20 q-8 -18 -4 -26 Z" fill="#f4ece0" />
      <circle cx="32" cy="34" r="4" fill="#c0392b" />
      <path d="M24 44 q8 6 16 0" stroke="#c0392b" strokeWidth="2" fill="none" />
    </MotifBase>
  )
}

/** 蒔絵硯箱（寛永。本阿弥光悦）: 黒地に金の文様の箱。 */
export function MakiesuzuribakoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="10" y="24" width="44" height="20" rx="2" fill="#3d2a1a" />
      <path d="M18 30 q8 -6 16 0 q8 -6 16 0" stroke="#e8c94a" strokeWidth="2" fill="none" />
    </MotifBase>
  )
}

/** 浮世絵の版木（元禄。菱川師宣）: 彫り模様のある板。 */
export function UkiyoehangiIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="10" y="18" width="44" height="28" rx="2" fill="#c9a15c" />
      <path d="M18 26 Q32 20 46 26 M18 34 Q32 28 46 34" stroke="#6f4a2a" strokeWidth="1.6" fill="none" />
    </MotifBase>
  )
}

/** 燕子花（元禄。尾形光琳・琳派）: 2輪のかきつばた。 */
export function KakitsubataIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M20 50 Q18 30 26 18 Q28 32 24 50 Z" fill="#3d6ea5" />
      <path d="M40 50 Q42 28 34 16 Q32 32 36 50 Z" fill="#4a6fa5" />
      <path d="M20 50 h20" stroke="#5c6b3d" strokeWidth="3" />
    </MotifBase>
  )
}

/** 歌舞伎の隈取（元禄。市川団十郎の荒事）: 赤い隈取の顔。 */
export function KumadoriIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <ellipse cx="32" cy="32" rx="18" ry="22" fill="#f4ece0" />
      <path d="M18 20 Q24 30 18 44" stroke="#c0392b" strokeWidth="4" fill="none" />
      <path d="M46 20 Q40 30 46 44" stroke="#c0392b" strokeWidth="4" fill="none" />
      <path d="M26 46 Q32 50 38 46" stroke="#3d2a1a" strokeWidth="2" fill="none" />
    </MotifBase>
  )
}

/** 俳句の短冊（元禄。松尾芭蕉）: 淡い緑の短冊。 */
export function HaikutanzakuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="22" y="8" width="20" height="48" rx="2" fill="#e8f0e8" stroke="#5c6b3d" strokeWidth="2" />
      <path d="M28 16 v36 M34 16 v36" stroke="#3d5a3a" strokeWidth="1.4" />
    </MotifBase>
  )
}

/** 色絵の壺（元禄。野々村仁清の京焼）: 帯状の彩色文様の壺。 */
export function IroetsuboIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M22 18 h20 l4 12 q4 10 -4 28 h-20 q-8 -18 -4 -28 Z" fill="#f4ece0" />
      <rect x="20" y="30" width="24" height="5" fill="#3d6ea5" />
      <rect x="20" y="38" width="24" height="5" fill="#c0392b" />
    </MotifBase>
  )
}

/** 大首絵（宝暦・天明。喜多川歌麿・東洲斎写楽）: 役者の顔の大写し。 */
export function OkubieIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M18 54 Q16 20 32 16 Q48 20 46 54 Z" fill="#e8c99a" />
      <path d="M18 24 Q32 8 46 24 Z" fill="#3d2a1a" />
      <circle cx="25" cy="34" r="2" fill="#3d2a1a" />
      <circle cx="39" cy="34" r="2" fill="#3d2a1a" />
    </MotifBase>
  )
}

/** エレキテル（宝暦・天明。平賀源内）: 箱型の発電装置+火花。 */
export function ErekiteruIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="14" y="30" width="30" height="20" fill="#6f4a2a" />
      <circle cx="48" cy="34" r="6" fill="#8a6b3a" />
      <path d="M44 20 L48 28 L52 20" stroke="#c0392b" strokeWidth="2" fill="none" strokeLinecap="round" />
    </MotifBase>
  )
}

/** 解体新書（宝暦・天明。杉田玄白ら）: 開いた蘭学の書。 */
export function KaitaishinshoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M8 18 h24 v34 h-24 Z M56 18 h-24 v34 h24 Z" fill="#f4ece0" stroke="#8a5f38" strokeWidth="1.6" />
      <path d="M20 26 v20 M44 26 v20" stroke="#c0392b" strokeWidth="1.6" />
    </MotifBase>
  )
}

/** 文人画（宝暦・天明。池大雅・与謝蕪村）: 淡彩の樹木と山。 */
export function BunjingaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <path d="M10 50 L20 24 L28 38 L38 16 L48 50 Z" fill="#5c6b3d" opacity="0.7" />
      <circle cx="44" cy="20" r="4" fill="#5c6b3d" opacity="0.7" />
    </MotifBase>
  )
}

/** 寺子屋の机（宝暦・天明。教育の普及）: 低い机+書物。 */
export function TerakoyatsukueIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <MotifBase {...props}>
      <rect x="10" y="38" width="44" height="6" fill="#8a5f38" />
      <rect x="14" y="44" width="4" height="10" fill="#6f4a2a" />
      <rect x="46" y="44" width="4" height="10" fill="#6f4a2a" />
      <rect x="20" y="28" width="18" height="10" fill="#f4ece0" />
    </MotifBase>
  )
}

