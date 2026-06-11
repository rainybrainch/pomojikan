/* Modals.jsx ── 刷新したモーダル群
   - 図鑑：タブ階層を1本のサイドレール＋検索に集約
   - ヘルプ：11セクションを4枚のカードに圧縮
   - パーティ選択：候補のキャラクター性を可視化
   - 文章モード：「机の上のノート」メタファー
*/

const { useState: useS } = React;

/* ──────── 図鑑 ──────── */
function CodexScreen({ theme, inventory = {}, leaderLv = 1 }) {
  const [tierFilter, setTierFilter] = useS(0); // 0=全て
  const [q, setQ] = useS('');
  const [mikuji, setMikuji] = useS(null);
  const [selected, setSelected] = useS(null); // { ch, maxTier, count, firstCaught }

  // インベントリを配列化してソート（maxTier降順 → count降順）
  const allCaught = Object.entries(inventory)
    .map(([ch, data]) => ({ ch, ...data }))
    .sort((a, b) => b.maxTier - a.maxTier || b.count - a.count);

  const totalDiscovered = allCaught.length;

  // 検索 + tierフィルタ
  const filtered = allCaught.filter(item => {
    if (tierFilter > 0 && item.maxTier !== tierFilter) return false;
    if (q) return item.ch.includes(q);
    return true;
  });

  // tier別カウント（レールのバッジ用）
  const tierCounts = {};
  allCaught.forEach(item => {
    tierCounts[item.maxTier] = (tierCounts[item.maxTier] || 0) + 1;
  });

  const handleMikuji = () => {
    if (allCaught.length === 0) return;
    const pick = allCaught[Math.floor(Math.random() * allCaught.length)];
    setMikuji(pick);
    setTimeout(() => setMikuji(null), 3000);
  };

  return (
    <div className="screen codex-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont }}>
      <div className="cx-head">
        <h2 style={{ fontFamily: theme.displayFont }}>図鑑</h2>
        <div className="cx-sum" style={{ color: theme.inkMute }}>
          発見 <strong style={{ color: theme.ink }}>{totalDiscovered.toLocaleString()}</strong> 字
          {totalDiscovered === 0 && <span style={{ marginLeft: 8, fontSize: 11 }}>── 字を拾うと記録されます</span>}
        </div>
      </div>

      {/* おみくじポップ */}
      {mikuji && (
        <div className="cx-mikuji-pop" style={{
          background: theme.surface, borderColor: theme.gold, color: theme.glyphHue,
          fontFamily: theme.displayFont,
        }}>
          <span className="cxm-ch" style={{ fontSize: 40, textShadow: rarityStyle(mikuji.maxTier, theme).glow }}>{mikuji.ch}</span>
          <span className="cxm-meta" style={{ color: theme.inkMute }}>★{mikuji.maxTier} ・ {mikuji.count}回拾った</span>
        </div>
      )}

      {/* 検索 ＋ おみくじ */}
      <div className="cx-search-row">
        <input className="cx-search" placeholder="🔍 字を検索" value={q} onChange={e => setQ(e.target.value)}
          style={{ background: theme.surface, color: theme.ink, borderColor: theme.line, fontFamily: theme.bodyFont }} />
        <button className="cx-mikuji" onClick={handleMikuji}
          style={{ background: theme.gold, color: theme.bgDeep, fontFamily: theme.displayFont,
            opacity: allCaught.length === 0 ? 0.4 : 1 }}>おみくじ</button>
      </div>

      <div className="cx-body">
        {/* 左：★階層レール */}
        <aside className="cx-rail">
          <button
            className={`cx-tier ${tierFilter === 0 ? 'active' : ''}`}
            onClick={() => setTierFilter(0)}
            style={{
              color: tierFilter === 0 ? theme.ink : theme.inkMute,
              borderColor: tierFilter === 0 ? theme.accent : 'transparent',
              background: tierFilter === 0 ? theme.surface : 'transparent',
            }}>
            <span className="cxt-label">全て</span>
            <span className="cxt-name">{totalDiscovered}字</span>
          </button>
          {RARITY_META.map(r => {
            const cnt = tierCounts[r.tier] || 0;
            if (cnt === 0 && tierFilter !== r.tier) return null;
            return (
              <button
                key={r.tier}
                className={`cx-tier ${tierFilter === r.tier ? 'active' : ''}`}
                onClick={() => setTierFilter(r.tier)}
                style={{
                  color: tierFilter === r.tier ? theme.ink : theme.inkMute,
                  borderColor: tierFilter === r.tier ? theme.accent : 'transparent',
                  background: tierFilter === r.tier ? theme.surface : 'transparent',
                }}>
                <span className="cxt-label">{r.label}</span>
                <span className="cxt-name">{cnt > 0 ? `${cnt}字` : r.name}</span>
              </button>
            );
          })}
        </aside>

        {/* 右：グリッド */}
        <div className="cx-main">
          {totalDiscovered === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: theme.inkMute }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
              <div style={{ fontFamily: theme.displayFont, fontSize: 16, marginBottom: 8 }}>まだ字が集まっていない</div>
              <div style={{ fontSize: 12 }}>集中タイマーを動かして字を拾おう</div>
            </div>
          ) : (
            <>
              <div className="cx-grid">
                {filtered.map((item) => {
                  const rs = rarityStyle(item.maxTier, theme);
                  const isSelected = selected && selected.ch === item.ch;
                  return (
                    <button key={item.ch}
                      className={`cx-cell seen ${isSelected ? 'cx-cell-active' : ''}`}
                      onClick={() => setSelected(isSelected ? null : item)}
                      style={{
                        background: isSelected ? theme.accent + '33' : theme.surface,
                        borderColor: isSelected ? theme.accent : theme.line,
                        color: theme.glyphHue,
                      }}
                      title={`★${item.maxTier} ・ ${item.count}回`}>
                      <span className="cxc-glyph" style={{
                        fontFamily: theme.displayFont,
                        textShadow: rs.glow,
                        fontWeight: rs.weight,
                        fontSize: item.maxTier >= 13 ? 26 : 22,
                      }}>{item.ch}</span>
                      {item.count > 1 && (
                        <span className="cxc-count" style={{ color: theme.inkMute, fontSize: 9 }}>×{item.count}</span>
                      )}
                      {item.maxTier >= 13 && (
                        <span className="cxc-fav" style={{ color: theme.gold }}>✦</span>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ gridColumn: '1/-1', padding: 24, color: theme.inkMute, textAlign: 'center', fontSize: 13 }}>
                    {q ? `「${q}」は見つかっていません` : 'この★帯の字はまだ集まっていません'}
                  </div>
                )}
              </div>
              <div className="cx-footer" style={{ color: theme.inkMute }}>
                {tierFilter > 0 ? `★${tierFilter} ${RARITY_META[tierFilter-1].name}` : '全て'} ・ {filtered.length}字表示
              </div>
            </>
          )}
        </div>
      </div>

      {/* 字詳細パネル（ボトムシート） */}
      {selected && (() => {
        const rs = rarityStyle(selected.maxTier, theme);
        const rarMeta = RARITY_META[selected.maxTier - 1] || RARITY_META[0];
        // getScriptStage / getScriptStyle は MainScreen.jsx から window へ公開済み
        const stage = typeof getScriptStage !== 'undefined'
          ? getScriptStage(leaderLv)
          : { label: '楷書', font: '"Noto Serif JP", serif', weight: 400 };
        const detailFilter = (typeof getScriptStyle !== 'undefined' && leaderLv >= 150)
          ? 'sepia(0.35) contrast(1.1)' : undefined;
        return (
          <div className="cx-detail-panel" style={{ background: theme.bgDeep, borderColor: theme.accent + '66' }}>
            <button className="cx-detail-close" onClick={() => setSelected(null)}
              style={{ color: theme.inkMute, borderColor: theme.line, background: theme.surface }}>×</button>

            <div className="cx-detail-glyph" style={{
              fontFamily: theme.displayFont,
              color: theme.glyphHue,
              textShadow: rs.glow,
              fontWeight: rs.weight,
              ...(detailFilter ? { filter: detailFilter } : {}),
            }}>{selected.ch}</div>

            <div className="cx-detail-info">
              <div className="cxdi-tier" style={{ color: theme.accent, fontFamily: theme.displayFont }}>
                ★{selected.maxTier}&ensp;<span style={{ color: theme.inkMute, fontFamily: theme.bodyFont, fontSize: 12 }}>{rarMeta.name}</span>
              </div>
              {rarMeta.desc && (
                <div style={{ color: theme.inkDim, fontSize: 10, lineHeight: 1.7, marginBottom: 6, fontStyle: 'italic' }}>{rarMeta.desc}</div>
              )}
              <div className="cxdi-row" style={{ color: theme.inkMute }}>
                <span>拾い回数</span>
                <strong style={{ color: theme.ink }}>{selected.count.toLocaleString()}回</strong>
              </div>
              {selected.firstCaught && (
                <div className="cxdi-row" style={{ color: theme.inkMute }}>
                  <span>初収集</span>
                  <strong style={{ color: theme.ink }}>{selected.firstCaught}</strong>
                </div>
              )}
              {selected.lastCaught && selected.lastCaught !== selected.firstCaught && (
                <div className="cxdi-row" style={{ color: theme.inkMute }}>
                  <span>最終収集</span>
                  <strong style={{ color: theme.ink }}>{selected.lastCaught}</strong>
                </div>
              )}
              <div className="cxdi-row" style={{ color: theme.inkMute }}>
                <span>書体段階</span>
                <strong style={{ color: theme.ink }}>{stage.label}</strong>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ──────── ヘルプ：4枚のカードに圧縮 ──────── */
function HelpScreen({ theme }) {
  const [page, setPage] = useS(0);
  const pages = [
    {
      title: '字が、降る。',
      sub: 'ポモドーロ × 文字育成',
      body: (
        <>
          <p>集中の25分、<strong>字（ぽもじ）</strong>が餅のように降ってくる。<br/>休憩で泡となって浮上し、<strong>リーダーの経験値</strong>になる。</p>
          <div className="hp-stats">
            <div className="hp-stat"><span className="hps-num" style={{color:theme.accent}}>41,890</span><span>字</span></div>
            <div className="hp-stat"><span className="hps-num" style={{color:theme.gold}}>16</span><span>★階層</span></div>
            <div className="hp-stat"><span className="hps-num" style={{color:theme.rose}}>∞</span><span>Lv</span></div>
          </div>
        </>
      ),
    },
    {
      title: '触れて、重ねて、貯める。',
      sub: '4つの動作で世界は反応する',
      body: (
        <ul className="hp-actions">
          <li><span className="hpa-key">タップ</span><span className="hpa-arrow">→</span>字を<strong>拾う</strong>（図鑑に記録・リーダーにXP）</li>
          <li><span className="hpa-key">集中25分</span><span className="hpa-arrow">→</span><strong style={{color:theme.accent}}>1サイクル完了</strong>（ストリーク継続）</li>
          <li><span className="hpa-key">高レア字</span><span className="hpa-arrow">→</span><strong style={{color:theme.gold}}>多めのXP</strong>（tier16で最大）</li>
          <li><span className="hpa-key">パーティ4枠</span><span className="hpa-arrow">→</span>Lv3/6/10で<strong>サブ枠が解放</strong></li>
        </ul>
      ),
    },
    {
      title: '★ で、世界が広がる。',
      sub: 'Lvが上がると新しい字種が降ってくる',
      body: (
        <div className="hp-tiers">
          {[1,4,8,12,16].map(t => {
            const rs = rarityStyle(t, theme);
            return (
              <div key={t} className="hp-tier">
                <span className="hpt-label">★{t}</span>
                <span className="hpt-glyph" style={{ fontFamily: theme.displayFont, color: theme.glyphHue, textShadow: rs.glow, fontWeight: rs.weight, fontSize: `${18 + t*1.2}px` }}>
                  {['あ','D','読','尭','𓂀'][[1,4,8,12,16].indexOf(t)]}
                </span>
                <span className="hpt-name">{['ひらがな','英語','小3漢字','格調・徳','究極稀字'][[1,4,8,12,16].indexOf(t)]}</span>
              </div>
            );
          })}
          <p style={{color: theme.inkMute, marginTop: 12}}><small>最初は ★1 ひらがなだけ。Lv220 で ★16 究極稀字まで全解放。</small></p>
        </div>
      ),
    },
    {
      title: '書体で、進化する。',
      sub: 'Lvが上がると字そのものが姿を変える',
      body: (
        <div className="hp-scripts">
          {[
            { lv: 1,   name: '楷書', ch: '禅', italic: false, glow: false },
            { lv: 10,  name: '行書', ch: '禅', italic: true,  glow: false },
            { lv: 30,  name: '草書', ch: '禅', italic: true,  glow: false },
            { lv: 70,  name: '篆書', ch: '禅', italic: false, glow: true  },
            { lv: 150, name: '甲骨', ch: '禅', italic: false, glow: true  },
          ].map((s,i)=>(
            <div key={i} className="hp-script">
              <span className="hps-glyph" style={{
                fontFamily: theme.displayFont,
                color: theme.glyphHue,
                textShadow: s.glow ? `0 0 10px ${theme.glyphGlow}` : 'none',
                fontWeight: i >= 3 ? 700 : i >= 1 ? 300 : 400,
                fontStyle: s.italic ? 'italic' : 'normal',
                opacity: 0.75 + i * 0.05,
              }}>{s.ch}</span>
              <span className="hps-lv">Lv {s.lv}</span>
              <span className="hps-name">{s.name}</span>
            </div>
          ))}
          <p style={{color:theme.inkMute, marginTop: 12}}><small>Lv150 で最終形態・甲骨文字。字のすがたが変わるたびに進化エフェクトが発動。</small></p>
        </div>
      ),
    },
    {
      title: '書く、探す、育てる。',
      sub: 'クエスト・文章・初拾い通知',
      body: (
        <ul className="hp-actions">
          <li><span className="hpa-key">デイリークエスト</span><span className="hpa-arrow">→</span>毎日3つのミッション。完了で<strong style={{color:theme.accent}}>ボーナスXP</strong></li>
          <li><span className="hpa-key">文章モード</span><span className="hpa-arrow">→</span>俳句・日記を綴ってクエスト達成。<strong>150字</strong>まで</li>
          <li><span className="hpa-key">初拾い★5+</span><span className="hpa-arrow">→</span>初めて捕まえた高レア字に<strong style={{color:theme.gold}}>祝福通知</strong></li>
          <li><span className="hpa-key">マイルストーン</span><span className="hpa-arrow">→</span>10・25・50…サイクル達成で<strong>特別音楽</strong></li>
        </ul>
      ),
    },
  ];
  return (
    <div className="screen help-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont }}>
      <div className="hp-card" style={{ background: theme.surface, borderColor: theme.line }}>
        <div className="hp-num" style={{ color: theme.inkDim, fontFamily: theme.displayFont }}>{String(page+1).padStart(2,'0')} / {String(pages.length).padStart(2,'0')}</div>
        <h2 className="hp-title" style={{ fontFamily: theme.displayFont, color: theme.ink }}>{pages[page].title}</h2>
        <div className="hp-sub" style={{ color: theme.inkMute }}>{pages[page].sub}</div>
        <div className="hp-body">{pages[page].body}</div>
      </div>
      <div className="hp-nav">
        <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ color: theme.inkMute, borderColor: theme.line }}>← 前</button>
        <div className="hp-dots">
          {pages.map((_,i) => <span key={i} className={`hp-dot ${page===i?'on':''}`} style={{ background: page===i?theme.accent:theme.line }} onClick={()=>setPage(i)}/>)}
        </div>
        <button onClick={()=>setPage(p=>Math.min(pages.length-1,p+1))} disabled={page===pages.length-1} style={{ color: theme.ink, borderColor: theme.accent, background: theme.surface }}>次 →</button>
      </div>
    </div>
  );
}

/* ──────── パーティ選択 ──────── */
function PartyPickerScreen({ theme, onConfirm, onCancel }) {
  const allHiragana = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.split('');
  const [pool, setPool] = useS(() => {
    const shuffled = [...allHiragana].sort(() => Math.random() - .5);
    return shuffled.slice(0, 12);
  });
  const [picked, setPicked] = useS(pool[0]);
  const reroll = () => {
    const shuffled = [...allHiragana].sort(() => Math.random() - .5);
    const next = shuffled.slice(0, 12);
    setPool(next);
    setPicked(next[0]);
  };
  const rs = rarityStyle(1, theme);
  // 各ひらがなの固有特性（主特性・副特性1・副特性2）
  const traitMap = {
    'あ': ['開幕','広翼','初息'],  'い': ['生命','息吹','命根'],
    'う': ['宇宙','孕み','生誕'],  'え': ['描画','映写','永望'],
    'お': ['深淵','大器','緒結'],  'か': ['薫風','香立','風起'],
    'き': ['木気','根張','聴力'],  'く': ['空破','貫通','組立'],
    'け': ['結縁','契約','境定'],  'こ': ['芯強','核心','小志'],
    'さ': ['咲力','冴渡','爽香'],  'し': ['静寂','沈潜','始源'],
    'す': ['澄清','透徹','清流'],  'せ': ['瀬立','清道','背志'],
    'そ': ['添心','寄添','空望'],  'た': ['立志','多才','根立'],
    'ち': ['地血','地力','根脈'],  'つ': ['継続','紡糸','連鎖'],
    'て': ['接触','触祈','祈手'],  'と': ['問戸','扉開','境啓'],
    'な': ['命名','成形','名立'],  'に': ['丹光','彩宿','色輝'],
    'ぬ': ['脱却','越境','抜刷'],  'ね': ['音根','根鳴','響源'],
    'の': ['野広','伸展','大野'],  'は': ['葉翼','羽展','広軽'],
    'ひ': ['陽火','光源','火聖'],  'ふ': ['風息','流転','吹巡'],
    'へ': ['道筋','経路','辺道'],  'ほ': ['穂稔','実望','帆向'],
    'ま': ['間合','真芯','間持'],  'み': ['深観','観察','実力'],
    'む': ['無充','虚満','結空'],  'め': ['萌眼','芽見','洞察'],
    'も': ['燃茂','成長','育力'],  'や': ['矢意','射志','八方'],
    'ゆ': ['緩歩','湯進','行流'],  'よ': ['世声','呼唱','世界'],
    'ら': ['羅楽','音羅','広調'],  'り': ['理力','洞理','利筋'],
    'る': ['常流','不止','流継'],  'れ': ['礼麗','美礼','礼尽'],
    'ろ': ['炉滴','露芯','芯燃'],  'わ': ['輪和','和輪','結合'],
    'を': ['継承','引継','緒尾'],  'ん': ['終結','極点','呑込'],
  };
  const meaningMap = {
    'あ': '始まりの音。空を仰ぐ。',
    'い': '生きる息。命の根。',
    'う': '生まれる音。宇宙を孕む。',
    'え': '描く。映す。永遠を願う。',
    'お': '大きく深い。緒となる。',
    'か': '香り立つ。風を起こす。',
    'き': '気・木・聴く。根を張る。',
    'く': '組む。空を抜ける。',
    'け': '結ぶ。境を引く。',
    'こ': '小さくも芯がある。',
    'さ': '咲く。冴える。',
    'し': '静けさを宿す。始まりの音。',
    'す': '澄む。透る。',
    'せ': '背・瀬。瀬を立てる。',
    'そ': '空・添う。寄り添う心。',
    'た': '立つ。多なる。',
    'ち': '地・血。根のうねり。',
    'つ': '紡ぐ。続ける。',
    'て': '手。触れる祈り。',
    'と': '戸・問う。境を開く。',
    'な': '名・成す。形を与える。',
    'に': '丹。色と光を宿す。',
    'ぬ': '抜ける。脱ぐ。',
    'ね': '音・寝。根の響き。',
    'の': '野・伸びる。広がる空。',
    'は': '葉・羽。広く・軽く。',
    'ひ': '陽・火。光の源。',
    'ふ': '風・吹く。流れる息。',
    'へ': '辺・経る。道のり。',
    'ほ': '穂・帆。実りと向かう先。',
    'ま': '間・真。間合いを保つ。',
    'み': '実・観る。深く見つめる。',
    'む': '無・結ぶ。空に充ちる。',
    'め': '芽・目。萌え立つもの。',
    'も': '燃ゆ・茂る。育ちゆく。',
    'や': '矢・八。射貫く意志。',
    'ゆ': '湯・行く。緩やかに進む。',
    'よ': '世・呼ぶ。声を上げる。',
    'ら': '羅・楽。広がる調べ。',
    'り': '理・利。筋を見抜く。',
    'る': '流。とどまらず。',
    'れ': '麗。礼を尽くす。',
    'ろ': '炉・露。芯と滴り。',
    'わ': '輪・和。むすび合う。',
    'を': '緒・尾。引き継ぐ。',
    'ん': '結びの音。すべてを呑む。',
  };
  return (
    <div className="screen pp-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont }}>
      <h2 style={{ fontFamily: theme.displayFont }}>リーダーを選ぶ</h2>
      <p style={{ color: theme.inkMute, margin: '4px 0 14px' }}>
        最初の<strong style={{color:theme.ink}}>リーダー</strong>は<strong style={{color:theme.ink}}>ひらがな</strong>から1体。<br/>
        意味から<strong style={{color:theme.accent}}>特性</strong>が自動で付きます。
      </p>

      <div className="pp-preview" style={{ background: theme.surface, borderColor: theme.lineStrong }}>
        <div className="ppp-glyph" style={{ fontFamily: theme.displayFont, color: theme.glyphHue, textShadow: rs.glow }}>{picked}</div>
        <div className="ppp-info">
          <div className="ppp-yomi" style={{ color: theme.inkMute }}>{picked}</div>
          <div className="ppp-traits">
            {(traitMap[picked] || ['守護','静音','始音']).map((t, ti) => (
              <span key={ti} className="trait" style={{
                background: 'transparent',
                color: ti === 0 ? theme.accent : theme.inkMute,
                borderColor: ti === 0 ? theme.accent : theme.line,
                fontFamily: theme.displayFont,
              }}>{t} Lv1</span>
            ))}
          </div>
          <div className="ppp-meaning" style={{ color: theme.ink, fontFamily: theme.displayFont }}>「{picked}」── {meaningMap[picked] || '深い意味を宿す。'}</div>
        </div>
      </div>

      <div className="pp-grid">
        {pool.map((ch, i) => {
          const sel = ch === picked;
          return (
            <button key={i} className={`pp-cell ${sel?'selected':''}`} onClick={()=>setPicked(ch)}
              style={{
                background: sel ? theme.surface : 'transparent',
                borderColor: sel ? theme.accent : theme.line,
                color: theme.glyphHue,
                fontFamily: theme.displayFont,
                boxShadow: sel ? `0 0 16px ${theme.glyphGlow}` : 'none',
              }}>{ch}</button>
          );
        })}
      </div>

      <div className="pp-actions">
        <button className="pp-reroll" onClick={reroll} style={{ color: theme.inkMute, borderColor: theme.line }}>↻ リロール</button>
        <button className="pp-confirm" onClick={() => onConfirm && onConfirm(picked)} style={{ background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, fontFamily: theme.bodyFont }}>
          「{picked}」で始める
        </button>
      </div>
    </div>
  );
}

/* ──────── 文章モード ──────── */
const WRITINGS_KEY = 'pomojikan_writings_v1';
const BLANK_HAIKU = { upper: Array(5).fill(''), middle: Array(7).fill(''), lower: Array(5).fill('') };
const HAIKU_ROWS = [
  { key: 'upper',  lbl: '上の句', cap: 5 },
  { key: 'middle', lbl: '中の句', cap: 7 },
  { key: 'lower',  lbl: '下の句', cap: 5 },
];
const KANA_POOL = [
  // 清音
  ...('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.split('')),
  // 濁音・半濁音
  ...('がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ'.split('')),
  // 小文字
  ...('ぁぃぅぇぉゃゅょっ'.split('')),
  // 記号
  'ー', '、', '。',
];

const DIARY_MAX = 150;

// 保存時の書体段階ラベル → 代表 lv（履歴エントリのスタイル再現用）
const STAGE_REP_LV = { '楷書': 5, '行書': 18, '草書': 45, '篆書': 100, '甲骨': 160 };

function WritingsScreen({ theme, inventory = {}, audioEnabled = false, leaderLv = 1, onWriteSave }) {
  const [tab, setTab] = useS('haiku');
  const [haiku, setHaiku] = useS(() => ({ ...BLANK_HAIKU, upper: [...BLANK_HAIKU.upper], middle: [...BLANK_HAIKU.middle], lower: [...BLANK_HAIKU.lower] }));
  const [cursor, setCursor] = useS({ row: 0, idx: 0 });
  const [diaryText, setDiaryText] = useS([]);
  const [saved, setSaved] = useS(() => {
    try { return JSON.parse(localStorage.getItem(WRITINGS_KEY) || '[]'); } catch { return []; }
  });
  const [flash, setFlash] = useS(false);
  const [palette, setPalette] = useS('kana'); // 'kana' | 'kanji'

  // インベントリから非かな字を抽出（漢字・ローマ数字・丸数字等）・tier降順
  const caughtKanji = Object.entries(inventory)
    .filter(([ch]) => {
      const code = ch.charCodeAt(0);
      // 除外: ひらがな(U+3040-309F)・カタカナ(U+30A0-30FF)・ASCII英数字(U+0020-007E)
      return !(code >= 0x3040 && code <= 0x30FF) && !(code >= 0x0020 && code <= 0x007E);
    })
    .sort(([, a], [, b]) => b.maxTier - a.maxTier || b.count - a.count)
    .map(([ch, data]) => ({ ch, ...data }));

  const rowKeys = ['upper', 'middle', 'lower'];

  // リーダーの書体ステージを反映（getScriptStyle は MainScreen.jsx から window 公開）
  const scriptStyle = (typeof getScriptStyle !== 'undefined')
    ? getScriptStyle(leaderLv, theme)
    : { fontFamily: theme.displayFont, fontWeight: 400, fontStyle: 'normal', letterSpacing: '0', textShadow: 'none' };

  const putChar = (ch) => {
    const { row, idx } = cursor;
    const key = rowKeys[row];
    const cap = HAIKU_ROWS[row].cap;
    const arr = [...haiku[key]];
    arr[idx] = ch;
    setHaiku(h => ({ ...h, [key]: arr }));
    if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playKeyTap();
    // 次スロットへ
    if (idx + 1 < cap) setCursor({ row, idx: idx + 1 });
    else if (row + 1 < HAIKU_ROWS.length) setCursor({ row: row + 1, idx: 0 });
  };

  const handleUndo = () => {
    const { row, idx } = cursor;
    const key = rowKeys[row];
    const arr = [...haiku[key]];
    if (arr[idx] !== '') {
      arr[idx] = '';
      setHaiku(h => ({ ...h, [key]: arr }));
    } else if (idx > 0) {
      const ni = idx - 1;
      arr[ni] = '';
      setHaiku(h => ({ ...h, [key]: arr }));
      setCursor({ row, idx: ni });
    } else if (row > 0) {
      const nr = row - 1;
      const nk = rowKeys[nr];
      const nc = HAIKU_ROWS[nr].cap;
      const pa = [...haiku[nk]];
      pa[nc - 1] = '';
      setHaiku(h => ({ ...h, [nk]: pa }));
      setCursor({ row: nr, idx: nc - 1 });
    }
  };

  const handleSave = () => {
    const empty = !haiku.upper.some(c => c) && !haiku.middle.some(c => c) && !haiku.lower.some(c => c);
    if (empty) return;
    const stageLabel = (typeof getScriptStage !== 'undefined') ? getScriptStage(leaderLv).label : '楷書';
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ja-JP'),
      stage: stageLabel,
      type: 'haiku',
      upper: [...haiku.upper],
      middle: [...haiku.middle],
      lower: [...haiku.lower],
    };
    const next = [entry, ...saved];
    setSaved(next);
    try { localStorage.setItem(WRITINGS_KEY, JSON.stringify(next)); } catch {}
    if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playFileSave();
    if (onWriteSave) onWriteSave();
    setHaiku({ upper: Array(5).fill(''), middle: Array(7).fill(''), lower: Array(5).fill('') });
    setCursor({ row: 0, idx: 0 });
    setFlash(true);
    setTimeout(() => { setFlash(false); setTab('history'); }, 600);
  };

  const putCharDiary = (ch) => {
    setDiaryText(t => {
      if (t.length >= DIARY_MAX) return t;
      if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playKeyTap();
      return [...t, ch];
    });
  };

  const handleUndoDiary = () => {
    setDiaryText(t => t.slice(0, -1));
  };

  const handleSaveDiary = () => {
    if (diaryText.length === 0) return;
    const stageLabel = (typeof getScriptStage !== 'undefined') ? getScriptStage(leaderLv).label : '楷書';
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ja-JP'),
      stage: stageLabel,
      type: 'diary',
      text: [...diaryText],
    };
    const next = [entry, ...saved];
    setSaved(next);
    try { localStorage.setItem(WRITINGS_KEY, JSON.stringify(next)); } catch {}
    if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playFileSave();
    if (onWriteSave) onWriteSave();
    setDiaryText([]);
    setFlash(true);
    setTimeout(() => { setFlash(false); setTab('history'); }, 600);
  };

  const accent3 = theme.accent + '44';

  return (
    <div className="screen wr-screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont }}>
      <h2 style={{ fontFamily: theme.displayFont }}>日記と俳句</h2>

      <div className="wr-tabs">
        {[['haiku','俳句'],['diary','日記'],['history',`綴り（${saved.length}）`]].map(([k,n]) => (
          <button key={k} className={`wrt ${tab===k?'active':''}`}
            onClick={()=>setTab(k)}
            style={{
              color: tab===k ? theme.ink : theme.inkMute,
              borderBottomColor: tab===k ? theme.accent : 'transparent',
              fontFamily: theme.displayFont,
            }}>{n}</button>
        ))}
      </div>

      {tab === 'haiku' && (
        <>
          <div className="wr-haiku" style={{
            background: flash ? (theme.accent + '22') : theme.surface,
            borderColor: flash ? theme.accent : theme.line,
            transition: 'background .3s, border-color .3s',
          }}>
            {HAIKU_ROWS.map((row, ri) => (
              <div key={ri} className="haiku-row">
                <span className="haiku-tag" style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>{row.lbl}<small>{row.cap}</small></span>
                <div className="haiku-slots">
                  {haiku[row.key].map((ch, ci) => {
                    const isActive = cursor.row === ri && cursor.idx === ci;
                    return (
                      <span key={ci} className="haiku-slot"
                        onClick={() => setCursor({ row: ri, idx: ci })}
                        style={{
                          background: isActive ? accent3 : theme.bgDeep,
                          borderColor: isActive ? theme.accent : theme.line,
                          color: ch ? theme.glyphHue : theme.inkDim,
                          fontFamily: scriptStyle.fontFamily,
                          fontWeight: scriptStyle.fontWeight,
                          fontStyle: scriptStyle.fontStyle,
                          letterSpacing: scriptStyle.letterSpacing,
                          textShadow: ch ? scriptStyle.textShadow : 'none',
                          boxShadow: isActive ? `0 0 8px ${theme.glyphGlow}` : `inset 0 0 4px ${theme.glyphGlow}`,
                          cursor: 'pointer',
                          transition: 'border-color .15s, box-shadow .15s, font-family .4s',
                        }}>{ch || '　'}</span>
                    );
                  })}
                </div>
                <span className="haiku-count" style={{ color: theme.inkMute }}>{haiku[row.key].filter(c=>c).length}/{row.cap}</span>
              </div>
            ))}
            <div className="wr-actions">
              <button className="wr-btn" onClick={() => { setHaiku({ upper: Array(5).fill(''), middle: Array(7).fill(''), lower: Array(5).fill('') }); setCursor({ row: 0, idx: 0 }); }}
                style={{ color: theme.inkMute, borderColor: theme.line }}>クリア</button>
              <button className="wr-btn" onClick={handleUndo} style={{ color: theme.inkMute, borderColor: theme.line }}>← 取消</button>
              <button className="wr-btn primary" onClick={handleSave}
                style={{ background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, borderColor: 'transparent' }}>📜 保存</button>
            </div>
          </div>

          <div className="wr-pool">
            {/* パレット切り替えタブ */}
            <div className="wp-palette-tabs">
              <button className={`wpt ${palette==='kana'?'active':''}`}
                onClick={() => setPalette('kana')}
                style={{
                  color: palette==='kana' ? theme.ink : theme.inkMute,
                  borderBottomColor: palette==='kana' ? theme.accent : 'transparent',
                  fontFamily: theme.displayFont,
                }}>かな</button>
              <button className={`wpt ${palette==='kanji'?'active':''}`}
                onClick={() => setPalette('kanji')}
                style={{
                  color: palette==='kanji' ? theme.ink : theme.inkMute,
                  borderBottomColor: palette==='kanji' ? theme.accent : 'transparent',
                  fontFamily: theme.displayFont,
                }}>
                字 {caughtKanji.length > 0 && <span className="wpt-badge" style={{ background: theme.accent, color: theme.bgDeep }}>{caughtKanji.length}</span>}
              </button>
            </div>

            {palette === 'kana' && (
              <div className="wp-grid">
                {KANA_POOL.map((ch, i) => (
                  <span key={i} className="wp-cell"
                    onClick={() => putChar(ch)}
                    style={{
                      background: theme.surface,
                      borderColor: theme.line,
                      color: theme.glyphHue,
                      fontFamily: theme.displayFont,
                      cursor: 'pointer',
                    }}>{ch}</span>
                ))}
              </div>
            )}

            {palette === 'kanji' && (
              caughtKanji.length === 0 ? (
                <div className="wp-kanji-empty" style={{ color: theme.inkMute }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>字</div>
                  <div style={{ fontSize: 12 }}>まだ漢字・記号を拾っていません</div>
                  <div style={{ fontSize: 11, marginTop: 4, color: theme.inkDim }}>集中中に字を拾うと、ここに並びます</div>
                </div>
              ) : (
                <div className="wp-grid wp-kanji-grid">
                  {caughtKanji.map(({ ch, maxTier, count }) => (
                    <span key={ch} className="wp-cell"
                      onClick={() => putChar(ch)}
                      style={{
                        background: theme.surface,
                        borderColor: theme.line,
                        color: theme.glyphHue,
                        fontFamily: theme.displayFont,
                        cursor: 'pointer',
                        boxShadow: maxTier >= 9 ? `0 0 6px ${theme.glyphGlow}` : 'none',
                      }}>
                      {ch}
                      <sub style={{ fontSize: 7, color: theme.inkDim, position: 'absolute', bottom: 2, right: 3 }}>★{maxTier}</sub>
                    </span>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}

      {tab === 'diary' && (
        <>
          {/* 日記テキスト表示エリア */}
          <div className="wr-diary-area" style={{
            background: flash ? (theme.accent + '22') : theme.surface,
            border: `1px solid ${flash ? theme.accent : theme.line}`,
            borderRadius: 14,
            padding: '16px',
            minHeight: 80,
            marginBottom: 12,
            fontFamily: scriptStyle.fontFamily,
            fontWeight: scriptStyle.fontWeight,
            fontStyle: scriptStyle.fontStyle,
            letterSpacing: scriptStyle.letterSpacing || '.1em',
            fontSize: 22,
            lineHeight: 1.7,
            color: theme.glyphHue,
            textShadow: diaryText.length > 0 ? scriptStyle.textShadow : 'none',
            transition: 'background .3s, border-color .3s, font-family .4s',
            wordBreak: 'break-all',
          }}>
            {diaryText.length === 0
              ? <span style={{ color: theme.inkDim, fontSize: 14, fontFamily: theme.bodyFont }}>字を選んで日記を綴る…</span>
              : diaryText.join('')
            }
            <span style={{ borderRight: `2px solid ${theme.accent}`, marginLeft: 2, animation: 'none', opacity: .8 }}>&nbsp;</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: theme.inkDim, fontSize: 11 }}>{diaryText.length} / {DIARY_MAX}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="wr-btn" onClick={() => setDiaryText([])}
                style={{ color: theme.inkMute, borderColor: theme.line }}>クリア</button>
              <button className="wr-btn" onClick={handleUndoDiary}
                style={{ color: theme.inkMute, borderColor: theme.line }}>← 取消</button>
              <button className="wr-btn primary" onClick={handleSaveDiary}
                style={{ background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, borderColor: 'transparent' }}>📖 保存</button>
            </div>
          </div>

          {/* パレット（俳句と共通） */}
          <div className="wr-pool">
            <div className="wp-palette-tabs">
              <button className={`wpt ${palette==='kana'?'active':''}`}
                onClick={() => setPalette('kana')}
                style={{ color: palette==='kana' ? theme.ink : theme.inkMute, borderBottomColor: palette==='kana' ? theme.accent : 'transparent', fontFamily: theme.displayFont }}>かな</button>
              <button className={`wpt ${palette==='kanji'?'active':''}`}
                onClick={() => setPalette('kanji')}
                style={{ color: palette==='kanji' ? theme.ink : theme.inkMute, borderBottomColor: palette==='kanji' ? theme.accent : 'transparent', fontFamily: theme.displayFont }}>
                字 {caughtKanji.length > 0 && <span className="wpt-badge" style={{ background: theme.accent, color: theme.bgDeep }}>{caughtKanji.length}</span>}
              </button>
            </div>
            {palette === 'kana' && (
              <div className="wp-grid">
                {KANA_POOL.map((ch, i) => (
                  <span key={i} className="wp-cell" onClick={() => putCharDiary(ch)}
                    style={{ background: theme.surface, borderColor: theme.line, color: theme.glyphHue, fontFamily: theme.displayFont, cursor: 'pointer' }}>{ch}</span>
                ))}
              </div>
            )}
            {palette === 'kanji' && (
              caughtKanji.length === 0 ? (
                <div className="wp-kanji-empty" style={{ color: theme.inkMute }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>字</div>
                  <div style={{ fontSize: 12 }}>まだ漢字を拾っていません</div>
                </div>
              ) : (
                <div className="wp-grid wp-kanji-grid">
                  {caughtKanji.map(({ ch, maxTier }) => (
                    <span key={ch} className="wp-cell" onClick={() => putCharDiary(ch)}
                      style={{ background: theme.surface, borderColor: theme.line, color: theme.glyphHue, fontFamily: theme.displayFont, cursor: 'pointer', boxShadow: maxTier >= 9 ? `0 0 6px ${theme.glyphGlow}` : 'none' }}>
                      {ch}
                      <sub style={{ fontSize: 7, color: theme.inkDim, position: 'absolute', bottom: 2, right: 3 }}>★{maxTier}</sub>
                    </span>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}

      {tab === 'history' && (
        <div className="wr-history">
          {saved.length === 0 ? (
            <div style={{ color: theme.inkMute, textAlign: 'center', marginTop: 48 }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📜</div>
              <div style={{ fontFamily: theme.displayFont }}>まだ何も綴られていない</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>俳句または日記を書いて保存しよう</div>
            </div>
          ) : (
            <div className="wr-hist-list">
              {saved.map(entry => {
                const isDiary = entry.type === 'diary';
                const handleDelete = () => {
                  const next = saved.filter(e => e.id !== entry.id);
                  setSaved(next);
                  try { localStorage.setItem(WRITINGS_KEY, JSON.stringify(next)); } catch {}
                };
                const handleCopy = () => {
                  if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playKeyTap();
                  const text = isDiary
                    ? (entry.text || []).join('')
                    : `${(entry.upper||[]).join('')}　${(entry.middle||[]).join('')}　${(entry.lower||[]).join('')}\n#ぽもじかん ${entry.date}`;
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(text).catch(() => {});
                  }
                };
                // 保存時の書体段階スタイルで履歴を描画
                const entryRepLv = STAGE_REP_LV[entry.stage] || leaderLv;
                const entryStyle = (typeof getScriptStyle !== 'undefined')
                  ? getScriptStyle(entryRepLv, theme)
                  : scriptStyle;
                return (
                  <div key={entry.id} className="wr-hist-item"
                    style={{ background: theme.surface, borderColor: isDiary ? theme.accent + '44' : theme.line }}>
                    <div className="whi-top">
                      <div className="whi-date" style={{ color: theme.inkMute, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{isDiary ? '📖' : '📜'}</span>
                        <span>{entry.date}</span>
                        {entry.stage && (
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: theme.bgDeep, color: theme.inkDim,
                            border: `1px solid ${theme.line}`,
                            fontFamily: theme.displayFont, letterSpacing: '.05em',
                          }}>{entry.stage}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="whi-del" onClick={handleCopy}
                          title="コピー"
                          style={{ color: theme.inkDim, border: `1px solid ${theme.line}`, background: 'transparent' }}>
                          ⎘
                        </button>
                        <button className="whi-del" onClick={handleDelete}
                          title="削除"
                          style={{ color: theme.inkDim, border: `1px solid ${theme.line}`, background: 'transparent' }}>
                          ×
                        </button>
                      </div>
                    </div>
                    {isDiary ? (
                      <div className="whi-diary" style={{
                        fontFamily: entryStyle.fontFamily,
                        fontWeight: entryStyle.fontWeight,
                        fontStyle: entryStyle.fontStyle,
                        letterSpacing: entryStyle.letterSpacing || '.08em',
                        color: theme.glyphHue,
                        fontSize: 16,
                        lineHeight: 1.8,
                        marginTop: 6,
                        textShadow: entryRepLv >= 70 ? entryStyle.textShadow : 'none',
                      }}>
                        {(entry.text || []).join('')}
                      </div>
                    ) : (
                      <div className="whi-haiku" style={{
                        fontFamily: entryStyle.fontFamily,
                        fontWeight: entryStyle.fontWeight,
                        fontStyle: entryStyle.fontStyle,
                        letterSpacing: entryStyle.letterSpacing,
                        color: theme.glyphHue,
                        textShadow: entryRepLv >= 70 ? entryStyle.textShadow : 'none',
                      }}>
                        <span>{(entry.upper || []).join('')}</span>
                        <span style={{ color: theme.inkDim, margin: '0 6px', fontStyle: 'normal', letterSpacing: 0 }}>／</span>
                        <span>{(entry.middle || []).join('')}</span>
                        <span style={{ color: theme.inkDim, margin: '0 6px', fontStyle: 'normal', letterSpacing: 0 }}>／</span>
                        <span>{(entry.lower || []).join('')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { CodexScreen, HelpScreen, PartyPickerScreen, WritingsScreen });

/* ──────── タイマー設定 ──────── */
const TIMER_PRESETS = [[25,5],[50,10],[15,3]];
const SET_OPTIONS = [1,3,4,6,0]; // 0=∞

function TimerSettingsScreen({ theme, currentWork = 25, currentRest = 5, onApply, onClose }) {
  const initPreset = TIMER_PRESETS.findIndex(([w,r]) => w === currentWork && r === currentRest);
  const [preset, setPreset] = useS(initPreset >= 0 ? initPreset : -1);
  const [customWork, setCustomWork] = useS(currentWork);
  const [customRest, setCustomRest] = useS(currentRest);
  const [sets, setSets] = useS(0); // 0=∞

  const work = preset >= 0 ? TIMER_PRESETS[preset][0] : customWork;
  const rest = preset >= 0 ? TIMER_PRESETS[preset][1] : customRest;

  const handlePreset = (i) => {
    setPreset(i);
    setCustomWork(TIMER_PRESETS[i][0]);
    setCustomRest(TIMER_PRESETS[i][1]);
  };

  const handleApply = () => {
    onApply && onApply({ work, rest, sets });
    onClose && onClose();
  };

  const btnBase = { padding: '16px 0', borderRadius: 12, cursor: 'pointer', fontFamily: theme.displayFont, fontSize: 20, letterSpacing: '.04em', flex: 1 };

  return (
    <div className="screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont, padding: '30px 20px' }}>
      <h2 style={{ fontFamily: theme.displayFont }}>時間設定</h2>

      {/* プリセット */}
      <div style={{ display: 'flex', gap: 8, margin: '20px 0' }}>
        {TIMER_PRESETS.map(([w,r], i) => (
          <button key={i} onClick={() => handlePreset(i)} style={{
            ...btnBase,
            background: preset === i ? theme.accent : 'transparent',
            color: preset === i ? (theme.luminance === 'light' ? '#fff' : theme.bgDeep) : theme.ink,
            border: `1px solid ${preset === i ? 'transparent' : theme.line}`,
          }}>{w}<small style={{ opacity: .6, fontSize: 12 }}>/{r}</small></button>
        ))}
      </div>

      {/* 詳細 */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 16 }}>
        {[['集中', customWork, setCustomWork, 'work'], ['休憩', customRest, setCustomRest, 'rest']].map(([label, val, setter, key]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${theme.line}` }}>
            <span style={{ color: theme.inkMute, fontSize: 12, letterSpacing: '.1em' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => { setter(v => Math.max(1, v - 5)); setPreset(-1); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: `1px solid ${theme.line}`, color: theme.ink, cursor: 'pointer', fontSize: 16 }}>−</button>
              <span style={{ fontFamily: theme.displayFont, fontSize: 22, minWidth: 48, textAlign: 'center' }}>{val} 分</span>
              <button onClick={() => { setter(v => Math.min(120, v + 5)); setPreset(-1); }}
                style={{ width: 28, height: 28, borderRadius: '50%', background: 'transparent', border: `1px solid ${theme.line}`, color: theme.ink, cursor: 'pointer', fontSize: 16 }}>＋</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
          <span style={{ color: theme.inkMute, fontSize: 12, letterSpacing: '.1em' }}>セット</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {SET_OPTIONS.map((n, i) => (
              <button key={i} onClick={() => setSets(n)} style={{
                width: 32, height: 32, borderRadius: '50%',
                background: sets === n ? theme.accent : 'transparent',
                color: sets === n ? (theme.luminance === 'light' ? '#fff' : theme.bgDeep) : theme.ink,
                border: `1px solid ${sets === n ? 'transparent' : theme.line}`,
                fontFamily: theme.displayFont, cursor: 'pointer', fontSize: 13,
              }}>{n === 0 ? '∞' : n}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onClose} style={{ flex: 1, padding: 14, background: 'transparent', color: theme.inkMute, border: `1px solid ${theme.line}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}>キャンセル</button>
        <button onClick={handleApply} style={{ flex: 2, padding: 14, background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, border: 0, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>適用</button>
      </div>
    </div>
  );
}

Object.assign(window, { TimerSettingsScreen });
