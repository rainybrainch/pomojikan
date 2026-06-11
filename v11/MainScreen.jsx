/* MainScreen.jsx ── 改良メイン画面コンポーネント
   役割：
   - 「世界をのぞく窓」として、字（ぽもじ）が降る景色を主役にする
   - ヘッダーは小さく、UI は端に退き、必要時に手を伸ばす形に
   - テーマに応じて配色・書体・モチーフ・落下スタイルが連動して変わる
   - 静的（テーマ研究用）／インタラクティブ（動くプロトタイプ）両対応
*/

const { useState, useEffect, useRef, useMemo } = React;

/* ─────────────────────────────────────────────────────────
   書体進化 ── Lv に応じて字の外観が5段階で変化する
   楷書(1-9) → 行書(10-29) → 草書(30-69) → 篆書(70-149) → 甲骨(150+)
   ──────────────────────────────────────────────────────── */
const SCRIPT_STAGES = [
  { lv: 1,   name: '楷',  label: '楷書',  font: '"Noto Serif JP", serif',       weight: 400, style: 'normal', spacing: '0',     opacity: 1.0  },
  { lv: 10,  name: '行',  label: '行書',  font: '"Noto Serif JP", serif',       weight: 300, style: 'italic', spacing: '.06em', opacity: 0.92 },
  { lv: 30,  name: '草',  label: '草書',  font: '"Klee One", cursive',          weight: 400, style: 'italic', spacing: '.04em', opacity: 0.85 },
  { lv: 70,  name: '篆',  label: '篆書',  font: '"Shippori Mincho B1", serif',  weight: 700, style: 'normal', spacing: '.18em', opacity: 0.95 },
  { lv: 150, name: '骨',  label: '甲骨',  font: '"Shippori Mincho B1", serif',  weight: 700, style: 'normal', spacing: '.22em', opacity: 1.0  },
];

function getScriptStage(lv) {
  let stage = SCRIPT_STAGES[0];
  for (const s of SCRIPT_STAGES) {
    if (lv >= s.lv) stage = s;
  }
  return stage;
}

function getScriptStyle(lv, theme, extraGlow = false) {
  const s = getScriptStage(lv);
  const isAncient = lv >= 70;
  const glow = isAncient
    ? `0 0 ${lv >= 150 ? 14 : 8}px ${theme.glyphGlow}, 0 0 ${lv >= 150 ? 28 : 14}px ${theme.glyphGlow}`
    : (extraGlow ? `0 0 6px ${theme.glyphGlow}` : 'none');
  return {
    fontFamily: s.font,
    fontWeight: s.weight,
    fontStyle: s.style,
    letterSpacing: s.spacing,
    opacity: s.opacity,
    textShadow: glow,
    ...(lv >= 150 ? { filter: 'sepia(0.35) contrast(1.1)' } : {}),
    transition: 'font-family .4s, letter-spacing .4s, text-shadow .4s, filter .5s',
  };
}

/* GLYPH_POOL は codex-v11.js の THEME_GLYPH_POOLS にフォールバック */
const GLYPH_POOL = (typeof THEME_GLYPH_POOLS !== 'undefined') ? THEME_GLYPH_POOLS : {
  yoruame: ['雨','雫','音','静','間','詩','夜','藍','澄','響','水','心','空','陰','閑'],
  sumido:  ['道','無','空','禅','一','心','静','寂','字','墨','書','茶','花','月','風'],
  kokeniwa:['苔','葉','緑','森','石','風','木','蔭','滴','光','土','岩','幽','玄','蘚'],
  kinkaku: ['金','閣','炎','陽','輝','光','燦','焔','緋','朱','瑠','璃','華','栄','曜'],
  harugasumi:['春','花','霞','桜','夢','麗','薄','紅','匂','和','咲','艶','雛','雅','綻'],
};

