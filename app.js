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

// 無限 Lv 設計（v5 / 2026-05-18）── 何十年も遊べる育成型ポモドーロ
// ★は16段階で頭打ちでも Lv は無限に育つ ── 進化段階を 15 段階に拡張（〜Lv 1,000,000）
const EVO_STAGE_LV = [
  10,        // 1: 楷書
  30,        // 2: 行書
  70,        // 3: 草書
  150,       // 4: 篆書
  300,       // 5: 甲骨
  600,       // 6: 神代文字
  1000,      // 7: 超越
  2000,      // 8: 星屑
  5000,      // 9: 神話
  10000,     // 10: 創造主
  30000,     // 11: 永劫
  100000,    // 12: 無始
  300000,    // 13: 虚無
  1000000,   // 14: 永遠
  10000000,  // 15: ∞（自己存在）
];
const EVO_GLYPH = ['', '✦', '✧', '✩', '☆', '✯', '✪', '❂', '✺', '✹', '𓂀', '𓁹', '𒀭', '☥', '⚛', '∞'];
const EVO_STYLE = ['kai', 'gyo', 'sou', 'tens', 'kou', 'shin', 'choetsu', 'hoshi', 'shinwa', 'sozo', 'eigou', 'mushi', 'kyomu', 'eien', 'mugen'];

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
// v6（2026-05-17）── desc は「何が起きるか」だけ。係数・曲線はバックエンドで管理
const PERKS = {
  // ─── basic ───
  haste:       { name:'急降下',  desc:'落下が速くなる',                      category:'basic' },
  feather:     { name:'ふわふわ',desc:'落下がゆっくり ・ 合体しやすい',      category:'basic' },
  wide:        { name:'求心',    desc:'合体の判定が広がる',                  category:'basic' },
  bounty:      { name:'豊穣',    desc:'サイクル完了で落下数が増える',        category:'basic' },
  scholar:     { name:'積み重ね',desc:'EXP獲得が増える',                     category:'basic' },
  prodigy:     { name:'神童',    desc:'書体進化が早くなる',                  category:'basic' },
  magnet:      { name:'磁字',    desc:'着地で近くの同字を引き寄せ自動合体',  category:'basic' },

  // ─── special ───
  guardian:    { name:'守護',    desc:'主人公が消滅しない',                  category:'special' },

  // ─── tag ───
  tag_virtue:  { name:'七徳の徳',  desc:'七徳タグの字でEXP増',               category:'tag', tag:'七徳'  },
  tag_sin:     { name:'七大罪の業',desc:'七大罪字で落下数 +',                 category:'tag', tag:'七大罪'},
  tag_emo:     { name:'感応',     desc:'感情字の融合でEXP増',                 category:'tag', tag:'感情'  },
  tag_time:    { name:'時の継',   desc:'時字の融合でEXP増',                   category:'tag', tag:'時'    },
  tag_zen:     { name:'禅静',     desc:'禅字で休憩泡が増える',                category:'tag', tag:'禅'    },
  tag_sacred:  { name:'神威',     desc:'神字でEXP増',                         category:'tag', tag:'神字'  },
  tag_war:     { name:'闘気',     desc:'武字の融合でEXP増',                   category:'tag', tag:'武'    },
  tag_learn:   { name:'求道',     desc:'学字の融合でEXP増',                   category:'tag', tag:'学'    },
  tag_nature:  { name:'自然律',   desc:'自然字で落下数 +',                    category:'tag', tag:'自然'  },
  tag_beauty:  { name:'幽美',     desc:'美字の融合で書体が即時進化',          category:'tag', tag:'美'    },
  tag_numeral: { name:'計算',     desc:'数字字でEXP増',                       category:'tag', tag:'数字'  },
  tag_english: { name:'発音',     desc:'英語字で落下がゆっくり',              category:'tag', tag:'英語'  },
  tag_order:   { name:'順序',     desc:'順序タグ字で全EXP増',                 category:'tag', tag:'順序'  },

  // ─── rare ───
  chain:              { name:'連鎖',   desc:'3字以上同字融合でパーティ全員 Lv+1', category:'rare' },
  blessing:           { name:'祝詞',   desc:'5サイクル毎に高レア字が降る',         category:'rare' },
  legendary_radiance: { name:'輝度',   desc:'パーティ全員のEXPを大きく増やす',     category:'rare' },
  legendary_growth:   { name:'爆速',   desc:'Lv up 必要 EXP を減らす',             category:'rare' },
  legendary_link:     { name:'共鳴',   desc:'仲間の他特性の効果を上乗せ',          category:'rare' },
  legendary_burst:    { name:'神撃',   desc:'合体で稀にメガバースト',              category:'rare' },
  legendary_aurora:   { name:'極光',   desc:'背景演出が派手になり EXP も増える',   category:'rare' },
  legendary_void:     { name:'虚無',   desc:'消滅した字も合体判定に残る',          category:'rare' },
  legendary_destiny:  { name:'運命',   desc:'高レアの字が稀に降ってくる',          category:'rare' },
  legendary_compass:  { name:'羅針',   desc:'パーティ字の出現率を上げる',          category:'rare' },
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

// v1.5.35: 字ごとのステータス ── タグ＋字コードで決定（決定論的）
// 4 ステータス：速（落下速度）/ 力（EXP倍率）/ 命（寿命）/ 結（融合範囲）
function _hashCode(s) {
  let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const _charStatCache = new Map();
function getCharStats(c) {
  if (_charStatCache.has(c)) return _charStatCache.get(c);
  const tags = getCharTags(c);
  let speed = 3, power = 3, life = 3, bond = 3;  // 1-5 スケール
  // タグ補正
  if (tags.includes('火') || tags.includes('雷') || tags.includes('武')) power += 2;
  if (tags.includes('風') || tags.includes('鳥') || tags.includes('天体')) speed += 2;
  if (tags.includes('水') || tags.includes('雨') || tags.includes('花')) bond += 2;
  if (tags.includes('山') || tags.includes('土') || tags.includes('神字')) life += 2;
  if (tags.includes('禅') || tags.includes('仏教') || tags.includes('思想')) life += 1;
  if (tags.includes('感情') || tags.includes('愛')) bond += 1;
  // ハッシュ揺らぎ（±1）
  const h = _hashCode(c);
  speed += ((h >> 0) % 3) - 1;
  power += ((h >> 4) % 3) - 1;
  life  += ((h >> 8) % 3) - 1;
  bond  += ((h >> 12) % 3) - 1;
  // v1.5.37: 雨 ── ブランド字なので全ステータス +1 優遇
  if (c === '雨') { speed += 1; power += 1; life += 1; bond += 1; }
  // クランプ 1-5
  const cl = v => Math.max(1, Math.min(5, v));
  const stats = { speed:cl(speed), power:cl(power), life:cl(life), bond:cl(bond) };
  _charStatCache.set(c, stats);
  return stats;
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
  // v1.4.5: メイン + ベンチ（サブパーティ）両方から特性を集める
  const allMembers = [
    ...(STATE.party.members || []),
    ...(STATE.party.bench || []),
  ];
  const seenPerks = new Set();
  for (const m of allMembers) {
    for (const pid of (m.perks || [])) {
      if (seenPerks.has(pid)) continue;  // 同特性は1回だけ集計（Lv が共有なので）
      seenPerks.add(pid);
      const p = PERKS[pid]; if (!p) continue;
      const pw = perkPower(pid);  // Lv による倍率（1.0〜2.6+）
      // v6（2026-05-17）インクリメンタル・インフレ：base 1〜3% / Lv1000 で数十億倍
      // pw = Lv^3.23 ── Lv1=1, Lv10≈1700, Lv100≈290万, Lv1000≈50億
      // 乗算系（expMul/gravityMul 等）はそのまま天井知らず
      // 加算系（dropCount/evoDiscount）は log で整形＋上限ガード（暴走防止）
      const dropAdd = (factor) => Math.min(80, Math.max(0, Math.floor(Math.log10(Math.max(1, pw)) * factor)));
      const evoAdd  = (factor) => Math.min(0.95, Math.log10(Math.max(1, pw)) * factor);

      switch (pid) {
        case 'haste':    agg.gravityMul *= 1 + (0.01 * pw); break;                          // Lv1=+1% / Lv1000=+5000万%
        case 'feather':  agg.gravityMul *= Math.max(0.01, 1 - (0.01 * pw));                 // 落下激減（最低 1%）
                         agg.mergeRadiusMul *= 1 + (0.01 * pw); break;
        case 'wide':     agg.mergeRadiusMul *= 1 + (0.02 * pw); break;                      // Lv1=+2%
        case 'bounty':   agg.dropCountAdd += dropAdd(8); break;                             // Lv10=+8 / Lv100=+16 / Lv1000=+72 (cap 80)
        case 'scholar':  agg.expMul *= 1 + (0.01 * pw); break;                              // ★ 主役の EXP インフレ
        case 'prodigy':  agg.evoDiscount += evoAdd(0.15); break;                            // Lv1000=-45%（cap -95%）
        case 'magnet':   agg.magnet = true; break;
        case 'chain':    agg.chain = true; break;
        case 'blessing': agg.blessing = Math.max(1, Math.round(5 / Math.max(1, Math.log10(pw)+1))); break;
        case 'guardian': /* 既存仕様 */ break;
        case 'tag_emo':    agg.tagBonus['感情'] = (agg.tagBonus['感情']||1) + (0.03 * pw); break;
        case 'tag_learn':  agg.tagBonus['学']   = (agg.tagBonus['学']||1)   + (0.03 * pw); break;
        case 'tag_nature': agg.dropCountAdd += dropAdd(5); break;
        case 'tag_war':    agg.tagBonus['武']   = (agg.tagBonus['武']||1)   + (0.02 * pw); break;
        case 'tag_sin':    agg.dropCountAdd += dropAdd(5); break;
        case 'tag_zen':    agg.tagBonus['禅']   = (agg.tagBonus['禅']||1)   + (0.02 * pw); break;
        case 'tag_beauty': agg.instantEvoOn.push('美'); break;
        case 'tag_sacred': agg.tagBonus['神字'] = (agg.tagBonus['神字']||1) + (0.02 * pw); break;
        case 'tag_time':   agg.tagBonus['時']   = (agg.tagBonus['時']||1)   + (0.01 * pw); break;
        case 'tag_virtue': agg.tagBonus['七徳'] = (agg.tagBonus['七徳']||1) + (0.02 * pw); break;
        case 'tag_numeral': agg.expMul *= 1 + (0.005 * pw); agg.tagBonus['数字'] = (agg.tagBonus['数字']||1) + (0.01 * pw); break;
        case 'tag_english': agg.gravityMul *= Math.max(0.01, 1 - (0.005 * pw));
                            agg.tagBonus['英語'] = (agg.tagBonus['英語']||1) + (0.01 * pw); break;
        case 'tag_order':   agg.expMul *= 1 + (0.005 * pw); break;
        // ─── レア特性 ────────────────────────────────────────
        case 'legendary_radiance': agg.expMul *= 1 + (0.03 * pw); break;                    // EXP インフレ加速
        case 'legendary_growth':   agg.evoDiscount += evoAdd(0.20); break;
        case 'legendary_link':     agg.linkBonus = (agg.linkBonus || 0) + 0.01 * pw; break;
        case 'legendary_burst':    agg.megaBurst = Math.min(0.95, (agg.megaBurst || 0) + 0.005 * pw); break;  // 発火率 cap 95%
        case 'legendary_aurora':   agg.expMul *= 1 + (0.02 * pw); document.body?.classList.add('aurora-mode'); break;
        case 'legendary_void':     agg.voidEcho = true; break;
        case 'legendary_destiny':  agg.destinyChance = Math.min(0.95, (agg.destinyChance || 0) + 0.003 * pw); break;
        case 'legendary_compass':  agg.partyDropRate = 1 + (0.02 * pw); break;
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
  }
  //  SPECIAL コンボ系の追加効果（落下／合体／粒数／ストックEXP）
  if (combo.gravityMul && combo.gravityMul !== 1.0)        agg.gravityMul *= combo.gravityMul;
  if (combo.mergeRadiusMul && combo.mergeRadiusMul !== 1.0) agg.mergeRadiusMul *= combo.mergeRadiusMul;
  if (combo.dropCountAdd)                                   agg.dropCountAdd += combo.dropCountAdd;
  if (combo.stockExpMul && combo.stockExpMul !== 1.0)       agg.stockExpMul = (agg.stockExpMul || 1.0) * combo.stockExpMul;
  // v10n20: 武タグコンボの megaBurstAdd を発火率に合流（cap 95%）
  if (combo.megaBurstAdd) agg.megaBurst = Math.min(0.95, (agg.megaBurst || 0) + combo.megaBurstAdd);
  agg.activeCombos = combo.combos;
  // v10n13: パッシブ ── コレクション／継続由来の恒久弱効果を合流
  try {
    const pas = computePassiveBonus();
    if (pas.expMul && pas.expMul > 1)         agg.expMul *= pas.expMul;
    if (pas.evoBoost)                          agg.evoDiscount += pas.evoBoost;
    if (pas.gravityMul && pas.gravityMul < 1)  agg.gravityMul *= pas.gravityMul;
    if (pas.mergeRadiusMul && pas.mergeRadiusMul > 1) agg.mergeRadiusMul *= pas.mergeRadiusMul;
    if (pas.dropCountAdd)                      agg.dropCountAdd += pas.dropCountAdd;
    if (pas.stockExpMul && pas.stockExpMul > 1) agg.stockExpMul = (agg.stockExpMul || 1) * pas.stockExpMul;
    agg.activePassives = getActivePassives();
  } catch(_) {}
  // v1.0.1: パーティタップ一時バフ（30 秒）を合流
  try { applyTempBuffs(agg); } catch(_) {}
  // v1.3.12: 環境ボーナス（季節・月・曜日・週）合流
  try {
    const env = computeEnvBonus();
    if (env.expMul > 1)         agg.expMul        *= env.expMul;
    if (env.evoBoost)            agg.evoDiscount  += env.evoBoost;
    if (env.gravityMul < 1)      agg.gravityMul   *= env.gravityMul;
    if (env.mergeRadiusMul > 1)  agg.mergeRadiusMul *= env.mergeRadiusMul;
    if (env.dropCountAdd)        agg.dropCountAdd += env.dropCountAdd;
    if (env.stockExpMul > 1)     agg.stockExpMul   = (agg.stockExpMul || 1) * env.stockExpMul;
    agg.activeEnv = getActiveEnvBonuses();
  } catch(_) {}
  // v1.5.11: 使用中の土台ボーナス合流
  try {
    const lb = getActiveLedgeBonus();
    if (lb.expMul)         agg.expMul        *= lb.expMul;
    if (lb.evoBoost)        agg.evoDiscount  += lb.evoBoost;
    if (lb.gravityMul)      agg.gravityMul   *= lb.gravityMul;
    if (lb.mergeRadiusMul)  agg.mergeRadiusMul *= lb.mergeRadiusMul;
    if (lb.dropCountAdd)    agg.dropCountAdd += lb.dropCountAdd;
    if (lb.stockExpMul)     agg.stockExpMul   = (agg.stockExpMul || 1) * lb.stockExpMul;
  } catch(_) {}
  // v1.5.16: 画面上ライブぽもじボーナス（1 字 +0.5% EXP、上限 +30%）
  try {
    const live = Array.from(livePomoji.values()).filter(p => !p.persistent && !p.rising).length;
    const liveBonus = 1 + Math.min(0.30, live * 0.005);
    if (liveBonus > 1) agg.expMul *= liveBonus;
    agg.liveCount = live;
  } catch(_) {}
  return agg;
}

// v1.2.2: EXP カーブを急に（あと1で〜が頻発する問題対策）
// 旧: 10 * lv^1.6 → Lv1→2 で 10 必要（タップ数回で達成）
// 新: 60 * lv^1.8 → Lv1→2 で 60、Lv10→11 で 3,800、Lv100→101 で 24万
// v1.4.2: カーブ更にキツく（cap 10 ★1 でも実感ある手応え）
const expForLevel = (lv) => Math.floor(250 * Math.pow(lv, 2.5));
// v1.4.1: レア度ごと Lv 上限（タイト・段階的）＋最高 Lv 字で上限解放
const RARITY_LV_CAP_BASE = {
  '★1':10,'★2':15,'★3':20,'★4':30,'★5':50,'★6':80,'★7':120,'★8':180,
  '★9':250,'★10':350,'★11':500,'★12':800,'★13':1500,'★14':3000,'★15':10000,'★16':100000,
};
function rarityCapMultiplier() {
  if (!STATE.charLevels) return 1;
  let maxLv = 0;
  for (const c of Object.keys(STATE.charLevels)) {
    const lv = STATE.charLevels[c]?.level || 0;
    if (lv > maxLv) maxLv = lv;
  }
  return 1 + Math.floor(maxLv / 500) * 0.5;  // 500 Lv 毎に全 cap +50%
}
function rarityLvCap(rarity) {
  return Math.floor((RARITY_LV_CAP_BASE[rarity] || 100000) * rarityCapMultiplier());
}
// v1.5.38: 字ごと限界突破ボーナス（charCapBoost[c] = +N Lv）
function effectiveLvCap(m) {
  if (!m) return 0;
  const base = rarityLvCap(m.rarity);
  const boost = (STATE.charCapBoost && STATE.charCapBoost[m.char]) || 0;
  return base + boost;
}
function isAtRarityCap(m) { return m && (m.level >= effectiveLvCap(m)); }
// 限界突破 ── 1回 +10 Lv ・ コスト：ストック (rIdx+1) × 5
function limitBreakChar(c, rarity) {
  const rIdx = Math.max(0, RARITY_TIERS.indexOf(rarity));
  const cost = (rIdx + 1) * 5;
  const owned = (STATE.stock || {})[c] || 0;
  if (owned < cost) { toast(`限界突破には ${c} を ${cost} 個必要（現 ${owned}）`); return false; }
  STATE.stock[c] -= cost;
  if (STATE.stock[c] <= 0) delete STATE.stock[c];
  if (!STATE.charCapBoost) STATE.charCapBoost = {};
  STATE.charCapBoost[c] = (STATE.charCapBoost[c] || 0) + 10;
  saveState();
  invalidateAggCache();
  toast(`限界突破！ ${c} の Lv 上限 +10`, rarity);
  return true;
}
// 進化加速の上限を 95% → 50% に抑制（実効必要 EXP がほぼ 0 にならない）
function effectiveExpForLevel(lv) {
  const disc = (typeof _aggCache !== 'undefined' && _aggCache && _aggCache.evoDiscount)
    ? Math.min(0.50, _aggCache.evoDiscount) : 0;
  return Math.max(1, Math.floor(expForLevel(lv) * (1 - disc)));
}
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
  timer: { workSec: 25*60, restSec: 5*60, presetIdx: 0, setsTarget: 3, setsDone: 0 },
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
  discoveredYoji: {},             // v6 ─ 解放済の熟語 { '一期一会': 1746543210 }
  streak: { current: 0, longest: 0, lastDate: null },  // v7 ─ 連続日数 streak
  dailyCycles: {},                // v7b ─ 日別サイクル数 { '2026-05-17': 5 }
  milestones: {},                 // v10 ─ 長期達成バッジ { 'cycle_100': 1746543210, 'char_10000': ... }
  streakFreezes: 0,               // v10n ─ ストリークフリーズ：10日ごと +1、1日休みを救済（最大3）
  lastBackupAt: null,             // v10n ─ 最終 JSON バックアップ日時（何十年遊ぶための安全網）
  favorites: { chars: {}, yoji: {} }, // v10n8 ─ お気に入り（★）字／熟語
  partyPresets: [],               // v10n9 ─ パーティプリセット [{name, hero, members[]}]
  lastSeenVersion: '',            // v10n10 ─ 新機能ツアー既読バージョン
  hudEnabled: true,               // v10n10 ─ プレイ中 HUD 表示 ON/OFF
  themePref: 'auto',              // v10n19 ─ 'auto' / 'spring' / 'summer' / 'autumn' / 'winter' / 'dark' / 'light'
  ledgeStyle: 'default',          // v1.5.9 ─ 'default' / 'stone' / 'wood' / 'ornate' / 'jade' / 'cosmos' / 'divine'
  tfontStyle: 'serif',            // v1.5.10 ─ 'serif' / 'mono' / 'brush'
  charDisplayStyle: {},           // v1.5.13 ─ { char: 'auto'/'plain'/'lvband-novice'/... }
  dailyLog: {},                   // v10n ─ 日別実績 { 'YYYY-MM-DD': { newChars, newYoji, exp } }
  lastShownDailyReport: null,     // v10n ─ 「送り状」を最後に見た日付（重複表示防止）
};

// 長期達成マイルストーン（何十年遊べる目標）
// progress: (state) => [current, threshold] を返す ── 「あと何」「進捗バー」算出用
const _cur = (s) => ({
  cyc: s.stats?.totalCycles || 0,
  str: s.streak?.longest || 0,
  chr: Object.keys(s.collection||{}).length,
  yoj: Object.keys(s.discoveredYoji||{}).length,
  lv:  s.party?.members?.[s.party?.hero||0]?.level || 0,
});
const _mk = (id, label, desc, kind, thr) => ({
  id, label, desc,
  check: s => _cur(s)[kind] >= thr,
  progress: s => [_cur(s)[kind], thr],
});

const MILESTONES = [
  // サイクル系
  _mk('cycle_10',    '初心', '累計 10 サイクル', 'cyc', 10),
  _mk('cycle_100',   '継続', '累計 100 サイクル', 'cyc', 100),
  _mk('cycle_1000',  '熟達', '累計 1,000 サイクル（約 1 年）', 'cyc', 1000),
  _mk('cycle_10000', '達人', '累計 10,000 サイクル（約 10 年）', 'cyc', 10000),
  // 連続日数
  _mk('streak_7',    '一週間', '連続 7 日', 'str', 7),
  _mk('streak_30',   '一か月', '連続 30 日', 'str', 30),
  _mk('streak_100',  '百日',   '連続 100 日', 'str', 100),
  _mk('streak_365',  '一年',   '連続 365 日', 'str', 365),
  _mk('streak_1000', '千日',   '連続 1,000 日（約 3 年）', 'str', 1000),
  // 字発見系
  _mk('char_100',   '初学',       '100 字 発見', 'chr', 100),
  _mk('char_1000',  '学識',       '1,000 字 発見', 'chr', 1000),
  _mk('char_10000', '博学',       '10,000 字 発見', 'chr', 10000),
  _mk('char_all',   '世界の文字', '全字発見（41,890+）', 'chr', 41890),
  // 熟語系
  _mk('yoji_100',  '語彙', '100 熟語 解放', 'yoj', 100),
  _mk('yoji_1000', '語学', '1,000 熟語 解放', 'yoj', 1000),
  _mk('yoji_4000', '達語', '4,000 熟語 全解放', 'yoj', 4000),
  // Lv 系（無限育成の到達点）── 何十年遊べる育成型ポモドーロの記憶
  _mk('lv_100',     '楷書師', '主人公 Lv.100 到達',                       'lv', 100),
  _mk('lv_1000',    '創造主', '主人公 Lv.1,000 到達（進化10段階）',       'lv', 1000),
  _mk('lv_10000',   '永劫者', '主人公 Lv.10,000 到達',                    'lv', 10000),
  _mk('lv_100000',  '無始',   '主人公 Lv.100,000 到達',                   'lv', 100000),
  _mk('lv_1000000', '永遠',   '主人公 Lv.1,000,000 到達（人智の極）',    'lv', 1000000),
];

// 達成チェック（completePhase, addStock 等から定期的に呼ぶ）
function checkMilestones() {
  if (!STATE.milestones) STATE.milestones = {};
  if (!STATE.favorites) STATE.favorites = { chars: {}, yoji: {} };
  if (!STATE.favorites.chars) STATE.favorites.chars = {};
  if (!STATE.favorites.yoji)  STATE.favorites.yoji  = {};
  if (!Array.isArray(STATE.partyPresets)) STATE.partyPresets = [];
  if (typeof STATE.lastSeenVersion !== 'string') STATE.lastSeenVersion = '';
  if (typeof STATE.hudEnabled !== 'boolean') STATE.hudEnabled = true;
  if (typeof STATE.themePref !== 'string') STATE.themePref = 'auto';
  if (typeof STATE.ledgeStyle !== 'string') STATE.ledgeStyle = 'default';
  if (typeof STATE.tfontStyle !== 'string') STATE.tfontStyle = 'serif';
  if (!STATE.charDisplayStyle || typeof STATE.charDisplayStyle !== 'object') STATE.charDisplayStyle = {};
  // v1.3.18: 字ごと Lv 永続化（パーティ抜けても保持）
  if (!STATE.charLevels) STATE.charLevels = {};  // { char: { level, exp, perks } }
  // v10n15: 堅牢化 ── 旧 state 構造の破損対策
  try {
    if (STATE.party && STATE.party.members) {
      for (const m of STATE.party.members) {
        if (typeof m.level !== 'number' || !isFinite(m.level)) m.level = 1;
        if (typeof m.exp !== 'number' || !isFinite(m.exp))     m.exp = 0;
        if (!Array.isArray(m.perks)) m.perks = [];
      }
      // v1.4.5: ベンチ枠
      if (!Array.isArray(STATE.party.bench)) STATE.party.bench = [];
      for (const m of STATE.party.bench) {
        if (typeof m.level !== 'number' || !isFinite(m.level)) m.level = 1;
        if (typeof m.exp !== 'number' || !isFinite(m.exp))     m.exp = 0;
        if (!Array.isArray(m.perks)) m.perks = [];
      }
      if (typeof STATE.party.hero !== 'number' || STATE.party.hero < 0 || STATE.party.hero >= STATE.party.members.length) {
        STATE.party.hero = 0;
      }
    }
    if (!STATE.stats) STATE.stats = { totalCycles:0, totalDrops:0, totalExp:0 };
    if (typeof STATE.stats.totalCycles !== 'number') STATE.stats.totalCycles = 0;
    if (typeof STATE.stats.totalDrops  !== 'number') STATE.stats.totalDrops  = 0;
    if (typeof STATE.stats.totalExp    !== 'number') STATE.stats.totalExp    = 0;
    if (!STATE.collection) STATE.collection = {};
    if (!STATE.discoveredYoji) STATE.discoveredYoji = {};
    if (!STATE.timer) STATE.timer = { workSec: 25*60, restSec: 5*60, presetIdx: 0 };
    if (typeof STATE.timer.workSec !== 'number' || STATE.timer.workSec < 60) STATE.timer.workSec = 25*60;
    if (typeof STATE.timer.restSec !== 'number' || STATE.timer.restSec < 60) STATE.timer.restSec = 5*60;
    if (typeof STATE.timer.setsTarget !== 'number') STATE.timer.setsTarget = 3;
    if (typeof STATE.timer.setsDone   !== 'number') STATE.timer.setsDone   = 0;
  } catch(_) {}
  let newlyAchieved = [];
  for (const m of MILESTONES) {
    if (STATE.milestones[m.id]) continue;
    if (m.check(STATE)) {
      STATE.milestones[m.id] = Date.now();
      newlyAchieved.push(m);
    }
  }
  if (newlyAchieved.length > 0) {
    saveState();
    // 複数同時達成時は順に演出（350ms 間隔）
    newlyAchieved.forEach((m, i) => {
      setTimeout(() => {
        try { spawnMilestoneCelebration(m); } catch(_) {}
        toast(`🏆 達成「${m.label}」 ── ${m.desc}`, '★16');
        try { playSFX('milestone'); } catch(_) {}
        try { setTimeout(() => playSFX('discover'), 200); } catch(_) {}
      }, i * 350);
    });
  }
}

// 🏆 マイルストーン達成フルスクリーン演出（v10n / 2026-05-18）
function spawnMilestoneCelebration(m) {
  $$('.milestone-celebration').forEach(n => n.remove());
  const overlay = el('div', { class:'milestone-celebration' },
    el('div', { class:'mc-arc' }),
    el('div', { class:'mc-trophy' }, '🏆'),
    el('div', { class:'mc-label' }, '達成'),
    el('div', { class:'mc-title' }, m.label),
    el('div', { class:'mc-desc' }, m.desc),
  );
  document.body.appendChild(overlay);
  // 金粒シャワー（32 粒）
  for (let i = 0; i < 32; i++) {
    const p = el('div', { class:'mc-particle', style:{
      left: (Math.random() * 100) + '%',
      animationDelay: (Math.random() * 0.5) + 's',
      animationDuration: (1.8 + Math.random() * 1.6) + 's',
      background: ['#fff5b0', '#ffd866', '#f0c44a', '#ffe9a0'][i % 4],
    } });
    overlay.appendChild(p);
  }
  // タップで早送り
  overlay.addEventListener('click', () => overlay.remove(), { once:true });
  setTimeout(() => overlay.remove(), 3600);
}

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
  if (_previewMode) return;
  if (!STATE.userId) {
    STATE.userId = generateUserId();
    STATE.userCreatedAt = new Date().toISOString();
  }
  // v1.3.18: 字ごと Lv を charLevels に同期（パーティ抜けても保持）
  try { preserveMemberLevels(STATE.party?.members); } catch(_) {}
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

// 🛟 バックアップ状態表示 ── stats モーダル open 時に更新
function updateBackupStatus() {
  const actions = $('.uiz-actions');
  if (!actions) return;
  // 既存ステータス削除
  $$('.uiz-backup-status').forEach(n => n.remove());
  const totalCycles = STATE.stats?.totalCycles || 0;
  // <100 サイクル：まだ警告しない
  if (totalCycles < 100) return;
  const last = STATE.lastBackupAt;
  let text, cls;
  if (!last) {
    text = '⚠ 一度もバックアップしていません ── 進捗が大きい今こそ「 JSON バックアップ」を';
    cls = 'danger';
  } else {
    const days = Math.floor((Date.now() - last) / 86400000);
    if (days < 7) {
      text = `✅ 最終バックアップ：${days} 日前 ── 安心の安全網`;
      cls = 'ok';
    } else if (days < 30) {
      text = `⏰ 最終バックアップ：${days} 日前 ── そろそろ更新を`;
      cls = 'warn';
    } else {
      text = `⚠ 最終バックアップ：${days} 日前 ── 進捗保護のため更新推奨`;
      cls = 'danger';
    }
  }
  const status = el('div', { class: `uiz-backup-status ${cls}` }, text);
  actions.parentElement?.insertBefore(status, actions.nextSibling);
}

// JSON バックアップ ── 全 STATE をダウンロード
function exportStateJSON() {
  try {
    const data = {
      app: 'pomojikan',
      exportedAt: new Date().toISOString(),
      state: STATE,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pomojikan-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    // v10n：最終バックアップ日時を記録（何十年遊ぶための安全網）
    STATE.lastBackupAt = Date.now();
    saveState();
    toast(' バックアップを保存', '★14');
  } catch (e) {
    toast('バックアップ失敗', '★1');
  }
}

// JSON 復元 ── ファイル選択 → STATE 上書き
function importStateJSON() {
  if (!confirm('現在のデータを JSON で上書きしますか？（取り消せません）')) return;
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.state || data.app !== 'pomojikan') throw new Error('format mismatch');
        Object.assign(STATE, data.state);
        saveState();
        toast('📂 復元完了 ・ リロードします', '★14');
        setTimeout(() => location.reload(), 1200);
      } catch (err) {
        toast('JSON 解析失敗: ' + err.message, '★1');
      }
    };
    reader.readAsText(file);
  };
  input.click();
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
    }, ' もう一度コピー')
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
    toast('音響オン（雨と泡）');
  } else {
    stopRainAudio();
    stopBubbleAudio();
    toast('音響オフ');
  }
}

function updateAudioButton() {
  // 旧ヘッダー（残ってる場合のみ）
  const emoji = $('#btn-audio .ib-emoji');
  if (emoji) emoji.textContent = STATE.audioOn ? '音' : '無';
  // 新ドロワーメニュー
  const mEmoji = $('#m-audio-emoji');
  if (mEmoji) {
    const mode = STATE.iconMode || 'emoji';
    mEmoji.textContent = mode === 'kanji'
      ? (STATE.audioOn ? '音' : '無')
      : (STATE.audioOn ? '🔊' : '🔇');
  }
  const mState = $('#m-audio-state');
  if (mState) mState.textContent = STATE.audioOn ? 'オン' : 'オフ';
}

// ═══════════════════════════════════════════════════════════════
// 全画面背景：雨（作業中）／ 泡（休憩中）
// ═══════════════════════════════════════════════════════════════
function buildBackgroundLayers() {
  const rain = $('#rain-bg');
  const bub  = $('#bubble-bg');
  // 雨：パーティの最高 Lv に応じて密度を上げる（最大 120 粒）
  const heroLv = isPartyChosen() ? partyHeroLevel() : 0;
  const rainN = Math.min(120, 60 + Math.floor(heroLv / 10));
  const bubN  = Math.min(60, 28 + Math.floor(heroLv / 20));
  if (rain && !rain.children.length) {
    for (let i = 0; i < rainN; i++) {
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
    for (let i = 0; i < bubN; i++) {
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

// v1.5.28: パーティ字に応じた天候モード ── 雨/晴/雪/雲/風/雷/桜/星/月/炎
const WEATHER_MAP = {
  heavyrain: ['雨','梅','霖','雫','霧','霜','露','潤','湿','滴'],
  rain:    [],  // 既定（パーティに天候字なし時）
  sunny:   ['晴','陽','日','明','光','輝','燦','照','耀'],
  snow:    ['雪','氷','冬','寒','凍','霰','雹'],
  cloudy:  ['雲','曇','霞','靄','朦'],
  wind:    ['風','嵐','颯','涼','吹'],
  thunder: ['雷','閃','電','轟','稲'],
  blossom: ['桜','花','華','蕾','咲','桃','梅'],
  star:    ['星','宙','銀','彗','宇'],
  moon:    ['月','夜','闇','宵','朧'],
  fire:    ['炎','火','焔','燃','灯','烈'],
};
function detectPartyWeather() {
  if (!STATE.party || !STATE.party.members) return null;
  const heroIdx = STATE.party.hero || 0;
  // リーダー優先 → 仲間順 → ベンチ
  const bench = STATE.party.bench || [];
  const ordered = [
    STATE.party.members[heroIdx],
    ...STATE.party.members.filter((_, i) => i !== heroIdx),
    ...bench,
  ];
  for (const m of ordered) {
    if (!m || !m.char) continue;
    for (const [mode, chars] of Object.entries(WEATHER_MAP)) {
      if (chars.includes(m.char)) return mode;
    }
  }
  return null;
}
function applyWeatherMode() {
  const w = detectPartyWeather();
  document.body.dataset.weather = w || 'rain';
}

// パーティ Lv が大きく上がった時に背景密度を更新（毎回 dispose して再構築）
function refreshBackgroundDensity() {
  const rain = $('#rain-bg');
  const bub  = $('#bubble-bg');
  if (rain) rain.innerHTML = '';
  if (bub) bub.innerHTML = '';
  buildBackgroundLayers();
  try { applyWeatherMode(); } catch(_) {}
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
  // Web Share API 対応端末ではネイティブ共有を優先
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'ぽもじかん ── パーティ共有',
        text: 'このパーティで集中タイマー、試してみる？',
        url,
      });
      return;
    } catch (e) {
      // ユーザーキャンセル等は無視してフォールバック
      if (e.name !== 'AbortError') {
        // 続行
      } else {
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(' 共有 URL をコピーしました', '★12');
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

//  アプリ名隠しコンボ（SPECIAL_COMBOS）── 通常熟語より段違いの効果
// 「ぽも時間」＝時の凝縮（時間を彫る）
// 「ぽ文字漢」＝字を集める（収集に特化）
// v1.1.8: MBTI 16 種コンボ ── 英字 4 字パーティで発動、性格に合わせた効果
const MBTI_COMBOS = [
  // 分析家（NT）
  { word:'INTJ', chars:['I','N','T','J'], rarity:'★14', desc:'建築家 ── 未来を構築',     effect:{ expMul:1.8, evoBoost:0.15 }, special:true },
  { word:'INTP', chars:['I','N','T','P'], rarity:'★14', desc:'論理学者 ── 探究の深淵',   effect:{ stockExpMul:1.6, expMul:1.4 }, special:true },
  { word:'ENTJ', chars:['E','N','T','J'], rarity:'★14', desc:'指揮官 ── 戦略の頂',       effect:{ expMul:2.0, dropCountAdd:2 }, special:true },
  { word:'ENTP', chars:['E','N','T','P'], rarity:'★14', desc:'討論者 ── 閃きの嵐',       effect:{ mergeRadiusMul:1.5, expMul:1.5 }, special:true },
  // 外交官（NF）
  { word:'INFJ', chars:['I','N','F','J'], rarity:'★14', desc:'提唱者 ── 静かな信念',     effect:{ gravityMul:0.6, evoBoost:0.20 }, special:true },
  { word:'INFP', chars:['I','N','F','P'], rarity:'★14', desc:'仲介者 ── 内なる詩',       effect:{ mergeRadiusMul:1.4, expMul:1.3 }, special:true },
  { word:'ENFJ', chars:['E','N','F','J'], rarity:'★14', desc:'主人公 ── 導く光',         effect:{ expMul:1.7, evoBoost:0.18, mergeRadiusMul:1.2 }, special:true },
  { word:'ENFP', chars:['E','N','F','P'], rarity:'★14', desc:'運動家 ── 弾ける情熱',     effect:{ dropCountAdd:3, mergeRadiusMul:1.4 }, special:true },
  // 番人（SJ）
  { word:'ISTJ', chars:['I','S','T','J'], rarity:'★14', desc:'管理者 ── 着実な堆積',     effect:{ stockExpMul:1.8, expMul:1.3 }, special:true },
  { word:'ISFJ', chars:['I','S','F','J'], rarity:'★14', desc:'擁護者 ── 守りの温度',     effect:{ gravityMul:0.7, stockExpMul:1.4 }, special:true },
  { word:'ESTJ', chars:['E','S','T','J'], rarity:'★14', desc:'幹部 ── 規律の力',         effect:{ expMul:1.8, stockExpMul:1.3 }, special:true },
  { word:'ESFJ', chars:['E','S','F','J'], rarity:'★14', desc:'領事 ── 結ぶ手',           effect:{ mergeRadiusMul:1.6, expMul:1.3 }, special:true },
  // 探索家（SP）
  { word:'ISTP', chars:['I','S','T','P'], rarity:'★14', desc:'巨匠 ── 手の知恵',         effect:{ dropCountAdd:2, mergeRadiusMul:1.3 }, special:true },
  { word:'ISFP', chars:['I','S','F','P'], rarity:'★14', desc:'冒険家 ── 静かな彩り',     effect:{ gravityMul:0.75, mergeRadiusMul:1.3 }, special:true },
  { word:'ESTP', chars:['E','S','T','P'], rarity:'★14', desc:'起業家 ── 飛び込む者',     effect:{ dropCountAdd:3, expMul:1.5 }, special:true },
  { word:'ESFP', chars:['E','S','F','P'], rarity:'★14', desc:'エンターテイナー ── 祭の核', effect:{ dropCountAdd:2, mergeRadiusMul:1.4, expMul:1.3 }, special:true },
];

const SPECIAL_COMBOS = [
  {
    word: 'ぽも時間',
    chars: ['ぽ','も','時','間'],
    rarity: '★16',
    season: 'SPECIAL',
    desc: '時の凝縮 ── 落下が緩み EXP が深く沁みる',
    effect: { expMul: 1.5, gravityMul: 0.7, evoBoost: 0.20, dropCountAdd: 1 },
    special: true,
  },
  {
    word: 'ぽ文字漢',
    chars: ['ぽ','文','字','漢'],
    rarity: '★16',
    season: 'SPECIAL',
    desc: '字を集める ── 字が多く降り、合体しやすくなる',
    effect: { dropCountAdd: 3, mergeRadiusMul: 1.4, expMul: 1.2, stockExpMul: 1.3 },
    special: true,
  },
];

function detectPartyCombos() {
  if (!STATE.party || !STATE.party.members.length) return [];
  const partyChars = STATE.party.members.map(m => m.char);
  const partySet = new Set(partyChars);
  const recipes = window.YOJI_RECIPES || [];
  const matches = [];
  //  アプリ名コンボ優先判定（通常熟語より上に）
  // v1.1.8: MBTI 16 種も SPECIAL 扱いで判定
  for (const sc of MBTI_COMBOS) {
    if (sc.chars.every(c => partySet.has(c))) matches.push(sc);
  }
  for (const sc of SPECIAL_COMBOS) {
    if (sc.chars.every(c => partySet.has(c))) {
      matches.push(sc);
    }
  }
  for (const r of recipes) {
    if (!r.chars || r.chars.length === 0) continue;
    // r.chars すべてがパーティに含まれるか
    if (r.chars.every(c => partySet.has(c))) {
      matches.push(r);
    }
  }
  // SPECIAL は最上位、その他はレア順（高い順）→ 字数（多い順）でソート
  matches.sort((a,b) => {
    if (a.special && !b.special) return -1;
    if (!a.special && b.special) return 1;
    const ra = RARITY_TIERS.indexOf(a.rarity);
    const rb = RARITY_TIERS.indexOf(b.rarity);
    if (ra !== rb) return rb - ra;
    return b.chars.length - a.chars.length;
  });
  return matches;
}

// レア重み：★が高いコンボほど効果倍増（無限スケールの足がかり）
const COMBO_RARITY_MUL = {
  '★1':1.0,  '★2':1.0,  '★3':1.0,  '★4':1.0,  '★5':1.0,
  '★6':1.3,  '★7':1.4,  '★8':1.5,
  '★9':1.7,  '★10':1.9, '★11':2.0,
  '★12':2.3, '★13':2.6,
  '★14':3.0, '★15':3.5,
  '★16':4.0,
};

// v10n4: 作成難易度 ── 構成字の平均レア × 字数 で「組み難さ」を計る
// 字数が多く・構成字がレアであるほど高難度＝報酬厚く
// v10n20: char → rarityIdx Map キャッシュ（O(n) lookup を O(1) 化）
// 起動時 4546 熟語 × 3.5 字 × 41890 codex の線形検索（約 6 億比較）を解消
let _charRarityCache = null;
function _buildCharRarityCache() {
  const codex = window.KANJI_CODEX || [];
  const m = new Map();
  for (const k of codex) {
    const c = k.char || k.c;
    if (c && k.rarity) {
      const idx = RARITY_TIERS.indexOf(k.rarity);
      m.set(c, idx >= 0 ? idx + 1 : 1);
    }
  }
  _charRarityCache = m;
}
function _charRarityIdx(c) {
  if (!_charRarityCache) _buildCharRarityCache();
  return _charRarityCache.get(c) || 1;
}
function comboDifficulty(r) {
  if (!r || !r.chars || !r.chars.length) return 1.0;
  let raritySum = 0, n = 0;
  for (const c of r.chars) {
    const v = _charRarityIdx(c);
    if (v) { raritySum += v; n++; }
  }
  const avgRar = n > 0 ? raritySum / n : 1;
  // 字数 2→1.0 / 3→1.3 / 4→1.7 / 5+→2.0+
  const lenMul = r.chars.length <= 2 ? 1.0
              : r.chars.length === 3 ? 1.3
              : r.chars.length === 4 ? 1.7
              : 2.0 + (r.chars.length - 5) * 0.15;
  // 平均レアの対数寄与（★1=0 / ★5=+0.7 / ★10=+1.0 / ★16=+1.23）
  const rarMul = 1 + Math.log10(avgRar + 1) * 0.5;
  return lenMul * rarMul;
}

// リーダー Lv による効果スケーリング（無限育成への接続）
// Lv 1=1.0 / Lv 100=+0.20 / Lv 1,000=+0.40 / Lv 10,000=+0.60 / Lv 1,000,000=+1.0
function leaderLvMul() {
  const lv = partyHeroLevel ? partyHeroLevel() : 1;
  return 1 + Math.log10(1 + Math.max(0, lv) / 10) * 0.20;
}

// v10n4: 固有効果コンボ ── 象徴的な熟語に「物語のある効果」を付与
// 固有効果がある熟語は通常タグ効果をスキップ（二重防止・暴走防止）
const UNIQUE_COMBO_EFFECTS = {
  // 四季・時の物語
  '春夏秋冬': { expMul:1.8, evoBoost:0.15, mergeRadiusMul:1.3, story:'一年を一巡 ── 四季すべてが力に' },
  '朝三暮四': { dropCountAdd:2, gravityMul:0.85, story:'朝夕の駆け引き ── 粒が増え時が緩む' },
  '日進月歩': { expMul:1.6, evoBoost:0.20, story:'絶え間ない歩み ── 経験と進化が同時に' },
  // 仏教・無常
  '諸行無常': { gravityMul:0.6, evoBoost:0.25, expMul:1.4, story:'すべては流れる ── 重力が解け進化が進む' },
  '色即是空': { stockExpMul:1.8, mergeRadiusMul:1.4, story:'形あるは空 ── ストックが深まり融合が広がる' },
  '因果応報': { expMul:2.0, evoBoost:0.20, story:'因が果を呼ぶ ── 積んだものが返る' },
  // 学び・成長
  '温故知新': { expMul:1.5, stockExpMul:1.5, story:'古きを温め新しきを知る ── 蓄積が活きる' },
  '切磋琢磨': { expMul:1.7, mergeRadiusMul:1.5, story:'磨き合う ── 字どうしが響き合う' },
  '一期一会': { expMul:2.0, dropCountAdd:3, story:'この一瞬の出会い ── 粒の一つ一つが重い' },
  // 不屈・武
  '不撓不屈': { gravityMul:0.7, expMul:1.4, evoBoost:0.10, story:'折れない ── 重力に逆らって育つ' },
  '起死回生': { expMul:2.4, evoBoost:0.15, dropCountAdd:2, story:'死から生へ ── 流れを反転させる極大の力' },
  '大器晩成': { expMul:1.4, evoBoost:0.30, stockExpMul:1.5, story:'器は遅れて成る ── 進化に深い加速' },
  '百花繚乱': { dropCountAdd:4, mergeRadiusMul:1.4, expMul:1.5, story:'花咲き乱れる ── 字が一斉に降り組み合う' },
  '風林火山': { gravityMul:0.5, expMul:1.7, dropCountAdd:2, story:'疾く 静かに 侵し 動かず ── 四相が同時に' },
  '質実剛健': { expMul:1.6, evoBoost:0.10, stockExpMul:1.3, story:'飾らず 強い ── 安定した底上げ' },
  '平常心': { gravityMul:0.75, expMul:1.3, mergeRadiusMul:1.2, story:'波立たぬ心 ── 静かに全てが整う' },
  '電光石火': { gravityMul:0.4, dropCountAdd:5, story:'稲妻のごとく ── 粒が降り注ぎ落下も速まる（重力増）' },
  // 自然・天体
  '花鳥風月': { expMul:1.6, mergeRadiusMul:1.5, evoBoost:0.10, story:'自然の四象 ── 静かに広がる育成' },
  '森羅万象': { expMul:2.2, stockExpMul:1.5, evoBoost:0.20, story:'万物の全 ── 全効果が底上げ' },
};

// v10n5: 全コンボ固有効果生成器 ── タグ駆動でプロファイル決定（手書き UNIQUE 優先）
// 各熟語に「物語ある効果」を保証する。決定論的＝同じ熟語は常に同じ効果
const TAG_PROFILES = {
  // [exp, drop, grav, merge, stock, evo] 合計 ≈ 1.0
  '七徳':    { w:{exp:0.55, evo:0.25, stock:0.20}, story:'徳の力 ── 内に蓄えた善が外に滲む' },
  '徳':      { w:{exp:0.55, evo:0.25, stock:0.20}, story:'徳の力 ── 内に蓄えた善が外に滲む' },
  '善':      { w:{exp:0.55, evo:0.25, stock:0.20}, story:'善が積もる ── 静かな EXP の堆積' },
  '七大罪':  { w:{drop:0.50, exp:0.35, grav:0.15}, story:'罪の刃 ── 抑えきれぬ衝動が粒となって降る' },
  '罪':      { w:{drop:0.50, exp:0.35, grav:0.15}, story:'罪が増殖する ── 粒の数が増える' },
  '武':      { w:{drop:0.40, exp:0.40, grav:0.20}, story:'武の構え ── 一撃が深く重力に切り込む' },
  '戦':      { w:{drop:0.45, exp:0.35, grav:0.20}, story:'戦場の理 ── 速さと数が同時に' },
  '仏教':    { w:{grav:0.55, evo:0.30, exp:0.15}, story:'空の境地 ── 形が解けて時が緩む' },
  '仏':      { w:{grav:0.55, evo:0.30, exp:0.15}, story:'仏の沈黙 ── 重力が静まる' },
  '禅':      { w:{grav:0.60, evo:0.25, exp:0.15}, story:'禅の一座 ── 落下が瞑想に変わる' },
  '神字':    { w:{evo:0.50, exp:0.30, merge:0.20}, story:'神の字 ── 進化が一気に進む' },
  '神':      { w:{evo:0.45, exp:0.35, merge:0.20}, story:'神性の気配 ── 字が次の姿へ' },
  '宗教':    { w:{grav:0.45, evo:0.35, exp:0.20}, story:'祈りの形 ── 重力と進化が結ぶ' },
  '瞑想':    { w:{grav:0.60, evo:0.25, stock:0.15}, story:'瞑想の深度 ── 時が遅れ蓄積が深まる' },
  '自然':    { w:{merge:0.45, drop:0.30, exp:0.25}, story:'自然の息吹 ── 字が大地のように呼応する' },
  '天体':    { w:{exp:0.40, evo:0.30, merge:0.30}, story:'天体の運行 ── 静かで大きい力' },
  '植物':    { w:{merge:0.50, drop:0.30, stock:0.20}, story:'植物の繁茂 ── 字が枝のように広がる' },
  '花':      { w:{merge:0.45, drop:0.30, evo:0.25}, story:'花の開く間合い ── 字が美しく結ぶ' },
  '動物':    { w:{drop:0.45, exp:0.35, merge:0.20}, story:'動物の躍動 ── 粒が走り回る' },
  '美':      { w:{merge:0.50, evo:0.30, exp:0.20}, story:'美の調和 ── 字が引かれ合い融合が広がる' },
  '芸術':    { w:{merge:0.45, evo:0.30, exp:0.25}, story:'芸の表現 ── 字が次の段階へ昇華する' },
  '文化':    { w:{stock:0.40, exp:0.35, merge:0.25}, story:'文化の堆積 ── 蓄積が表現に変わる' },
  '時':      { w:{exp:0.40, evo:0.30, grav:0.30}, story:'時の流れ ── 経験と進化が同じ拍で進む' },
  '季節':    { w:{exp:0.40, merge:0.30, evo:0.30}, story:'季節の巡り ── 字が次の季節に渡る' },
  '時間':    { w:{exp:0.40, evo:0.30, grav:0.30}, story:'時間の刻み ── 一拍ずつ確実に' },
  '科学':    { w:{stock:0.50, exp:0.30, evo:0.20}, story:'理の結晶 ── 蓄積が次の式を生む' },
  '未来':    { w:{stock:0.40, evo:0.35, exp:0.25}, story:'未来の予兆 ── 進化と蓄積が手を組む' },
  '数学':    { w:{stock:0.45, exp:0.40, evo:0.15}, story:'数の連なり ── 規則が EXP に翻訳される' },
  '感情':    { w:{exp:0.45, merge:0.30, evo:0.25}, story:'心の波 ── 字に感情が乗り重みを増す' },
  '心':      { w:{exp:0.45, evo:0.30, merge:0.25}, story:'心の動き ── 字が共鳴する' },
  '言語':    { w:{stock:0.40, exp:0.35, merge:0.25}, story:'言葉の連鎖 ── 字と字が意味で結ばれる' },
  '文字':    { w:{stock:0.45, exp:0.30, merge:0.25}, story:'文字の凝縮 ── 字が字を呼ぶ' },
  '言葉':    { w:{stock:0.40, exp:0.35, merge:0.25}, story:'言葉の力 ── 意味が EXP を増幅する' },
  '思想':    { w:{exp:0.50, evo:0.30, stock:0.20}, story:'思索の果て ── 深い EXP に変わる' },
  '哲学':    { w:{exp:0.45, evo:0.35, stock:0.20}, story:'問いの形 ── 進化を促す思索' },
  '学':      { w:{stock:0.45, exp:0.35, evo:0.20}, story:'学びの積層 ── 知識が育成に乗る' },
  '人':      { w:{exp:0.40, merge:0.35, evo:0.25}, story:'人の縁 ── 字どうしが手を取る' },
  '家族':    { w:{merge:0.50, exp:0.30, evo:0.20}, story:'家族の結束 ── 融合が強まる' },
  '国':      { w:{stock:0.40, exp:0.35, evo:0.25}, story:'国の歴史 ── 蓄積が形になる' },
  '地名':    { w:{stock:0.40, merge:0.35, exp:0.25}, story:'地の記憶 ── 字に土地の重みが宿る' },
  '故事':    { w:{exp:0.45, evo:0.30, stock:0.25}, story:'故事の教え ── 過去から EXP が湧く' },
  '昭和':    { w:{exp:0.45, drop:0.30, merge:0.25}, story:'昭和の活気 ── 粒が勢いよく降る' },
  '令和':    { w:{drop:0.40, stock:0.30, exp:0.30}, story:'令和の脈動 ── 新しい拍で字が降る' },
  '色':      { w:{merge:0.50, drop:0.30, exp:0.20}, story:'色の連なり ── 字が彩り合う' },
  '数':      { w:{stock:0.45, exp:0.35, drop:0.20}, story:'数の整列 ── 規則的に EXP が積む' },
  '四字熟語':{ w:{exp:0.40, evo:0.25, merge:0.20, stock:0.15}, story:'四字の重み ── 四つの字で世界を切る' },
};

const STORY_DEFAULT_TEMPLATES = [
  '{w} ── 重力と引力が静かに整う',
  '{w} ── 字が呼応し EXP が深まる',
  '{w} ── 凝縮と発散の均衡',
  '{w} ── 意味が落下を遅らせる',
];

// タグから主要プロファイルを決める（最初に一致したものを採用 / なければ default）
function pickComboProfile(tags) {
  const profiles = [];
  for (const t of (tags || [])) {
    if (TAG_PROFILES[t]) profiles.push(TAG_PROFILES[t]);
  }
  if (profiles.length === 0) {
    return { w:{exp:0.55, evo:0.25, stock:0.20}, story:null };
  }
  // 主プロファイル（先頭）＋副（2 番目があれば 30% ブレンド）
  if (profiles.length === 1) return profiles[0];
  const a = profiles[0].w, b = profiles[1].w;
  const blended = {};
  const keys = ['exp','drop','grav','merge','stock','evo'];
  for (const k of keys) blended[k] = (a[k]||0) * 0.7 + (b[k]||0) * 0.3;
  return { w: blended, story: profiles[0].story };
}

// 決定論的疑似乱数（word ハッシュ）── 同じ熟語は常に同じ微差
function _wordHash(word) {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = ((h << 5) - h + word.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function generateAutoUniqueEffect(r) {
  if (!r || !r.chars) return null;
  const n = r.chars.length;
  const rar = COMBO_RARITY_MUL[r.rarity] || 1.0;
  const dif = comboDifficulty(r);
  // 規模係数（既存 baseExp と同等：通常コンボの強さを保つ）
  const baseScale = (n <= 2 ? 0.10 : n === 3 ? 0.30 : n === 4 ? 0.60 : 1.0) * rar * dif;
  const prof = pickComboProfile(r.tags);
  const w = prof.w;
  // 決定論的微差（±15%・熟語ごとに固有の指紋）
  const h = _wordHash(r.word || '');
  const wiggle = 0.85 + ((h % 31) / 31) * 0.30;
  const s = baseScale * wiggle;
  // 各効果に分配
  const effect = {
    expMul:         1 + s * (w.exp || 0) * 1.4,
    evoBoost:           s * (w.evo || 0) * 0.30,
    gravityMul:     w.grav ? Math.max(0.50, 1 - s * (w.grav || 0) * 0.18) : 1.0,
    mergeRadiusMul: 1 + s * (w.merge || 0) * 0.22,
    dropCountAdd:   Math.floor(s * (w.drop || 0) * 2.5),
    stockExpMul:    1 + s * (w.stock || 0) * 0.28,
    auto: true,
  };
  // 物語：プロファイル既定 → なければテンプレ
  if (prof.story) {
    effect.story = prof.story;
  } else {
    const t = STORY_DEFAULT_TEMPLATES[h % STORY_DEFAULT_TEMPLATES.length];
    effect.story = t.replace('{w}', r.word);
  }
  return effect;
}

let _autoComboInited = false;
function initAutoUniqueCombos() {
  if (_autoComboInited) return;
  const recipes = window.YOJI_RECIPES || [];
  if (recipes.length === 0) return;
  let count = 0;
  for (const r of recipes) {
    if (!r || !r.word) continue;
    if (UNIQUE_COMBO_EFFECTS[r.word]) continue;  // 手書き優先
    const eff = generateAutoUniqueEffect(r);
    if (eff) {
      UNIQUE_COMBO_EFFECTS[r.word] = eff;
      count++;
    }
  }
  _autoComboInited = true;
  try { console.log(`[v10n5] auto-unique combos generated: ${count} / total ${Object.keys(UNIQUE_COMBO_EFFECTS).length}`); } catch(_) {}
}

const COMBO_CLAMP = {
  expMulMax: 20.0,
  gravityMulMin: 0.30,
  mergeRadiusMulMax: 5.0,
  dropCountAddMax: 20,
  stockExpMulMax: 10.0,
  evoBoostMax: 2.0,
};
function clampCombo(acc) {
  acc.expMul         = Math.min(COMBO_CLAMP.expMulMax,         acc.expMul);
  acc.gravityMul     = Math.max(COMBO_CLAMP.gravityMulMin,     acc.gravityMul);
  acc.mergeRadiusMul = Math.min(COMBO_CLAMP.mergeRadiusMulMax, acc.mergeRadiusMul);
  acc.dropCountAdd   = Math.min(COMBO_CLAMP.dropCountAddMax,   acc.dropCountAdd);
  acc.stockExpMul    = Math.min(COMBO_CLAMP.stockExpMulMax,    acc.stockExpMul);
  acc.evoBoost       = Math.min(COMBO_CLAMP.evoBoostMax,       acc.evoBoost);
}

// タグ別の追加効果フック（コンボの「味」を出す）
function applyComboTagEffects(r, acc) {
  const tags = r.tags || [];
  const w = (acc._lastWeight || 1);  // レア×字数の重み
  for (const t of tags) {
    switch (t) {
      case '七徳':     acc.expMul       *= 1 + 0.10 * w; break;  // 徳：EXP特化
      case '七大罪':   acc.dropCountAdd += Math.floor(1 * w); break;  // 罪：粒数
      case '神字':     acc.evoBoost     += 0.05 * w; break;  // 神：進化加速
      case '禅':       acc.gravityMul   *= Math.max(0.4, 1 - 0.08 * w); break;  // 禅：時を緩める
      case '仏教':     acc.gravityMul   *= Math.max(0.5, 1 - 0.05 * w); break;
      case '武':       acc.megaBurstAdd = (acc.megaBurstAdd || 0) + 0.02 * w; break;
      case '思想':     acc.expMul       *= 1 + 0.08 * w; break;
      case '科学':     acc.stockExpMul  *= 1 + 0.08 * w; break;  // ストック EXP +
      case '美':       acc.mergeRadiusMul *= 1 + 0.05 * w; break;
      case '天体':     acc.expMul       *= 1 + 0.06 * w; break;
      case '未来':     acc.evoBoost     += 0.03 * w; break;
      case '昭和':     acc.expMul       *= 1 + 0.05 * w; break;
      case '令和':     acc.dropCountAdd += Math.floor(0.5 * w); break;
    }
  }
}

// v10n19: 季節判定（北半球・気象基準）
function currentSeasonAuto() {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5)  return 'spring';
  if (m >= 6 && m <= 8)  return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}
function applyTheme() {
  const pref = STATE.themePref || 'auto';
  let season = '';
  let theme = 'dark';
  if (pref === 'auto')        season = currentSeasonAuto();
  else if (pref === 'light')  theme  = 'light';
  else if (pref === 'dark')   theme  = 'dark';
  else                        season = pref;
  document.body.dataset.season = season || '';
  document.body.dataset.theme  = theme;
  document.body.dataset.ledge = STATE.ledgeStyle || 'default';
  document.body.dataset.tfont = STATE.tfontStyle || 'serif';
}
const THEME_LABELS = {
  auto:'自動（季節）', spring:'春', summer:'夏',
  autumn:'秋', winter:'冬', dark:'夜', light:'紙',
};
// v1.5.15: 土台バリエ ── 形状（穴配置）＋トレードオフ付き効果
function tierFullyDiscovered(tierIdx) {
  return tierSeenRatio(tierIdx) >= 1.0;
}
// holes: [{l:0.10, r:0.20}, ...] = 棚を切り抜いて穴を開ける（l/r は画面幅比率）
const LEDGE_VARIANTS = [
  // 標準：両端 12% 穴（バランス）
  { key:'default', name:'標準（水盤）',     cond:()=>true,
    eff:{}, holes:[{l:0,r:0.12},{l:0.88,r:1}] },
  // 石板：両端少し広め（10%）── 字が溜まりやすく、ストック型
  { key:'stone',   name:'石板',             cond:s=>_passiveCount.cycles(s)>=10,                                  hint:'10 サイクル達成で解放',
    eff:{stockExpMul:1.04, mergeRadiusMul:1.02}, holes:[{l:0,r:0.10},{l:0.90,r:1}] },
  // 木：標準＋融合
  { key:'wood',    name:'木（縞）',         cond:s=>tierFullyDiscovered(0),                                       hint:'★1 完全制覇で解放',
    eff:{mergeRadiusMul:1.04}, holes:[{l:0,r:0.12},{l:0.88,r:1}] },
  // 装飾：棚狭め（両端 16% 穴）→ EXP厚／字が早く落ちる
  { key:'ornate',  name:'装飾（金縁）',     cond:s=>tierFullyDiscovered(2) || _passiveCount.cycles(s)>=100,       hint:'★3 完全制覇 or 100 サイクル',
    eff:{expMul:1.05}, holes:[{l:0,r:0.16},{l:0.84,r:1}] },
  // 翡翠：両端広い棚（8%）＋融合進化
  { key:'jade',    name:'翡翠',             cond:s=>tierFullyDiscovered(4) || _passiveCount.uniq(s)>=500,         hint:'★5 完全制覇 or 500 字発見',
    eff:{evoBoost:0.04, mergeRadiusMul:1.03}, holes:[{l:0,r:0.08},{l:0.92,r:1}] },
  // 宇宙：両端 18% 穴・字が早く落ちる
  { key:'cosmos',  name:'宇宙（星屑）',     cond:s=>tierFullyDiscovered(8) || _passiveCount.streak(s)>=30,        hint:'★9 完全制覇 or 連続 30 日',
    eff:{expMul:1.06, dropCountAdd:1}, holes:[{l:0,r:0.18},{l:0.82,r:1}] },
  // 神域：超広い棚（両端 5%）＋全効果厚
  { key:'divine',  name:'神域（金光脈動）', cond:s=>tierFullyDiscovered(12) || _passiveCount.hero(s)>=300,        hint:'★13 完全制覇 or リーダー Lv.300',
    eff:{expMul:1.08, evoBoost:0.05, stockExpMul:1.05}, holes:[{l:0,r:0.05},{l:0.95,r:1}] },
  // 電光：3 穴（中央スリット）── 落下早×EXP+
  { key:'cyber',   name:'電光（ネオン脈動）', cond:s=>_passiveCount.uniq(s)>=2000 || tierFullyDiscovered(10),     hint:'2,000 字発見 or ★11 完全制覇',
    eff:{expMul:1.07, dropCountAdd:1}, holes:[{l:0,r:0.12},{l:0.46,r:0.54},{l:0.88,r:1}] },
  // 墨絵：超広棚＋重力緩
  { key:'ink',     name:'墨絵（静寂）',        cond:s=>_passiveCount.yoji(s)>=500,                                  hint:'熟語 500 解放',
    eff:{gravityMul:0.92, evoBoost:0.04, mergeRadiusMul:1.05}, holes:[{l:0,r:0.06},{l:0.94,r:1}] },
  // 穴あき：5 穴（高速 EXP・字積もらない・ストック減）
  { key:'holes',   name:'穴あき（高速）',     cond:s=>_passiveCount.cycles(s)>=200,                                hint:'200 サイクル達成で解放',
    eff:{expMul:1.10, stockExpMul:0.80}, holes:[{l:0,r:0.08},{l:0.25,r:0.31},{l:0.46,r:0.54},{l:0.69,r:0.75},{l:0.92,r:1}] },
  // v1.5.16: 傾斜土台 ── settled 字が常に右に転がる（右穴に落ちやすい）
  { key:'tilt_right', name:'傾斜（右流れ）',    cond:s=>_passiveCount.streak(s)>=14,                                  hint:'連続 14 日達成で解放',
    eff:{dropCountAdd:1, mergeRadiusMul:1.03}, holes:[{l:0,r:0.10},{l:0.88,r:1}], tiltVx:0.25 },
  // 傾斜（左流れ）── 同様だが左
  { key:'tilt_left',  name:'傾斜（左流れ）',    cond:s=>_passiveCount.streak(s)>=14,                                  hint:'連続 14 日達成で解放',
    eff:{dropCountAdd:1, mergeRadiusMul:1.03}, holes:[{l:0,r:0.10},{l:0.88,r:1}], tiltVx:-0.25 },
];
function ledgeTiltVx() {
  const cur = STATE.ledgeStyle || 'default';
  const v = LEDGE_VARIANTS.find(x => x.key === cur);
  return v?.tiltVx || 0;
}
function ledgeHoles(W) {
  const cur = STATE.ledgeStyle || 'default';
  const v = LEDGE_VARIANTS.find(x => x.key === cur);
  const config = v?.holes || [{l:0,r:0.12},{l:0.88,r:1}];
  return config.map(h => ({ left: W * h.l, right: W * h.r }));
}
function isOverHole(cx, W) {
  for (const h of ledgeHoles(W)) {
    if (cx >= h.left && cx <= h.right) return true;
  }
  return false;
}
function getActiveLedgeBonus() {
  const cur = STATE.ledgeStyle || 'default';
  const v = LEDGE_VARIANTS.find(x => x.key === cur);
  return v?.eff || {};
}
const TFONT_VARIANTS = [
  { key:'serif', name:'明朝', cond:()=>true },
  { key:'mono',  name:'機械', cond:s=>_passiveCount.cycles(s)>=20,  hint:'20 サイクル' },
  { key:'brush', name:'草書', cond:s=>_passiveCount.cycles(s)>=80,  hint:'80 サイクル' },
];
function openThemePicker() {
  let modal = $('#theme-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'theme-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'380px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, '🎨 テーマ'),
          el('button', { class:'modal-close', onclick: () => modal.classList.remove('show') }, '×'),
        ),
        el('div', { id:'theme-list', style:{ padding:'12px 16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' } }),
      ),
    );
    document.body.appendChild(modal);
  }
  const list = $('#theme-list');
  list.innerHTML = '';
  // テーマ
  list.appendChild(el('div', { style:{ gridColumn:'1 / -1', fontSize:'.7rem', color:'var(--ink-mute)', padding:'4px 4px 0' } }, '彩'));
  Object.entries(THEME_LABELS).forEach(([key, lbl]) => {
    const active = (STATE.themePref || 'auto') === key;
    list.appendChild(el('button', {
      style:{
        padding:'10px 8px', minHeight:'48px',
        background: active ? 'linear-gradient(135deg, rgba(240,212,138,.25), rgba(240,212,138,.08))' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.12)'),
        borderRadius:'8px',
        color: active ? '#ffe9a0' : 'var(--ink)',
        fontWeight: active ? 700 : 400, cursor:'pointer',
      },
      onclick: () => {
        STATE.themePref = key; saveState(); applyTheme(); openThemePicker();
        toast(`彩 ${lbl}`);
      },
    }, lbl));
  });
  // 土台
  list.appendChild(el('div', { style:{ gridColumn:'1 / -1', fontSize:'.7rem', color:'var(--ink-mute)', padding:'12px 4px 0' } }, '土台（実績解放）'));
  LEDGE_VARIANTS.forEach(v => {
    const active = (STATE.ledgeStyle || 'default') === v.key;
    const unlocked = (() => { try { return v.cond(STATE); } catch(_) { return false; } })();
    const label = unlocked ? v.name : '鍵 ' + (v.hint || v.name);
    list.appendChild(el('button', {
      disabled: !unlocked,
      style:{
        padding:'10px 8px', minHeight:'48px',
        background: active ? 'linear-gradient(135deg, rgba(135,206,235,.25), rgba(135,206,235,.08))' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(135,206,235,.6)' : 'rgba(255,255,255,.12)'),
        borderRadius:'8px',
        color: !unlocked ? 'var(--ink-mute)' : (active ? '#cfe6ff' : 'var(--ink)'),
        fontWeight: active ? 700 : 400,
        cursor: unlocked ? 'pointer' : 'not-allowed',
        opacity: unlocked ? 1 : .55,
        fontSize: '.78rem',
      },
      onclick: () => {
        if (!unlocked) { toast(v.hint || '未解放'); return; }
        STATE.ledgeStyle = v.key; saveState(); applyTheme(); openThemePicker();
        toast(`土台 ${v.name}`);
      },
    }, label));
  });
  // タイマー書体
  list.appendChild(el('div', { style:{ gridColumn:'1 / -1', fontSize:'.7rem', color:'var(--ink-mute)', padding:'12px 4px 0' } }, '時計書体'));
  TFONT_VARIANTS.forEach(v => {
    const active = (STATE.tfontStyle || 'serif') === v.key;
    const unlocked = (() => { try { return v.cond(STATE); } catch(_) { return false; } })();
    const label = unlocked ? v.name : '鍵 ' + (v.hint || v.name);
    list.appendChild(el('button', {
      disabled: !unlocked,
      style:{
        padding:'10px 8px', minHeight:'48px',
        background: active ? 'linear-gradient(135deg, rgba(192,168,255,.25), rgba(192,168,255,.08))' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(192,168,255,.6)' : 'rgba(255,255,255,.12)'),
        borderRadius:'8px',
        color: !unlocked ? 'var(--ink-mute)' : (active ? '#e8d8ff' : 'var(--ink)'),
        fontWeight: active ? 700 : 400,
        cursor: unlocked ? 'pointer' : 'not-allowed',
        opacity: unlocked ? 1 : .55,
        fontSize: '.78rem',
      },
      onclick: () => {
        if (!unlocked) { toast(v.hint || '未解放'); return; }
        STATE.tfontStyle = v.key; saveState(); applyTheme(); openThemePicker();
        toast(`書体 ${v.name}`);
      },
    }, label));
  });
  // v1.5.50: アイコンモード（絵文字 ／ 漢字）
  list.appendChild(el('div', { style:{ gridColumn:'1 / -1', fontSize:'.7rem', color:'var(--ink-mute)', padding:'12px 4px 0' } }, 'メニューアイコン'));
  ['emoji','kanji'].forEach(key => {
    const active = (STATE.iconMode || 'emoji') === key;
    const label = key === 'emoji' ? '🎨 絵文字' : '漢 漢字';
    list.appendChild(el('button', {
      style:{
        padding:'10px 8px', minHeight:'48px',
        background: active ? 'linear-gradient(135deg, rgba(240,212,138,.25), rgba(240,212,138,.08))' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.12)'),
        borderRadius:'8px',
        color: active ? '#ffe9a0' : 'var(--ink)',
        fontWeight: active ? 700 : 400, cursor:'pointer',
      },
      onclick: () => {
        STATE.iconMode = key; saveState(); applyIconMode(); openThemePicker();
        toast(`アイコン ${key === 'emoji' ? '絵文字' : '漢字'}`);
      },
    }, label));
  });
  modal.classList.add('show');
}

// v1.5.50: メニューアイコンの絵文字／漢字切替
const ICON_MAP_KANJI = {
  'm-stats':'録','m-codex':'鑑','m-writings':'書','m-theme':'彩','m-help':'問','m-data':'蓄',
  'm-measure':'計','m-pip':'窓','m-hud':'視','m-sleep':'眠',
};
const ICON_MAP_EMOJI = {
  'm-stats':'📊','m-codex':'📖','m-writings':'📝','m-theme':'🎨','m-help':'❓','m-data':'💾',
  'm-measure':'⏱️','m-pip':'🪟','m-hud':'👁️','m-sleep':'💤',
};
function applyIconMode() {
  const mode = STATE.iconMode || 'emoji';
  const map = mode === 'kanji' ? ICON_MAP_KANJI : ICON_MAP_EMOJI;
  for (const [id, ic] of Object.entries(map)) {
    const span = document.querySelector(`#${id} .mi-emoji`);
    if (span && span.id !== 'm-audio-emoji') span.textContent = ic;
  }
  // 音響は別途（状態連動）
  const audioSpan = $('#m-audio-emoji');
  if (audioSpan) {
    audioSpan.textContent = mode === 'kanji'
      ? (STATE.audioOn ? '音' : '無')
      : (STATE.audioOn ? '🔊' : '🔇');
  }
}

// v10n19: コンボタグから一時 aura クラスを body に
const COMBO_AURA_TAGS = {
  '自然':'nature', '植物':'nature', '動物':'nature', '花':'nature',
  '武':'fire', '火':'fire', '七大罪':'fire', '戦':'fire',
  '水':'water', '雨':'water', '海':'water', '川':'water',
  '禅':'zen', '仏教':'zen', '神字':'zen', '瞑想':'zen',
};
function flashComboAura(r) {
  if (!r || !r.tags) return;
  for (const t of r.tags) {
    const cls = COMBO_AURA_TAGS[t];
    if (cls) {
      const full = 'combo-aura-' + cls;
      document.body.classList.add(full);
      setTimeout(() => document.body.classList.remove(full), 3000);
      return;  // 1 つだけ
    }
  }
}

// v10n13: パッシブ ── 常時発動（弱いが累積する）
// パーティ編成と独立、コレクション／継続マイルストーン由来
const _passiveCount = {
  uniq:    s => Object.keys(s.collection || {}).length,
  yoji:    s => Object.keys(s.discoveredYoji || {}).length,
  cycles:  s => s.stats?.totalCycles || 0,
  streak:  s => s.streak?.longest || 0,
  hero:    s => s.party?.members?.[s.party?.hero||0]?.level || 0,
};
function _countCharsByTag(state, tag) {
  let n = 0;
  for (const c of Object.keys(state.collection || {})) {
    const tags = getCharTags ? getCharTags(c) : [];
    if (tags.includes(tag)) n++;
  }
  return n;
}
const PASSIVES = [
  // 発見数系（コレクション）
  { id:'p_uniq_10',    name:'初学の灯',    desc:'10 字発見：EXP +1%',         icon:'書', cond:s=>_passiveCount.uniq(s)>=10,    eff:{expMul:1.01} },
  { id:'p_uniq_100',   name:'学識',         desc:'100 字発見：EXP +3%',        icon:'冊', cond:s=>_passiveCount.uniq(s)>=100,   eff:{expMul:1.03} },
  { id:'p_uniq_1000',  name:'博識',         desc:'1,000 字発見：EXP +6% / 融合範囲 +3%', icon:'書', cond:s=>_passiveCount.uniq(s)>=1000,  eff:{expMul:1.06, mergeRadiusMul:1.03} },
  { id:'p_uniq_10000', name:'万巻の主',     desc:'10,000 字発見：EXP +12% / ストック +5%', icon:'殿', cond:s=>_passiveCount.uniq(s)>=10000, eff:{expMul:1.12, stockExpMul:1.05} },
  // 熟語解放系
  { id:'p_yoji_100',   name:'語彙の門',     desc:'熟語 100 解放：融合範囲 +5%', icon:'典', cond:s=>_passiveCount.yoji(s)>=100,   eff:{mergeRadiusMul:1.05} },
  { id:'p_yoji_1000',  name:'語学者',       desc:'熟語 1,000 解放：EXP +5% / 粒+1', icon:'巻', cond:s=>_passiveCount.yoji(s)>=1000,  eff:{expMul:1.05, dropCountAdd:1} },
  { id:'p_yoji_4000',  name:'達語',         desc:'熟語 4,000 解放：EXP +10% / 進化加速 +5%', icon:'筆', cond:s=>_passiveCount.yoji(s)>=4000, eff:{expMul:1.10, evoBoost:0.05} },
  // 累計サイクル
  { id:'p_cycle_10',   name:'始まりの拍',   desc:'10 サイクル：ストック +2%',  icon:'刻', cond:s=>_passiveCount.cycles(s)>=10,  eff:{stockExpMul:1.02} },
  { id:'p_cycle_100',  name:'継続の力',     desc:'100 サイクル：ストック +5% / 重力 -2%', icon:'芽', cond:s=>_passiveCount.cycles(s)>=100, eff:{stockExpMul:1.05, gravityMul:0.98} },
  { id:'p_cycle_1000', name:'熟達',         desc:'1,000 サイクル：EXP +8% / 進化加速 +5%', icon:'樹', cond:s=>_passiveCount.cycles(s)>=1000, eff:{expMul:1.08, evoBoost:0.05} },
  // 連続日数
  { id:'p_streak_7',   name:'一週間の習慣', desc:'連続 7 日：EXP +2%',          icon:'炎', cond:s=>_passiveCount.streak(s)>=7,   eff:{expMul:1.02} },
  { id:'p_streak_30',  name:'一か月の継続', desc:'連続 30 日：EXP +5% / 重力 -3%', icon:'炎', cond:s=>_passiveCount.streak(s)>=30,  eff:{expMul:1.05, gravityMul:0.97} },
  { id:'p_streak_100', name:'百日の坐',     desc:'連続 100 日：全効果 +5% 相当', icon:'峰', cond:s=>_passiveCount.streak(s)>=100, eff:{expMul:1.05, stockExpMul:1.05, mergeRadiusMul:1.05} },
  // タグ収集
  { id:'p_seven_virt', name:'七徳の祝福',   desc:'七徳タグ 7 種：進化加速 +5%', icon:'徳',  cond:s=>_countCharsByTag(s,'七徳')>=7, eff:{evoBoost:0.05} },
  { id:'p_seven_sin',  name:'七大罪の連動', desc:'七大罪タグ 7 種：粒 +1 / 重力 -3%', icon:'罪', cond:s=>_countCharsByTag(s,'七大罪')>=7, eff:{dropCountAdd:1, gravityMul:0.97} },
  // リーダー Lv（自パーティ依存だが恒久的）
  { id:'p_hero_100',   name:'楷書師の杖',   desc:'リーダー Lv.100：ストック +3%', icon:'墨', cond:s=>_passiveCount.hero(s)>=100, eff:{stockExpMul:1.03} },
  // v1.3.13: タグ収集パッシブ（10 種）── 文字種の多様性を活かす
  { id:'p_tag_emo',     name:'感情の機微',   desc:'感情タグ 10 種発見：EXP +3%',            icon:'愛', cond:s=>_countCharsByTag(s,'感情')>=10, eff:{expMul:1.03} },
  { id:'p_tag_nature',  name:'自然の調和',   desc:'自然タグ 15 種発見：融合 +5%',          icon:'葉', cond:s=>_countCharsByTag(s,'自然')>=15, eff:{mergeRadiusMul:1.05} },
  { id:'p_tag_zen',     name:'禅の境地',     desc:'禅タグ 5 種発見：重力 -5%',              icon:'禅', cond:s=>_countCharsByTag(s,'禅')>=5, eff:{gravityMul:0.95} },
  { id:'p_tag_butsu',   name:'仏の教え',     desc:'仏教タグ 8 種発見：進化 +5%',            icon:'蓮', cond:s=>_countCharsByTag(s,'仏教')>=8, eff:{evoBoost:0.05} },
  { id:'p_tag_bu',      name:'武の心',       desc:'武タグ 5 種発見：粒 +1',                  icon:'刀', cond:s=>_countCharsByTag(s,'武')>=5, eff:{dropCountAdd:1} },
  { id:'p_tag_kami',    name:'神域の門',     desc:'神字タグ 3 種発見：EXP +5% / 進化 +3%',  icon:'神', cond:s=>_countCharsByTag(s,'神字')>=3, eff:{expMul:1.05, evoBoost:0.03} },
  { id:'p_tag_thought', name:'思想の系譜',   desc:'思想タグ 10 種発見：EXP +5%',            icon:'巻', cond:s=>_countCharsByTag(s,'思想')>=10, eff:{expMul:1.05} },
  { id:'p_tag_tian',    name:'天体の運行',   desc:'天体タグ 8 種発見：ストック +5%',        icon:'星', cond:s=>_countCharsByTag(s,'天体')>=8, eff:{stockExpMul:1.05} },
  { id:'p_tag_kanji',   name:'漢字千',       desc:'漢字 1,000 字発見：EXP +5% / 融合 +3%',  icon:'漢', cond:s=>{let n=0;for(const c of Object.keys(s.collection||{}))if((typeof getCharTags==='function'?getCharTags(c):[]).includes('漢字')||/[一-鿿]/.test(c))n++;return n>=1000;}, eff:{expMul:1.05, mergeRadiusMul:1.03} },
  { id:'p_tag_world',   name:'世界の文字',   desc:'非日本字 100 種発見：EXP +5%',           icon:'界', cond:s=>{let n=0;for(const c of Object.keys(s.collection||{}))if(!/[぀-ゟ゠-ヿ一-鿿]/.test(c))n++;return n>=100;}, eff:{expMul:1.05} },
  // v1.3.13: 字固有パッシブ（10 種）── 象徴的な字をパーティに持つと発動
  { id:'p_char_heart', name:'心の灯',     desc:'「心」をパーティに：EXP +3%',           icon:'心', cond:s=>s.party?.members?.some(m=>m.char==='心'), eff:{expMul:1.03} },
  { id:'p_char_power', name:'力の柱',     desc:'「力」をパーティに：粒 +1',             icon:'拳', cond:s=>s.party?.members?.some(m=>m.char==='力'), eff:{dropCountAdd:1} },
  { id:'p_char_light', name:'光の道',     desc:'「光」をパーティに：進化 +3%',          icon:'光', cond:s=>s.party?.members?.some(m=>m.char==='光'), eff:{evoBoost:0.03} },
  { id:'p_char_water', name:'水の流',     desc:'「水」をパーティに：重力 -3%',          icon:'滴', cond:s=>s.party?.members?.some(m=>m.char==='水'), eff:{gravityMul:0.97} },
  { id:'p_char_tree',  name:'木の根',     desc:'「木」をパーティに：ストック +3%',      icon:'森', cond:s=>s.party?.members?.some(m=>m.char==='木'), eff:{stockExpMul:1.03} },
  { id:'p_char_fire',  name:'火の勢',     desc:'「火」をパーティに：粒 +1 / EXP +2%',  icon:'炎', cond:s=>s.party?.members?.some(m=>m.char==='火'), eff:{dropCountAdd:1, expMul:1.02} },
  { id:'p_char_kami',  name:'神の名',     desc:'「神」をパーティに：EXP +5%',           icon:'神', cond:s=>s.party?.members?.some(m=>m.char==='神'), eff:{expMul:1.05} },
  { id:'p_char_dou',   name:'道の心',     desc:'「道」をパーティに：進化 +3% / 融合 +2%', icon:'道', cond:s=>s.party?.members?.some(m=>m.char==='道'), eff:{evoBoost:0.03, mergeRadiusMul:1.02} },
  { id:'p_char_kotoba',name:'言の力',     desc:'「言」をパーティに：ストック +5%',      icon:'語', cond:s=>s.party?.members?.some(m=>m.char==='言'), eff:{stockExpMul:1.05} },
  { id:'p_char_yume',  name:'夢の彼方',   desc:'「夢」をパーティに：EXP +3% / 進化 +2%', icon:'夢', cond:s=>s.party?.members?.some(m=>m.char==='夢'), eff:{expMul:1.03, evoBoost:0.02} },
  // v1.3.14: 新次元パッシブ（差別化）
  // critChance: タップ字に確率で EXP ×3 ／ chainBonus: 連続合体ボーナス ／ lifetimeMul: 字寿命
  { id:'p_crit_basic',  name:'閃き',         desc:'タップで 5% 確率 EXP ×3',           icon:'閃', cond:s=>_passiveCount.cycles(s)>=50,   eff:{critChance:0.05} },
  { id:'p_crit_master', name:'達観',         desc:'タップで 12% 確率 EXP ×3（200サイクル）', icon:'渦', cond:s=>_passiveCount.cycles(s)>=200, eff:{critChance:0.07} },
  { id:'p_chain_a',     name:'数珠つなぎ',    desc:'同字 3 連続合体で全効果 +5%（一時的）', icon:'珠', cond:s=>_passiveCount.uniq(s)>=200, eff:{chainBonus:0.05} },
  { id:'p_chain_b',     name:'紡ぎの極',     desc:'連鎖ボーナス +10%（1000字発見）',     icon:'糸', cond:s=>_passiveCount.uniq(s)>=1000, eff:{chainBonus:0.10} },
  { id:'p_life_1',      name:'残響',         desc:'字寿命 +20%（5分→6分）',             icon:'時', cond:s=>_passiveCount.yoji(s)>=200, eff:{lifetimeMul:1.20} },
  { id:'p_life_2',      name:'長息',         desc:'字寿命 +50%（7.5分・継続30日）',    icon:'筆', cond:s=>_passiveCount.streak(s)>=30, eff:{lifetimeMul:1.50} },
  { id:'p_rare_focus',  name:'高貴の眼',     desc:'★10 以上字の EXP +25%（4000熟語）',  icon:'眼', cond:s=>_passiveCount.yoji(s)>=4000, eff:{highRarityExpMul:1.25} },
  { id:'p_low_love',    name:'初心忘れず',   desc:'★1-3 字の EXP +50%（ひらがな愛）',  icon:'芽', cond:s=>_passiveCount.uniq(s)>=50, eff:{lowRarityExpMul:1.50} },
  { id:'p_cycle_burst', name:'完成の火花',    desc:'サイクル完了時 ボーナス字 +3',       icon:'華', cond:s=>_passiveCount.cycles(s)>=100, eff:{cycleBonusDrop:3} },
  { id:'p_speed_focus', name:'速読',         desc:'連続日数 7+：字降下速度 +20%（密度UP）', icon:'風', cond:s=>_passiveCount.streak(s)>=7, eff:{spawnRateMul:1.20} },
];

// v1.3.12: 環境ボーナス ── 季節・月・曜日・週など「時間」由来（プレイ実績じゃなく文脈）
const ENV_BONUSES = [
  // 季節（3-5/6-8/9-11/12-2）
  { id:'e_season_spring', name:'春の祝福', desc:'3-5 月：融合 +4% / EXP +2%', icon:'桜', cond:()=>{const m=new Date().getMonth()+1;return m>=3&&m<=5;}, eff:{mergeRadiusMul:1.04, expMul:1.02} },
  { id:'e_season_summer', name:'夏の活力', desc:'6-8 月：粒+1 / EXP +3%',     icon:'波', cond:()=>{const m=new Date().getMonth()+1;return m>=6&&m<=8;}, eff:{dropCountAdd:1, expMul:1.03} },
  { id:'e_season_autumn', name:'秋の収穫', desc:'9-11 月：ストック +5% / 進化 +3%', icon:'紅', cond:()=>{const m=new Date().getMonth()+1;return m>=9&&m<=11;}, eff:{stockExpMul:1.05, evoBoost:0.03} },
  { id:'e_season_winter', name:'冬の沈潜', desc:'12-2 月：重力 -5% / 進化 +4%', icon:'雪', cond:()=>{const m=new Date().getMonth()+1;return m===12||m<=2;}, eff:{gravityMul:0.95, evoBoost:0.04} },
  // 月別（和風月名・12 種）
  { id:'e_m_1',  name:'睦月 ・ 始の和', desc:'1 月：ストック +5%',                 icon:'松', cond:()=>new Date().getMonth()===0,  eff:{stockExpMul:1.05} },
  { id:'e_m_2',  name:'如月 ・ 残寒',    desc:'2 月：重力 -3%',                     icon:'雪', cond:()=>new Date().getMonth()===1,  eff:{gravityMul:0.97} },
  { id:'e_m_3',  name:'弥生 ・ 桜便り',  desc:'3 月：融合範囲 +5%',                 icon:'桜', cond:()=>new Date().getMonth()===2,  eff:{mergeRadiusMul:1.05} },
  { id:'e_m_4',  name:'卯月 ・ 始動',    desc:'4 月：EXP +5%',                       icon:'芽', cond:()=>new Date().getMonth()===3,  eff:{expMul:1.05} },
  { id:'e_m_5',  name:'皐月 ・ 風薫',    desc:'5 月：粒 +1',                         icon:'幟', cond:()=>new Date().getMonth()===4,  eff:{dropCountAdd:1} },
  { id:'e_m_6',  name:'水無月 ・ 雨季',  desc:'6 月：重力 -5% / 融合 +3%',          icon:'雨', cond:()=>new Date().getMonth()===5,  eff:{gravityMul:0.95, mergeRadiusMul:1.03} },
  { id:'e_m_7',  name:'文月 ・ 七夕',    desc:'7 月：EXP +5% / 進化 +3%',           icon:'笹', cond:()=>new Date().getMonth()===6,  eff:{expMul:1.05, evoBoost:0.03} },
  { id:'e_m_8',  name:'葉月 ・ 盛夏',    desc:'8 月：粒 +2',                         icon:'葵', cond:()=>new Date().getMonth()===7,  eff:{dropCountAdd:2} },
  { id:'e_m_9',  name:'長月 ・ 月見',    desc:'9 月：進化 +5%',                     icon:'満', cond:()=>new Date().getMonth()===8,  eff:{evoBoost:0.05} },
  { id:'e_m_10', name:'神無月 ・ 紅葉',  desc:'10 月：ストック +8%',                icon:'落', cond:()=>new Date().getMonth()===9,  eff:{stockExpMul:1.08} },
  { id:'e_m_11', name:'霜月 ・ 静寂',    desc:'11 月：重力 -4% / ストック +3%',     icon:'雲', cond:()=>new Date().getMonth()===10, eff:{gravityMul:0.96, stockExpMul:1.03} },
  { id:'e_m_12', name:'師走 ・ 結びの月', desc:'12 月：EXP +8%',                     icon:'冬', cond:()=>new Date().getMonth()===11, eff:{expMul:1.08} },
  // 曜日（7 種）
  { id:'e_d_mon', name:'月曜 ・ 始動',   desc:'月曜：EXP +2%',            icon:'夜', cond:()=>new Date().getDay()===1, eff:{expMul:1.02} },
  { id:'e_d_tue', name:'火曜 ・ 燃焼',   desc:'火曜：粒 +1',              icon:'炎', cond:()=>new Date().getDay()===2, eff:{dropCountAdd:1} },
  { id:'e_d_wed', name:'水曜 ・ 流',     desc:'水曜：重力 -2%',           icon:'滴', cond:()=>new Date().getDay()===3, eff:{gravityMul:0.98} },
  { id:'e_d_thu', name:'木曜 ・ 育',     desc:'木曜：進化 +2%',           icon:'樹', cond:()=>new Date().getDay()===4, eff:{evoBoost:0.02} },
  { id:'e_d_fri', name:'金曜 ・ 結',     desc:'金曜：融合 +3%',           icon:'結', cond:()=>new Date().getDay()===5, eff:{mergeRadiusMul:1.03} },
  { id:'e_d_sat', name:'土曜 ・ 蓄',     desc:'土曜：ストック +3%',       icon:'山', cond:()=>new Date().getDay()===6, eff:{stockExpMul:1.03} },
  { id:'e_d_sun', name:'日曜 ・ 静',     desc:'日曜：重力 -3% / EXP +2%', icon:'陽', cond:()=>new Date().getDay()===0, eff:{gravityMul:0.97, expMul:1.02} },
  // 時間帯（6 種）── 朝活・午前・昼・午後・夜・深夜
  { id:'e_t_morning', name:'朝活 ・ 始の風', desc:'5-9 時：EXP +8% / 進化 +3%（朝活ボーナス）', icon:'朝', cond:()=>{const h=new Date().getHours();return h>=5&&h<9;}, eff:{expMul:1.08, evoBoost:0.03} },
  { id:'e_t_am',      name:'午前 ・ 集中',   desc:'9-12 時：EXP +5% / 融合 +2%',                icon:'陽', cond:()=>{const h=new Date().getHours();return h>=9&&h<12;}, eff:{expMul:1.05, mergeRadiusMul:1.02} },
  { id:'e_t_noon',    name:'昼 ・ 休息',     desc:'12-14 時：重力 -3% / ストック +3%',          icon:'昼', cond:()=>{const h=new Date().getHours();return h>=12&&h<14;}, eff:{gravityMul:0.97, stockExpMul:1.03} },
  { id:'e_t_pm',      name:'午後 ・ 持続',   desc:'14-17 時：ストック +5%',                     icon:'晴', cond:()=>{const h=new Date().getHours();return h>=14&&h<17;}, eff:{stockExpMul:1.05} },
  { id:'e_t_evening', name:'夕 ・ 結び',     desc:'17-19 時：融合 +5% / EXP +2%',                icon:'夕', cond:()=>{const h=new Date().getHours();return h>=17&&h<19;}, eff:{mergeRadiusMul:1.05, expMul:1.02} },
  { id:'e_t_night',   name:'夜 ・ 深耕',     desc:'19-22 時：EXP +5% / 進化 +2%',                icon:'夜', cond:()=>{const h=new Date().getHours();return h>=19&&h<22;}, eff:{expMul:1.05, evoBoost:0.02} },
  { id:'e_t_late',    name:'深夜 ・ 静寂',   desc:'22-5 時：重力 -5% / 進化 +4%（深夜の創造）', icon:'宙', cond:()=>{const h=new Date().getHours();return h>=22||h<5;}, eff:{gravityMul:0.95, evoBoost:0.04} },
  // 週（月内 1-4 週）
  { id:'e_w_1', name:'第1週 ・ 開花',  desc:'月の 1 週目：EXP +3%',       icon:'花', cond:()=>Math.ceil(new Date().getDate()/7)===1, eff:{expMul:1.03} },
  { id:'e_w_2', name:'第2週 ・ 充実',  desc:'月の 2 週目：ストック +3%',  icon:'樹', cond:()=>Math.ceil(new Date().getDate()/7)===2, eff:{stockExpMul:1.03} },
  { id:'e_w_3', name:'第3週 ・ 結実',  desc:'月の 3 週目：進化 +3%',      icon:'実', cond:()=>Math.ceil(new Date().getDate()/7)===3, eff:{evoBoost:0.03} },
  { id:'e_w_4', name:'第4週 ・ 還元',  desc:'月の 4-5 週目：全効果 +1%',  icon:'葉', cond:()=>Math.ceil(new Date().getDate()/7)>=4, eff:{expMul:1.01, stockExpMul:1.01, mergeRadiusMul:1.01} },
];
function getActiveEnvBonuses() {
  return ENV_BONUSES.filter(b => { try { return b.cond(STATE); } catch(_) { return false; } });
}
function computeEnvBonus() {
  const acc = { expMul:1.0, evoBoost:0, gravityMul:1.0, mergeRadiusMul:1.0, dropCountAdd:0, stockExpMul:1.0 };
  for (const b of getActiveEnvBonuses()) {
    const e = b.eff || {};
    if (e.expMul)         acc.expMul        *= e.expMul;
    if (e.evoBoost)       acc.evoBoost      += e.evoBoost;
    if (e.gravityMul)     acc.gravityMul    *= e.gravityMul;
    if (e.mergeRadiusMul) acc.mergeRadiusMul*= e.mergeRadiusMul;
    if (e.dropCountAdd)   acc.dropCountAdd  += e.dropCountAdd;
    if (e.stockExpMul)    acc.stockExpMul   *= e.stockExpMul;
  }
  return acc;
}

function getActivePassives() {
  return PASSIVES.filter(p => { try { return p.cond(STATE); } catch(_) { return false; } });
}
function computePassiveBonus() {
  const acc = { expMul:1.0, evoBoost:0, gravityMul:1.0, mergeRadiusMul:1.0, dropCountAdd:0, stockExpMul:1.0 };
  for (const p of getActivePassives()) {
    const e = p.eff || {};
    if (e.expMul)         acc.expMul        *= e.expMul;
    if (e.evoBoost)       acc.evoBoost      += e.evoBoost;
    if (e.gravityMul)     acc.gravityMul    *= e.gravityMul;
    if (e.mergeRadiusMul) acc.mergeRadiusMul*= e.mergeRadiusMul;
    if (e.dropCountAdd)   acc.dropCountAdd  += e.dropCountAdd;
    if (e.stockExpMul)    acc.stockExpMul   *= e.stockExpMul;
  }
  return acc;
}

// v1.1.3: 並び順がコンボの構成字と一致したらボーナス（×1.4）
function comboOrderMatch(r) {
  if (!STATE.party || !STATE.party.members || !r || !r.chars) return false;
  const partyStr = STATE.party.members.map(m => m.char).join('');
  const recipeStr = r.chars.join('');
  return partyStr.indexOf(recipeStr) >= 0;  // 連続部分一致
}

// コンボのボーナス倍率合計（レア × 字数 × 難易度 × リーダーLv × タグ／固有効果）
// v10n4: すべての熟語コンボに難易度＆Lvスケーリング・固有効果コンボ対応
function getComboBonus() {
  const combos = detectPartyCombos();
  const acc = {
    expMul: 1.0, evoBoost: 0,
    gravityMul: 1.0, mergeRadiusMul: 1.0,
    dropCountAdd: 0, stockExpMul: 1.0,
    megaBurstAdd: 0,
  };
  const lvMul = leaderLvMul();
  for (const r of combos) {
    // v1.1.3: 並び順一致なら ×1.4 ボーナス
    const orderMul = comboOrderMatch(r) ? 1.4 : 1.0;
    //  SPECIAL（アプリ名隠しコンボ）：固定値を加算（旧仕様維持・Lv補正のみ）
    if (r.special && r.effect) {
      const e = r.effect;
      if (e.expMul)         acc.expMul        *= e.expMul * lvMul * orderMul;
      if (e.evoBoost)       acc.evoBoost      += e.evoBoost * lvMul * orderMul;
      if (e.gravityMul)     acc.gravityMul    *= e.gravityMul;
      if (e.mergeRadiusMul) acc.mergeRadiusMul*= e.mergeRadiusMul;
      if (e.dropCountAdd)   acc.dropCountAdd  += e.dropCountAdd;
      if (e.stockExpMul)    acc.stockExpMul   *= e.stockExpMul * lvMul * orderMul;
      continue;
    }
    const unique = UNIQUE_COMBO_EFFECTS[r.word];
    if (unique) {
      const u = unique;
      if (u.expMul)         acc.expMul        *= u.expMul * lvMul * orderMul;
      if (u.evoBoost)       acc.evoBoost      += u.evoBoost * lvMul * orderMul;
      if (u.gravityMul)     acc.gravityMul    *= u.gravityMul;
      if (u.mergeRadiusMul) acc.mergeRadiusMul*= u.mergeRadiusMul;
      if (u.dropCountAdd)   acc.dropCountAdd  += u.dropCountAdd;
      if (u.stockExpMul)    acc.stockExpMul   *= u.stockExpMul * lvMul * orderMul;
      continue;
    }
    const n = r.chars.length;
    const rarMul = COMBO_RARITY_MUL[r.rarity] || 1.0;
    const difMul = comboDifficulty(r);
    let baseExp = 0;
    if (n === 2)      baseExp = 0.10;
    else if (n === 3) baseExp = 0.30;
    else if (n === 4) baseExp = 0.60;
    else              baseExp = 1.0;
    acc.expMul *= 1 + baseExp * rarMul * difMul * lvMul * orderMul;
    if (n === 4) acc.evoBoost += 0.10 * rarMul * lvMul * orderMul;
    if (n >= 5)  acc.evoBoost += 0.20 * rarMul * lvMul * orderMul;
    acc._lastWeight = (n / 2) * rarMul * difMul * lvMul * orderMul;
    applyComboTagEffects(r, acc);
  }
  delete acc._lastWeight;
  clampCombo(acc);
  return { combos, ...acc };
}

// パーティ Lv up / 編成変更時にチェック ── 初発動なら祝祭演出
let _comboPrev = new Set();
function checkComboPickup() {
  const combos = detectPartyCombos();
  const current = new Set(combos.map(r => r.word));
  // 新規発動した熟語
  for (const r of combos) {
    if (!_comboPrev.has(r.word)) {
      // 初発動 ── 熟語図鑑に永久解放（次から ??? が外れる）
      const wasNew = !STATE.discoveredYoji || !STATE.discoveredYoji[r.word];
      if (!STATE.discoveredYoji) STATE.discoveredYoji = {};
      STATE.discoveredYoji[r.word] = Date.now();
      if (wasNew) bumpDailyLog('newYoji', 1);
      saveState();
      spawnComboBurst(r);
      try { flashComboAura(r); } catch(_) {}
      // 全く初の解放（過去にも一度も発動経験なし）なら盛大なセレモニー
      if (wasNew && !r.special) {
        spawnYojiUnlockCelebration(r);
        // 読雨へ：熟語解放
        _publishYomuEvent('yoji_unlocked', {
          word: r.word,
          rarity: r.rarity,
          season: r.season,
          tags: r.tags || [],
          desc: r.desc || '',
          user_id: STATE.userId || null,
        });
      }
      if (r.special) {
        playSFX('unlock'); setTimeout(() => playSFX('milestone'), 250);
        toast(` 隠しコンボ発動「${r.word}」 ${r.desc || ''}`, r.rarity);
      } else {
        playSFX(r.chars.length >= 4 ? 'milestone' : 'merge');
        if (wasNew) { setTimeout(() => playSFX('unlock'), 200); setTimeout(() => playSFX('discover'), 600); }
        toast(`${wasNew ? '新熟語解放' : 'コンボ発動'}「${r.word}」 ${r.desc || ''}`, r.rarity);
      }
    }
  }
  _comboPrev = current;
}

// 熟語初解放：構成字 → 「？？？」マスク剥がし → 熟語表示 → desc の流れ
function spawnYojiUnlockCelebration(recipe) {
  $$('.yoji-unlock-celebration').forEach(n => n.remove());
  const rIdx = RARITY_TIERS.indexOf(recipe.rarity);
  const chars = recipe.chars || [];
  // 構成字を順に並べる → arrow → 熟語 → desc
  const charRow = el('div', { class:'yuc-chars' },
    ...chars.flatMap((c, i) => i > 0
      ? [el('span', { class:'yuc-plus' }, '＋'), el('span', { class:'yuc-char' }, c)]
      : [el('span', { class:'yuc-char' }, c)]
    )
  );
  const overlay = el('div', { class:`yoji-unlock-celebration rarity-${rIdx + 1}` },
    el('div', { class:'yuc-label' }, '新しい熟語を解放'),
    charRow,
    el('div', { class:'yuc-arrow' }, '↓'),
    el('div', { class:'yuc-mask' }, '？'.repeat(Math.max(2, recipe.word.length))),
    el('div', { class:'yuc-word', style:{ cursor:'pointer' }, onclick:() => showYojiDetail(recipe) }, recipe.word),
    recipe.desc ? el('div', { class:'yuc-desc' }, recipe.desc) : null,
    el('div', { class:'yuc-rarity' }, recipe.rarity),
  );
  document.body.appendChild(overlay);
  overlay.addEventListener('click', () => overlay.remove(), { once:true });
  setTimeout(() => overlay.remove(), 4200);
}

// コンボ発動演出（画面中央バースト）
function spawnComboBurst(recipe) {
  // v1.0.7: body 直下に最前面で出す（play-field の z-index に埋もれない）
  const W = window.innerWidth, H = window.innerHeight;
  const rIdx = RARITY_TIERS.indexOf(recipe.rarity);
  const isSpecial = !!recipe.special;
  const width = isSpecial ? 360 : 300;
  // 効果の簡易サマリ（一目で何が起きたか分かる）
  const cb = (typeof previewComboEffect === 'function') ? previewComboEffect(recipe) : null;
  const lines = [];
  if (cb) {
    // v1.1.4: % 表記
    if (cb.expMul > 1.01)         lines.push(`📈 EXP +${Math.round((cb.expMul-1)*100)}%`);
    if (cb.gravityMul < 0.99)     lines.push(`重力 -${Math.round((1-cb.gravityMul)*100)}%`);
    if (cb.mergeRadiusMul > 1.01) lines.push(` 融合 +${Math.round((cb.mergeRadiusMul-1)*100)}%`);
    if (cb.dropCountAdd)          lines.push(`粒 +${cb.dropCountAdd}個`);
    if (cb.stockExpMul > 1.01)    lines.push(`📦 ストック +${Math.round((cb.stockExpMul-1)*100)}%`);
    if (cb.evoBoost > 0.005)      lines.push(` 進化 +${Math.round(cb.evoBoost*100)}%`);
  }
  const effLine = lines.length ? lines.join(' ・ ') : '';
  const node = el('div', {
    class: `combo-burst rarity-${rIdx + 1}${isSpecial ? ' combo-special' : ''}`,
    style: { left: (W/2 - width/2) + 'px', top: (H/2 - (isSpecial ? 110 : 80)) + 'px', cursor:'pointer' },
    onclick: () => { try { showYojiDetail(recipe); } catch(_){} node.remove(); },
  },
    el('div', { class:'cb-label' }, isSpecial ? '隠しコンボ発動' : 'コンボ発動'),
    el('div', { class:'cb-word' }, recipe.word),
    recipe.desc ? el('div', { class:'cb-desc' }, recipe.desc) : null,
    effLine ? el('div', { class:'cb-eff' }, effLine) : null,
    el('div', { class:'cb-hint', style:{ fontSize:'.6rem', opacity:.55, marginTop:'4px' } }, 'タップで詳細'),
  );
  document.body.appendChild(node);
  setTimeout(() => node.remove(), isSpecial ? 3000 : 2400);
}

// リーダー（主人公）の Lv ── 落下プール tier の判定基準（v3 / 2026-05-16）
function partyHeroLevel() {
  if (!STATE.party || !STATE.party.members.length) return 0;
  const heroIdx = STATE.party.hero || 0;
  const hero = STATE.party.members[heroIdx];
  return hero ? hero.level : 0;
}

// v1.5.2: 字発見率ベースで段階解放（リーダー Lv 自動解放を廃止）
// tier N の字を 80% 以上発見したら tier N+1 解放
function tierSeenRatio(tierIdx) {
  const codex = window.KANJI_CODEX || [];
  const tier = RARITY_TIERS[tierIdx];
  const chars = codex.filter(k => k.rarity === tier);
  if (chars.length === 0) return 0;
  const seen = chars.filter(k => (STATE.collection?.[k.char || k.c] || 0) > 0).length;
  return seen / chars.length;
}
function currentDropTier() {
  // 段階解放：tier 0 は常に開放。以後、前 tier が 80% 以上発見されたら次を解放
  let band = 0;
  for (let i = 1; i < RARITY_TIERS.length; i++) {
    if (tierSeenRatio(i - 1) >= 0.8) band = i;
    else break;
  }
  return band;
}

function updateUnlockTier() {
  const newTier = currentDropTier();
  const oldTier = STATE.unlockedTier;
  STATE.unlockedTier = newTier;
  // Band-up: 全画面解放セレモニー（??? → ★N の盛大な発表）
  if (newTier > oldTier) {
    setTimeout(() => {
      spawnTierUnlockCelebration(newTier);
      playSFX('unlock');
      setTimeout(() => playSFX('milestone'), 400);
      setTimeout(() => playSFX('discover'), 800);
    }, 400);
    // 図鑑が開いていれば masks を更新（リアルタイム反映）
    if ($('#codex-modal')?.classList.contains('show')) {
      setTimeout(() => { applyCodexLegendMask(); applyCodexTabMask(); renderCodex(); }, 2500);
    }
    // 読雨へ：ティア解放イベント
    _publishYomuEvent('tier_unlocked', {
      tier: RARITY_TIERS[newTier],
      tier_idx: newTier,
      achievement: TIER_ACHIEVEMENT[newTier],
      hero_lv: partyHeroLevel(),
      user_id: STATE.userId || null,
    });
  }
}

// 新ティア解放：全画面セレモニー（最大3.2秒）
function spawnTierUnlockCelebration(tierIdx) {
  const tierName = RARITY_TIERS[tierIdx];
  const achName  = TIER_ACHIEVEMENT[tierIdx];
  // 既存があれば消す
  $$('.tier-unlock-celebration').forEach(n => n.remove());
  // 背景密度も更新（高ティアで雨が濃くなる）
  refreshBackgroundDensity();
  const overlay = el('div', { class:`tier-unlock-celebration tier-${tierIdx + 1}` },
    el('div', { class:'tuc-mask' }, '？？？'),
    el('div', { class:'tuc-arrow' }, '↓'),
    el('div', { class:'tuc-star' }, tierName),
    el('div', { class:'tuc-name' }, achName),
    el('div', { class:'tuc-desc' }, '新しい字が降り始める'),
  );
  document.body.appendChild(overlay);
  // 粒子シャワー（24粒）
  for (let i = 0; i < 24; i++) {
    const p = el('div', { class:'tuc-particle', style:{
      left: (Math.random() * 100) + '%',
      animationDelay: (Math.random() * 0.6) + 's',
      animationDuration: (1.6 + Math.random() * 1.4) + 's',
    } });
    overlay.appendChild(p);
  }
  // タップで早送り
  overlay.addEventListener('click', () => overlay.remove(), { once:true });
  setTimeout(() => overlay.remove(), 3400);
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
  bumpDailyLog('exp', actualExp);
  if (idx !== STATE.party.hero && STATE.party.members[STATE.party.hero]?.perks?.includes('guardian')) {
    const heroBonus = Math.floor(actualExp * 0.2);
    if (heroBonus > 0) {
      const hero = STATE.party.members[STATE.party.hero];
      hero.exp += heroBonus;
      let s = 0;
      if (hero.exp >= effectiveExpForLevel(hero.level + 1) && !isAtRarityCap(hero)) {
        hero.exp -= effectiveExpForLevel(hero.level + 1);
        hero.level += 1;
        onLevelUp(hero, STATE.party.hero);
      }
    }
  }
  let s2 = 0;
  if (m.exp >= effectiveExpForLevel(m.level + 1) && !isAtRarityCap(m)) {
    m.exp -= effectiveExpForLevel(m.level + 1);
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
    const needExp = effectiveExpForLevel(m.level + 1);
    const pct = Math.min(100, (m.exp / needExp) * 100);
    const fill = card.querySelector('.pc-fill');
    if (fill) fill.style.width = pct + '%';
    const lvEl = card.querySelector('.pc-lv');
    if (lvEl) lvEl.textContent = 'Lv.' + m.level;
  });
}

// v1.3.18: Lv up toast スロットル ── 2 秒以内に同じメンバーは合算
let _lvupTimer = {};
function onLevelUp(member, idx) {
  invalidateAggCache();
  const prevStage = evolutionStage(member.level - 1);
  const newStage  = evolutionStage(member.level);
  const evolved = (newStage > prevStage);

  const k = member.char;
  if (!_lvupTimer[k]) _lvupTimer[k] = { startLv: member.level, t: 0 };
  clearTimeout(_lvupTimer[k].t);
  _lvupTimer[k].t = setTimeout(() => {
    const diff = member.level - (_lvupTimer[k].startLv - 1);
    // v1.5.9: 次 Lv までの EXP 表示
    const cap = effectiveLvCap(member);
    const suffix = member.level >= cap ? '（MAX）' : '';
    if (diff <= 1) toast(`${member.char} Lv.${member.level}${suffix}`, member.rarity);
    else            toast(`${member.char} +${diff} Lv.${member.level}${suffix}`, member.rarity);
    delete _lvupTimer[k];
  }, 1200);

  updateUnlockTier();
  renderParty();
  updateProgressPill();

  // Flash the leveled card + ぽわーん演出
  const card = document.querySelector(`.party-card[data-idx="${idx}"]`);
  if (card) {
    card.classList.add('levelup-flash');
    setTimeout(() => card.classList.remove('levelup-flash'), 1000);
    try {
      const r = card.getBoundingClientRect();
      spawnLevelUpPoof(r.left + r.width/2, r.top + r.height/2, member.rarity);
    } catch(_) {}
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
const _obMaxStep = 3;
function openOnboarding() {
  _obStep = 1;
  // 実装の実数を Step1 に注入（ハードコード撤去・データ拡張に追従）
  const charCount = (window.KANJI_CODEX || []).length;
  const yojiCount = (window.YOJI_RECIPES || []).length;
  const perkCount = Object.keys(PERKS || {}).length;
  const obc = $('#ob-counts');
  if (obc) obc.textContent = `${charCount.toLocaleString()}字 ・ ${yojiCount.toLocaleString()}熟語 ・ ${perkCount}特性 ・ 15段階進化 ・ ${MILESTONES.length}達成バッジ`;
  showOnboardingStep();
  $('#onboarding-modal').classList.add('show');
}

// 起動時にコレクション全体ボリュームを 1 回 console に
(function reportCollectionVolume(){
  try {
    setTimeout(() => {
      const charCount = (window.KANJI_CODEX || []).length;
      const yojiCount = (window.YOJI_RECIPES || []).length;
      const perkCount = Object.keys(PERKS || {}).length;
      console.log(
        `%c ぽもじかん コレクション総量 ── 字 ${charCount} ・ 熟語 ${yojiCount} ・ 特性 ${perkCount}`,
        'color:#f0d48a; font-weight:900;'
      );
      console.log(
        '%c  100 サイクルリリース達成 ── 開発進化v9c時点',
        'color:#ff6b9d; font-weight:900; font-size:14px;'
      );
    }, 500);
  } catch (e) {}
})();

// 数値カウントアップアニメーション（オンボーディング字数で使用）
function animateNumber(el, target, duration = 1500) {
  if (!el) return;
  const start = 0;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - t, 3);  // easeOutCubic
    el.textContent = Math.round(start + (target - start) * eased).toLocaleString();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
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
      // Lv1 と現在の簡易効果だけ表示（数式・曲線は隠す）
      const lvBadge = `<span style="font-family:'JetBrains Mono',monospace;font-size:.68rem;background:rgba(135,206,235,.18);border:1px solid rgba(135,206,235,.4);color:#cfe6ff;border-radius:4px;padding:1px 6px;margin-left:4px;">Lv1</span>`;
      status.innerHTML = `
        リーダー候補：<strong style="font-size:1.1rem">${_pickerSelected}</strong>（${k.rarity}）<br>
        <strong style="color:var(--gold)">${pName}</strong>${lvBadge} ＋ <strong style="color:#ffb888">守護</strong>${lvBadge}
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
    // v1.3.19: 過去 Lv 復元
    const hero = (typeof buildMemberFor === 'function')
      ? buildMemberFor(c, k.rarity, true)
      : { char: c, rarity: k.rarity, level: 1, exp: 0, perks: pickInherentPerks(c, k.rarity).concat(['guardian']) };
    STATE.party = { hero: 0, members: [hero] };
    saveState();
    $('#party-picker-modal').classList.remove('show');
    renderParty();
    const perkNames = (hero.perks || []).map(p => PERKS[p]?.name).filter(Boolean).join('・');
    toast(hero.level > 1
      ? `★ リーダー ${c} Lv.${hero.level} 復帰`
      : `★ リーダー ${c} ── ${perkNames}`);
  };
}

// ═══════════════════════════════════════════════════════════════
// タイマー
// ═══════════════════════════════════════════════════════════════
let timerRaf = 0;
let _hudTickCounter = 0;
function tick() {
  // v1.4.6/v1.5.14: 計測モード（カウントアップ・累積方式）
  if (STATE.mode === 'measure') {
    const liveSec = Math.floor((Date.now() - STATE.phaseStart) / 1000);
    const totalSec = (STATE.measureAccum || 0) + liveSec;
    setTextWithLvBand("timer-text", fmtTime(totalSec));
    const pct = Math.min(1, totalSec / 3600);
    updateProgress(pct);
    timerRaf = requestAnimationFrame(tick);
    return;
  }
  if (STATE.mode === 'work' || STATE.mode === 'rest') {
    const remaining = Math.max(0, STATE.phaseEnd - Date.now());
    setTextWithLvBand("timer-text", fmtTime(Math.ceil(remaining/1000)));
    const total = STATE.mode === 'work' ? STATE.timer.workSec : STATE.timer.restSec;
    const pct = 1 - (remaining/1000) / total;
    updateProgress(pct);
    // v10n10: HUD を 60F に 1 回更新（軽量）
    if ((++_hudTickCounter % 60) === 0) {
      try { renderHUD(); } catch(_) {}
    }
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

// v10n7: タイマーリング縁をドラッグで分数調整（idle 時のみ）
// 短タップ＝1点指定／ドラッグ＝連続変更／フリック＝高速指定
// 1本指=作業時間、長押し（500ms）=休憩時間モード切替
function setupTimerRingDrag() {
  const zone = document.querySelector('.timer-zone');
  if (!zone) return;
  let dragging = false;
  let editMode = 'work'; // 'work' | 'rest'
  let longPressTimer = 0;
  let startedDragging = false;

  function angleFromPoint(clientX, clientY) {
    const r = zone.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    // 12時方向=0°、時計回りに増加
    let a = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (a < 0) a += 360;
    return a;
  }
  function minutesFromAngle(a) {
    // 360°=60分、1分刻み（細かい操作も可）
    let m = Math.round(a / 6);
    if (m < 1) m = 1;
    if (m > 60) m = 60;
    return m;
  }
  function applyMinutes(m) {
    if (editMode === 'work') {
      STATE.timer.workSec = m * 60;
    } else {
      STATE.timer.restSec = m * 60;
    }
    STATE.timer.presetIdx = -1;
    setTextWithLvBand("timer-text", fmtTime(m * 60));
    // リング進捗を「設定分/60分」で塗る（視覚 feedback）
    updateProgress(m / 60);
    // 色味で work/rest を区別
    zone.classList.toggle('editing-rest', editMode === 'rest');
    zone.classList.toggle('editing-work', editMode === 'work');
  }
  function getPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }
  function onDown(e) {
    if (STATE.mode !== 'idle') return;
    const target = e.target;
    //  ボタンと timer-text 中央タップは除外（既存機能保護）
    if (target.id === 'btn-timer-settings' || target.closest('#btn-timer-settings')) return;
    dragging = true;
    startedDragging = false;
    editMode = 'work';
    // 長押し 500ms で休憩時間モード
    longPressTimer = setTimeout(() => {
      editMode = 'rest';
      setTextWithLvBand("timer-text", fmtTime(STATE.timer.restSec));
      updateProgress(STATE.timer.restSec / 60 / 60);
      zone.classList.add('editing-rest');
      try { toast(' 休憩時間モード（指を動かして分数設定）'); } catch(_) {}
    }, 500);
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging) return;
    startedDragging = true;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = 0; }
    const pt = getPoint(e);
    const a = angleFromPoint(pt.x, pt.y);
    const m = minutesFromAngle(a);
    applyMinutes(m);
    e.preventDefault();
  }
  function onUp(e) {
    if (!dragging) return;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = 0; }
    dragging = false;
    // 短タップ（移動なし）でも角度反映
    if (!startedDragging) {
      const pt = getPoint(e);
      const a = angleFromPoint(pt.x, pt.y);
      const m = minutesFromAngle(a);
      applyMinutes(m);
    }
    saveState();
    const m = Math.floor((editMode === 'work' ? STATE.timer.workSec : STATE.timer.restSec) / 60);
    try { toast(`${editMode === 'work' ? '作業' : '休憩'} ${m} 分`); } catch(_) {}
    // ring を通常状態に戻す（idle 表示用）
    setTimeout(() => {
      zone.classList.remove('editing-work', 'editing-rest');
      if (STATE.mode === 'idle') {
        setTextWithLvBand("timer-text", fmtTime(STATE.timer.workSec));
        updateProgress(0);
      }
    }, 800);
  }
  zone.addEventListener('mousedown', onDown);
  zone.addEventListener('touchstart', onDown, { passive: false });
  window.addEventListener('mousemove', onMove, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp);
  window.addEventListener('touchcancel', onUp);
}

// v1.4.6: 計測モード（カウントアップ） ── ポモドーロ以外の計時にも使う
// v1.5.14: 計測モードの一時停止／再開（accumulator 方式で正確）
function pauseMeasure() {
  if (STATE.mode !== 'measure') return;
  const elapsed = Math.floor((Date.now() - STATE.phaseStart) / 1000);
  STATE.measureAccum = (STATE.measureAccum || 0) + elapsed;
  STATE.mode = 'measurePaused';
  document.body.dataset.mode = 'idle';
  $('#main-btn').textContent = '計測再開';
  cancelAnimationFrame(timerRaf);
  stopWorkSpawning();
  saveState();
  try { releaseWakeLock(); } catch(_) {}
  toast('計測 一時停止');
}
function resumeMeasure() {
  if (STATE.mode !== 'measurePaused') return;
  try { clampSettledToGround(); } catch(_) {}
  STATE.phaseStart = Date.now();
  STATE.mode = 'measure';
  document.body.dataset.mode = 'measure';
  $('#main-btn').textContent = '計測終了';
  startWorkSpawning();
  requestWakeLock();
  saveState();
  tick();
  toast('計測 再開');
}

function startMeasure() {
  if (STATE.mode === 'measure') return;
  try { clampSettledToGround(); } catch(_) {}
  stopWorkSpawning();
  cancelAnimationFrame(timerRaf);
  STATE.mode = 'measure';
  STATE.phaseStart = Date.now();
  STATE.phaseEnd = 0;
  document.body.dataset.mode = 'measure';
  $('#main-btn').textContent = '計測終了';
  $('#main-btn').dataset.state = 'measuring';
  saveState();
  startWorkSpawning();  // 計測中も字は降る（ぽもじを楽しめる）
  requestWakeLock();
  try { toast('計測モード開始'); } catch(_) {}
  try { const e = $('#m-measure-state'); if (e) e.textContent = 'オン'; } catch(_) {}
  try { playKakkou(); } catch(_) {}
  // v1.4.7: 計測モードは「常時表示」が肝 → PiP を自動起動（対応 PC のみ）
  try { if (!_pipWindow && 'documentPictureInPicture' in window) toggleTimerPiP(); } catch(_) {}
  tick();
}
function stopMeasure() {
  if (STATE.mode !== 'measure' && STATE.mode !== 'measurePaused') return;
  const liveSec = STATE.mode === 'measure' ? Math.floor((Date.now() - STATE.phaseStart) / 1000) : 0;
  const elapsed = (STATE.measureAccum || 0) + liveSec;
  STATE.measureAccum = 0;
  try { const e = $('#m-measure-state'); if (e) e.textContent = 'オフ'; } catch(_) {}
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  if (!STATE.stats) STATE.stats = { totalCycles:0, totalDrops:0, totalExp:0 };
  STATE.stats.measureTotalSec = (STATE.stats.measureTotalSec || 0) + elapsed;
  stopWorkSpawning();
  STATE.mode = 'idle';
  STATE.phaseStart = 0;
  document.body.dataset.mode = 'idle';
  $('#main-btn').textContent = '始める';
  $('#main-btn').dataset.state = 'idle';
  setTextWithLvBand("timer-text", fmtTime(STATE.timer.workSec));
  updateProgress(0);
  releaseWakeLock();
  saveState();
  try { toast(`📏 計測終了 ── ${mins}分 ${secs}秒`); } catch(_) {}
}

let _lastStartAt = 0;
function startWork() {
  // v1.5.8: 連打防止 ── 3 秒以内の再スタートでは派手演出スキップ
  const now = Date.now();
  const isQuickRestart = (now - _lastStartAt) < 3000;
  _lastStartAt = now;
  try { clampSettledToGround(); } catch(_) {}
  STATE.mode = 'work';
  STATE.phaseStart = now;
  setTimeout(() => { try { renderHUD(); } catch(_) {} }, 50);
  requestWakeLock();
  ensureNotificationPermission();
  if (!isQuickRestart) { try { playKakkou(); } catch(_) {} }
  // v1.4.9: 作業も自動 PiP（対応 PC のみ）── 常時表示
  try { if (!_pipWindow && 'documentPictureInPicture' in window) toggleTimerPiP(); } catch(_) {}
  STATE.phaseEnd = Date.now() + STATE.timer.workSec * 1000;
  document.body.dataset.mode = 'work';
  $('#main-btn').textContent = '一時停止';
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
const WORK_SPAWN_INTERVAL_MS = 13000;  // v1.4.3: 10s→13s（テンポを落とす）
let workSpawnTimer = 0;
let workDropCount = 0;

// v1.4.5: 熟語ラッキー降下 ── 構成字を 1 字ずつ連続で降らせる
function triggerLuckyCombo() {
  const recipes = window.YOJI_RECIPES || [];
  if (recipes.length === 0) return false;
  // 解放済 or 構成字を全て発見済の熟語から
  const candidates = recipes.filter(r => {
    if (!r.chars || r.chars.length < 2 || r.chars.length > 5) return false;
    if (STATE.discoveredYoji && STATE.discoveredYoji[r.word]) return true;
    return r.chars.every(c => (STATE.collection[c] || 0) > 0);
  });
  if (candidates.length === 0) return false;
  const r = candidates[Math.floor(Math.random() * candidates.length)];
  const codex = window.KANJI_CODEX || [];
  try { toast(`熟語ラッキー：${r.word}`, r.rarity); } catch(_) {}
  r.chars.forEach((c, i) => {
    setTimeout(() => {
      if (STATE.mode !== 'work') return;
      const k = codex.find(x => (x.char||x.c) === c) || { char: c, c: c, rarity: r.rarity };
      spawnPomoji({ kanji: k });
    }, i * 700);
  });
  return true;
}

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
  // v1.5.4: メイン非表示中は字を貯めない（戻った時にメッセージで一括反映）
  if (document.hidden) return;
  // v1.4.5: 熟語ラッキー（8% 確率）── 解放済熟語の構成字を連続降下
  if (Math.random() < 0.08) {
    if (triggerLuckyCombo()) return;
  }
  workDropCount++;
  let k;
  if (STATE.party && STATE.party.members?.length && workDropCount % 3 !== 0) {
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
  // v10n18: 休憩開始でカッコウ
  try { playKakkou(); } catch(_) {}
}

function pauseTimer() {
  if (STATE.mode !== 'work' && STATE.mode !== 'rest') return;
  // v1.5.14: pausedMode を明示保存（body.dataset 依存を解消）
  STATE.pausedMode = STATE.mode;
  STATE.pausedRemaining = Math.max(0, STATE.phaseEnd - Date.now());
  STATE.mode = 'paused';
  $('#main-btn').textContent = '再開';
  $('#main-btn').dataset.state = 'paused';
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  stopRisingPomoji();
  stopWorkSpawning();
  stopRainAudio();
  stopBubbleAudio();
  try { releaseWakeLock(); } catch(_) {}
}

function resumeTimer() {
  try { clampSettledToGround(); } catch(_) {}
  // v1.5.14: pausedMode から確実復元
  const m = STATE.pausedMode || (document.body.dataset.mode === 'rest' ? 'rest' : 'work');
  STATE.phaseEnd = Date.now() + (STATE.pausedRemaining || 0);
  STATE.pausedRemaining = 0;
  STATE.pausedMode = null;
  if (m === 'rest') {
    STATE.mode = 'rest';
    document.body.dataset.mode = 'rest';
    startRisingPomoji();
  } else {
    STATE.mode = 'work';
    document.body.dataset.mode = 'work';
    startWorkSpawning();
  }
  $('#main-btn').textContent = '一時停止';
  $('#main-btn').dataset.state = 'running';
  saveState();
  refreshAudioByMode();
  try { requestWakeLock(); } catch(_) {}
  tick();
}

function stopTimer() {
  STATE.mode = 'idle';
  document.body.dataset.mode = 'idle';
  $('#main-btn').textContent = '始める';
  $('#main-btn').dataset.state = 'idle';
  setTextWithLvBand("timer-text", fmtTime(STATE.timer.workSec));
  try { releaseWakeLock(); } catch(_) {}
  updateProgress(0);
  // v1.5.16: 停止時にセット進捗もリセット（次のスタートは 1/N から）
  if (STATE.timer) STATE.timer.setsDone = 0;
  saveState();
  updateProgressPill();
  cancelAnimationFrame(timerRaf);
  stopRisingPomoji();
  stopWorkSpawning();
}

// v10n16: カッコウ BGM ── タイマー終了で鳴らす（ファイル無くても安全動作）
let _kakkouAudio = null;
function playKakkou() {
  try {
    if (!_kakkouAudio) {
      _kakkouAudio = new Audio('./kakkou.mp3');
      _kakkouAudio.preload = 'auto';
      _kakkouAudio.volume = 0.7;
    }
    _kakkouAudio.currentTime = 0;
    _kakkouAudio.play().catch(()=>{ /* ファイル無し or 自動再生ブロック等は無視 */ });
  } catch(_) {}
}

function completePhase() {
  const prevMode = STATE.mode;
  try { notifyPhaseComplete(prevMode); } catch(_) {}
  if (STATE.mode === 'work') {
    STATE.cycles += 1;
    STATE.stats.totalCycles += 1;
    updateStreak();
    checkMilestones();
    // 日別カウント
    if (!STATE.dailyCycles) STATE.dailyCycles = {};
    const today = new Date().toISOString().slice(0, 10);
    STATE.dailyCycles[today] = (STATE.dailyCycles[today] || 0) + 1;
    stopWorkSpawning();
    spawnCycleDrops();
    updateProgressPill();
    flashCompletionBurst('凝縮 完了');
    burstPartyPersistents();
    playSFX('cycle');
    writeSharedRbJikoku();   // 5本柱接続：時刻メトリクスを共有
    // 読雨に「サイクル完了」イベントを放流
    _publishYomuEvent('cycle_complete', {
      cycle_no: STATE.cycles,
      total_cycles: STATE.stats.totalCycles,
      streak: STATE.streak?.current || 0,
      hero_char: isPartyChosen() ? STATE.party.members[STATE.party.hero||0].char : null,
      hero_lv:   isPartyChosen() ? STATE.party.members[STATE.party.hero||0].level : 0,
      work_sec:  STATE.timer.workSec,
      user_id:   STATE.userId || null,
    });
    // rest モード開始を少し遅らせる：cycle drops が画面に着地〜泡化する余裕を持たせる
    setTimeout(() => startRest(), 600);
  } else if (STATE.mode === 'rest') {
    flashCompletionBurst('発散 完了');
    stopRisingPomoji();
    // v10n16/17: セット数カウント＆目標到達判定 → 未達なら自動で次の作業へ
    if (!STATE.timer.setsDone) STATE.timer.setsDone = 0;
    STATE.timer.setsDone += 1;
    const target = STATE.timer.setsTarget || 0;
    if (target > 0 && STATE.timer.setsDone >= target) {
      flashCompletionBurst(`🏆 目標 ${target} セット 達成！`);
      try { playSFX('milestone'); } catch(_) {}
      STATE.timer.setsDone = 0;
      stopTimer();
    } else if (target > 0) {
      // v1.2.1: 自動で次のサイクルへ ── まず idle に落として tick 無限ループを止める
      STATE.mode = 'idle';
      document.body.dataset.mode = 'idle';
      cancelAnimationFrame(timerRaf);
      toast(`セット ${STATE.timer.setsDone} / ${target} ── 次へ`);
      stopRisingPomoji();
      setTimeout(() => { if (STATE.mode === 'idle') startWork(); }, 1200);
    } else {
      // 無制限モード（setsTarget=0）：従来通り休憩終了で停止
      stopTimer();
    }
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
  // v1.2.0: 全ぽもじ（persistent 含む）を順番に泡化
  // パーティ字は次の作業開始で spawnPartyPersistents が再スポーンする
  const targets = Array.from(livePomoji.values())
    .filter(p => !p.dragging && !p.rising)
    .sort((a, b) => a.y - b.y); // 上にあるものから（演出順）
  if (targets.length === 0) {
    toast('泡にする字がない（集中で貯めよう）');
    return;
  }
  targets.forEach((p, i) => {
    setTimeout(() => convertToRising(p), i * 100);  // 180ms → 100ms に短縮
  });
  toast(`${targets.length}粒の字が育つ`);
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
  // v1.2.7: 4 秒後に必ず EXP 化（休憩で全字消化を保証）
  setTimeout(() => {
    if (!p._awarded && livePomoji.has(p.id) && p.rising) {
      p._awarded = true;
      try { awardRising(p); } catch(_) {}
    }
  }, 4000);
}
function awardRising(p) {
  const rIdx = RARITY_TIERS.indexOf(p.rarity);
  const exp = Math.max(1, Math.pow(1.3, rIdx) * 6);
  const tankRect = $('#tank').getBoundingClientRect();
  spawnXpFloat(p.x + SIZE/2, Math.max(20, p.y), exp, p.rarity);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  p.el.classList.add('burst');
  setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 500);
}

// v10n6: 棚（コインプッシャー床）から落下 → EXP 化
// v1.1.5: 長押し → スワイプ収穫モード（一気にぽもじを弾けさせる）
let _harvestMode = false;
let _harvestTimer = 0;
let _harvestPointerId = null;
let _harvestCount = 0;
function _harvestBurstAt(x, y) {
  const node = document.elementFromPoint(x, y)?.closest('.pomoji');
  if (!node) return;
  for (const p of livePomoji.values()) {
    if (p.el === node && !p._harvested) {
      // v1.1.6: persistent は収穫対象外（リーダー保護）
      if (p.persistent) return;
      p._harvested = true;
      if (p.dragging) p.dragging = false;
      try { dissolvePomoji(p); } catch(_) {}
      _harvestCount++;
      _updateHarvestCounter();
      return;
    }
  }
}
// v1.1.6: 収穫数カウンタ（画面中央上）
function _showHarvestCounter() {
  let c = document.getElementById('harvest-counter');
  if (!c) {
    c = document.createElement('div');
    c.id = 'harvest-counter';
    document.body.appendChild(c);
  }
  c.textContent = '🌾 収穫中 ・ 0 個';
  c.classList.add('show');
}
function _updateHarvestCounter() {
  const c = document.getElementById('harvest-counter');
  if (c) c.textContent = `🌾 収穫中 ・ ${_harvestCount} 個`;
}
function _hideHarvestCounter() {
  const c = document.getElementById('harvest-counter');
  if (!c) return;
  if (_harvestCount > 0) {
    c.textContent = `${_harvestCount} 個 収穫！`;
    c.classList.add('done');
    setTimeout(() => { c.remove(); }, 1400);
  } else {
    c.remove();
  }
}
// v1.1.8: 長押し撤廃 ── スワイプで 2 個目以降のぽもじに触れたら自動で収穫モード
let _harvestStartEl = null;
let _harvestSeenEls = null;
function _harvestBurstEl(node) {
  if (!node) return false;
  for (const p of livePomoji.values()) {
    if (p.el === node && !p._harvested && !p.persistent) {
      p._harvested = true;
      if (p.dragging) p.dragging = false;
      try { dissolvePomoji(p); } catch(_) {}
      _harvestCount++;
      _updateHarvestCounter();
      return true;
    }
  }
  return false;
}
function setupHarvestMode() {
  document.addEventListener('pointerdown', (e) => {
    if (_harvestMode) return;
    const t = e.target.closest && e.target.closest('.pomoji');
    if (!t) return;
    if (e.target.closest('.party-card')) return;
    // 起点 persistent は対象外
    let isPersistent = false;
    for (const p of livePomoji.values()) {
      if (p.el === t) { isPersistent = !!p.persistent; break; }
    }
    if (isPersistent) return;
    _harvestPointerId = e.pointerId;
    _harvestStartEl = t;
    _harvestSeenEls = new Set([t]);
    _harvestCount = 0;
    // Shift 即起動オプション（PC キーボード）
    if (e.shiftKey) {
      _harvestMode = true;
      document.body.classList.add('harvest-mode');
      _showHarvestCounter();
      _harvestBurstEl(t);
    }
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (e.pointerId !== _harvestPointerId) return;
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.pomoji');
    if (!t) return;
    if (_harvestSeenEls.has(t)) return;
    _harvestSeenEls.add(t);
    // 2 個目に触れた時点で起動（起点字も同時 burst）
    if (!_harvestMode) {
      _harvestMode = true;
      document.body.classList.add('harvest-mode');
      try { navigator.vibrate && navigator.vibrate(20); } catch(_) {}
      try { playSFX('unlock'); } catch(_) {}
      _showHarvestCounter();
      _harvestBurstEl(_harvestStartEl);
    }
    _harvestBurstEl(t);
  }, true);
  const endHarvest = (e) => {
    if (e.pointerId !== _harvestPointerId && _harvestPointerId !== null) return;
    if (_harvestMode) {
      _harvestMode = false;
      document.body.classList.remove('harvest-mode');
      _hideHarvestCounter();
    }
    _harvestPointerId = null;
    _harvestStartEl = null;
    _harvestSeenEls = null;
  };
  document.addEventListener('pointerup', endHarvest, true);
  document.addEventListener('pointercancel', endHarvest, true);
}

// v1.1.0: 雨の波紋（着地時）
function spawnRipple(x) {
  const node = document.createElement('div');
  node.className = 'ripple';
  node.style.left = x + 'px';
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 850);
}

function awardFallen(p) {
  if (p._awarded) return;
  p._awarded = true;
  const rIdx = RARITY_TIERS.indexOf(p.rarity);
  // v1.5.36: 力ステータス（1-5）で EXP ±40%
  const powerMul = p.stats ? (0.8 + 0.1 * p.stats.power) : 1;
  const exp = Math.max(1, Math.round(Math.pow(1.3, rIdx) * 6 * powerMul));
  // 落下位置の上方向に XP float を出す（画面内で見える位置）
  const H = window.innerHeight;
  spawnXpFloat(p.x + SIZE/2, Math.min(H - 40, Math.max(40, p.y)), exp, p.rarity);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  try { playSFX('pop'); } catch(_) {}
  p.el?.classList.add('burst');
  setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 400);
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
    const fallback = codex.filter(k => allowedTiers.includes(k.rarity));
    return fallback.length ? choose(fallback) : null;
  }
  // v1.5.1: ★ お気に入り字を 50% で優先抽選（プール内に該当があれば）
  if (Math.random() < 0.50) {
    try {
      const favs = pool.filter(k => isFavoriteChar(k.char || k.c));
      if (favs.length > 0) return choose(favs);
    } catch(_) {}
  }
  // v1.3.15: リーダーのタグと一致する字を 35% で優先（fav と独立）
  if (STATE.party && STATE.party.members && STATE.party.members[0] && Math.random() < 0.35) {
    try {
      const leaderTags = getCharTags(STATE.party.members[0].char) || [];
      if (leaderTags.length > 0) {
        const tagged = pool.filter(k => {
          const t = getCharTags(k.char || k.c) || [];
          return t.some(x => leaderTags.includes(x));
        });
        if (tagged.length > 0) return choose(tagged);
      }
    } catch(_) {}
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
const MAX_LIVE_POMOJI = 18;  // v1.4.3: 30→18（インフレ抑制）
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
  const exp = Math.max(1, Math.pow(1.3, rIdx) * 2);  // dissolve より控えめ（自然吸収）
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
  const isHero = partyIdx >= 0 && STATE.party && STATE.party.hero === partyIdx;
  if (partyIdx >= 0) {
    partyLv = STATE.party.members[partyIdx].level;
    evoStage = evolutionStage(partyLv);
    styleClass = EVO_STYLE[evoStage] || 'kai';
  }

  const isFirstSee = !STATE.collection[char];

  // パーティ字は常に追加グロー（落下中も識別できる）── Lv で強度up
  const styleObj = { left: x+'px', top: y+'px' };
  if (partyIdx >= 0) {
    const baseGlow = isHero ? 18 : 12;
    const glow = Math.max(baseGlow, lvGlowRadius(partyLv));
    styleObj.filter = `drop-shadow(0 0 ${glow}px var(--r-color))`;
  }

  // class 構成：rarity / font / evo / party-member / party-leader / party-lv-band
  const lvBand = partyLv >= 1000 ? 'lvband-divine'
              : partyLv >= 300  ? 'lvband-cosmic'
              : partyLv >= 100  ? 'lvband-master'
              : partyLv >= 30   ? 'lvband-adept'
              : partyLv >= 10   ? 'lvband-novice'
              : '';
  const partyCls = partyIdx >= 0
    ? ` party-member${isHero ? ' party-leader' : ''}${lvBand ? ' ' + lvBand : ''}`
    : '';
  const node = el('div', {
    class: `pomoji ${tierClass} font-${styleClass}${evoStage > 0 ? ` evo-${evoStage}` : ''}${partyCls}`,
    dataset: { id, char, rarity, tier: tierIdx, evo: evoStage, lv: partyLv },
    style: styleObj
  }, char);
  field.appendChild(node);

  // v1.5.34/48: 物理属性ランダム ── 通常 78% / 弾性 8% / 暴れ 4% / べちゃ 8% / 重力 2%
  let physMode = 'normal';
  if (!opts.persistent) {
    const r = Math.random();
    if (r < 0.08) physMode = 'bouncy';
    else if (r < 0.12) physMode = 'wild';
    else if (r < 0.20) physMode = 'wet';
    else if (r < 0.22) physMode = 'magnet';  // v1.5.48: 周囲を引き寄せるレアぽもじ
  }
  // v1.5.36: 字ステータスを物理に反映
  const charStats = getCharStats(char);
  const obj = {
    id, char, rarity, tier: tierIdx, x, y,
    vx: (Math.random()-0.5)*1.0, vy: 0,
    el: node, settled: false, isFirstSee, mergeLevel: 1,
    persistent: !!opts.persistent,
    physMode,
    stats: charStats,
    spawnedAt: Date.now(),
  };
  if (physMode !== 'normal') node.classList.add('phys-' + physMode);
  if (obj.persistent) node.classList.add('persistent');
  // v1.5.47: 絵文字専用クラス（餅背景を消して絵文字を主役に）
  const isEmojiChar = getCharTags(char).includes('絵文字');
  if (isEmojiChar) {
    node.classList.add('pomoji-emoji');
    // カテゴリ別オーラ
    if ('🔥💥⚡☄🌋'.includes(char)) node.classList.add('emoji-fire');
    else if ('💧🌊💦🌀☔'.includes(char)) node.classList.add('emoji-water');
    else if ('✨🌟💫⭐🌠'.includes(char)) node.classList.add('emoji-spark');
    else if ('💀☠👻👽👿🤖'.includes(char)) node.classList.add('emoji-dark');
    else if ('🌸🌺🌷🌹🌻🌼💐'.includes(char)) node.classList.add('emoji-bloom');
    else if ('💰💎💴💵🪙'.includes(char)) node.classList.add('emoji-gold');
  }
  obj.isEmoji = isEmojiChar;
  livePomoji.set(id, obj);
  attachDragHandlers(node, obj);

  STATE.stats.totalDrops += 1;
  STATE.collection[char] = (STATE.collection[char] || 0) + 1;

  // 新発見：一瞬通知 ＋ 二軸レベルの「発見ボーナス EXP」をパーティ全員に配分
  if (isFirstSee) {
    toast(`新！ ${char}`, rarity);
    playSFX('discover');
    grantDiscoveryBonus(rarity, char);
    bumpDailyLog('newChars', 1);
  }
  return obj;
}

// v10n 日別実績ロガー ── 「今日の送り状」表示用
function bumpDailyLog(field, amount) {
  const key = new Date().toISOString().slice(0, 10);
  if (!STATE.dailyLog) STATE.dailyLog = {};
  if (!STATE.dailyLog[key]) STATE.dailyLog[key] = { newChars: 0, newYoji: 0, exp: 0 };
  STATE.dailyLog[key][field] = (STATE.dailyLog[key][field] || 0) + amount;
  // 30 日分のみ保持（容量制御）
  const keys = Object.keys(STATE.dailyLog).sort();
  if (keys.length > 40) {
    keys.slice(0, keys.length - 30).forEach(k => delete STATE.dailyLog[k]);
  }
}

//  昨日の送り状 ── 朝の再起動で見られる、寝る前への鼓舞
function showDailyReportIfNew() {
  const today = new Date().toISOString().slice(0, 10);
  // 既に今日の起動で表示済ならスキップ
  if (STATE.lastShownDailyReport === today) return;
  // 昨日の日付
  const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const log = (STATE.dailyLog || {})[yest];
  const cycles = (STATE.dailyCycles || {})[yest] || 0;
  // 何の活動もなければスキップ（休んだ日に通知しない）
  if (!log && cycles === 0) {
    STATE.lastShownDailyReport = today;
    saveState();
    return;
  }
  const newChars = log?.newChars || 0;
  const newYoji  = log?.newYoji  || 0;
  const exp      = log?.exp      || 0;
  // 起動 60 サイクル未満では出さない（初心者を脅かさない）
  if ((STATE.stats?.totalCycles || 0) < 60) {
    STATE.lastShownDailyReport = today;
    saveState();
    return;
  }
  $$('.daily-report-overlay').forEach(n => n.remove());
  const dateLabel = (() => {
    const d = new Date(yest + 'T12:00:00');
    return `${d.getMonth()+1}月${d.getDate()}日`;
  })();
  const overlay = el('div', { class:'daily-report-overlay', onclick: (e) => {
    if (e.target === overlay) overlay.remove();
  } },
    el('div', { class:'daily-report-card' },
      el('button', { class:'dr-close', onclick: () => overlay.remove() }, '×'),
      el('div', { class:'dr-moon' }, ''),
      el('h2', { class:'dr-title' }, `${dateLabel} の送り状`),
      el('div', { class:'dr-grid' },
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, ''),
          el('div', { class:'dr-num' }, cycles.toLocaleString()),
          el('div', { class:'dr-label' }, 'サイクル')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, '🌏'),
          el('div', { class:'dr-num' }, newChars.toLocaleString()),
          el('div', { class:'dr-label' }, '新発見字')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, ''),
          el('div', { class:'dr-num' }, newYoji.toLocaleString()),
          el('div', { class:'dr-label' }, '新解放熟語')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, ''),
          el('div', { class:'dr-num' }, exp >= 10000 ? Math.round(exp/1000) + 'k' : exp.toLocaleString()),
          el('div', { class:'dr-label' }, '獲得 EXP')
        )
      ),
      el('p', { class:'dr-msg' }, _dailyReportMessage(cycles, newChars, newYoji)),
      el('button', { class:'btn-primary dr-btn', onclick: () => overlay.remove() }, 'おはよう')
    )
  );
  document.body.appendChild(overlay);
  STATE.lastShownDailyReport = today;
  saveState();
}
function _dailyReportMessage(cyc, ch, yj) {
  if (cyc >= 10) return '昨日はよく走りました ── 今日も降る字と一緒に';
  if (yj >= 3)   return '熟語が花開いた一日 ── 今日も新しい結びを';
  if (ch >= 20)  return '世界の文字が広がる旅 ── 今日も新たな出会いを';
  if (cyc >= 3)  return '昨日も淡々と積みました ── 継続は力なり';
  return '昨日のひと粒 ── 今日もここに集まりましょう';
}

// 新発見ボーナス：字種を集める動機を作る（v40 俳句構想の前倒し）
// rarity が高いほど大きい一回限りの EXP がパーティ全員に入る
function grantDiscoveryBonus(rarity, char) {
  if (!STATE.party || !STATE.party.members) return;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const bonus = 3 + Math.pow(1.3, rIdx);  // ★1=4 ★3=7 ★5=19 ★10=515
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
    let s = 0;
    if (m.exp >= effectiveExpForLevel(m.level + 1) && !isAtRarityCap(m)) {
      m.exp -= effectiveExpForLevel(m.level + 1);
      m.level += 1;
      onLevelUp(m, i);
    }
  }
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + total;

  if (milestoneMul > 1) {
    toast(` 発見 ${uniq} 種達成！ ボーナス ×${milestoneMul}`, rarity);
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
        toast(` ${k.char || k.c}（${k.rarity}）`, k.rarity);
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
// パーティ集約のメモ化（毎フレームでなく N フレームに 1 回更新）
let _aggCache = null;
let _aggCacheFrame = 0;
let _physicsFrame = 0;
function invalidateAggCache() { _aggCache = null; }
// v10n6: コインプッシャー型 ── 棚は中央 76%、両端 12% は穴
// 棚から外れた字は下に落ちて EXP 化（累積しない＝重くならない）
const LEDGE_PAD = 0.12;
const LEDGE_THICKNESS = 28;  // v1.1.2: 棚の厚み（CSS と整合・水盤の縁風）
function ledgeBounds(W) {
  return { left: W * LEDGE_PAD, right: W * (1 - LEDGE_PAD) - SIZE };
}

function physicsStep() {
  _physicsFrame++;
  const W = window.innerWidth, H = window.innerHeight;
  const ledge = ledgeBounds(W);
  // perk 適用（10 フレーム毎にしか再計算しない ・ 視覚差は無視できる）
  if (!_aggCache || (_physicsFrame - _aggCacheFrame) >= 10) {
    _aggCache = aggregatePartyPerks();
    _aggCacheFrame = _physicsFrame;
  }
  const agg = _aggCache;
  for (const p of livePomoji.values()) {
    if (p.dragging) continue;
    // v1.3.11: 高度限界 ── 画面外（上・横・下遥か）に達した字は即 EXP 化＋削除
    // 泡は天井で消える。構造的に溜まらない。
    if (!p._awarded && (p.y < -SIZE * 1.5 || p.x < -SIZE * 2 || p.x > W + SIZE * 2 || p.y > H + SIZE * 3)) {
      p._awarded = true;
      try {
        if (p.rising) awardRising(p);
        else if (!p.persistent) awardFallen(p);
      } catch(_) {}
      try { p.el?.remove(); } catch(_) {}
      livePomoji.delete(p.id);
      continue;
    }
    // settled な字は位置固定 ── ただし persistent でなく棚外なら settle 解除して落とす
    if (p.settled && !p.rising) {
      // v1.2.7: ドラッグ字（ハンマー）が触れたら settle 解除＋蹴り飛ばす
      if (!p.persistent) {
        for (const other of livePomoji.values()) {
          if (other === p || !other.dragging) continue;
          const ddx = (other.x + SIZE/2) - (p.x + SIZE/2);
          const ddy = (other.y + SIZE/2) - (p.y + SIZE/2);
          if (Math.abs(ddx) < SIZE * 0.95 && Math.abs(ddy) < SIZE * 0.95) {
            p.settled = false;
            p.settledX = null;
            p.settledY = null;
            p.el?.classList.remove('settled');
            const sign = ddx >= 0 ? -1 : 1;
            p.vx += sign * 6;
            p.vy = -1.2;
            p._stillFrames = 0;
            break;
          }
        }
      }
      // v1.1.9: 下の支え消失チェック（下の字が消えたら落ち直す）
      let supportLost = false;
      if (!p.persistent && (_physicsFrame % 20) === ((p.id || 0) % 20)) {
        const floorY = H - SIZE - LEDGE_THICKNESS;
        if (p.y < floorY - 1) {
          let supported = false;
          for (const other of livePomoji.values()) {
            if (other.id === p.id || other.rising) continue;
            const odx = Math.abs(p.x - other.x);
            const ody = other.y - p.y;
            if (odx < SIZE * 0.85 && ody > 0 && ody < SIZE * 1.1) { supported = true; break; }
          }
          supportLost = !supported;
        }
      }
      if (supportLost) {
        p.settled = false;
        p.settledX = null;
        p.settledY = null;
        p.el.classList.remove('settled');
        p.vy = 0.4;
        // 落下フェーズに流す（後続の物理処理へ）
      } else {
      // v10n6: 棚から押し出されたら再落下開始（コインプッシャー）
      const cx = p.x + SIZE/2;
      // v1.5.15: multi-hole 対応
      const onLedge = p.persistent || !isOverHole(cx, W);
      // v1.5.16: 傾斜土台で settled 字に常時 vx 押し
      const tvx = ledgeTiltVx();
      if (tvx !== 0 && !p.persistent && onLedge) {
        p.settled = false;
        p.settledX = null;
        p.settledY = null;
        p.el?.classList.remove('settled');
        p.vx = (p.vx || 0) + tvx;
      }
      if (!onLedge) {
        p.settled = false;
        p.settledX = null;
        p.settledY = null;
        p.el.classList.remove('settled');
        // 横に押された慣性を残してそのまま落下フェーズへ
      } else {
        if (p.settledX != null) { p.x = p.settledX; }
        if (p.settledY != null) { p.y = p.settledY; }
        // v1.5.20: 画面サイズ変更や再開時に地中に埋まる事を防止 ── 地面より下なら持ち上げ
        const groundY = H - SIZE - LEDGE_THICKNESS;
        if (p.y > groundY) { p.y = groundY; p.settledY = groundY; }
        if (p.x < 0) { p.x = 0; p.settledX = 0; }
        if (p.x > W - SIZE) { p.x = W - SIZE; p.settledX = W - SIZE; }
        p.vx = 0; p.vy = 0;
        p.el.style.left = p.x + 'px';
        p.el.style.top  = p.y + 'px';
        continue;
      }
      }  // v1.1.9: supportLost else 閉じ
    }
    if (p.rising) {
      // 上昇ぽもじ：軽い揺らぎ＋ゆっくり浮上
      p.vx += (Math.random() - 0.5) * 0.08;
      p.vx *= 0.96;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > W - SIZE) p.vx *= -0.7;
      // v1.0.2: 上昇中に確率的に EXP 化（画面中段を越えたら毎フレーム小確率）
      if (!p._awarded && p.y < H * 0.6) {
        // 上に行くほど確率↑（H*0.6 で 0.3% / H*0.3 で 1.0% / H*0 で 1.7%）
        const passRatio = 1 - (p.y / (H * 0.6));
        const burstRate = 0.003 + passRatio * 0.014;
        if (Math.random() < burstRate) {
          p._awarded = true;
          awardRising(p);
          continue;
        }
      }
      // v1.3.9: 天井到達 → EXP 化＋即時 DOM 削除（lingering 防止）
      if (p.y < -SIZE) {
        if (!p._awarded) {
          p._awarded = true;
          awardRising(p);
        }
        // さらに上に行った字は即削除（待たず）
        if (p.y < -SIZE * 2.5) {
          try { p.el?.remove(); } catch(_) {}
          livePomoji.delete(p.id);
        }
        continue;
      }
      p.el.style.left = p.x + 'px';
      p.el.style.top  = p.y + 'px';
      continue;
    }
    // 寿命チェック：一般字（非persistent）── 命ステータス（1-5）で ±40%
    if (!p.persistent && p.spawnedAt) {
      const lifeMul = p.stats ? (0.8 + 0.1 * p.stats.life) : 1;
      if ((Date.now() - p.spawnedAt) > POMOJI_LIFETIME_MS * lifeMul) {
        expireAsExp(p);
        continue;
      }
    }
    // 落下ぽもじ：重力＋円形ソフトボディ衝突（控えめ弾性／ゆっくり転がる）
    const tierMul = TIER_FALL_MUL[p.tier] || 1.0;
    // v1.5.48: 重力ぽもじ ── 周囲の落下中字を自分に引き寄せる
    if (p.physMode === 'magnet' && !p.dragging) {
      for (const other of livePomoji.values()) {
        if (other.id === p.id || other.persistent || other.dragging || other.settled || other.rising) continue;
        const dx = p.x - other.x, dy = p.y - other.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < 180*180 && d2 > 1) {
          const f = 0.04 / Math.sqrt(d2);
          other.vx += dx * f * 6;
          other.vy += dy * f * 4;
        }
      }
    }

    // ── 安定化：真下に静的な字があれば重力を抑える（震え対策）──
    let restingOnStatic = false;
    for (const other of livePomoji.values()) {
      if (other.id === p.id || other.rising) continue;
      const isStatic = other.dragging || other.persistent || other.settled;
      if (!isStatic) continue;
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      if (Math.abs(dx) < SIZE * 0.85 && dy < 0 && dy > -SIZE * 1.05) {
        restingOnStatic = true;
        break;
      }
    }
    if (!restingOnStatic) {
      // v1.5.36: 速ステータス（1-5）で重力 ±20%
      const speedMul = p.stats ? (0.8 + 0.1 * p.stats.speed) : 1;
      p.vy += GRAVITY_BASE * tierMul * (agg.gravityMul || 1.0) * speedMul;
    } else {
      p.vy *= 0.85;  // 静的な台に乗ってる時は重力を切って減衰のみ
    }
    if (p.vy > MAX_FALL_VY) p.vy = MAX_FALL_VY;
    // v1.1.9: 摩擦さらに弱め（しっかり転がり続ける）
    p.vx *= 0.998;
    if (Math.abs(p.vx) < 0.008) p.vx = 0;
    p.x += p.vx;
    p.y += p.vy;
    // v1.5.15: 画面端まで行ったら EXP 化、それ以外は反射なし（穴に落ちる）
    if (p.x < -SIZE * 1.2) { awardFallen(p); continue; }
    if (p.x > W + SIZE * 0.2) { awardFallen(p); continue; }
    {
      // 棚内：x 反射（万一の表示はみ出し防止のみ）
      if (p.x < 0)        { p.x = 0; p.vx *= -0.4; }
      if (p.x > W - SIZE) { p.x = W - SIZE; p.vx *= -0.4; }
    }

    // 餅同士の衝突（円形ソフトボディ ── 落下中の自分だけが動く）
    // 早期 cull：dx/dy が SIZE 超なら確実に衝突しない（sqrt 計算をスキップ）
    const minDist = SIZE * 0.94;
    for (const other of livePomoji.values()) {
      if (other.id === p.id || other.rising) continue;
      const dx = p.x - other.x;
      const dy = p.y - other.y;
      if (Math.abs(dx) >= minDist || Math.abs(dy) >= minDist) continue;
      const dist = Math.sqrt(dx*dx + dy*dy);
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
          // v1.2.6: 接線力＋ settled 解除 ── 押された字は物理に戻して本当に転がる
          if (Math.abs(nx) > 0.05) {
            p.vx += nx * 3.5;
            if (otherStatic && !other.persistent && other.settled) {
              // settled を解除 → 通常物理（vx + 重力）で自然に転がる
              other.settled = false;
              other.settledX = null;
              other.settledY = null;
              other.el?.classList.remove('settled');
              other.vx -= nx * 3.0;  // 押された方向に勢いを与える
              other._stillFrames = 0;
            }
          }
        }
      }
    }

    // v10n6: コインプッシャー床 ── 棚の上だけ着地、棚外は素通りで下に落ちる
    // v1.5.15: multi-hole 対応 ── 穴の上は素通り、それ以外は棚
    const overLedge = !isOverHole(p.x + SIZE/2, W);
    if (overLedge && p.y > H - SIZE - LEDGE_THICKNESS) {
      // v1.3.12: 着地で必ず波紋（速度しきい値撤廃）
      if (!p._rippled) {
        spawnRipple(p.x + SIZE/2);
        p._rippled = true;
      }
      // 棚の上で着地（厚み分上で止まる）
      p.y = H - SIZE - LEDGE_THICKNESS;
      // v1.5.34: 物理モード別反発係数
      const bounce = p.physMode === 'bouncy' ? -0.75
                   : p.physMode === 'wild'   ? -0.95
                   : p.physMode === 'wet'    ? -0.05
                   : -0.22;
      const settleThreshold = p.physMode === 'wet' ? 3.5
                            : p.physMode === 'bouncy' ? 0.6
                            : p.physMode === 'wild' ? 0.4
                            : 1.6;
      if (Math.abs(p.vy) > settleThreshold) {
        p.vy *= bounce;
        if (p.physMode === 'wild') {
          // 暴れ：周囲を強く揺らす
          p.vx += (Math.random() - 0.5) * 6;
          unsettleAbove(p);
        } else if (p.physMode === 'bouncy') {
          p.vx += (Math.random() - 0.5) * 1.5;
        }
        squashEl(p, p.physMode === 'wet' ? 'squash' : 'squash');
      } else {
        p.vy = 0;
        const friction = p.physMode === 'wet' ? 0.1 : p.physMode === 'bouncy' ? 0.85 : 0.6;
        p.vx *= friction;
        if (STATE.mode === 'rest' && !p.persistent) {
          convertToRising(p);
          continue;
        }
        if (!p.settled && agg.magnet) attractSameChar(p);
        if (!p.settled && Math.abs(p.vx) < 0.3) {
          p.el.classList.add('settled');
          squashEl(p, 'squash');
          p.settled = true;
          p.settledX = p.x;
          p.settledY = p.y;
        }
      }
    } else if (p.y > H + SIZE * 0.8) {
      // 棚外 or 棚を抜けた → 画面下まで落下したら EXP 化（コインゲーム）
      awardFallen(p);
      continue;
    }

    // ── 積み重ね settle：床に届かなくても他字の上で静止したら settle ──
    // restingOnStatic で重力カット → vy/vx ほぼ 0 が続いたら settled に昇格
    const speed = Math.abs(p.vx) + Math.abs(p.vy);
    if (restingOnStatic && speed < 0.18) {
      p._stillFrames = (p._stillFrames || 0) + 1;
      if (p._stillFrames > 8 && !p.settled) {
        p.vx = 0; p.vy = 0;
        p.settled = true;
        p.settledX = p.x;
        p.settledY = p.y;
        p.el.classList.add('settled');
      }
    } else {
      p._stillFrames = 0;
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
  // v1.5.36: 結ステータス（1-5）で融合範囲 ±40%
  const bondMul = p.stats ? (0.8 + 0.1 * p.stats.bond) : 1;
  const radius = SIZE * 0.9 * (agg.mergeRadiusMul || 1.0) * bondMul;
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
  let startTime = 0;  // v1.3.0: 素早いタップ判定

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
    // v1.1.6: ドラッグ後の再着地でも波紋が出るように flag リセット
    obj._rippled = false;
    moved = false;
    startTime = Date.now();
    startX = e.clientX;
    startY = e.clientY;
    // v1.5.21: 長押し（650ms）で字の詳細を開く（burst を抑制）
    clearTimeout(obj._lpT);
    obj._lpDetailOpened = false;
    obj._lpT = setTimeout(() => {
      if (!moved && obj.dragging) {
        obj._lpDetailOpened = true;
        try { showCharDetail(obj.char, obj.rarity); } catch(_) {}
        try { node.releasePointerCapture(pointerId); } catch(_) {}
        obj.dragging = false;
        node.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        document.removeEventListener('pointercancel', onUp);
      }
    }, 650);
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
      // v1.3.10: ドラッグエリア掃除 ── 重なる他字を即 burst（持続字は対象外）
      if (moved) {
        const r2 = (SIZE * 1.1) ** 2;
        for (const q of livePomoji.values()) {
          if (q.id === obj.id || q.persistent || q._awarded || q.dragging) continue;
          const qdx = (obj.x + SIZE/2) - (q.x + SIZE/2);
          const qdy = (obj.y + SIZE/2) - (q.y + SIZE/2);
          if (qdx*qdx + qdy*qdy < r2) {
            q._awarded = true;
            try {
              const rIdx = RARITY_TIERS.indexOf(q.rarity);
              const exp = Math.max(1, Math.pow(1.3, rIdx) * 2);
              awardExpToParty(q.char, exp) || _orphanExp(exp);
              addStock(q.char);
              spawnXpFloat(q.x + SIZE/2, q.y + SIZE/2, exp, q.rarity);
              q.el?.classList.add('burst');
              setTimeout(() => { q.el?.remove(); livePomoji.delete(q.id); }, 250);
            } catch(_) {}
          }
        }
      }
      const target = checkMergeCollision(obj);
      $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));
      if (target) target.el.classList.add('merge-glow');
    };
    onUp = (ev) => {
      if (ev.pointerId !== pointerId) return;
      clearTimeout(obj._lpT);
      try { node.releasePointerCapture(pointerId); } catch(_) {}
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      pointerId = null;
      obj.dragging = false;
      obj.vy = 0; obj.vx = 0;
      node.classList.remove('dragging');
      $$('.pomoji.merge-glow').forEach(n => n.classList.remove('merge-glow'));
      // v1.5.21: 長押しで詳細を開いた場合は burst しない
      if (obj._lpDetailOpened) { obj._lpDetailOpened = false; return; }
      // v1.3.0: 素早いタップ（250ms 以内）は moved 判定無視で必ず burst
      const dt = Date.now() - startTime;
      if (!moved || dt < 250) {
        dissolvePomoji(obj);
        return;
      }
      // v1.1.7: パーティカードにドロップ → そのメンバーに EXP（餌付け）
      // v1.3.2: フィールドの persistent ぽもじ（パーティ字）にもドロップで餌付け
      const prevPE = obj.el.style.pointerEvents;
      obj.el.style.pointerEvents = 'none';
      const dropEl = document.elementFromPoint(ev.clientX, ev.clientY);
      obj.el.style.pointerEvents = prevPE;
      const partyCard = dropEl?.closest('.party-card');
      if (partyCard && STATE.party && STATE.party.members) {
        const tidx = parseInt(partyCard.dataset.idx);
        if (!isNaN(tidx) && STATE.party.members[tidx]) {
          feedPomojiToMember(obj, tidx, partyCard);
          return;
        }
      }
      // v1.3.2: フィールドの persistent 字に重なってたら餌付け
      const dropPomojiEl = dropEl?.closest('.pomoji');
      if (dropPomojiEl && dropPomojiEl !== obj.el) {
        for (const q of livePomoji.values()) {
          if (q.el === dropPomojiEl && q.persistent) {
            const memIdx = (STATE.party?.members || []).findIndex(m => m.char === q.char);
            if (memIdx >= 0) {
              feedPomojiToMember(obj, memIdx, null);
              // 着地位置を視覚的に q に重ねる演出
              try {
                obj.el.style.transition = 'transform .3s ease, opacity .3s';
                obj.el.style.transform = `translate(${q.x - obj.x}px, ${q.y - obj.y}px) scale(.3)`;
                obj.el.style.opacity = '0';
                q.el.classList.add('persistent-bump');
                setTimeout(() => q.el?.classList.remove('persistent-bump'), 500);
              } catch(_) {}
              return;
            }
          }
        }
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

// v1.1.7: パーティ字に「餌付け」── 落とした字を吸い込ませて EXP
function feedPomojiToMember(p, idx, cardEl) {
  if (!STATE.party || !STATE.party.members[idx]) return;
  const member = STATE.party.members[idx];
  const rIdx = RARITY_TIERS.indexOf(p.rarity);
  // 通常タップの 2 倍、同字なら 4 倍
  const same = (member.char === p.char);
  const baseExp = Math.max(2, Math.pow(1.3, rIdx) * 3);
  const exp = same ? baseExp * 4 : baseExp * 2;
  addStock(p.char);
  // EXP 反映
  member.exp = (member.exp || 0) + exp;
  let s = 0;
  if (member.exp >= effectiveExpForLevel(member.level + 1) && !isAtRarityCap(member)) {
    member.exp -= effectiveExpForLevel(member.level + 1);
    member.level += 1;
    onLevelUp(member, idx);
  }
  STATE.stats.totalExp = (STATE.stats.totalExp || 0) + exp;
  invalidateAggCache();
  saveState();
  // 視覚：吸い込まれる演出
  if (cardEl) {
    const r = cardEl.getBoundingClientRect();
    const dx = (r.left + r.width/2) - (p.x + SIZE/2);
    const dy = (r.top + r.height/2) - (p.y + SIZE/2);
    p.el.style.transition = 'transform .35s cubic-bezier(.4,1.4,.5,1), opacity .35s ease';
    p.el.style.transform = `translate(${dx}px, ${dy}px) scale(.2)`;
    p.el.style.opacity = '0';
    cardEl.classList.add('fed-flash');
    setTimeout(() => cardEl.classList.remove('fed-flash'), 600);
    spawnXpFloat(r.left + r.width/2, r.top, exp, p.rarity);
  }
  try { playSFX(same ? 'merge' : 'pop'); } catch(_) {}
  if (same) try { toast(` 同字餌付け：${p.char} → ${member.char} EXP ×4`, p.rarity); } catch(_) {}
  setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); renderParty(); }, 380);
}

// v1.2.6: 消える字の上に乗ってる settled 字を即時解除 → 自然落下
// v1.5.20: 地中埋まり防止 ── 全 settled ぽもじを現在の地面まで持ち上げ
function clampSettledToGround() {
  try {
    const H = window.innerHeight, W = window.innerWidth;
    const groundY = H - SIZE - LEDGE_THICKNESS;
    if (!livePomoji) return;
    for (const p of livePomoji.values()) {
      if (!p.settled) continue;
      if (p.y > groundY) { p.y = groundY; p.settledY = groundY; }
      if (p.x < 0) { p.x = 0; p.settledX = 0; }
      if (p.x > W - SIZE) { p.x = W - SIZE; p.settledX = W - SIZE; }
      if (p.el) { p.el.style.top = p.y + 'px'; p.el.style.left = p.x + 'px'; }
    }
  } catch(_) {}
}

function unsettleAbove(deadP) {
  if (!deadP || !livePomoji) return;
  for (const other of livePomoji.values()) {
    if (other === deadP) continue;
    if (other.persistent || other.rising || !other.settled) continue;
    const dx = Math.abs(other.x - deadP.x);
    const dy = deadP.y - other.y;
    if (dx < SIZE * 0.95 && dy > 0 && dy < SIZE * 3.2) {
      other.settled = false;
      other.settledX = null;
      other.settledY = null;
      other.el?.classList.remove('settled');
      other.vy = 0.5;
    }
  }
}

function dissolvePomoji(p) {
  // v1.0.1: パーティ字（persistent）── タップで一時消滅＋大EXP＋タグ別バフ＋20秒後に再スポーン
  if (p.persistent) {
    const rarity = p.rarity;
    const rIdx = RARITY_TIERS.indexOf(rarity);
    const exp = Math.max(5, Math.pow(1.3, rIdx) * 12);
    awardExpToParty(p.char, exp) || _orphanExp(exp);
    spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
    playSFX('pop');
    triggerPartyBuff(p.char, rarity);
    // v1.3.3: 派手な金光フラッシュ（タップが効いたことを明示）
    try {
      const flash = document.createElement('div');
      flash.style.cssText = `position:fixed; left:${p.x - 20}px; top:${p.y - 20}px;
        width:${SIZE + 40}px; height:${SIZE + 40}px;
        border-radius:50%; pointer-events:none; z-index:9999;
        background:radial-gradient(circle, rgba(255,217,107,.7) 0%, rgba(255,150,80,.4) 40%, transparent 70%);
        animation:persistTapFlash .55s ease-out forwards;`;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
    } catch(_) {}
    p.el.classList.add('dissolve');
    p.el.classList.add('burst');  // 二重で burst CSS も走らせる
    const oldChar = p.char;
    const oldRarity = p.rarity;
    try { unsettleAbove(p); } catch(_) {}
    setTimeout(() => { p.el?.remove(); livePomoji.delete(p.id); }, 500);
    // 20 秒後に同じ字を再スポーン（パーティから消えてなければ）
    setTimeout(() => {
      if (!STATE.party || !STATE.party.members.some(m => m.char === oldChar)) return;
      if (Array.from(livePomoji.values()).some(x => x.char === oldChar && x.persistent)) return;
      const codex = window.KANJI_CODEX || [];
      const k = codex.find(c => (c.char || c.c) === oldChar) || { char: oldChar, c: oldChar, rarity: oldRarity };
      const W = window.innerWidth;
      const x = Math.random() * (W - SIZE);
      spawnPomoji({ kanji: k, x, persistent: true });
    }, 20000);
    return;
  }
  // v1.0.9: タップ → 即「弾けて EXP」に戻す（rising 経路は休憩時のみ）
  const rarity = p.rarity;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const powerMul = p.stats ? (0.8 + 0.1 * p.stats.power) : 1;
  let exp = Math.max(1, Math.round(Math.pow(1.3, rIdx) * 3 * powerMul));
  // v1.5.47: 絵文字特有効果
  if (p.isEmoji) {
    if ('🔥💥⚡☄🌋'.includes(p.char)) { exp *= 2; spawnLevelUpPoof(p.x + SIZE/2, p.y + SIZE/2, '★12'); }
    else if ('✨🌟💫⭐🌠'.includes(p.char)) { exp *= 3; spawnLevelUpPoof(p.x + SIZE/2, p.y + SIZE/2, '★14'); }
    else if ('💰💎💴💵🪙'.includes(p.char)) { exp *= 4; addStock(p.char); addStock(p.char); }
    else if ('💀☠👻'.includes(p.char)) { exp = Math.max(1, Math.floor(exp * 0.5)); }  // 不吉
    else if ('🍎🍐🍊🍌🍉🍇🍓🍑🥭🍍🍒🍕🍔🍣🍦🍰'.includes(p.char)) { addStock(p.char); addStock(p.char); }
    else if ('💧🌊💦☔'.includes(p.char)) {
      // 周囲の同字を引き寄せ
      for (const q of livePomoji.values()) {
        if (q.id === p.id || q.persistent || !q.isEmoji) continue;
        const dx = q.x - p.x, dy = q.y - p.y;
        if (dx*dx + dy*dy < 200*200) { q.vx += dx > 0 ? -2 : 2; q.vy -= 2; }
      }
    }
  }
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
  addStock(p.char);
  playSFX('pop');
  // v1.2.6: 上に乗ってる字を即時解除（重力反映）
  try { unsettleAbove(p); } catch(_) {}
  // 弾け演出：burst クラス（強い拡大+消滅）
  p.el.classList.add('burst');
  setTimeout(() => { p.el.remove(); livePomoji.delete(p.id); }, 400);
}

// v1.0.2: 効果セルタップで小 EXP 獲得（クールダウン 1.5 秒・グレード比例）
let _epTapCooldown = {};
function tapEffectCell(it, e) {
  const now = Date.now();
  const key = it.lbl;
  if (_epTapCooldown[key] && now - _epTapCooldown[key] < 1500) return;
  _epTapCooldown[key] = now;
  const base = it.grade === 'strong' ? 50 : it.grade === 'weak' ? 15 : 3;
  const lv = isPartyChosen() ? partyHeroLevel() : 1;
  const exp = Math.floor(base * (1 + Math.log10(1 + lv)));
  if (isPartyChosen() && STATE.party.members[STATE.party.hero]) {
    const hero = STATE.party.members[STATE.party.hero];
    awardExpToParty(hero.char, exp) || _orphanExp(exp);
    try {
      const r = e?.currentTarget?.getBoundingClientRect();
      if (r) spawnXpFloat(r.left + r.width/2, r.top + r.height/2, exp, hero.rarity);
    } catch(_) {}
  }
  try { playSFX('pop'); } catch(_) {}
}

// v1.0.1: パーティタップ時の一時バフ（30秒）── タグから決定
// _tempBuffs: [{ type, until, src }]
let _tempBuffs = [];
const PARTY_TAP_BUFFS = {
  '禅':    { type:'gravity',  mul:0.7,  label:'禅の沈黙：重力 -30%（30秒）',  aura:'zen' },
  '仏教':  { type:'gravity',  mul:0.7,  label:'仏の余韻：重力 -30%（30秒）',  aura:'zen' },
  '神字':  { type:'evo',      add:0.20, label:'神の祝福：進化加速 +20%（30秒）', aura:'zen' },
  '武':    { type:'drop',     add:2,    label:'武の構え：粒 +2（30秒）',       aura:'fire' },
  '七大罪':{ type:'drop',     add:2,    label:'罪の連動：粒 +2（30秒）',       aura:'fire' },
  '七徳':  { type:'exp',      mul:1.5,  label:'徳の輝き：EXP ×1.5（30秒）',    aura:'nature' },
  '思想':  { type:'exp',      mul:1.5,  label:'思索の刃：EXP ×1.5（30秒）',    aura:'zen' },
  '自然':  { type:'merge',    mul:1.4,  label:'自然の呼応：融合範囲 ×1.4（30秒）', aura:'nature' },
  '花':    { type:'merge',    mul:1.4,  label:'花の調和：融合範囲 ×1.4（30秒）', aura:'nature' },
  '水':    { type:'gravity',  mul:0.8,  label:'水の流れ：重力 -20%（30秒）',   aura:'water' },
  '雨':    { type:'gravity',  mul:0.8,  label:'雨の沈静：重力 -20%（30秒）',   aura:'water' },
  '時':    { type:'stock',    mul:1.5,  label:'時の堆積：ストック ×1.5（30秒）', aura:'zen' },
};
const PARTY_TAP_DURATION = 30000;
function triggerPartyBuff(c, rarity) {
  const tags = (typeof getCharTags === 'function') ? (getCharTags(c) || []) : [];
  let chosen = null;
  for (const t of tags) {
    if (PARTY_TAP_BUFFS[t]) { chosen = { tag:t, ...PARTY_TAP_BUFFS[t] }; break; }
  }
  if (!chosen) {
    // 既定：レア度比例の小 EXP バフ
    const rIdx = RARITY_TIERS.indexOf(rarity);
    chosen = { tag:'-', type:'exp', mul: 1 + 0.05 * Math.max(1, rIdx), label:`小覚醒：EXP ×${(1 + 0.05 * Math.max(1, rIdx)).toFixed(2)}（30秒）`, aura:null };
  }
  const buff = { ...chosen, until: Date.now() + PARTY_TAP_DURATION, src:c };
  // 同タイプ既存があれば置き換え（重複防止）
  _tempBuffs = _tempBuffs.filter(b => b.type !== buff.type);
  _tempBuffs.push(buff);
  invalidateAggCache();
  try { toast(buff.label, rarity); } catch(_) {}
  if (buff.aura) {
    document.body.classList.add('combo-aura-' + buff.aura);
    setTimeout(() => document.body.classList.remove('combo-aura-' + buff.aura), 3000);
  }
}
function getActiveTempBuffs() {
  const now = Date.now();
  _tempBuffs = _tempBuffs.filter(b => b.until > now);
  return _tempBuffs;
}
function applyTempBuffs(agg) {
  const buffs = getActiveTempBuffs();
  for (const b of buffs) {
    if (b.type === 'exp'     && b.mul) agg.expMul        *= b.mul;
    if (b.type === 'gravity' && b.mul) agg.gravityMul    *= b.mul;
    if (b.type === 'merge'   && b.mul) agg.mergeRadiusMul*= b.mul;
    if (b.type === 'stock'   && b.mul) agg.stockExpMul    = (agg.stockExpMul || 1) * b.mul;
    if (b.type === 'drop'    && b.add) agg.dropCountAdd  += b.add;
    if (b.type === 'evo'     && b.add) agg.evoDiscount   += b.add;
  }
  agg.activeTempBuffs = buffs;
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
    // 「ぽ文字漢」コンボ成立時は ×1.3
    const agg = aggregatePartyPerks();
    const stockMul = (agg && agg.stockExpMul) ? agg.stockExpMul : 1.0;
    // v1.4.2: stock EXP を更に控えめに（旧 0.3 → 0.15）
    const expPerStock = Math.max(1, Math.round((rIdx + 1) * 0.15 * stockMul));
    for (let i = 0; i < STATE.party.members.length; i++) {
      const m = STATE.party.members[i];
      m.exp = (m.exp || 0) + expPerStock;
      let s = 0;
      if (m.exp >= effectiveExpForLevel(m.level + 1) && !isAtRarityCap(m)) {
        m.exp -= effectiveExpForLevel(m.level + 1);
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
          invalidateAggCache();  // 効力上がるので再計算
        }
        // 基本系 perk（haste/feather 等）：どんな字でも 0.5 ストック分育つ（端数累積）
        else if (!perk.tag) {
          STATE.perkLevels[pid] = (STATE.perkLevels[pid] || 0) + 0.5;
          // 0.5 ずつなので Lv 整数境界を跨いだ時だけ invalidate
          const oldLv = Math.floor((STATE.perkLevels[pid] - 0.5));
          const newLv = Math.floor(STATE.perkLevels[pid]);
          if (newLv > oldLv) invalidateAggCache();
        }
      }
    }
  }
  // PC 右パネルの所有字を即時更新
  if (isPCMode()) refreshPCPanels();
}

// 特性の実効レベル ── 最低 Lv1（取得した瞬間に Lv1）／ストックで +1, +2 ...
function perkLv(perkId){
  const raw = (STATE.perkLevels && STATE.perkLevels[perkId]) || 0;
  return Math.floor(raw) + 1;
}
// 特性の Lv を「効力倍率」に変換（v6 / 2026-05-17 インクリメンタル化）
// 多項式インフレ：Lv 1 = 1、Lv 10 ≈ 1700、Lv 100 ≈ 290万、Lv 1000 ≈ 50億
// 序盤は base 係数 1〜3% に抑え、終盤は天井知らずに伸びる
function perkPower(perkId){
  const lv = perkLv(perkId);
  return Math.pow(lv, 3.23);  // Lv 1000 = 1000^3.23 ≈ 5.0e9
}

// 大きい数の和語表記（万・億・兆・京・垓・𥝱 ・ 無量大数）
function fmtBig(n){
  if (!isFinite(n)) return '∞';
  if (n < 1e3)  return n.toFixed(2);
  if (n < 1e4)  return n.toFixed(0);
  if (n < 1e8)  return (n / 1e4).toFixed(1) + '万';
  if (n < 1e12) return (n / 1e8).toFixed(1) + '億';
  if (n < 1e16) return (n / 1e12).toFixed(1) + '兆';
  if (n < 1e20) return (n / 1e16).toFixed(1) + '京';
  if (n < 1e24) return (n / 1e20).toFixed(1) + '垓';
  return (n / 1e24).toFixed(1) + '𥝱';
}

// 浮上する「+N XP」表示（ジューシー要素）
// v1.5.34: 通常落下は数字なしの光だけ。大きい EXP（コンボ等）は数字も
function spawnXpFloat(x, y, amount, rarity, showNumber) {
  const field = $('#play-field');
  if (!field) return;
  const rIdx = RARITY_TIERS.indexOf(rarity);
  const node = el('div', {
    class: `xp-glow rarity-${rIdx + 1}`,
    style: { left: x + 'px', top: y + 'px' }
  }, showNumber ? `+${amount}` : '');
  field.appendChild(node);
  setTimeout(() => node.remove(), 900);
}
// レベルアップ ぽわーん演出
function spawnLevelUpPoof(x, y, rarity) {
  const field = $('#play-field');
  if (!field) return;
  const rIdx = RARITY_TIERS.indexOf(rarity || '★1');
  const node = el('div', {
    class: `lvup-poof rarity-${rIdx + 1}`,
    style: { left: x + 'px', top: y + 'px' }
  });
  field.appendChild(node);
  setTimeout(() => node.remove(), 1100);
}

function _orphanExp(exp) {
  // v1.5.51: パーティ全員に均等分配＋リーダー優遇 ── バランス改善
  if (!STATE.party || !STATE.party.members?.length) return;
  const members = STATE.party.members;
  const heroIdx = STATE.party.hero || 0;
  const perMember = Math.max(1, Math.floor(exp / 2 / members.length));  // 半分を均等分配
  const heroBonus = Math.floor(exp / 2);                                  // 残り半分はリーダー
  members.forEach((m, idx) => {
    if (!m) return;
    const give = perMember + (idx === heroIdx ? heroBonus : 0);
    m.exp += give;
    STATE.stats.totalExp = (STATE.stats.totalExp || 0) + give;
    if (m.exp >= effectiveExpForLevel(m.level + 1) && !isAtRarityCap(m)) {
      m.exp -= effectiveExpForLevel(m.level + 1);
      m.level += 1;
      onLevelUp(m, idx);
    }
  });
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
  const exp = Math.max(1, Math.pow(1.3, rIdx) * 10 * Math.pow(2, newLv - 1));
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
    if (newLv >= 2) toast(` 進化 ${target.char} Lv${newLv}`, src.rarity);
    playSFX('merge');
  }

  // 連鎖（chain rare 特性）：mergeLevel 3 以上で全員 Lv+1（大爆発）
  const agg = aggregatePartyPerks();
  if (agg.chain && newLv >= 3 && STATE.party) {
    for (let i = 0; i < STATE.party.members.length; i++) {
      STATE.party.members[i].level += 1;
      onLevelUp(STATE.party.members[i], i);
    }
    toast(`連鎖 大爆発！ 全員 Lv+1`, '★8');
  }
  // 神撃（legendary_burst）：10% で EXP × 10
  if (agg.megaBurst && Math.random() < agg.megaBurst) {
    const bonus = exp * 9;  // 既に exp 入れてるので追加で 9倍 = 合計 10倍
    awardExpToParty(target.char, bonus) || _orphanExp(bonus);
    toast(` 神撃 EXP ×10`, '★16');
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
    toast(` 同質共振「${shared}」XP+50%`);
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
// 連続日数 streak ── サイクル完了時に呼ぶ
// v10n（2026-05-18）── ストリークフリーズ：10日ごとに +1（最大3）、
//   1日休んでも自動消費で連続維持。何十年遊べるための「許容」設計。
function updateStreak() {
  if (!STATE.streak) STATE.streak = { current: 0, longest: 0, lastDate: null };
  if (typeof STATE.streakFreezes !== 'number') STATE.streakFreezes = 0;
  const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
  const last = STATE.streak.lastDate;
  if (last === today) {
    return;  // 既に今日カウント済
  }
  const prevTier = Math.floor((STATE.streak.current || 0) / 10);
  if (last) {
    const lastTime = new Date(last + 'T12:00:00').getTime();
    const todayTime = new Date(today + 'T12:00:00').getTime();
    const diffDays = Math.round((todayTime - lastTime) / 86400000);
    if (diffDays === 1) {
      // 連続 → +1
      STATE.streak.current += 1;
    } else if (diffDays === 2 && STATE.streakFreezes > 0) {
      // 1日休み + フリーズあり → 自動消費して連続継続
      STATE.streakFreezes -= 1;
      STATE.streak.current += 1;
      toast(`🛡 ストリークフリーズを 1 消費 ── 連続 ${STATE.streak.current} 日 継続`, '★13');
      playSFX('milestone');
    } else if (diffDays > 1) {
      // 飛び日 → reset to 1
      STATE.streak.current = 1;
    }
  } else {
    STATE.streak.current = 1;
  }
  // 10日刻みでフリーズ +1（最大 3）
  const newTier = Math.floor(STATE.streak.current / 10);
  if (newTier > prevTier && STATE.streakFreezes < 3) {
    STATE.streakFreezes += 1;
    toast(`🛡 ストリークフリーズ +1（保有 ${STATE.streakFreezes}/3）`, '★14');
    playSFX('milestone');
  }
  if (STATE.streak.current > STATE.streak.longest) {
    STATE.streak.longest = STATE.streak.current;
  }
  STATE.streak.lastDate = today;
  saveState();
  // 連続のマイルストーンで toast
  const cur = STATE.streak.current;
  if (cur === 3 || cur === 7 || cur === 14 || cur === 30 || cur % 30 === 0) {
    toast(`連続 ${cur} 日 達成`, '★12');
    playSFX('milestone');
  }
}

// v1.2.4: リーダーは常に先頭（index 0）── promote = 先頭へ移動
function promoteToHero(idx) {
  if (!STATE.party || !STATE.party.members) return;
  if (idx === 0) { toast('★ 既にリーダーです（先頭）'); return; }
  const newHero = STATE.party.members[idx];
  if (!newHero) return;
  const oldHero = STATE.party.members[0];
  // guardian 特性の付け替え
  if (oldHero && oldHero.perks) oldHero.perks = oldHero.perks.filter(p => p !== 'guardian');
  if (!newHero.perks) newHero.perks = [];
  if (!newHero.perks.includes('guardian')) newHero.perks.push('guardian');
  // 先頭へ移動
  const item = STATE.party.members.splice(idx, 1)[0];
  STATE.party.members.unshift(item);
  STATE.party.hero = 0;  // 常に 0 固定
  invalidateAggCache();
  saveState();
  renderParty();
  updateProgressPill();
  toast(`★ ${newHero.char} がリーダーに（先頭へ）`, newHero.rarity);
  playSFX('unlock');
}

// v1.1.3: パーティカード横ドラッグで並び替え（|dx|<8 はタップ扱い）
function attachPartyCardReorder(card, idx) {
  let startX = 0, startY = 0, moved = false, pointerId = null;
  let placeholder = null;
  const onMove = (ev) => {
    if (ev.pointerId !== pointerId) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!moved && Math.abs(dx) + Math.abs(dy) > 8) {
      moved = true;
      card.classList.add('reordering');
    }
    if (moved) {
      ev.preventDefault();
      card.style.transform = `translate(${dx}px, ${dy*0.3}px)`;
      card.style.zIndex = '999';
    }
  };
  const onUp = (ev) => {
    if (ev.pointerId !== pointerId) return;
    try { card.releasePointerCapture(pointerId); } catch(_) {}
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);
    if (!moved) {
      openPartyMemberAction(idx);
      return;
    }
    card.classList.remove('reordering');
    card.style.transform = '';
    card.style.zIndex = '';
    // v1.1.6: 挿入並び替え（swap でなく差し込み）
    // v1.2.0: ドラッグ中カードを一時的にクリックスルー化して下のカードを取得
    const dropX = ev.clientX, dropY = ev.clientY;
    const prevPE = card.style.pointerEvents;
    card.style.pointerEvents = 'none';
    const target = document.elementFromPoint(dropX, dropY);
    card.style.pointerEvents = prevPE;
    const targetCard = target?.closest('.party-card');
    if (targetCard && targetCard !== card) {
      const targetIdx = parseInt(targetCard.dataset.idx);
      if (!isNaN(targetIdx) && STATE.party && STATE.party.members[targetIdx]) {
        movePartyMember(idx, targetIdx);
        return;
      }
    }
  };
  card.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointerId = e.pointerId;
    try { card.setPointerCapture(pointerId); } catch(_) {}
    startX = e.clientX;
    startY = e.clientY;
    moved = false;
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}
// v1.1.6/v1.2.4: 挿入並び替え ── from を to の位置に差し込む。リーダーは常に先頭
function movePartyMember(from, to) {
  if (!STATE.party || !STATE.party.members) return;
  const arr = STATE.party.members;
  if (from === to || !arr[from] || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
  const item = arr.splice(from, 1)[0];
  arr.splice(to, 0, item);
  // v1.2.4: 先頭に来た字に guardian を付ける（旧先頭からは外す）
  STATE.party.hero = 0;
  arr.forEach((m, i) => {
    if (!m.perks) m.perks = [];
    if (i === 0) {
      if (!m.perks.includes('guardian')) m.perks.push('guardian');
    } else {
      m.perks = m.perks.filter(p => p !== 'guardian');
    }
  });
  invalidateAggCache();
  saveState();
  renderParty();
  updateProgressPill();
  // v1.2.5: 画面の persistent も X 座標を並び順に整列
  try {
    const W = window.innerWidth;
    const n = arr.length;
    arr.forEach((m, i) => {
      const target = Math.round(((i + 1) / (n + 1)) * W) - SIZE/2;
      for (const p of livePomoji.values()) {
        if (p.persistent && p.char === m.char) {
          p.x = target;
          if (p.settled) p.settledX = target;
          if (p.el) p.el.style.left = target + 'px';
          break;
        }
      }
    });
  } catch(_) {}
  const newLeader = arr[0]?.char;
  if (to === 0) toast(`★ ${newLeader} がリーダーに ─ 順番一致でコンボ ×1.4`);
  else toast('🔀 並び替え（順番一致でコンボ ×1.4）');
}
// 旧 swap は互換のため残す
function swapPartyMembers(a, b) { movePartyMember(a, b); }

function renderParty() {
  try { applyWeatherMode(); } catch(_) {}
  const bar = $('#party-bar');
  if (!isPartyChosen()) {
    bar.classList.add('empty');
    bar.innerHTML = '<button class="party-pick-cta" id="party-pick-cta"> リーダー（最初の一字）を選んで始める</button>';
    $('#party-pick-cta').onclick = () => openPartyPicker();
    return;
  }
  bar.classList.remove('empty');
  bar.innerHTML = '';
  STATE.party.members.forEach((m, idx) => {
    const isHero = (idx === STATE.party.hero);
    const stage = evolutionStage(m.level);
    const styleClass = EVO_STYLE[stage] || 'kai';
    const needExp = effectiveExpForLevel(m.level + 1);
    const tierIdx = RARITY_TIERS.indexOf(m.rarity);
    const perkLabels = (m.perks || []).map(pid => PERKS[pid]?.name).filter(Boolean).join('・');
    const card = el('div', {
      class: `party-card rarity-${tierIdx + 1}${isHero ? ' hero' : ''}${stage > 0 ? ' evo-' + stage : ''}`,
      dataset: { idx, evo: stage, lv: m.level },
      title: `${m.char} Lv.${m.level} / 特性: ${perkLabels}\nタップ=操作 / 横ドラッグ=並び替え（先頭がリーダー・順番でコンボ強化）`,
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
    // v1.1.3: 横ドラッグで並び替え、|dx|<8 はタップ扱い
    attachPartyCardReorder(card, idx);
    bar.appendChild(card);
  });
  // 空きスロット（最大 4 体まで）
  const emptySlots = 4 - STATE.party.members.length;
  for (let i = 0; i < emptySlots; i++) {
    const slot = el('div', {
      class: 'party-card empty-slot',
      title: '図鑑で字をタップ → ★リーダー設定 / ＋仲間追加',
      onclick: () => {
        toast('図鑑 で字をタップ → ★リーダーに設定 か ＋仲間に加える');
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
  // v10n9: 現効果パネルを描画
  try { renderEffectsPanel(); } catch(_) {}
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
  // v1.0.8: 認知負荷削減 ── トップ 3 効果だけ表示、それ以上は「+N」省略
  const cb = getComboBonus();
  const allChips = [];
  const addChip = (icon, label, color, weight) => allChips.push({ icon, label, color, weight });
  // v1.1.4: ×表記をやめて +N% / -N% / +N個 に
  const _pct = (m) => '+' + Math.round((m - 1) * 100) + '%';
  // v1.5.5: 漢字シンボルに統一
  if (cb.expMul && cb.expMul > 1.01)         addChip('経', `${_pct(cb.expMul)}`,   '#ffd86b', cb.expMul);
  if (cb.gravityMul && cb.gravityMul < 0.99) addChip('重', `-${Math.round((1-cb.gravityMul)*100)}%`, '#a0e0ff', 1/cb.gravityMul);
  if (cb.mergeRadiusMul && cb.mergeRadiusMul > 1.01) addChip('結', `${_pct(cb.mergeRadiusMul)}`, '#c0e0a0', cb.mergeRadiusMul);
  if (cb.dropCountAdd)                       addChip('粒', `+${cb.dropCountAdd}`, '#9be0ff', 1 + cb.dropCountAdd * 0.2);
  if (cb.stockExpMul && cb.stockExpMul > 1.01) addChip('蓄', `${_pct(cb.stockExpMul)}`, '#d4b6ff', cb.stockExpMul);
  if (cb.evoBoost && cb.evoBoost > 0.005)    addChip('進', `+${Math.round(cb.evoBoost*100)}%`, '#ffe0a0', 1 + cb.evoBoost);
  allChips.sort((a, b) => b.weight - a.weight);
  const effChips = allChips.slice(0, 3);
  const hidden = allChips.length - effChips.length;
  const top = el('div', { class:'cb-top' },
    el('span', { class:'cb-top-label' }, `${combos.length}`),
    ...effChips.map(c => el('span', {
      class:'cb-chip', style:{ color: c.color, borderColor: c.color + '55', background: c.color + '15' }
    }, c.icon + ' ' + c.label)),
    hidden > 0 ? el('span', { class:'cb-chip-more', title:'右上の効果パネルで全て確認' }, `+${hidden}`) : null,
  );
  bar.appendChild(top);
  // 下段：コンボ語（最大 6 件）
  const bot = el('div', { class:'cb-bot' });
  combos.slice(0, 6).forEach(r => {
    const rIdx = RARITY_TIERS.indexOf(r.rarity);
    // v1.2.5: 並び順一致なら ☆×1.4 バッジ
    const ordered = (typeof comboOrderMatch === 'function') && comboOrderMatch(r);
    bot.appendChild(el('span', {
      class: `cb-bar-item rarity-${rIdx + 1}${r.special ? ' cb-special' : ''}${ordered ? ' cb-ordered' : ''}`,
      title: (r.desc || r.word) + (ordered ? '\n☆ 並び順一致 ×1.4' : ''),
      onclick: () => showYojiDetail(r),
    }, (r.special ? '' : '') + r.word + (ordered ? ' ☆' : '')));
  });
  if (combos.length > 6) {
    bot.appendChild(el('span', { class:'cb-bar-more' }, `他 ${combos.length - 6}`));
  }
  bar.appendChild(bot);
}

// パーティメンバーの操作（タップで開く）
function openPartyMemberAction(idx) {
  if (!STATE.party) return;
  const m = STATE.party.members[idx];
  if (!m) return;
  const isHero = (idx === STATE.party.hero);
  // 特性表示 ─ 名前 + Lv + 効果説明 + v10n9 進捗バー（あと N で Lv up）
  const perkRows = (m.perks || []).map(pid => {
    const p = PERKS[pid];
    if (!p) return null;
    const lv = perkLv(pid);
    const isRare = p.rare;
    // 進捗：raw 累計の小数部分が次 Lv までの分子
    const raw = (STATE.perkLevels && STATE.perkLevels[pid]) || 0;
    const frac = raw - Math.floor(raw);
    const pct  = Math.max(0, Math.min(100, frac * 100));
    const remain = (1 - frac).toFixed(2);
    return el('div', {
      class: 'map-perk-row' + (isRare ? ' rare' : ''),
      style:{
        padding:'6px 8px', margin:'4px 0',
        background: isRare ? 'rgba(240,212,138,.12)' : 'rgba(255,255,255,.04)',
        border:'1px solid ' + (isRare ? 'rgba(240,212,138,.45)' : 'rgba(255,255,255,.08)'),
        borderRadius:'6px',
        display:'flex', flexDirection:'column', gap:'3px',
      }
    },
      el('div', { style:{ display:'flex', justifyContent:'space-between', fontSize:'.85rem', fontWeight:700 } },
        el('span', {}, (isRare ? ' ' : '') + p.name),
        el('span', { style:{ color:'var(--gold)', fontFamily:'JetBrains Mono, monospace', fontSize:'.75rem' } },
          `Lv.${lv}`
        ),
      ),
      el('div', { style:{ fontSize:'.7rem', color:'var(--ink-mute)', lineHeight:1.3 } }, p.desc || ''),
      // 進捗バー
      el('div', { style:{ height:'4px', background:'rgba(0,0,0,.3)', borderRadius:'2px', overflow:'hidden', marginTop:'2px' } },
        el('div', { style:{ width: pct + '%', height:'100%',
          background: isRare ? 'linear-gradient(90deg,#f0d48a,#ffe9a0)' : 'linear-gradient(90deg,#87ceeb,#a8e0ff)',
          transition:'width .3s'
        } })
      ),
      el('div', { style:{ fontSize:'.62rem', color:'var(--ink-mute)', textAlign:'right', fontFamily:'JetBrains Mono, monospace' } },
        `あと ${remain} で Lv.${lv + 1}`
      ),
    );
  }).filter(Boolean);

  // v10n9: リーダー昇格プレビュー（仲間枠のみ）
  let leaderPreview = null;
  if (!isHero) {
    const prev = previewLeaderSwap(idx);
    if (prev) {
      const arrow = prev.lvDelta > 0 ? '↑' : prev.lvDelta < 0 ? '↓' : '→';
      const lvColor = prev.lvDelta > 0 ? '#a8e0ff' : prev.lvDelta < 0 ? '#ffb888' : 'var(--ink-mute)';
      leaderPreview = el('div', {
        style:{
          margin:'6px 0', padding:'6px 8px',
          background:'rgba(135,206,235,.10)',
          border:'1px solid rgba(135,206,235,.30)',
          borderRadius:'6px', fontSize:'.72rem', color:'#cfe6ff', lineHeight:1.4,
        }
      },
        el('div', { style:{ fontWeight:700, marginBottom:'2px', color:'#87ceeb' } }, '★ リーダー昇格プレビュー'),
        el('div', {}, `現: ${prev.current.char} Lv.${prev.current.lv}（${prev.current.rarity}）`),
        el('div', {}, `候補: ${prev.candidate.char} Lv.${prev.candidate.lv}（${prev.candidate.rarity}）`),
        el('div', { style:{ color:lvColor } }, `Lv差 ${arrow}${Math.abs(prev.lvDelta)} ・ 落下プール tier がリーダーLv基準で変化`),
        el('div', { style:{ color:'var(--ink-mute)' } }, `🛡 守護特性は新リーダーに移譲`),
      );
    }
  }

  $$('.member-action-pop').forEach(e => e.remove());

  const buttons = [];
  if (isHero) {
    buttons.push(el('div', { class:'mapop-leader-badge', style:{ padding:'8px', textAlign:'center', color:'var(--gold)', fontWeight:700, fontSize:'.85rem' } }, '★ 現在のリーダー'));
  } else {
    // v10n3: タップで即リーダー昇格（スマホ操作性）
    buttons.push(el('button', {
      class:'btn-primary mapop-btn',
      style:{ background:'linear-gradient(135deg,#f0d48a,#d4a84a)', color:'#1a1208', fontWeight:700 },
      onclick: () => {
        promoteToHero(idx);
        $$('.member-action-pop').forEach(e => e.remove());
      },
    }, '★ この字をリーダーに'));
    // v1.4.5: ベンチ送り
    buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
      sendToBench(idx);
      $$('.member-action-pop').forEach(e => e.remove());
    }}, '🪑 ベンチへ（特性のみ残る）'));
    buttons.push(el('button', { class:'btn-danger mapop-btn', onclick: () => {
      if (confirm(`${m.char} をパーティから外しますか？\n（Lv.${m.level} は保持、再加入で復活）`)) {
        invalidateAggCache();
        // v1.3.18: 外す前に Lv 保存
        preserveMemberLevels([m]);
        STATE.party.members.splice(idx, 1);
        if (idx < STATE.party.hero) STATE.party.hero -= 1;
        saveState();
        renderParty();
        toast(`${m.char} を解除しました`);
      }
      $$('.member-action-pop').forEach(e => e.remove());
    }}, '解除する'));
  }
  buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
    toast('図鑑で字をタップ → ★リーダー設定 / ＋仲間追加');
    $$('.member-action-pop').forEach(e => e.remove());
    openCodex();
  }}, '図鑑を開く'));
  buttons.push(el('button', { class:'btn-secondary mapop-btn', onclick: () => {
    $$('.member-action-pop').forEach(e => e.remove());
  }}, '閉じる'));

  const pop = el('div', { class: `member-action-pop rarity-${RARITY_TIERS.indexOf(m.rarity) + 1}` },
    el('div', { class:'map-head' },
      el('div', { class:'map-char' }, m.char),
      el('div', { class:'map-meta' },
        el('div', { class:'map-name' }, isHero ? '★ リーダー' : 'パーティ字'),
        el('div', { class:'map-lv' }, `Lv.${m.level}`),
        el('div', { class:'map-perks-rich', style:{ marginTop:'8px' } }, ...perkRows),
      )
    ),
    leaderPreview,
    el('div', { class:'map-buttons' }, ...buttons)
  );
  document.body.appendChild(pop);
}

// v1.3.18: 字メンバー復元／保存（charLevels）
function buildMemberFor(c, rarity, isLeader) {
  if (!STATE.charLevels) STATE.charLevels = {};
  const stored = STATE.charLevels[c];
  if (stored && typeof stored.level === 'number') {
    // 既存 Lv/EXP/特性を復元
    const perks = Array.isArray(stored.perks) ? stored.perks.slice() : pickInherentPerks(c, rarity);
    if (isLeader && !perks.includes('guardian')) perks.push('guardian');
    if (!isLeader) perks.indexOf('guardian') >= 0 && perks.splice(perks.indexOf('guardian'), 1);
    return { char: c, rarity, level: stored.level, exp: stored.exp || 0, perks };
  }
  // 新規
  const perks = pickInherentPerks(c, rarity);
  if (isLeader && !perks.includes('guardian')) perks.push('guardian');
  return { char: c, rarity, level: 1, exp: 0, perks };
}
// v1.4.5: ベンチ（サブパーティ）操作
const BENCH_CAP = 10;
function sendToBench(idx) {
  if (!STATE.party || !STATE.party.members) return;
  if (!Array.isArray(STATE.party.bench)) STATE.party.bench = [];
  if (STATE.party.bench.length >= BENCH_CAP) {
    toast(`ベンチ枠 ${BENCH_CAP} 個まで`);
    return;
  }
  const m = STATE.party.members[idx];
  if (!m) return;
  preserveMemberLevels([m]);
  if (m.perks) m.perks = m.perks.filter(p => p !== 'guardian');
  STATE.party.members.splice(idx, 1);
  STATE.party.bench.push(m);
  // 先頭にいなくなった場合 hero=0 の guardian を付け直す
  if (STATE.party.members[0]) {
    if (!STATE.party.members[0].perks) STATE.party.members[0].perks = [];
    if (!STATE.party.members[0].perks.includes('guardian')) STATE.party.members[0].perks.push('guardian');
  }
  STATE.party.hero = 0;
  invalidateAggCache();
  saveState();
  renderParty();
  toast(`🪑 ${m.char} ベンチへ（特性は乗ったまま）`);
}
function callFromBench(benchIdx) {
  if (!STATE.party || !STATE.party.bench) return;
  if (STATE.party.members.length >= 4) {
    toast('メイン枠 4 体 ── 先に外して');
    return;
  }
  const m = STATE.party.bench[benchIdx];
  if (!m) return;
  STATE.party.bench.splice(benchIdx, 1);
  STATE.party.members.push(m);
  invalidateAggCache();
  saveState();
  renderParty();
  toast(`★ ${m.char} メインに復帰`);
}

function preserveMemberLevels(members) {
  if (!STATE.charLevels) STATE.charLevels = {};
  if (!members) return;
  for (const m of members) {
    if (!m || !m.char) continue;
    STATE.charLevels[m.char] = {
      level: m.level || 1,
      exp: m.exp || 0,
      perks: Array.isArray(m.perks) ? m.perks.filter(p => p !== 'guardian') : [],
    };
  }
}

// 字をパーティに加える
function recruitToParty(c, rarity) {
  if (!STATE.party) return false;
  if (STATE.party.members.length >= 4) {
    toast('パーティ枠は 4 体まで');
    return false;
  }
  // v1.5.8: 同字許可（所有数 stock[c] を上限に）
  if (!STATE.stock) STATE.stock = {};
  const existingCount = STATE.party.members.filter(m => m.char === c).length;
  const owned = STATE.stock[c] || 0;
  if (existingCount >= Math.max(1, owned)) {
    toast(`${c} の所有数（${owned}）以上はパーティに入れられません`);
    return false;
  }
  invalidateAggCache();
  // v1.3.18: 過去 Lv 復元
  const m = buildMemberFor(c, rarity, false);
  STATE.party.members.push(m);
  saveState();
  renderParty();
  const perkName = PERKS[m.perks[0]]?.name || '—';
  toast(m.level > 1 ? `${c} Lv.${m.level} 復帰` : `${c} が仲間になった！特性「${perkName}」`);
  return true;
}

// ★ リーダー設定 ── 図鑑／編成からの一発切り替え（v10n3）
// 既にパーティ内 → 昇格 / 空きあり → 加入→昇格 / 枠満 → 旧リーダーと入替（旧リーダーは仲間に降格）
function setAsLeader(c, rarity) {
  if (!STATE.party || !STATE.party.members) return false;
  const idx = partyContainsChar(c);
  if (idx >= 0) {
    promoteToHero(idx);
    return true;
  }
  if (STATE.party.members.length < 4) {
    if (!recruitToParty(c, rarity)) return false;
    const newIdx = partyContainsChar(c);
    if (newIdx >= 0) promoteToHero(newIdx);
    return true;
  }
  // v1.3.18: 枠満タン → 旧リーダーは charLevels に保存して退場、新リーダーは過去 Lv 復元
  const oldHero = STATE.party.members[0];
  if (!confirm(`パーティが満員です。\n旧リーダー ${oldHero.char}（Lv.${oldHero.level}）をベンチに戻して ${c} をリーダーにしますか？\n（旧リーダーの Lv は保持されます）`)) {
    return false;
  }
  preserveMemberLevels([oldHero]);  // 退場前に保存
  invalidateAggCache();
  STATE.party.members[0] = buildMemberFor(c, rarity, true);
  STATE.party.hero = 0;
  saveState();
  renderParty();
  updateProgressPill();
  toast(`★ ${c} が新しいリーダーに（${oldHero.char} と入れ替え）`, rarity);
  playSFX('unlock');
  return true;
}

// ═══════════════════════════════════════════════════════════════
//  スリープモード ── 画面を休める（タイマーは止めない）
// ═══════════════════════════════════════════════════════════════
let _sleepTickId = 0;
function openSleep() {
  const ov = $('#sleep-overlay');
  if (!ov) return;
  ov.classList.add('show');
  ov.setAttribute('aria-hidden', 'false');
  updateSleepClock();
  clearInterval(_sleepTickId);
  _sleepTickId = setInterval(updateSleepClock, 500);
  // body にクラスを当てて他演出を軽量化（将来用）
  document.body.classList.add('sleep-mode');
}
function closeSleep() {
  const ov = $('#sleep-overlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.setAttribute('aria-hidden', 'true');
  clearInterval(_sleepTickId);
  _sleepTickId = 0;
  document.body.classList.remove('sleep-mode');
}
function updateSleepClock() {
  const cl = $('#sleep-clock');
  const lb = $('#sleep-mode-label');
  if (!cl) return;
  // 走行中ならタイマー残時間、停止中なら現在時刻
  if (STATE.mode === 'work' || STATE.mode === 'rest') {
    const remain = Math.max(0, Math.ceil((STATE.phaseEnd - Date.now()) / 1000));
    cl.textContent = fmtTime(remain);
    if (lb) lb.textContent = STATE.mode === 'work' ? '集 中' : '休 憩';
  } else {
    const d = new Date();
    cl.textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
    if (lb) lb.textContent = '休 む';
  }
}

// ═══════════════════════════════════════════════════════════════
// トースト ＋ 軽い通知 ── スタック表示（最大 4 個まで重ねる）
// ═══════════════════════════════════════════════════════════════
function toast(msg, rarity=null) {
  let container = $('#toast-stack');
  if (!container) {
    container = el('div', { id:'toast-stack', class:'toast-stack' });
    document.body.appendChild(container);
  }
  // 同一メッセージが直前にあれば抑制（重複防止）
  const existing = container.querySelector('.toast.show');
  if (existing && existing.dataset.msg === msg) return;
  const rIdx = rarity ? RARITY_TIERS.indexOf(rarity) : -1;
  const item = el('div', {
    class: 'toast' + (rIdx >= 0 ? ' rarity-' + (rIdx + 1) : ''),
    dataset: { msg },
  }, msg);
  container.appendChild(item);
  // 多すぎる時は古いものから消す
  const all = Array.from(container.querySelectorAll('.toast'));
  if (all.length > 4) {
    const oldest = all[0];
    oldest.classList.remove('show');
    setTimeout(() => oldest.remove(), 200);
  }
  // フェードイン
  requestAnimationFrame(() => item.classList.add('show'));
  // 自動消去
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 250);
  }, 2400);
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
  const setsEl = $('#ts-sets-target');
  if (setsEl) setsEl.value = STATE.timer.setsTarget || 0;
  // v10n17: クイックピル active 同期＋クリック反映
  const cur = STATE.timer.setsTarget || 0;
  $$('.ts-sets-pill').forEach(p => {
    p.classList.toggle('active', parseInt(p.dataset.sets) === cur);
    if (!p._bound) {
      p.addEventListener('click', () => {
        const v = parseInt(p.dataset.sets) || 0;
        if (setsEl) setsEl.value = v;
        $$('.ts-sets-pill').forEach(x => x.classList.toggle('active', x === p));
      });
      p._bound = true;
    }
  });
  // 直接入力時はピルの active をクリア（リテラル一致するものだけ active 残す）
  if (setsEl && !setsEl._boundSync) {
    setsEl.addEventListener('input', () => {
      const v = parseInt(setsEl.value) || 0;
      $$('.ts-sets-pill').forEach(x => x.classList.toggle('active', parseInt(x.dataset.sets) === v));
    });
    setsEl._boundSync = true;
  }
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
  const setsEl = $('#ts-sets-target');
  const sets = setsEl ? Math.max(0, Math.min(20, parseInt(setsEl.value)||0)) : 0;
  const prevTarget = STATE.timer.setsTarget || 0;
  STATE.timer.setsTarget = sets;
  // セット目標を変更した時は進捗をリセット（混乱防止）
  if (sets !== prevTarget) STATE.timer.setsDone = 0;
  saveState();
  if (STATE.mode === 'idle') setTextWithLvBand("timer-text", fmtTime(work));
  closeTimerSettings();
  toast(sets > 0 ? `時間を変更（目標 ${sets} セット）` : '時間を変更しました');
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
      const needExp = effectiveExpForLevel(m.level + 1);
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

// v1.4.2: 全データリセット（2 段階確認）
function resetAllData() {
  if (!confirm('⚠ すべてのデータを消去します。\n本当に始めから？（書き出しはお済みですか？）')) return;
  const phrase = 'リセット';
  const typed = prompt(`本当にリセットする場合は「${phrase}」と入力：`, '');
  if (typed !== phrase) { toast('キャンセル（合言葉が違う）'); return; }
  try {
    localStorage.removeItem(LS_KEY);
    if (_yomuChannel) { try { _yomuChannel.close(); } catch(_) {} }
    toast(' リセット完了 ── リロードします');
    setTimeout(() => location.reload(), 800);
  } catch(e) {
    alert('リセット失敗：' + (e.message || ''));
  }
}

// v1.3.15: 日記入力の検証（不足表示）と取込
function updateDiaryInputStatus() {
  const input = document.getElementById('diary-input');
  const status = document.getElementById('diary-input-status');
  if (!input || !status) return;
  const text = input.value || '';
  if (!text) { status.textContent = ''; status.className = 'wr-input-status'; return; }
  if (!STATE.stock) STATE.stock = {};
  // 編集中に既に使ってる字 + 入力欄の字を仮消費
  const tempUsed = {};
  for (const it of _currentWriting) tempUsed[it.char] = (tempUsed[it.char] || 0) + 1;
  const missing = {};
  for (const c of text) {
    if (c === '\n' || c === ' ' || c === '　') continue;
    tempUsed[c] = (tempUsed[c] || 0) + 1;
    const stockN = STATE.stock[c] || 0;
    if (tempUsed[c] > stockN) missing[c] = (missing[c] || 0) + 1;
  }
  const missingChars = Object.keys(missing);
  if (missingChars.length === 0) {
    status.textContent = `✓ 全 ${[...text].filter(c=>c.trim()).length} 字 OK`;
    status.className = 'wr-input-status ok';
  } else {
    status.innerHTML = '⚠ 不足: ' + missingChars.map(c => `<span class="missing-char">${c}×${missing[c]}</span>`).join(' ');
    status.className = 'wr-input-status missing';
  }
}
// v1.5.12: 普通入力（ぽもじ消費なし）
function importDiaryInputPlain() {
  const input = document.getElementById('diary-input');
  if (!input || !input.value) { toast('入力欄が空'); return; }
  const text = input.value;
  if (!_stockRarityCache) _buildStockRarityCache();
  const newItems = [];
  for (const c of text) {
    if (c === '\n' || c === ' ' || c === '　') continue;
    const rarity = _stockRarityCache.get(c) || '★1';
    newItems.push({ char: c, rarity, plain: true });
  }
  if (newItems.length === 0) { toast('取込なし'); return; }
  _currentWriting.push(...newItems);
  input.value = '';
  updateDiaryInputStatus();
  renderWritingsModal();
  toast(`${newItems.length} 字 そのまま取込（消費なし）`);
}

function importDiaryInput() {
  const input = document.getElementById('diary-input');
  if (!input || !input.value) { toast('入力欄が空'); return; }
  if (!STATE.stock) STATE.stock = {};
  const text = input.value;
  const tempUsed = {};
  for (const it of _currentWriting) tempUsed[it.char] = (tempUsed[it.char] || 0) + 1;
  const newItems = [];
  const missing = [];
  for (const c of text) {
    if (c === '\n' || c === ' ' || c === '　') continue;
    tempUsed[c] = (tempUsed[c] || 0) + 1;
    if (tempUsed[c] > (STATE.stock[c] || 0)) {
      missing.push(c);
      continue;
    }
    if (!_stockRarityCache) _buildStockRarityCache();
    newItems.push({ char: c, rarity: _stockRarityCache.get(c) || '★1' });
  }
  if (missing.length > 0) {
    if (!confirm(`不足字 ${missing.length} 個（${[...new Set(missing)].join('')}）はスキップして取り込みますか？`)) return;
  }
  if (newItems.length === 0) { toast('取り込める字なし'); return; }
  _currentWriting.push(...newItems);
  input.value = '';
  updateDiaryInputStatus();
  renderWritingsModal();
  toast(`⬇ ${newItems.length} 字 取込`);
}

// v1.5.7: 字列にカスタム lvband を適用（タイマー数字や任意テキストに）
function setTextWithLvBand(elOrId, s) {
  const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
  if (!el) return;
  if (el.dataset.lastText === s) return;
  el.dataset.lastText = s;
  el.innerHTML = '';
  for (const ch of s) {
    const span = document.createElement('span');
    const band = (typeof charLvBand === 'function') ? charLvBand(ch) : '';
    span.className = 'tx-glyph' + (band ? ' ' + band : '');
    span.textContent = ch;
    el.appendChild(span);
  }
}

// v1.3.6: 字のパーティ Lv からエフェクトクラスを決定
// v1.5.13: 字ごとの表示スタイル設定（auto/plain/forced bands）
function charLvBand(char) {
  // 個別スタイル override（plain=なし、forced=指定 band）
  const pref = STATE.charDisplayStyle?.[char];
  if (pref === 'plain') return '';
  if (pref && pref.startsWith('lvband-')) return pref;
  // 自動：パーティ内の Lv + charLevels に保存された Lv 両方見る
  let lv = 0;
  if (STATE.party?.members) {
    const m = STATE.party.members.find(mb => mb.char === char);
    if (m) lv = m.level || 0;
  }
  if (!lv && STATE.charLevels?.[char]?.level) lv = STATE.charLevels[char].level;
  if (lv >= 1000) return 'lvband-divine';
  if (lv >= 300)  return 'lvband-cosmic';
  if (lv >= 100)  return 'lvband-master';
  if (lv >= 30)   return 'lvband-adept';
  if (lv >= 10)   return 'lvband-novice';
  return '';
}
function setCharDisplayStyle(char, style) {
  if (!STATE.charDisplayStyle) STATE.charDisplayStyle = {};
  if (style === 'auto') delete STATE.charDisplayStyle[char];
  else STATE.charDisplayStyle[char] = style;
  saveState();
}

// v1.3.5: 字→レア度 Map キャッシュ（41,890 codex filter を解消）
let _stockRarityCache = null;
function _buildStockRarityCache() {
  const codex = window.KANJI_CODEX || [];
  const m = new Map();
  for (const k of codex) {
    const c = k.char || k.c;
    if (c) m.set(c, k.rarity || '★1');
  }
  _stockRarityCache = m;
}

// v1.3.4: 日記＆俳句タブ
let _writingsTab = 'diary';
let _haikuRows = [[], [], []];  // 5/7/5 行ごと
function switchWritingsTab(name) {
  _writingsTab = name;
  $$('.wr-tab').forEach(t => t.classList.toggle('active', t.dataset.wrTab === name));
  $$('.wr-pane').forEach(p => p.style.display = p.dataset.wrPane === name ? '' : 'none');
  if (name === 'diary')   renderWritingsModal();
  if (name === 'haiku')   renderHaiku();
  if (name === 'history') renderWritingsHistory();
}
function openWritings() {
  if (!STATE.writings) STATE.writings = [];
  // 日付表示
  const dEl = $('#diary-date');
  if (dEl) {
    const d = new Date();
    dEl.textContent = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
  }
  // タブバインド（1 回だけ）
  $$('.wr-tab').forEach(t => {
    if (!t._bound) { t.addEventListener('click', () => switchWritingsTab(t.dataset.wrTab)); t._bound = true; }
  });
  // v1.3.15: 日記の入力欄
  const diaryInput = $('#diary-input');
  const diaryImport = $('#diary-import');
  if (diaryInput && !diaryInput._bound) {
    diaryInput.addEventListener('input', updateDiaryInputStatus);
    diaryInput._bound = true;
  }
  const diaryImportPlain = $('#diary-import-plain');
  if (diaryImportPlain && !diaryImportPlain._bound) {
    diaryImportPlain.addEventListener('click', importDiaryInputPlain);
    diaryImportPlain._bound = true;
  }
  if (diaryImport && !diaryImport._bound) {
    diaryImport.addEventListener('click', importDiaryInput);
    diaryImport._bound = true;
  }
  // 俳句ボタン
  const hsave = $('#haiku-save');
  if (hsave && !hsave._bound) { hsave.addEventListener('click', saveHaiku); hsave._bound = true; }
  const hclr = $('#haiku-clear');
  if (hclr && !hclr._bound) { hclr.addEventListener('click', () => {
    // v1.3.7: データ消失防止 ── 字が入ってる時のみ確認
    const used = _haikuRows.reduce((s, r) => s + r.length, 0);
    if (used > 0 && !confirm(`5-7-5 に ${used} 字入っています。クリアしますか？`)) return;
    _haikuRows = [[],[],[]]; renderHaiku();
  }); hclr._bound = true; }
  const hund = $('#haiku-undo');
  if (hund && !hund._bound) { hund.addEventListener('click', () => {
    for (let i = 2; i >= 0; i--) if (_haikuRows[i].length > 0) { _haikuRows[i].pop(); break; }
    renderHaiku();
  }); hund._bound = true; }
  const hshr = $('#haiku-share');
  if (hshr && !hshr._bound) { hshr.addEventListener('click', shareHaiku); hshr._bound = true; }
  switchWritingsTab('diary');
  $('#writings-modal').classList.add('show');
}

const HAIKU_CAP = [5, 7, 5];
function renderHaiku() {
  for (let i = 0; i < 3; i++) {
    const row = $('#haiku-row-' + (i+1));
    const cnt = $('#haiku-count-' + (i+1));
    if (!row || !cnt) continue;
    row.innerHTML = '';
    _haikuRows[i].forEach((it, j) => {
      const rIdx = RARITY_TIERS.indexOf(it.rarity);
      const band = charLvBand(it.char);
      row.appendChild(el('span', {
        class:`wc-slot rarity-${rIdx + 1}${band ? ' ' + band : ''}`,
        onclick: () => { _haikuRows[i].splice(j, 1); renderHaiku(); },
      }, it.char));
    });
    cnt.textContent = _haikuRows[i].length + '/' + HAIKU_CAP[i];
    cnt.style.color = _haikuRows[i].length === HAIKU_CAP[i] ? '#ffd86b' : 'var(--ink-mute)';
  }
  // プール（v1.3.5: O(stock_size) で軽量）
  const pool = $('#haiku-pool');
  if (!pool) return;
  pool.innerHTML = '';
  if (!STATE.stock) STATE.stock = {};
  if (!_stockRarityCache) _buildStockRarityCache();
  const tempUsed = {};
  for (const row of _haikuRows) for (const it of row) tempUsed[it.char] = (tempUsed[it.char] || 0) + 1;
  const owned = [];
  for (const c of Object.keys(STATE.stock)) {
    if ((STATE.stock[c]||0) - (tempUsed[c]||0) <= 0) continue;
    owned.push({ char:c, c, rarity: _stockRarityCache.get(c) || '★1' });
  }
  owned.sort((a,b) => RARITY_TIERS.indexOf(a.rarity) - RARITY_TIERS.indexOf(b.rarity));
  if (owned.length === 0) {
    pool.appendChild(el('div', { class:'wc-empty' }, '所有字なし ── タイマーで集めよう'));
    return;
  }
  owned.forEach(k => {
    const c = k.char || k.c;
    const rIdx = RARITY_TIERS.indexOf(k.rarity);
    const remain = (STATE.stock[c]||0) - (tempUsed[c]||0);
    pool.appendChild(el('div', {
      class:`wp-cell rarity-${rIdx + 1}`,
      title:`${c}（残 ${remain}）`,
      onclick: () => {
        // 上から順に詰める
        for (let i = 0; i < 3; i++) {
          if (_haikuRows[i].length < HAIKU_CAP[i]) {
            _haikuRows[i].push({ char:c, rarity:k.rarity });
            renderHaiku();
            return;
          }
        }
        toast('5-7-5 すべて埋まってます');
      },
    }, c, el('span', { class:'wp-count' }, remain)));
  });
}
function isHaikuComplete() {
  return _haikuRows[0].length === 5 && _haikuRows[1].length === 7 && _haikuRows[2].length === 5;
}
function haikuText() {
  return _haikuRows.map(r => r.map(x => x.char).join('')).join(' ／ ');
}
function consumeHaikuStock() {
  if (!STATE.stock) STATE.stock = {};
  for (const row of _haikuRows) for (const it of row) {
    STATE.stock[it.char] = Math.max(0, (STATE.stock[it.char] || 0) - 1);
  }
}
function saveHaiku() {
  if (!isHaikuComplete()) { toast('5-7-5 を埋めて'); return; }
  consumeHaikuStock();
  const chars = _haikuRows.flat().map(it => ({ char: it.char, rarity: it.rarity }));
  const text = haikuText();
  const date = new Date().toISOString().slice(0,10);
  const entry = { text, genre: '俳句', date, public: true, chars };
  STATE.writings = STATE.writings || [];
  STATE.writings.push(entry);
  saveState();
  // v1.3.7: 俳句も読雨に放流（日記と整合）
  try { publishToYomu(entry); } catch(_) {}
  toast('俳句を保存');
  _haikuRows = [[],[],[]];
  renderHaiku();
}
async function shareHaiku() {
  if (!isHaikuComplete()) { toast('5-7-5 を埋めて'); return; }
  const text = haikuText();
  const url = 'https://rainybrainch.github.io/pomojikan/';
  const full = `ぽもじかんで詠んだ俳句\n\n${text}\n\n#ぽもじかん #俳句\n${url}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'ぽもじかんの俳句', text: full });
    } else {
      await navigator.clipboard.writeText(full);
      toast(' クリップボードにコピー');
    }
  } catch(e) {
    try { await navigator.clipboard.writeText(full); toast(' コピー'); } catch(_) {}
  }
}
function renderWritingsHistory() {
  const hist = $('#wh-list');
  if (!hist) return;
  hist.innerHTML = '';
  const writings = (STATE.writings || []).slice().reverse();
  if (writings.length === 0) {
    hist.appendChild(el('div', { class:'wc-empty' }, 'まだ何も保存していない'));
    return;
  }
  writings.forEach((w, i) => {
    const idx = (STATE.writings.length - 1) - i;
    hist.appendChild(el('div', { class:'wh-item' },
      el('div', { class:'wh-text' }, w.text),
      el('div', { class:'wh-meta' },
        el('span', {}, w.genre || '─'),
        el('span', {}, w.date || ''),
        w.public ? el('span', { style:{ color:'#ffd86b' } }, '公開可') : el('span', { style:{ color:'var(--ink-mute)' } }, '非公開'),
      ),
      el('button', {
        class:'wh-del', title:'削除',
        onclick: () => {
          if (!confirm('削除？')) return;
          STATE.writings.splice(idx, 1);
          saveState();
          renderWritingsHistory();
        }
      }, '×'),
    ));
  });
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
  if (n === 17) return ' 俳句（5-7-5）';
  if (n === 31) return ' 短歌（5-7-5-7-7）';
  if (n >= 8 && n <= 16) return `短文（${n}字 ／ 俳句まで -${17-n}）`;
  if (n >= 18 && n <= 30) return `詩（${n}字 ／ 短歌まで -${31-n}）`;
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
      const band = charLvBand(item.char);
      slots.appendChild(el('span', {
        class: `wc-slot rarity-${rIdx + 1}${band ? ' ' + band : ''}`,
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
  // v1.3.5: Object.keys(STATE.stock) ベースで O(stock_size) に
  // 旧：41,890 codex 全件 filter → 重い
  if (!_stockRarityCache) _buildStockRarityCache();
  const owned = [];
  for (const c of Object.keys(STATE.stock)) {
    const stockN = STATE.stock[c] || 0;
    const usedN  = tempUsed[c] || 0;
    if (stockN - usedN <= 0) continue;
    const rarity = _stockRarityCache.get(c) || '★1';
    owned.push({ char: c, c: c, rarity });
  }
  if (owned.length === 0) {
    const totalStock = Object.values(STATE.stock).reduce((a,b)=>a+b,0);
    const msg = totalStock === 0
      ? '所有している字がまだありません ── タイマーで字を消すと所有数 +1（5分寿命でも吸収時 +1）'
      : '使える字を全部使い切りました。クリアまたは保存してください。';
    pool.appendChild(el('div', { class:'wc-empty' }, msg));
  } else {
    owned.sort((a,b) => {
      const dr = RARITY_TIERS.indexOf(a.rarity) - RARITY_TIERS.indexOf(b.rarity);
      if (dr !== 0) return dr;
      return (STATE.stock[b.char]||0) - (STATE.stock[a.char]||0);
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
  // v1.5.12: plain（そのまま取込）字はストック消費しない
  for (const item of _currentWriting) {
    if (item.plain) continue;
    STATE.stock[item.char] = Math.max(0, (STATE.stock[item.char] || 0) - 1);
    if (STATE.stock[item.char] === 0) delete STATE.stock[item.char];
  }
  STATE.writings.push({ text, genre, date, chars: _currentWriting.slice() });
  saveState();
  toast(`日記に保存：${genre}「${text}」`);
  // 読雨連携：BroadcastChannel 'rainybrain' で文章を放流（読雨側で受信可）
  publishToYomu({ text, genre, date, chars: _currentWriting.slice() });
  _currentWriting = [];
  renderWritingsModal();
  refreshPCPanels();
}

// 読雨 (YOMU) との接続 ── 同オリジン Channel API
// RBAI 公式構想：保存文章を読雨「刻む」モーダルに自動投入
let _yomuChannel = null;
function _ensureYomuChannel() {
  if (!_yomuChannel && 'BroadcastChannel' in window) {
    _yomuChannel = new BroadcastChannel('rainybrain');
    // v1.3.8: 他アプリ（5本柱）からのイベント受信 → ぽもじボーナス
    _yomuChannel.addEventListener('message', _onRainybrainMessage);
  }
  return _yomuChannel;
}
// v1.3.8: 他アプリから受け取ったイベントをぽもじ降下／EXP に翻訳
function _onRainybrainMessage(e) {
  const msg = e?.data;
  if (!msg || msg.source === 'pomojikan') return;  // 自分発のは無視
  try {
    // 読雨の読書セッション完了 → 分数 / 5 個の字を降らせる（最大 10 個）
    if (msg.event === 'reading_session' || msg.event === 'yomu_session_end') {
      const min = Math.max(0, Math.round(Number(msg.payload?.minutes) || 0));
      const drops = Math.min(10, Math.floor(min / 5));
      if (drops > 0 && STATE.mode === 'work') {
        for (let i = 0; i < drops; i++) setTimeout(() => spawnPomoji({}), i * 200);
        try { toast(` 読雨から ${drops} 字 降臨（読書 ${min} 分）`); } catch(_) {}
      }
    }
    // マネぼう／服牢365 のタスク完了 → リーダーに小 EXP ボーナス
    else if (msg.event === 'task_complete' || msg.event === 'manebou_task_done') {
      if (isPartyChosen()) {
        const hero = STATE.party.members[STATE.party.hero || 0];
        const exp = Math.max(10, Math.floor(50 * leaderLvMul()));
        awardExpToParty(hero.char, exp);
        try { spawnXpFloat(window.innerWidth/2, 80, exp, hero.rarity); } catch(_) {}
        try { toast(` 他アプリ達成 EXP +${exp}`); } catch(_) {}
      }
    }
    // 服牢365 の名言登録 → ★レア度ランダムの字を 1 粒
    else if (msg.event === 'fukurou365_quote_added' || msg.event === 'quote_added') {
      if (STATE.mode === 'work') setTimeout(() => spawnPomoji({}), 100);
      try { toast(' 服牢365 から 1 字 降臨'); } catch(_) {}
    }
    // 汎用：external_usage（任意アプリが稼働時間報告）
    else if (msg.event === 'external_usage') {
      const min = Math.max(0, Math.round(Number(msg.payload?.minutes) || 0));
      const drops = Math.min(15, Math.floor(min / 10));
      if (drops > 0 && STATE.mode === 'work') {
        for (let i = 0; i < drops; i++) setTimeout(() => spawnPomoji({}), i * 150);
        try { toast(`他アプリから ${drops} 字 降臨（${min} 分）`); } catch(_) {}
      }
    }
  } catch(_) {}
}
function _publishYomuEvent(event, payload) {
  try {
    const ch = _ensureYomuChannel();
    if (!ch) return;
    ch.postMessage({
      type: 'pomo',
      event,
      source: 'pomojikan',
      app: 'pomojikan',
      version: 'v30.7',
      payload,
      timestamp: new Date().toISOString(),
    });
  } catch (e) { /* 静かに無視 */ }
}
function publishToYomu(writing) {
  _publishYomuEvent('writing_saved', {
    text: writing.text,
    genre: writing.genre,
    date: writing.date,
    chars: writing.chars,
    hero_char: isPartyChosen() ? STATE.party.members[STATE.party.hero||0].char : null,
    user_id: STATE.userId || null,
  });
}

function applyPreset(idx) {
  const p = TIMER_PRESETS[idx];
  STATE.timer.workSec = p.work;
  STATE.timer.restSec = p.rest;
  STATE.timer.presetIdx = idx;
  saveState();
  if (STATE.mode === 'idle') setTextWithLvBand("timer-text", fmtTime(p.work));
  toast(`${p.label} に変更`);
}

// ═══════════════════════════════════════════════════════════════
// 図鑑
// ═══════════════════════════════════════════════════════════════
let codexFilter = { tier: 'all', season: 'all', script: 'all', onlySeen: false, onlyFavorite: false, query: '' };

// 文字種判定 ── Unicode 範囲ベース（41,890 字を瞬時に絞り込み）
const SCRIPT_RANGES = {
  hiragana:    [[0x3040, 0x309F]],
  katakana:    [[0x30A0, 0x30FF], [0x31F0, 0x31FF]],
  kanji:       [[0x4E00, 0x9FFF], [0x3400, 0x4DBF], [0xF900, 0xFAFF]],
  hangul:      [[0xAC00, 0xD7AF], [0x1100, 0x11FF], [0x3130, 0x318F]],
  greek:       [[0x0370, 0x03FF], [0x1F00, 0x1FFF]],
  cyrillic:    [[0x0400, 0x04FF], [0x0500, 0x052F]],
  arabic:      [[0x0600, 0x06FF], [0x0750, 0x077F]],
  hebrew:      [[0x0590, 0x05FF]],
  devanagari:  [[0x0900, 0x097F]],
  thai:        [[0x0E00, 0x0E7F]],
  tibetan:     [[0x0F00, 0x0FFF]],
  georgian:    [[0x10A0, 0x10FF], [0x2D00, 0x2D2F]],
  ethiopic:    [[0x1200, 0x137F], [0x2D80, 0x2DDF]],
  canadian:    [[0x1400, 0x167F]],
  runic:       [[0x16A0, 0x16FF]],
  ancient:     [[0x10000, 0x100FF], [0x10900, 0x1091F], [0x12000, 0x123FF], [0x13000, 0x1342F]],
};
function matchesScript(ch, scriptKey) {
  if (!scriptKey || scriptKey === 'all') return true;
  const ranges = SCRIPT_RANGES[scriptKey];
  if (!ranges) return true;
  const cp = ch.codePointAt(0);
  for (const [lo, hi] of ranges) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}
function openCodex() {
  $('#codex-modal').classList.add('show');
  setupCodexCollapsibles();
  renderCodexPyramid();
  renderCodexFilterSummary();
  applyCodexLegendMask();
  applyCodexTabMask();
  applyCodexSeasonBadges();
  // タイトルに総数バッジ
  const titleEl = $('#codex-modal .modal-title');
  if (titleEl && !titleEl.querySelector('.modal-title-badge')) {
    const total = (window.KANJI_CODEX || []).length + (window.YOJI_RECIPES || []).length;
    titleEl.appendChild(el('span', {
      class:'modal-title-badge',
      style:{
        marginLeft:'8px',
        fontSize:'.65rem',
        fontFamily:"'JetBrains Mono', monospace",
        color:'var(--ink-mute)',
        fontWeight:400,
      },
    }, `(${total.toLocaleString()})`));
  }
  renderCodex();
}

// v1.5.2: ピラミッド可視化 ── ★1-16 の解放進捗を一目で
function renderCodexPyramid() {
  const cont = document.getElementById('codex-pyramid');
  if (!cont) return;
  cont.innerHTML = '';
  const currentTier = STATE.unlockedTier || 0;
  for (let i = RARITY_TIERS.length - 1; i >= 0; i--) {
    const tier = RARITY_TIERS[i];
    const ratio = tierSeenRatio(i);
    const pct = Math.round(ratio * 100);
    const unlocked = i <= currentTier;
    const isCurrent = i === currentTier;
    const widthPct = Math.max(15, 100 - i * 5);  // 上ほど狭い
    const step = document.createElement('div');
    step.className = 'pyramid-step' + (unlocked ? ' unlocked' : ' locked') + (isCurrent ? ' current' : '');
    step.style.width = widthPct + '%';
    step.innerHTML = `
      <span class="ps-tier">${unlocked ? tier : '？'}</span>
      <span class="ps-bar"><span class="ps-fill" style="width:${pct}%"></span></span>
      <span class="ps-pct">${unlocked ? pct + '%' : '×'}</span>
    `;
    if (isCurrent) {
      const here = document.createElement('span');
      here.className = 'ps-here';
      here.textContent = '◀ ここ';
      step.appendChild(here);
    }
    cont.appendChild(step);
  }
}

// v10n12: 凡例・文字種フィルタの折りたたみトグル
let _codexCollapsiblesSetup = false;
function setupCodexCollapsibles() {
  if (_codexCollapsiblesSetup) return;
  const legend = $('#codex-legend');
  const scripts = $('#codex-scripts');
  if (legend && !legend.querySelector('.codex-collapse-toggle')) {
    const t = el('button', {
      class:'codex-collapse-toggle',
      onclick: () => {
        legend.classList.toggle('collapsed');
        t.textContent = legend.classList.contains('collapsed') ? '▸ ★凡例（タップで展開）' : '▾ ★凡例';
      },
    }, '▸ ★凡例（タップで展開）');
    legend.insertBefore(t, legend.firstChild);
  }
  if (scripts && !scripts.querySelector('.codex-collapse-toggle')) {
    const t = el('button', {
      class:'codex-collapse-toggle',
      onclick: () => {
        scripts.classList.toggle('collapsed');
        t.textContent = scripts.classList.contains('collapsed') ? '▸ 🌏 文字種フィルタ' : '▾ 🌏 文字種フィルタ';
      },
    }, '▸ 🌏 文字種フィルタ');
    scripts.insertBefore(t, scripts.firstChild);
  }
  const reset = $('#codex-reset-filter');
  if (reset && !reset._bound) {
    reset.addEventListener('click', () => {
      codexFilter.tier = 'all';
      codexFilter.season = 'all';
      codexFilter.script = 'all';
      codexFilter.tag = null;
      codexFilter.query = '';
      codexFilter.onlySeen = false;
      codexFilter.onlyFavorite = false;
      const q = $('#codex-search'); if (q) q.value = '';
      const os = $('#codex-only-seen'); if (os) os.checked = false;
      const of = $('#codex-only-favorite'); if (of) of.checked = false;
      $$('.codex-tab').forEach(b => b.classList.toggle('active', b.dataset.tier === 'all'));
      $$('.codex-season').forEach(b => b.classList.toggle('active', b.dataset.season === 'all'));
      $$('.codex-script').forEach(b => b.classList.toggle('active', b.dataset.script === 'all'));
      renderCodex();
      renderCodexFilterSummary();
      toast('↺ フィルタ全解除');
    });
    reset._bound = true;
  }
  _codexCollapsiblesSetup = true;
}

function renderCodexFilterSummary() {
  const s = $('#codex-filter-summary');
  if (!s) return;
  const parts = [];
  if (codexFilter.season !== 'all') {
    const labels = { S1:'S1 字種', S2:'S2 漢字', S3:'S3 熟語', S4:'S4 四字熟語', S5:'S5 昭和', S6:'S6 令和', S7:'S7 未来', S8:'S8 世界', PERKS:' 特性' };
    parts.push(labels[codexFilter.season] || codexFilter.season);
  }
  if (codexFilter.tier !== 'all') parts.push('★' + (parseInt(codexFilter.tier) + 1));
  if (codexFilter.script !== 'all') parts.push('🌏 ' + codexFilter.script);
  if (codexFilter.tag) parts.push('# ' + codexFilter.tag);
  if (codexFilter.query) parts.push('🔍 "' + codexFilter.query + '"');
  if (codexFilter.onlySeen) parts.push('発見済のみ');
  if (codexFilter.onlyFavorite) parts.push('★');
  if (parts.length === 0) { s.style.display = 'none'; s.textContent = ''; }
  else { s.style.display = ''; s.textContent = ' ' + parts.join(' × '); }
}

// v1.0.3: ヘルプ＋ツアー統合モーダル
function openHelpPlusTour() {
  let modal = $('#helpplus-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'helpplus-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'380px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, '❓ ヘルプ・ツアー'),
          el('button', { class:'modal-close', onclick: () => modal.classList.remove('show') }, '×'),
        ),
        el('div', { style:{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:'10px' } },
          el('button', { class:'btn-primary', style:{ minHeight:'48px' },
            onclick: () => { modal.classList.remove('show'); openTour(true); } },
            '🎓 新機能ツアー（5 ページ）'),
          el('button', { class:'btn-secondary', style:{ minHeight:'48px' },
            onclick: () => { modal.classList.remove('show'); $('#help-modal')?.classList.add('show'); } },
            ' 操作ガイド'),
          el('a', { href:'changelog.html', target:'_blank', rel:'noopener',
            style:{ marginTop:'4px', textAlign:'center', color:'var(--ink-mute)', fontSize:'.78rem' } },
            ' 変更履歴'),
        ),
      ),
    );
    document.body.appendChild(modal);
  }
  modal.classList.add('show');
}

// v10n16: 新機能ツアー（5 ページに圧縮）
const CURRENT_VERSION = 'v1.0.0';
const TOUR_PAGES = [
  { emoji:'★', title:'リーダー制', body:'「主人公」→「リーダー」に。図鑑で字をタップ → ★ボタンで一発切替。編 編成プリセットで名前付き保存（最大12個）。' },
  { emoji:'', title:'コンボ × 4,546 + パッシブ 16', body:'全熟語に固有効果と物語。さらに「100字発見」「30日連続」等のマイルストーンで パッシブが恒久発動。3層（特性×コンボ×パッシブ）で育つ。' },
  { emoji:'', title:'物理＆タイマー UI', body:'コインプッシャー型：字が押されて棚から落ちると自動EXP化＝重くならない。タイマー円の縁をなぞって分数設定、長押しで休憩時間。' },
  { emoji:'', title:'現効果パネル & HUD', body:'パーティ下に EXP / 重力 / 融合 / 粒+ / ストック / 進化加速が常時表示。画面左上 HUD で次の推薦コンボも見える。図鑑は折りたたみで見やすく。' },
  { emoji:'', title:'画面外でも動く', body:'メニュー右上 ≡ →「 小窓タイマー」で他アプリ作業中も時計が前面に。Wake Lock で画面が暗くならず、 通知でサイクル完了も逃さない。 データ管理で別端末引継ぎも。' },
];
function openTour(force=false) {
  if (!force && STATE.lastSeenVersion === CURRENT_VERSION) return;
  let modal = $('#tour-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'tour-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'460px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, '🎓 新機能ツアー'),
          el('button', { class:'modal-close', onclick: () => { modal.classList.remove('show'); STATE.lastSeenVersion = CURRENT_VERSION; saveState(); } }, '×'),
        ),
        el('div', { id:'tour-body', style:{ padding:'16px 20px', minHeight:'200px' } }),
        el('div', { style:{ padding:'8px 20px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px' } },
          el('button', { class:'btn-secondary', id:'tour-prev', style:{ minWidth:'72px' } }, '◀'),
          el('div', { id:'tour-dots', style:{ display:'flex', gap:'4px' } }),
          el('button', { class:'btn-primary', id:'tour-next', style:{ minWidth:'72px' } }, ''),
        ),
      ),
    );
    document.body.appendChild(modal);
  }
  let page = 0;
  function render() {
    const body = $('#tour-body');
    const p = TOUR_PAGES[page];
    body.innerHTML = '';
    body.appendChild(el('div', { style:{ fontSize:'3rem', textAlign:'center', marginBottom:'8px' } }, p.emoji));
    body.appendChild(el('div', { style:{ fontSize:'1.3rem', fontWeight:700, textAlign:'center', marginBottom:'10px' } }, p.title));
    body.appendChild(el('div', { style:{ fontSize:'.88rem', lineHeight:1.55, color:'var(--ink-mute)' } }, p.body));
    const dots = $('#tour-dots'); dots.innerHTML = '';
    TOUR_PAGES.forEach((_, i) => dots.appendChild(el('span', {
      style:{ width:'8px', height:'8px', borderRadius:'50%',
        background: i === page ? 'var(--gold)' : 'rgba(255,255,255,.2)' }
    })));
    $('#tour-prev').disabled = (page === 0);
    $('#tour-next').textContent = (page === TOUR_PAGES.length - 1) ? '✓ 始める' : '';
  }
  $('#tour-prev').onclick = () => { if (page > 0) { page--; render(); } };
  $('#tour-next').onclick = () => {
    if (page < TOUR_PAGES.length - 1) { page++; render(); }
    else {
      modal.classList.remove('show');
      STATE.lastSeenVersion = CURRENT_VERSION;
      saveState();
      toast('🎓 ツアー完了 ── いつでもメニューから再生可');
    }
  };
  page = 0;
  render();
  modal.classList.add('show');
}

// v10n10: データ管理モーダル（既存 export/import を一カ所に）
function openDataManager() {
  let modal = $('#data-manager-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'data-manager-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'480px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, ' データ管理'),
          el('button', { class:'modal-close', onclick: () => modal.classList.remove('show') }, '×'),
        ),
        el('div', { style:{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:'14px' } },
          el('div', { id:'dm-status', style:{
            padding:'8px 10px', borderRadius:'6px',
            background:'rgba(135,206,235,.08)', fontSize:'.8rem', color:'var(--ink-mute)'
          } }),
          el('button', { class:'btn-primary', style:{ padding:'10px', minHeight:'48px' },
            onclick: () => { exportStateJSON(); setTimeout(renderDataManagerStatus, 200); } },
            '📤 すべてのデータを書き出す（JSON）'),
          el('div', { style:{ fontSize:'.72rem', color:'var(--ink-mute)', lineHeight:1.4 } },
            'ぽもじかん/育成/設定/プリセット/お気に入り を全て JSON 1 ファイルに。Google Drive・iCloud 等に置いて何十年でも残せる'),
          el('button', { class:'btn-secondary', style:{ padding:'10px', minHeight:'48px' }, onclick: importStateJSON },
            '📥 書き出した JSON から復元'),
          el('div', { style:{ fontSize:'.72rem', color:'var(--ink-mute)', lineHeight:1.4 } },
            '⚠ 現在のデータは上書きされます。心配なら先に書き出してから'),
          el('div', { style:{ fontSize:'.7rem', color:'var(--ink-mute)', borderTop:'1px solid rgba(255,255,255,.06)', paddingTop:'10px', lineHeight:1.4 } },
            ' 別の端末で続きを遊ぶ：1) ここで書き出し  2) 別端末で同じアプリ開く  3) ここから復元'),
          el('button', { class:'btn-danger', style:{ padding:'10px', minHeight:'48px', marginTop:'10px' },
            onclick: resetAllData },
            '⚠ すべてのデータをリセット（始めから）'),
          el('div', { style:{ fontSize:'.7rem', color:'#ffb070', lineHeight:1.4 } },
            ' 注意：パーティ・字 Lv・ストック・プリセット・記録 全て消去。先に書出してから推奨'),
        ),
      ),
    );
    document.body.appendChild(modal);
  }
  renderDataManagerStatus();
  modal.classList.add('show');
}
function renderDataManagerStatus() {
  const s = $('#dm-status'); if (!s) return;
  const last = STATE.lastBackupAt;
  if (!last) {
    s.textContent = '⚠ まだ一度もバックアップされていません';
    s.style.color = '#ffb888';
  } else {
    const days = Math.floor((Date.now() - last) / 86400000);
    const d = new Date(last);
    const ds = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
    s.textContent = `✓ 最終バックアップ：${ds}（${days} 日前）`;
    s.style.color = days > 30 ? '#ffb888' : '#cfe6ff';
  }
}

// v10n10: プレイ中 HUD ── 画面右上に「リーダー / 効果 / 推薦」薄く表示
function renderHUD() {
  let hud = $('#play-hud');
  if (!STATE.hudEnabled || !isPartyChosen() || STATE.mode === 'idle') {
    hud?.remove();
    return;
  }
  if (!hud) {
    hud = el('div', { id:'play-hud', class:'play-hud' });
    document.body.appendChild(hud);
  }
  const hero = STATE.party.members[STATE.party.hero || 0];
  const agg = aggregatePartyPerks();
  const combo = getComboBonus();
  const expFinal = (agg.expMul || 1) * (combo.expMul || 1);
  // 次推薦：あと1字でコンボ成立する熟語があれば
  const partySet = new Set(STATE.party.members.map(m => m.char));
  let nextHint = '';
  for (const r of (window.YOJI_RECIPES || [])) {
    if (!r.chars || r.chars.length < 2 || r.chars.length > 4) continue;
    const missing = r.chars.filter(c => !partySet.has(c));
    if (missing.length === 1) {
      nextHint = `「${missing[0]}」→ ${r.word}`;
      break;
    }
  }
  hud.innerHTML = '';
  hud.appendChild(el('div', { class:'hud-row hud-leader' }, `首 ${hero.char} Lv.${hero.level}`));
  hud.appendChild(el('div', { class:'hud-row hud-eff' },
    `経 ×${expFinal >= 100 ? fmtBig(expFinal) : expFinal.toFixed(2)}`,
    combo.combos?.length ? el('span', { class:'hud-combo' }, ` ・ 結 ${combo.combos.length}`) : null,
  ));
  if (nextHint) hud.appendChild(el('div', { class:'hud-row hud-hint' }, '次 ' + nextHint));
  // v1.0.1: 一時バフ表示（残り秒数）
  const buffs = getActiveTempBuffs ? getActiveTempBuffs() : [];
  for (const b of buffs) {
    const sec = Math.max(0, Math.ceil((b.until - Date.now()) / 1000));
    hud.appendChild(el('div', { class:'hud-row hud-buff' }, ` ${b.src}：${b.label.replace(/（.+?）/, '')}（${sec}s）`));
  }
}
function toggleHUD() {
  STATE.hudEnabled = !STATE.hudEnabled;
  saveState();
  const stateEl = $('#m-hud-state');
  if (stateEl) stateEl.textContent = STATE.hudEnabled ? 'オン' : 'オフ';
  if (STATE.hudEnabled) renderHUD();
  else $('#play-hud')?.remove();
  toast(` HUD ${STATE.hudEnabled ? 'オン' : 'オフ'}`);
}

// v10n9: パーティプリセット保存／読込
function savePartyPreset() {
  if (!isPartyChosen()) { toast('編成してから保存'); return; }
  if (!Array.isArray(STATE.partyPresets)) STATE.partyPresets = [];
  const heroChar = STATE.party.members[STATE.party.hero]?.char || '?';
  const defaultName = `${heroChar}パ`;
  const name = prompt('プリセット名（最大12文字）', defaultName);
  if (!name) return;
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) return;
  const preset = {
    id: 't_' + Math.random().toString(36).slice(2, 8),
    name: trimmed,
    hero: STATE.party.hero,
    members: JSON.parse(JSON.stringify(STATE.party.members)),
    savedAt: Date.now(),
  };
  // v1.3.17: 12 個満タンなら新規保存不可（自動削除しない）
  if (STATE.partyPresets.length >= 12) {
    toast('プリセット上限（12）── 不要な物を外してから');
    return;
  }
  STATE.partyPresets.push(preset);
  saveState();
  toast(` 「${trimmed}」保存`);
  if ($('#party-presets-modal')?.classList.contains('show')) renderPartyPresetsModal();
}
function loadPartyPreset(id) {
  const p = (STATE.partyPresets || []).find(x => x.id === id);
  if (!p) return;
  if (!confirm(`「${p.name}」を読込みますか？\n（現パーティは置き換え。プリセット側に保存された Lv が復元される）`)) return;
  invalidateAggCache();
  STATE.party = { hero: p.hero || 0, members: JSON.parse(JSON.stringify(p.members)) };
  saveState();
  renderParty();
  updateProgressPill();
  try { playSFX('unlock'); } catch(_) {}
  toast(`📂 「${p.name}」読込`);
  if ($('#party-presets-modal')?.classList.contains('show')) renderPartyPresetsModal();
}
function deletePartyPreset(id) {
  const p = (STATE.partyPresets || []).find(x => x.id === id);
  if (!p) return;
  if (!confirm(`「${p.name}」削除？`)) return;
  STATE.partyPresets = STATE.partyPresets.filter(x => x.id !== id);
  saveState();
  toast(` 削除`);
  if ($('#party-presets-modal')?.classList.contains('show')) renderPartyPresetsModal();
}
function openPartyPresets() {
  let modal = $('#party-presets-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'party-presets-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'520px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, 'パーティ プリセット'),
          el('button', { class:'modal-close', onclick: () => modal.classList.remove('show') }, '×'),
        ),
        el('div', { id:'party-presets-list', style:{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:'8px' } }),
        el('div', { style:{ padding:'8px 16px 16px', display:'flex', gap:'8px' } },
          el('button', { class:'btn-primary', onclick: savePartyPreset, style:{ flex:1 } }, ' 現パーティを保存'),
        ),
      )
    );
    document.body.appendChild(modal);
  }
  renderPartyPresetsModal();
  modal.classList.add('show');
}
function renderPartyPresetsModal() {
  const list = $('#party-presets-list');
  if (!list) return;
  list.innerHTML = '';
  const presets = STATE.partyPresets || [];
  if (presets.length === 0) {
    list.appendChild(el('div', { style:{ textAlign:'center', color:'var(--ink-mute)', padding:'16px' } }, '保存済プリセットなし。\n下の「保存」で現編成を残せます'));
    return;
  }
  presets.slice().reverse().forEach(p => {
    const heroChar = p.members[p.hero || 0]?.char || '?';
    const memberChars = p.members.map((m,i) => i === (p.hero||0) ? `★${m.char}` : m.char).join('・');
    const lvSum = p.members.reduce((s,m) => s + (m.level||1), 0);
    list.appendChild(el('div', {
      style:{
        padding:'10px 12px', borderRadius:'8px',
        background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)',
        display:'flex', alignItems:'center', gap:'10px',
      }
    },
      el('div', { style:{ flex:1, minWidth:0 } },
        el('div', { style:{ fontWeight:700, fontSize:'.95rem' } }, p.name),
        el('div', { style:{ fontSize:'.75rem', color:'var(--ink-mute)' } }, memberChars + ` ・ ΣLv ${lvSum}`),
      ),
      el('button', { class:'btn-secondary', style:{ padding:'4px 8px', fontSize:'.78rem' },
        title:'名前変更', onclick: () => renamePartyPreset(p.id) }, '✏'),
      el('button', { class:'btn-secondary', style:{ padding:'4px 10px', fontSize:'.78rem' },
        onclick: () => loadPartyPreset(p.id) }, '📂 読込'),
      el('button', { class:'btn-danger', style:{ padding:'4px 8px', fontSize:'.78rem' },
        onclick: () => deletePartyPreset(p.id) }, ''),
    ));
  });
}
// v1.3.16: プリセット名前変更
function renamePartyPreset(id) {
  const p = (STATE.partyPresets || []).find(x => x.id === id);
  if (!p) return;
  const next = prompt(`新しい名前（最大 16 文字）`, p.name || '');
  if (next == null) return;
  const trimmed = next.trim().slice(0, 16);
  if (!trimmed) return;
  p.name = trimmed;
  saveState();
  toast(`✏ 「${trimmed}」`);
  renderPartyPresetsModal();
}

// v10n9: 現効果パネル ── party-bar 下に常時表示（折りたたみ可）
function renderEffectsPanel() {
  if (!isPartyChosen()) {
    $('#effects-panel')?.remove();
    return;
  }
  let panel = $('#effects-panel');
  if (!panel) {
    panel = el('div', { id:'effects-panel', class:'effects-panel collapsed' });
    const partyBar = $('#party-bar');
    const after = $('#combo-bar') || partyBar;
    if (after && after.parentNode) {
      after.parentNode.insertBefore(panel, after.nextSibling);
    }
  }
  const agg = aggregatePartyPerks();
  const combo = getComboBonus();
  // 合算（agg 側の効果は perks 由来・combo は熟語発動由来 ── perks は既に getComboBonus に乗ってないので別管理）
  const expFinal      = (agg.expMul || 1) * (combo.expMul || 1);
  const gravFinal     = (agg.gravityMul || 1) * (combo.gravityMul || 1);
  const mergeFinal    = (agg.mergeRadiusMul || 1) * (combo.mergeRadiusMul || 1);
  const dropFinal     = (agg.dropCountAdd || 0) + (combo.dropCountAdd || 0);
  const stockFinal    = (agg.stockExpMul || 1) * (combo.stockExpMul || 1);
  const evoFinal      = (agg.evoDiscount || 0) + (combo.evoBoost || 0);
  const lvMul = leaderLvMul();
  const fmt = (n, dig=2) => Number(n).toFixed(dig);
  const passCount = (agg.activePassives || []).length;
  // v1.0.4: 効果パネル ── アイコン＋ラベル＋値、none は薄く小さく、active は強く
  const grade = (val, weak, strong, inverted=false) => {
    if (inverted) {
      if (val <= strong) return 'strong';
      if (val <= weak)   return 'weak';
      return 'none';
    }
    if (val >= strong) return 'strong';
    if (val >= weak)   return 'weak';
    return 'none';
  };
  // 矢印：強い=⇡、弱い=↑、休=・、重力は逆（低いほど良いので ⇣/↓ で表す）
  const arrow = (grade, inverted) => grade === 'none' ? '・' : (inverted ? (grade === 'strong' ? '⇣' : '↓') : (grade === 'strong' ? '⇡' : '↑'));
  // v1.1.4: 倍率を「+%」表記＋日本語の状態語に。重力など逆方向は「緩」「速」で説明
  const pct = (mul) => {
    const p = Math.round((mul - 1) * 100);
    return (p >= 0 ? '+' : '') + p + '%';
  };
  const pctInv = (mul) => {  // 重力用：×0.7 → -30%（緩）
    const p = Math.round((1 - mul) * 100);
    return '-' + p + '%';
  };
  const expLabel = expFinal >= 10
    ? `×${expFinal >= 1000 ? fmtBig(expFinal) : fmt(expFinal)}`  // 大きすぎる時は ×N 表記
    : pct(expFinal);
  const gravLabel = gravFinal < 0.99 ? pctInv(gravFinal) + ' 緩' : gravFinal > 1.01 ? '+' + Math.round((gravFinal-1)*100) + '% 速' : '通常';
  const mergeLabel = mergeFinal > 1.01 ? pct(mergeFinal) + ' 広' : '通常';
  const stockLabel = stockFinal > 1.01 ? pct(stockFinal) : '通常';
  // v1.5.5: 絵文字 → 単漢字シンボル（ぽもじ世界観に統一）
  const items = [
    { ic:'経', lbl:'経験',     val:expLabel,                                hint:'もらえる経験値の増分',         grade: grade(expFinal, 1.10, 1.50), inv:false },
    { ic:'蓄', lbl:'蓄積',     val:stockLabel,                              hint:'拾った字から入る EXP の増分',    grade: grade(stockFinal, 1.05, 1.30), inv:false },
    { ic:'進', lbl:'進化',     val:'+' + Math.round(evoFinal * 100) + '%', hint:'次 Lv 必要 EXP を削る率',       grade: grade(evoFinal, 0.05, 0.20), inv:false },
    { ic:'重', lbl:'重力',     val:gravLabel,                              hint:'字の落下スピード（緩いほど捕まえやすい）', grade: grade(gravFinal, 0.95, 0.70, true), inv:true },
    { ic:'結', lbl:'融合',     val:mergeLabel,                             hint:'同字が合体する判定半径',         grade: grade(mergeFinal, 1.05, 1.20), inv:false },
    { ic:'粒', lbl:'粒数',     val:dropFinal > 0 ? '+' + Math.round(dropFinal) + '個' : '通常', hint:'1 回の落下で追加される粒数', grade: grade(dropFinal, 1, 3), inv:false },
    { ic:'統', lbl:'統率',     val:pct(lvMul),                            hint:'リーダー Lv 由来の全効果ブースト', grade: grade(lvMul, 1.10, 1.30), inv:false },
    { ic:'常', lbl:'常時',     val:passCount + '/20',                     hint:'達成済の常時効果数（パッシブ）', grade: grade(passCount, 2, 5), inv:false },
  ];
  for (const it of items) it.arr = arrow(it.grade, it.inv);
  const activeCount = items.filter(x => x.grade !== 'none').length;
  const strongCount = items.filter(x => x.grade === 'strong').length;
  // v1.3.1: スマホ（<=480px）では初回 default 折りたたみ
  if (window.innerWidth <= 480 && !panel.dataset.mobileInit) {
    panel.classList.add('collapsed');
    panel.dataset.mobileInit = '1';
  }
  const collapsed = panel.classList.contains('collapsed');
  panel.innerHTML = '';
  // v1.0.4: 簡潔ヘッダ「 効果 N/8（うち強 M）」
  const modeLabel = strongCount >= 3 ? '大爆発中' : strongCount >= 1 ? '強化中' : activeCount >= 4 ? '稼働中' : activeCount > 0 ? '静か' : '休眠';
  const modeColor = strongCount >= 3 ? '#ffd86b' : strongCount >= 1 ? '#ffc070' : activeCount > 0 ? '#cfe6ff' : 'var(--ink-mute)';
  const header = el('div', { class:'ep-head' },
    el('span', { class:'ep-toggle',
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, collapsed ? '▸' : '▾'),
    el('span', { class:'ep-title',
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, '効果'),
    el('span', { class:'ep-mode', style:{ color: modeColor, fontWeight:700 },
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, `${activeCount}/8 ・ ${modeLabel}`),
    el('button', { class:'ep-preset-btn', title:'パーティ プリセット',
      onclick: (e) => { e.stopPropagation(); openPartyPresets(); },
    }, '編'),
  );
  panel.appendChild(header);
  if (!collapsed) {
    // v1.0.8: 「効果の種類多すぎ」対策 ── アクティブのみ表示、休眠は折りたたみ
    const active = items.filter(x => x.grade !== 'none');
    const inactive = items.filter(x => x.grade === 'none');
    const sortedActive = active.sort((a, b) => {
      const gr = { strong:0, weak:1 };
      return gr[a.grade] - gr[b.grade];
    });
    const list = el('div', { class:'ep-list' });
    if (sortedActive.length === 0) {
      list.appendChild(el('div', { class:'ep-empty' }, '効果なし ── パーティとコンボで動かそう'));
    } else {
      sortedActive.forEach(it => {
        // v1.5.6: アイコン字に育成 Lv エフェクト
        const band = charLvBand(it.ic);
        list.appendChild(
          el('div', {
            class:'ep-row ep-' + it.grade,
            title: `${it.lbl}：${it.hint}\n現在 ${it.val} ／ タップで小 EXP`,
            onclick: (e) => tapEffectCell(it, e),
          },
            el('span', { class:'ep-row-ic' + (band ? ' ' + band : '') }, it.ic),
            el('span', { class:'ep-row-lbl' }, it.lbl),
            el('span', { class:'ep-row-arr' }, it.arr),
            el('span', { class:'ep-row-val' }, it.val),
          )
        );
      });
    }
    panel.appendChild(list);
    // 休眠効果は「+N 休眠」ボタンとして畳む（クリックで展開）
    if (inactive.length > 0) {
      const expanded = panel.classList.contains('show-inactive');
      const toggle = el('button', {
        class:'ep-inactive-toggle',
        onclick: (e) => {
          e.stopPropagation();
          panel.classList.toggle('show-inactive');
          renderEffectsPanel();
        },
      }, expanded ? '▾ 休眠 ' + inactive.length + ' 個を隠す' : '▸ 休眠 ' + inactive.length + ' 個を見る');
      panel.appendChild(toggle);
      if (expanded) {
        const sub = el('div', { class:'ep-list ep-inactive-list' });
        inactive.forEach(it => sub.appendChild(
          el('div', {
            class:'ep-row ep-none',
            title: `${it.lbl}：${it.hint}`,
            onclick: (e) => tapEffectCell(it, e),
          },
            el('span', { class:'ep-row-ic' }, it.ic),
            el('span', { class:'ep-row-lbl' }, it.lbl),
            el('span', { class:'ep-row-arr' }, it.arr),
            el('span', { class:'ep-row-val' }, it.val),
          )
        ));
        panel.appendChild(sub);
      }
    }
  }
}

// v10n9: リーダー昇格プレビュー ── 現リーダー vs 候補
function previewLeaderSwap(idx) {
  if (!STATE.party || !STATE.party.members) return null;
  const cur = STATE.party.members[STATE.party.hero || 0];
  const cand = STATE.party.members[idx];
  if (!cur || !cand) return null;
  return {
    current: { char: cur.char, lv: cur.level, rarity: cur.rarity },
    candidate: { char: cand.char, lv: cand.level, rarity: cand.rarity },
    // 落下プールは leader Lv に依存 ── Lv 差を見せる
    lvDelta: cand.level - cur.level,
    // guardian は新リーダーに付け替え
    guardianMove: true,
  };
}

// v10n8: お気に入り（★）── 字／熟語
function toggleFavoriteChar(c) {
  if (!STATE.favorites) STATE.favorites = { chars:{}, yoji:{} };
  if (STATE.favorites.chars[c]) {
    delete STATE.favorites.chars[c];
    toast(`☆ ${c} のお気に入り解除`);
  } else {
    STATE.favorites.chars[c] = Date.now();
    toast(`★ ${c} をお気に入りに`);
  }
  saveState();
}
function toggleFavoriteYoji(w) {
  if (!STATE.favorites) STATE.favorites = { chars:{}, yoji:{} };
  if (STATE.favorites.yoji[w]) {
    delete STATE.favorites.yoji[w];
    toast(`☆ ${w} のお気に入り解除`);
  } else {
    STATE.favorites.yoji[w] = Date.now();
    toast(`★ ${w} をお気に入りに`);
  }
  saveState();
}
function isFavoriteChar(c) { return !!(STATE.favorites?.chars?.[c]); }
function isFavoriteYoji(w) { return !!(STATE.favorites?.yoji?.[w]); }

// v10n8: コンボ効果プレビュー ── 単独発動時の効果数値を返す
function previewComboEffect(r) {
  if (!r) return null;
  // 一時的に getComboBonus と同じロジックを 1 件だけで走らせる
  const acc = { expMul:1.0, evoBoost:0, gravityMul:1.0, mergeRadiusMul:1.0, dropCountAdd:0, stockExpMul:1.0 };
  const lvMul = (typeof leaderLvMul === 'function') ? leaderLvMul() : 1.0;
  if (r.special && r.effect) {
    const e = r.effect;
    if (e.expMul)         acc.expMul        *= e.expMul * lvMul;
    if (e.evoBoost)       acc.evoBoost      += e.evoBoost * lvMul;
    if (e.gravityMul)     acc.gravityMul    *= e.gravityMul;
    if (e.mergeRadiusMul) acc.mergeRadiusMul*= e.mergeRadiusMul;
    if (e.dropCountAdd)   acc.dropCountAdd  += e.dropCountAdd;
    if (e.stockExpMul)    acc.stockExpMul   *= e.stockExpMul * lvMul;
  } else {
    const u = UNIQUE_COMBO_EFFECTS[r.word];
    if (u) {
      if (u.expMul)         acc.expMul        *= u.expMul * lvMul;
      if (u.evoBoost)       acc.evoBoost      += u.evoBoost * lvMul;
      if (u.gravityMul)     acc.gravityMul    *= u.gravityMul;
      if (u.mergeRadiusMul) acc.mergeRadiusMul*= u.mergeRadiusMul;
      if (u.dropCountAdd)   acc.dropCountAdd  += u.dropCountAdd;
      if (u.stockExpMul)    acc.stockExpMul   *= u.stockExpMul * lvMul;
    } else {
      const n = r.chars.length;
      const rarMul = COMBO_RARITY_MUL[r.rarity] || 1.0;
      const difMul = comboDifficulty(r);
      const baseExp = n <= 2 ? 0.10 : n === 3 ? 0.30 : n === 4 ? 0.60 : 1.0;
      acc.expMul *= 1 + baseExp * rarMul * difMul * lvMul;
      if (n === 4) acc.evoBoost += 0.10 * rarMul * lvMul;
      if (n >= 5)  acc.evoBoost += 0.20 * rarMul * lvMul;
      acc._lastWeight = (n / 2) * rarMul * difMul * lvMul;
      applyComboTagEffects(r, acc);
      delete acc._lastWeight;
    }
  }
  if (typeof clampCombo === 'function') clampCombo(acc);
  return acc;
}
function formatComboEffect(eff) {
  if (!eff) return '';
  const lines = [];
  if (eff.expMul && eff.expMul > 1.01)        lines.push(`EXP ×${eff.expMul.toFixed(2)}`);
  if (eff.evoBoost && eff.evoBoost > 0.005)   lines.push(`進化加速 +${(eff.evoBoost*100).toFixed(0)}%`);
  if (eff.gravityMul && eff.gravityMul < 0.99) lines.push(`重力 ×${eff.gravityMul.toFixed(2)}`);
  if (eff.mergeRadiusMul && eff.mergeRadiusMul > 1.01) lines.push(`融合範囲 ×${eff.mergeRadiusMul.toFixed(2)}`);
  if (eff.dropCountAdd && eff.dropCountAdd > 0) lines.push(`粒 +${eff.dropCountAdd}`);
  if (eff.stockExpMul && eff.stockExpMul > 1.01) lines.push(`ストック ×${eff.stockExpMul.toFixed(2)}`);
  return lines.length ? lines.join(' / ') : '効果は発動時の状況による';
}

// v10n8: ワンタップ編成 ── 熟語の構成字でパーティを組む
// 構成字が手元（発見済）にすべてあれば実行可能、なければ「あと N 字」表示
// v1.2.3: コンボ配置ピッカー ── 4 スロットにドラッグで配置
function openComboPlacementPicker(r) {
  if (!r || !r.chars || r.chars.length === 0) return;
  if (r.chars.length > 4) { toast('5字以上は枠超過'); return; }
  const codex = window.KANJI_CODEX || [];
  const missing = [];
  const chars = [];
  for (const c of r.chars) {
    if (!((STATE.collection||{})[c] > 0)) { missing.push(c); continue; }
    const k = codex.find(x => (x.char || x.c) === c);
    chars.push({ char:c, rarity: (k && k.rarity) || '★1' });
  }
  if (missing.length > 0) {
    toast(`あと ${missing.length} 字（${missing.join('・')}）未発見`);
    return;
  }
  // モーダル構築（既存あれば消す）
  $$('#combo-placement-modal').forEach(m => m.remove());
  const slots = new Array(4).fill(null);
  // 初期配置：recipe 順
  chars.forEach((c, i) => { if (i < 4) slots[i] = c; });
  function render() {
    list.innerHTML = '';
    slots.forEach((c, i) => {
      const cell = el('div', {
        class: 'cpp-slot' + (i === 0 ? ' cpp-hero' : '') + (c ? ' cpp-filled' : ' cpp-empty'),
        dataset: { slot: i },
      },
        el('div', { class:'cpp-slot-label' }, i === 0 ? '★ リーダー' : `仲間 ${i}`),
        c ? el('div', { class:'cpp-slot-char rarity-' + (RARITY_TIERS.indexOf(c.rarity)+1) }, c.char) : el('div', { class:'cpp-slot-blank' }, '空'),
      );
      list.appendChild(cell);
    });
    bench.innerHTML = '';
    chars.forEach((c) => {
      const inSlot = slots.some(s => s && s.char === c.char);
      const chip = el('div', {
        class: 'cpp-chip rarity-' + (RARITY_TIERS.indexOf(c.rarity)+1) + (inSlot ? ' cpp-chip-used' : ''),
        dataset: { char: c.char, rarity: c.rarity },
      }, c.char);
      bench.appendChild(chip);
    });
    setupCppDragDrop();
  }
  function setupCppDragDrop() {
    // chip → slot：tap or drag
    $$('.cpp-chip').forEach(chip => {
      chip.onclick = () => {
        if (chip.classList.contains('cpp-chip-used')) {
          // 既に配置済 → 取り出し
          const ch = chip.dataset.char;
          for (let i = 0; i < 4; i++) if (slots[i] && slots[i].char === ch) slots[i] = null;
          render();
          return;
        }
        // 空きスロットに入れる
        const empty = slots.findIndex(s => !s);
        if (empty < 0) { toast('スロット満員 ── 既存チャーをタップして外す'); return; }
        slots[empty] = { char: chip.dataset.char, rarity: chip.dataset.rarity };
        render();
      };
    });
    // slot → slot 入れ替え（横ドラッグ）
    $$('.cpp-slot').forEach(slot => {
      let pid = null, sx = 0, sy = 0, moved = false;
      slot.onpointerdown = (e) => {
        if (!slots[parseInt(slot.dataset.slot)]) return;
        pid = e.pointerId;
        sx = e.clientX; sy = e.clientY; moved = false;
        try { slot.setPointerCapture(pid); } catch(_) {}
      };
      slot.onpointermove = (e) => {
        if (e.pointerId !== pid) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx)+Math.abs(dy) > 8) { moved = true; slot.style.transform = `translate(${dx}px, ${dy*0.3}px)`; slot.style.zIndex = '99'; }
      };
      slot.onpointerup = (e) => {
        if (e.pointerId !== pid) return;
        slot.style.transform = '';
        slot.style.zIndex = '';
        try { slot.releasePointerCapture(pid); } catch(_) {}
        pid = null;
        if (!moved) return;
        const prev = slot.style.pointerEvents;
        slot.style.pointerEvents = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cpp-slot');
        slot.style.pointerEvents = prev;
        if (!target || target === slot) return;
        const a = parseInt(slot.dataset.slot);
        const b = parseInt(target.dataset.slot);
        [slots[a], slots[b]] = [slots[b], slots[a]];
        render();
      };
    });
  }
  const modal = el('div', { class:'modal show', id:'combo-placement-modal', role:'dialog' },
    el('div', { class:'modal-card', style:{ maxWidth:'440px' } },
      el('div', { class:'modal-head' },
        el('div', { class:'modal-title' }, ` 配置：${r.word}`),
        el('button', { class:'modal-close', onclick: () => modal.remove() }, '×'),
      ),
      el('div', { style:{ padding:'12px 16px' } },
        el('div', { style:{ fontSize:'.72rem', color:'var(--ink-mute)', marginBottom:'8px' } },
          '順番もコンボに効く（一致すると ×1.4）。スロットタップ＝チャー出し、チップタップ＝入れ替え、スロット同士ドラッグで交換'),
        el('div', { class:'cpp-slots', id:'cpp-slots', style:{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'8px', marginBottom:'12px' } }),
        el('div', { style:{ fontSize:'.7rem', color:'var(--ink-mute)', marginBottom:'4px' } }, 'コンボ字'),
        el('div', { class:'cpp-bench', id:'cpp-bench', style:{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'14px' } }),
      ),
      el('div', { style:{ padding:'0 16px 16px', display:'flex', gap:'8px' } },
        el('button', { class:'btn-secondary', style:{ flex:1 }, onclick: () => modal.remove() }, 'キャンセル'),
        el('button', { class:'btn-primary', style:{ flex:1, fontWeight:700 }, onclick: () => {
          const final = slots.filter(s => s);
          if (final.length === 0) { toast('1 字以上配置して'); return; }
          if (STATE.party && STATE.party.members?.length) {
            if (!confirm('現パーティを置き換えますか？')) return;
          }
          invalidateAggCache();
          // v1.3.19: 過去 Lv 復元
          const members = final.map((f, i) => buildMemberFor(f.char, f.rarity, i === 0));
          STATE.party = { hero: 0, members };
          saveState();
          renderParty();
          updateProgressPill();
          try { playSFX('unlock'); } catch(_) {}
          toast(` 「${r.word}」配置完了 ── 順番一致でコンボ ×1.4`, r.rarity);
          modal.remove();
        } }, '✓ この配置で確定'),
      ),
    ),
  );
  document.body.appendChild(modal);
  const list = $('#cpp-slots');
  const bench = $('#cpp-bench');
  render();
}

function assemblePartyFromYoji(r) {
  if (!r || !r.chars || r.chars.length === 0) return { ok:false, reason:'構成字なし' };
  if (r.chars.length > 4) return { ok:false, reason:'5字以上の熟語はパーティ枠超過' };
  const codex = window.KANJI_CODEX || [];
  const missing = [];
  const found = [];
  for (const c of r.chars) {
    if (!((STATE.collection||{})[c] > 0)) { missing.push(c); continue; }
    const k = codex.find(x => (x.char || x.c) === c);
    if (!k) { missing.push(c); continue; }
    found.push({ char:c, rarity:k.rarity });
  }
  if (missing.length > 0) return { ok:false, reason:`あと ${missing.length} 字（${missing.join('・')}）未発見`, missing };
  // 既存パーティを置き換え（確認）
  const heroChar = found[0].char;
  if (STATE.party && STATE.party.members?.length) {
    if (!confirm(`「${r.word}」発動のため現パーティを置き換えますか？\nリーダー: ${heroChar} / 仲間: ${found.slice(1).map(f=>f.char).join('・') || 'なし'}`)) {
      return { ok:false, reason:'キャンセル' };
    }
  }
  invalidateAggCache();
  // v1.3.19: 過去 Lv 復元
  const members = found.map((f, i) => buildMemberFor(f.char, f.rarity, i === 0));
  STATE.party = { hero: 0, members };
  saveState();
  renderParty();
  updateProgressPill();
  try { playSFX('unlock'); } catch(_) {}
  toast(`「${r.word}」コンボ編成完了`, r.rarity);
  return { ok:true };
}

// v10n8: シーズン／タグ進捗計算
function computeSeasonProgress(season) {
  const codex = window.KANJI_CODEX || [];
  const recipes = window.YOJI_RECIPES || [];
  if (season === 'S1' || season === 'S2') {
    const items = codex.filter(k => (k.season || 'S1') === season);
    const found = items.filter(k => ((STATE.collection||{})[k.char || k.c] || 0) > 0).length;
    return { found, total: items.length };
  }
  if (['S3','S4','S5','S6','S7'].includes(season)) {
    const items = recipes.filter(r => r.season === season);
    const found = items.filter(r => isYojiDiscovered ? isYojiDiscovered(r) : !!STATE.discoveredYoji?.[r.word]).length;
    return { found, total: items.length };
  }
  return { found: 0, total: 0 };
}

// ランダム熟語表示 ── サプライズ発見モチベ
// v1.5.31: おみくじガチャ ── 無料1日1回 + 有料（ストック10消費）何度でも
const OMIKUJI_GACHA_COST = 10;  // 任意発見済字のストック合計から消費
function _omikujiTotalStock() {
  let n = 0;
  for (const k of Object.keys(STATE.stock || {})) n += STATE.stock[k] || 0;
  return n;
}
// v1.5.33: 字の rarity を取得（codex から）
function _charRarityIdx(c) {
  const codex = window.KANJI_CODEX || [];
  const k = codex.find(x => (x.char || x.c) === c);
  if (!k) return 0;
  return Math.max(0, RARITY_TIERS.indexOf(k.rarity));
}
// 消費：所有数で重み付きランダム抽選で 10 個削る ・ 平均 rIdx を返す
function _omikujiConsumeStock(cost) {
  const stock = STATE.stock || {};
  let pool = [];
  for (const [c, v] of Object.entries(stock)) {
    for (let i = 0; i < v; i++) pool.push(c);
  }
  if (pool.length < cost) return { ok:false, avgRIdx:0, breakdown:{} };
  // ランダムに cost 個抽出
  const picked = [];
  const idxs = new Set();
  while (idxs.size < cost) {
    idxs.add(Math.floor(Math.random() * pool.length));
  }
  for (const i of idxs) picked.push(pool[i]);
  // 削る
  let sumR = 0;
  const breakdown = {};
  picked.forEach(c => {
    STATE.stock[c] -= 1;
    if (STATE.stock[c] <= 0) delete STATE.stock[c];
    const r = _charRarityIdx(c);
    sumR += r;
    breakdown[r] = (breakdown[r] || 0) + 1;
  });
  return { ok:true, avgRIdx: sumR / cost, breakdown };
}
function _omikujiDraw(r, fortuneTier, label) {
  const fortuneName = ['末吉','吉','中吉','吉','大吉','大大吉'][fortuneTier] || '吉';
  // ご利益①：構成字を全てストックに +1
  if (!STATE.stock) STATE.stock = {};
  (r.chars || []).forEach(c => { STATE.stock[c] = (STATE.stock[c] || 0) + 1; });
  // ご利益②：EXP バフ
  const buffMin = 15 + fortuneTier * 5;
  const buffMul = 1 + 0.05 * fortuneTier;
  _tempBuffs = _tempBuffs.filter(b => b.src !== 'おみくじ');
  _tempBuffs.push({
    type:'exp', mul: buffMul,
    label:`おみくじ ${fortuneName}：EXP ×${buffMul.toFixed(2)}（${buffMin}分）`,
    until: Date.now() + buffMin * 60 * 1000,
    src:'おみくじ',
  });
  saveState();
  invalidateAggCache();
  toast(`【${label} ${fortuneName}】「${r.word}」 ・ 構成字+1 ・ EXP×${buffMul.toFixed(2)}（${buffMin}分）`, r.rarity);
}

function showRandomYoji() {
  const recipes = window.YOJI_RECIPES || [];
  if (recipes.length === 0) return;
  // ピッカー UI を出して 無料 / 有料 を選ばせる
  openOmikujiPicker();
}

function openOmikujiPicker() {
  $$('.omikuji-picker').forEach(e => e.remove());
  const today = new Date().toISOString().slice(0, 10);
  if (!STATE.omikuji) STATE.omikuji = { lastDay:null, streak:0 };
  const freeAvailable = STATE.omikuji.lastDay !== today;
  const totalStock = _omikujiTotalStock();
  const canPay = totalStock >= OMIKUJI_GACHA_COST;
  const streak = STATE.omikuji.streak || 0;
  const nextFortuneTier = Math.min(5, Math.floor(streak / 3) + 1);
  const nextFortuneName = ['末吉','吉','中吉','吉','大吉','大大吉'][nextFortuneTier] || '吉';

  const pop = el('div', { class:'omikuji-picker', style:{
    position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
    width:'min(340px,90vw)', padding:'22px 20px', zIndex:600,
    background:'linear-gradient(180deg, rgba(30,20,55,.98), rgba(7,10,28,.98))',
    border:'2px solid var(--gold)', borderRadius:'14px',
    boxShadow:'0 8px 40px rgba(0,0,0,.6), 0 0 30px rgba(240,212,138,.4)',
    display:'flex', flexDirection:'column', gap:'10px',
    fontFamily:"'Noto Serif JP', serif",
  } },
    el('button', { style:{ position:'absolute', top:'6px', right:'10px', background:'transparent', border:'none', color:'var(--ink-mute)', fontSize:'1.4rem', cursor:'pointer' }, onclick:() => pop.remove() }, '×'),
    el('div', { style:{ fontWeight:900, fontSize:'1.1rem', color:'var(--gold)', textAlign:'center' } }, 'おみくじガチャ'),
    el('div', { style:{ fontSize:'.72rem', color:'var(--ink-mute)', textAlign:'center', lineHeight:1.5 } },
      `連続 ${streak} 日 ・ 今の運勢「${nextFortuneName}」`
    ),
    // 無料毎日
    el('button', {
      style:{
        padding:'14px', borderRadius:'8px', cursor: freeAvailable ? 'pointer' : 'not-allowed',
        background: freeAvailable ? 'linear-gradient(135deg,#f0d48a,#d4a84a)' : 'rgba(255,255,255,.06)',
        color: freeAvailable ? '#1a1208' : 'var(--ink-mute)',
        border: '1px solid ' + (freeAvailable ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.12)'),
        fontWeight:700, fontSize:'.95rem',
      },
      disabled: !freeAvailable,
      onclick: () => {
        if (!freeAvailable) return;
        const r = recipesRandom(false);
        const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        STATE.omikuji.streak = (STATE.omikuji.lastDay === yest) ? (STATE.omikuji.streak || 0) + 1 : 1;
        STATE.omikuji.lastDay = today;
        const tier = Math.min(5, Math.floor(STATE.omikuji.streak / 3) + 1);
        _omikujiDraw(r, tier, '無料');
        pop.remove();
        showYojiDetail(r);
      },
    }, freeAvailable ? '無料おみくじ（1日1回）' : '本日の無料は引き済 ・ 明日まで'),
    // 有料ガチャ
    el('button', {
      style:{
        padding:'14px', borderRadius:'8px', cursor: canPay ? 'pointer' : 'not-allowed',
        background: canPay ? 'linear-gradient(135deg,#5b3a8c,#8b5fc8)' : 'rgba(255,255,255,.06)',
        color: canPay ? '#fff' : 'var(--ink-mute)',
        border: '1px solid ' + (canPay ? 'rgba(155,120,200,.6)' : 'rgba(255,255,255,.12)'),
        fontWeight:700, fontSize:'.95rem',
      },
      disabled: !canPay,
      onclick: () => {
        if (!canPay) return;
        const consumed = _omikujiConsumeStock(OMIKUJI_GACHA_COST);
        if (!consumed.ok) {
          toast('ストック不足');
          return;
        }
        const focusR = Math.round(consumed.avgRIdx);
        const r = recipesRandom(true, focusR);
        const tier = Math.min(5, Math.max(1, Math.floor(Math.random() * 6)));
        _omikujiDraw(r, tier, '有料');
        // 消費内訳を toast で告知
        const bdStr = Object.entries(consumed.breakdown)
          .sort((a,b) => Number(a[0]) - Number(b[0]))
          .map(([t,n]) => `★${Number(t)+1}×${n}`).join(' ');
        toast(`消費：${bdStr}（焦点★${focusR+1}）`);
        pop.remove();
        showYojiDetail(r);
      },
    }, canPay ? `おみくじガチャ（ストック ${OMIKUJI_GACHA_COST} 消費 ・ 残 ${totalStock}）` : `ストック不足（${totalStock}/${OMIKUJI_GACHA_COST}）`),
    el('div', { style:{ fontSize:'.68rem', color:'var(--ink-mute)', lineHeight:1.5, marginTop:'4px', padding:'8px', background:'rgba(135,206,235,.08)', borderRadius:'6px' } },
      el('div', { style:{ fontWeight:700, marginBottom:'3px', color:'#cfe6ff' } }, 'ご利益'),
      el('div', {}, '・ 引いた熟語の構成字を全て +1 ストック'),
      el('div', {}, '・ EXP バフ ×1.10〜×1.30（15〜40分）'),
      el('div', {}, '・ 連続日数で運勢上昇（末吉→大大吉）'),
    ),
    (() => {
      const rates = omikujiDropRates();
      const tiers = Object.keys(rates).map(Number).sort((a, b) => a - b);
      if (!tiers.length) return null;
      return el('div', { style:{ fontSize:'.65rem', color:'var(--ink-mute)', lineHeight:1.5, padding:'8px', background:'rgba(155,120,200,.06)', borderRadius:'6px' } },
        el('div', { style:{ fontWeight:700, marginBottom:'3px', color:'#c8a8ff' } }, `排出率（現在の解放範囲 ★1〜★${(STATE.unlockedTier||0)+2}）`),
        ...tiers.map(t => el('div', {}, `★${t+1} ── ${rates[t].toFixed(1)}%`)),
      );
    })(),
    (() => {
      // ストックのレア度別内訳
      const stock = STATE.stock || {};
      const byTier = {};
      let total = 0;
      for (const [c, v] of Object.entries(stock)) {
        const r = _charRarityIdx(c);
        byTier[r] = (byTier[r] || 0) + v;
        total += v;
      }
      let avg = 0;
      for (const t of Object.keys(byTier)) avg += Number(t) * byTier[t];
      avg = total > 0 ? avg / total : 0;
      const tiers = Object.keys(byTier).map(Number).sort((a,b) => a - b);
      return el('div', { style:{ fontSize:'.65rem', color:'var(--ink-mute)', lineHeight:1.5, padding:'8px', background:'rgba(255,255,255,.04)', borderRadius:'6px' } },
        el('div', { style:{ fontWeight:700, marginBottom:'3px', color:'var(--ink)' } }, `ストック構成（合計 ${total} ・ 平均 ★${(avg+1).toFixed(1)}）`),
        tiers.length === 0
          ? el('div', {}, '字をタップしてストックを貯めると、その平均レア度に合わせた熟語が出やすくなります。')
          : el('div', {}, tiers.map(t => `★${t+1}:${byTier[t]}`).join(' / ')),
        el('div', { style:{ marginTop:'4px', color:'var(--accent-2)' } }, '有料ガチャは「ストックの平均レア度」に近い熟語が出やすくなります（釣鐘曲線）'),
      );
    })(),
  );
  const backdrop = el('div', { style:{ position:'fixed', inset:'0', background:'rgba(0,0,0,.5)', zIndex:599 }, onclick: () => { pop.remove(); backdrop.remove(); } });
  document.body.appendChild(backdrop);
  document.body.appendChild(pop);
  const orig = pop.remove.bind(pop);
  pop.remove = () => { try { backdrop.remove(); } catch(_) {} orig(); };
}

// v1.5.32: ガチャ抽選 ── 進捗連動プール + レア度逆数の重み付け
// レア度の出現率（★ごとの相対重み）── ★1 が一番出やすく、★16 は超レア
const OMIKUJI_WEIGHT = [
  /*★1*/ 320, /*★2*/ 240, /*★3*/ 180, /*★4*/ 130, /*★5*/ 95,
  /*★6*/  70, /*★7*/  50, /*★8*/  36, /*★9*/  25, /*★10*/ 17,
  /*★11*/ 11, /*★12*/  7, /*★13*/  4, /*★14*/  2, /*★15*/  1, /*★16*/ 0.5,
];
function omikujiPool(includeUnlocked) {
  const all = window.YOJI_RECIPES || [];
  const maxTier = STATE.unlockedTier || 0;  // 0 = ★1帯のみ
  return all.filter(r => {
    const rIdx = RARITY_TIERS.indexOf(r.rarity);
    if (rIdx < 0) return false;
    // 進捗で制限：未解放ティアを 1 つ上まで覗き見可（夢を残す）
    if (rIdx > maxTier + 1) return false;
    return true;
  });
}
function omikujiDropRates() {
  const pool = omikujiPool();
  const tierCount = {};
  pool.forEach(r => {
    const rIdx = RARITY_TIERS.indexOf(r.rarity);
    tierCount[rIdx] = (tierCount[rIdx] || 0) + 1;
  });
  let total = 0;
  Object.keys(tierCount).forEach(t => { total += (OMIKUJI_WEIGHT[t] || 0) * tierCount[t]; });
  const rates = {};
  Object.keys(tierCount).forEach(t => {
    rates[t] = total > 0 ? ((OMIKUJI_WEIGHT[t] || 0) * tierCount[t] / total) * 100 : 0;
  });
  return rates;
}
function recipesRandom(paid, focusRIdx) {
  const pool = omikujiPool();
  if (!pool.length) {
    const r = window.YOJI_RECIPES;
    return r[Math.floor(Math.random() * r.length)];
  }
  // 重み：OMIKUJI_WEIGHT × focusBoost（focusRIdx 近傍を厚くする釣鐘）
  // focusRIdx 未指定なら通常重みのみ
  let total = 0;
  const weights = pool.map(r => {
    const rIdx = RARITY_TIERS.indexOf(r.rarity);
    let w = OMIKUJI_WEIGHT[rIdx] || 1;
    if (paid && typeof focusRIdx === 'number') {
      // 釣鐘曲線：focusRIdx の ±1 で ×3、±2 で ×2、±3 で ×1.4
      const d = Math.abs(rIdx - focusRIdx);
      const focusMul = d === 0 ? 3.5 : d === 1 ? 2.5 : d === 2 ? 1.7 : d === 3 ? 1.25 : 1.0;
      w *= focusMul;
    } else if (paid) {
      if (rIdx >= 8) w *= 1.3;  // 旧仕様の汎用補正
    }
    total += w;
    return w;
  });
  let pick = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    pick -= weights[i];
    if (pick <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// 「あと 1 字でコンボ成立」する熟語を推薦
function suggestNearComboYoji() {
  if (!STATE.party || !STATE.party.members?.length) {
    toast('先にパーティ編成して');
    return;
  }
  const partySet = new Set(STATE.party.members.map(m => m.char));
  const candidates = [];
  for (const r of (window.YOJI_RECIPES || [])) {
    if (!r.chars || r.chars.length < 2) continue;
    const missing = r.chars.filter(c => !partySet.has(c));
    if (missing.length === 1) {
      // 1 字だけ足りない → 推薦候補
      candidates.push({ recipe: r, missingChar: missing[0] });
    }
  }
  if (candidates.length === 0) {
    toast('あと 1 字で成立する熟語はないみたい');
    return;
  }
  // ランダムで 1 個ピックして表示
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  toast(` 「${pick.missingChar}」を仲間にすれば「${pick.recipe.word}」発動`, pick.recipe.rarity);
}

// シーズンタブに「N件」バッジを付与（解放欲を煽る）
function applyCodexSeasonBadges() {
  const codex = window.KANJI_CODEX || [];
  const recipes = window.YOJI_RECIPES || [];
  const counts = {
    'all': codex.length + recipes.length,
    'S1': codex.filter(k => (k.season||'S1') === 'S1').length,
    'S2': codex.filter(k => k.season === 'S2').length,
    'S3': recipes.filter(r => r.season === 'S3').length,
    'S4': recipes.filter(r => r.season === 'S4').length,
    'S5': recipes.filter(r => r.season === 'S5').length,
    'S6': recipes.filter(r => r.season === 'S6').length,
    'S7': recipes.filter(r => r.season === 'S7').length,
    'PERKS': Object.keys(PERKS || {}).length,
    'PASSIVES': PASSIVES.length,
  };
  $$('.codex-season').forEach(btn => {
    const s = btn.dataset.season;
    const n = counts[s];
    if (n == null) return;
    if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent;
    // v10n8: 進捗率バッジ
    let progressHtml = '';
    if (['S1','S2','S3','S4','S5','S6','S7'].includes(s)) {
      const p = computeSeasonProgress(s);
      if (p.total > 0) {
        const pct = Math.round(p.found / p.total * 100);
        progressHtml = ` <span class="cs-progress" title="${p.found} / ${p.total}（${pct}%）">${pct}%</span>`;
      }
    }
    btn.innerHTML = btn.dataset.origLabel + ` <span class="cs-badge">${n}</span>${progressHtml}`;
  });
}

// 未解放ティアの legend pill を「？？？」に隠す（解放欲を煽る）
function applyCodexLegendMask() {
  const unlocked = STATE.unlockedTier;
  const pills = $$('.codex-legend .cl-row');
  pills.forEach((pill, i) => {
    const isLocked = i > unlocked;
    pill.classList.toggle('tier-locked', isLocked);
    const tag = pill.querySelector('.cl-tag');
    if (!tag) return;
    if (isLocked) {
      // 残りのテキストノードを置換
      const label = pill.textContent.replace(tag.textContent, '').trim();
      pill.dataset.origLabel = pill.dataset.origLabel || label;
      // 全部「？？？」化
      pill.innerHTML = `<span class="cl-tag">？？</span>？？？`;
    } else if (pill.dataset.origLabel) {
      // 解放されたら復元
      pill.innerHTML = `<span class="cl-tag">${RARITY_TIERS[i]}</span>${pill.dataset.origLabel}`;
      delete pill.dataset.origLabel;
    }
  });
}

// 未解放ティアの tab を「？」に隠す
function applyCodexTabMask() {
  const unlocked = STATE.unlockedTier;
  const tabs = $$('.codex-tab');
  tabs.forEach((tab) => {
    const tierData = tab.dataset.tier;
    if (tierData === 'all') return;
    const idx = parseInt(tierData);
    const isLocked = idx > unlocked;
    tab.classList.toggle('tier-locked', isLocked);
    if (isLocked) {
      if (!tab.dataset.origLabel) tab.dataset.origLabel = tab.textContent;
      tab.textContent = '？';
    } else if (tab.dataset.origLabel) {
      tab.textContent = tab.dataset.origLabel;
      delete tab.dataset.origLabel;
    }
  });
}
function closeCodex() { $('#codex-modal').classList.remove('show'); }

// 熟語の詳細ポップアップ ── 構成字・タグ・発動条件
// v1.5.23: パッシブ詳細 ── 意味（簡潔）＋ 効果
function showPassiveDetail(p, on) {
  if (!p) return;
  $$('.passive-detail-pop, .ydp-backdrop, .cd-backdrop').forEach(e => e.remove());
  // 効果を読みやすい行に
  const effLines = [];
  const eff = p.eff || {};
  if (eff.expMul)         effLines.push(`EXP ×${eff.expMul.toFixed(2)}`);
  if (eff.stockExpMul)    effLines.push(`ストック ×${eff.stockExpMul.toFixed(2)}`);
  if (eff.mergeRadiusMul) effLines.push(`融合範囲 ×${eff.mergeRadiusMul.toFixed(2)}`);
  if (eff.gravityMul)     effLines.push(`重力 ×${eff.gravityMul.toFixed(2)}`);
  if (eff.dropCountAdd)   effLines.push(`粒 +${eff.dropCountAdd}`);
  if (eff.evoBoost)       effLines.push(`進化加速 +${(eff.evoBoost*100).toFixed(0)}%`);
  if (eff.critChance)     effLines.push(`タップ大当り ${(eff.critChance*100).toFixed(0)}%`);
  if (eff.chainBonus)     effLines.push(`連鎖ボーナス +${(eff.chainBonus*100).toFixed(0)}%`);
  if (eff.lifetimeMul)    effLines.push(`字寿命 ×${eff.lifetimeMul.toFixed(2)}`);
  if (eff.spawnRateMul)   effLines.push(`降下密度 ×${eff.spawnRateMul.toFixed(2)}`);
  if (eff.cycleBonusDrop) effLines.push(`サイクル完了時 +${eff.cycleBonusDrop}字`);
  if (eff.highRarityExpMul) effLines.push(`高レア EXP ×${eff.highRarityExpMul.toFixed(2)}`);
  if (eff.lowRarityExpMul)  effLines.push(`低レア EXP ×${eff.lowRarityExpMul.toFixed(2)}`);
  const pop = el('div', { class:'yoji-detail-pop passive-detail-pop' },
    el('button', { class:'ydp-close', onclick:(e) => { e.stopPropagation(); pop.remove(); } }, '×'),
    el('div', { class:'ydp-rarity' }, on ? '発動中' : '未発動'),
    el('div', { class:'ydp-word', style:{ fontSize:'1.4rem' } }, (p.icon || '◆') + ' ' + p.name),
    el('div', { class:'ydp-desc' }, p.desc || ''),
    effLines.length ? el('div', { class:'ydp-preview', style:{
      margin:'8px 0', padding:'8px 10px',
      background:'rgba(135,206,235,.10)', border:'1px solid rgba(135,206,235,.30)',
      borderRadius:'6px', fontSize:'.78rem', color:'#cfe6ff', lineHeight:1.5,
    } },
      el('div', { style:{ fontWeight:700, marginBottom:'4px', color:'#87ceeb' } }, '効果'),
      el('div', {}, effLines.join(' ・ '))
    ) : null,
    el('div', { class:'ydp-hint' }, on ? '条件達成 ・ 常時発動中' : '条件を満たすと発動'),
  );
  const backdrop = el('div', { class:'ydp-backdrop', style:{
    position:'fixed', inset:'0', background:'rgba(0,0,0,.4)', zIndex:499,
  }, onclick: () => { backdrop.remove(); pop.remove(); } });
  document.body.appendChild(backdrop);
  document.body.appendChild(pop);
  const origRemove = pop.remove.bind(pop);
  pop.remove = () => { try { backdrop.remove(); } catch(_){} origRemove(); };
}

function showYojiDetail(r) {
  if (!r) return;
  $$('.yoji-detail-pop').forEach(e => e.remove());
  const found = isYojiDiscovered(r);
  const rIdx = RARITY_TIERS.indexOf(r.rarity);
  const charRow = (r.chars || []).map(c => {
    const seen = (STATE.collection[c] || 0) > 0;
    const inParty = partyContainsChar(c) >= 0;
    return el('span', {
      class: 'yd-char' + (seen ? ' seen' : ' unseen') + (inParty ? ' in-party' : ''),
      title: seen ? `発見済 ${STATE.collection[c]} 回` : '未発見',
    }, seen ? c : '？');
  });
  // 構成字を全員パーティにいるか
  const allInParty = (r.chars || []).every(c => partyContainsChar(c) >= 0);
  const tags = (r.tags || []).join(' ・ ');
  const pop = el('div', { class:`yoji-detail-pop rarity-${rIdx + 1}` },
    el('button', { class:'ydp-close', onclick:(e) => { e.stopPropagation(); pop.remove(); } }, '×'),
    el('div', { class:'ydp-rarity' }, r.rarity),
    el('div', { class:'ydp-word' }, found ? r.word : '？'.repeat(Math.max(2, r.word.length))),
    found && r.desc ? el('div', { class:'ydp-desc' }, r.desc) : null,
    // v10n4: 固有効果コンボの物語表示
    found && UNIQUE_COMBO_EFFECTS[r.word] ? el('div', { class:'ydp-unique', style:{
      margin:'6px 0', padding:'6px 8px',
      background:'linear-gradient(90deg, rgba(240,212,138,.18), rgba(240,212,138,.06))',
      border:'1px solid rgba(240,212,138,.45)', borderRadius:'6px',
      fontSize:'.78rem', color:'#f0e0a8', lineHeight:1.35,
    } }, ' 固有効果 ── ' + (UNIQUE_COMBO_EFFECTS[r.word].story || '物語のある効果')) : null,
    // v10n8: コンボ効果プレビュー（数値）── v1.5.48: try-catch で内部エラー抑止
    found ? el('div', { class:'ydp-preview', style:{
      margin:'6px 0', padding:'6px 8px',
      background:'rgba(135,206,235,.10)', border:'1px solid rgba(135,206,235,.30)',
      borderRadius:'6px', fontSize:'.72rem', color:'#cfe6ff', lineHeight:1.4,
    } },
      el('div', { style:{ fontWeight:700, marginBottom:'2px', color:'#87ceeb' } }, '発動時の効果（現在のリーダー Lv 基準）'),
      el('div', {}, (() => {
        try { return formatComboEffect(previewComboEffect(r)); }
        catch(e) { return '効果の計算に失敗しました'; }
      })())
    ) : null,
    el('div', { class:'ydp-chars-label' }, '構成字'),
    el('div', { class:'ydp-chars' }, ...charRow),
    tags ? el('div', { class:'ydp-tags' }, tags) : null,
    el('div', { class:'ydp-hint' },
      allInParty
        ? '✓ 全員パーティに揃ってます ・ コンボ発動中！'
        : found
          ? '✓ 解放済 ・ パーティに揃えるとコンボ発動'
          : '構成字を集めると解放できます'
    ),
    // v10n8: アクション行 ── ★ お気に入り ＋ ワンタップ編成
    el('div', { style:{ display:'flex', gap:'6px', marginTop:'10px', flexWrap:'wrap' } },
      el('button', {
        class:'ydp-fav-btn',
        style:{
          padding:'6px 10px', borderRadius:'6px', fontSize:'.8rem', cursor:'pointer',
          background: isFavoriteYoji(r.word) ? 'rgba(240,212,138,.25)' : 'rgba(255,255,255,.06)',
          border: '1px solid ' + (isFavoriteYoji(r.word) ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.15)'),
          color: isFavoriteYoji(r.word) ? '#f0d48a' : 'var(--ink-mute)',
        },
        onclick: (e) => {
          e.stopPropagation();
          toggleFavoriteYoji(r.word);
          pop.remove();
          showYojiDetail(r);
        },
      }, isFavoriteYoji(r.word) ? '★ お気に入り' : '☆ お気に入り'),
      (r.chars && r.chars.length <= 4 && found) ? el('button', {
        class:'ydp-assemble-btn',
        style:{
          padding:'6px 10px', borderRadius:'6px', fontSize:'.8rem', cursor:'pointer', fontWeight:700,
          background: allInParty ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#f0d48a,#d4a84a)',
          border: '1px solid rgba(240,212,138,.55)',
          color: allInParty ? 'var(--ink-mute)' : '#1a1208',
          flex: '1 1 auto', minWidth:'140px',
        },
        onclick: (e) => {
          e.stopPropagation();
          if (allInParty) { toast('既に発動中'); return; }
          // v1.2.3: ピッカーで配置を選んでから確定
          pop.remove();
          openComboPlacementPicker(r);
        },
      }, allInParty ? '✓ 既にこの編成で発動中' : '★ この熟語の編成でパーティを組む') : null,
    ),
  );
  // v1.5.21: backdrop で必ず前面に
  const backdrop = el('div', { class:'ydp-backdrop', style:{
    position:'fixed', inset:'0', background:'rgba(0,0,0,.4)', zIndex:499,
  }, onclick: () => { backdrop.remove(); pop.remove(); } });
  document.body.appendChild(backdrop);
  document.body.appendChild(pop);
  const origRemove = pop.remove.bind(pop);
  pop.remove = () => { try { backdrop.remove(); } catch(_){} origRemove(); };
}

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

  // v10n3: 図鑑からリーダー設定／パーティ追加を直接できるように
  const hasParty = STATE.party && STATE.party.members && STATE.party.members.length > 0;
  const partySize = hasParty ? STATE.party.members.length : 0;
  const isAlreadyHero = hasParty && partyIdx >= 0 && partyIdx === (STATE.party.hero || 0);
  const isInParty = partyIdx >= 0;
  const isFull = partySize >= 4;
  const canRecruit = hasParty && !isFull && partyIdx < 0;
  const actionBtns = [];
  // 現パーティ状態 ── 4枠を常に表示・タップで入替
  if (hasParty) {
    const partyGrid = el('div', { style:{
      display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'4px',
      padding:'6px', background:'rgba(135,206,235,.08)', border:'1px solid rgba(135,206,235,.2)',
      borderRadius:'6px',
    } });
    for (let i = 0; i < 4; i++) {
      const m = STATE.party.members[i];
      const isHero = i === (STATE.party.hero || 0);
      if (m) {
        partyGrid.appendChild(el('button', {
          style:{
            padding:'8px 4px', borderRadius:'6px', cursor:'pointer',
            background: isHero ? 'rgba(240,212,138,.18)' : 'rgba(255,255,255,.06)',
            border:'1px solid ' + (isHero ? 'rgba(240,212,138,.5)' : 'rgba(255,255,255,.15)'),
            color: isHero ? '#f0d48a' : 'var(--ink)', fontWeight:700,
            display:'flex', flexDirection:'column', alignItems:'center', gap:'2px',
          },
          title: isHero ? `★リーダー ${m.char}（Lv.${m.level}） ・ タップで ${c} と入替` : `${m.char}（Lv.${m.level}） ・ タップで ${c} と入替`,
          onclick: () => {
            if (m.char === c) { toast('同じ字です'); return; }
            if (!confirm(`${m.char}（Lv.${m.level}）を外して ${c} を加える？\n（${m.char} の Lv は保持され、いつでも復帰可）`)) return;
            preserveMemberLevels([m]);
            invalidateAggCache();
            STATE.party.members[i] = buildMemberFor(c, rarity, isHero);
            if (isHero) STATE.party.hero = i;
            saveState();
            renderParty();
            updateProgressPill();
            toast(`${m.char} → ${c} 入替完了`, rarity);
            $$('.char-detail-pop').forEach(e => e.remove());
            renderCodex();
          },
        },
          el('span', { style:{ fontSize:'1.1rem', fontFamily:"'Noto Serif JP',serif" } }, (isHero ? '★' : '') + m.char),
          el('span', { style:{ fontSize:'.6rem', opacity:.8 } }, `Lv.${m.level}`),
        ));
      } else {
        partyGrid.appendChild(el('button', {
          style:{
            padding:'8px 4px', borderRadius:'6px', cursor:'pointer',
            background:'rgba(255,255,255,.02)', border:'1px dashed rgba(255,255,255,.15)',
            color:'var(--ink-mute)', fontSize:'.7rem',
            display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', minHeight:'44px',
          },
          title:`空き枠 ・ タップで ${c} を加入`,
          onclick: () => {
            if (recruitToParty(c, rarity)) {
              $$('.char-detail-pop').forEach(e => e.remove());
              renderCodex();
            }
          },
        },
          el('span', { style:{ fontSize:'1rem' } }, '＋'),
          el('span', { style:{ fontSize:'.55rem' } }, '空き'),
        ));
      }
    }
    actionBtns.push(el('div', { style:{ fontSize:'.68rem', color:'var(--ink-mute)', textAlign:'center', marginBottom:'2px' } }, `現パーティ ${partySize}/4 ・ 枠タップで入替／加入`));
    actionBtns.push(partyGrid);
  }
  if (!hasParty) {
    actionBtns.push(el('button', {
      class:'cd-recruit cd-leader-btn',
      style:{ background:'linear-gradient(135deg,#f0d48a,#d4a84a)', color:'#1a1208', fontWeight:700, padding:'12px', fontSize:'.95rem' },
      onclick: () => {
        if (setAsLeader(c, rarity)) {
          $$('.char-detail-pop').forEach(e => e.remove());
          renderCodex();
        }
      },
    }, `★ ${c} を主人公にして始める`));
  } else if (isAlreadyHero) {
    actionBtns.push(el('div', { class:'cd-leader-already', style:{ padding:'8px', textAlign:'center', color:'var(--gold)', fontWeight:700, background:'rgba(240,212,138,.1)', borderRadius:'6px', fontSize:'.85rem' } }, `★ ${c} は現リーダー`));
  } else if (isInParty) {
    actionBtns.push(el('button', {
      class:'cd-recruit cd-leader-btn',
      style:{ background:'linear-gradient(135deg,#f0d48a,#d4a84a)', color:'#1a1208', fontWeight:700, padding:'10px' },
      onclick: () => {
        if (setAsLeader(c, rarity)) {
          $$('.char-detail-pop').forEach(e => e.remove());
          renderCodex();
        }
      },
    }, `★ ${c} をリーダーに昇格`));
  }
  // 空き加入／メンバー入替は上の 4 枠グリッドで完結（重複ボタン削除）
  // v10n8: ★ お気に入りボタン
  actionBtns.push(el('button', {
    class:'cd-fav-btn',
    style:{
      padding:'6px 10px', borderRadius:'6px', fontSize:'.78rem', cursor:'pointer',
      background: isFavoriteChar(c) ? 'rgba(240,212,138,.22)' : 'rgba(255,255,255,.05)',
      border: '1px solid ' + (isFavoriteChar(c) ? 'rgba(240,212,138,.55)' : 'rgba(255,255,255,.12)'),
      color: isFavoriteChar(c) ? '#f0d48a' : 'var(--ink-mute)',
    },
    onclick: () => {
      toggleFavoriteChar(c);
      $$('.char-detail-pop').forEach(e => e.remove());
      showCharDetail(c, rarity);
    },
  }, isFavoriteChar(c) ? '★ お気に入り' : '☆ お気に入りに追加'));
  // v1.5.13: 字ごと表示スタイル切替
  const curStyle = STATE.charDisplayStyle?.[c] || 'auto';
  const styleOptions = [
    ['auto', '自動（Lv連動）'],
    ['plain', '無装飾（Lv 隠す）'],
    ['lvband-novice', '青光'],
    ['lvband-adept', '青強'],
    ['lvband-master', '金光'],
    ['lvband-cosmic', '紫光'],
    ['lvband-divine', '七彩'],
  ];
  const styleRow = el('div', { style:{ display:'flex', gap:'4px', flexWrap:'wrap', marginTop:'4px' } });
  styleOptions.forEach(([key, lbl]) => {
    const active = curStyle === key;
    styleRow.appendChild(el('button', {
      style:{
        padding:'4px 8px', fontSize:'.66rem', borderRadius:'4px', cursor:'pointer',
        background: active ? 'rgba(240,212,138,.25)' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.12)'),
        color: active ? '#f0d48a' : 'var(--ink-mute)',
        fontWeight: active ? 700 : 400,
      },
      onclick: (e) => {
        e.stopPropagation();
        setCharDisplayStyle(c, key);
        $$('.char-detail-pop').forEach(p => p.remove());
        showCharDetail(c, rarity);
      },
    }, lbl));
  });
  actionBtns.push(el('div', {},
    el('div', { style:{ fontSize:'.68rem', color:'var(--ink-mute)', marginTop:'4px' } }, '表示スタイル'),
    styleRow
  ));
  const recruitBtn = actionBtns.length > 0
    ? el('div', { class:'cd-actions', style:{ display:'flex', flexDirection:'column', gap:'6px', margin:'8px 0' } }, ...actionBtns)
    : null;

  // 関連熟語 ── 未解放は ？？？ マスク（ネタバレ防止）
  const recipeNodes = recipes.slice(0, 10).map(r => {
    const rrIdx = RARITY_TIERS.indexOf(r.rarity);
    const found = (STATE.discoveredYoji && STATE.discoveredYoji[r.word])
      || (r.chars || []).every(ch => (STATE.collection[ch] || 0) > 0);
    const label = found ? r.word : '？'.repeat(Math.max(2, r.word.length));
    return el('span', {
      class:`cd-recipe rarity-${rrIdx + 1}` + (found ? '' : ' locked'),
      title: found ? (r.desc || r.word) : '未解放：構成字を集めると見える',
      style:{ cursor:'pointer', opacity: found ? 1 : 0.55 },
      onclick: (e) => { e.stopPropagation(); showYojiDetail(r); },
    }, label);
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
    // v1.5.38: 限界突破ボタン（パーティ内の字 & MAX 到達 or 上限+10 ロック解除候補）
    (() => {
      const rIdx = Math.max(0, RARITY_TIERS.indexOf(rarity));
      const cost = (rIdx + 1) * 5;
      const owned = (STATE.stock || {})[c] || 0;
      const boost = (STATE.charCapBoost && STATE.charCapBoost[c]) || 0;
      const baseCap = rarityLvCap(rarity);
      const totalCap = baseCap + boost;
      const showBtn = member ? true : (owned >= cost);
      if (!showBtn && boost === 0) return null;
      return el('div', { style:{
        padding:'8px 10px', background:'rgba(155,120,200,.08)',
        border:'1px solid rgba(155,120,200,.3)', borderRadius:'6px',
        fontSize:'.72rem', display:'flex', flexDirection:'column', gap:'4px',
      } },
        el('div', { style:{ color:'#c8a8ff', fontWeight:700 } },
          `Lv 上限 ${totalCap}（基本 ${baseCap}${boost > 0 ? ` +突破 ${boost}` : ''}）`),
        el('button', {
          style:{
            padding:'6px 10px', borderRadius:'5px', cursor: owned >= cost ? 'pointer' : 'not-allowed',
            background: owned >= cost ? 'linear-gradient(135deg,#5b3a8c,#8b5fc8)' : 'rgba(255,255,255,.05)',
            color: owned >= cost ? '#fff' : 'var(--ink-mute)',
            border:'1px solid rgba(155,120,200,.4)', fontWeight:700, fontSize:'.7rem',
          },
          disabled: owned < cost,
          onclick: () => {
            if (limitBreakChar(c, rarity)) {
              $$('.char-detail-pop').forEach(p => p.remove());
              showCharDetail(c, rarity);
            }
          },
        }, owned >= cost ? `限界突破 ・ ${c}×${cost} 消費で Lv上限 +10` : `限界突破には ${c}×${cost} 必要（${owned}/${cost}）`),
      );
    })(),
    // v1.5.35: 字ステータス（速/力/命/結）
    (() => {
      const s = getCharStats(c);
      const bar = (n) => '●'.repeat(n) + '○'.repeat(5 - n);
      return el('div', { style:{
        display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'4px 10px',
        padding:'6px 10px', background:'rgba(135,206,235,.06)',
        border:'1px solid rgba(135,206,235,.2)', borderRadius:'6px',
        fontSize:'.72rem', color:'var(--ink-mute)', fontFamily:'monospace',
      } },
        el('span', { title:'落下速度' }, `速 ${bar(s.speed)}`),
        el('span', { title:'EXP 倍率' }, `力 ${bar(s.power)}`),
        el('span', { title:'寿命' }, `命 ${bar(s.life)}`),
        el('span', { title:'融合範囲' }, `結 ${bar(s.bond)}`),
      );
    })(),
    member ? el('div', { class:'cd-party' },
      `パーティ字 ・ Lv.${member.level} ・ ${(member.perks||[]).map(pid=>PERKS[pid]?.name).filter(Boolean).join('・')}`
    ) : null,
    recruitBtn,
    recipes.length > 0 ? el('div', { class:'cd-recipes' },
      el('div', { class:'cd-recipes-title' }, ` 関連熟語 ${recipes.length} 件${recipes.length > 10 ? '（上位10）' : ''}`),
      el('div', { class:'cd-recipes-list' }, ...recipeNodes)
    ) : el('div', { class:'cd-recipes-empty' }, '関連熟語なし'),
  );
  // v1.5.21: body 直下に追加してモーダルより上に
  const backdrop = el('div', { class:'cd-backdrop', style:{
    position:'fixed', inset:'0', background:'rgba(0,0,0,.4)', zIndex:499,
  }, onclick: () => { backdrop.remove(); pop.remove(); } });
  document.body.appendChild(backdrop);
  document.body.appendChild(pop);
  pop._backdrop = backdrop;
  const origRemove = pop.remove.bind(pop);
  pop.remove = () => { try { backdrop.remove(); } catch(_){} origRemove(); };
}
function renderCodex() {
  // v10n12: フィルタサマリーを毎回更新
  try { renderCodexFilterSummary(); } catch(_) {}
  const grid = $('#codex-grid');
  const scrollY = grid?.scrollTop || 0;  // フィルタ変更時のスクロール位置維持
  grid.innerHTML = '';
  const codex = window.KANJI_CODEX || [];
  const onlyShow = (tierIdx) =>
    codexFilter.tier === 'all' || String(tierIdx) === codexFilter.tier;
  const seasonMatch = (k) =>
    codexFilter.season === 'all' || (k.season || 'S1') === codexFilter.season;

  // 熟語の発見判定 ── 構成字全て発見済 or パーティで一度コンボ発動済
  const isYojiDiscovered = (r) => {
    if (!r || !r.chars) return false;
    if (STATE.discoveredYoji && STATE.discoveredYoji[r.word]) return true;
    return r.chars.every(c => (STATE.collection[c] || 0) > 0);
  };

  // v10n13: パッシブ図鑑
  if (codexFilter.season === 'PASSIVES') {
    const active = new Set(getActivePassives().map(p => p.id));
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' },
        ` パッシブ ── 常時発動の弱効果（${active.size} / ${PASSIVES.length} 発動中）`
      )
    );
    const list = el('div', { class:'codex-yoji-list' });
    PASSIVES.forEach(p => {
      const on = active.has(p.id);
      const card = el('div', {
        class: 'codex-yoji-card' + (on ? ' yoji-found' : ' yoji-locked'),
        style:{
          padding:'10px 12px', marginBottom:'6px',
          background: on ? 'linear-gradient(90deg, rgba(135,206,235,.16), rgba(135,206,235,.04))' : 'rgba(255,255,255,.03)',
          border:'1px solid ' + (on ? 'rgba(135,206,235,.35)' : 'rgba(255,255,255,.08)'),
          borderRadius:'8px',
          display:'flex', alignItems:'center', gap:'10px',
          cursor:'pointer',
        },
        onclick: () => showPassiveDetail(p, on),
      },
        el('div', { style:{ fontSize:'1.6rem', minWidth:'32px', textAlign:'center', opacity: on ? 1 : 0.4 } }, p.icon || '◆'),
        el('div', { style:{ flex:1, minWidth:0 } },
          el('div', { style:{ fontWeight:700, fontSize:'.9rem', color: on ? '#cfe6ff' : 'var(--ink-mute)' } },
            (on ? '✓ ' : '× ') + p.name
          ),
          el('div', { style:{ fontSize:'.74rem', color:'var(--ink-mute)', lineHeight:1.4 } }, p.desc),
        ),
      );
      list.appendChild(card);
    });
    section.appendChild(list);
    grid.appendChild(section);
    grid.scrollTop = scrollY;
    return;
  }

  // 特性図鑑：全 PERKS をカードで表示
  if (codexFilter.season === 'PERKS') {
    const perks = Object.entries(PERKS);
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' }, ` 特性図鑑（${perks.length} 個 ・ 字をストックして育つ）`)
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
    let ownedCnt = 0;
    perks.forEach(([pid, p]) => {
      const lv = perkLv(pid);
      const cat = p.category || 'basic';
      const isRare = cat === 'rare';
      const isSpecial = cat === 'special';
      const isOwned = ownedPerks.has(pid);
      if (isOwned) ownedCnt++;
      const catLabel = {
        basic:'基本', tag:'タグ系', rare:' レア', special:'主人公専用',
      }[cat] || cat;
      // 未獲得：名前・効果を「???」でマスク。カテゴリと「入手方法」だけ見せる
      const displayName = isOwned
        ? ((isRare ? ' ' : isSpecial ? '★ ' : '') + p.name)
        : '？？？';
      const displayDesc = isOwned ? (p.desc || '') : '─ 入手して効果を確認 ─';
      const card = el('div', { class:'perk-card cat-' + cat + (isRare ? ' rare' : '') + (isOwned ? ' owned' : ' locked') },
        el('div', { class:'pck-head' },
          el('span', { class:'pck-name' }, displayName),
          el('span', { class:'pck-lv' }, isOwned ? `Lv.${lv}` : '未獲得'),
        ),
        el('div', { class:'pck-cat' }, catLabel),
        el('div', { class:'pck-desc' }, displayDesc),
        el('div', { class:'pck-grow' },
          isOwned
            ? (p.tag ? `育て方：「${p.tag}」タグの字をストック → +1/個`
                    : isSpecial ? '主人公にすると自動付与'
                    : isRare ? '★8 以降の字を仲間にすると抽選で付与（★16 で確定）'
                    : '育て方：どの字でもストック → +0.5/個（累積）')
            : (isSpecial ? '入手：主人公を選ぶと自動付与'
                : isRare ? '入手：★8 以降の字を仲間にすると抽選'
                : '入手：パーティ字の属性で自動付与')
        ),
      );
      list.appendChild(card);
    });
    section.appendChild(list);
    grid.appendChild(section);
    $('#codex-summary').textContent = `特性 ${ownedCnt} / ${perks.length} 解放`;
    return;
  }

  // S3/S4/S5/S6/S7（熟語シーズン）が選ばれているときは熟語をリスト表示
  if (['S3','S4','S5','S6','S7'].includes(codexFilter.season)) {
    let recipes = (window.YOJI_RECIPES || []).filter(r => r.season === codexFilter.season);
    // タグフィルタ：選択中なら抽出
    if (codexFilter.tag) {
      recipes = recipes.filter(r => (r.tags || []).includes(codexFilter.tag));
    }
    // 検索クエリでフィルタ
    if (codexFilter.query) {
      const q = codexFilter.query.toLowerCase();
      recipes = recipes.filter(r => {
        if ((r.word || '').toLowerCase().includes(q)) return true;
        if ((r.desc || '').toLowerCase().includes(q)) return true;
        if ((r.tags || []).some(t => t.toLowerCase().includes(q))) return true;
        if ((r.chars || []).some(c => c.includes(q))) return true;
        return false;
      });
    }
    // 「発見済のみ」フィルタ
    if (codexFilter.onlySeen) {
      recipes = recipes.filter(r => isYojiDiscovered(r));
    }
    // v10n8: 「★ お気に入りのみ」フィルタ
    if (codexFilter.onlyFavorite) {
      recipes = recipes.filter(r => isFavoriteYoji(r.word));
    }
    // ソート：レア度（高→低）→ 字数（多→少）
    recipes.sort((a, b) => {
      const ra = RARITY_TIERS.indexOf(a.rarity);
      const rb = RARITY_TIERS.indexOf(b.rarity);
      if (ra !== rb) return rb - ra;
      return (b.chars?.length || 0) - (a.chars?.length || 0);
    });
    const SEASON_LABEL = {
      S3:'二字熟語', S4:'四字熟語',
      S5:'昭和文化', S6:'令和現代', S7:'未来（萌芽）'
    };
    // v1.5.15: 発見率を tier 同様に表示＋進捗バー
    const seasonRecipes = (window.YOJI_RECIPES || []).filter(r => r.season === codexFilter.season);
    const seasonSeen = seasonRecipes.filter(r => isYojiDiscovered(r)).length;
    const seasonTotal = seasonRecipes.length;
    const seasonPct = seasonTotal > 0 ? Math.round(seasonSeen / seasonTotal * 100) : 0;
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' },
        `${codexFilter.season} ${SEASON_LABEL[codexFilter.season] || ''}（${seasonSeen} / ${seasonTotal} 解放 ・ ${seasonPct}%）`)
    );
    section.appendChild(el('div', { class:'codex-progress-bar' },
      el('div', { class:'cpb-fill', style:{ width: seasonPct + '%' } })
    ));
    const list = el('div', { class:'codex-yoji-list' });
    let foundCnt = 0;
    recipes.forEach(r => {
      const rIdx = RARITY_TIERS.indexOf(r.rarity);
      const found = isYojiDiscovered(r);
      if (found) foundCnt++;
      // 未発見：字を全部「？」にする ・ desc も隠す
      const mask = '？'.repeat(Math.max(2, (r.word || '').length));
      const wordText  = found ? r.word : mask;
      // 進捗：構成字のうち発見済の割合
      const seenChars = (r.chars || []).filter(c => (STATE.collection[c]||0) > 0).length;
      const totalChars = (r.chars || []).length;
      const progText = !found && totalChars > 0 ? ` (${seenChars}/${totalChars})` : '';
      const metaText  = found ? `${r.rarity} ${r.desc || ''}` : `${r.rarity} ─ 構成字を集めると解放${progText}`;
      const item = el('div', {
        class:`codex-yoji-item rarity-${rIdx+1}` + (found ? ' found' : ' locked'),
        onclick: () => showYojiDetail(r),
      },
        el('span', { class:'cy-text' }, wordText),
        el('span', { class:'cy-meta' }, metaText)
      );
      list.appendChild(item);
    });
    section.appendChild(list);
    // セクション見出しに発見率を追記＋進捗バー
    const head = section.querySelector('.codex-section-title');
    const pct = recipes.length > 0 ? Math.round(foundCnt / recipes.length * 100) : 0;
    if (head) head.textContent = head.textContent.replace(/（[^）]*）$/, `（${foundCnt} / ${recipes.length} 発見 ・ ${pct}%）`);
    const bar = el('div', { class:'codex-progress-bar' },
      el('div', { class:'cpb-fill', style:{ width: pct + '%' } })
    );
    section.insertBefore(bar, list);
    // タグフィルタ pill 行（このシーズンに登場するタグから動的生成）
    const allRecipes = (window.YOJI_RECIPES || []).filter(r => r.season === codexFilter.season);
    const tagCounts = {};
    for (const r of allRecipes) {
      for (const t of (r.tags || [])) {
        if (t === '四字熟語') continue;  // 全部に付くので除外
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 12);
    if (topTags.length > 0) {
      const tagRow = el('div', { class:'codex-tag-row' },
        el('button', {
          class:'codex-tag-pill' + (!codexFilter.tag ? ' active' : ''),
          onclick: () => { codexFilter.tag = null; renderCodex(); },
        }, '全タグ'),
        ...topTags.map(([t, n]) => el('button', {
          class:'codex-tag-pill' + (codexFilter.tag === t ? ' active' : ''),
          onclick: () => { codexFilter.tag = t; renderCodex(); },
        }, `${t} ${n}`)),
      );
      section.insertBefore(tagRow, bar);
    }
    grid.appendChild(section);
    const discovered = Object.keys(STATE.collection).length;
    const totalKanji = codex.length;
    $('#codex-summary').textContent = `発見 ${discovered} / ${totalKanji} 字 ／ 熟語 ${foundCnt} / ${recipes.length}`;
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

  const scriptMatch = (k) => matchesScript(k.char || k.c, codexFilter.script);

  // 🚀 v10n 最適化：tier 別キャッシュ（41,890 字を 1 回でグループ化）
  if (!window._tierCache || window._tierCache.codexLen !== codex.length) {
    const byTier = {};
    for (const k of codex) {
      (byTier[k.rarity] ||= []).push(k);
    }
    window._tierCache = { codexLen: codex.length, byTier };
  }

  // v1.1.9: 図鑑の重さ大幅軽減 ── CAP 800 → 200（16 tier × 200 = 3200 cells max）
  const CELL_CAP = 600;  // v1.4.4: 「全て」選択時の初期表示を広く
  if (!window._tierExpanded) window._tierExpanded = {};

  // DocumentFragment で reflow を 1 回に圧縮
  const frag = document.createDocumentFragment();

  RARITY_TIERS.forEach((tier, tierIdx) => {
    if (!onlyShow(tierIdx)) return;
    const tierAll = window._tierCache.byTier[tier] || [];
    const tierKanji = tierAll.filter(k => seasonMatch(k) && scriptMatch(k) && matchQuery(k));
    const visible = tierKanji.filter(k => {
      const c = k.char || k.c;
      if (codexFilter.onlySeen && !((STATE.collection[c] || 0) > 0)) return false;
      if (codexFilter.onlyFavorite && !isFavoriteChar(c)) return false;
      return true;
    });
    if (!visible.length) return;
    // 未解放の上位ティアは「???」でマスク（達成名・帯名すら隠して解放欲を煽る）
    const isUnrevealed = tierIdx > STATE.unlockedTier;
    const tierLabel = isUnrevealed ? '？？？' : tier;
    const achievement = isUnrevealed ? '─ 未解放の領域 ─' : TIER_ACHIEVEMENT[tierIdx];
    // 発見率（visible ではなく全体で）
    let seenCnt = 0;
    for (const k of tierKanji) if ((STATE.collection[k.char||k.c]||0) > 0) seenCnt++;
    const tPct = tierKanji.length > 0 ? Math.round(seenCnt / tierKanji.length * 100) : 0;
    const stateText = tierIdx <= STATE.unlockedTier
      ? `${seenCnt} / ${tierKanji.length} 発見 ・ ${tPct}%`
      : '× Lv.' + UNLOCK_LV[tier];
    const section = el('div', { class:'codex-section' + (isUnrevealed ? ' tier-locked' : '') },
      el('h3', { class:'codex-section-title' },
        `${tierLabel} ${achievement} （${stateText}）`)
    );
    // 解放済セクションだけ進捗バーを足す
    if (!isUnrevealed && tierKanji.length > 0) {
      const bar = el('div', { class:'codex-progress-bar' },
        el('div', { class:'cpb-fill', style:{ width: tPct + '%' } })
      );
      section.appendChild(bar);
    }
    // 🚀 表示上限を適用（明示展開済なら全件、未展開ならキャップ）
    const expanded = !!window._tierExpanded[tier];
    const renderList = (visible.length > CELL_CAP && !expanded) ? visible.slice(0, CELL_CAP) : visible;
    const truncated = visible.length - renderList.length;
    const tierGrid = el('div', { class:'codex-tier-grid' });
    const tierFrag = document.createDocumentFragment();
    // v1.1.9: イベント委譲で listener 数を 3200 → 1 に削減
    const charToRarity = {};
    for (const k of renderList) {
      const c = k.char || k.c;
      const seen = STATE.collection[c] || 0;
      const partyIdx = partyContainsChar(c);
      const cls = `codex-cell rarity-${tierIdx + 1}` +
                  (seen ? ' seen' : '') +
                  (partyIdx >= 0 ? ' in-party' : '') +
                  (tierIdx > STATE.unlockedTier ? ' locked' : '');
      const cellText = tierIdx > STATE.unlockedTier && !seen ? '?' : c;
      const cell = document.createElement('div');
      cell.className = cls;
      cell.title = seen ? `${c}（${seen}回発見）` : '？';
      cell.textContent = cellText;
      cell.dataset.char = c;
      cell.dataset.seen = seen ? '1' : '0';
      charToRarity[c] = k.rarity;
      // v1.4.4: 育成済 Lv バッジ（charLevels から）
      const stored = STATE.charLevels?.[c];
      if (stored?.level && stored.level > 1) {
        const lvBadge = document.createElement('span');
        lvBadge.className = 'codex-lv-badge';
        lvBadge.textContent = 'L' + stored.level;
        cell.appendChild(lvBadge);
      }
      tierFrag.appendChild(cell);
    }
    tierGrid.appendChild(tierFrag);
    tierGrid.addEventListener('click', (e) => {
      const cell = e.target.closest('.codex-cell');
      if (!cell) return;
      const c = cell.dataset.char;
      if (!c) return;
      if (cell.dataset.seen === '1') showCharDetail(c, charToRarity[c]);
      else {
        const tierLocked = cell.classList.contains('locked');
        toast(tierLocked
          ? `★${(STATE.unlockedTier||0)+1} 帯までしか開放されていません ・ リーダーを育てて解放`
          : `未発見 ・ ${charToRarity[c] || '★?'} 帯 ・ 降ってくれば自動発見`);
      }
    });
    section.appendChild(tierGrid);
    // 切り捨て分の「もっと見る」ボタン
    if (truncated > 0) {
      const moreBtn = el('button', {
        class:'codex-more-btn',
        onclick: () => { window._tierExpanded[tier] = true; renderCodex(); },
      }, `▼ 残り ${truncated.toLocaleString()} 字を表示`);
      section.appendChild(moreBtn);
    }
    frag.appendChild(section);
  });
  grid.appendChild(frag);

  const discovered = Object.keys(STATE.collection).length;
  const totalKanji = codex.length;
  $('#codex-summary').textContent = `発見 ${discovered} / ${totalKanji} 字`;
  // スクロール位置復元（フィルタ切替で「最初に戻る」を防ぐ）
  if (grid && scrollY > 0) {
    requestAnimationFrame(() => { grid.scrollTop = scrollY; });
  }
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
    STATE.mode === 'work'   ? '作業中' :
    STATE.mode === 'rest'   ? '休憩中' :
    STATE.mode === 'paused' ? '一時停止' :
    '待機';
  bandEl.textContent = `${modeLabel} ・ ${tierName}帯 ${achName}`;
  const streak = STATE.streak?.current || 0;
  const streakStr = streak > 0 ? `継続${streak}日 ・ ` : '';
  // v10n17: セット進捗（target>0 かつ作業/休憩中）
  const tgt = STATE.timer?.setsTarget || 0;
  const done = STATE.timer?.setsDone || 0;
  const setsStr = (tgt > 0 && (STATE.mode === 'work' || STATE.mode === 'rest'))
    ? `${done + (STATE.mode === 'work' ? 1 : 0)}/${tgt}セット ・ ` : '';
  cycEl.textContent = `${setsStr}${streakStr}${STATE.stats.totalCycles || 0} 回完了`;
  // リーダー Lv ＋ 次解放までの差分
  const ldrEl = $('#pp-leader');
  if (ldrEl) {
    if (isPartyChosen()) {
      const hero = STATE.party.members[STATE.party.hero || 0];
      const nextTierName = RARITY_TIERS[tier + 1];
      const nextLv = nextTierName ? UNLOCK_LV[nextTierName] : null;
      const remain = nextLv != null ? nextLv - hero.level : null;
      ldrEl.textContent = `${hero.char} Lv.${hero.level}`;
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
  // 🛟 v10n 最終バックアップ警告 ── 何十年遊ぶための安全網
  updateBackupStatus();
  const list = $('#stats-list');
  const discovered = Object.keys(STATE.collection || {}).length;
  const totalKanji = (window.KANJI_CODEX || []).length;
  const heroLv = isPartyChosen() ? partyHeroLevel() : 0;
  const partyAvg = isPartyChosen() ? Math.round(partyAverageLevel() * 10) / 10 : 0;
  const heroChar = isPartyChosen() ? STATE.party.members[STATE.party.hero || 0]?.char || '—' : '—';
  const totalStock = Object.values(STATE.stock || {}).reduce((a,b)=>a+b, 0);
  const writings = (STATE.writings || []).length;
  // 特性 Lv トップ 3（perkLevels に蓄積された raw 累計でソート ・ 表示は perkLv 経由 Lv1+）
  const topPerks = Object.entries(STATE.perkLevels || {})
    .filter(([pid, raw]) => raw >= 1 && PERKS[pid])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([pid]) => `${PERKS[pid].name} Lv.${perkLv(pid)}`)
    .join(' / ') || '─';
  // 解放した熟語の数
  const totalYoji = (window.YOJI_RECIPES || []).length;
  const unlockedYoji = Object.keys(STATE.discoveredYoji || {}).length;
  // 特性総数 vs 獲得数
  const totalPerks = Object.keys(PERKS || {}).length;
  const ownedPerks = new Set();
  if (STATE.party && STATE.party.members) {
    for (const m of STATE.party.members) for (const pid of (m.perks||[])) ownedPerks.add(pid);
  }
  list.innerHTML = '';
  const cells = [
    { label:'累計サイクル', value: STATE.stats.totalCycles || 0 },
    { label:'連続日数', value: `${STATE.streak?.current || 0} 日（最長 ${STATE.streak?.longest || 0}）` },
    { label:'🛡 ストリークフリーズ', value: `${STATE.streakFreezes || 0} / 3（10日毎+1 ・ 1日休み救済）` },
    { label:'累計ぽもじ', value: STATE.stats.totalDrops || 0 },
    { label:'累計 EXP', value: (STATE.stats.totalExp || 0).toLocaleString() },
    { label:'🌏 世界の文字', value: `${discovered.toLocaleString()} / ${totalKanji.toLocaleString()}（${(discovered/totalKanji*100).toFixed(2)}%）`, span:2 },
    { label:'解放熟語', value: `${unlockedYoji.toLocaleString()} / ${totalYoji.toLocaleString()}` },
    { label:'獲得特性', value: `${ownedPerks.size} / ${totalPerks}` },
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

  // 解放ティア表示（発見字数 N/M も併記）
  const tiers = $('#stats-tiers');
  tiers.innerHTML = '';
  const codex = window.KANJI_CODEX || [];
  // v10n20: ティア別を 1 パスで集計（41890 件 × 16 回 filter を解消）
  const _tierMap = {};
  for (const k of codex) {
    const r = k.rarity || '★1';
    if (!_tierMap[r]) _tierMap[r] = [];
    _tierMap[r].push(k);
  }
  RARITY_TIERS.forEach((tier, i) => {
    const unlocked = i <= STATE.unlockedTier;
    const tierChars = _tierMap[tier] || [];
    const seenN = tierChars.filter(k => (STATE.collection[k.char||k.c]||0) > 0).length;
    const totalN = tierChars.length;
    const pct = totalN > 0 ? Math.round(seenN / totalN * 100) : 0;
    const statusText = unlocked
      ? (totalN > 0 ? `${seenN} / ${totalN}（${pct}%）` : '─')
      : `Lv.${UNLOCK_LV[tier]} 必要`;
    const row = el('div', { class: `stats-tier-row rarity-${i+1}${unlocked ? ' unlocked' : ' locked'}` },
      el('span', { class:'str-name' }, `${tier} ${TIER_ACHIEVEMENT[i]}`),
      el('span', { class: 'str-status' + (unlocked ? ' ok' : '') }, statusText)
    );
    // 進捗バーを追加（解放済のみ）
    if (unlocked && totalN > 0) {
      row.appendChild(el('div', { class:'str-bar' },
        el('div', { class:'str-bar-fill', style: { width: pct + '%' } })
      ));
    }
    tiers.appendChild(row);
  });

  // 過去 30 日のヒートマップ
  const heatZone = $('#stats-heatmap') || (() => {
    const z = el('div', { class:'stats-heatmap-zone', id:'stats-heatmap' });
    tiers.parentElement?.insertBefore(z, tiers.nextSibling);
    return z;
  })();
  heatZone.innerHTML = '';
  heatZone.appendChild(el('h3', { class:'stats-section-title' }, '過去 30 日のサイクル'));
  const today = new Date();
  const heatGrid = el('div', { class:'heat-grid' });
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const cnt = (STATE.dailyCycles || {})[key] || 0;
    const lvl = cnt === 0 ? 0 : cnt < 2 ? 1 : cnt < 5 ? 2 : cnt < 10 ? 3 : 4;
    const cell = el('div', {
      class: `heat-cell heat-lv-${lvl}`,
      title: `${key}: ${cnt} 回`,
    });
    heatGrid.appendChild(cell);
  }
  heatZone.appendChild(heatGrid);
  heatZone.appendChild(el('div', { class:'heat-legend' },
    el('span', {}, '少'),
    el('span', { class:'heat-cell heat-lv-0' }),
    el('span', { class:'heat-cell heat-lv-1' }),
    el('span', { class:'heat-cell heat-lv-2' }),
    el('span', { class:'heat-cell heat-lv-3' }),
    el('span', { class:'heat-cell heat-lv-4' }),
    el('span', {}, '多')
  ));

  // 🌏 文字種別 達成率サマリー（v10n / 2026-05-18）── 17系統を一覧
  const scriptZone = $('#stats-scripts') || (() => {
    const z = el('div', { class:'stats-scripts-zone', id:'stats-scripts' });
    heatZone.parentElement?.insertBefore(z, heatZone.nextSibling);
    return z;
  })();
  scriptZone.innerHTML = '';
  scriptZone.appendChild(el('h3', { class:'stats-section-title' }, '🌏 文字種別 達成率'));
  const scriptDefs = [
    { key:'hiragana',   label:'ひらがな',        icon:'あ' },
    { key:'katakana',   label:'カタカナ',        icon:'ア' },
    { key:'kanji',      label:'漢字',            icon:'漢' },
    { key:'hangul',     label:'ハングル',        icon:'한' },
    { key:'greek',      label:'ギリシャ',        icon:'Ω' },
    { key:'cyrillic',   label:'キリル',          icon:'Я' },
    { key:'arabic',     label:'アラビア',        icon:'ع' },
    { key:'hebrew',     label:'ヘブライ',        icon:'א' },
    { key:'devanagari', label:'デーヴァナーガリー', icon:'अ' },
    { key:'thai',       label:'タイ',            icon:'ก' },
    { key:'tibetan',    label:'チベット',        icon:'ཀ' },
    { key:'georgian',   label:'ジョージア',      icon:'ა' },
    { key:'ethiopic',   label:'エチオピア',      icon:'አ' },
    { key:'canadian',   label:'カナダ先住民',    icon:'ᐃ' },
    { key:'runic',      label:'ルーン',          icon:'ᚠ' },
    { key:'ancient',    label:'古代文字',        icon:'𓂀' },
  ];
  const codexAll = window.KANJI_CODEX || [];
  const scriptGrid = el('div', { class:'script-grid' });
  for (const sd of scriptDefs) {
    let total = 0, found = 0;
    for (const k of codexAll) {
      if (matchesScript(k.char || k.c, sd.key)) {
        total++;
        if ((STATE.collection[k.char||k.c] || 0) > 0) found++;
      }
    }
    if (total === 0) continue;
    const pct = total > 0 ? Math.round(found / total * 100) : 0;
    scriptGrid.appendChild(el('div', { class:`script-cell ${found > 0 ? 'started' : ''}${pct === 100 ? ' complete' : ''}` },
      el('div', { class:'script-icon' }, sd.icon),
      el('div', { class:'script-name' }, sd.label),
      el('div', { class:'script-count' }, `${found.toLocaleString()} / ${total.toLocaleString()}`),
      el('div', { class:'script-bar' },
        el('div', { class:'script-bar-fill', style:{ width: pct + '%' } })
      ),
      el('div', { class:'script-pct' }, pct + '%')
    ));
  }
  scriptZone.appendChild(scriptGrid);

  // 最近解放した熟語 ── 達成感の振り返り（最新 6 個）
  const recentZone = $('#stats-recent-yoji') || (() => {
    const z = el('div', { class:'stats-recent-zone', id:'stats-recent-yoji' });
    tiers.parentElement?.insertBefore(z, tiers.nextSibling);
    return z;
  })();
  recentZone.innerHTML = '';
  recentZone.appendChild(el('h3', { class:'stats-section-title' }, '最近解放した熟語'));
  const recent = Object.entries(STATE.discoveredYoji || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word, ts]) => ({ word, ts }));
  if (recent.length === 0) {
    recentZone.appendChild(el('div', { class:'sry-empty' }, 'まだ解放した熟語はありません ・ パーティを組んで字を揃えよう'));
  } else {
    const grid = el('div', { class:'sry-grid' });
    for (const r of recent) {
      const recipe = (window.YOJI_RECIPES || []).find(y => y.word === r.word);
      const rIdx = recipe ? RARITY_TIERS.indexOf(recipe.rarity) : 0;
      grid.appendChild(el('div', {
        class:`sry-item rarity-${rIdx + 1}`,
        onclick: recipe ? () => showYojiDetail(recipe) : null,
        style: recipe ? { cursor: 'pointer' } : {},
      },
        el('span', { class:'sry-word' }, r.word),
        el('span', { class:'sry-rarity' }, recipe?.rarity || '★?')
      ));
    }
    recentZone.appendChild(grid);
  }

  // 長期達成バッジ ── 何十年も遊べる育成型ポモドーロの記憶
  const badgeZone = $('#stats-milestones') || (() => {
    const z = el('div', { class:'stats-milestones-zone', id:'stats-milestones' });
    tiers.parentElement?.insertBefore(z, tiers.nextSibling);
    return z;
  })();
  badgeZone.innerHTML = '';
  const achieved = MILESTONES.filter(m => STATE.milestones?.[m.id]);
  const locked = MILESTONES.filter(m => !STATE.milestones?.[m.id]);
  badgeZone.appendChild(el('h3', { class:'stats-section-title' },
    `🏆 長期達成バッジ（${achieved.length} / ${MILESTONES.length}）`
  ));
  const badgeGrid = el('div', { class:'milestone-grid' });
  // 達成済：時系列順（新→旧）
  achieved
    .sort((a,b) => (STATE.milestones[b.id]||0) - (STATE.milestones[a.id]||0))
    .forEach(m => {
      const d = new Date(STATE.milestones[m.id]);
      const dateStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}`;
      // 達成バッジは tap で当時のセレモニーを再生（v10n2 / 碑として触れる）
      const cell = el('div', {
        class:'milestone-cell achieved',
        title: m.desc + '（タップで再生）',
        style: { cursor:'pointer' },
      },
        el('div', { class:'milestone-icon' }, '🏆'),
        el('div', { class:'milestone-label' }, m.label),
        el('div', { class:'milestone-desc' }, m.desc),
        el('div', { class:'milestone-date' }, dateStr + ' ')
      );
      cell.addEventListener('click', () => {
        try { spawnMilestoneCelebration(m); playSFX('milestone'); } catch(_) {}
      });
      badgeGrid.appendChild(cell);
    });
  // 未達成：「あと少し」順にソート（進捗率の高いものから ── 解放するワクワクを煽る）
  const lockedWithProgress = locked.map(m => {
    const [cur, thr] = m.progress ? m.progress(STATE) : [0, 1];
    const ratio = thr > 0 ? Math.min(1, cur / thr) : 0;
    return { m, cur, thr, ratio };
  }).sort((a, b) => b.ratio - a.ratio);

  lockedWithProgress.forEach(({ m, cur, thr, ratio }) => {
    const pct = Math.round(ratio * 100);
    const remain = Math.max(0, thr - cur);
    badgeGrid.appendChild(el('div', { class:'milestone-cell locked', title: m.desc },
      el('div', { class:'milestone-icon' }, '×'),
      el('div', { class:'milestone-label' }, '？？？'),
      el('div', { class:'milestone-desc' }, m.desc),
      el('div', { class:'milestone-progress-bar' },
        el('div', { class:'mpb-fill', style:{ width: pct + '%' } })
      ),
      el('div', { class:'milestone-date' }, `あと ${remain.toLocaleString()}（${pct}%）`)
    ));
  });
  badgeZone.appendChild(badgeGrid);

  $('#stats-modal').classList.add('show');
}
function closeStats() { $('#stats-modal').classList.remove('show'); }

// ═══════════════════════════════════════════════════════════════
// バックグラウンド対応（v30c）── タイマーは継続、復帰時に 50% ボーナス
// ═══════════════════════════════════════════════════════════════
// v10n14: Wake Lock ── 作業中は画面スリープ抑制
let _wakeLock = null;
async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      if (_wakeLock) return;
      _wakeLock = await navigator.wakeLock.request('screen');
      _wakeLock.addEventListener('release', () => { _wakeLock = null; });
    }
  } catch(_) {}
}
function releaseWakeLock() {
  if (_wakeLock) { _wakeLock.release().catch(()=>{}); _wakeLock = null; }
}

// v10n14: Notification ── サイクル完了をブラウザ通知
// v10n15 fix: セッション内 1 回だけ要求（無駄な呼び出し抑止）
let _notifAskedThisSession = false;
function ensureNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve(false);
  if (Notification.permission === 'granted') return Promise.resolve(true);
  if (Notification.permission === 'denied') return Promise.resolve(false);
  if (_notifAskedThisSession) return Promise.resolve(false);
  _notifAskedThisSession = true;
  return Notification.requestPermission().then(r => r === 'granted');
}
function notifyPhaseComplete(prevMode) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const title = prevMode === 'work' ? '作業完了 ── 休憩へ' : '休憩完了 ── 次のサイクルへ';
    const body  = prevMode === 'work' ? `${Math.floor(STATE.timer.restSec/60)} 分の休憩` : `${Math.floor(STATE.timer.workSec/60)} 分の作業`;
    new Notification(title, {
      body, icon: './icon-192.png', tag: 'pomojikan-phase', renotify: true, silent: false,
    });
  } catch(_) {}
}

// v10n14: Picture-in-Picture ── 小窓タイマー（他アプリ作業中でも見える）
let _pipWindow = null;
let _pipRaf = 0;
async function toggleTimerPiP() {
  if (!('documentPictureInPicture' in window)) {
    toast('小窓 非対応：Chrome/Edge デスクトップで利用可');
    return;
  }
  if (_pipWindow) {
    _pipWindow.close(); _pipWindow = null;
    try { const e = $('#m-pip-state'); if (e) e.textContent = 'オフ'; } catch(_) {}
    return;
  }
  try {
    // v1.4.8: シンプル＆小型化（200x110 → タイマー文字＋小さなドット）
    _pipWindow = await documentPictureInPicture.requestWindow({ width: 200, height: 110 });
    try { const e = $('#m-pip-state'); if (e) e.textContent = 'オン'; } catch(_) {}
    const doc = _pipWindow.document;
    doc.body.style.cssText = `
      margin:0; background:#0a0f18; color:#fff;
      font-family:'JetBrains Mono','SF Mono',monospace; overflow:hidden;
      display:flex; align-items:center; justify-content:center; height:100vh;
      position:relative; gap:10px;
    `;
    doc.body.innerHTML = `
      <span id="pip-dot" style="width:10px;height:10px;border-radius:50%;background:#666;flex:0 0 auto;box-shadow:0 0 0 rgba(0,0,0,0);transition:background .3s,box-shadow .3s;"></span>
      <div id="pip-text" style="font-size:2.6rem;font-weight:800;letter-spacing:.04em;line-height:1;">--:--</div>
      <span id="pip-sets" style="position:absolute;bottom:6px;left:10px;font-size:.6rem;opacity:.6;font-family:sans-serif;color:#cfe6ff;"></span>
      <span id="pip-mode" style="position:absolute;bottom:6px;right:10px;font-size:.6rem;opacity:.55;font-family:sans-serif;">停</span>
      <span id="pip-stop" style="position:absolute;top:4px;right:8px;font-size:.7rem;opacity:.5;cursor:pointer;user-select:none;" title="クリックで停止">×</span>
      <svg id="pip-svg-hidden" style="display:none"><circle id="pip-fg"/></svg>
    `;
    // v1.4.9: PiP からの停止操作
    doc.getElementById('pip-stop')?.addEventListener('click', () => {
      if (STATE.mode === 'measure') stopMeasure();
      else if (STATE.mode === 'work' || STATE.mode === 'rest') stopTimer();
    });
    // v1.5.39: 本体クリック停止は誤操作多いので廃止 ── × ボタンのみ
    doc.body.style.cursor = 'default';
    _pipWindow.addEventListener('pagehide', () => {
      _pipWindow = null;
      clearTimeout(_pipRaf);
      try { const e = $('#m-pip-state'); if (e) e.textContent = 'オフ'; } catch(_) {}
    });
    syncPiP();
    toast('小窓 開始 ── 他アプリ作業中もタイマーが見える');
  } catch(e) {
    toast('小窓 起動失敗: ' + (e.message || ''));
    _pipWindow = null;
  }
}
function syncPiP() {
  if (!_pipWindow) return;
  try {
    const doc = _pipWindow.document;
    const txt = doc.getElementById('pip-text');
    const mode = doc.getElementById('pip-mode');
    const fg = doc.getElementById('pip-fg');
    if (!txt || !mode || !fg) return;
    const dot = doc.getElementById('pip-dot');
    const sets = doc.getElementById('pip-sets');
    // セット進捗（target>0 で work/rest のみ）
    if (sets) {
      const tgt = STATE.timer?.setsTarget || 0;
      const done = STATE.timer?.setsDone || 0;
      sets.textContent = (tgt > 0 && (STATE.mode === 'work' || STATE.mode === 'rest'))
        ? `${done + (STATE.mode === 'work' ? 1 : 0)}/${tgt}set` : '';
    }
    if (STATE.mode === 'measure') {
      const elapsed = Math.floor((Date.now() - STATE.phaseStart) / 1000);
      txt.textContent = fmtTime(elapsed);
      mode.textContent = '計';
      if (dot) { dot.style.background = '#ffd86b'; dot.style.boxShadow = '0 0 8px rgba(255,217,107,.8)'; }
    } else if (STATE.mode === 'work' || STATE.mode === 'rest') {
      const rem = Math.max(0, STATE.phaseEnd - Date.now());
      txt.textContent = fmtTime(Math.ceil(rem/1000));
      mode.textContent = STATE.mode === 'work' ? '集' : '休';
      if (dot) {
        const c = STATE.mode === 'work' ? '#87ceeb' : '#c0a8ff';
        dot.style.background = c;
        dot.style.boxShadow = `0 0 8px ${c}cc`;
      }
    } else {
      txt.textContent = fmtTime(STATE.timer.workSec);
      mode.textContent = '待';
      if (dot) { dot.style.background = '#666'; dot.style.boxShadow = '0 0 0 rgba(0,0,0,0)'; }
    }
  } catch(_) {}
  _pipRaf = setTimeout(syncPiP, 500);
}

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
      if (STATE.mode === 'work' || STATE.mode === 'rest') requestWakeLock();

      // v1.5.0: 復帰時に画面に残ってる rising 字を全て即時 EXP 化（休憩で浮いて消えない問題）
      try {
        for (const p of livePomoji.values()) {
          if (p.rising && !p._awarded) {
            p._awarded = true;
            try { awardRising(p); } catch(_) {}
            try { p.el?.remove(); } catch(_) {}
            livePomoji.delete(p.id);
          }
        }
      } catch(_) {}

      if (wasWorkBeforeHide && hiddenElapsed > WORK_SPAWN_INTERVAL_MS && !_pipWindow) {
        const wouldHaveSpawned = Math.floor(hiddenElapsed / WORK_SPAWN_INTERVAL_MS);
        const bonusCount = Math.min(20, Math.floor(wouldHaveSpawned * 0.5));
        if (bonusCount > 0) offlineBonusCascade(bonusCount);
      }
      saveState();
    } else if (STATE.lastHiddenAt) {
      STATE.lastHiddenAt = null;
    }
  }
}

// v1.5.0: オフラインボーナスを「メッセージ＋ EXP」のみに（字スポーン廃止）
function offlineBonusCascade(count) {
  if (!isPartyChosen()) {
    toast(`おかえり ── オフライン ${count} 粒分`);
    return;
  }
  // リーダーに集約 EXP 付与
  const hero = STATE.party.members[STATE.party.hero || 0];
  const rIdx = RARITY_TIERS.indexOf(hero.rarity);
  const perDrop = Math.max(1, Math.pow(1.3, rIdx) * 3);
  const exp = Math.floor(perDrop * count * 1.5);  // ボーナス係数
  awardExpToParty(hero.char, exp);
  try {
    spawnXpFloat(window.innerWidth/2, 100, exp, hero.rarity);
    toast(`おかえり ── 不在の ${count} 粒を吸収 EXP +${exp}`);
  } catch(_) {}
}

// ═══════════════════════════════════════════════════════════════
// イベントバインド
// ═══════════════════════════════════════════════════════════════
function bindEvents() {
  $('#main-btn').addEventListener('click', () => {
    if (!isPartyChosen()) { openPartyPicker(); return; }
    // v1.5.14: 計測中／計測ポーズも処理
    if (STATE.mode === 'measure') { pauseMeasure(); return; }
    if (STATE.mode === 'measurePaused') { resumeMeasure(); return; }
    if (STATE.mode === 'idle') startWork();
    else if (STATE.mode === 'paused') resumeTimer();
    else pauseTimer();
  });
  $('#btn-skip').addEventListener('click', () => {
    if (STATE.mode === 'work') { startRest(); }
    else if (STATE.mode === 'rest') { stopTimer(); }
  });
  $('#btn-reset').addEventListener('click', () => {
    if (STATE.mode === 'measure') stopMeasure();
    else stopTimer();
  });

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
  // v1.0.3: ヘルプ ＋ ツアー 統合（モーダルから両方アクセス）
  menuClick('#m-help',       openHelpPlusTour);
  menuClick('#m-stats',      openStats);
  menuClick('#m-codex',      openCodex);
  menuClick('#m-data',       openDataManager);
  menuClick('#m-hud',        toggleHUD);
  menuClick('#m-pip',        toggleTimerPiP);
  menuClick('#m-theme',      openThemePicker);
  menuClick('#m-writings',   openWritings);
  // v10n11: m-edit-party 廃止 ── 図鑑からリーダー設定／編 プリセットで全カバー済
  menuClick('#m-sleep', openSleep);
  menuClick('#m-measure', () => { STATE.mode === 'measure' ? stopMeasure() : startMeasure(); });
  // スリープ：オーバーレイのどこでもタップで起きる
  const sleepOv = $('#sleep-overlay');
  if (sleepOv) {
    sleepOv.addEventListener('click', closeSleep);
    sleepOv.addEventListener('touchstart', (e) => { e.preventDefault(); closeSleep(); }, { passive:false });
  }

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
  if (wcClear) wcClear.addEventListener('click', () => {
    if (_currentWriting.length > 0 && !confirm(`日記に ${_currentWriting.length} 字入っています。クリアしますか？`)) return;
    _currentWriting = []; renderWritingsModal(); refreshPCPanels();
  });
  const wcUndo = $('#wc-undo');
  if (wcUndo) wcUndo.addEventListener('click', () => { _currentWriting.pop(); renderWritingsModal(); refreshPCPanels(); });
  const wcSave = $('#wc-save');
  if (wcSave) wcSave.addEventListener('click', saveCurrentWriting);
  const wcExport = $('#wc-export');
  if (wcExport) wcExport.addEventListener('click', exportWritingsJSON);
  const wcExport2 = $('#wc-export-2');
  if (wcExport2) wcExport2.addEventListener('click', exportWritingsJSON);

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
    _resizeT = setTimeout(() => { refreshPCPanels(); clampSettledToGround(); }, 150);
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
    codexFilter.tag = null;  // シーズン切替時にタグフィルタもリセット
    $$('.codex-season').forEach(x => x.classList.toggle('active', x === s));
    // 熟語／特性シーズンでは文字種フィルター非表示（字単位ではない）
    const scriptBar = $('#codex-scripts');
    if (scriptBar) {
      const hide = ['S3','S4','S5','S6','S7','PERKS'].includes(codexFilter.season);
      scriptBar.style.display = hide ? 'none' : '';
    }
    renderCodex();
  }));
  // 文字種フィルター（41,890 字を瞬時に絞る）
  $$('.codex-script').forEach(s => s.addEventListener('click', () => {
    codexFilter.script = s.dataset.script;
    $$('.codex-script').forEach(x => x.classList.toggle('active', x === s));
    renderCodex();
  }));
  $('#codex-only-seen').addEventListener('change', (e) => {
    codexFilter.onlySeen = e.target.checked;
    renderCodex();
  });
  const favCheck = $('#codex-only-favorite');
  if (favCheck) favCheck.addEventListener('change', (e) => {
    codexFilter.onlyFavorite = e.target.checked;
    renderCodex();
  });
  const shuffleBtn = $('#codex-shuffle');
  if (shuffleBtn) shuffleBtn.addEventListener('click', showRandomYoji);
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
  bindOpt('#btn-export-data', exportStateJSON);
  bindOpt('#btn-import-data', importStateJSON);
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
        // スリープが最優先で閉じる
        if ($('#sleep-overlay')?.classList.contains('show')) { closeSleep(); break; }
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
      case 'z': case 'Z':
        //  スリープを Z で起動／解除
        if ($('#sleep-overlay')?.classList.contains('show')) closeSleep();
        else openSleep();
        break;
      case 'k': case 'K':
        // K でキー一覧トースト
        toast('Space: 開始 / M: メニュー / B: 図鑑 / S: 記録 / W: 文章 / R: ランダム熟語 / N: コンボ提案 / Z: スリープ', '★13');
        break;
      case 'r': case 'R':
        // R でランダム熟語表示
        showRandomYoji();
        break;
      case 'n': case 'N':
        // N で「あと 1 字でコンボ成立」サジェスト
        suggestNearComboYoji();
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
// グローバルエラーハンドラ ── 開発支援＋ユーザー通知（控えめ）
// ═══════════════════════════════════════════════════════════════
const _errBuffer = [];
function _logRuntimeError(label, err) {
  const entry = {
    label,
    msg: (err && (err.message || err.reason?.message || String(err))) || 'unknown',
    stack: (err && (err.stack || err.reason?.stack)) || '',
    at: new Date().toISOString(),
  };
  _errBuffer.push(entry);
  if (_errBuffer.length > 20) _errBuffer.shift();
  try { localStorage.setItem('pomojikan_errors', JSON.stringify(_errBuffer)); } catch(_) {}
  // 連発抑制：5 秒に 1 回まで toast
  const now = Date.now();
  if (!_logRuntimeError._lastToast || now - _logRuntimeError._lastToast > 5000) {
    _logRuntimeError._lastToast = now;
    try { toast('⚠ 内部エラー（記録済）', '★1'); } catch(_) {}
  }
}
window.addEventListener('error', (e) => _logRuntimeError('error', e.error || e));
window.addEventListener('unhandledrejection', (e) => _logRuntimeError('rejection', e));

// ═══════════════════════════════════════════════════════════════
// 初期化
// ═══════════════════════════════════════════════════════════════
function init() {
  loadState();
  // v10n5: 全 YOJI_RECIPES に固有効果を自動生成（手書き UNIQUE は不変）
  try { initAutoUniqueCombos(); } catch(_) {}
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
  setTextWithLvBand("timer-text", fmtTime(STATE.timer.workSec));
  // 共有 URL チェック（自分のパーティ読み込み後）
  checkSharedPartyOnBoot();
  renderParty();
  updateUnlockTier();
  updateProgressPill();
  updateAudioButton();
  buildBackgroundLayers();
  physicsStep();
  // v10n7: タイマー縁ドラッグで時間設定
  try { setupTimerRingDrag(); } catch(_) {}
  // v1.1.5: 長押し→スワイプ収穫モード
  try { setupHarvestMode(); } catch(_) {}
  // v1.3.8: 他アプリ（5本柱）からのイベント受信を有効化
  try { _ensureYomuChannel(); } catch(_) {}
  // v10n19: テーマ適用
  try { applyTheme(); } catch(_) {}
  try { applyIconMode(); } catch(_) {}
  // v10n15: アプリ閉じ時に PiP/WakeLock 後片付け（リーク防止）
  window.addEventListener('pagehide', () => {
    try { if (_pipWindow) _pipWindow.close(); } catch(_) {}
    try { releaseWakeLock(); } catch(_) {}
  });

  // First-launch flow: onboarding → party picker
  if (!STATE.onboardingDone) {
    setTimeout(() => openOnboarding(), 500);
  } else if (!isPartyChosen()) {
    setTimeout(() => openPartyPicker(), 600);
  } else {
    // 「昨日の送り状」表示（朝の再起動で見られる、寝る前の鼓舞）
    setTimeout(() => showDailyReportIfNew(), 1200);
    // v10n10: バージョン更新後に 1 回だけ新機能ツアー
    setTimeout(() => { try { openTour(false); } catch(_) {} }, 1800);
  }
  // v10n10: HUD 初期描画＋スイッチ状態同期
  setTimeout(() => {
    try { renderHUD(); } catch(_) {}
    const stateEl = $('#m-hud-state');
    if (stateEl) stateEl.textContent = STATE.hudEnabled ? 'オン' : 'オフ';
  }, 800);

  // SW registration ── 新バージョン検出時に更新トースト
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // 既存 SW が controlling の場合、updatefound で新バージョン検出
      if (reg.waiting) {
        notifyUpdateAvailable(reg);
      }
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdateAvailable(reg);
          }
        });
      });
      // 既に新しいのが立ち上がってる場合のリロード処理
      let _reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (_reloading) return;
        _reloading = true;
        setTimeout(() => location.reload(), 300);
      });
    }).catch(()=>{});
  }
}

function notifyUpdateAvailable(reg) {
  toast('🆕 新バージョンあり ・ タップで更新', '★14');
  // toast 上のクリックで更新適用（toast 自体は pointer-events:none なので body level）
  setTimeout(() => {
    const handler = () => {
      reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
      document.removeEventListener('click', handler);
    };
    document.addEventListener('click', handler);
    // 30 秒後タイムアウト
    setTimeout(() => document.removeEventListener('click', handler), 30000);
  }, 100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
