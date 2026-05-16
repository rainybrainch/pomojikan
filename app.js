'use strict';
// ぽもじかん v29 ── 文字育成ポモドーロ
// 2026-05-12 / 全面リライト

// ═══════════════════════════════════════════════════════════════
// 定数
// ═══════════════════════════════════════════════════════════════
const LS_KEY = 'pomojikan_v30';
// ─── レアリティ体系 v3（2026-05-16）── 16段階・字種＋学年別漢字 ───
// ★1ひらがな→★5ローマ→★6-11 小1-小6→★12-16 中学/高校/人名/古典/神字
const RARITY_TIERS = ['★1','★2','★3','★4','★5','★6','★7','★8','★9','★10','★11','★12','★13','★14','★15','★16'];
const UNLOCK_LV    = {
  '★1':1,  '★2':3,  '★3':6,  '★4':10, '★5':14,
  '★6':18, '★7':24, '★8':32, '★9':42, '★10':55,
  '★11':70, '★12':90, '★13':115, '★14':145, '★15':180, '★16':220
};
const TIER_ACHIEVEMENT = [
  '始まりの音',         // ★1 ひらがな
  'もうひとつの音',     // ★2 カタカナ
  '量と順序',           // ★3 数字
  '異邦の文字',         // ★4 英語
  'ローマの刻',         // ★5 ローマ数字
  '小一の漢字',         // ★6 小1
  '小二の漢字',         // ★7 小2
  '小三の漢字',         // ★8 小3
  '小四の漢字',         // ★9 小4
  '小五の漢字',         // ★10 小5
  '小六の漢字',         // ★11 小6
  '中学の漢字',         // ★12 中学
  '高校の漢字',         // ★13 高校
  '人名の漢字',         // ★14 人名
  '古典 ・ 古字',       // ★15 古典
  '神字 ・ 七徳七大罪', // ★16 神字
];
// サイクル完了時のボーナス粒数（作業中の継続落下とは別）
const TIER_DROP_COUNT = [
  [3,5], [3,4], [3,4], [2,4], [2,4], [2,3], [2,3], [2,3], [1,3], [1,3],
  [1,2], [1,2], [1,2], [1,2], [1,2], [1,2]
];
// レアごとの落下速度倍率（高レアほどゆっくり、ドラマを作る）
const TIER_FALL_MUL = [1.0, 0.97, 0.94, 0.90, 0.86, 0.82, 0.78, 0.74, 0.70, 0.66, 0.62, 0.58, 0.54, 0.50, 0.46, 0.42];

// 無限 Lv 設計（v4 / 2026-05-16）── ★は16段階で頭打ちでも Lv は無限に育つ
const EVO_STAGE_LV = [
  10,    // 1: 楷書
  30,    // 2: 行書
  70,    // 3: 草書
  150,   // 4: 篆書
  300,   // 5: 甲骨
  600,   // 6: 神代文字
  1000,  // 7: 超越
  2000,  // 8: 星屑
  5000,  // 9: 神話
  10000, // 10: 創造主
];
const EVO_GLYPH = ['', '✦', '✧', '☀', '☆', '✯', '✪', '❂', '✺', '✹', '𓂀'];
const EVO_STYLE = ['kai', 'gyo', 'sou', 'tens', 'kou', 'shin', 'choetsu', 'hoshi', 'shinwa', 'sozo', 'sozo'];

// Lv に応じた動的グロー半径（対数的に増える ・ Lv 100 で約 30px、Lv 10000 で約 80px）
function lvGlowRadius(lv) {
  return Math.min(120, 8 + Math.log10(Math.max(1, lv)) * 22);
}

const TIMER_PRESETS = [
  { label:'25/5', work:25*60, rest:5*60 },
  { label:'50/10', work:50*60, rest:10*60 },
  { label:'15/3', work:15*60, rest:3*60 },
];
const PARTY_PICKER_POOL_SIZE = 24;
const GRAVITY_BASE = 0.07;  // v2.2: 0.35→0.18→0.07 もっとふわっと
const MAX_FALL_VY  = 2.6;   // 最大落下速度キャップ（ふわっと感の維持）
const SIZE_BASE = 56;

// ═══════════════════════════════════════════════════════════════
// PERK SYSTEM ── ヴァンパイアサバイバー方式
// ═══════════════════════════════════════════════════════════════
const PERKS = {
  // ─── basic：基本ステータス系（どの字でも付き得る・どんな字でも +0.5 で育つ）───
  haste:       { name:'急降下',  desc:'落下速度 +30%（育てて最大 +78%）',                       category:'basic' },
  feather:     { name:'ふわふわ',desc:'落下速度 -30% ／ 合体判定 +25%',                          category:'basic' },
  wide:        { name:'求心',    desc:'合体判定範囲 +40%',                                       category:'basic' },
  bounty:      { name:'豊穣',    desc:'サイクル完了時 落下数 +2粒（育てて最大 +5粒）',           category:'basic' },
  scholar:     { name:'積み重ね',desc:'EXP獲得 +30%（育てて最大 +78%）',                        category:'basic' },
  prodigy:     { name:'神童',    desc:'進化Lv閾値 -25%（早く書体進化）',                         category:'basic' },
  magnet:      { name:'磁字',    desc:'着地時に近くの同字を引き寄せて自動合体',                  category:'basic' },

  // ─── special：主人公専用（自動付与）───
  guardian:    { name:'守護',    desc:'主人公が消滅しない（タップでも残る）／ EXP分配 +20%',     category:'special' },

  // ─── tag：タグ系（その字のタグから自動派生・対応タグの字ストックで育つ）───
  tag_virtue:  { name:'七徳の徳',  desc:'七徳熟語成立時 全員XP +50% × 育成倍率',                  category:'tag', tag:'七徳'  },
  tag_sin:     { name:'七大罪の業',desc:'七大罪字は落下時 +1粒派生 × 育成倍率',                   category:'tag', tag:'七大罪'},
  tag_emo:     { name:'感応',     desc:'感情字を融合時 XP +100% × 育成倍率',                     category:'tag', tag:'感情'  },
  tag_time:    { name:'時の継',   desc:'時字を融合時 サイクル時間 -10秒',                        category:'tag', tag:'時'    },
  tag_zen:     { name:'禅静',     desc:'禅字を持つと休憩中の上昇泡が 2倍 × 育成倍率',            category:'tag', tag:'禅'    },
  tag_sacred:  { name:'神威',     desc:'神字を融合時 ★解放を 10Lv 早める',                       category:'tag', tag:'神字'  },
  tag_war:     { name:'闘気',     desc:'武字を融合時 連鎖判定 +1字',                             category:'tag', tag:'武'    },
  tag_learn:   { name:'求道',     desc:'学字を融合時 EXP +75% × 育成倍率',                       category:'tag', tag:'学'    },
  tag_nature:  { name:'自然律',   desc:'自然字を融合時 落下数 +1',                              category:'tag', tag:'自然'  },
  tag_beauty:  { name:'幽美',     desc:'美字を融合時 書体が即時進化（強力）',                    category:'tag', tag:'美'    },
  tag_numeral: { name:'計算',     desc:'数字字を融合時 サイクル EXP +20',                        category:'tag', tag:'数字'  },
  tag_english: { name:'発音',     desc:'英語字を融合時 落下速度 -15%',                           category:'tag', tag:'英語'  },
  tag_order:   { name:'順序',     desc:'順序タグ字を持つと早押し EXP +10% × 育成倍率',           category:'tag', tag:'順序'  },

  // ─── rare：レア特性（★8 以降の字を仲間にすると稀に付与 ・ 効果大）─────────
  chain:              { name:'連鎖',   desc:'3字以上同字融合で大爆発（パーティ全員 Lv+1）',     category:'rare' },
  blessing:           { name:'祝詞',   desc:'5サイクル毎に 1段上のレア字が降ってくる',          category:'rare' },
  legendary_radiance: { name:'輝度',   desc:'パーティ全員 EXP獲得 +50% × 育成倍率',             category:'rare' },
  legendary_growth:   { name:'爆速',   desc:'Lv up 必要 EXP -30% × 育成倍率',                    category:'rare' },
  legendary_link:     { name:'共鳴',   desc:'仲間の他特性の効果を +20% × 育成倍率（重ね掛け）',  category:'rare' },
  legendary_burst:    { name:'神撃',   desc:'合体時 10% で EXP ×10 メガバースト',                category:'rare' },
  legendary_aurora:   { name:'極光',   desc:'背景演出 派手化 ＋ 全特性 +5% × Lv（成長型）',       category:'rare' },
  legendary_void:     { name:'虚無',   desc:'消滅した字も合体判定に残る（残響）',               category:'rare' },
  legendary_destiny:  { name:'運命',   desc:'★1 解放上限を超えて高レアが稀に降る',              category:'rare' },
  legendary_compass:  { name:'羅針',   desc:'パーティ字の出現率 +30% × 育成倍率',                category:'rare' },
};

// レア特性候補（★8 以降の字を仲間にしたとき抽選で付く ・ ★16 で確定）
const RARE_PERK_POOL = [
  'chain','blessing',
  'legendary_radiance','legendary_growth','legendary_link','legendary_burst',
  'legendary_aurora','legendary_void','legendary_destiny','legendary_compass',
];

// タグ → 固有 perk の対応
const TAG_PERK_MAP = {
  '七徳':'tag_virtue', '七大罪':'tag_sin', '感情':'tag_emo', '時':'tag_time',
  '禅':'tag_zen', '神字':'tag_sacred', '武':'tag_war', '学':'tag_learn',
  '自然':'tag_nature', '植物':'tag_nature', '美':'tag_beauty', '宗教':'tag_sacred',
  '仏教':'tag_zen', '思想':'tag_learn', '哲学':'tag_learn', '道':'tag_war',
  // v2 文字種タグ
  'ひらがな':'feather', 'カタカナ':'haste', '音':'wide',
  '数字':'tag_numeral', '数':'tag_numeral', '順序':'tag_order',
  '英語':'tag_english', '異邦':'tag_english',
};

// 各キャラのタグを YOJI_RECIPES から逆引き
let CHAR_TAGS = null;
function buildCharTagsIndex() {
  if (CHAR_TAGS) return CHAR_TAGS;
  CHAR_TAGS = {};
  // 熟語タグ（漢字）
  const recipes = window.YOJI_RECIPES || [];
  for (const r of recipes) {
    for (const c of (r.chars || [])) {
      if (!CHAR_TAGS[c]) CHAR_TAGS[c] = new Set();
      for (const t of (r.tags || [])) CHAR_TAGS[c].add(t);
    }
  }
  // 直接タグ（ひらがな・カタカナなど codex 側で付けたもの）
  const codex = window.KANJI_CODEX || [];
  for (const k of codex) {
    if (!CHAR_TAGS[k.c]) CHAR_TAGS[k.c] = new Set();
    for (const t of (k.tags || [])) CHAR_TAGS[k.c].add(t);
  }
  return CHAR_TAGS;
}

function getCharTags(c) {
  const idx = buildCharTagsIndex();
  return Array.from(idx[c] || []);
}

// ひらがな・カタカナの音韻列 → 固有 perk マッピング
// 「あ・い・う・え・お」と「か行」では性質が違う、という意味付け
const KANA_ROW_PERK = {
  // 母音（あ行）── feather（軽やか）
  'あいうえおぁぃぅぇぉアイウエオァィゥェォ': 'feather',
  // か行・が行 ── haste（速い・破裂音）
  'かきくけこがぎぐげごカキクケコガギグゲゴ': 'haste',
  // さ行・ざ行 ── wide（広がる・摩擦音）
  'さしすせそざじずぜぞサシスセソザジズゼゾ': 'wide',
  // た行・だ行 ── magnet（吸引・舌音）
  'たちつてとだぢづでどタチツテトダヂヅデドっッ': 'magnet',
  // な行 ── tag_emo（感応・鼻音）
  'なにぬねのナニヌネノ': 'tag_emo',
  // は行・ば行・ぱ行 ── bounty（豊穣・破裂と摩擦）
  'はひふへほばびぶべぼぱぴぷぺぽハヒフヘホバビブベボパピプペポ': 'bounty',
  // ま行 ── scholar（積み重ね・鼻音）
  'まみむめもマミムメモ': 'scholar',
  // や行・拗音 ── chain（連鎖・半母音）
  'やゆよゃゅょゎヤユヨャュョヮ': 'chain',
  // ら行 ── prodigy（神童・流音）
  'らりるれろラリルレロ': 'prodigy',
  // わ・を・ん・長音 ── blessing（祝詞・余韻）
  'わをんワヲンー': 'blessing',
};

// 旧 API：1個だけ返す（互換用 ・ 内部からは pickInherentPerks を使う）
function pickInherentPerk(c) {
  const ps = pickInherentPerks(c, null);
  return ps[0] || 'feather';
}