/* 本格落下フィールド ─ タップで拾える・XPが浮く・1字ずつ寿命管理 */
function LiveFallingField({ theme, paused = false, mode = 'work', density = 1, onCatch, audioEnabled = false, leaderTier = 1, leaderLv = 1 }) {
  const [chars, setChars] = useState([]);
  const [pops, setPops] = useState([]);
  const idRef = useRef(0);
  const pool = GLYPH_POOL[theme.id] || GLYPH_POOL.yoruame;

  useEffect(() => {
    if (paused || mode === 'idle') return;
    const spawn = () => {
      // tier 分布：リーダー tier に応じて高レア字の出現率が上がる
      // lt=0(★1): low50% mid35% high12% divine3%
      // lt=1(★16): low20% mid46% high26% divine8%
      const lt = Math.max(0, Math.min(1, (leaderTier - 1) / 15));
      const r = Math.random();
      const tier = r < (0.50 - lt * 0.30) ? 1 + Math.floor(Math.random() * 4)   // low
                 : r < (0.85 - lt * 0.15) ? 5 + Math.floor(Math.random() * 4)   // mid
                 : r < (0.97 - lt * 0.05) ? 9 + Math.floor(Math.random() * 4)   // high
                 : 13 + Math.floor(Math.random() * 4);                            // divine
      const dur = Math.max(6, 14 + Math.random() * 14 - tier * 0.4);
      const size = 22 + Math.random() * 18 + tier * 1.6;
      const id = idRef.current++;
      // codex-v11.js があればtier対応プール、なければテーマプール
      const tierPool = (typeof getGlyphForTier !== 'undefined')
        ? getGlyphForTier(tier, theme.id)
        : pool;
      const newC = {
        id,
        ch: tierPool[Math.floor(Math.random() * tierPool.length)],
        left: 4 + Math.random() * 88,
        size,
        dur,
        tier,
      };
      setChars(cs => [...cs, newC]);
      setTimeout(() => {
        setChars(cs => cs.filter(x => x.id !== id));
      }, dur * 1000);
    };
    // 初期スポーン
    for (let i = 0; i < 5; i++) setTimeout(spawn, i * 220);
    const interval = setInterval(spawn, Math.max(280, 750 / density));
    return () => clearInterval(interval);
  }, [paused, theme.id, mode, density, leaderTier]);

  const handleCatch = (c, e) => {
    e.stopPropagation();
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const field = target.parentElement.getBoundingClientRect();
    const popId = idRef.current++;
    const xp = (typeof xpForTier !== 'undefined') ? xpForTier(c.tier) : c.tier * 4;
    setPops(ps => [...ps, {
      id: popId,
      left: ((rect.left + rect.width/2 - field.left) / field.width) * 100,
      top: ((rect.top + rect.height/2 - field.top) / field.height) * 100,
      tier: c.tier,
      xp,
      ch: c.ch,
    }]);
    setTimeout(() => setPops(ps => ps.filter(x => x.id !== popId)), 1100);
    setChars(cs => cs.filter(x => x.id !== c.id));
    if (audioEnabled && typeof PomojikanAudio !== 'undefined') {
      PomojikanAudio.playCatch(c.tier);
    }
    onCatch && onCatch({ tier: c.tier, xp, ch: c.ch });
  };

  const scriptStyle = getScriptStyle(leaderLv, theme);

  return (
    <div className="live-field">
      {chars.map(c => {
        const rs = rarityStyle(c.tier, theme);
        return (
          <button
            key={c.id}
            className={`lc lc-${mode} lc-r${c.tier}`}
            onClick={(e) => handleCatch(c, e)}
            style={{
              left: `${c.left}%`,
              animationDuration: `${c.dur}s`,
              fontSize: `${c.size}px`,
              color: theme.glyphHue,
              textShadow: rs.glow || scriptStyle.textShadow,
              fontFamily: scriptStyle.fontFamily,
              fontWeight: scriptStyle.fontWeight,
              fontStyle: scriptStyle.fontStyle,
              letterSpacing: scriptStyle.letterSpacing,
              animationPlayState: paused ? 'paused' : 'running',
              transition: scriptStyle.transition,
            }}
            aria-label={`字 ${c.ch} ★${c.tier}`}
          >{c.ch}</button>
        );
      })}
      {pops.map(p => {
        const isRare = p.tier >= 9;
        const color = p.tier >= 12 ? theme.gold : p.tier >= 8 ? theme.accent2 : theme.accent;
        return (
          <span key={p.id} className={`catch-pop ${p.tier >= 12 ? 'epic' : p.tier >= 8 ? 'rare' : ''}`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              color,
              fontFamily: theme.displayFont,
              display: isRare ? 'flex' : undefined,
              flexDirection: isRare ? 'column' : undefined,
              alignItems: isRare ? 'center' : undefined,
              lineHeight: isRare ? 1.2 : undefined,
              gap: isRare ? 2 : undefined,
            }}>
            {isRare && (
              <span style={{ fontSize: p.tier >= 12 ? '1.6em' : '1.2em', opacity: 0.95 }}>{p.ch}</span>
            )}
            <span>+{p.xp}</span>
          </span>
        );
      })}
    </div>
  );
}

