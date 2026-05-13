'use strict';
// ぽもじかん v29 ── 文字育成ポモドーロ
// 2026-05-12 / 全面リライト

// ═══════════════════════════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════════════════════════
const LS_KEY = 'pomojikan_v30';
const RARITY_TIERS = ['★1','★2','★3','★4','★5','★6'];
const UNLOCK_LV    = { '★1':1, '★2':5, '★3':15, '★4':30, '★5':60, '★6':100 };
const TIER_ACHIEVEMENT = [
  '始まりの字',     // ★1
  '鍛錬の刻',       // ★2
  '才の覚醒',       // ★3
  '達者の道',       // ★4
  '段位入り',       // ★5
  '七徳七大罪の領域', // ★6
];
// レアごとの落下数（少ないほど希少感）
const TIER_DROP_COUNT = [
  [8,12], [6,10], [5,8], [4,6], [3,5], [2,4]
];
// レアごとの落下速度倍率（高レアほどゆっくり、ドラマを作る）
const TIER_FALL_MUL = [1.0, 0.92, 0.84, 0.76, 0.68, 0.6];

const EVO_STAGE_LV = [10, 30, 70];          // Stage 1 / 2 / 3 の Lv 閾値
const EVO_GLYPH = ['', '✦', '✧', '☀'];      // 進化マーカー
const EVO_STYLE = ['kai', 'gyo', 'sou', 'sou'];  // 楷／行／草／（最上位も草で十分）

const TIMER_PRESETS = [
  { label:'25/5', work:25*60, rest:5*60 },
  { label:'50/10', work:50*60, rest:10*60 },
  { label:'15/3', work:15*60, rest:3*60 },
];
const PARTY_PICKER_POOL_SIZE = 24;
const GRAVITY_BASE = 0.35;
const SIZE_BASE = 44;

// ═══════════════════════════════════════════════════════════════
// PERK SYSTEM ── ヴァンパイアサバイバー方式
// ═══════════════════════════════════════════════════════════════
const PERKS = {
  // 基本ステータス系
  haste:       { name:'急降下',  desc:'落下速度 +30%',                       },
  feather:     { name:'ふわふわ',desc:'落下速度 -30% / 合体判定 +25%',        },
  wide:        { name:'求心',    desc:'合体判定範囲 +40%',                    },
  bounty:      { name:'豊穣',    desc:'落下数 +2粒/サイクル',                 },
  scholar:     { name:'積み重ね',desc:'EXP獲得 +30%',                         },
  prodigy:     { name:'神童',    desc:'進化Lv閾値 -25%',                      },
  magnet:      { name:'磁字',    desc:'着地時に近くの同字を引き寄せ',        },
  chain:       { name:'連鎖',    desc:'3字以上同字融合で大爆発（全員Lv+1）', },
  blessing:    { name:'祝詞',    desc:'5サイクル毎に上位レア1粒スポーン',    },
  guardian:    { name:'守護',    desc:'主人公が消滅しない（既存）+ XP分配20%',},
  // タグ系（固有特性）
  tag_virtue:  { name:'七徳の徳',desc:'七徳熟語成立時 全員XP+50%（永続バフ）', tag:'七徳'  },
  tag_sin:     { name:'七大罪の業',desc:'七大罪字は落下時に+1粒派生',          tag:'七大罪'},
  tag_emo:     { name:'感応',    desc:'感情字を融合時 XP+100%',                tag:'感情'  },
  tag_time:    { name:'時の継',  desc:'時字を融合時 サイクル時間-10秒',        tag:'時'    },
  tag_zen:     { name:'禅静',    desc:'禅字を持つと休憩中の上昇泡が2倍',       tag:'禅'    },
  tag_sacred:  { name:'神威',    desc:'神字を融合時 ★6 解放を 10Lv 早める',    tag:'神字'  },
  tag_war:     { name:'闘気',    desc:'武字を融合時 連鎖判定+1字',             tag:'武'    },
  tag_learn:   { name:'求道',    desc:'学字を融合時 EXP+75%',                 tag:'学'    },
  tag_nature:  { name:'自然律',  desc:'自然字を融合時 落下数+1',              tag:'自然'  },
  tag_beauty:  { name:'幽美',    desc:'美字を融合時 書体即時進化',            tag:'美'    },
};

// タグ → 固有 perk の対応
const TAG_PERK_MAP = {
  '七徳':'tag_virtue', '七大罪':'tag_sin', '感情':'tag_emo', '時':'tag_time',
  '禅':'tag_zen', '神字':'tag_sacred', '武':'tag_war', '学':'tag_learn',
  '自然':'tag_nature', '植物':'tag_nature', '美':'tag_beauty', '宗教':'tag_sacred',
  '仏教':'tag_zen', '思想':'tag_learn', '哲学':'tag_learn', '道':'tag_war',
};

// 各キャラのタグを YOJI_RECIPES から逆引き
let CHAR_TAGS = null;
function buildCharTagsIndex() {
  if (CHAR_TAGS) return CHAR_TAGS;
  CHAR_TAGS = {};
  const recipes = window.YOJI_RECIPES || [];
  for (const r of recipes) {
    for (const c of (r.chars || [])) {
      if (!CHAR_TAGS[c]) CHAR_TAGS[c] = new Set();
      for (const t of (r.tags || [])) CHAR_TAGS[c].add(t);
    }
  }
  return CHAR_TAGS;
}

function getCharTags(c) {
  const idx = buildCharTagsIndex();
  return Array.from(idx[c] || []);
}

function pickInherentPerk(c) {
  // この字に主タグからの固有 perk を割り当て
  const tags = getCharTags(c);
  for (const t of tags) {
    if (TAG_PERK_MAP[t]) return TAG_PERK_MAP[t];
  }
  // タグなし／対応なし → ランダムに基本 perk 1個
  const basic = ['haste','feather','wide','bounty','scholar','magnet'];
  return basic[Math.floor(Math.random() * basic.length)];
}