// 新 API：レアリティ × カテゴリ に応じた特性配分
// ★1-★4：basic/tag 1個
// ★5-★8：1〜2個（追加は basic）
// ★9-★12：2個＋ rare 抽選あり
// ★13-★15：2〜3個（rare 確定）
// ★16：3個 + rare 確定
function pickInherentPerks(c, rarity) {
  const result = [];

  // 1個目：音韻列（ひらがな・カタカナ）or タグ系
  let primary = null;
  for (const [row, perk] of Object.entries(KANA_ROW_PERK)) {
    if (row.includes(c)) { primary = perk; break; }
  }
  if (!primary) {
    const tags = getCharTags(c);
    for (const t of tags) {
      if (TAG_PERK_MAP[t]) { primary = TAG_PERK_MAP[t]; break; }
    }
  }
  if (!primary) {
    const basic = ['haste','feather','wide','bounty','scholar','magnet'];
    primary = basic[Math.floor(Math.random() * basic.length)];
  }
  result.push(primary);

  // 持ち数（rare 確定数 含む）
  const rIdx = rarity ? RARITY_TIERS.indexOf(rarity) : 0;
  let extraBasic = 0;
  let extraRare = 0;
  if (rIdx >= 4 && rIdx < 8) {
    extraBasic = (Math.random() < 0.5 ? 1 : 0);
  } else if (rIdx >= 8 && rIdx < 12) {
    extraBasic = 1;
    extraRare = (Math.random() < 0.4 ? 1 : 0);
  } else if (rIdx >= 12 && rIdx < 15) {
    extraBasic = 1;
    extraRare = 1 + (Math.random() < 0.3 ? 1 : 0);
  } else if (rIdx >= 15) {  // ★16
    extraBasic = 1;
    extraRare = 2;
  }

  const basicPool = ['haste','feather','wide','bounty','scholar','magnet','prodigy'];
  for (let i = 0; i < extraBasic; i++) {
    const pick = basicPool[Math.floor(Math.random() * basicPool.length)];
    if (!result.includes(pick)) result.push(pick);
  }
  for (let i = 0; i < extraRare; i++) {
    const pick = RARE_PERK_POOL[Math.floor(Math.random() * RARE_PERK_POOL.length)];
    if (!result.includes(pick)) result.push(pick);
  }
  return result;
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
  // 全 perk をパーティから集める（重複あり）
  const seenPerks = new Set();
  for (const m of STATE.party.members) {
    for (const pid of (m.perks || [])) {
      if (seenPerks.has(pid)) continue;  // 同特性は1回だけ集計（Lv が共有なので）
      seenPerks.add(pid);
      const p = PERKS[pid]; if (!p) continue;
      const pw = perkPower(pid);  // Lv による倍率（1.0〜2.6+）
      switch (pid) {
        case 'haste':    agg.gravityMul *= 1 + (0.3 * pw); break;
        case 'feather':  agg.gravityMul *= 1 - (0.3 * Math.min(pw, 2.5)); agg.mergeRadiusMul *= 1 + (0.25 * pw); break;
        case 'wide':     agg.mergeRadiusMul *= 1 + (0.4 * pw); break;
        case 'bounty':   agg.dropCountAdd += Math.floor(2 * pw); break;
        case 'scholar':  agg.expMul *= 1 + (0.3 * pw); break;
        case 'prodigy':  agg.evoDiscount += 0.25 * pw; break;
        case 'magnet':   agg.magnet = true; break;
        case 'chain':    agg.chain = true; break;
        case 'blessing': agg.blessing = Math.max(1, Math.round(5 / pw)); break;
        case 'guardian': /* 既存仕様 */ break;
        case 'tag_emo':    agg.tagBonus['感情'] = (agg.tagBonus['感情']||1) + (1.0 * pw); break;
        case 'tag_learn':  agg.tagBonus['学']   = (agg.tagBonus['学']||1)   + (0.75 * pw); break;
        case 'tag_nature': agg.dropCountAdd += Math.floor(1 * pw); break;
        case 'tag_war':    agg.tagBonus['武']   = (agg.tagBonus['武']||1)   + (0.5 * pw); break;
        case 'tag_sin':    agg.dropCountAdd += Math.floor(1 * pw); break;
        case 'tag_zen':    agg.tagBonus['禅']   = (agg.tagBonus['禅']||1)   + (0.5 * pw); break;
        case 'tag_beauty': agg.instantEvoOn.push('美'); break;
        case 'tag_sacred': agg.tagBonus['神字'] = (agg.tagBonus['神字']||1) + (0.5 * pw); break;
        case 'tag_time':   agg.tagBonus['時']   = (agg.tagBonus['時']||1)   + (0.3 * pw); break;
        case 'tag_virtue': agg.tagBonus['七徳'] = (agg.tagBonus['七徳']||1) + (0.5 * pw); break;
        case 'tag_numeral': agg.expMul *= 1 + (0.05 * pw); agg.tagBonus['数字'] = (agg.tagBonus['数字']||1) + (0.3 * pw); break;
        case 'tag_english': agg.gravityMul *= 1 - (0.15 * Math.min(pw, 2)); agg.tagBonus['英語'] = (agg.tagBonus['英語']||1) + (0.3 * pw); break;
        case 'tag_order':   agg.expMul *= 1 + (0.10 * pw); break;
        // ─── レア特性 ────────────────────────────────────────
        case 'legendary_radiance': agg.expMul *= 1 + (0.5 * pw); break;
        case 'legendary_growth':   agg.evoDiscount += 0.3 * pw; break;
        case 'legendary_link':     agg.linkBonus = (agg.linkBonus || 0) + 0.2 * pw; break;
        case 'legendary_burst':    agg.megaBurst = (agg.megaBurst || 0) + 0.1 * pw; break;
        case 'legendary_aurora':   agg.expMul *= 1 + (0.05 * perkLv(pid)); document.body?.classList.add('aurora-mode'); break;
        case 'legendary_void':     agg.voidEcho = true; break;
        case 'legendary_destiny':  agg.destinyChance = (agg.destinyChance || 0) + 0.05 * pw; break;
        case 'legendary_compass':  agg.partyDropRate = 1 + (0.3 * pw); break;
      }
    }
  }
  // 共鳴：他特性全部に +20% × power 加算
  if (agg.linkBonus) {
    const m = 1 + agg.linkBonus;
    agg.expMul *= m;
    agg.dropCountAdd = Math.floor(agg.dropCountAdd * m);
  }
  // パーティコンボボーナス（熟語成立で乗算）
  const combo = getComboBonus();
  if (combo.expMul > 1.0) {
    agg.expMul *= combo.expMul;
    agg.evoDiscount += combo.evoBoost;
    agg.activeCombos = combo.combos;
  }
  return agg;
}

// EXP 関数
const expForLevel = (lv) => Math.floor(10 * Math.pow(lv, 1.6));
const evolutionStage = (lv) => {
  // 0=未進化、1〜10=各書体段階。無限 Lv 対応（10000+ は全て stage 10）
  for (let i = EVO_STAGE_LV.length - 1; i >= 0; i--) {
    if (lv >= EVO_STAGE_LV[i]) return i + 1;
  }
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
  audioOn: false,                 // BGM オン／オフ
  userId: null,                   // 初回起動時に発行
  userCreatedAt: null,            // 発行日時
  onboardingDone: false,          // 初回オンボーディング完了
  writings: [],                   // 文章モード v0.1 ─ 保存した文章配列
  stock: {},                      // 文章モード v0.2 ─ 字の所有数 { char: N }
  perkLevels: {},                 // v4 ─ 育つ特性：perkId → ストック累計 { 'tag_emo': 23 }
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
          // 旧名 → ★1-★6 → さらに ★5-★10（v2 文字種ベース体系に押し出し）
          const oldToNew = { '拾級':'★5','五級':'★6','三級':'★7','一級':'★8','初段':'★9','拾段':'★10' };
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
    // ★1-★6 → ★5-★10 マイグレーション（既存 v30 ユーザー向け・2026-05-16）
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.party && parsed.party.members) {
          const rarityShift = { '★1':'★5', '★2':'★6', '★3':'★7', '★4':'★8', '★5':'★9', '★6':'★10' };
          let migrated = false;
          for (const m of parsed.party.members) {
            // 既に ★1-★4 が漢字でない場合（v30 旧体系）→ シフト
            if (m.rarity && rarityShift[m.rarity] && m.char && /[一-龥々〆]/.test(m.char)) {
              m.rarity = rarityShift[m.rarity];
              migrated = true;
            }
          }
          if (migrated) {
            localStorage.setItem(LS_KEY, JSON.stringify(parsed));
            raw = JSON.stringify(parsed);
          }
        }
      } catch(_) {}
    }
    if (raw) {
      const saved = JSON.parse(raw);
      STATE = Object.assign({}, DEFAULT_STATE, saved);
      // ensure nested defaults
      STATE.timer = Object.assign({}, DEFAULT_STATE.timer, saved.timer||{});
      STATE.stats = Object.assign({}, DEFAULT_STATE.stats, saved.stats||{});
      STATE.collection = saved.collection || {};
      STATE.writings   = saved.writings || [];
      STATE.stock      = saved.stock || {};
      STATE.perkLevels = saved.perkLevels || {};
    }
  } catch (e) { console.warn('loadState failed:', e); }
}

function saveState() {
  // プレビューモード中は永続化しない（他人のパーティを試している間は自分のデータを守る）
  if (_previewMode) return;
  // 初回保存時にユーザーID発行
  if (!STATE.userId) {
    STATE.userId = generateUserId();
    STATE.userCreatedAt = new Date().toISOString();
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(STATE)); }
  catch (e) { console.warn('saveState failed:', e); }
}

// ═══════════════════════════════════════════════════════════════
// ユーザーID ＋ 引継ぎコード（一般的なゲームアプリ方式）
// ═══════════════════════════════════════════════════════════════
function generateUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // O/0/I/1 を除外
  let id = 'P-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  id += '-';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function generateTransferCode() {
  const minimal = {
    v: 30,
    uid: STATE.userId,
    createdAt: STATE.userCreatedAt,
    party: STATE.party,
    collection: STATE.collection,
    stats: STATE.stats,
    cycles: STATE.cycles,
    unlockedTier: STATE.unlockedTier,
    timer: STATE.timer,
    permanentBuffs: STATE.permanentBuffs,
    audioOn: STATE.audioOn,
    issuedAt: Date.now()
  };
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(minimal))));
  } catch (e) { return ''; }
}

async function copyTransferCode() {
  const code = generateTransferCode();
  if (!code) { toast('コード生成に失敗'); return; }
  try {
    await navigator.clipboard.writeText(code);
    showTransferCodeModal(code);
    toast('引継ぎコードをコピーしました');
  } catch (e) {
    showTransferCodeModal(code);
  }
}

function showTransferCodeModal(code) {
  $$('.code-popup').forEach(e => e.remove());
  const pop = el('div', { class:'code-popup' },
    el('button', { class:'cd-close', onclick: (e) => e.target.parentElement.remove() }, '×'),
    el('h3', { class:'cp-title' }, '🔑 引継ぎコード'),
    el('p', { class:'cp-note' }, '別の端末で「コードから復元」に貼り付けてください。<br>このコードでアカウントを移行できます。'),
    el('textarea', { class:'cp-code', readonly:'readonly', rows:'5' }, code),
    el('button', { class:'btn-primary', style: { width:'100%', marginTop:'10px' },
      onclick: async () => {
        try { await navigator.clipboard.writeText(code); toast('コピーしました'); }
        catch (e) {}
      }
    }, '📋 もう一度コピー')
  );
  // innerHTML for the note (br tag)
  pop.querySelector('.cp-note').innerHTML = '別の端末で「コードから復元」に貼り付けてください。<br>このコードでアカウントを移行できます。';
  document.body.appendChild(pop);
}

function promptApplyTransferCode() {
  const code = prompt('引継ぎコードを貼り付けてください：');
  if (!code) return;
  applyTransferCode(code.trim());
}

function applyTransferCode(code) {
  let data;
  try {
    const json = decodeURIComponent(escape(atob(code)));
    data = JSON.parse(json);
  } catch (e) {
    alert('コードを読み取れませんでした。形式が違うかもしれません。');
    return false;
  }
  if (!data || data.v !== 30) {
    alert('対応していないバージョンのコードです。');
    return false;
  }
  if (!confirm(`ユーザー ${data.uid} のデータを復元します。\n現在のデータは上書きされます。続行しますか？`)) return false;
  STATE.userId = data.uid;
  STATE.userCreatedAt = data.createdAt;
  STATE.party = data.party;
  STATE.collection = data.collection || {};
  STATE.stats = Object.assign({}, DEFAULT_STATE.stats, data.stats || {});
  STATE.cycles = data.cycles || 0;
  STATE.unlockedTier = data.unlockedTier || 0;
  STATE.timer = Object.assign({}, DEFAULT_STATE.timer, data.timer || {});
  STATE.permanentBuffs = data.permanentBuffs || [];
  STATE.audioOn = !!data.audioOn;
  saveState();
  location.reload();
  return true;
}

function resetState() {
  if (!confirm('全データを消去して最初から始めますか？')) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
}

// ═══════════════════════════════════════════════════════════════
// 音響（Web Audio API・合成・ファイル不要）
// 集中=雨音（ピンクノイズ+LPF）／ 休憩=ぽこっと泡音
// ═══════════════════════════════════════════════════════════════
let audioCtx = null;
let rainSrc = null;
let rainGain = null;
let bubbleTimer = 0;

function ensureAudio() {
  if (!audioCtx) {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    } catch (e) { return null; }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// SFX：合体・進化・新発見・はじけ ・ マイルストーン
// 音響オンのときだけ鳴る ・ シンセ生成（外部ファイル不要）
function playSFX(type) {
  if (!STATE.audioOn) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;

  const playTone = (freq, dur, type='sine', vol=0.08, attack=0.005, decay=null) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + (decay || dur));
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };
  const playSweep = (f1, f2, dur, type='sine', vol=0.08) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f1, t0);
    osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  };

  switch (type) {
    case 'merge':       // 合体：上昇 chime
      playSweep(440, 880, 0.25, 'triangle', 0.10);
      playTone(660, 0.18, 'sine', 0.05, 0.005, 0.18);
      break;
    case 'evolve':      // 進化：5音アルペジオ
      [523, 659, 784, 988, 1175].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.18, 'triangle', 0.08), i * 70);
      });
      break;
    case 'discover':    // 新発見：軽い高音 chime
      playTone(880, 0.12, 'sine', 0.08);
      playTone(1175, 0.18, 'sine', 0.05);
      break;
    case 'pop':         // タップ消滅：ぽっ
      playSweep(330, 110, 0.12, 'sine', 0.06);
      break;
    case 'milestone':   // マイルストーン達成：和音
      [523, 659, 784].forEach(f => playTone(f, 0.6, 'sine', 0.06, 0.01, 0.55));
      setTimeout(() => playTone(1175, 0.5, 'triangle', 0.05), 200);
      break;
    case 'cycle':       // ポモドーロ完了：祝祭
      [392, 494, 587, 784].forEach((f, i) => {
        setTimeout(() => playTone(f, 0.4, 'triangle', 0.08), i * 100);
      });
      break;
    case 'unlock':      // ★解放：低→高の華やか上昇
      playSweep(220, 880, 0.4, 'sawtooth', 0.06);
      setTimeout(() => playTone(1175, 0.3, 'sine', 0.05), 150);
      break;
  }
}

function makePinkNoise(ctx) {
  // 2秒ぶんのピンクノイズバッファ
  const bufferSize = 2 * ctx.sampleRate;
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0+b1+b2+b3+b4+b5+b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buf;
}

function startRainAudio() {
  if (!STATE.audioOn) return;
  const ctx = ensureAudio();
  if (!ctx || rainSrc) return;
  const buf = makePinkNoise(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 2200;
  lpf.Q.value = 0.7;
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 250;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 1.8);
  src.connect(hpf); hpf.connect(lpf); lpf.connect(gain); gain.connect(ctx.destination);
  src.start();
  rainSrc = src;
  rainGain = gain;
}