/* 落下する字（背景演出）─ 軽量。テーマで色・書体・書体ステージが変わる */
function FallingGlyphs({ theme, density = 1, paused = false, mode = 'work', idleAmbient = false, leaderLv = 1 }) {
  const pool = GLYPH_POOL[theme.id] || GLYPH_POOL.yoruame;
  const count = Math.round(14 * density);
  const items = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const tier = Math.max(1, Math.min(16, Math.floor(1 + Math.random() ** 2 * 12)));
      arr.push({
        ch: pool[Math.floor(Math.random() * pool.length)],
        left: Math.random() * 100,
        delay: -Math.random() * (idleAmbient ? 40 : 22),
        dur: (idleAmbient ? 28 : 14) + Math.random() * 18,
        size: idleAmbient
          ? 14 + Math.random() * 20
          : 16 + Math.random() * (mode === 'rest' ? 18 : 28),
        op: idleAmbient
          ? 0.08 + Math.random() * 0.14
          : 0.18 + Math.random() * 0.35,
        tier,
      });
    }
    return arr;
  }, [theme.id, count, mode, idleAmbient]);

  // 書体ステージを背景グリフにも反映（フォントのみ。不透明度/サイズは既存値を維持）
  const bgScript = (typeof getScriptStyle !== 'undefined')
    ? getScriptStyle(leaderLv, theme)
    : { fontFamily: theme.displayFont, fontWeight: 400, fontStyle: 'normal' };

  return (
    <div className="falling-layer" aria-hidden="true">
      {items.map((it, i) => {
        const rs = rarityStyle(it.tier, theme);
        return (
          <span
            key={i}
            className={`fg fg-${mode}`}
            style={{
              left: `${it.left}%`,
              animationDelay: `${it.delay}s`,
              animationDuration: `${it.dur}s`,
              animationPlayState: paused ? 'paused' : 'running',
              fontSize: `${it.size}px`,
              color: theme.glyphHue,
              textShadow: rs.glow,
              fontFamily: bgScript.fontFamily,
              fontWeight: bgScript.fontWeight,
              fontStyle: bgScript.fontStyle,
              opacity: it.op,
            }}
          >{it.ch}</span>
        );
      })}
    </div>
  );
}