// パーティ全体の perk 集約（同 perk 重複時は両方有効＝積み）
function aggregatePartyPerks() {
  if (!STATE.party) return {};
  const agg = {
    gravityMul:    1.0,
    mergeRadiusMul:1.0,
    dropCountAdd:  0,
    expMul:        1.0,
    evoDiscount:   0,
    tagBonus:      {},      // tag -> mul
    magnet:        false,
    chain:         false,
    blessing:      0,       // every N cycles
    instantEvoOn:  [],      // list of tags
  };
  for (const m of STATE.party.members) {
    for (const pid of (m.perks || [])) {
      const p = PERKS[pid]; if (!p) continue;
      switch (pid) {
        case 'haste':    agg.gravityMul *= 1.3; break;
        case 'feather':  agg.gravityMul *= 0.7; agg.mergeRadiusMul *= 1.25; break;
        case 'wide':     agg.mergeRadiusMul *= 1.4; break;
        case 'bounty':   agg.dropCountAdd += 2; break;
        case 'scholar':  agg.expMul *= 1.3; break;
        case 'prodigy':  agg.evoDiscount += 0.25; break;
        case 'magnet':   agg.magnet = true; break;
        case 'chain':    agg.chain = true; break;
        case 'blessing': agg.blessing = 5; break;
        case 'guardian': /* 既存仕様 */ break;
        case 'tag_emo':    agg.tagBonus['感情'] = (agg.tagBonus['感情']||1) + 1.0; break;
        case 'tag_learn':  agg.tagBonus['学']   = (agg.tagBonus['学']||1) + 0.75; break;
        case 'tag_nature': agg.dropCountAdd += 1; break;
        case 'tag_war':    agg.tagBonus['武']   = (agg.tagBonus['武']||1) + 0.5; break;
        case 'tag_sin':    agg.dropCountAdd += 1; break;
        case 'tag_zen':    agg.tagBonus['禅']   = (agg.tagBonus['禅']||1) + 0.5; break;
        case 'tag_beauty': agg.instantEvoOn.push('美'); break;
        case 'tag_sacred': agg.tagBonus['神字'] = (agg.tagBonus['神字']||1) + 0.5; break;
        case 'tag_time':   agg.tagBonus['時']   = (agg.tagBonus['時']||1) + 0.3; break;
        case 'tag_virtue': agg.tagBonus['七徳'] = (agg.tagBonus['七徳']||1) + 0.5; break;
      }
    }
  }
  return agg;
}

// EXP 関数
const expForLevel = (lv) => Math.floor(10 * Math.pow(lv, 1.6));
const evolutionStage = (lv) => {
  if (lv >= EVO_STAGE_LV[2]) return 3;
  if (lv >= EVO_STAGE_LV[1]) return 2;
  if (lv >= EVO_STAGE_LV[0]) return 1;
  return 0;
};

// ═══════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════
const DEFAULT_STATE = {
  version: 'v30',
  party: null,                    // { hero: 0, members: [{char,rarity,level,exp,perks:[]},...] }
  unlockedTier: 0,                // index into RARITY_TIERS
  timer: { workSec: 25*60, restSec: 5*60, presetIdx: 0 },
  mode: 'idle',                   // idle | work | rest | paused
  phaseStart: 0,                  // ms timestamp
  phaseEnd: 0,                    // ms timestamp
  pausedRemaining: 0,             // ms when paused
  cycles: 0,
  collection: {},                 // char -> times seen
  stats: { totalDrops:0, totalCycles:0, totalExp:0 },
  lastHiddenAt: null,             // for background-aware drops
  permanentBuffs: [],             // 永続バフのリスト
};

let STATE = JSON.parse(JSON.stringify(DEFAULT_STATE));

function loadState() {
  try {
    let raw = localStorage.getItem(LS_KEY);
    // v29 → v30 マイグレーション
    if (!raw) {
      const oldRaw = localStorage.getItem('pomojikan_v29');
      if (oldRaw) {
        try {
          const old = JSON.parse(oldRaw);
          // パーティ字のレア名を旧→新に変換
          const oldToNew = { '拾級':'★1','五級':'★2','三級':'★3','一級':'★4','初段':'★5','拾段':'★6' };
          if (old.party && old.party.members) {
            old.party.members.forEach(m => {
              if (oldToNew[m.rarity]) m.rarity = oldToNew[m.rarity];
              if (!m.perks) m.perks = ['scholar'];
            });
          }
          old.version = 'v30';
          localStorage.setItem(LS_KEY, JSON.stringify(old));
          raw = JSON.stringify(old);
        } catch(_) {}
      }
    }
    if (raw) {
      const saved = JSON.parse(raw);
      STATE = Object.assign({}, DEFAULT_STATE, saved);
      // ensure nested defaults
      STATE.timer = Object.assign({}, DEFAULT_STATE.timer, saved.timer||{});
      STATE.stats = Object.assign({}, DEFAULT_STATE.stats, saved.stats||{});
      STATE.collection = saved.collection || {};
    }
  } catch (e) { console.warn('loadState failed:', e); }
}

function saveState() {
  // プレビューモード中は永続化しない（他人のパーティを試している間は自分のデータを守る）
  if (_previewMode) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }
  catch (e) { console.warn('saveState failed:', e); }
}

function resetState() {
  if (!confirm('全データを消去して最初から始めますか？')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ═══════════════════════════════════════════════════════════════
// 全画面背景：雨（作業中）／ 泡（休憩中）
// ═══════════════════════════════════════════════════════════════
function buildBackgroundLayers() {
  const rain = $('#rain-bg');
  const bub  = $('#bubble-bg');
  if (rain && !rain.children.length) {
    const N = 60;
    for (let i = 0; i < N; i++) {
      const d = document.createElement('div');
      d.className = 'rd';
      d.style.left = (Math.random() * 100) + 'vw';
      d.style.animationDuration = (0.9 + Math.random() * 1.4) + 's';
      d.style.animationDelay = (-Math.random() * 2) + 's';
      d.style.opacity = (0.3 + Math.random() * 0.5).toFixed(2);
      rain.appendChild(d);
    }
  }
  if (bub && !bub.children.length) {
    const N = 28;
    for (let i = 0; i < N; i++) {
      const b = document.createElement('div');
      b.className = 'bb';
      const size = 6 + Math.random() * 14;
      b.style.left = (Math.random() * 100) + 'vw';
      b.style.width = size + 'px';
      b.style.height = size + 'px';
      b.style.animationDuration = (5 + Math.random() * 5) + 's';
      b.style.animationDelay = (-Math.random() * 6) + 's';
      bub.appendChild(b);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// パーティ共有（UGC 軽実装・Roblox 反省を踏まえた最小機能）
// ── ランキングなし・競争なし・匿名匿名で他者参照のみ
// ═══════════════════════════════════════════════════════════════
let _previewMode = false;  // 共有 URL 経由でロード中のフラグ
let _ownPartyCache = null; // 自分のパーティ退避

function encodePartyToShare() {
  if (!STATE.party) return '';
  // 最小形：hero index + 各メンバー [char, level, perks]
  const min = {
    h: STATE.party.hero,
    m: STATE.party.members.map(m => [m.char, m.level, m.perks || []])
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(min))));
  } catch (e) { return ''; }
}

function decodePartyShare(b64) {
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.m) || data.m.length !== 4) return null;
    const codex = window.KANJI_CODEX || [];
    const members = data.m.map(([char, level, perks]) => {
      const k = codex.find(x => (x.char || x.c) === char);
      return {
        char, level: level || 1, exp: 0,
        rarity: k?.rarity || '★1',
        perks: Array.isArray(perks) ? perks : ['scholar']
      };
    });
    return { hero: typeof data.h === 'number' ? data.h : 0, members };
  } catch (e) { return null; }
}

function buildShareURL() {
  const code = encodePartyToShare();
  if (!code) return '';
  const base = location.origin + location.pathname;
  return base + '?p=' + code;
}

