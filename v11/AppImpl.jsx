/* AppImpl.jsx ── ぽもじかん 動く実装
   - localStorage で テーマ・パーティ・累計を永続化
   - フルスクリーンのメイン画面 + 重なるモーダル群
   - メニュードロワーから世界（テーマ）を替えられる
*/

const { useState: useStt, useEffect: useEff, useCallback: useCb, useRef: useRf } = React;

const LS_KEY = 'pomojikan_v11_impl';

const QUEST_POOL = [
  // trigger: pomo（サイクル達成）
  { id: 'q_pomo1',  trigger: 'pomo',   text: 'ポモドーロを1回完了する', icon: '🍅', target: 1,  xpReward: 30  },
  { id: 'q_pomo2',  trigger: 'pomo',   text: 'ポモドーロを2回完了する', icon: '🍅', target: 2,  xpReward: 60  },
  { id: 'q_pomo3',  trigger: 'pomo',   text: 'ポモドーロを3回完了する', icon: '🍅', target: 3,  xpReward: 90  },
  { id: 'q_pomo5',  trigger: 'pomo',   text: 'ポモドーロを5回完了する', icon: '🍅', target: 5,  xpReward: 150 },
  // trigger: catch（字を拾う）
  { id: 'q_catch5',  trigger: 'catch',  text: '字を5字拾う',            icon: '⛩', target: 5,  xpReward: 30  },
  { id: 'q_catch10', trigger: 'catch',  text: '字を10字拾う',           icon: '⛩', target: 10, xpReward: 45  },
  { id: 'q_catch15', trigger: 'catch',  text: '字を15字拾う',           icon: '⛩', target: 15, xpReward: 60  },
  { id: 'q_catch20', trigger: 'catch',  text: '字を20字拾う',           icon: '⛩', target: 20, xpReward: 80  },
  // trigger: rare（高レア字を拾う）
  { id: 'q_rare2',   trigger: 'rare',   text: '★5以上の字を2字拾う',   icon: '✦',  target: 2,  xpReward: 70  },
  { id: 'q_rare3',   trigger: 'rare',   text: '★5以上の字を3字拾う',   icon: '✦',  target: 3,  xpReward: 100 },
  { id: 'q_rare5',   trigger: 'rare',   text: '★5以上の字を5字拾う',   icon: '✦',  target: 5,  xpReward: 160 },
  // trigger: streak（連続）
  { id: 'q_streak',  trigger: 'streak', text: '今日も集中する',         icon: '🔥', target: 1,  xpReward: 30  },
  { id: 'q_streak2', trigger: 'streak', text: '連続2日、集中する',      icon: '🔥', target: 1,  xpReward: 50  },
  // trigger: write（文章モード保存）
  { id: 'q_write1',  trigger: 'write',  text: '俳句または日記を綴る',   icon: '📜', target: 1,  xpReward: 40  },
  { id: 'q_write2',  trigger: 'write',  text: '俳句または日記を3つ綴る', icon: '📜', target: 3,  xpReward: 110 },
];