function stopRainAudio() {
  if (!rainSrc || !rainGain || !audioCtx) return;
  try {
    rainGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  } catch (e) {}
  const src = rainSrc;
  setTimeout(() => {
    try { src.stop(); } catch (e) {}
  }, 900);
  rainSrc = null;
  rainGain = null;
}

function playBubblePop() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const base = 500 + Math.random() * 500;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(base, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(base * 0.45, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + 0.16);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.18);
}

function startBubbleAudio() {
  if (!STATE.audioOn) return;
  stopBubbleAudio();
  // 1.2〜2.4 秒間隔で時々ぽこっ
  bubbleTimer = setInterval(() => {
    if (STATE.mode === 'rest' && Math.random() < 0.5) playBubblePop();
  }, 1400);
}

function stopBubbleAudio() {
  if (bubbleTimer) { clearInterval(bubbleTimer); bubbleTimer = 0; }
}

function refreshAudioByMode() {
  if (!STATE.audioOn) {
    stopRainAudio(); stopBubbleAudio(); return;
  }
  if (STATE.mode === 'work') {
    stopBubbleAudio();
    startRainAudio();
  } else if (STATE.mode === 'rest') {
    stopRainAudio();
    startBubbleAudio();
  } else {
    stopRainAudio(); stopBubbleAudio();
  }
}

function toggleAudio() {
  STATE.audioOn = !STATE.audioOn;
  saveState();
  updateAudioButton();
  if (STATE.audioOn) {
    ensureAudio();              // ユーザージェスチャで AudioContext 起動
    refreshAudioByMode();
    toast('🔊 音響オン（雨と泡）');
  } else {
    stopRainAudio();
    stopBubbleAudio();
    toast('🔇 音響オフ');
  }
}

function updateAudioButton() {
  // 旧ヘッダー（残ってる場合のみ）
  const emoji = $('#btn-audio .ib-emoji');
  if (emoji) emoji.textContent = STATE.audioOn ? '🔊' : '🔇';
  // 新ドロワーメニュー
  const mEmoji = $('#m-audio-emoji');
  if (mEmoji) mEmoji.textContent = STATE.audioOn ? '🔊' : '🔇';
  const mState = $('#m-audio-state');
  if (mState) mState.textContent = STATE.audioOn ? 'オン' : 'オフ';
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

// ═══════════════════════════════════════════════════════════════
// パーティコンボ ── 主人公+仲間の字組み合わせが熟語と一致したら発動
// 公式構想：4体パーティで「春夏秋冬」「諸行無常」等の四字熟語コンボ
// ═══════════════════════════════════════════════════════════════
function detectPartyCombos() {
  if (!STATE.party || !STATE.party.members.length) return [];
  const partyChars = STATE.party.members.map(m => m.char);
  const partySet = new Set(partyChars);
  const recipes = window.YOJI_RECIPES || [];
  const matches = [];
  for (const r of recipes) {
    if (!r.chars || r.chars.length === 0) continue;
    // r.chars すべてがパーティに含まれるか
    if (r.chars.every(c => partySet.has(c))) {
      matches.push(r);
    }
  }
  // レア順（高い順）→ 字数（多い順）でソート
  matches.sort((a,b) => {
    const ra = RARITY_TIERS.indexOf(a.rarity);
    const rb = RARITY_TIERS.indexOf(b.rarity);
    if (ra !== rb) return rb - ra;
    return b.chars.length - a.chars.length;
  });
  return matches;
}

// コンボのボーナス倍率合計（EXP × multiplier ＋ 進化加速）
function getComboBonus() {
  const combos = detectPartyCombos();
  let expMul = 1.0;
  let evoBoost = 0;
  for (const r of combos) {
    const n = r.chars.length;
    if (n === 2)      expMul += 0.10;  // 二字熟語：EXP +10%
    else if (n === 3) expMul += 0.30;  // 三字熟語：EXP +30%
    else if (n === 4) { expMul += 0.60; evoBoost += 0.10; }  // 四字熟語：EXP +60% & 進化加速
    else if (n >= 5)  { expMul += 1.0;  evoBoost += 0.20; }  // 五字以上：EXP +100% & 大加速
  }
  return { combos, expMul, evoBoost };
}

// パーティ Lv up / 編成変更時にチェック ── 初発動なら祝祭演出
let _comboPrev = new Set();
function checkComboPickup() {
  const combos = detectPartyCombos();
  const current = new Set(combos.map(r => r.word));
  // 新規発動した熟語
  for (const r of combos) {
    if (!_comboPrev.has(r.word)) {
      // 初発動
      spawnComboBurst(r);
      playSFX(r.chars.length >= 4 ? 'milestone' : 'merge');
      toast(`⚡ コンボ発動「${r.word}」 ${r.desc || ''}`, r.rarity);
    }
  }
  _comboPrev = current;
}

// コンボ発動演出（画面中央バースト）
function spawnComboBurst(recipe) {
  const field = $('#play-field');
  if (!field) return;
  const W = window.innerWidth, H = window.innerHeight;
  const rIdx = RARITY_TIERS.indexOf(recipe.rarity);
  const node = el('div', {
    class: `combo-burst rarity-${rIdx + 1}`,
    style: { left: (W/2 - 150) + 'px', top: (H/2 - 70) + 'px' },
  },
    el('div', { class:'cb-label' }, '⚡ コンボ発動'),
    el('div', { class:'cb-word' }, recipe.word),
    recipe.desc ? el('div', { class:'cb-desc' }, recipe.desc) : null,
  );
  field.appendChild(node);
  setTimeout(() => node.remove(), 2200);
}

// リーダー（主人公）の Lv ── 落下プール tier の判定基準（v3 / 2026-05-16）
function partyHeroLevel() {
  if (!STATE.party || !STATE.party.members.length) return 0;
  const heroIdx = STATE.party.hero || 0;
  const hero = STATE.party.members[heroIdx];
  return hero ? hero.level : 0;
}

function currentDropTier() {
  // リーダー Lv 基準で帯を決める（旧：パーティ平均）
  const lv = partyHeroLevel();
  let band = 0;
  for (let i = 0; i < RARITY_TIERS.length; i++) {
    if (lv >= UNLOCK_LV[RARITY_TIERS[i]]) band = i;
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
      playSFX('unlock');
    }, 400);
  }
}

function partyContainsChar(c) {
  if (!STATE.party) return -1;
  return STATE.party.members.findIndex(m => m.char === c);
}

function isPartyChosen() {
  return STATE.party && STATE.party.members && STATE.party.members.length >= 1 && STATE.party.hero !== null && STATE.party.hero !== undefined;
}

function awardExpToParty(c, exp, opts={}) {
  const idx = partyContainsChar(c);
  if (idx < 0) return false;
  const agg = aggregatePartyPerks();
  let mul = agg.expMul || 1.0;
  if (opts.tagMatch) mul *= 1.5;
  const tags = getCharTags(c);
  for (const t of tags) {
    if (agg.tagBonus[t]) mul *= agg.tagBonus[t];
  }
  const actualExp = Math.floor(exp * mul);
  const m = STATE.party.members[idx];
  m.exp += actualExp;
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + actualExp;
  if (idx !== STATE.party.hero && STATE.party.members[STATE.party.hero]?.perks?.includes('guardian')) {
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
  updatePartyXpUI();   // ← 毎回 XP バー更新
  return true;
}

// XP バーと Lv だけを更新（軽量・renderParty を全再描画しない）
function updatePartyXpUI() {
  if (!STATE.party) return;
  STATE.party.members.forEach((m, idx) => {
    const card = document.querySelector(`.party-card[data-idx="${idx}"]`);
    if (!card) return;
    const needExp = expForLevel(m.level + 1);
    const pct = Math.min(100, (m.exp / needExp) * 100);
    const fill = card.querySelector('.pc-fill');
    if (fill) fill.style.width = pct + '%';
    const lvEl = card.querySelector('.pc-lv');
    if (lvEl) lvEl.textContent = 'Lv.' + m.level;
  });
}

function onLevelUp(member, idx) {
  // 書体進化を判定（前 Lv との比較）
  const prevStage = evolutionStage(member.level - 1);
  const newStage  = evolutionStage(member.level);
  const evolved = (newStage > prevStage);

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

  // 書体進化時 ── 派手な祝祭演出（フィールド全体に光放射）
  if (evolved) {
    const stageNames = ['', '楷書', '行書', '草書', '篆書', '甲骨', '神代文字', '超越', '星屑', '神話', '創造主'];
    const glyph = EVO_GLYPH[newStage] || '𓂀';
    toast(`${glyph} 書体進化「${stageNames[newStage] || ''}」 ${member.char}`, '★16');
    spawnEvolutionBurst(member.char, glyph, member.rarity);
    playSFX('evolve');
  }
}

// 書体進化のフィールドバースト（中央に大きく字＋光が放射）
function spawnEvolutionBurst(char, glyph, rarity) {
  const field = $('#play-field');
  if (!field) return;
  const W = window.innerWidth, H = window.innerHeight;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const node = el('div', {
    class: `evolution-burst rarity-${rIdx + 1}`,
    style: { left: (W/2 - 60) + 'px', top: (H/2 - 90) + 'px' },
  }, char, el('span', { class:'eb-glyph' }, glyph));
  field.appendChild(node);
  setTimeout(() => node.remove(), 1700);
}

// ═══════════════════════════════════════════════════════════════
// 初回オンボーディング（世界観 → パーティ選択）
// ═══════════════════════════════════════════════════════════════
let _obStep = 1;
const _obMaxStep = 4;
function openOnboarding() {
  _obStep = 1;
  showOnboardingStep();
  $('#onboarding-modal').classList.add('show');
}
function showOnboardingStep() {
  $$('.ob-step').forEach(s => s.hidden = (parseInt(s.dataset.step) !== _obStep));
  $$('.ob-dot').forEach(d => d.classList.toggle('active', parseInt(d.dataset.dot) === _obStep));
  $('#ob-next').textContent = (_obStep === _obMaxStep) ? '始める →' : '次へ →';
}
function obNext() {
  if (_obStep < _obMaxStep) {
    _obStep += 1;
    showOnboardingStep();
  } else {
    finishOnboarding();
  }
}
function obSkip() {
  finishOnboarding();
}
function finishOnboarding() {
  STATE.onboardingDone = true;
  saveState();
  $('#onboarding-modal').classList.remove('show');
  if (!isPartyChosen()) {
    setTimeout(() => openPartyPicker(), 300);
  }
}

// ═══════════════════════════════════════════════════════════════
// パーティ選択モーダル
// ═══════════════════════════════════════════════════════════════
let _pickerPool = null;
let _pickerSelected = null;

function openPartyPicker() {
  if (!window.KANJI_CODEX) {
    setTimeout(openPartyPicker, 200);
    return;
  }
  rerollPickerPool();
  renderPickerPool();
  $('#party-picker-modal').classList.add('show');
}

function rerollPickerPool() {
  _pickerPool = (window.KANJI_CODEX || [])
    .filter(k => k.rarity === '★1')
    .sort(() => Math.random() - 0.5)
    .slice(0, PARTY_PICKER_POOL_SIZE);
  _pickerSelected = null;
}

function renderPickerPool() {
  const grid = $('#party-picker-grid');
  const status = $('#party-picker-status');
  const confirmBtn = $('#party-picker-confirm');
  grid.innerHTML = '';

  _pickerPool.forEach(k => {
    const c = k.char || k.c;
    const card = el('div', {
      class: 'pp-card' + (_pickerSelected === c ? ' picked hero' : ''),
      dataset: { char: c },
      onclick: () => {
        // 単一選択（ラジオ）
        _pickerSelected = (_pickerSelected === card.dataset.char) ? null : card.dataset.char;
        $$('.pp-card').forEach(x => {
          x.classList.toggle('picked', x.dataset.char === _pickerSelected);
          x.classList.toggle('hero',   x.dataset.char === _pickerSelected);
        });
        refreshPickerStatus();
      }
    },
      el('div', { class:'pp-char' }, c),
      el('div', { class:'pp-rarity' }, k.rarity),
    );
    grid.appendChild(card);
  });
  refreshPickerStatus();

  function refreshPickerStatus() {
    if (_pickerSelected) {
      const k = _pickerPool.find(p => (p.char||p.c) === _pickerSelected);
      // 決定論的に primary 特性をプレビュー（ランダム要素なし）
      const primary = pickInherentPerk(_pickerSelected);
      const pName = PERKS[primary]?.name || '—';
      const pDesc = PERKS[primary]?.desc || '';
      status.innerHTML = `
        主人公候補：<strong style="font-size:1.1rem">${_pickerSelected}</strong>（${k.rarity}）<br>
        基本特性：<strong style="color:var(--gold)">${pName}</strong>＋<strong style="color:#ffb888">守護</strong>（主人公専用）<br>
        <small style="color:var(--ink-mute);font-size:.7rem">${pDesc}</small>
      `;
      confirmBtn.disabled = false;
    } else {
      status.textContent = 'タップして 1 体選ぶ';
      confirmBtn.disabled = true;
    }
  }

  confirmBtn.onclick = () => {
    if (!_pickerSelected) return;
    const c = _pickerSelected;
    const k = _pickerPool.find(p => (p.char||p.c) === c);
    const perks = pickInherentPerks(c, k.rarity);
    if (!perks.includes('guardian')) perks.push('guardian');
    const hero = { char: c, rarity: k.rarity, level: 1, exp: 0, perks };
    STATE.party = { hero: 0, members: [hero] };
    saveState();
    $('#party-picker-modal').classList.remove('show');
    renderParty();
    const perkNames = perks.map(p => PERKS[p]?.name).filter(Boolean).join('・');
    toast(`主人公 ${c} ── ${perkNames}`);
  };
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
  spawnPartyPersistents();   // パーティ字を1つずつ永続スポーン（重複防止あり）
  startWorkSpawning();
  refreshAudioByMode();
  tick();
}

// パーティ字（主人公＋仲間）を 1 つずつ永続スポーン
// 既に画面上にいる持続字はスキップ
function spawnPartyPersistents() {
  if (!STATE.party || !STATE.party.members) return;
  const codex = window.KANJI_CODEX || [];
  // 現存する persistent の char セット
  const existing = new Set(
    Array.from(livePomoji.values()).filter(p => p.persistent).map(p => p.char)
  );
  const W = window.innerWidth;
  let idx = 0;
  for (const m of STATE.party.members) {
    if (existing.has(m.char)) continue;
    const k = codex.find(c => (c.char || c.c) === m.char) || { char: m.char, c: m.char, rarity: m.rarity };
    // 横方向に均等配置（パーティ4体なら 1/5, 2/5, 3/5, 4/5）
    const slot = (idx + 1) / (STATE.party.members.length + 1);
    const x = Math.round(slot * W) - SIZE/2;
    // 時間差で1つずつ降らせる
    setTimeout(() => spawnPomoji({ kanji: k, x, persistent: true }), 200 * idx);
    idx++;
  }
}

// 作業中の継続落下：10秒に1粒（3粒に1回はパーティ字保証）
const WORK_SPAWN_INTERVAL_MS = 10000;
let workSpawnTimer = 0;
let workDropCount = 0;

function startWorkSpawning() {
  stopWorkSpawning();
  workDropCount = 0;
  // 最初の1粒は即落下（ユーザーが反応見られる）
  setTimeout(workSpawnTick, 800);
  workSpawnTimer = setInterval(workSpawnTick, WORK_SPAWN_INTERVAL_MS);
}
function stopWorkSpawning() {
  if (workSpawnTimer) { clearInterval(workSpawnTimer); workSpawnTimer = 0; }
}
function workSpawnTick() {
  if (STATE.mode !== 'work') return;
  workDropCount++;
  let k;
  if (STATE.party && workDropCount % 3 === 0) {
    k = pickPartyDrop();
  } else {
    k = pickKanjiForDrop();
  }
  if (k) spawnPomoji({ kanji: k });
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
  refreshAudioByMode();
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
  stopWorkSpawning();
  stopRainAudio();
  stopBubbleAudio();
}

function resumeTimer() {
  STATE.phaseEnd = Date.now() + STATE.pausedRemaining;
  if (document.body.dataset.mode === 'rest') {
    STATE.mode = 'rest';
    startRisingPomoji();
  } else {
    STATE.mode = 'work';
    startWorkSpawning();
  }
  $('#main-btn').textContent = '⏸ 一時停止';
  $('#main-btn').dataset.state = 'running';
  saveState();
  refreshAudioByMode();
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
  stopWorkSpawning();
}

function completePhase() {
  if (STATE.mode === 'work') {
    STATE.cycles += 1;
    STATE.stats.totalCycles += 1;
    stopWorkSpawning();
    spawnCycleDrops();
    updateProgressPill();
    flashCompletionBurst('☔ 凝縮 完了');
    burstPartyPersistents();
    playSFX('cycle');
    writeSharedRbJikoku();   // 5本柱接続：時刻メトリクスを共有
    startRest();
  } else if (STATE.mode === 'rest') {
    flashCompletionBurst('🫧 発散 完了');
    stopRisingPomoji();
    stopTimer();
    writeSharedRbJikoku();
  }
}

// 5本柱接続（RBAI 公式構想）── shared_rb_jikoku に時刻メトリクスを書き出し
// 雨域 (UIKI) / マネぼう / YouTube が将来この localStorage を読んで連携
function writeSharedRbJikoku() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const hero = isPartyChosen() ? STATE.party.members[STATE.party.hero || 0] : null;
    const data = {
      app: 'pomojikan',
      version: 'v30.5',
      date: today,
      last_updated: new Date().toISOString(),
      cycles_total:      STATE.stats?.totalCycles || 0,
      drops_total:       STATE.stats?.totalDrops || 0,
      exp_total:         STATE.stats?.totalExp || 0,
      chars_discovered:  Object.keys(STATE.collection || {}).length,
      stock_total:       Object.values(STATE.stock || {}).reduce((a,b)=>a+b, 0),
      writings_total:    (STATE.writings || []).length,
      hero_char:         hero?.char || null,
      hero_level:        hero?.level || 0,
      hero_rarity:       hero?.rarity || null,
      unlocked_tier:     RARITY_TIERS[STATE.unlockedTier] || null,
      user_id:           STATE.userId || null,
    };
    localStorage.setItem('shared_rb_jikoku', JSON.stringify(data));
  } catch(_) {}
}