function checkSharedPartyOnBoot() {
  const params = new URLSearchParams(location.search);
  const code = params.get('p');
  if (!code) return;
  const party = decodePartyShare(code);
  if (!party) return;
  // 自分のパーティを退避
  _ownPartyCache = STATE.party ? JSON.parse(JSON.stringify(STATE.party)) : null;
  _previewMode = true;
  STATE.party = party;
  showPreviewBanner();
  // URL は綺麗にする（リロード時に preview を継続しないよう）
  history.replaceState({}, '', location.pathname);
}

function showPreviewBanner() {
  if ($('#preview-banner')) return;
  const banner = el('div', { id:'preview-banner', class:'preview-banner' },
    el('span', { class:'pb-text' }, '👀 共有パーティを体験中（保存されません）'),
    el('button', { class:'pb-back', onclick: exitPreviewMode }, '自分のに戻る')
  );
  document.body.insertBefore(banner, document.body.firstChild);
}

function exitPreviewMode() {
  if (!_previewMode) return;
  STATE.party = _ownPartyCache;
  _ownPartyCache = null;
  _previewMode = false;
  $('#preview-banner')?.remove();
  renderParty();
  updateProgressPill();
}

async function copyShareURL() {
  const url = buildShareURL();
  if (!url) { toast('先にパーティを編成してください'); return; }
  try {
    await navigator.clipboard.writeText(url);
    toast('共有 URL をコピーしました');
  } catch (e) {
    prompt('共有 URL をコピーしてください', url);
  }
}

// ═══════════════════════════════════════════════════════════════
// ユーティリティ
// ═══════════════════════════════════════════════════════════════
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const el = (tag, props={}, ...children) => {
  const e = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') e.className = props[k];
    else if (k === 'style') Object.assign(e.style, props[k]);
    else if (k === 'dataset') Object.assign(e.dataset, props[k]);
    else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
    else if (k === 'html') e.innerHTML = props[k];
    else e.setAttribute(k, props[k]);
  }
  for (const c of children) {
    if (c == null) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
};
const fmtTime = (sec) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
};
const choose = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weightedChoose = (items, weights) => {
  const total = weights.reduce((s,w) => s+w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length-1];
};

// ═══════════════════════════════════════════════════════════════
// パーティ ロジック
// ═══════════════════════════════════════════════════════════════
function partyAverageLevel() {
  if (!STATE.party || !STATE.party.members.length) return 0;
  return STATE.party.members.reduce((s,m) => s + m.level, 0) / STATE.party.members.length;
}

function currentDropTier() {
  const avg = partyAverageLevel();
  let band = 0;
  for (let i = 0; i < RARITY_TIERS.length; i++) {
    if (avg >= UNLOCK_LV[RARITY_TIERS[i]]) band = i;
  }
  return band;
}

function updateUnlockTier() {
  const newTier = currentDropTier();
  const oldTier = STATE.unlockedTier;
  STATE.unlockedTier = newTier;
  // Band-up: 実績解除トースト
  if (newTier > oldTier) {
    const tierName = RARITY_TIERS[newTier];
    const achName = TIER_ACHIEVEMENT[newTier];
    setTimeout(() => {
      toast(`✦ 実績解除：「${achName}」  ${tierName} が降ります`, tierName);
      flashCompletionBurst(`✦ ${achName} ✦`);
    }, 400);
  }
}

function partyContainsChar(c) {
  if (!STATE.party) return -1;
  return STATE.party.members.findIndex(m => m.char === c);
}

function isPartyChosen() {
  return STATE.party && STATE.party.members && STATE.party.members.length === 4 && STATE.party.hero !== null;
}

function awardExpToParty(c, exp, opts={}) {
  const idx = partyContainsChar(c);
  if (idx < 0) return false;
  const agg = aggregatePartyPerks();
  // 基本倍率
  let mul = agg.expMul || 1.0;
  // タグアフィニティ：opts.tagMatch があれば追加倍率
  if (opts.tagMatch) {
    // 同タグ融合は +50%
    mul *= 1.5;
  }
  // perk タグボーナス
  const tags = getCharTags(c);
  for (const t of tags) {
    if (agg.tagBonus[t]) mul *= agg.tagBonus[t];
  }
  const actualExp = Math.floor(exp * mul);
  const m = STATE.party.members[idx];
  m.exp += actualExp;
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + actualExp;
  // guardian perk: 主人公以外で受け取った XP の 20% を主人公にも分配
  if (idx !== STATE.party.hero && STATE.party.members[STATE.party.hero].perks?.includes('guardian')) {
    const heroBonus = Math.floor(actualExp * 0.2);
    if (heroBonus > 0) {
      const hero = STATE.party.members[STATE.party.hero];
      hero.exp += heroBonus;
      while (hero.exp >= expForLevel(hero.level + 1)) {
        hero.exp -= expForLevel(hero.level + 1);
        hero.level += 1;
        onLevelUp(hero, STATE.party.hero);
      }
    }
  }
  while (m.exp >= expForLevel(m.level + 1)) {
    m.exp -= expForLevel(m.level + 1);
    m.level += 1;
    onLevelUp(m, idx);
  }
  return true;
}

