/* Concept.jsx ── 改良の方針を明文化 */

function ConceptSheet() {
  return (
    <div className="concept-sheet">
      <div className="cs-eyebrow">UI改良メモ ・ 2026-05-23</div>
      <h1 className="cs-title">字の降る、小さな世界</h1>
      <p className="cs-lede">
        ぽもじかんは「生産性アプリ」ではなく、<strong>盆栽やテラリウムのように何百時間ものぞき込む小さな世界</strong>。
        UIは世界の額縁として静かに退き、字（ぽもじ）と時間が主役になる。
      </p>

      <div className="cs-grid">
        <div className="cs-block">
          <div className="cs-num">01</div>
          <h3>世界が、5つある</h3>
          <p>テーマ＝色＋書体＋背景モチーフ＋落下グリフ。<em>夜雨／墨道／苔庭／金閣／春霞</em>。「気分で部屋を替える」感覚。</p>
        </div>
        <div className="cs-block">
          <div className="cs-num">02</div>
          <h3>UIは、退く</h3>
          <p>ヘッダは小さく、進捗ピルは解体してタイマー周りに統合。集中時は<strong>字と時間以外が薄れる</strong>。</p>
        </div>
        <div className="cs-block">
          <div className="cs-num">03</div>
          <h3>育てば、派手になる</h3>
          <p>Lv・進捗に応じて演出量が対数的に増す（控えめ→豪奢）。Tweaksで手動上書きも可。</p>
        </div>
        <div className="cs-block">
          <div className="cs-num">04</div>
          <h3>階層を、平らに</h3>
          <p>図鑑のタブ階層を1本のサイドレールに統合。ヘルプ11節を4枚のカードに圧縮。</p>
        </div>
        <div className="cs-block">
          <div className="cs-num">05</div>
          <h3>1ファイル・レスポンシブ</h3>
          <p>スマホとPCで別物にしない。同じ世界が広い窓にも狭い窓にも収まる。デスクトップは余白で呼吸する。</p>
        </div>
        <div className="cs-block">
          <div className="cs-num">06</div>
          <h3>残すもの</h3>
          <p>★1-★16の階層、書体進化、雨／泡背景、4枠パーティ、今日の言葉、隠しコンボの世界観。</p>
        </div>
      </div>

      <div className="cs-meta">
        <div><span className="csm-k">字体</span><span className="csm-v">Noto Serif JP ・ Shippori Mincho B1 ・ Zen Kaku Gothic New ・ Klee One</span></div>
        <div><span className="csm-k">体系</span><span className="csm-v">★1〜★16 ／ Lv∞ ／ 書体10段階</span></div>
        <div><span className="csm-k">対象</span><span className="csm-v">スマホ縦（PWA）優先 ／ PCはレスポンシブ</span></div>
      </div>
    </div>
  );
}

Object.assign(window, { ConceptSheet });