// パーティ字（永続）にサイクル完了の光放射を一斉発火
function burstPartyPersistents(){
  for (const p of livePomoji.values()){
    if (p.persistent && p.el){
      p.el.classList.add('cycle-burst');
      setTimeout(() => p.el?.classList.remove('cycle-burst'), 1700);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 休憩フェーズ：作業中に貯めたぽもじを泡化 → 浮上 → EXP化
// 「集中で貯めて、休憩で育つ」
// ═══════════════════════════════════════════════════════════════
function startRisingPomoji() {
  // 着底済の全ぽもじを順番に泡化
  const settled = Array.from(livePomoji.values())
    .filter(p => p.settled && !p.dragging && !p.rising)
    .sort((a, b) => a.y - b.y); // 上にあるものから（演出順）
  if (settled.length === 0) {
    toast('泡にする字がない（集中で貯めよう）');
    return;
  }
  settled.forEach((p, i) => {
    setTimeout(() => convertToRising(p), i * 180);
  });
  toast(`${settled.length}粒の字が育つ`);
}
function stopRisingPomoji() {
  // 上昇中の字を着底に戻す（一時停止用）— 実装簡略：そのまま継続でOK
}
function convertToRising(p) {
  if (!p.el || !livePomoji.has(p.id)) return;
  p.rising = true;
  p.settled = false;
  p.vy = -1.4 - Math.random() * 0.8;
  p.vx = (Math.random() - 0.5) * 0.6;
  p.el.classList.add('rising');
  // タップでも弾ける（即時 EXP 化）
  p.el.onpointerdown = (e) => { e.preventDefault(); awardRising(p); };
}
function awardRising(p) {
  const rIdx = RARITY_TIERS.indexOf(p.rarity);
  const exp = Math.max(1, Math.pow(2, rIdx) * 6);
  const tankRect = $('#tank').getBoundingClientRect();
  spawnXpFloat(p.x + SIZE/2, Math.max(20, p.y), exp, p.rarity);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  p.el.classList.add('burst');
  setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 500);
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
  // ★1〜現在の unlockedTier 全部のプールから重み付き抽選
  // POMOJI_RARITY[r].weight に応じて高 tier ほど低確率
  const codex = window.KANJI_CODEX || [];
  const rarityMeta = window.POMOJI_RARITY || {};
  const allowedTiers = RARITY_TIERS.slice(0, STATE.unlockedTier + 1);
  if (!allowedTiers.length) return null;
  // tier ごとの重みを累積
  const weighted = [];
  let total = 0;
  for (const tierName of allowedTiers) {
    const w = (rarityMeta[tierName]?.weight) || 1;
    total += w;
    weighted.push({ tier: tierName, cum: total });
  }
  // 累積重みで抽選 → その tier の中からランダム1字
  const r = Math.random() * total;
  let chosenTier = allowedTiers[0];
  for (const w of weighted) {
    if (r <= w.cum) { chosenTier = w.tier; break; }
  }
  const pool = codex.filter(k => k.rarity === chosenTier);
  if (!pool.length) {
    // フォールバック：全許可 tier から
    const fallback = codex.filter(k => allowedTiers.includes(k.rarity));
    return fallback.length ? choose(fallback) : null;
  }
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

// ぽもじ上限（負荷管理：persistent パーティ字を除いて 30体超えたら最古を消滅）
const MAX_LIVE_POMOJI = 30;
// 一般ぽもじ寿命：5分（300 秒）。経過したら経験値吸収して消える
const POMOJI_LIFETIME_MS = 5 * 60 * 1000;

function enforcePomojiCap() {
  // persistent は除外して数える
  const nonPersistent = Array.from(livePomoji.values()).filter(p => !p.persistent);
  if (nonPersistent.length <= MAX_LIVE_POMOJI) return;
  const settled = nonPersistent.filter(p => p.settled && !p.dragging && !p.rising);
  settled.sort((a,b) => a.id - b.id);
  const toRemove = nonPersistent.length - MAX_LIVE_POMOJI;
  for (let i = 0; i < toRemove && i < settled.length; i++) {
    expireAsExp(settled[i]);
  }
}

// 寿命切れ／キャップ越え：経験値として吸収して消す
function expireAsExp(p) {
  if (!p || p._expiring) return;
  p._expiring = true;
  const rIdx = RARITY_TIERS.indexOf(p.rarity);
  const exp = Math.max(1, Math.pow(2, rIdx) * 2);  // dissolve より控えめ（自然吸収）
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  addStock(p.char);  // ストックに加算
  if (p.el) {
    p.el.classList.add('dissolve');
    spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, p.rarity);
  }
  setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 600);
}

function spawnPomoji(opts={}) {
  const k = opts.kanji || pickKanjiForDrop();
  if (!k) return;
  enforcePomojiCap();
  const field = $('#play-field');
  const W = window.innerWidth, H = window.innerHeight;
  const id = ++pomojiSeq;
  const char = k.char || k.c;
  const rarity = k.rarity;
  const tierIdx = RARITY_TIERS.indexOf(rarity);
  const tierClass = `rarity-${tierIdx + 1}`;
  const x = (opts.x != null) ? opts.x : (40 + Math.random() * (W - 80));
  const y = (opts.y != null) ? opts.y : -40;

  let styleClass = 'kai';
  let evoStage = 0;
  let partyLv = 0;
  const partyIdx = partyContainsChar(char);
  if (partyIdx >= 0) {
    partyLv = STATE.party.members[partyIdx].level;
    evoStage = evolutionStage(partyLv);
    styleClass = EVO_STYLE[evoStage] || 'kai';
  }

  const isFirstSee = !STATE.collection[char];

  // パーティ字で高 Lv なら追加グロー（対数スケール ・ 無限対応）
  const styleObj = { left: x+'px', top: y+'px' };
  if (partyLv > 50) {
    const glow = lvGlowRadius(partyLv);
    styleObj.filter = `drop-shadow(0 0 ${glow}px var(--r-color))`;
  }

  const node = el('div', {
    class: `pomoji ${tierClass} font-${styleClass}${evoStage > 0 ? ` evo-${evoStage}` : ''}`,
    dataset: { id, char, rarity, tier: tierIdx, evo: evoStage },
    style: styleObj
  }, char);
  field.appendChild(node);

  const obj = {
    id, char, rarity, tier: tierIdx, x, y,
    vx: (Math.random()-0.5)*1.0, vy: 0,
    el: node, settled: false, isFirstSee, mergeLevel: 1,
    persistent: !!opts.persistent,
    spawnedAt: Date.now(),
  };
  if (obj.persistent) node.classList.add('persistent');
  livePomoji.set(id, obj);
  attachDragHandlers(node, obj);

  STATE.stats.totalDrops += 1;
  STATE.collection[char] = (STATE.collection[char] || 0) + 1;

  // 新発見：一瞬通知 ＋ 二軸レベルの「発見ボーナス EXP」をパーティ全員に配分
  if (isFirstSee) {
    toast(`新！ ${char}`, rarity);
    playSFX('discover');
    grantDiscoveryBonus(rarity, char);
  }
  return obj;
}

// 新発見ボーナス：字種を集める動機を作る（v40 俳句構想の前倒し）
// rarity が高いほど大きい一回限りの EXP がパーティ全員に入る
function grantDiscoveryBonus(rarity, char) {
  if (!STATE.party || !STATE.party.members) return;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const bonus = 3 + Math.pow(2, rIdx);  // ★1=4 ★3=7 ★5=19 ★10=515
  // 累計発見数 milestones（10 / 50 / 100 / 300 / 600 / 874）で追加ボーナス
  const uniq = Object.keys(STATE.collection).length;
  let milestoneMul = 1;
  if (uniq === 10)  milestoneMul = 3;
  if (uniq === 50)  milestoneMul = 5;
  if (uniq === 100) milestoneMul = 8;
  if (uniq === 300) milestoneMul = 15;
  if (uniq === 600) milestoneMul = 25;
  if (uniq === 874) milestoneMul = 100;
  const total = bonus * milestoneMul;

  // パーティ全員に均等配分（最低1）
  const perMember = Math.max(1, Math.floor(total / STATE.party.members.length));
  for (let i = 0; i < STATE.party.members.length; i++) {
    const m = STATE.party.members[i];
    m.exp = (m.exp || 0) + perMember;
    while (m.exp >= expForLevel(m.level + 1)) {
      m.exp -= expForLevel(m.level + 1);
      m.level += 1;
      onLevelUp(m, i);
    }
  }
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + total;

  if (milestoneMul > 1) {
    toast(`✦ 発見 ${uniq} 種達成！ ボーナス ×${milestoneMul}`, rarity);
    spawnMilestoneBurst(uniq, milestoneMul);
    playSFX('milestone');
  }
  updatePartyXpUI();
  renderParty();
}

// 新発見マイルストーン祝祭（画面中央に大数字 + ベル + 光放射）
function spawnMilestoneBurst(uniq, mul) {
  const field = $('#play-field');
  if (!field) return;
  const W = window.innerWidth, H = window.innerHeight;
  const node = el('div', {
    class: 'milestone-burst',
    style: { left: (W/2 - 130) + 'px', top: (H/2 - 80) + 'px' },
  },
    el('div', { class: 'mb-num' }, String(uniq)),
    el('div', { class: 'mb-label' }, '種 発見'),
    el('div', { class: 'mb-mul' }, `ボーナス ×${mul}`),
  );
  field.appendChild(node);
  setTimeout(() => node.remove(), 2500);
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
  // 祝詞 perk: 5サイクル毎に上位レア追加（未解放の1つ上から1粒だけドラマ的に贈る）
  if (agg.blessing && STATE.cycles > 0 && STATE.cycles % agg.blessing === 0) {
    const higherTier = Math.min(RARITY_TIERS.length - 1, tier + 1);
    const higherPool = (window.KANJI_CODEX||[]).filter(k => k.rarity === RARITY_TIERS[higherTier]);
    if (higherPool.length) drops.push(choose(higherPool));
  }
  dropCascade(drops, 220, 420);
  saveState();
}

// ═══════════════════════════════════════════════════════════════
// 物理 + 衝突 (rAF loop)
// ═══════════════════════════════════════════════════════════════
const DAMP = 0.75;
const SIZE = SIZE_BASE;
let physicsRaf = 0;
function physicsStep() {
  const W = window.innerWidth, H = window.innerHeight;
  // perk 適用
  const agg = aggregatePartyPerks();
  for (const p of livePomoji.values()) {
    if (p.dragging) continue;
    // settled な字は位置固定（穴：他字に押されて動く問題の解消）
    if (p.settled && !p.rising) {
      // 万一座標がズレていたら元に戻す
      if (p.settledX != null) { p.x = p.settledX; }
      if (p.settledY != null) { p.y = p.settledY; }
      p.vx = 0; p.vy = 0;
      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';
      continue;
    }
    if (p.rising) {
      // 上昇ぽもじ：軽い揺らぎ＋ゆっくり浮上
      p.vx += (Math.random() - 0.5) * 0.08;
      p.vx *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W - SIZE) p.vx *= -0.7;
      // 天井到達 → 自動 EXP 化（育成の本体）
      if (p.y < -SIZE) {
        if (!p._awarded) {
          p._awarded = true;
          awardRising(p);
        }
        continue;
      }
      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';
      continue;
    }
    // 寿命チェック：一般字（非persistent）は 5分で自動吸収
    if (!p.persistent && p.spawnedAt && (Date.now() - p.spawnedAt) > POMOJI_LIFETIME_MS) {
      expireAsExp(p);
      continue;
    }
    // 落下ぽもじ：重力＋円形ソフトボディ衝突（控えめ弾性／ゆっくり転がる）
    const tierMul = TIER_FALL_MUL[p.tier] || 1.0;
    p.vy += GRAVITY_BASE * tierMul * (agg.gravityMul || 1.0);
    if (p.vy > MAX_FALL_VY) p.vy = MAX_FALL_VY;
    // 空気摩擦（vx 緩減衰：転がりを残す）
    p.vx *= 0.99;
    if (Math.abs(p.vx) < 0.015) p.vx = 0;
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0)         { p.x = 0;         p.vx *= -0.4; }
    if (p.x > W - SIZE)  { p.x = W - SIZE;  p.vx *= -0.4; }

    // 餅同士の衝突（円形ソフトボディ ── 落下中の自分だけが動く）
    for (const other of livePomoji.values()) {
      if (other.id === p.id || other.rising) continue;
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = SIZE * 0.94;
      if (dist > 0 && dist < minDist) {
        // 同字なら自動合体（落下中の上→下のときだけ）
        if (other.char === p.char && p.vy > 0 && !p._merging
            && !other.dragging && Math.abs(dx) < SIZE * 0.5 && dy < 0) {
          p._merging = true;
          mergePomoji(p, other);
          break;
        }
        // 押し離しベクトル
        const overlap = minDist - dist;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // 相手が settled/persistent/dragging のいずれかなら不動 ── 自分だけが動く
        const otherStatic = other.dragging || other.persistent || other.settled;
        const myShare    = otherStatic ? 1.0 : 0.55;
        const otherShare = otherStatic ? 0.0 : 0.45;
        p.x += nx * overlap * myShare;
        p.y += ny * overlap * myShare;
        if (!otherStatic) {
          other.x -= nx * overlap * otherShare;
          other.y -= ny * overlap * otherShare;
        }
        // 上から落ちて来た場合の力交換（軽め）
        const relVy = p.vy - (other.vy || 0);
        if (relVy > 0 && dy < 0) {
          p.vy = -relVy * 0.18;
          if (!otherStatic) other.vy += relVy * 0.10;
          // 接線方向 ── 真上から落ちてきた時だけ少し横へ転がる
          if (Math.abs(nx) > 0.1) {
            p.vx += nx * 0.4;
          }
        }
      }
    }

    // 床への着地（控えめバウンド → 静止）
    if (p.y > H - SIZE) {
      p.y = H - SIZE;
      if (Math.abs(p.vy) > 1.6) {
        p.vy *= -0.22;
        squashEl(p, 'squash');
      } else {
        p.vy = 0;
        p.vx = 0;
        if (!p.settled && agg.magnet) attractSameChar(p);
        if (!p.settled) {
          p.el.classList.add('settled');
          squashEl(p, 'squash');
        }
        p.settled = true;
        // 安定位置を記録（毎フレームここに戻すことで他字に押されても動かない）
        p.settledX = p.x;
        p.settledY = p.y;
      }
    }
    // 他字の上に積まれて着地している場合も settledX/Y を記録
    if (p.settled && p.settledX == null) {
      p.settledX = p.x;
      p.settledY = p.y;
    }
    p.el.style.left = p.x + 'px';
    p.el.style.top  = p.y + 'px';
  }
  physicsRaf = requestAnimationFrame(physicsStep);
}