function onLevelUp(member, idx) {
  toast(`${member.char} → Lv.${member.level}`, member.rarity);
  updateUnlockTier();
  renderParty();
  updateProgressPill();
  // Flash the leveled card
  const card = document.querySelector(`.party-card[data-idx="${idx}"]`);
  if (card) {
    card.classList.add('levelup-flash');
    setTimeout(() => card.classList.remove('levelup-flash'), 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// パーティ選択モーダル
// ═══════════════════════════════════════════════════════════════
function openPartyPicker() {
  if (!window.KANJI_CODEX) {
    setTimeout(openPartyPicker, 200);
    return;
  }
  const pool = window.KANJI_CODEX
    .filter(k => k.rarity === '★1')
    .sort(() => Math.random() - 0.5)
    .slice(0, PARTY_PICKER_POOL_SIZE);

  const picked = new Set();   // chars
  let hero = null;             // char

  const modal = $('#party-picker-modal');
  const grid = $('#party-picker-grid');
  const status = $('#party-picker-status');
  const confirmBtn = $('#party-picker-confirm');
  grid.innerHTML = '';

  function refreshStatus() {
    status.textContent = picked.size < 4
      ? `${picked.size}/4 体 選択中`
      : hero
        ? `主人公: ${hero}（消えない・成長する）`
        : '主人公を1体タップ';
    confirmBtn.disabled = !(picked.size === 4 && hero);
  }

  pool.forEach(k => {
    const card = el('div', {
      class: 'pp-card',
      dataset: { char: k.char || k.c },
      onclick: () => {
        const c = card.dataset.char;
        if (picked.has(c)) {
          if (hero === c) hero = null;
          picked.delete(c);
          card.classList.remove('picked','hero');
        } else if (picked.size < 4) {
          picked.add(c);
          card.classList.add('picked');
        }
        refreshStatus();
      },
      ondblclick: () => {
        const c = card.dataset.char;
        if (picked.has(c)) {
          $$('.pp-card.hero').forEach(x => x.classList.remove('hero'));
          card.classList.add('hero');
          hero = c;
          refreshStatus();
        }
      }
    },
      el('div', { class:'pp-char' }, k.char || k.c),
      el('div', { class:'pp-rarity' }, k.rarity),
    );
    // long-press = hero shortcut
    let pressT = null;
    card.addEventListener('pointerdown', () => {
      pressT = setTimeout(() => {
        const c = card.dataset.char;
        if (picked.has(c)) {
          $$('.pp-card.hero').forEach(x => x.classList.remove('hero'));
          card.classList.add('hero');
          hero = c;
          refreshStatus();
        }
      }, 500);
    });
    card.addEventListener('pointerup', () => clearTimeout(pressT));
    card.addEventListener('pointerleave', () => clearTimeout(pressT));
    grid.appendChild(card);
  });

  confirmBtn.onclick = () => {
    if (picked.size !== 4 || !hero) return;
    const members = Array.from(picked).map(c => {
      const k = pool.find(p => (p.char||p.c) === c);
      const perk = pickInherentPerk(c);
      return { char: c, rarity: k.rarity, level: 1, exp: 0, perks: [perk] };
    });
    const heroIdx = members.findIndex(m => m.char === hero);
    // 主人公には guardian 追加
    members[heroIdx].perks.push('guardian');
    STATE.party = { hero: heroIdx, members };
    saveState();
    modal.classList.remove('show');
    renderParty();
    const perksMsg = members.map(m => `${m.char}=${PERKS[m.perks[0]].name}`).join(' / ');
    toast(`パーティ結成！${perksMsg}`);
  };

  refreshStatus();
  modal.classList.add('show');
}

// ═══════════════════════════════════════════════════════════════
// タイマー
// ═══════════════════════════════════════════════════════════════
let timerRaf = 0;
function tick() {
  if (STATE.mode === 'work' || STATE.mode === 'rest') {
    const remaining = Math.max(0, STATE.phaseEnd - Date.now());
    $('#timer-text').textContent = fmtTime(Math.ceil(remaining/1000));
    const total = STATE.mode === 'work' ? STATE.timer.workSec : STATE.timer.restSec;
    const pct = 1 - (remaining/1000) / total;
    updateProgress(pct);
    if (remaining <= 0) {
      completePhase();
      return;
    }
  }
  timerRaf = requestAnimationFrame(tick);
}

function updateProgress(pct) {
  const c = 295.31;
  $('#progress-fg').style.strokeDashoffset = c * (1 - pct);
}

function startWork() {
  STATE.mode = 'work';
  STATE.phaseStart = Date.now();
  STATE.phaseEnd = Date.now() + STATE.timer.workSec * 1000;
  document.body.dataset.mode = 'work';
  $('#main-btn').textContent = '⏸ 一時停止';
  $('#main-btn').dataset.state = 'running';
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  tick();
}

function startRest() {
  STATE.mode = 'rest';
  STATE.phaseStart = Date.now();
  STATE.phaseEnd = Date.now() + STATE.timer.restSec * 1000;
  document.body.dataset.mode = 'rest';
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  startRisingPomoji();
  tick();
}

function pauseTimer() {
  if (STATE.mode !== 'work' && STATE.mode !== 'rest') return;
  STATE.pausedRemaining = STATE.phaseEnd - Date.now();
  STATE.mode = 'paused';
  $('#main-btn').textContent = '▶ 再開';
  $('#main-btn').dataset.state = 'paused';
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  stopRisingPomoji();
}

function resumeTimer() {
  STATE.phaseEnd = Date.now() + STATE.pausedRemaining;
  // restore prior mode (work or rest)
  if (document.body.dataset.mode === 'rest') {
    STATE.mode = 'rest';
    startRisingPomoji();
  } else {
    STATE.mode = 'work';
  }
  $('#main-btn').textContent = '⏸ 一時停止';
  $('#main-btn').dataset.state = 'running';
  saveState();
  tick();
}

function stopTimer() {
  STATE.mode = 'idle';
  document.body.dataset.mode = 'idle';
  $('#main-btn').textContent = '▶ 始める';
  $('#main-btn').dataset.state = 'idle';
  $('#timer-text').textContent = fmtTime(STATE.timer.workSec);
  updateProgress(0);
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  stopRisingPomoji();
}

function completePhase() {
  if (STATE.mode === 'work') {
    STATE.cycles += 1;
    STATE.stats.totalCycles += 1;
    spawnCycleDrops();
    updateProgressPill();
    flashCompletionBurst('☔ 凝縮 完了');
    startRest();
  } else if (STATE.mode === 'rest') {
    flashCompletionBurst('🫧 発散 完了');
    stopRisingPomoji();
    stopTimer();
  }
}

// ═══════════════════════════════════════════════════════════════
// 上るぽもじ（休憩フェーズ）── 解放・浮遊
// ═══════════════════════════════════════════════════════════════
let risingTimer = 0;
function startRisingPomoji() {
  stopRisingPomoji();
  spawnRisingOne();
  risingTimer = setInterval(spawnRisingOne, 1400 + Math.random() * 600);
}
function stopRisingPomoji() {
  if (risingTimer) { clearInterval(risingTimer); risingTimer = 0; }
}
function spawnRisingOne() {
  if (STATE.mode !== 'rest') { stopRisingPomoji(); return; }
  // パーティ字 50%、その他は現在band の字 50%
  let k = null;
  if (STATE.party && Math.random() < 0.5) {
    k = pickPartyDrop();
  } else {
    k = pickKanjiForDrop();
  }
  if (!k) return;
  const tank = $('#tank');
  const rect = tank.getBoundingClientRect();
  const x = 40 + Math.random() * (rect.width - 80);
  const y = rect.height + 30;
  const id = ++pomojiSeq;
  const char = k.char || k.c;
  const node = el('div', {
    class: `pomoji rising rarity-${RARITY_TIERS.indexOf(k.rarity) + 1}`,
    dataset: { id, char, rarity: k.rarity },
    style: { left: x+'px', top: y+'px' }
  }, char);
  tank.appendChild(node);
  const obj = { id, char, rarity: k.rarity, x, y, vx: (Math.random()-0.5)*.6, vy: -1.4 - Math.random()*0.8, el: node, rising: true };
  livePomoji.set(id, obj);
  // タップで弾ける（XPなし、ただ気持ちいい音と粒）
  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    burstRising(obj);
  });
  // 自動で天井に達したら自然消滅
}
function burstRising(p) {
  p.el.classList.add('burst');
  setTimeout(() => { p.el.remove(); livePomoji.delete(p.id); }, 500);
  // ご褒美：パーティ字なら極小 XP
  const idx = partyContainsChar(p.char);
  if (idx >= 0) {
    awardExpToParty(p.char, 1);
  }
}

function flashCompletionBurst(msg) {
  const b = $('#complete-burst');
  $('#complete-msg').textContent = msg;
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 1800);
}

