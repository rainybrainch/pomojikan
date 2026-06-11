/* DesktopScreen.jsx ── デスクトップ向け広い窓のメイン画面
   モバイルと同じコンポーネント体系で、PCでは余白で呼吸させる。
*/

function DesktopScreen({ theme, motionLevel = 1 }) {
  const wod = (typeof getWordOfDay !== 'undefined')
    ? getWordOfDay(theme.id)
    : { word: '諸行無常', yomi: 'しょぎょうむじょう', tags: ['仏教'] };
  return (
    <div className="dscreen"
      style={{
        background: `linear-gradient(180deg, ${theme.bgDeep} 0%, ${theme.bgMid} 60%, ${theme.bgLight} 100%)`,
        color: theme.ink,
        fontFamily: theme.bodyFont,
      }}>
      <ThemeMotif theme={theme} mode="work" />
      <FallingGlyphs theme={theme} density={1.2} paused={false} mode="work" leaderLv={1} />

      {/* デスクトップは3カラム：左=パーティ／中央=ヒーロー／右=サイドパネル */}
      <div className="ds-header">
        <div className="ds-brand" style={{ fontFamily: theme.displayFont }}>
          <span style={{ color: theme.accent }}>ぽ</span>もじかん
        </div>
        <nav className="ds-nav">
          <button style={{ color: theme.ink, fontFamily: theme.displayFont }} className="active">時間</button>
          <button style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>図鑑</button>
          <button style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>文章</button>
          <button style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>記録</button>
        </nav>
        <div className="ds-side-info">
          <span style={{ color: theme.inkMute }}>今日の言葉</span>
          <strong style={{ fontFamily: theme.displayFont, color: theme.ink }}>{wod.word}</strong>
          <span style={{ color: theme.inkDim, fontSize: 10, marginLeft: 4 }}>{wod.yomi}</span>
        </div>
      </div>

      <div className="ds-body">
        {/* 左：パーティ縦 */}
        <aside className="ds-party">
          <h3 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>パーティ</h3>
          {[
            { ch: '禅', tier: 8, lv: 47, exp: 72, leader: true },
            { ch: '雨', tier: 6, lv: 23, exp: 40 },
            { ch: 'き', tier: 1, lv: 18, exp: 88 },
            null,
          ].map((p, i) => {
            if (!p) return (
              <div key={i} className="ds-pcard empty" style={{ borderColor: theme.line, color: theme.inkDim }}>
                <span style={{fontSize: 40}}>＋</span>
                <span>空き枠</span>
              </div>
            );
            const rs = rarityStyle(p.tier, theme);
            return (
              <div key={i} className={`ds-pcard ${p.leader ? 'leader' : ''}`} style={{ background: theme.surface, borderColor: p.leader ? theme.accent : theme.line }}>
                {p.leader && <div className="ds-leader-badge" style={{ color: theme.accent }}>★ リーダー</div>}
                <div className="ds-pcard-glyph" style={{ fontFamily: theme.displayFont, color: theme.glyphHue, textShadow: rs.glow, fontWeight: rs.weight }}>{p.ch}</div>
                <div className="ds-pcard-meta">
                  <div className="ds-pcard-name" style={{ color: theme.ink }}>{p.ch}・Lv {p.lv}</div>
                  <div className="ds-pcard-tier" style={{ color: theme.inkMute }}>★{p.tier} {RARITY_META[p.tier-1].name}</div>
                  <div className="ds-pcard-bar" style={{ background: theme.bgDeep }}><div style={{ width: `${p.exp}%`, background: theme.accent }}/></div>
                  <div className="ds-pcard-traits">
                    {(['守護','静音','清流','輝度'].slice(0, p.leader ? 4 : 2)).map((t,j)=>(
                      <span key={j} className="ds-trait" style={{ color: theme.inkMute, borderColor: theme.line }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </aside>

        {/* 中央：ヒーロー */}
        <main className="ds-hero">
          <div className="ds-mode" style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>
            <span className="ds-mode-dot" style={{ background: theme.accent }}/> 集中
          </div>
          <div className="ds-time" style={{ fontFamily: theme.displayFont, color: theme.ink }}>14<span className="ds-time-sep">:</span>32</div>
          <div className="ds-progress">
            <div className="ds-progress-bar" style={{ background: theme.line }}>
              <div style={{ width: '42%', background: theme.accent }}/>
            </div>
            <span style={{ color: theme.inkMute }}>42% ・ 1サイクル / 全3</span>
          </div>
          <div className="ds-actions">
            <button className="ds-cta primary" style={{ background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, fontFamily: theme.bodyFont }}>止める</button>
            <button className="ds-cta" style={{ borderColor: theme.line, color: theme.ink, fontFamily: theme.bodyFont }}>次へ</button>
            <button className="ds-cta" style={{ borderColor: theme.line, color: theme.inkMute, fontFamily: theme.bodyFont }}>⚙</button>
          </div>
          <div className="ds-leader-line" style={{ color: theme.inkDim }}>
            リーダー <strong style={{ color: theme.ink, fontFamily: theme.displayFont }}>禅</strong>・★8帯・1,247字を発見
          </div>
        </main>

        {/* 右：サイド情報 */}
        <aside className="ds-side">
          <div className="ds-side-card" style={{ background: theme.surface, borderColor: theme.line }}>
            <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>このサイクル</h4>
            <ul className="ds-stat-list">
              <li><span>拾った字</span><strong style={{color:theme.ink}}>23</strong></li>
              <li><span>合体</span><strong style={{color:theme.ink}}>4</strong></li>
              <li><span>★最高</span><strong style={{color:theme.gold}}>★8</strong></li>
              <li><span>EXP</span><strong style={{color:theme.accent}}>+478</strong></li>
            </ul>
          </div>
          <div className="ds-side-card" style={{ background: theme.surface, borderColor: theme.line }}>
            <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>もう少し</h4>
            <div className="ds-hint">
              <span style={{ color: theme.inkMute }}>あと <strong style={{color:theme.accent}}>2字</strong> でコンボ</span>
              <div className="ds-combo" style={{ background: theme.bgDeep, borderColor: theme.lineStrong }}>
                <span className="ds-c-need" style={{ color: theme.gold, fontFamily: theme.displayFont }}>諸</span>
                <span className="ds-c-have" style={{ color: theme.ink, fontFamily: theme.displayFont }}>行</span>
                <span className="ds-c-need" style={{ color: theme.gold, fontFamily: theme.displayFont }}>無</span>
                <span className="ds-c-have" style={{ color: theme.ink, fontFamily: theme.displayFont }}>常</span>
              </div>
              <small style={{ color: theme.inkDim }}>諸行無常（仏教・禅）</small>
            </div>
          </div>
          <div className="ds-side-card" style={{ background: theme.surface, borderColor: theme.line }}>
            <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>キーボード</h4>
            <div className="ds-keys">
              <kbd>Space</kbd><span>開始／停止</span>
              <kbd>B</kbd><span>図鑑</span>
              <kbd>W</kbd><span>文章</span>
              <kbd>Z</kbd><span>スリープ</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { DesktopScreen });