// 着地の瞬間だけ squash クラスを付ける（連発防止：500ms 以内は無視）
function squashEl(p, cls) {
  if (!p || !p.el) return;
  if (cls !== 'squash') return;  // bumped は無効化（物理だけで十分）
  const now = Date.now();
  if (p._lastSquashAt && now - p._lastSquashAt < 500) return;
  p._lastSquashAt = now;
  p.el.classList.add(cls);
  setTimeout(() => p.el?.classList.remove(cls), 350);
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
  let onMove = null, onUp = null;

  const startDrag = (e) => {
    if (obj.dragging) return;
    e.preventDefault();
    e.stopPropagation();
    pointerId = e.pointerId;
    try { node.setPointerCapture(pointerId); } catch(_) {}
    obj.dragging = true;
    obj.vy = 0; obj.vx = 0;
    // ドラッグ開始：settled を解除し、再着地で新しい位置に固定される
    obj.settled = false;
    obj.settledX = null;
    obj.settledY = null;
    obj.el.classList.remove('settled');
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    origX = obj.x; origY = obj.y;
    node.classList.add('dragging');
    // setPointerCapture が効かない環境向け：document に bind して追従保証
    onMove = (ev) => {
      if (!obj.dragging) return;
      if (ev.pointerId !== pointerId) return;
      ev.preventDefault();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      obj.x = origX + dx;
      obj.y = origY + dy;
      node.style.left = obj.x + 'px';
      node.style.top  = obj.y + 'px';
      const target = checkMergeCollision(obj);
      $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));
      if (target) target.el.classList.add('merge-glow');
    };
    onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      try { node.releasePointerCapture(pointerId); } catch(_) {}
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      pointerId = null;
      obj.dragging = false;
      obj.vy = 0; obj.vx = 0;
      node.classList.remove('dragging');
      $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));
      if (!moved) {
        dissolvePomoji(obj);
        return;
      }
      const target = checkMergeCollision(obj);
      if (target) mergePomoji(obj, target);
    };
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup',   onUp);
    document.addEventListener('pointercancel', onUp);
  };

  node.addEventListener('pointerdown', startDrag);
}

function dissolvePomoji(p) {
  // パーティ字（persistent）は消えない ── 軽くハイライトだけ
  if (p.persistent) {
    p.el.classList.add('persistent-bump');
    setTimeout(() => p.el.classList.remove('persistent-bump'), 400);
    return;
  }
  const rarity = p.rarity;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const exp = Math.max(1, Math.pow(2, rIdx) * 3);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
  addStock(p.char);  // ストックに加算（文章モードで使える）
  playSFX('pop');
  p.el.classList.add('dissolve');
  setTimeout(() => { p.el.remove(); livePomoji.delete(p.id); }, 600);
}

// 字のストック加算（v4 ─ 育つ特性連動）
// ストック増加で：
//   1. パーティ字 EXP +少量
//   2. パーティ全員が持つ perk のうち、この字に関連するものの「Lv（=ストック累計）」+1
function addStock(char) {
  if (!STATE.stock) STATE.stock = {};
  if (!STATE.perkLevels) STATE.perkLevels = {};
  STATE.stock[char] = (STATE.stock[char] || 0) + 1;

  const codex = window.KANJI_CODEX || [];
  const k = codex.find(c => (c.char || c.c) === char);
  const rIdx = k ? RARITY_TIERS.indexOf(k.rarity) : 0;

  if (STATE.party && STATE.party.members) {
    // ストック→Lv：パーティ全員に rarity 比例の小 EXP
    const expPerStock = Math.max(1, rIdx + 1);
    for (let i = 0; i < STATE.party.members.length; i++) {
      const m = STATE.party.members[i];
      m.exp = (m.exp || 0) + expPerStock;
      while (m.exp >= expForLevel(m.level + 1)) {
        m.exp -= expForLevel(m.level + 1);
        m.level += 1;
        onLevelUp(m, i);
      }
    }
    STATE.stats.totalExp = (STATE.stats.totalExp || 0) + expPerStock;

    // 育つ特性：この字が「パーティ持ち特性」のトリガータグなら perk Lv +1
    const charTags = new Set(getCharTags(char));
    const seen = new Set();
    for (const m of STATE.party.members) {
      for (const pid of (m.perks || [])) {
        if (seen.has(pid)) continue;
        seen.add(pid);
        const perk = PERKS[pid];
        if (!perk) continue;
        // タグ系 perk：対応タグの字をストックすると育つ
        if (perk.tag && charTags.has(perk.tag)) {
          STATE.perkLevels[pid] = (STATE.perkLevels[pid] || 0) + 1;
        }
        // 基本系 perk（haste/feather 等）：どんな字でも 0.5 ストック分育つ（端数累積）
        else if (!perk.tag) {
          STATE.perkLevels[pid] = (STATE.perkLevels[pid] || 0) + 0.5;
        }
      }
    }
  }
  // PC 右パネルの所有字を即時更新
  if (isPCMode()) refreshPCPanels();
}

// 特性の実効レベル ── 1, 2, 3, ... と整数で返す（小数累積は内部だけ）
function perkLv(perkId){
  return Math.floor((STATE.perkLevels && STATE.perkLevels[perkId]) || 0);
}
// 特性の Lv を「効力倍率」に変換（対数曲線：Lv 1 = 1.0、Lv 10 = 1.34、Lv 100 = 2.0、Lv 1000 = 2.66）
function perkPower(perkId){
  const lv = perkLv(perkId);
  if (lv <= 0) return 1.0;
  return 1 + Math.log10(1 + lv) / 1.5;
}

// 浮上する「+N XP」表示（ジューシー要素）
function spawnXpFloat(x, y, amount, rarity) {
  const field = $('#play-field');
  if (!field) return;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const node = el('div', {
    class: `xp-float rarity-${rIdx + 1}`,
    style: { left: x + 'px', top: y + 'px' }
  }, `+${amount}`);
  field.appendChild(node);
  setTimeout(() => node.remove(), 1200);
}

function _orphanExp(exp) {
  // Not a party member → distribute small XP to hero
  if (!STATE.party) return;
  const hero = STATE.party.members[STATE.party.hero];
  hero.exp += Math.floor(exp / 4);
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + Math.floor(exp / 4);
  while (hero.exp >= expForLevel(hero.level + 1)) {
    hero.exp -= expForLevel(hero.level + 1);
    hero.level += 1;
    onLevelUp(hero, STATE.party.hero);
  }
  updatePartyXpUI();
}

function mergePomoji(src, target) {
  // persistent 字どうしは合体しない（両方残す）
  if (src.persistent && target.persistent) return;
  // src が persistent なら吸収させない（target が一般なら逆を試みる）
  if (src.persistent) {
    // 立場を入れ替え：一般の target を src 役で persistent に吸わせる
    return mergePomoji(target, src);
  }
  const rIdx = RARITY_TIERS.indexOf(src.rarity);

  // 2048/スイカ式：同レベル同士なら target.mergeLevel += 1（進化）
  // 異レベル同士は src 吸収だけ（進化なし）
  const srcLv = src.mergeLevel || 1;
  const tgtLv = target.mergeLevel || 1;
  const evolved = (srcLv === tgtLv);
  if (evolved) {
    target.mergeLevel = tgtLv + 1;
  }
  const newLv = target.mergeLevel || 1;

  // EXP は mergeLevel に応じて指数増加：基礎 × 2^(level-1)
  const exp = Math.max(1, Math.pow(2, rIdx) * 10 * Math.pow(2, newLv - 1));
  spawnXpFloat(target.x + SIZE/2, target.y, exp, src.rarity);

  // タグアフィニティ判定：src と target のタグ重複があれば +50%
  const srcTags = new Set(getCharTags(src.char));
  const tgtTags = new Set(getCharTags(target.char));
  let tagMatch = false;
  for (const t of srcTags) { if (tgtTags.has(t)) { tagMatch = true; break; } }
  awardExpToParty(src.char, exp, { tagMatch }) || _orphanExp(exp);

  // 進化エフェクト：target に merge-lv-N クラスを再付与
  if (evolved) {
    target.el.classList.forEach(cls => {
      if (cls.startsWith('merge-lv-')) target.el.classList.remove(cls);
    });
    target.el.classList.add(`merge-lv-${newLv}`);
    target.el.classList.add('merge-evolve');
    setTimeout(() => target.el.classList.remove('merge-evolve'), 600);
    if (newLv >= 2) toast(`✦ 進化 ${target.char} Lv${newLv}`, src.rarity);
    playSFX('merge');
  }

  // 連鎖（chain rare 特性）：mergeLevel 3 以上で全員 Lv+1（大爆発）
  const agg = aggregatePartyPerks();
  if (agg.chain && newLv >= 3 && STATE.party) {
    for (let i = 0; i < STATE.party.members.length; i++) {
      STATE.party.members[i].level += 1;
      onLevelUp(STATE.party.members[i], i);
    }
    toast(`⚡ 連鎖 大爆発！ 全員 Lv+1`, '★8');
  }
  // 神撃（legendary_burst）：10% で EXP × 10
  if (agg.megaBurst && Math.random() < agg.megaBurst) {
    const bonus = exp * 9;  // 既に exp 入れてるので追加で 9倍 = 合計 10倍
    awardExpToParty(target.char, bonus) || _orphanExp(bonus);
    toast(`🌟 神撃 EXP ×10`, '★16');
    spawnXpFloat(target.x + SIZE/2, target.y - 20, bonus, target.rarity);
  }

  // 視覚：合体フラッシュ
  target.el.classList.add('merge-flash');
  if (tagMatch) target.el.classList.add('merge-resonate');
  setTimeout(() => {
    target.el.classList.remove('merge-flash');
    target.el.classList.remove('merge-resonate');
  }, 800);
  if (tagMatch) {
    const shared = Array.from(srcTags).find(t => tgtTags.has(t));
    toast(`✦ 同質共振「${shared}」XP+50%`);
  }

  addStock(src.char);  // 合体で消える側もストックに（書ける字を増やす）
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
    bar.innerHTML = '<button class="party-pick-cta" id="party-pick-cta">主人公を選ぶ →</button>';
    $('#party-pick-cta').onclick = () => openPartyPicker();
    return;
  }
  bar.classList.remove('empty');
  bar.innerHTML = '';
  STATE.party.members.forEach((m, idx) => {
    const isHero = (idx === STATE.party.hero);
    const stage = evolutionStage(m.level);
    const styleClass = EVO_STYLE[stage] || 'kai';
    const needExp = expForLevel(m.level + 1);
    const tierIdx = RARITY_TIERS.indexOf(m.rarity);
    const perkLabels = (m.perks || []).map(pid => PERKS[pid]?.name).filter(Boolean).join('・');
    const card = el('div', {
      class: `party-card rarity-${tierIdx + 1}${isHero ? ' hero' : ''}${stage > 0 ? ' evo-' + stage : ''}`,
      dataset: { idx, evo: stage, lv: m.level },
      title: `${m.char} Lv.${m.level} / 特性: ${perkLabels}`,
      onclick: () => openPartyMemberAction(idx)
    },
      el('div', { class:'pc-glyph font-' + styleClass }, m.char, stage > 0 ? el('span', { class:'pc-stage' }, EVO_GLYPH[stage] || '𓂀') : null),
      el('div', { class:'pc-meta' },
        el('span', { class:'pc-name' }, isHero ? '★ ' + m.char : m.char),
        el('span', { class: 'pc-lv' + (m.level >= 1000 ? ' lv-godly' : m.level >= 100 ? ' lv-high' : '') }, 'Lv.' + m.level),
      ),
      // 通常画面では特性ラベル非表示（編成モーダル内でだけ見える）
      el('div', { class:'pc-bar' },
        el('div', { class:'pc-fill', style: { width: Math.min(100, (m.exp / needExp) * 100) + '%' } })
      ),
    );
    bar.appendChild(card);
  });
  // 空きスロット（最大 4 体まで）
  const emptySlots = 4 - STATE.party.members.length;
  for (let i = 0; i < emptySlots; i++) {
    const slot = el('div', {
      class: 'party-card empty-slot',
      title: '図鑑で発見した字をタップして仲間に加える',
      onclick: () => {
        toast('図鑑📖 で発見済の字をタップして仲間に加えられます');
        openCodex();
      }
    },
      el('div', { class:'pc-glyph empty' }, '＋'),
      el('div', { class:'pc-meta' },
        el('span', { class:'pc-lv' }, '仲間枠'),
      ),
    );
    bar.appendChild(slot);
  }
  refreshPCPanels();
  // コンボ発動チェック（編成変化時）
  checkComboPickup();
  renderComboBar();
}