// 日付シードで各トリガーから1問ずつ選択（pomo/catch/streak or rare）
// スロットごとにオフセットを変えて、難度が偏らないようにする
function makeQuests(dateStr) {
  const seed = (dateStr || new Date().toLocaleDateString('ja-JP'))
    .split('/').reduce((a, n) => a * 100 + Number(n), 0);
  const pick = (arr, offset) => arr[(seed + offset) % arr.length];
  const pomoCands  = QUEST_POOL.filter(q => q.trigger === 'pomo');
  const catchCands = QUEST_POOL.filter(q => q.trigger === 'catch');
  // rare / streak / write を3日サイクルで交替
  const r = seed % 3;
  const thirdCands = r === 0
    ? QUEST_POOL.filter(q => q.trigger === 'rare')
    : r === 1
      ? QUEST_POOL.filter(q => q.trigger === 'streak')
      : QUEST_POOL.filter(q => q.trigger === 'write');
  return [pick(pomoCands, 0), pick(catchCands, 7), pick(thirdCands, 3)]
    .map(q => ({ ...q, progress: 0, completed: false }));
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch { return {}; }
}
function saveState(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

/* ──────── フルスクリーン モーダル ──────── */
function FullModal({ theme, onClose, children }) {
  useEff(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="full-modal-bg" onClick={onClose}>
      <div className="full-modal-card" onClick={e => e.stopPropagation()}
        style={{ background: theme.bgMid, color: theme.ink, border: `1px solid ${theme.line}` }}>
        <button className="fm-close" onClick={onClose} aria-label="閉じる"
          style={{ background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}` }}>×</button>
        {children}
      </div>
    </div>
  );
}

/* ──────── メニュードロワー ──────── */
function MenuDrawer({ theme, currentTheme, onTheme, onClose, onItem, settings, onSetting }) {
  useEff(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = [
    { id: 'stats', icon: '録', label: '記録', desc: '累計・解放状況' },
    { id: 'codex', icon: '図', label: '図鑑', desc: '集めた字を眺める' },
    { id: 'writings', icon: '文', label: '文章', desc: '日記・俳句を編む' },
    { id: 'help', icon: '？', label: '遊び方' },
  ];

  return (
    <div className="drawer-bg" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}
        style={{ background: theme.bgMid, color: theme.ink, borderLeft: `1px solid ${theme.line}` }}>
        <button className="dr-close" onClick={onClose} aria-label="閉じる"
          style={{ background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}` }}>×</button>
        <h2 style={{ fontFamily: theme.displayFont, color: theme.ink, margin: '8px 0 16px' }}>メニュー</h2>

        <div className="dr-section">
          <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>世界（テーマ）</h4>
          <div className="dr-themes">
            {THEME_LIST.map(id => {
              const t = THEMES[id];
              const active = currentTheme === id;
              return (
                <button key={id} onClick={() => onTheme(id)} className={active ? 'active' : ''}
                  style={{
                    background: `linear-gradient(135deg, ${t.bgDeep}, ${t.bgLight})`,
                    color: t.ink,
                    borderColor: active ? t.accent : 'transparent',
                    fontFamily: t.displayFont,
                  }}>
                  <span className="dr-th-name">{t.name}</span>
                  <span className="dr-th-yomi" style={{ color: t.inkMute }}>{t.yomi}</span>
                  <span className="dr-th-dot" style={{ background: t.accent }}/>
                </button>
              );
            })}
          </div>
        </div>

        <div className="dr-section">
          <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>機能</h4>
          <div className="dr-items">
            {items.map(it => (
              <button key={it.id} onClick={() => onItem(it.id)} style={{
                background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}`,
              }}>
                <span className="dri-icon" style={{ background: theme.bgDeep, color: theme.accent, fontFamily: theme.displayFont }}>{it.icon}</span>
                <span className="dri-text">
                  <strong style={{ fontFamily: theme.displayFont }}>{it.label}</strong>
                  {it.desc && <small style={{ color: theme.inkMute }}>{it.desc}</small>}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="dr-section">
          <h4 style={{ color: theme.inkMute, fontFamily: theme.displayFont }}>演出</h4>
          <div className="dr-toggles">
            <label style={{ color: theme.ink }}>
              <span>モーション量</span>
              <select value={settings.motionLevel} onChange={e => onSetting('motionLevel', Number(e.target.value))}
                style={{ background: theme.surface, color: theme.ink, border: `1px solid ${theme.line}` }}>
                <option value={0}>控えめ</option>
                <option value={1}>普通</option>
                <option value={2}>豪奢</option>
              </select>
            </label>
            <label style={{ color: theme.ink }}>
              <span>今日の言葉</span>
              <input type="checkbox" checked={settings.showWordOfDay} onChange={e => onSetting('showWordOfDay', e.target.checked)} />
            </label>
            <label style={{ color: theme.ink }}>
              <span>音響</span>
              <input type="checkbox" checked={settings.audio} onChange={e => onSetting('audio', e.target.checked)} />
            </label>
          </div>
        </div>

        <div className="dr-foot" style={{ color: theme.inkDim }}>
          ぽもじかん v11 ・ 動く実装
        </div>
      </div>
    </div>
  );
}

/* ──────── 記録画面 ──────── */
function StatsScreen({ theme, stats, quests = [], inventory = {} }) {
  const streak   = stats.streak || 0;
  const today    = stats.todayCycles || 0;
  const best     = Math.max(stats.bestDay || 0, today);
  const barPct   = best > 0 ? Math.round((today / best) * 100) : 0;
  const streakEmoji = streak >= 30 ? '🔥' : streak >= 7 ? '✦' : streak >= 3 ? '◈' : '◇';

  // 収集サマリー
  const invEntries = Object.entries(inventory);
  const totalKinds = invEntries.length;
  const maxTier = invEntries.reduce((m, [, d]) => Math.max(m, d.maxTier || 0), 0);
  const topChar = invEntries.reduce((best, [ch, d]) => (!best || d.maxTier > best[1].maxTier) ? [ch, d] : best, null);
  const divineCount = invEntries.filter(([, d]) => (d.maxTier || 0) >= 13).length;

  return (
    <div className="screen" style={{ background: theme.bgMid, color: theme.ink, fontFamily: theme.bodyFont }}>
      <h2 style={{ fontFamily: theme.displayFont }}>記録</h2>

      {/* ストリーク ハイライト */}
      <div className="st-streak-card" style={{ background: theme.bgDeep, border: `1px solid ${theme.accent}44` }}>
        <div className="stsk-icon" style={{ color: theme.accent }}>{streakEmoji}</div>
        <div className="stsk-body">
          <div className="stsk-num" style={{ color: theme.accent, fontFamily: theme.displayFont }}>
            {streak}
          </div>
          <div className="stsk-label" style={{ color: theme.inkMute }}>連続稼働日</div>
        </div>
        <div className="stsk-note" style={{ color: theme.inkMute }}>
          {streak === 0 ? '今日始めよう' : streak === 1 ? '連続中！' : `${streak}日連続中`}
        </div>
      </div>

      {/* 本日 vs ベスト バー */}
      <div className="st-bar-section" style={{ background: theme.surface, border: `1px solid ${theme.line}` }}>
        <div className="stb-header">
          <span style={{ color: theme.inkMute, fontSize: 11, letterSpacing: '.12em' }}>本日のサイクル</span>
          <span style={{ color: theme.ink, fontFamily: theme.displayFont, fontSize: 22 }}>{today}</span>
        </div>
        <div className="stb-track" style={{ background: theme.bgDeep }}>
          <div className="stb-fill" style={{ width: `${barPct}%`, background: theme.accent }} />
        </div>
        <div className="stb-legend" style={{ color: theme.inkDim }}>
          <span>0</span><span>自己ベスト: {best}</span>
        </div>
      </div>

      {/* サブ stats グリッド */}
      <div className="stats-grid">
        {[
          { k: '累計サイクル', v: (stats.cycles || 0).toLocaleString() },
          { k: '累計拾い数',   v: (stats.allTimeCaught || 0).toLocaleString() },
          { k: '累計XP',      v: (stats.allTimeXP || 0).toLocaleString() },
          { k: '自己ベスト/日', v: best },
        ].map((s, i) => (
          <div key={i} className="stats-card" style={{ background: theme.surface, border: `1px solid ${theme.line}` }}>
            <div className="sc-k" style={{ color: theme.inkMute }}>{s.k}</div>
            <div className="sc-v" style={{ color: theme.ink, fontFamily: theme.displayFont }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 収集サマリー */}
      {totalKinds > 0 && (
        <div className="stats-collect" style={{ background: theme.surface, border: `1px solid ${theme.line}`, borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: '.1em', color: theme.inkMute, marginBottom: 8, fontFamily: theme.displayFont }}>字コレクション</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: theme.displayFont, fontSize: 22, color: theme.ink }}>{totalKinds}</div>
              <div style={{ fontSize: 10, color: theme.inkMute }}>種類</div>
            </div>
            {topChar && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: theme.displayFont, fontSize: 28, color: theme.accent, textShadow: maxTier >= 13 ? `0 0 12px ${theme.glyphGlow}` : 'none' }}>{topChar[0]}</div>
                <div style={{ fontSize: 10, color: theme.inkMute }}>最高ティア ★{maxTier}</div>
              </div>
            )}
            {divineCount > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: theme.displayFont, fontSize: 22, color: theme.gold }}>{divineCount}</div>
                <div style={{ fontSize: 10, color: theme.inkMute }}>神域字</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* デイリークエスト */}
      {quests.length > 0 && (
        <div className="dq-panel" style={{ background: theme.surface, border: `1px solid ${theme.line}` }}>
          <div className="dq-header">
            <span style={{ fontFamily: theme.displayFont, color: theme.ink, fontSize: 13, letterSpacing: '.1em' }}>デイリークエスト</span>
            <span style={{ color: theme.inkMute, fontSize: 11 }}>
              {quests.filter(q => q.completed).length}/{quests.length}
            </span>
          </div>
          {/* 進捗バー */}
          <div className="dq-total-bar" style={{ background: theme.bgDeep }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${Math.round(quests.filter(q => q.completed).length / quests.length * 100)}%`,
              background: quests.every(q => q.completed) ? theme.gold : theme.accent,
              transition: 'width .4s',
            }} />
          </div>
          <ul className="dq-list">
            {quests.map(q => (
              <li key={q.id} className={`dq-item ${q.completed ? 'done' : ''}`}
                style={{
                  background: q.completed ? theme.accent + '12' : 'transparent',
                  borderColor: q.completed ? theme.accent + '44' : theme.line,
                }}>
                <span className="dqi-icon">{q.icon}</span>
                <span className="dqi-text" style={{ color: q.completed ? theme.inkMute : theme.ink }}>
                  {q.text}
                </span>
                <span className="dqi-prog" style={{ color: theme.inkMute, fontSize: 10 }}>
                  {Math.min(q.progress, q.target)}/{q.target}
                </span>
                {q.completed
                  ? <span className="dqi-done" style={{ color: theme.accent }}>✓</span>
                  : <span className="dqi-xp" style={{ color: theme.gold, fontSize: 10 }}>+{q.xpReward}XP</span>
                }
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ color: theme.inkMute, fontSize: 11, marginTop: 12, lineHeight: 1.7 }}>
        データは <code style={{ background: theme.bgDeep, padding: '1px 6px', borderRadius: 4, color: theme.accent }}>localStorage</code> に保存されています。
      </p>
    </div>
  );
}

const CYCLE_MILESTONES = new Set([10, 25, 50, 100, 250, 500, 1000]);

/* ──────── ルートアプリ ──────── */
function PomojikanApp() {
  const saved = loadState();
  const [themeId, setThemeId] = useStt(saved.theme || 'yoruame');
  const [party, setParty] = useStt(saved.party || null);
  const [stats, setStats] = useStt(saved.stats || {
    cycles: 0, todayCycles: 0, allTimeCaught: 0, allTimeXP: 0,
    streak: 0, bestDay: 0, lastActiveDate: '',
  });
  const [settings, setSettings] = useStt(saved.settings || {
    motionLevel: 1, showWordOfDay: true, audio: true,
  });
  const [timerConfig, setTimerConfig] = useStt(saved.timerConfig || { work: 25, rest: 5, sets: 0 });
  // inventory: { [ch]: { count, maxTier, firstCaught } }
  const [inventory, setInventory] = useStt(saved.inventory || {});
  const [modal, setModal] = useStt(null);
  const [drawer, setDrawer] = useStt(false);
  const [lvUpEvent, setLvUpEvent] = useStt(null); // 書体進化通知
  const [milestoneEvent, setMilestoneEvent] = useStt(null); // サイクル達成通知
  const [newCatchEvent, setNewCatchEvent] = useStt(null); // 初拾い通知
  const partyRef = useRf(null);          // handleCatch 内で最新 party を参照
  const inventoryRef = useRf({});       // handleCatch 内で最新 inventory を参照
  const settingsRef = useRf(settings);  // handleCatch 内で最新 settings を参照
  const partyPickerSlotRef = useRf(0);   // どの枠にキャラを追加するか
  const prevCyclesRef = useRf(stats.cycles || 0);

  // デイリークエスト（日付をまたいだらリセット）
  const todayStr = new Date().toLocaleDateString('ja-JP');
  const [quests, setQuests] = useStt(() => {
    const s = loadState();
    return (s.questDate === todayStr && s.quests) ? s.quests : makeQuests(todayStr);
  });

  const theme = THEMES[themeId] || THEMES.yoruame;

  // 永続化
  useEff(() => {
    saveState({ theme: themeId, party, stats, settings, timerConfig, inventory, quests, questDate: todayStr });
  }, [themeId, party, stats, settings, timerConfig, inventory, quests]);

  // 起動時に日付が変わっていたら todayCycles をリセット
  useEff(() => {
    const today = new Date().toLocaleDateString('ja-JP');
    setStats(s => {
      if (s.lastActiveDate && s.lastActiveDate !== today) {
        return { ...s, todayCycles: 0 };
      }
      return s;
    });
  }, []);

  // テーマで body 背景を一致させる（モーダル背後の隙間防止）
  useEff(() => {
    document.body.style.background = `linear-gradient(180deg, ${theme.bgDeep} 0%, ${theme.bgMid} 60%, ${theme.bgLight} 100%)`;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.chrome;
  }, [theme]);

  // partyRef / inventoryRef / settingsRef を最新値に追従させる
  useEff(() => { partyRef.current = party; }, [party]);
  useEff(() => { inventoryRef.current = inventory; }, [inventory]);
  useEff(() => { settingsRef.current = settings; }, [settings]);

  // サイクルマイルストーン検知
  useEff(() => {
    const current = stats.cycles || 0;
    const prev = prevCyclesRef.current;
    if (current > prev && CYCLE_MILESTONES.has(current)) {
      setMilestoneEvent({ cycles: current });
      if (settings.audio && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playMilestone();
      setTimeout(() => setMilestoneEvent(null), 3500);
    }
    prevCyclesRef.current = current;
  }, [stats.cycles]);

  const setSetting = (k, v) => setSettings(s => ({ ...s, [k]: v }));

  const handleOpenModal = (m) => {
    if (m === 'menu') setDrawer(true);
    else setModal(m);
  };

  const handlePartyConfirm = (ch) => {
    const slot = partyPickerSlotRef.current;
    setParty(p => {
      const base = p ? [...p] : [null, null, null, null];
      base[slot] = { ch, tier: 1, lv: 1, exp: 0 };
      return base;
    });
    setModal(null);
  };

  // 空き枠タップ → 対象スロットを記憶してピッカーを開く
  const handleAddPartyMember = (slotIdx) => {
    partyPickerSlotRef.current = slotIdx;
    setModal('party-picker');
  };

  // サブメンバー削除（リーダー枠0は削除不可）
  const handleRemovePartyMember = (slotIdx) => {
    if (slotIdx === 0) return;
    setParty(p => {
      if (!p) return p;
      const np = [...p];
      np[slotIdx] = null;
      return np;
    });
  };

  // クエスト進捗を1つ進め、達成時にリーダーへXP付与（handleCycleComplete より先に宣言）
  const progressQuest = useCb((trigger) => {
    setQuests(qs => {
      const next = qs.map(q => {
        if (q.trigger !== trigger || q.completed) return q;
        const newProg = (q.progress || 0) + 1;
        const nowDone = newProg >= q.target;
        if (nowDone) {
          if (typeof PomojikanAudio !== 'undefined') PomojikanAudio.playQuestComplete();
          setParty(p => {
            if (!p || !p[0]) return p;
            const applyXp = (m, gain) => {
              const out = { ...m, exp: (m.exp || 0) + gain };
              while (out.exp >= xpToNextLevel(out.lv || 1)) {
                out.exp -= xpToNextLevel(out.lv || 1);
                out.lv = (out.lv || 1) + 1;
              }
              return out;
            };
            const np = [...p];
            np[0] = applyXp(np[0], q.xpReward);
            return np;
          });
        }
        return { ...q, progress: newProg, completed: nowDone };
      });
      return next;
    });
  }, []);

  const handleCycleComplete = useCb(() => {
    const today = new Date().toLocaleDateString('ja-JP');
    setStats(s => {
      const isNewDay = s.lastActiveDate !== today;
      const isYesterday = (() => {
        if (!s.lastActiveDate) return false;
        const last = new Date(s.lastActiveDate);
        const diff = (new Date(today) - last) / 86400000;
        return Math.round(diff) === 1;
      })();

      const newTodayCycles = isNewDay ? 1 : (s.todayCycles || 0) + 1;
      const newStreak = isNewDay
        ? (isYesterday ? (s.streak || 0) + 1 : 1)
        : (s.streak || 1);
      const newCycles = (s.cycles || 0) + 1;

      return {
        ...s,
        cycles: newCycles,
        todayCycles: newTodayCycles,
        streak: newStreak,
        bestDay: Math.max(s.bestDay || 0, newTodayCycles),
        lastActiveDate: today,
      };
    });
    progressQuest('pomo');
    progressQuest('streak');
  }, [progressQuest]);

  // 書体進化ステージ境界（MainScreen.jsx の SCRIPT_STAGES と一致）
  const STAGE_MAP = { 10: '行書', 30: '草書', 70: '篆書', 150: '甲骨' };

  const handleCatch = useCb((info) => {
    // 初拾いチェック（inventoryRef で最新インベントリを参照）
    const isFirstCatch = !inventoryRef.current[info.ch];
    if (isFirstCatch && info.tier >= 5) {
      setNewCatchEvent({ ch: info.ch, tier: info.tier });
      setTimeout(() => setNewCatchEvent(null), 2500);
    }

    // 書体進化チェック（partyRef で最新 party を参照）
    const cur = partyRef.current;
    if (cur && cur[0]) {
      const leader = cur[0];
      const prevLv = leader.lv || 1;
      let simExp = (leader.exp || 0) + info.xp;
      let simLv = prevLv;
      while (simExp >= xpToNextLevel(simLv)) { simExp -= xpToNextLevel(simLv); simLv++; }
      if (simLv > prevLv) {
        const crossed = Object.keys(STAGE_MAP)
          .map(Number)
          .filter(threshold => prevLv < threshold && simLv >= threshold);
        if (crossed.length > 0) {
          const stageName = STAGE_MAP[crossed[0]];
          setLvUpEvent({ ch: leader.ch, newLv: simLv, stage: stageName });
          if (settingsRef.current.audio && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playEvolution();
          setTimeout(() => setLvUpEvent(null), 3500);
        } else {
          if (settingsRef.current.audio && typeof PomojikanAudio !== 'undefined') PomojikanAudio.playLevelUp();
        }
      }
    }

    setStats(s => ({
      ...s,
      allTimeCaught: (s.allTimeCaught || 0) + 1,
      allTimeXP: (s.allTimeXP || 0) + info.xp,
    }));
    // クエスト: 字を拾う
    progressQuest('catch');
    if (info.tier >= 5) progressQuest('rare');
    // インベントリ更新
    setInventory(inv => {
      const today = new Date().toLocaleDateString('ja-JP');
      const prev = inv[info.ch] || { count: 0, maxTier: 0, firstCaught: today };
      return {
        ...inv,
        [info.ch]: {
          count: prev.count + 1,
          maxTier: Math.max(prev.maxTier, info.tier),
          firstCaught: prev.firstCaught,
          lastCaught: today,
        },
      };
    });
    // パーティ全員にEXPを加算（リーダー100% / サブ60%）
    const applyXpGain = (m, gain) => {
      const out = { ...m };
      out.exp = (out.exp || 0) + gain;
      while (out.exp >= xpToNextLevel(out.lv || 1)) {
        out.exp -= xpToNextLevel(out.lv || 1);
        out.lv = (out.lv || 1) + 1;
        if      (out.lv >= 220) out.tier = 16;
        else if (out.lv >= 180) out.tier = 15;
        else if (out.lv >= 145) out.tier = 14;
        else if (out.lv >= 115) out.tier = 13;
        else if (out.lv >= 90)  out.tier = 12;
        else if (out.lv >= 70)  out.tier = 11;
        else if (out.lv >= 55)  out.tier = 10;
        else if (out.lv >= 42)  out.tier = 9;
        else if (out.lv >= 32)  out.tier = 8;
        else if (out.lv >= 24)  out.tier = 7;
        else if (out.lv >= 18)  out.tier = 6;
        else if (out.lv >= 14)  out.tier = 5;
        else if (out.lv >= 10)  out.tier = 4;
        else if (out.lv >= 6)   out.tier = 3;
        else if (out.lv >= 3)   out.tier = 2;
        else                    out.tier = 1;
      }
      return out;
    };
    setParty(p => {
      if (!p) return p;
      const np = [...p];
      if (np[0]) np[0] = applyXpGain(np[0], info.xp);
      const subXp = Math.max(1, Math.round(info.xp * 0.6));
      for (let i = 1; i <= 3; i++) {
        if (np[i]) np[i] = applyXpGain(np[i], subXp);
      }
      return np;
    });
  }, []);

  return (
    <div className="impl-root" onPointerDown={() => {
      if (typeof PomojikanAudio !== 'undefined') PomojikanAudio.unlock();
    }}>

      {/* マイルストーントースト */}
      {milestoneEvent && (
        <div className="milestone-toast" style={{
          background: theme.bgDeep,
          border: `1px solid ${theme.gold}`,
          color: theme.ink,
          boxShadow: `0 0 20px ${theme.gold}44, 0 4px 20px rgba(0,0,0,.4)`,
        }}>
          <span className="ms-icon" style={{ color: theme.gold }}>✦</span>
          <div className="ms-text">
            <div className="ms-num" style={{ color: theme.gold, fontFamily: theme.displayFont }}>{milestoneEvent.cycles}サイクル</div>
            <div className="ms-label" style={{ color: theme.inkMute }}>達成！</div>
          </div>
        </div>
      )}

      {/* 書体進化トースト */}
      {lvUpEvent && (
        <div className="lvup-toast" style={{
          background: theme.surface,
          border: `1px solid ${theme.accent}`,
          color: theme.ink,
          boxShadow: `0 0 24px ${theme.glyphGlow}, 0 4px 20px rgba(0,0,0,.4)`,
        }}>
          <span className="lvup-glyph" style={{
            fontFamily: theme.displayFont,
            color: theme.glyphHue,
            textShadow: `0 0 12px ${theme.glyphGlow}`,
          }}>{lvUpEvent.ch}</span>
          <div className="lvup-text">
            <div className="lvup-stage" style={{ color: theme.accent, fontFamily: theme.displayFont }}>{lvUpEvent.stage} に進化</div>
            <div className="lvup-lv" style={{ color: theme.inkMute }}>Lv {lvUpEvent.newLv} 到達</div>
          </div>
        </div>
      )}

      {/* 初拾いトースト (★5以上の新字) */}
      {newCatchEvent && (
        <div className="newcatch-toast" style={{
          background: theme.bgDeep,
          border: `1px solid ${newCatchEvent.tier >= 12 ? theme.gold : theme.accent}`,
          color: theme.ink,
          boxShadow: `0 0 18px ${theme.glyphGlow}, 0 4px 16px rgba(0,0,0,.4)`,
        }}>
          <span className="nc-glyph" style={{
            fontFamily: theme.displayFont,
            color: newCatchEvent.tier >= 12 ? theme.gold : theme.accent2,
            textShadow: `0 0 10px ${theme.glyphGlow}`,
          }}>{newCatchEvent.ch}</span>
          <div className="nc-text">
            <div className="nc-title" style={{ color: newCatchEvent.tier >= 12 ? theme.gold : theme.accent, fontFamily: theme.displayFont }}>初拾い！</div>
            <div className="nc-tier" style={{ color: theme.inkMute }}>★{newCatchEvent.tier} 新しい字</div>
          </div>
        </div>
      )}

      <MainScreen
        theme={theme}
        interactive={true}
        initialMode="idle"
        motionLevel={settings.motionLevel}
        showWordOfDay={settings.showWordOfDay}
        party={party}
        cycles={stats.todayCycles}
        workSec={timerConfig.work * 60}
        restSec={timerConfig.rest * 60}
        audioEnabled={settings.audio}
        onOpenModal={handleOpenModal}
        onCatch={handleCatch}
        onCycleComplete={handleCycleComplete}
        onAddPartyMember={handleAddPartyMember}
        onRemovePartyMember={handleRemovePartyMember}
      />

      {drawer && (
        <MenuDrawer
          theme={theme}
          currentTheme={themeId}
          onTheme={(id) => { setThemeId(id); }}
          onClose={() => setDrawer(false)}
          onItem={(id) => { setDrawer(false); setModal(id); }}
          settings={settings}
          onSetting={setSetting}
        />
      )}

      {modal && (
        <FullModal theme={theme} onClose={() => setModal(null)}>
          {modal === 'codex' && <CodexScreen theme={theme} inventory={inventory} leaderLv={(party && party[0] && party[0].lv) || 1} />}
          {modal === 'help' && <HelpScreen theme={theme} />}
          {modal === 'party-picker' && <PartyPickerScreen theme={theme} onConfirm={handlePartyConfirm} />}
          {modal === 'writings' && <WritingsScreen theme={theme} inventory={inventory} audioEnabled={settings.audio} leaderLv={(party && party[0] && party[0].lv) || 1} onWriteSave={() => progressQuest('write')} />}
          {modal === 'stats' && <StatsScreen theme={theme} stats={stats} quests={quests} inventory={inventory} />}
          {modal === 'timer-settings' && (
            <TimerSettingsScreen
              theme={theme}
              currentWork={timerConfig.work}
              currentRest={timerConfig.rest}
              onApply={(cfg) => setTimerConfig(c => ({ ...c, ...cfg }))}
              onClose={() => setModal(null)}
            />
          )}
        </FullModal>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PomojikanApp />);