// ═══════════════════════════════════════════════════════════════
// ドロップ生成 ＋ ぽもじ オブジェクト
// ═══════════════════════════════════════════════════════════════
let pomojiSeq = 0;
const livePomoji = new Map(); // id -> { id, char, rarity, x, y, vx, vy, el }

function pickKanjiForDrop() {
  // 単一ティア（現在のレベル帯）から抽選
  const tier = RARITY_TIERS[STATE.unlockedTier];
  const pool = (window.KANJI_CODEX || []).filter(k => k.rarity === tier);
  if (!pool.length) return null;
  return choose(pool);
}

function pickPartyDrop() {
  // パーティ字を1粒（保証ドロップ用）
  if (!STATE.party) return null;
  const m = choose(STATE.party.members);
  // KANJI_CODEX で実体を探して rarity も持ってくる
  const codex = window.KANJI_CODEX || [];
  const found = codex.find(k => (k.char || k.c) === m.char);
  return found || { char: m.char, c: m.char, rarity: m.rarity };
}

// ぽもじ上限（負荷管理：60体超えたら最古を消滅）
const MAX_LIVE_POMOJI = 60;
function enforcePomojiCap() {
  if (livePomoji.size <= MAX_LIVE_POMOJI) return;
  const settled = Array.from(livePomoji.values()).filter(p => p.settled && !p.dragging && !p.rising);
  // 古い順（id 昇順）から消す
  settled.sort((a,b) => a.id - b.id);
  const toRemove = livePomoji.size - MAX_LIVE_POMOJI;
  for (let i = 0; i < toRemove && i < settled.length; i++) {
    const p = settled[i];
    p.el.classList.add('dissolve');
    setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 600);
  }
}

function spawnPomoji(opts={}) {
  const k = opts.kanji || pickKanjiForDrop();
  if (!k) return;
  enforcePomojiCap();
  const tank = $('#tank');
  const tankRect = tank.getBoundingClientRect();
  const id = ++pomojiSeq;
  const char = k.char || k.c;
  const rarity = k.rarity;
  const tierIdx = RARITY_TIERS.indexOf(rarity);
  const tierClass = `rarity-${tierIdx + 1}`;
  const x = (opts.x != null) ? opts.x : (40 + Math.random() * (tankRect.width - 80));
  const y = (opts.y != null) ? opts.y : -40;

  // 字に書体クラスを付与（パーティ内かつ Lv 達成時）
  let styleClass = 'kai';
  const partyIdx = partyContainsChar(char);
  if (partyIdx >= 0) {
    const stage = evolutionStage(STATE.party.members[partyIdx].level);
    styleClass = EVO_STYLE[stage];
  }

  const node = el('div', {
    class: `pomoji ${tierClass} font-${styleClass}`,
    dataset: { id, char, rarity, tier: tierIdx },
    style: { left: x+'px', top: y+'px' }
  }, char);
  tank.appendChild(node);

  const obj = { id, char, rarity, tier: tierIdx, x, y, vx: (Math.random()-0.5)*1.5, vy: 0, el: node, settled: false };
  livePomoji.set(id, obj);
  attachDragHandlers(node, obj);

  STATE.stats.totalDrops += 1;
  STATE.collection[char] = (STATE.collection[char] || 0) + 1;
  return obj;
}

// 低レア→高レア順に落とす（ドラマ型）
function dropCascade(kanjiList, baseDelay=220, tierJump=420) {
  // sort ascending by rarity tier index
  const sorted = kanjiList.slice().sort((a, b) => {
    const ai = RARITY_TIERS.indexOf(a.rarity);
    const bi = RARITY_TIERS.indexOf(b.rarity);
    return ai - bi;
  });
  let t = 0;
  let lastTier = -1;
  sorted.forEach((k, i) => {
    const tierIdx = RARITY_TIERS.indexOf(k.rarity);
    // 同レアは baseDelay 間隔、レアが上がる瞬間は tierJump で溜め
    if (i > 0) t += (tierIdx !== lastTier) ? tierJump : baseDelay;
    lastTier = tierIdx;
    setTimeout(() => {
      const obj = spawnPomoji({ kanji: k });
      // 拾段/初段なら追加で軽い演出
      if (tierIdx >= 4 && obj) {
        toast(`✦ ${k.char || k.c}（${k.rarity}）`, k.rarity);
      }
    }, t);
  });
}

function spawnCycleDrops() {
  // レアごとに落下数を変える
  const tier = STATE.unlockedTier;
  const [minN, maxN] = TIER_DROP_COUNT[tier] || [5, 8];
  const agg = aggregatePartyPerks();
  const base = minN + Math.floor(Math.random() * (maxN - minN + 1));
  const count = Math.max(2, base + (agg.dropCountAdd || 0));

  const drops = [];
  // パーティ保証ドロップ（1〜2粒）
  const partyGuarantee = STATE.party ? (1 + (Math.random() < 0.5 ? 1 : 0)) : 0;
  for (let i = 0; i < partyGuarantee; i++) {
    const p = pickPartyDrop();
    if (p) drops.push(p);
  }
  // 残りは現在の band ティアから
  for (let i = drops.length; i < count; i++) {
    const k = pickKanjiForDrop();
    if (k) drops.push(k);
  }
  // 祝詞 perk: 5サイクル毎に上位レア追加
  if (agg.blessing && STATE.cycles > 0 && STATE.cycles % agg.blessing === 0) {
    const higherTier = Math.min(5, tier + 1);
    const higherPool = (window.KANJI_CODEX||[]).filter(k => k.rarity === RARITY_TIERS[higherTier]);
    if (higherPool.length) drops.push(choose(higherPool));
  }
  dropCascade(drops, 220, 420);
  saveState();
}

function spawnBackgroundCatchup(elapsedMs) {
  // user came back from background; replay missed cycle drops in cascade
  const cycles = Math.floor(elapsedMs / 1000 / Math.max(60, STATE.timer.workSec));
  if (cycles <= 0) return;
  const total = Math.min(15, cycles * 3);
  toast(`おかえり！${cycles}サイクル分（${total}粒）落とします`);
  const drops = [];
  for (let i = 0; i < total; i++) {
    const k = pickKanjiForDrop();
    if (k) drops.push(k);
  }
  // バックグラウンド復帰は少し早めに、しかしレア順は維持
  dropCascade(drops, 280, 480);
}