// パーティバー下にコンボ表示帯（発動中の熟語）
function renderComboBar() {
  let bar = $('#combo-bar');
  if (!isPartyChosen()) {
    if (bar) bar.remove();
    return;
  }
  const combos = detectPartyCombos();
  if (combos.length === 0) {
    if (bar) bar.remove();
    return;
  }
  if (!bar) {
    bar = el('div', { id:'combo-bar', class:'combo-bar' });
    const partyBar = $('#party-bar');
    if (partyBar && partyBar.parentNode) {
      partyBar.parentNode.insertBefore(bar, partyBar.nextSibling);
    }
  }
  bar.innerHTML = '';
  bar.appendChild(el('span', { class:'cb-bar-label' }, '⚡ コンボ'));
  // 最大 4 件表示
  combos.slice(0, 4).forEach(r => {
    const rIdx = RARITY_TIERS.indexOf(r.rarity);
    bar.appendChild(el('span', {
      class: `cb-bar-item rarity-${rIdx + 1}`,
      title: r.desc || r.word,
    }, r.word));
  });
  if (combos.length > 4) {
    bar.appendChild(el('span', { class:'cb-bar-more' }, `他 ${combos.length - 4}`));
  }
}

// パーティメンバーの操作（タップで開く）
function openPartyMemberAction(idx) {
  if (!STATE.party) return;
  const m = STATE.party.members[idx];
  if (!m) return;
  const isHero = (idx === STATE.party.hero);
  // 特性表示 ─ 名前 + Lv + 効果説明（育つ特性のリッチ表示）
  const perkRows = (m.perks || []).map(pid => {
    const p = PERKS[pid];
    if (!p) return null;
    const lv = perkLv(pid);
    const pw = perkPower(pid);
    const isRare = p.rare;
    return el('div', {
      class: 'map-perk-row' + (isRare ? ' rare' : ''),
      style:{
        padding:'6px 8px', margin:'4px 0',
        background: isRare ? 'rgba(240,212,138,.12)' : 'rgba(255,255,255,.04)',
        border:'1px solid ' + (isRare ? 'rgba(240,212,138,.45)' : 'rgba(255,255,255,.08)'),
        borderRadius:'6px',
        display:'flex', flexDirection:'column', gap:'2px',
      }
    },
      el('div', { style:{ display:'flex', justifyContent:'space-between', fontSize:'.85rem', fontWeight:700 } },
        el('span', {}, (isRare ? '✦ ' : '') + p.name),
        el('span', { style:{ color: lv > 0 ? 'var(--gold)' : 'var(--ink-mute)', fontFamily:'JetBrains Mono, monospace', fontSize:'.75rem' } },
          lv > 0 ? `Lv.${lv} (×${pw.toFixed(2)})` : '未育成'
        ),
      ),
      el('div', { style:{ fontSize:'.7rem', color:'var(--ink-mute)', lineHeight:1.3 } }, p.desc || ''),
    );
  }).filter(Boolean);

  $$('.member-action-pop').forEach(e => e.remove());

  const buttons = [];
  if (isHero) {
    buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
      toast('主人公は解除できません（別の字を主人公にしたい時は再編成）');
    }}, '主人公（解除不可）'));
  } else {
    buttons.push(el('button', { class:'btn-danger mapop-btn', onclick: () => {
      if (confirm(`${m.char} をパーティから外しますか？\n（Lv. と経験値はリセットされます）`)) {
        STATE.party.members.splice(idx, 1);
        // hero index は順序維持
        if (idx < STATE.party.hero) STATE.party.hero -= 1;
        saveState();
        renderParty();
        toast(`${m.char} を解除しました`);
      }
      $$('.member-action-pop').forEach(e => e.remove());
    }}, '解除する'));
  }
  buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
    toast('図鑑で発見字をタップして別の字を仲間に追加');
    $$('.member-action-pop').forEach(e => e.remove());
    openCodex();
  }}, '図鑑から仲間追加'));
  buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
    $$('.member-action-pop').forEach(e => e.remove());
  }}, '閉じる'));

  const pop = el('div', { class: `member-action-pop rarity-${RARITY_TIERS.indexOf(m.rarity) + 1}` },
    el('div', { class:'map-head' },
      el('div', { class:'map-char' }, m.char),
      el('div', { class:'map-meta' },
        el('div', { class:'map-name' }, isHero ? '★ 主人公' : 'パーティ字'),
        el('div', { class:'map-lv' }, `Lv.${m.level}`),
        el('div', { class:'map-perks-rich', style:{ marginTop:'8px' } }, ...perkRows),
      )
    ),
    el('div', { class:'map-buttons' }, ...buttons)
  );
  document.body.appendChild(pop);
}