/* テーマモチーフ（雨／墨／葉／炎／花弁） */
function ThemeMotif({ theme, mode }) {
  if (theme.motif === 'rain') {
    return (
      <div className="motif motif-rain" aria-hidden="true">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 2.7) % 100}%`,
            animationDelay: `${-Math.random() * 1.2}s`,
            animationDuration: `${0.7 + Math.random() * 0.6}s`,
            opacity: 0.3 + Math.random() * 0.4,
            background: `linear-gradient(to bottom, transparent, ${theme.motifColor})`,
          }} />
        ))}
      </div>
    );
  }
  if (theme.motif === 'sumi') {
    return (
      <div className="motif motif-sumi" aria-hidden="true">
        <div className="sumi-wash" style={{ background: `radial-gradient(ellipse at 30% 20%, ${theme.motifColor}, transparent 60%)` }} />
        <div className="sumi-stroke" style={{ background: theme.motifColor }} />
      </div>
    );
  }
  if (theme.motif === 'leaves') {
    return (
      <div className="motif motif-leaves" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 8.3 + 5) % 100}%`,
            animationDelay: `${-Math.random() * 18}s`,
            animationDuration: `${16 + Math.random() * 10}s`,
            color: theme.motifColor,
          }}>{['❦','✿','❀'][i % 3]}</span>
        ))}
      </div>
    );
  }
  if (theme.motif === 'embers') {
    return (
      <div className="motif motif-embers" aria-hidden="true">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 3.7) % 100}%`,
            animationDelay: `${-Math.random() * 8}s`,
            animationDuration: `${5 + Math.random() * 6}s`,
            background: theme.motifColor,
            boxShadow: `0 0 6px ${theme.motifColor}`,
          }} />
        ))}
      </div>
    );
  }
  if (theme.motif === 'petals') {
    return (
      <div className="motif motif-petals" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} style={{
            left: `${(i * 6.5) % 100}%`,
            animationDelay: `${-Math.random() * 14}s`,
            animationDuration: `${12 + Math.random() * 8}s`,
            color: theme.motifColor,
          }}>❀</span>
        ))}
      </div>
    );
  }
  return null;
}

/* パーティカード ─ リーダーは大きく、他3枠は小さく。空き枠は鍵 */
function PartyCard({ slot, idx, theme, isLeader, locked, onAdd, onRemove, leaderLv = 0 }) {
  if (locked) {
    const unlockLv = [3, 6, 10][idx - 1];
    const pct = Math.min(100, Math.round((leaderLv / unlockLv) * 100));
    return (
      <div className="party-card locked" title={`リーダーLv ${unlockLv} で解放`}>
        <div className="pc-lock-icon" style={{ color: theme.inkDim, fontSize: 14, marginBottom: 2 }}>鍵</div>
        <div className="pc-bar" style={{ marginBottom: 4 }}>
          <div className="pc-bar-fg" style={{ width: `${pct}%`, background: theme.inkMute }} />
        </div>
        <div className="pc-meta" style={{ color: theme.inkDim, fontSize: 9 }}>
          {leaderLv}<span style={{ opacity: .5 }}>/{unlockLv}</span>
        </div>
      </div>
    );
  }
  if (!slot) {
    return (
      <div className="party-card empty pc-addable"
        onClick={onAdd}
        style={{ cursor: onAdd ? 'pointer' : 'default', borderColor: onAdd ? theme.accent + '55' : undefined }}
        title="タップしてメンバーを追加">
        <div className="pc-glyph" style={{ color: theme.accent, fontSize: 28 }}>＋</div>
        <div className="pc-meta" style={{ color: theme.inkMute }}>追加</div>
      </div>
    );
  }
  const rs = rarityStyle(slot.tier, theme);
  const ss = getScriptStyle(slot.lv, theme, slot.tier >= 8);
  const stage = getScriptStage(slot.lv);
  return (
    <div className={`party-card ${isLeader ? 'leader' : ''} rar-${slot.tier}`}>
      {isLeader && <div className="pc-crown">★</div>}
      {onRemove && (
        <button className="pc-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="外す" style={{ color: theme.inkDim, background: theme.bgDeep, border: `1px solid ${theme.line}` }}>×</button>
      )}
      <div className="pc-stage-badge" style={{
        color: slot.lv >= 150 ? theme.gold : slot.lv >= 70 ? theme.accent : theme.inkDim,
        fontFamily: '"Zen Kaku Gothic New", sans-serif',
        fontSize: 9,
        letterSpacing: '.1em',
        marginBottom: 2,
        fontWeight: slot.lv >= 70 ? 700 : 400,
      }}>{stage.label}</div>
      <div className="pc-glyph" style={{
        ...ss,
        color: theme.glyphHue,
        textShadow: ss.textShadow !== 'none' ? ss.textShadow : rs.glow,
      }}>{slot.ch}</div>
      <div className="pc-bar"><div className="pc-bar-fg" style={{
        width: `${typeof xpToNextLevel !== 'undefined' ? Math.min(100, Math.round((slot.exp || 0) / xpToNextLevel(slot.lv) * 100)) : Math.min(100, slot.exp || 0)}%`,
        background: theme.accent,
      }} /></div>
      <div className="pc-meta">Lv {slot.lv}</div>
    </div>
  );
}

/* メインタイマー ─ 円ではなく字そのものを大きく見せる構造 */
function TimerHero({ theme, mode, time, total, paused, progress, leader, cycles, band, onStartToggle, onSettings }) {
  const mm = String(Math.floor(time / 60)).padStart(2, '0');
  const ss = String(time % 60).padStart(2, '0');
  const stateLabel = mode === 'idle' ? '休む' : mode === 'work' ? '集中' : '休憩';
  const buttonLabel = mode === 'idle' ? '始める' : paused ? '続ける' : '止める';
  return (
    <div className={`hero hero-${mode} ${paused ? 'paused' : ''}`}>
      {/* 進捗リング（影武者として） */}
      <svg className="ring" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="92" fill="none" stroke={theme.line} strokeWidth="1" />
        <circle cx="100" cy="100" r="92" fill="none" stroke={theme.accent} strokeWidth="2"
          strokeDasharray={2 * Math.PI * 92}
          strokeDashoffset={2 * Math.PI * 92 * (1 - progress)}
          transform="rotate(-90 100 100)"
          style={{ transition: 'stroke-dashoffset .5s' }}/>
      </svg>

      <div className="hero-mode" style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>
        <span className="hero-mode-dot" style={{ background: mode === 'work' ? theme.accent : mode === 'rest' ? theme.gold : 'transparent', border: `1px solid ${theme.line}` }} />
        {stateLabel}
      </div>

      <div className="hero-time" style={{ fontFamily: theme.displayFont, color: theme.ink }}>
        <span className="ht-mm">{mm}</span>
        <span className="ht-sep">:</span>
        <span className="ht-ss">{ss}</span>
      </div>

      <button className="hero-cog" onClick={onSettings} aria-label="時間設定" style={{ color: theme.inkMute, borderColor: theme.line }}>⚙</button>

      <button
        className={`hero-cta cta-${mode}`}
        onClick={onStartToggle}
        style={{
          background: mode === 'idle' ? theme.accent : 'transparent',
          color: mode === 'idle' ? (theme.luminance === 'light' ? '#fff' : theme.bgDeep) : theme.ink,
          borderColor: mode === 'idle' ? 'transparent' : theme.lineStrong,
          fontFamily: theme.bodyFont,
        }}
      >
        {buttonLabel}
      </button>

      {/* 補足情報 ── 帯・リーダー・サイクル数。タイマー下に薄く */}
      <div className="hero-meta" style={{ color: theme.inkDim }}>
        <span className="hm-band">{band}</span>
        <span className="hm-sep">／</span>
        {leader ? (
          <span className="hm-leader" style={{
            ...getScriptStyle(leader.lv, theme),
            color: theme.inkMute,
            fontSize: 'inherit',
          }}>{leader.ch} <span style={{ fontFamily: theme.bodyFont, fontStyle: 'normal', letterSpacing: 0 }}>Lv {leader.lv}・{getScriptStage(leader.lv).label}</span></span>
        ) : (
          <span className="hm-leader">リーダー未選択</span>
        )}
        <span className="hm-sep">／</span>
        <span className="hm-cycle">{cycles}回</span>
      </div>
    </div>
  );
}

/* メインゲーム画面（フル）*/
function MainScreen({
  theme,
  interactive = false,
  initialMode = 'idle',
  motionLevel = 1,
  showWordOfDay = true,
  party = null,
  cycles = 0,
  workSec = 25 * 60,
  restSec = 5 * 60,
  audioEnabled = false,
  onOpenModal = () => {},
  onCatch = () => {},
  onCycleComplete = () => {},
  onAddPartyMember = null,
  onRemovePartyMember = null,
}) {
  const [mode, setMode] = useState(initialMode);
  const [paused, setPaused] = useState(false);
  const initSec = initialMode === 'rest' ? restSec : workSec;
  const [time, setTime] = useState(initSec);
  const [totalTime, setTotalTime] = useState(initSec);

  // workSec/restSec が変わったらアイドル中のみリセット
  useEffect(() => {
    if (mode === 'idle') {
      setTime(workSec);
      setTotalTime(workSec);
    }
  }, [workSec, restSec]);
  const [tick, setTick] = useState(0);
  const [caught, setCaught] = useState(0);
  const [caughtXP, setCaughtXP] = useState(0);
  const [lastCatch, setLastCatch] = useState(null);
  const [wodOpen, setWodOpen] = useState(false);

  // wod ポップアップ外タップで閉じる
  useEffect(() => {
    if (!wodOpen) return;
    const close = () => setWodOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [wodOpen]);

  // インタラクティブのときだけタイマー進行
  useEffect(() => {
    if (!interactive || paused || mode === 'idle') return;
    const id = setInterval(() => {
      setTime(t => {
        if (t <= 1) {
          const nextMode = mode === 'work' ? 'rest' : 'work';
          const nextSec = nextMode === 'rest' ? restSec : workSec;
          setMode(nextMode);
          setTotalTime(nextSec);
          if (audioEnabled && typeof PomojikanAudio !== 'undefined') {
            if (nextMode === 'rest') PomojikanAudio.playRestStart();
            else PomojikanAudio.playWorkStart();
          }
          // work → rest = ポモドーロ1周完了
          if (nextMode === 'rest') onCycleComplete();
          // rest → work = 新サイクル開始。チップをリセット
          if (nextMode === 'work') { setCaught(0); setCaughtXP(0); }
          return nextSec;
        }
        return t - 1;
      });
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [interactive, paused, mode, workSec, restSec]);

  const progress = 1 - (time / totalTime);

  const defaultParty = [null, null, null, null];
  const partyData = party || defaultParty;
  const leader = partyData[0];
  const band = leader ? `★${leader.tier}帯` : '★1帯';

  const handleStartToggle = () => {
    if (mode === 'idle') {
      if (!leader) {
        // slot 0 確定でピッカーを開く（onAddPartyMember 経由で partyPickerSlotRef を正しく設定）
        if (onAddPartyMember) onAddPartyMember(0);
        else onOpenModal('party-picker');
        return;
      }
      setMode('work');
      setPaused(false);
      if (audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playWorkStart();
    } else {
      // 一時停止→再開時のみ音を鳴らす（停止時は鳴らさない）
      setPaused(p => {
        if (p && audioEnabled && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playWorkStart();
        return !p;
      });
    }
  };

  const fallingDensity = motionLevel === 0 ? 0.4 : motionLevel === 2 ? 1.4 : 1;
  const motifEnabled = motionLevel > 0;

  return (
    <div className={`mscreen lum-${theme.luminance} mode-${mode}`}
      style={{
        background: `linear-gradient(180deg, ${theme.bgDeep} 0%, ${theme.bgMid} 60%, ${theme.bgLight} 100%)`,
        color: theme.ink,
        fontFamily: theme.bodyFont,
      }}>

      {/* レイヤ：背景モチーフ */}
      {motifEnabled && <ThemeMotif theme={theme} mode={mode} />}

      {/* レイヤ：降る字（背景奥 or インタラクティブ） */}
      {motionLevel > 0 && (
        interactive ? (
          <>
            {/* アイドル時：拾えない演出グリフをゆっくり降らせて世界を生かす */}
            {mode === 'idle' && (
              <FallingGlyphs
                theme={theme}
                density={fallingDensity * 0.6}
                paused={paused}
                mode="work"
                idleAmbient={true}
                leaderLv={leader ? (leader.lv || 1) : 1}
              />
            )}
            <LiveFallingField
              theme={theme}
              paused={paused || mode === 'idle'}
              mode={mode}
              density={fallingDensity}
              audioEnabled={audioEnabled}
              leaderTier={leader ? (leader.tier || 1) : 1}
              leaderLv={leader ? (leader.lv || 1) : 1}
              onCatch={(info) => {
                setCaught(c => c + 1);
                setCaughtXP(x => x + info.xp);
                setLastCatch({ ch: info.ch, tier: info.tier, t: Date.now() });
                onCatch(info);
              }}
            />
          </>
        ) : (
          <FallingGlyphs theme={theme} density={fallingDensity} paused={paused || mode === 'idle'} mode={mode} leaderLv={leader ? (leader.lv || 1) : 1} />
        )
      )}

      {/* ヘッダ：ブランド ＋ メニュー（とても薄く） */}
      <header className="mh">
        <div className="mh-brand" style={{ fontFamily: theme.displayFont, color: theme.ink }}>
          <span className="mh-brand-mark" style={{ color: theme.accent }}>ぽ</span>
          <span className="mh-brand-text">もじかん</span>
        </div>
        <div className="mh-actions">
          {showWordOfDay && (() => {
            const _stage = (typeof getScriptStage !== 'undefined') ? getScriptStage(leader ? (leader.lv || 1) : 1).label : '楷書';
            const wod = (typeof getWordOfDay !== 'undefined') ? getWordOfDay(theme.id, _stage) : { word: '諸行無常', yomi: 'しょぎょうむじょう', tags: ['仏教'] };
            return (
              <div className="wod-wrap" style={{ position: 'relative' }}>
                <button
                  className="mh-wod"
                  onClick={() => setWodOpen(o => !o)}
                  style={{ color: theme.inkMute, borderColor: wodOpen ? theme.accent : theme.line, cursor: 'pointer', background: 'transparent', fontFamily: theme.bodyFont }}
                  aria-expanded={wodOpen}
                >
                  <span className="wod-label">今日</span>
                  <span className="wod-text" style={{ fontFamily: theme.displayFont, color: theme.ink }}>{wod.word}</span>
                  <span style={{ fontSize: 8, opacity: .6, marginLeft: 2 }}>{wodOpen ? '▲' : '▼'}</span>
                </button>
                {wodOpen && (
                  <div className="wod-popup" style={{
                    background: theme.surface,
                    border: `1px solid ${theme.accent}55`,
                    color: theme.ink,
                    fontFamily: theme.bodyFont,
                    boxShadow: `0 6px 20px rgba(0,0,0,.35)`,
                  }}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="wod-popup-word" style={{ fontFamily: theme.displayFont }}>{wod.word}</div>
                    <div className="wod-popup-yomi" style={{ color: theme.inkMute }}>{wod.yomi}</div>
                    {wod.meaning && (
                      <div className="wod-popup-meaning" style={{ color: theme.ink, fontSize: 11, lineHeight: 1.6, marginTop: 4 }}>{wod.meaning}</div>
                    )}
                    {wod.tags && wod.tags.length > 0 && (
                      <div className="wod-popup-tags">
                        {wod.tags.map((t, i) => (
                          <span key={i} className="wod-tag" style={{ background: theme.bgDeep, color: theme.accent, border: `1px solid ${theme.accent}44` }}>{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          <button className="mh-icon" onClick={() => onOpenModal('codex')} aria-label="図鑑" style={{ color: theme.ink, borderColor: theme.line }}>図</button>
          <button className="mh-icon" onClick={() => onOpenModal('writings')} aria-label="文章" style={{ color: theme.ink, borderColor: theme.line }}>文</button>
          <button className="mh-icon" onClick={() => onOpenModal('menu')} aria-label="メニュー" style={{ color: theme.ink, borderColor: theme.line }}>
            <span className="mh-burger"><i/><i/><i/></span>
          </button>
        </div>
      </header>

      {/* ヒーロー（タイマー） */}
      <main className="mc">
        <TimerHero
          theme={theme}
          mode={mode}
          time={time}
          total={totalTime}
          paused={paused}
          progress={progress}
          leader={leader}
          cycles={cycles}
          band={band}
          onStartToggle={handleStartToggle}
          onSettings={() => onOpenModal('timer-settings')}
        />
        {interactive && caught > 0 && (
          <div className="catch-chip" style={{
            background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}`,
            fontFamily: theme.displayFont,
          }}>
            <span className="cc-label" style={{ color: theme.inkMute }}>このサイクル</span>
            <span className="cc-num" style={{ color: theme.ink }}>{caught}<small style={{ color: theme.inkMute, fontSize: 10 }}>字</small></span>
            <span className="cc-sep" style={{ background: theme.line }}/>
            <span className="cc-num" style={{ color: theme.accent }}>+{caughtXP}<small style={{ color: theme.inkDim, fontSize: 10 }}>XP</small></span>
            {lastCatch && Date.now() - lastCatch.t < 1200 && (() => {
              const lcRs = rarityStyle(lastCatch.tier, theme);
              const lcColor = lastCatch.tier >= 13 ? theme.gold
                            : lastCatch.tier >= 9  ? theme.accent2
                            : lastCatch.tier >= 5  ? theme.accent
                            : theme.glyphHue;
              return (
                <span className="cc-last" key={lastCatch.t} style={{
                  color: lcColor,
                  textShadow: lcRs.glow,
                  fontFamily: theme.displayFont,
                  fontWeight: lcRs.weight,
                  position: 'relative',
                }}>
                  {lastCatch.ch}
                  {lastCatch.tier >= 9 && (
                    <sup style={{ fontSize: 8, color: theme.inkDim, marginLeft: 1 }}>★{lastCatch.tier}</sup>
                  )}
                </span>
              );
            })()}
          </div>
        )}
      </main>

      {/* パーティ ─ 下部 */}
      <footer className="mf">
        <div className="mf-party">
          {partyData.map((slot, i) => {
            const isLocked = i > 0 && (!slot && leader && leader.lv < [3,6,10][i-1]);
            const canAdd = !slot && !isLocked && onAddPartyMember;
            return (
              <PartyCard
                key={i}
                slot={slot}
                idx={i}
                theme={theme}
                isLeader={i === 0}
                locked={isLocked}
                onAdd={canAdd ? () => onAddPartyMember(i) : null}
                onRemove={(i > 0 && slot && onRemovePartyMember) ? () => onRemovePartyMember(i) : null}
                leaderLv={leader?.lv || 0}
              />
            );
          })}
        </div>
        {!leader && (
          <button className="mf-cta"
            onClick={() => onAddPartyMember ? onAddPartyMember(0) : onOpenModal('party-picker')}
            style={{ background: theme.accent, color: theme.luminance === 'light' ? '#fff' : theme.bgDeep, fontFamily: theme.bodyFont }}>
            リーダーを選んで始める
          </button>
        )}
      </footer>
    </div>
  );
}

Object.assign(window, { MainScreen, FallingGlyphs, LiveFallingField, ThemeMotif, PartyCard, TimerHero, GLYPH_POOL, SCRIPT_STAGES, getScriptStage, getScriptStyle });