// ═══════════════════════════════════════════════════════════════
// 物理 + 衝突 (rAF loop)
// ═══════════════════════════════════════════════════════════════
const DAMP = 0.75;
const SIZE = SIZE_BASE;
let physicsRaf = 0;
function physicsStep() {
  const tank = $('#tank');
  const rect = tank.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  // perk 適用
  const agg = aggregatePartyPerks();
  for (const p of livePomoji.values()) {
    if (p.dragging) continue;
    if (p.rising) {
      // 上昇ぽもじ：軽い揺らぎ＋ゆっくり浮上
      p.vx += (Math.random() - 0.5) * 0.08;
      p.vx *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W - SIZE) p.vx *= -0.7;
      // 天井到達 → 自動消滅
      if (p.y < -SIZE) {
        p.el.remove();
        livePomoji.delete(p.id);
        continue;
      }
      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';
      continue;
    }
    // 落下ぽもじ：重力＋着底
    // tier 別の落下倍率 × perk gravityMul
    const tierMul = TIER_FALL_MUL[p.tier] || 1.0;
    p.vy += GRAVITY_BASE * tierMul * (agg.gravityMul || 1.0);
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) { p.x = 0; p.vx *= -DAMP; }
    if (p.x > W - SIZE) { p.x = W - SIZE; p.vx *= -DAMP; }
    if (p.y > H - SIZE) {
      p.y = H - SIZE; p.vy *= -DAMP; p.vx *= 0.92;
      if (Math.abs(p.vy) < 1) {
        p.vy = 0;
        // 着地時 magnet perk: 近くの同字を引き寄せ
        if (!p.settled && agg.magnet) attractSameChar(p);
        if (!p.settled) p.el.classList.add('settled');
        p.settled = true;
      }
    }
    p.el.style.left = p.x + 'px';
    p.el.style.top  = p.y + 'px';
  }
  physicsRaf = requestAnimationFrame(physicsStep);
}

function checkMergeCollision(p) {
  const agg = aggregatePartyPerks();
  const radius = SIZE * 0.9 * (agg.mergeRadiusMul || 1.0);
  for (const other of livePomoji.values()) {
    if (other.id === p.id) continue;
    if (other.char !== p.char) continue;
    const dx = (other.x - p.x), dy = (other.y - p.y);
    const dist2 = dx*dx + dy*dy;
    if (dist2 < radius * radius) return other;
  }
  return null;
}

// 磁字 perk: 着地時に近くの同字を引き寄せる
function attractSameChar(p) {
  for (const other of livePomoji.values()) {
    if (other.id === p.id) continue;
    if (other.char !== p.char) continue;
    if (other.dragging || other.rising) continue;
    const dx = (p.x - other.x), dy = (p.y - other.y);
    const dist2 = dx*dx + dy*dy;
    if (dist2 < (SIZE*4)**2 && dist2 > 100) {
      const d = Math.sqrt(dist2);
      other.vx += (dx/d) * 0.8;
      other.vy += (dy/d) * 0.3;
      other.el.classList.add('magnetized');
      setTimeout(() => other.el.classList.remove('magnetized'), 600);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// ドラッグ ＋ 融合 ＋ タップ消滅
// ═══════════════════════════════════════════════════════════════
function attachDragHandlers(node, obj) {
  let startX = 0, startY = 0, origX = 0, origY = 0, moved = false, pointerId = null;

  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    node.setPointerCapture(pointerId);
    obj.dragging = true;
    moved = false;
    const r = $('#tank').getBoundingClientRect();
    startX = e.clientX - r.left;
    startY = e.clientY - r.top;
    origX = obj.x; origY = obj.y;
    node.classList.add('dragging');
  });

  node.addEventListener('pointermove', (e) => {
    if (!obj.dragging) return;
    const r = $('#tank').getBoundingClientRect();
    const dx = (e.clientX - r.left) - startX;
    const dy = (e.clientY - r.top) - startY;
    if (Math.abs(dx) + Math.abs(dy) > 10) moved = true;
    obj.x = origX + dx;
    obj.y = origY + dy;
    node.style.left = obj.x + 'px';
    node.style.top  = obj.y + 'px';

    // highlight potential merge target
    const target = checkMergeCollision(obj);
    $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));
    if (target) target.el.classList.add('merge-glow');
  });

  node.addEventListener('pointerup', (e) => {
    if (pointerId != null) try { node.releasePointerCapture(pointerId); } catch(_) {}
    pointerId = null;
    obj.dragging = false;
    obj.vy = 0; obj.vx = 0;
    node.classList.remove('dragging');
    $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));

    if (!moved) {
      // Tap = dissolve
      dissolvePomoji(obj);
      return;
    }
    // Drop = check for merge
    const target = checkMergeCollision(obj);
    if (target) mergePomoji(obj, target);
  });
}

function dissolvePomoji(p) {
  const rarity = p.rarity;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const exp = Math.max(1, Math.pow(2, rIdx) * 3);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
  p.el.classList.add('dissolve');
  setTimeout(() => { p.el.remove(); livePomoji.delete(p.id); }, 600);
}

// 浮上する「+N XP」表示（ジューシー要素）
function spawnXpFloat(x, y, amount, rarity) {
  const tank = $('#tank');
  if (!tank) return;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const node = el('div', {
    class: `xp-float rarity-${rIdx + 1}`,
    style: { left: x + 'px', top: y + 'px' }
  }, `+${amount}`);
  tank.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}

function _orphanExp(exp) {
  // Not a party member → distribute small XP to hero
  if (!STATE.party) return;
  const hero = STATE.party.members[STATE.party.hero];
  hero.exp += Math.floor(exp / 4);
  while (hero.exp >= expForLevel(hero.level + 1)) {
    hero.exp -= expForLevel(hero.level + 1);
    hero.level += 1;
    onLevelUp(hero, STATE.party.hero);
  }
}

function mergePomoji(src, target) {
  // src dragged onto target with same char
  const rIdx = RARITY_TIERS.indexOf(src.rarity);
  const exp = Math.max(1, Math.pow(2, rIdx) * 10);
  spawnXpFloat(target.x + SIZE/2, target.y, exp, src.rarity);
  // タグアフィニティ判定：src と target のタグ重複があれば +50%
  const srcTags = new Set(getCharTags(src.char));
  const tgtTags = new Set(getCharTags(target.char));
  let tagMatch = false;
  for (const t of srcTags) { if (tgtTags.has(t)) { tagMatch = true; break; } }
  awardExpToParty(src.char, exp, { tagMatch }) || _orphanExp(exp);
  // Visual: src absorbs into target
  target.el.classList.add('merge-flash');
  if (tagMatch) target.el.classList.add('merge-resonate');
  setTimeout(() => {
    target.el.classList.remove('merge-flash');
    target.el.classList.remove('merge-resonate');
  }, 800);
  if (tagMatch) {
    // 共通タグを表示
    const shared = Array.from(srcTags).find(t => tgtTags.has(t));
    toast(`✦ 同質共振「${shared}」XP+50%`);
  }
  src.el.classList.add('dissolve');
  setTimeout(() => { src.el.remove(); livePomoji.delete(src.id); }, 400);
  saveState();
  renderParty();
}