// 字をパーティに加える
function recruitToParty(c, rarity) {
  if (!STATE.party) return false;
  if (STATE.party.members.length >= 4) {
    toast('パーティ枠は 4 体まで');
    return false;
  }
  if (partyContainsChar(c) >= 0) {
    toast(`${c} は既にパーティにいます`);
    return false;
  }
  const perks = pickInherentPerks(c, rarity);
  STATE.party.members.push({
    char: c, rarity, level: 1, exp: 0, perks
  });
  saveState();
  renderParty();
  toast(`${c} が仲間になった！特性「${PERKS[perk]?.name || '—'}」`);
  return true;
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
// ═══════════════════════════════════════════════════════════════
// PC パネル（≥1024px）── 左：パーティ詳細＋累計 / 右：文章ミニ＋所有字＋直近
// ═══════════════════════════════════════════════════════════════
function isPCMode(){ return window.matchMedia && window.matchMedia('(min-width: 1024px)').matches; }

function renderPCLeftPanel(){
  if (!isPCMode()) return;
  const detail = $('#pc-party-detail');
  if (!detail) return;
  if (!isPartyChosen()) {
    detail.innerHTML = '<div style="color:var(--ink-mute);font-size:.86rem;">まずは主人公を選んでね</div>';
  } else {
    detail.innerHTML = '';
    STATE.party.members.forEach((m, idx) => {
      const isHero = idx === (STATE.party.hero || 0);
      const tierIdx = RARITY_TIERS.indexOf(m.rarity);
      const needExp = expForLevel(m.level + 1);
      const perkLabels = (m.perks || []).map(pid => PERKS[pid]?.name).filter(Boolean).join(' / ');
      const row = el('div', {
        class:`pc-party-row rarity-${tierIdx + 1}`,
        style:{
          display:'flex', alignItems:'center', gap:'8px',
          padding:'6px 8px', marginBottom:'4px',
          background: isHero ? 'rgba(240,212,138,.08)' : 'rgba(255,255,255,.03)',
          border:'1px solid '+(isHero ? 'rgba(240,212,138,.4)' : 'rgba(255,255,255,.08)'),
          borderRadius:'6px',
        }
      },
        el('span', { style:{ fontSize:'1.6rem', fontFamily:'Noto Serif JP, serif', color:'var(--r-color)' } }, m.char),
        el('div', { style:{ flex:'1', minWidth:0 } },
          el('div', { style:{ fontSize:'.74rem', color:'var(--ink-mute)' } },
            (isHero ? '★ リーダー ' : '仲間 ') + `Lv.${m.level} (${m.rarity})`),
          el('div', { style:{
            background:'rgba(0,0,0,.3)', height:'4px', borderRadius:'2px', overflow:'hidden', marginTop:'3px'
          } },
            el('div', { style:{
              width: Math.min(100, (m.exp / needExp) * 100) + '%',
              height:'100%', background:'var(--r-color)'
            } })
          ),
          perkLabels ? el('div', { style:{ fontSize:'.66rem', color:'var(--ink-mute)', marginTop:'2px' } }, perkLabels) : null,
        )
      );
      detail.appendChild(row);
    });
  }
  // 累計
  const totalStock = Object.values(STATE.stock || {}).reduce((a,b)=>a+b,0);
  const uniq = Object.keys(STATE.collection || {}).length;
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  set('#psm-cycles', STATE.stats?.totalCycles || 0);
  set('#psm-drops',  STATE.stats?.totalDrops || 0);
  set('#psm-stock',  totalStock);
  set('#psm-uniq',   `${uniq} / ${(window.KANJI_CODEX || []).length}`);
}

function renderPCRightPanel(){
  if (!isPCMode()) return;
  // 文章ミニ（現在の編集中）
  const slots = $('#pwm-slots');
  const genre = $('#pwm-genre');
  if (slots) {
    slots.innerHTML = '';
    if (_currentWriting.length === 0) {
      slots.appendChild(el('span', { class:'pwm-empty' }, '所有字を下からタップ'));
    } else {
      _currentWriting.forEach((item, idx) => {
        const rIdx = RARITY_TIERS.indexOf(item.rarity);
        slots.appendChild(el('span', {
          class:`pwm-slot rarity-${rIdx + 1}`,
          onclick: () => { _currentWriting.splice(idx, 1); renderPCRightPanel(); renderWritingsModal(); }
        }, item.char));
      });
    }
  }
  if (genre) genre.textContent = detectGenre(_currentWriting.map(x => x.char));

  // 所有字
  const stockEl = $('#pwm-stock');
  if (stockEl) {
    stockEl.innerHTML = '';
    const codex = window.KANJI_CODEX || [];
    if (!STATE.stock) STATE.stock = {};
    const tempUsed = {};
    for (const it of _currentWriting) tempUsed[it.char] = (tempUsed[it.char]||0) + 1;
    const owned = codex.filter(k => {
      const c = k.char || k.c;
      return ((STATE.stock[c]||0) - (tempUsed[c]||0)) > 0;
    });
    if (owned.length === 0) {
      stockEl.appendChild(el('span', { class:'pwm-empty' }, '字をストックしていない'));
    } else {
      owned.sort((a,b) => RARITY_TIERS.indexOf(a.rarity) - RARITY_TIERS.indexOf(b.rarity));
      owned.forEach(k => {
        const c = k.char || k.c;
        const rIdx = RARITY_TIERS.indexOf(k.rarity);
        const remain = (STATE.stock[c]||0) - (tempUsed[c]||0);
        const cell = el('div', {
          class:`pwm-stock-cell rarity-${rIdx + 1}`,
          title:`${c} (${k.rarity}) ・ 所有 ${remain}`,
          onclick: () => {
            _currentWriting.push({ char: c, rarity: k.rarity });
            renderPCRightPanel();
            renderWritingsModal();
          }
        }, c, el('span', { class:'pwm-stock-n' }, String(remain)));
        stockEl.appendChild(cell);
      });
    }
  }

  // 直近の文章（最新3件）
  const recent = $('#pwm-recent');
  if (recent) {
    recent.innerHTML = '';
    const all = STATE.writings || [];
    if (all.length === 0) {
      recent.appendChild(el('span', { class:'pwm-empty' }, 'まだ刻んでいない'));
    } else {
      all.slice(-3).reverse().forEach(w => {
        recent.appendChild(el('div', { class:'pwm-recent-item' },
          w.text,
          el('span', { class:'pwm-recent-meta' }, `${w.genre} ・ ${w.date}`)
        ));
      });
    }
  }
}

function refreshPCPanels(){
  if (!isPCMode()) return;
  renderPCLeftPanel();
  renderPCRightPanel();
}

// ═══════════════════════════════════════════════════════════════
// 文章モード v0.1（俳句構想 前倒し）
// 集めた字を並べて文章を作る ── 字数でジャンル自動判定・保存
// ═══════════════════════════════════════════════════════════════
let _currentWriting = [];  // { char, rarity }

function openWritings() {
  if (!STATE.writings) STATE.writings = [];
  renderWritingsModal();
  $('#writings-modal').classList.add('show');
}
function closeWritings() { $('#writings-modal').classList.remove('show'); }

function detectGenre(chars) {
  const n = chars.length;
  if (n === 0) return '─';
  if (n <= 2)  return `一語（${n}字）`;
  if (n === 3) return '三字熟語';
  if (n === 4) return '四字熟語';
  if (n === 5) return '五字 ・ 俳句の上の句';
  if (n === 7) return '七字 ・ 俳句の中の句';
  if (n === 17) return '俳句（5-7-5）';
  if (n === 31) return '短歌（5-7-5-7-7）';
  if (n >= 8 && n <= 16) return `短文（${n}字）`;
  if (n >= 18 && n <= 30) return `詩（${n}字）`;
  if (n > 31 && n <= 50) return `散文（${n}字）`;
  return `長文（${n}字）`;
}

function renderWritingsModal() {
  // 編集中
  const slots = $('#wc-slots');
  const genre = $('#wc-genre');
  slots.innerHTML = '';
  if (_currentWriting.length === 0) {
    slots.appendChild(el('div', { class:'wc-empty' }, '下から字をタップして並べる…'));
  } else {
    _currentWriting.forEach((item, idx) => {
      const rIdx = RARITY_TIERS.indexOf(item.rarity);
      slots.appendChild(el('span', {
        class: `wc-slot rarity-${rIdx + 1}`,
        onclick: () => { _currentWriting.splice(idx, 1); renderWritingsModal(); }
      }, item.char));
    });
  }
  genre.textContent = detectGenre(_currentWriting.map(x=>x.char));

  // 所有ストックプール（stock > 0 の字だけ・消費は保存時に確定）
  const pool = $('#wp-grid');
  pool.innerHTML = '';
  const codex = window.KANJI_CODEX || [];
  if (!STATE.stock) STATE.stock = {};
  // 編集中で既に使っている分を仮消費（プール上の残数を正しく見せる）
  const tempUsed = {};
  for (const item of _currentWriting) {
    tempUsed[item.char] = (tempUsed[item.char] || 0) + 1;
  }
  const owned = codex.filter(k => {
    const c = k.char || k.c;
    const stockN = STATE.stock[c] || 0;
    const usedN  = tempUsed[c] || 0;
    return (stockN - usedN) > 0;
  });
  if (owned.length === 0) {
    const totalStock = Object.values(STATE.stock).reduce((a,b)=>a+b,0);
    const msg = totalStock === 0
      ? '所有している字がまだありません ── タイマーで字を消すと所有数 +1（5分寿命でも吸収時 +1）'
      : '使える字を全部使い切りました。クリアまたは保存してください。';
    pool.appendChild(el('div', { class:'wc-empty' }, msg));
  } else {
    // レア順（低→高）→ 同レアは所有数の多い順
    owned.sort((a,b) => {
      const dr = RARITY_TIERS.indexOf(a.rarity) - RARITY_TIERS.indexOf(b.rarity);
      if (dr !== 0) return dr;
      const ca = a.char || a.c, cb = b.char || b.c;
      return (STATE.stock[cb]||0) - (STATE.stock[ca]||0);
    });
    owned.forEach(k => {
      const c = k.char || k.c;
      const rIdx = RARITY_TIERS.indexOf(k.rarity);
      const stockN = STATE.stock[c] || 0;
      const usedN  = tempUsed[c] || 0;
      const remain = stockN - usedN;
      const cell = el('div', {
        class: `wp-cell rarity-${rIdx + 1}`,
        title: `${c} (${k.rarity}) ・ 所有 ${remain}/${stockN}`,
        onclick: () => {
          _currentWriting.push({ char: c, rarity: k.rarity });
          renderWritingsModal();
        }
      }, c,
        el('span', { class:'wp-count' }, remain)
      );
      pool.appendChild(cell);
    });
  }

  // 履歴
  const hist = $('#wh-list');
  hist.innerHTML = '';
  const writings = (STATE.writings || []).slice().reverse();  // 新しい順
  if (writings.length === 0) {
    hist.appendChild(el('div', { class:'wc-empty' }, 'まだ何も保存していません。'));
  } else {
    writings.forEach((w, i) => {
      const idx = (STATE.writings.length - 1) - i;
      hist.appendChild(el('div', { class:'wh-item' },
        el('div', { class:'wh-text' }, w.text),
        el('div', { class:'wh-meta' },
          el('span', {}, w.genre),
          el('span', {}, w.date),
        ),
        el('button', {
          class:'wh-del', title:'削除',
          onclick: () => {
            if (!confirm('この文章を削除しますか？')) return;
            STATE.writings.splice(idx, 1);
            saveState();
            renderWritingsModal();
          }
        }, '×')
      ));
    });
  }
}

// 文章群を JSON で出力（Blender / 読雨 / 外部ツール連携用）
// RBAI 公式構想：完成俳句を 3D アニメ化／読雨に「刻む」
function exportWritingsJSON() {
  if (!STATE.writings || STATE.writings.length === 0) {
    toast('保存された文章がありません');
    return;
  }
  const payload = {
    app: 'pomojikan',
    version: 'v30.4',
    exported_at: new Date().toISOString(),
    user_id: STATE.userId || null,
    writings: STATE.writings.map(w => ({
      text: w.text,
      genre: w.genre,
      date: w.date,
      chars: w.chars,        // [{ char, rarity, season? }, ...]
      char_count: w.chars?.length || 0,
      lv: w.lv || 1,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pomojikan-writings-${payload.exported_at.slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
  toast(`📥 ${STATE.writings.length} 件の文章を JSON 出力`);
}

function saveCurrentWriting() {
  if (_currentWriting.length === 0) { toast('字を 1 つ以上並べてください'); return; }
  const text = _currentWriting.map(x => x.char).join('');
  const genre = detectGenre(_currentWriting.map(x => x.char));
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if (!STATE.writings) STATE.writings = [];
  if (!STATE.stock) STATE.stock = {};
  // ストック消費を確定（使った字を所有数から引く）
  for (const item of _currentWriting) {
    STATE.stock[item.char] = Math.max(0, (STATE.stock[item.char] || 0) - 1);
    if (STATE.stock[item.char] === 0) delete STATE.stock[item.char];
  }
  STATE.writings.push({ text, genre, date, chars: _currentWriting.slice() });
  saveState();
  toast(`📜 保存：${genre}「${text}」`);
  // 読雨連携：BroadcastChannel 'rainybrain' で文章を放流（読雨側で受信可）
  publishToYomu({ text, genre, date, chars: _currentWriting.slice() });
  _currentWriting = [];
  renderWritingsModal();
  refreshPCPanels();
}

// 読雨 (YOMU) との接続 ── 同オリジン Channel API
// RBAI 公式構想：保存文章を読雨「刻む」モーダルに自動投入
let _yomuChannel = null;
function publishToYomu(writing) {
  try {
    if (!_yomuChannel && 'BroadcastChannel' in window) {
      _yomuChannel = new BroadcastChannel('rainybrain');
    }
    if (!_yomuChannel) return;
    _yomuChannel.postMessage({
      type: 'pomo',
      event: 'writing_saved',
      source: 'pomojikan',
      app: 'pomojikan',
      version: 'v30.6',
      payload: {
        text: writing.text,
        genre: writing.genre,
        date: writing.date,
        chars: writing.chars,
        hero_char: isPartyChosen() ? STATE.party.members[STATE.party.hero||0].char : null,
        user_id: STATE.userId || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) { /* 読雨未起動・他オリジン等は静かに無視 */ }
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
let codexFilter = { tier: 'all', season: 'all', onlySeen: false, query: '' };
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
  const stock = (STATE.stock || {})[c] || 0;
  const partyIdx = partyContainsChar(c);
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const member = partyIdx >= 0 ? STATE.party.members[partyIdx] : null;
  const codex = window.KANJI_CODEX || [];
  const k = codex.find(x => (x.char||x.c) === c);
  const desc = k?.desc || '';
  const season = k?.season || '';

  $$('.char-detail-pop').forEach(e => e.remove());

  const canRecruit = STATE.party && STATE.party.members.length < 4 && partyIdx < 0;
  const recruitBtn = canRecruit
    ? el('button', { class:'cd-recruit', onclick: () => {
        recruitToParty(c, rarity);
        $$('.char-detail-pop').forEach(e => e.remove());
        renderCodex();
      } }, '＋ パーティに加える')
    : null;

  // 関連熟語をレア順 ・ クリックでテキストコピー
  const recipeNodes = recipes.slice(0, 10).map(r => {
    const rrIdx = RARITY_TIERS.indexOf(r.rarity);
    return el('span', {
      class:`cd-recipe rarity-${rrIdx + 1}`,
      title: r.desc || r.word,
    }, r.word);
  });

  const pop = el('div', { class: `char-detail-pop rarity-${rIdx + 1}` },
    el('button', { class: 'cd-close', onclick: (e) => { e.target.parentElement.remove(); } }, '×'),
    el('div', { class:'cd-char' }, c),
    el('div', { class:'cd-rarity' }, `${rarity}${season ? ' ・ ' + season : ''}`),
    desc ? el('div', { class:'cd-desc' }, desc) : null,
    el('div', { class:'cd-tags' }, tags.length ? '◆ ' + tags.slice(0, 6).join(' / ') : '—'),
    el('div', { class:'cd-stats-row' },
      el('span', {}, `発見 ${seen} 回`),
      el('span', { style:{ color: stock > 0 ? 'var(--gold)' : 'inherit' } }, `所有 ${stock}`),
    ),
    member ? el('div', { class:'cd-party' },
      `パーティ字 ・ Lv.${member.level} ・ ${(member.perks||[]).map(pid=>PERKS[pid]?.name).filter(Boolean).join('・')}`
    ) : null,
    recruitBtn,
    recipes.length > 0 ? el('div', { class:'cd-recipes' },
      el('div', { class:'cd-recipes-title' }, `🔗 関連熟語 ${recipes.length} 件${recipes.length > 10 ? '（上位10）' : ''}`),
      el('div', { class:'cd-recipes-list' }, ...recipeNodes)
    ) : el('div', { class:'cd-recipes-empty' }, '関連熟語なし'),
  );
  $('#codex-modal .modal-card').appendChild(pop);
}
function renderCodex() {
  const grid = $('#codex-grid');
  grid.innerHTML = '';
  const codex = window.KANJI_CODEX || [];
  const onlyShow = (tierIdx) =>
    codexFilter.tier === 'all' || String(tierIdx) === codexFilter.tier;
  const seasonMatch = (k) =>
    codexFilter.season === 'all' || (k.season || 'S1') === codexFilter.season;

  // 特性図鑑：全 PERKS をカードで表示
  if (codexFilter.season === 'PERKS') {
    const perks = Object.entries(PERKS);
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' }, `✦ 特性図鑑（${perks.length} 個 ・ 字をストックして育つ）`)
    );
    const list = el('div', { class:'perk-codex-list' });
    // パーティ持ち特性を先頭に
    const ownedPerks = new Set();
    if (STATE.party && STATE.party.members) {
      for (const m of STATE.party.members) for (const pid of (m.perks||[])) ownedPerks.add(pid);
    }
    // ソート：獲得済 → カテゴリ（special > rare > tag > basic）
    const catOrder = { special:0, rare:1, tag:2, basic:3 };
    perks.sort((a,b) => {
      const oa = ownedPerks.has(a[0]) ? 0 : 1;
      const ob = ownedPerks.has(b[0]) ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return (catOrder[a[1].category]||9) - (catOrder[b[1].category]||9);
    });
    perks.forEach(([pid, p]) => {
      const lv = perkLv(pid);
      const pw = perkPower(pid);
      const cat = p.category || 'basic';
      const isRare = cat === 'rare';
      const isSpecial = cat === 'special';
      const isOwned = ownedPerks.has(pid);
      const catLabel = {
        basic:'基本', tag:'タグ系', rare:'✦ レア', special:'主人公専用',
      }[cat] || cat;
      const card = el('div', { class:'perk-card cat-' + cat + (isRare ? ' rare' : '') + (isOwned ? ' owned' : ' locked') },
        el('div', { class:'pck-head' },
          el('span', { class:'pck-name' }, (isRare ? '✦ ' : isSpecial ? '★ ' : '') + p.name),
          el('span', { class:'pck-lv' }, isOwned ? (lv > 0 ? `Lv.${lv} ×${pw.toFixed(2)}` : '未育成') : '未獲得'),
        ),
        el('div', { class:'pck-cat' }, catLabel),
        el('div', { class:'pck-desc' }, p.desc || ''),
        el('div', { class:'pck-grow' },
          p.tag ? `育て方：「${p.tag}」タグの字をストック → +1/個`
                : isSpecial ? '入手：主人公にすると自動付与'
                : isRare ? '入手：★8 以降の字を仲間にすると抽選で付与（★16 で確定）'
                : '育て方：どの字でもストック → +0.5/個（累積）'
        ),
      );
      list.appendChild(card);
    });
    section.appendChild(list);
    grid.appendChild(section);
    $('#codex-summary').textContent = `特性 ${perks.length} 種 ／ パーティ獲得 ${ownedPerks.size} 種`;
    return;
  }

  // S3/S4/S5/S6/S7（熟語シーズン）が選ばれているときは熟語をリスト表示
  if (['S3','S4','S5','S6','S7'].includes(codexFilter.season)) {
    const recipes = (window.YOJI_RECIPES || []).filter(r => r.season === codexFilter.season);
    const SEASON_LABEL = {
      S3:'熟語', S4:'四字熟語',
      S5:'昭和文化', S6:'令和現代', S7:'未来（萌芽）'
    };
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' },
        `${codexFilter.season} ${SEASON_LABEL[codexFilter.season] || ''}（${recipes.length} 個）`)
    );
    const list = el('div', { class:'codex-yoji-list' });
    recipes.forEach(r => {
      const rIdx = RARITY_TIERS.indexOf(r.rarity);
      const item = el('div', { class:`codex-yoji-item rarity-${rIdx+1}` },
        el('span', { class:'cy-text' }, r.word),
        el('span', { class:'cy-meta' }, `${r.rarity} ${r.desc || ''}`)
      );
      list.appendChild(item);
    });
    section.appendChild(list);
    grid.appendChild(section);
    const discovered = Object.keys(STATE.collection).length;
    const totalKanji = codex.length;
    $('#codex-summary').textContent = `発見 ${discovered} / ${totalKanji} 字 ／ 熟語 ${recipes.length} 個`;
    return;
  }

  const q = (codexFilter.query || '').trim().toLowerCase();
  const matchQuery = (k) => {
    if (!q) return true;
    const c = (k.char || k.c).toLowerCase();
    if (c.includes(q)) return true;
    if ((k.tags || []).some(t => t.toLowerCase().includes(q))) return true;
    if ((k.desc || '').toLowerCase().includes(q)) return true;
    // 熟語に含まれる字も検索（CHAR_TO_WORDS）
    const words = (window.CHAR_TO_WORDS || {})[k.char || k.c] || [];
    if (words.some(w => w.word.toLowerCase().includes(q))) return true;
    return false;
  };

  RARITY_TIERS.forEach((tier, tierIdx) => {
    if (!onlyShow(tierIdx)) return;
    const tierKanji = codex.filter(k => k.rarity === tier && seasonMatch(k) && matchQuery(k));
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
  // リーダー Lv ＋ 次解放までの差分
  const ldrEl = $('#pp-leader');
  if (ldrEl) {
    if (isPartyChosen()) {
      const hero = STATE.party.members[STATE.party.hero || 0];
      const nextTierName = RARITY_TIERS[tier + 1];
      const nextLv = nextTierName ? UNLOCK_LV[nextTierName] : null;
      const remain = nextLv != null ? nextLv - hero.level : null;
      ldrEl.textContent = nextTierName && remain > 0
        ? `${hero.char} Lv.${hero.level}（${nextTierName} まで -${remain}）`
        : `${hero.char} Lv.${hero.level}（全解放）`;
    } else {
      ldrEl.textContent = '主人公 未選択';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 記録モーダル
// ═══════════════════════════════════════════════════════════════
function openStats() {
  const idEl = $('#user-id-display');
  if (idEl) idEl.textContent = STATE.userId || '— (まだプレイ前)';
  const list = $('#stats-list');
  const discovered = Object.keys(STATE.collection || {}).length;
  const totalKanji = (window.KANJI_CODEX || []).length;
  const heroLv = isPartyChosen() ? partyHeroLevel() : 0;
  const partyAvg = isPartyChosen() ? Math.round(partyAverageLevel() * 10) / 10 : 0;
  const heroChar = isPartyChosen() ? STATE.party.members[STATE.party.hero || 0]?.char || '—' : '—';
  const totalStock = Object.values(STATE.stock || {}).reduce((a,b)=>a+b, 0);
  const writings = (STATE.writings || []).length;
  // 特性 Lv トップ 3
  const topPerks = Object.entries(STATE.perkLevels || {})
    .filter(([pid, lv]) => lv >= 1 && PERKS[pid])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid, lv]) => `${PERKS[pid].name} Lv.${Math.floor(lv)}`)
    .join(' / ') || '─';
  list.innerHTML = '';
  const cells = [
    { label:'累計サイクル', value: STATE.stats.totalCycles || 0 },
    { label:'累計ぽもじ', value: STATE.stats.totalDrops || 0 },
    { label:'累計 EXP', value: (STATE.stats.totalExp || 0).toLocaleString() },
    { label:'発見字', value: `${discovered} / ${totalKanji}` },
    { label:'所有字 合計', value: totalStock.toLocaleString() },
    { label:'保存した文章', value: writings },
    { label:'★ リーダー', value: `${heroChar} Lv.${heroLv}` },
    { label:'仲間 平均Lv', value: partyAvg },
    { label:'現在の帯', value: `${RARITY_TIERS[STATE.unlockedTier]} ${TIER_ACHIEVEMENT[STATE.unlockedTier] || ''}` },
    { label:'特性 Lv トップ', value: topPerks, span:2 },
  ];
  cells.forEach(c => {
    list.appendChild(el('div', {
      class:'stats-cell' + (c.span === 2 ? ' span-2' : ''),
    },
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
// バックグラウンド対応（v30c）── タイマーは継続、復帰時に 50% ボーナス
// ═══════════════════════════════════════════════════════════════
function handleVisibilityChange() {
  if (document.hidden) {
    if (STATE.mode === 'work' || STATE.mode === 'rest') {
      STATE.lastHiddenAt = Date.now();
      // タイマーは進行継続（Date.now() ベース）
      // ただし JS タイマー類は止める（再生不要・rAF はブラウザが自動で停止）
      stopWorkSpawning();
      cancelAnimationFrame(timerRaf);
      saveState();
    }
  } else {
    if (STATE.lastHiddenAt && (STATE.mode === 'work' || STATE.mode === 'rest')) {
      const hiddenElapsed = Date.now() - STATE.lastHiddenAt;
      const wasWorkBeforeHide = (STATE.mode === 'work');
      STATE.lastHiddenAt = null;

      // 隠れている間にフェーズが終わってたら順次完了
      let safety = 5;
      while ((STATE.mode === 'work' || STATE.mode === 'rest')
              && Date.now() >= STATE.phaseEnd
              && safety-- > 0) {
        completePhase();
      }

      // タイマー類を再開
      if (STATE.mode === 'work') {
        startWorkSpawning();
      }
      tick();

      // オフラインボーナス（作業中に隠れていた時間に対して 50%）
      if (wasWorkBeforeHide && hiddenElapsed > WORK_SPAWN_INTERVAL_MS) {
        const wouldHaveSpawned = Math.floor(hiddenElapsed / WORK_SPAWN_INTERVAL_MS);
        const bonusCount = Math.min(20, Math.floor(wouldHaveSpawned * 0.5));
        if (bonusCount > 0) {
          offlineBonusCascade(bonusCount);
        }
      }
      saveState();
    } else if (STATE.lastHiddenAt) {
      STATE.lastHiddenAt = null;
    }
  }
}

function offlineBonusCascade(count) {
  toast(`おかえり！オフラインボーナス ${count} 粒（50%）`);
  const drops = [];
  for (let i = 0; i < count; i++) {
    const k = (STATE.party && i % 3 === 0) ? pickPartyDrop() : pickKanjiForDrop();
    if (k) drops.push(k);
  }
  dropCascade(drops, 160, 260);
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

  // ── ハンバーガー＆ドロワーメニュー ──────────────────────────
  const drawer = $('#menu-drawer');
  const hamburger = $('#btn-menu');
  const openDrawer = () => {
    drawer.classList.add('show');
    drawer.setAttribute('aria-hidden', 'false');
    hamburger.setAttribute('aria-expanded', 'true');
  };
  const closeDrawer = () => {
    drawer.classList.remove('show');
    drawer.setAttribute('aria-hidden', 'true');
    hamburger.setAttribute('aria-expanded', 'false');
  };
  if (hamburger) hamburger.addEventListener('click', openDrawer);
  const menuClose = $('#menu-close');
  if (menuClose) menuClose.addEventListener('click', closeDrawer);
  const menuBackdrop = $('#menu-backdrop');
  if (menuBackdrop) menuBackdrop.addEventListener('click', closeDrawer);
  // 各メニュー項目（押したらドロワーを閉じてから機能発火）
  const menuClick = (id, fn) => {
    const e = $(id);
    if (!e) return;
    e.addEventListener('click', () => { closeDrawer(); setTimeout(fn, 60); });
  };
  menuClick('#m-audio',      toggleAudio);
  menuClick('#m-help',       () => $('#help-modal').classList.add('show'));
  menuClick('#m-stats',      openStats);
  menuClick('#m-codex',      openCodex);
  menuClick('#m-writings',   openWritings);
  menuClick('#m-timer',      openTimerSettings);
  menuClick('#m-edit-party', () => {
    if (confirm('パーティを再編成しますか？（現在のメンバーはリセット）')) {
      STATE.party = null;
      saveState();
      renderParty();
      openPartyPicker();
    }
  });

  // ── 旧ヘッダー個別ボタン（HTML から削除済 ・防御的に null チェック）──
  const bindOpt = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', fn); };
  bindOpt('#btn-codex', openCodex);
  $('#codex-close').addEventListener('click', closeCodex);

  // 文章モード（v0.1）
  const btnW = $('#btn-writings');
  if (btnW) btnW.addEventListener('click', openWritings);
  const wClose = $('#writings-close');
  if (wClose) wClose.addEventListener('click', closeWritings);
  const wcClear = $('#wc-clear');
  if (wcClear) wcClear.addEventListener('click', () => { _currentWriting = []; renderWritingsModal(); refreshPCPanels(); });
  const wcUndo = $('#wc-undo');
  if (wcUndo) wcUndo.addEventListener('click', () => { _currentWriting.pop(); renderWritingsModal(); refreshPCPanels(); });
  const wcSave = $('#wc-save');
  if (wcSave) wcSave.addEventListener('click', saveCurrentWriting);
  const wcExport = $('#wc-export');
  if (wcExport) wcExport.addEventListener('click', exportWritingsJSON);

  // PC 右パネル：文章ミニのアクション
  const pwmClear = $('#pwm-clear');
  if (pwmClear) pwmClear.addEventListener('click', () => { _currentWriting = []; refreshPCPanels(); });
  const pwmUndo = $('#pwm-undo');
  if (pwmUndo) pwmUndo.addEventListener('click', () => { _currentWriting.pop(); refreshPCPanels(); });
  const pwmSave = $('#pwm-save');
  if (pwmSave) pwmSave.addEventListener('click', () => { saveCurrentWriting(); refreshPCPanels(); });
  const pwmFull = $('#pwm-full');
  if (pwmFull) pwmFull.addEventListener('click', openWritings);

  // PC 左パネル：プリセット
  document.querySelectorAll('.pc-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.preset);
      applyPreset(idx);
      refreshPCPanels();
    });
  });

  // リサイズ時に PC パネル再描画（スマホ↔PC 切替対応）
  let _resizeT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeT);
    _resizeT = setTimeout(refreshPCPanels, 150);
  });

  $('#party-picker-reroll').addEventListener('click', () => {
    rerollPickerPool();
    renderPickerPool();
  });
  $$('.codex-tab').forEach(t => t.addEventListener('click', () => {
    codexFilter.tier = t.dataset.tier;
    $$('.codex-tab').forEach(x => x.classList.toggle('active', x === t));
    renderCodex();
  }));
  // シーズンタブ（RBAI 公式構想）
  $$('.codex-season').forEach(s => s.addEventListener('click', () => {
    codexFilter.season = s.dataset.season;
    $$('.codex-season').forEach(x => x.classList.toggle('active', x === s));
    renderCodex();
  }));
  $('#codex-only-seen').addEventListener('change', (e) => {
    codexFilter.onlySeen = e.target.checked;
    renderCodex();
  });
  // 図鑑検索バー（debounce 150ms）
  const cs = $('#codex-search');
  if (cs) {
    let _csT = 0;
    cs.addEventListener('input', (e) => {
      clearTimeout(_csT);
      _csT = setTimeout(() => {
        codexFilter.query = e.target.value;
        renderCodex();
      }, 150);
    });
  }

  bindOpt('#btn-stats', openStats);
  $('#stats-close').addEventListener('click', closeStats);

  bindOpt('#btn-help', () => $('#help-modal').classList.add('show'));
  $('#help-close').addEventListener('click', () => $('#help-modal').classList.remove('show'));

  bindOpt('#btn-edit-party', () => {
    if (confirm('パーティを再編成しますか？（現在のメンバーはリセット）')) {
      STATE.party = null;
      saveState();
      renderParty();
      openPartyPicker();
    }
  });

  bindOpt('#btn-reset-all', resetState);
  bindOpt('#btn-share-party', copyShareURL);

  bindOpt('#btn-audio', toggleAudio);
  bindOpt('#btn-issue-code', copyTransferCode);
  bindOpt('#btn-apply-code', promptApplyTransferCode);
  $('#ob-next').addEventListener('click', obNext);
  $('#ob-skip').addEventListener('click', obSkip);
  $('#user-id-display').addEventListener('click', async () => {
    if (STATE.userId) {
      try { await navigator.clipboard.writeText(STATE.userId); toast('IDをコピー'); }
      catch (e) {}
    }
  });

  document.addEventListener('visibilitychange', handleVisibilityChange);

  // キーボードショートカット（PC向け）
  document.addEventListener('keydown', (e) => {
    // input/textarea にフォーカスがあるときは無効
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    // 修飾キーは無視
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      case 'Escape':
        // 開いているモーダルを閉じる、なければドロワー閉じる
        $$('.modal.show').forEach(m => m.classList.remove('show'));
        const dr = $('#menu-drawer');
        if (dr && dr.classList.contains('show')) {
          dr.classList.remove('show');
          $('#btn-menu')?.setAttribute('aria-expanded', 'false');
        }
        break;
      case ' ': // Space = 開始/停止
        e.preventDefault();
        $('#main-btn')?.click();
        break;
      case 'm': case 'M':
        $('#btn-menu')?.click();
        break;
      case 'b': case 'B':
        openCodex();
        break;
      case 'h': case 'H': case '?':
        $('#help-modal')?.classList.add('show');
        break;
      case 'w': case 'W':
        openWritings();
        break;
      case 's': case 'S':
        openStats();
        break;
    }
  });

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
  // 起動時の既存コンボは _comboPrev に登録（誤発火防止）
  setTimeout(() => {
    try { _comboPrev = new Set(detectPartyCombos().map(r => r.word)); } catch(_) {}
  }, 100);
  // reset transient state across reloads
  STATE.mode = 'idle';
  STATE.phaseStart = 0;
  STATE.phaseEnd = 0;
  STATE.pausedRemaining = 0;
  STATE.lastHiddenAt = null;
  document.body.dataset.mode = 'idle';
  // 配信モード判定（?stream=1）── OBS 用透過オーバーレイ
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('stream') === '1') document.body.classList.add('stream-mode');
  } catch(_) {}
  bindEvents();
  $('#timer-text').textContent = fmtTime(STATE.timer.workSec);
  // 共有 URL チェック（自分のパーティ読み込み後）
  checkSharedPartyOnBoot();
  renderParty();
  updateUnlockTier();
  updateProgressPill();
  updateAudioButton();
  buildBackgroundLayers();
  physicsStep();

  // First-launch flow: onboarding → party picker
  if (!STATE.onboardingDone) {
    setTimeout(() => openOnboarding(), 500);
  } else if (!isPartyChosen()) {
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