// ═══════════════════════════════════════════════════════════════
// パーティ表示
// ═══════════════════════════════════════════════════════════════
function renderParty() {
  const bar = $('#party-bar');
  if (!isPartyChosen()) {
    bar.classList.add('empty');
    bar.innerHTML = '<button class="party-pick-cta" id="party-pick-cta">パーティを編成する →</button>';
    $('#party-pick-cta').onclick = () => openPartyPicker();
    return;
  }
  bar.classList.remove('empty');
  bar.innerHTML = '';
  STATE.party.members.forEach((m, idx) => {
    const isHero = (idx === STATE.party.hero);
    const stage = evolutionStage(m.level);
    const styleClass = EVO_STYLE[stage];
    const needExp = expForLevel(m.level + 1);
    const tierIdx = RARITY_TIERS.indexOf(m.rarity);
    const perkLabels = (m.perks || []).map(pid => PERKS[pid]?.name).filter(Boolean).join('・');
    const card = el('div', {
      class: `party-card rarity-${tierIdx + 1}${isHero ? ' hero' : ''}`,
      dataset: { idx },
      title: `${m.char} Lv.${m.level} / 特性: ${perkLabels}`
    },
      el('div', { class:'pc-glyph font-' + styleClass }, m.char, stage > 0 ? el('span', { class:'pc-stage' }, EVO_GLYPH[stage]) : null),
      el('div', { class:'pc-meta' },
        el('span', { class:'pc-name' }, isHero ? '★ ' + m.char : m.char),
        el('span', { class:'pc-lv' }, 'Lv.' + m.level),
      ),
      el('div', { class:'pc-perks' }, perkLabels),
      el('div', { class:'pc-bar' },
        el('div', { class:'pc-fill', style: { width: Math.min(100, (m.exp / needExp) * 100) + '%' } })
      ),
    );
    bar.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════
// トースト ＋ 軽い通知
// ═══════════════════════════════════════════════════════════════
let toastTimer = 0;
function toast(msg, rarity=null) {
  const t = $('#toast');
  t.textContent = msg;
  const rIdx = rarity ? RARITY_TIERS.indexOf(rarity) : -1;
  t.className = 'toast' + (rIdx >= 0 ? ' rarity-' + (rIdx + 1) : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ═══════════════════════════════════════════════════════════════
// タイマー設定 UI
// ═══════════════════════════════════════════════════════════════
function openTimerSettings() {
  const m = $('#timer-settings-modal');
  $('#ts-work-min').value = Math.floor(STATE.timer.workSec / 60);
  $('#ts-work-sec').value = STATE.timer.workSec % 60;
  $('#ts-rest-min').value = Math.floor(STATE.timer.restSec / 60);
  $('#ts-rest-sec').value = STATE.timer.restSec % 60;
  m.classList.add('show');
}
function closeTimerSettings() { $('#timer-settings-modal').classList.remove('show'); }
function applyTimerSettings() {
  const wm = Math.max(0, parseInt($('#ts-work-min').value)||0);
  const ws = Math.max(0, Math.min(59, parseInt($('#ts-work-sec').value)||0));
  const rm = Math.max(0, parseInt($('#ts-rest-min').value)||0);
  const rs = Math.max(0, Math.min(59, parseInt($('#ts-rest-sec').value)||0));
  const work = wm*60 + ws;
  const rest = rm*60 + rs;
  if (work < 1) { alert('作業時間は最低1秒'); return; }
  if (rest < 1) { alert('休憩時間は最低1秒'); return; }
  STATE.timer.workSec = work;
  STATE.timer.restSec = rest;
  STATE.timer.presetIdx = -1;
  saveState();
  if (STATE.mode === 'idle') $('#timer-text').textContent = fmtTime(work);
  closeTimerSettings();
  toast('時間を変更しました');
}
function applyPreset(idx) {
  const p = TIMER_PRESETS[idx];
  STATE.timer.workSec = p.work;
  STATE.timer.restSec = p.rest;
  STATE.timer.presetIdx = idx;
  saveState();
  if (STATE.mode === 'idle') $('#timer-text').textContent = fmtTime(p.work);
  toast(`${p.label} に変更`);
}

// ═══════════════════════════════════════════════════════════════
// 図鑑
// ═══════════════════════════════════════════════════════════════
let codexFilter = { tier: 'all', onlySeen: false };
function openCodex() {
  $('#codex-modal').classList.add('show');
  renderCodex();
}
function closeCodex() { $('#codex-modal').classList.remove('show'); }

// 字のクイック詳細
function showCharDetail(c, rarity) {
  const tags = getCharTags(c);
  const recipes = (window.YOJI_RECIPES || []).filter(r => r.chars && r.chars.includes(c));
  const seen = STATE.collection[c] || 0;
  const partyIdx = partyContainsChar(c);
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const member = partyIdx >= 0 ? STATE.party.members[partyIdx] : null;

  // 既存があれば削除
  $$('.char-detail-pop').forEach(e => e.remove());

  const pop = el('div', { class: `char-detail-pop rarity-${rIdx + 1}` },
    el('button', { class: 'cd-close', onclick: (e) => { e.target.parentElement.remove(); } }, '×'),
    el('div', { class:'cd-char' }, c),
    el('div', { class:'cd-rarity' }, rarity),
    el('div', { class:'cd-tags' }, tags.length ? tags.slice(0, 5).join(' / ') : '—'),
    el('div', { class:'cd-stat' }, `発見 ${seen} 回`),
    member ? el('div', { class:'cd-party' },
      `パーティ字 ・ Lv.${member.level} ・ 特性: ${(member.perks||[]).map(pid=>PERKS[pid]?.name).filter(Boolean).join('・')}`
    ) : null,
    el('div', { class:'cd-recipes' },
      el('div', { class:'cd-recipes-title' }, `熟語 ${recipes.length} 件`),
      el('div', { class:'cd-recipes-list' }, recipes.slice(0, 8).map(r => r.word).join(' ・ '))
    )
  );
  $('#codex-modal .modal-card').appendChild(pop);
}
function renderCodex() {
  const grid = $('#codex-grid');
  grid.innerHTML = '';
  const codex = window.KANJI_CODEX || [];
  const onlyShow = (tierIdx) =>
    codexFilter.tier === 'all' || String(tierIdx) === codexFilter.tier;

  RARITY_TIERS.forEach((tier, tierIdx) => {
    if (!onlyShow(tierIdx)) return;
    const tierKanji = codex.filter(k => k.rarity === tier);
    const visible = tierKanji.filter(k => {
      if (!codexFilter.onlySeen) return true;
      const c = k.char || k.c;
      return (STATE.collection[c] || 0) > 0;
    });
    if (!visible.length) return;
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' },
        `${tier} ${TIER_ACHIEVEMENT[tierIdx]} （${tierIdx <= STATE.unlockedTier ? '解放済' : '🔒 Lv.' + UNLOCK_LV[tier]}）`)
    );
    const tierGrid = el('div', { class:'codex-tier-grid' });
    visible.forEach(k => {
      const c = k.char || k.c;
      const seen = STATE.collection[c] || 0;
      const partyIdx = partyContainsChar(c);
      const cls = `codex-cell rarity-${tierIdx + 1}` +
                  (seen ? ' seen' : '') +
                  (partyIdx >= 0 ? ' in-party' : '') +
                  (tierIdx > STATE.unlockedTier ? ' locked' : '');
      const cell = el('div', { class: cls, title: seen ? `${c}（${seen}回発見）` : '？' },
        tierIdx > STATE.unlockedTier && !seen ? '?' : c
      );
      if (seen) {
        cell.addEventListener('click', () => showCharDetail(c, k.rarity));
      }
      tierGrid.appendChild(cell);
    });
    section.appendChild(tierGrid);
    grid.appendChild(section);
  });

  const discovered = Object.keys(STATE.collection).length;
  const totalKanji = codex.length;
  $('#codex-summary').textContent = `発見 ${discovered} / ${totalKanji} 字`;
}

// ═══════════════════════════════════════════════════════════════
// 進捗ピル ── タイマー下の小さい進捗表示
// ═══════════════════════════════════════════════════════════════
function updateProgressPill() {
  const bandEl = $('#pp-band');
  const cycEl = $('#pp-cycles');
  if (!bandEl || !cycEl) return;
  const tier = STATE.unlockedTier;
  const tierName = RARITY_TIERS[tier];
  const achName = TIER_ACHIEVEMENT[tier];
  // モード表示を冒頭に
  const modeLabel =
    STATE.mode === 'work'   ? '🎯 作業中' :
    STATE.mode === 'rest'   ? '🫧 休憩中' :
    STATE.mode === 'paused' ? '⏸ 一時停止' :
    '⌛ 準備中';
  bandEl.textContent = `${modeLabel} ・ ${tierName}帯 ${achName}`;
  cycEl.textContent = `${STATE.stats.totalCycles || 0} 回完了`;
}

// ═══════════════════════════════════════════════════════════════
// 記録モーダル
// ═══════════════════════════════════════════════════════════════
function openStats() {
  const list = $('#stats-list');
  const discovered = Object.keys(STATE.collection || {}).length;
  const totalKanji = (window.KANJI_CODEX || []).length;
  const partyAvg = isPartyChosen() ? Math.round(partyAverageLevel() * 10) / 10 : 0;
  list.innerHTML = '';
  const cells = [
    { label:'累計サイクル', value: STATE.stats.totalCycles || 0 },
    { label:'累計ぽもじ', value: STATE.stats.totalDrops || 0 },
    { label:'累計 EXP', value: (STATE.stats.totalExp || 0).toLocaleString() },
    { label:'発見字', value: `${discovered} / ${totalKanji}` },
    { label:'パーティ平均Lv', value: partyAvg },
    { label:'現在の帯', value: RARITY_TIERS[STATE.unlockedTier] },
  ];
  cells.forEach(c => {
    list.appendChild(el('div', { class:'stats-cell' },
      el('div', { class:'stats-cell-label' }, c.label),
      el('div', { class:'stats-cell-value' }, String(c.value))
    ));
  });

  // 解放ティア表示
  const tiers = $('#stats-tiers');
  tiers.innerHTML = '';
  RARITY_TIERS.forEach((tier, i) => {
    const unlocked = i <= STATE.unlockedTier;
    const row = el('div', { class: `stats-tier-row rarity-${i+1}${unlocked ? ' unlocked' : ' locked'}` },
      el('span', { class:'str-name' }, `${tier} ${TIER_ACHIEVEMENT[i]}`),
      el('span', { class: 'str-status' + (unlocked ? ' ok' : '') },
        unlocked ? '✓ 解放済' : `Lv.${UNLOCK_LV[tier]} 必要`)
    );
    tiers.appendChild(row);
  });

  $('#stats-modal').classList.add('show');
}
function closeStats() { $('#stats-modal').classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════
// バックグラウンド対応
// ═══════════════════════════════════════════════════════════════
function handleVisibilityChange() {
  if (document.hidden) {
    if (STATE.mode === 'work' || STATE.mode === 'rest') {
      STATE.lastHiddenAt = Date.now();
      pauseTimer();
      saveState();
    }
  } else {
    if (STATE.lastHiddenAt) {
      const elapsed = Date.now() - STATE.lastHiddenAt;
      if (elapsed > 30 * 1000) {
        spawnBackgroundCatchup(elapsed);
      }
      STATE.lastHiddenAt = null;
      saveState();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// イベントバインド
// ═══════════════════════════════════════════════════════════════
function bindEvents() {
  $('#main-btn').addEventListener('click', () => {
    if (!isPartyChosen()) { openPartyPicker(); return; }
    if (STATE.mode === 'idle') startWork();
    else if (STATE.mode === 'paused') resumeTimer();
    else pauseTimer();
  });
  $('#btn-skip').addEventListener('click', () => {
    if (STATE.mode === 'work') { startRest(); }
    else if (STATE.mode === 'rest') { stopTimer(); }
  });
  $('#btn-reset').addEventListener('click', stopTimer);

  $('#btn-timer-settings').addEventListener('click', openTimerSettings);
  $('#ts-cancel').addEventListener('click', closeTimerSettings);
  $('#ts-apply').addEventListener('click', applyTimerSettings);
  $$('.ts-preset').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(parseInt(btn.dataset.preset)));
  });

  $('#btn-codex').addEventListener('click', openCodex);
  $('#codex-close').addEventListener('click', closeCodex);
  $$('.codex-tab').forEach(t => t.addEventListener('click', () => {
    codexFilter.tier = t.dataset.tier;
    $$('.codex-tab').forEach(x => x.classList.toggle('active', x === t));
    renderCodex();
  }));
  $('#codex-only-seen').addEventListener('change', (e) => {
    codexFilter.onlySeen = e.target.checked;
    renderCodex();
  });

  $('#btn-stats').addEventListener('click', openStats);
  $('#stats-close').addEventListener('click', closeStats);

  $('#btn-help').addEventListener('click', () => $('#help-modal').classList.add('show'));
  $('#help-close').addEventListener('click', () => $('#help-modal').classList.remove('show'));

  $('#btn-edit-party').addEventListener('click', () => {
    if (confirm('パーティを再編成しますか？（現在のメンバーはリセット）')) {
      STATE.party = null;
      saveState();
      renderParty();
      openPartyPicker();
    }
  });

  $('#btn-reset-all').addEventListener('click', resetState);
  $('#btn-share-party').addEventListener('click', copyShareURL);

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // close modals on backdrop click
  $$('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// 初期化
// ═══════════════════════════════════════════════════════════════
function init() {
  loadState();
  // reset transient state across reloads
  STATE.mode = 'idle';
  STATE.phaseStart = 0;
  STATE.phaseEnd = 0;
  STATE.pausedRemaining = 0;
  STATE.lastHiddenAt = null;
  document.body.dataset.mode = 'idle';
  bindEvents();
  $('#timer-text').textContent = fmtTime(STATE.timer.workSec);
  // 共有 URL チェック（自分のパーティ読み込み後）
  checkSharedPartyOnBoot();
  renderParty();
  updateUnlockTier();
  updateProgressPill();
  buildBackgroundLayers();
  physicsStep();

  // First-launch: prompt party selection
  if (!isPartyChosen()) {
    setTimeout(() => openPartyPicker(), 600);
  }

  // SW registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
