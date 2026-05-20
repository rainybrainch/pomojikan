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
const EVO_GLYPH = ['', '✦', '✧', '☀', '☆', '✯', '✪', '❂', '✺', '✹', '𓂀', '𓁹', '𒀭', '☥', '⚛', '∞'];
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
  // 🌟 SPECIAL コンボ系の追加効果（落下／合体／粒数／ストックEXP）
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
  return agg;
}

// EXP 関数
const expForLevel = (lv) => Math.floor(10 * Math.pow(lv, 1.6));
// v10n5: 集約 evoDiscount を反映した実効必要 EXP（コンボ／特性の「進化加速」が届く）
// agg はキャッシュ済（physicsStep で 10F 毎更新・invalidateAggCache でリセット）
function effectiveExpForLevel(lv) {
  const disc = (typeof _aggCache !== 'undefined' && _aggCache && _aggCache.evoDiscount)
    ? Math.min(0.95, _aggCache.evoDiscount) : 0;
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
  favorites: { chars: {}, yoji: {} }, // v10n8 ─ お気に入り（⭐）字／熟語
  partyPresets: [],               // v10n9 ─ パーティプリセット [{name, hero, members[]}]
  lastSeenVersion: '',            // v10n10 ─ 新機能ツアー既読バージョン
  hudEnabled: true,               // v10n10 ─ プレイ中 HUD 表示 ON/OFF
  themePref: 'auto',              // v10n19 ─ 'auto' / 'spring' / 'summer' / 'autumn' / 'winter' / 'dark' / 'light'
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
  // v10n15: 堅牢化 ── 旧 state 構造の破損対策
  try {
    if (STATE.party && STATE.party.members) {
      for (const m of STATE.party.members) {
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
    text = '⚠ 一度もバックアップしていません ── 進捗が大きい今こそ「💾 JSON バックアップ」を';
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
    toast('💾 バックアップを保存', '★14');
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

// パーティ Lv が大きく上がった時に背景密度を更新（毎回 dispose して再構築）
function refreshBackgroundDensity() {
  const rain = $('#rain-bg');
  const bub  = $('#bubble-bg');
  if (rain) rain.innerHTML = '';
  if (bub) bub.innerHTML = '';
  buildBackgroundLayers();
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
    toast('🔗 共有 URL をコピーしました', '★12');
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

// 🌟 アプリ名隠しコンボ（SPECIAL_COMBOS）── 通常熟語より段違いの効果
// 「ぽも時間」＝時の凝縮（時間を彫る）
// 「ぽ文字漢」＝字を集める（収集に特化）
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
  // 🌟 アプリ名コンボ優先判定（通常熟語より上に）
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
  else                        season = pref;  // spring/summer/autumn/winter
  document.body.dataset.season = season || '';
  document.body.dataset.theme  = theme;
}
const THEME_LABELS = {
  auto:'🍃 自動（季節）', spring:'🌸 春', summer:'🌊 夏',
  autumn:'🍁 秋', winter:'❄ 冬', dark:'🌑 ダーク', light:'☀ ライト',
};
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
  Object.entries(THEME_LABELS).forEach(([key, lbl]) => {
    const active = (STATE.themePref || 'auto') === key;
    list.appendChild(el('button', {
      style:{
        padding:'12px 10px', minHeight:'56px',
        background: active ? 'linear-gradient(135deg, rgba(240,212,138,.25), rgba(240,212,138,.08))' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (active ? 'rgba(240,212,138,.6)' : 'rgba(255,255,255,.12)'),
        borderRadius:'8px',
        color: active ? '#ffe9a0' : 'var(--ink)',
        fontWeight: active ? 700 : 400,
        cursor:'pointer',
      },
      onclick: () => {
        STATE.themePref = key;
        saveState();
        applyTheme();
        openThemePicker();  // 再描画で active 反映
        toast(`🎨 ${lbl}`);
      },
    }, lbl));
  });
  modal.classList.add('show');
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
  { id:'p_uniq_10',    name:'初学の灯',    desc:'10 字発見：EXP +1%',         icon:'📚', cond:s=>_passiveCount.uniq(s)>=10,    eff:{expMul:1.01} },
  { id:'p_uniq_100',   name:'学識',         desc:'100 字発見：EXP +3%',        icon:'📘', cond:s=>_passiveCount.uniq(s)>=100,   eff:{expMul:1.03} },
  { id:'p_uniq_1000',  name:'博識',         desc:'1,000 字発見：EXP +6% / 融合範囲 +3%', icon:'📚', cond:s=>_passiveCount.uniq(s)>=1000,  eff:{expMul:1.06, mergeRadiusMul:1.03} },
  { id:'p_uniq_10000', name:'万巻の主',     desc:'10,000 字発見：EXP +12% / ストック +5%', icon:'🏛', cond:s=>_passiveCount.uniq(s)>=10000, eff:{expMul:1.12, stockExpMul:1.05} },
  // 熟語解放系
  { id:'p_yoji_100',   name:'語彙の門',     desc:'熟語 100 解放：融合範囲 +5%', icon:'📖', cond:s=>_passiveCount.yoji(s)>=100,   eff:{mergeRadiusMul:1.05} },
  { id:'p_yoji_1000',  name:'語学者',       desc:'熟語 1,000 解放：EXP +5% / 粒+1', icon:'📜', cond:s=>_passiveCount.yoji(s)>=1000,  eff:{expMul:1.05, dropCountAdd:1} },
  { id:'p_yoji_4000',  name:'達語',         desc:'熟語 4,000 解放：EXP +10% / 進化加速 +5%', icon:'🪶', cond:s=>_passiveCount.yoji(s)>=4000, eff:{expMul:1.10, evoBoost:0.05} },
  // 累計サイクル
  { id:'p_cycle_10',   name:'始まりの拍',   desc:'10 サイクル：ストック +2%',  icon:'⏱', cond:s=>_passiveCount.cycles(s)>=10,  eff:{stockExpMul:1.02} },
  { id:'p_cycle_100',  name:'継続の力',     desc:'100 サイクル：ストック +5% / 重力 -2%', icon:'🌱', cond:s=>_passiveCount.cycles(s)>=100, eff:{stockExpMul:1.05, gravityMul:0.98} },
  { id:'p_cycle_1000', name:'熟達',         desc:'1,000 サイクル：EXP +8% / 進化加速 +5%', icon:'🌳', cond:s=>_passiveCount.cycles(s)>=1000, eff:{expMul:1.08, evoBoost:0.05} },
  // 連続日数
  { id:'p_streak_7',   name:'一週間の習慣', desc:'連続 7 日：EXP +2%',          icon:'🔥', cond:s=>_passiveCount.streak(s)>=7,   eff:{expMul:1.02} },
  { id:'p_streak_30',  name:'一か月の継続', desc:'連続 30 日：EXP +5% / 重力 -3%', icon:'🔥', cond:s=>_passiveCount.streak(s)>=30,  eff:{expMul:1.05, gravityMul:0.97} },
  { id:'p_streak_100', name:'百日の坐',     desc:'連続 100 日：全効果 +5% 相当', icon:'🏔', cond:s=>_passiveCount.streak(s)>=100, eff:{expMul:1.05, stockExpMul:1.05, mergeRadiusMul:1.05} },
  // タグ収集
  { id:'p_seven_virt', name:'七徳の祝福',   desc:'七徳タグ 7 種：進化加速 +5%', icon:'✦',  cond:s=>_countCharsByTag(s,'七徳')>=7, eff:{evoBoost:0.05} },
  { id:'p_seven_sin',  name:'七大罪の連動', desc:'七大罪タグ 7 種：粒 +1 / 重力 -3%', icon:'☷', cond:s=>_countCharsByTag(s,'七大罪')>=7, eff:{dropCountAdd:1, gravityMul:0.97} },
  // リーダー Lv（自パーティ依存だが恒久的）
  { id:'p_hero_100',   name:'楷書師の杖',   desc:'リーダー Lv.100：ストック +3%', icon:'🖋', cond:s=>_passiveCount.hero(s)>=100, eff:{stockExpMul:1.03} },
  // v10n19: 季節パッシブ（今の月で発動・自動）
  { id:'p_season_spring', name:'🌸 春の祝福', desc:'3-5 月：融合範囲 +4% / EXP +2%', icon:'🌸', cond:()=>{const m=new Date().getMonth()+1;return m>=3&&m<=5;}, eff:{mergeRadiusMul:1.04, expMul:1.02} },
  { id:'p_season_summer', name:'🌊 夏の活力', desc:'6-8 月：粒+1 / EXP +3%',          icon:'🌊', cond:()=>{const m=new Date().getMonth()+1;return m>=6&&m<=8;}, eff:{dropCountAdd:1, expMul:1.03} },
  { id:'p_season_autumn', name:'🍁 秋の収穫', desc:'9-11 月：ストック +5% / 進化加速 +3%', icon:'🍁', cond:()=>{const m=new Date().getMonth()+1;return m>=9&&m<=11;}, eff:{stockExpMul:1.05, evoBoost:0.03} },
  { id:'p_season_winter', name:'❄ 冬の沈潜', desc:'12-2 月：重力 -5% / 進化加速 +4%', icon:'❄', cond:()=>{const m=new Date().getMonth()+1;return m===12||m<=2;}, eff:{gravityMul:0.95, evoBoost:0.04} },
];

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
    // 🌟 SPECIAL（アプリ名隠しコンボ）：固定値を加算（旧仕様維持・Lv補正のみ）
    if (r.special && r.effect) {
      const e = r.effect;
      if (e.expMul)         acc.expMul        *= e.expMul * lvMul;
      if (e.evoBoost)       acc.evoBoost      += e.evoBoost * lvMul;
      if (e.gravityMul)     acc.gravityMul    *= e.gravityMul;
      if (e.mergeRadiusMul) acc.mergeRadiusMul*= e.mergeRadiusMul;
      if (e.dropCountAdd)   acc.dropCountAdd  += e.dropCountAdd;
      if (e.stockExpMul)    acc.stockExpMul   *= e.stockExpMul * lvMul;
      continue;
    }
    // ✦ 固有効果コンボ（UNIQUE）：物語のある熟語は固有 effect 適用（タグ効果はスキップ）
    const unique = UNIQUE_COMBO_EFFECTS[r.word];
    if (unique) {
      const u = unique;
      if (u.expMul)         acc.expMul        *= u.expMul * lvMul;
      if (u.evoBoost)       acc.evoBoost      += u.evoBoost * lvMul;
      if (u.gravityMul)     acc.gravityMul    *= u.gravityMul;
      if (u.mergeRadiusMul) acc.mergeRadiusMul*= u.mergeRadiusMul;
      if (u.dropCountAdd)   acc.dropCountAdd  += u.dropCountAdd;
      if (u.stockExpMul)    acc.stockExpMul   *= u.stockExpMul * lvMul;
      continue;
    }
    // 通常コンボ：レア × 字数 × 難易度 × Lv × タグ
    const n = r.chars.length;
    const rarMul = COMBO_RARITY_MUL[r.rarity] || 1.0;
    const difMul = comboDifficulty(r);
    let baseExp = 0;
    if (n === 2)      baseExp = 0.10;
    else if (n === 3) baseExp = 0.30;
    else if (n === 4) baseExp = 0.60;
    else              baseExp = 1.0;
    acc.expMul *= 1 + baseExp * rarMul * difMul * lvMul;
    if (n === 4) acc.evoBoost += 0.10 * rarMul * lvMul;
    if (n >= 5)  acc.evoBoost += 0.20 * rarMul * lvMul;
    // タグ追加効果（味付け）── 難易度＆Lv反映
    acc._lastWeight = (n / 2) * rarMul * difMul * lvMul;
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
        toast(`🌟 隠しコンボ発動「${r.word}」 ${r.desc || ''}`, r.rarity);
      } else {
        playSFX(r.chars.length >= 4 ? 'milestone' : 'merge');
        if (wasNew) { setTimeout(() => playSFX('unlock'), 200); setTimeout(() => playSFX('discover'), 600); }
        toast(`${wasNew ? '✨ 新熟語解放' : '⚡ コンボ発動'}「${r.word}」 ${r.desc || ''}`, r.rarity);
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
    el('div', { class:'yuc-label' }, '✨ 新しい熟語を解放'),
    charRow,
    el('div', { class:'yuc-arrow' }, '↓'),
    el('div', { class:'yuc-mask' }, '？'.repeat(Math.max(2, recipe.word.length))),
    el('div', { class:'yuc-word' }, recipe.word),
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
    if (cb.expMul > 1.01)         lines.push(`📈 EXP ×${cb.expMul.toFixed(2)}`);
    if (cb.gravityMul < 0.99)     lines.push(`🌧 重力 ×${cb.gravityMul.toFixed(2)}`);
    if (cb.mergeRadiusMul > 1.01) lines.push(`🤝 融合 ×${cb.mergeRadiusMul.toFixed(2)}`);
    if (cb.dropCountAdd)          lines.push(`💧 粒 +${cb.dropCountAdd}`);
    if (cb.stockExpMul > 1.01)    lines.push(`📦 ストック ×${cb.stockExpMul.toFixed(2)}`);
    if (cb.evoBoost > 0.005)      lines.push(`🌱 進化 +${Math.round(cb.evoBoost*100)}%`);
  }
  const effLine = lines.length ? lines.join(' ・ ') : '';
  const node = el('div', {
    class: `combo-burst rarity-${rIdx + 1}${isSpecial ? ' combo-special' : ''}`,
    style: { left: (W/2 - width/2) + 'px', top: (H/2 - (isSpecial ? 110 : 80)) + 'px' },
  },
    el('div', { class:'cb-label' }, isSpecial ? '🌟 隠しコンボ発動' : '⚡ コンボ発動'),
    el('div', { class:'cb-word' }, recipe.word),
    recipe.desc ? el('div', { class:'cb-desc' }, recipe.desc) : null,
    effLine ? el('div', { class:'cb-eff' }, effLine) : null,
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
      while (hero.exp >= effectiveExpForLevel(hero.level + 1) && s++ < 500) {
        hero.exp -= effectiveExpForLevel(hero.level + 1);
        hero.level += 1;
        onLevelUp(hero, STATE.party.hero);
      }
    }
  }
  let s2 = 0;
  while (m.exp >= effectiveExpForLevel(m.level + 1) && s2++ < 500) {
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

function onLevelUp(member, idx) {
  invalidateAggCache();  // Lv 変化で集約結果を再計算させる
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
        `%c☔ ぽもじかん コレクション総量 ── 字 ${charCount} ・ 熟語 ${yojiCount} ・ 特性 ${perkCount}`,
        'color:#f0d48a; font-weight:900;'
      );
      console.log(
        '%c 🎉 100 サイクルリリース達成 ── 開発進化v9c時点',
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
    const perks = pickInherentPerks(c, k.rarity);
    if (!perks.includes('guardian')) perks.push('guardian');
    const hero = { char: c, rarity: k.rarity, level: 1, exp: 0, perks };
    STATE.party = { hero: 0, members: [hero] };
    saveState();
    $('#party-picker-modal').classList.remove('show');
    renderParty();
    const perkNames = perks.map(p => PERKS[p]?.name).filter(Boolean).join('・');
    toast(`★ リーダー ${c} ── ${perkNames}\n（以降のリーダー変更は図鑑から）`);
  };
}

// ═══════════════════════════════════════════════════════════════
// タイマー
// ═══════════════════════════════════════════════════════════════
let timerRaf = 0;
let _hudTickCounter = 0;
function tick() {
  if (STATE.mode === 'work' || STATE.mode === 'rest') {
    const remaining = Math.max(0, STATE.phaseEnd - Date.now());
    $('#timer-text').textContent = fmtTime(Math.ceil(remaining/1000));
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
    $('#timer-text').textContent = fmtTime(m * 60);
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
    // ⚙ ボタンと timer-text 中央タップは除外（既存機能保護）
    if (target.id === 'btn-timer-settings' || target.closest('#btn-timer-settings')) return;
    dragging = true;
    startedDragging = false;
    editMode = 'work';
    // 長押し 500ms で休憩時間モード
    longPressTimer = setTimeout(() => {
      editMode = 'rest';
      $('#timer-text').textContent = fmtTime(STATE.timer.restSec);
      updateProgress(STATE.timer.restSec / 60 / 60);
      zone.classList.add('editing-rest');
      try { toast('🌙 休憩時間モード（指を動かして分数設定）'); } catch(_) {}
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
    try { toast(`⏱ ${editMode === 'work' ? '作業' : '休憩'} ${m} 分`); } catch(_) {}
    // ring を通常状態に戻す（idle 表示用）
    setTimeout(() => {
      zone.classList.remove('editing-work', 'editing-rest');
      if (STATE.mode === 'idle') {
        $('#timer-text').textContent = fmtTime(STATE.timer.workSec);
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

function startWork() {
  STATE.mode = 'work';
  STATE.phaseStart = Date.now();
  setTimeout(() => { try { renderHUD(); } catch(_) {} }, 50);
  // v10n14: Wake Lock & 通知許可要求
  requestWakeLock();
  ensureNotificationPermission();
  // v10n18: スタート／作業再開でカッコウ
  try { playKakkou(); } catch(_) {}
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
  // v10n18: 休憩開始でカッコウ
  try { playKakkou(); } catch(_) {}
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
  try { releaseWakeLock(); } catch(_) {}
  updateProgress(0);
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
    flashCompletionBurst('☔ 凝縮 完了');
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
    flashCompletionBurst('🫧 発散 完了');
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
      // 自動で次のサイクルへ（短い間を置く）
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
  // 全ぽもじ（settled も落下中も）を順番に泡化
  // persistent（パーティ字）は対象外 ── 永続スポーンとして残す
  const targets = Array.from(livePomoji.values())
    .filter(p => !p.dragging && !p.rising && !p.persistent)
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

// v10n6: 棚（コインプッシャー床）から落下 → EXP 化
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
  const exp = Math.max(1, Math.pow(2, rIdx) * 6);
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

// 🌙 昨日の送り状 ── 朝の再起動で見られる、寝る前への鼓舞
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
      el('div', { class:'dr-moon' }, '🌙'),
      el('h2', { class:'dr-title' }, `${dateLabel} の送り状`),
      el('div', { class:'dr-grid' },
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, '🎯'),
          el('div', { class:'dr-num' }, cycles.toLocaleString()),
          el('div', { class:'dr-label' }, 'サイクル')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, '🌏'),
          el('div', { class:'dr-num' }, newChars.toLocaleString()),
          el('div', { class:'dr-label' }, '新発見字')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, '✨'),
          el('div', { class:'dr-num' }, newYoji.toLocaleString()),
          el('div', { class:'dr-label' }, '新解放熟語')
        ),
        el('div', { class:'dr-cell' },
          el('div', { class:'dr-icon' }, '⚡'),
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
    let s = 0;
    while (m.exp >= effectiveExpForLevel(m.level + 1) && s++ < 500) {
      m.exp -= effectiveExpForLevel(m.level + 1);
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
    // settled な字は位置固定 ── ただし persistent でなく棚外なら settle 解除して落とす
    if (p.settled && !p.rising) {
      // v10n6: 棚から押し出されたら再落下開始（コインプッシャー）
      const onLedge = p.persistent || (p.x >= ledge.left - SIZE * 0.3 && p.x <= ledge.right + SIZE * 0.3);
      if (!onLedge) {
        p.settled = false;
        p.settledX = null;
        p.settledY = null;
        p.el.classList.remove('settled');
        // 横に押された慣性を残してそのまま落下フェーズへ
      } else {
        if (p.settledX != null) { p.x = p.settledX; }
        if (p.settledY != null) { p.y = p.settledY; }
        p.vx = 0; p.vy = 0;
        p.el.style.left = p.x + 'px';
        p.el.style.top  = p.y + 'px';
        continue;
      }
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
      // 天井到達 → 残った字も EXP 化（保険）
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
      p.vy += GRAVITY_BASE * tierMul * (agg.gravityMul || 1.0);
    } else {
      p.vy *= 0.85;  // 静的な台に乗ってる時は重力を切って減衰のみ
    }
    if (p.vy > MAX_FALL_VY) p.vy = MAX_FALL_VY;
    // v1.0.9: 空気摩擦弱め（転がりが長く持つように）
    p.vx *= 0.995;
    if (Math.abs(p.vx) < 0.01) p.vx = 0;
    p.x += p.vx;
    p.y += p.vy;
    // v1.0.9: x 壁反射は棚範囲のみ ── 棚外は反射せず素通りで画面外へ
    if (p.x + SIZE/2 < ledge.left) {
      // 棚の左外：反射せず、画面遥か外まで行ったら EXP 化
      if (p.x < -SIZE * 1.2) { awardFallen(p); continue; }
    } else if (p.x + SIZE/2 > ledge.right + SIZE) {
      // 棚の右外
      if (p.x > W + SIZE * 0.2) { awardFallen(p); continue; }
    } else {
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
          // v1.0.9: 接線力強化（しっかり転がる・コインプッシャー）
          if (Math.abs(nx) > 0.05) {
            p.vx += nx * 2.2;
            // 下の字にも押し出し力を伝播（連鎖転がり・settled も滑り出す）
            if (otherStatic && !other.persistent && other.settled) {
              const push = nx * 2.5;
              other.settledX = (other.settledX || other.x) - push;
              other.x = other.settledX;
            }
          }
        }
      }
    }

    // v10n6: コインプッシャー床 ── 棚の上だけ着地、棚外は素通りで下に落ちる
    const overLedge = (p.x + SIZE/2) >= ledge.left && (p.x + SIZE/2) <= (ledge.right + SIZE);
    if (overLedge && p.y > H - SIZE - LEDGE_THICKNESS) {
      // v1.1.0: 着地速度に応じて波紋を出す（雨が水面に落ちる演出）
      if (!p._rippled && p.vy > 1.0) {
        spawnRipple(p.x + SIZE/2);
        p._rippled = true;
      }
      // 棚の上で着地（厚み分上で止まる）
      p.y = H - SIZE - LEDGE_THICKNESS;
      if (Math.abs(p.vy) > 1.6) {
        p.vy *= -0.22;
        squashEl(p, 'squash');
      } else {
        p.vy = 0;
        // 横慣性は少し残す（自然に転がる）
        p.vx *= 0.6;
        // 🫧 休憩中に着地した字は即座に泡（rising）化 ── 取り残し防止
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
  // v1.0.1: パーティ字（persistent）── タップで一時消滅＋大EXP＋タグ別バフ＋20秒後に再スポーン
  if (p.persistent) {
    const rarity = p.rarity;
    const rIdx = RARITY_TIERS.indexOf(rarity);
    const exp = Math.max(5, Math.pow(2, rIdx) * 12);  // 通常の 4 倍
    awardExpToParty(p.char, exp) || _orphanExp(exp);
    spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
    playSFX('pop');
    // タグ別の時間限定バフ発動（30 秒）
    triggerPartyBuff(p.char, rarity);
    // 消滅演出
    p.el.classList.add('dissolve');
    const oldChar = p.char;
    const oldRarity = p.rarity;
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
  const exp = Math.max(1, Math.pow(2, rIdx) * 3);
  awardExpToParty(p.char, exp) || _orphanExp(exp);
  spawnXpFloat(p.x + SIZE/2, p.y + SIZE/2, exp, rarity);
  addStock(p.char);
  playSFX('pop');
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
  try { toast('✨ ' + buff.label, rarity); } catch(_) {}
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
    // 🌟「ぽ文字漢」コンボ成立時は ×1.3
    const agg = aggregatePartyPerks();
    const stockMul = (agg && agg.stockExpMul) ? agg.stockExpMul : 1.0;
    const expPerStock = Math.max(1, Math.round((rIdx + 1) * stockMul));
    for (let i = 0; i < STATE.party.members.length; i++) {
      const m = STATE.party.members[i];
      m.exp = (m.exp || 0) + expPerStock;
      let s = 0;
      while (m.exp >= effectiveExpForLevel(m.level + 1) && s++ < 500) {
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
  let s = 0;
  while (hero.exp >= effectiveExpForLevel(hero.level + 1) && s++ < 500) {
    hero.exp -= effectiveExpForLevel(hero.level + 1);
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
    toast(`🔥 連続 ${cur} 日 達成`, '★12');
    playSFX('milestone');
  }
}

// 仲間 → 主人公昇格（ダブルタップで切り替え）
function promoteToHero(idx) {
  if (!STATE.party || !STATE.party.members) return;
  if (idx === STATE.party.hero) {
    toast('★ 既にリーダーです');
    return;
  }
  const newHero = STATE.party.members[idx];
  if (!newHero) return;
  const oldHero = STATE.party.members[STATE.party.hero];
  STATE.party.hero = idx;
  invalidateAggCache();
  // 主人公の guardian 特性を新しい hero に付け替え（旧 hero からは外す）
  if (oldHero && oldHero.perks) {
    oldHero.perks = oldHero.perks.filter(p => p !== 'guardian');
  }
  if (!newHero.perks) newHero.perks = [];
  if (!newHero.perks.includes('guardian')) newHero.perks.push('guardian');
  saveState();
  renderParty();
  updateProgressPill();
  toast(`★ ${newHero.char} がリーダーに`, newHero.rarity);
  playSFX('unlock');
}

function renderParty() {
  const bar = $('#party-bar');
  if (!isPartyChosen()) {
    bar.classList.add('empty');
    bar.innerHTML = '<button class="party-pick-cta" id="party-pick-cta">✦ リーダー（最初の一字）を選んで始める</button>';
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
      title: `${m.char} Lv.${m.level} / 特性: ${perkLabels}\nタップで操作（リーダー昇格・解除）`,
      onclick: () => openPartyMemberAction(idx),
      ondblclick: () => promoteToHero(idx),  // PC 互換維持
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
      title: '図鑑で字をタップ → ★リーダー設定 / ＋仲間追加',
      onclick: () => {
        toast('図鑑📖 で字をタップ → ★リーダーに設定 か ＋仲間に加える');
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
  if (cb.expMul && cb.expMul > 1.01)         addChip('📈', `EXP ×${cb.expMul.toFixed(2)}`, '#ffd86b', cb.expMul);
  if (cb.gravityMul && cb.gravityMul < 0.99) addChip('🌧', `重力 ×${cb.gravityMul.toFixed(2)}`, '#a0e0ff', 1/cb.gravityMul);
  if (cb.mergeRadiusMul && cb.mergeRadiusMul > 1.01) addChip('🤝', `融合 ×${cb.mergeRadiusMul.toFixed(2)}`, '#c0e0a0', cb.mergeRadiusMul);
  if (cb.dropCountAdd)                       addChip('💧', `粒 +${cb.dropCountAdd}`, '#9be0ff', 1 + cb.dropCountAdd * 0.2);
  if (cb.stockExpMul && cb.stockExpMul > 1.01) addChip('📦', `ストック ×${cb.stockExpMul.toFixed(2)}`, '#d4b6ff', cb.stockExpMul);
  if (cb.evoBoost && cb.evoBoost > 0.005)    addChip('🌱', `進化 +${Math.round(cb.evoBoost*100)}%`, '#ffe0a0', 1 + cb.evoBoost);
  allChips.sort((a, b) => b.weight - a.weight);
  const effChips = allChips.slice(0, 3);
  const hidden = allChips.length - effChips.length;
  const top = el('div', { class:'cb-top' },
    el('span', { class:'cb-top-label' }, `⚡ ${combos.length}`),
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
    bot.appendChild(el('span', {
      class: `cb-bar-item rarity-${rIdx + 1}${r.special ? ' cb-special' : ''}`,
      title: r.desc || r.word,
      onclick: () => showYojiDetail(r),
    }, r.special ? '🌟' + r.word : r.word));
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
        el('span', {}, (isRare ? '✦ ' : '') + p.name),
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
    buttons.push(el('button', { class:'btn-danger mapop-btn', onclick: () => {
      if (confirm(`${m.char} をパーティから外しますか？\n（Lv. と経験値はリセットされます）`)) {
        invalidateAggCache();
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
  invalidateAggCache();  // 仲間追加 → 集約再計算
  const perks = pickInherentPerks(c, rarity);
  STATE.party.members.push({
    char: c, rarity, level: 1, exp: 0, perks
  });
  saveState();
  renderParty();
  const perkName = PERKS[perks[0]]?.name || '—';
  toast(`${c} が仲間になった！特性「${perkName}」`);
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
  // 枠満タン → 旧リーダーを置き換え（仲間枠を一つ消費せず swap）
  const heroIdx = STATE.party.hero || 0;
  const oldHero = STATE.party.members[heroIdx];
  if (!confirm(`パーティが満員です。\n旧リーダー ${oldHero.char}（Lv.${oldHero.level}）を外して ${c} をリーダーにしますか？\n（旧リーダーの Lv は失われます）`)) {
    return false;
  }
  invalidateAggCache();
  const perks = pickInherentPerks(c, rarity);
  if (!perks.includes('guardian')) perks.push('guardian');
  STATE.party.members[heroIdx] = { char: c, rarity, level: 1, exp: 0, perks };
  // hero index はそのまま
  saveState();
  renderParty();
  updateProgressPill();
  toast(`★ ${c} が新しいリーダーに（${oldHero.char} と入れ替え）`, rarity);
  playSFX('unlock');
  return true;
}

// ═══════════════════════════════════════════════════════════════
// 💤 スリープモード ── 画面を休める（タイマーは止めない）
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
  if (STATE.mode === 'idle') $('#timer-text').textContent = fmtTime(work);
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
  if (n === 17) return '🎯 俳句（5-7-5）';
  if (n === 31) return '🎯 短歌（5-7-5-7-7）';
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
function _ensureYomuChannel() {
  if (!_yomuChannel && 'BroadcastChannel' in window) {
    _yomuChannel = new BroadcastChannel('rainybrain');
  }
  return _yomuChannel;
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
  if (STATE.mode === 'idle') $('#timer-text').textContent = fmtTime(p.work);
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
    const labels = { S1:'S1 字種', S2:'S2 漢字', S3:'S3 熟語', S4:'S4 四字熟語', S5:'S5 昭和', S6:'S6 令和', S7:'S7 未来', S8:'S8 世界', PERKS:'✦ 特性' };
    parts.push(labels[codexFilter.season] || codexFilter.season);
  }
  if (codexFilter.tier !== 'all') parts.push('★' + (parseInt(codexFilter.tier) + 1));
  if (codexFilter.script !== 'all') parts.push('🌏 ' + codexFilter.script);
  if (codexFilter.tag) parts.push('# ' + codexFilter.tag);
  if (codexFilter.query) parts.push('🔍 "' + codexFilter.query + '"');
  if (codexFilter.onlySeen) parts.push('発見済のみ');
  if (codexFilter.onlyFavorite) parts.push('⭐');
  if (parts.length === 0) { s.style.display = 'none'; s.textContent = ''; }
  else { s.style.display = ''; s.textContent = '🎯 ' + parts.join(' × '); }
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
            '📖 操作ガイド'),
          el('a', { href:'changelog.html', target:'_blank', rel:'noopener',
            style:{ marginTop:'4px', textAlign:'center', color:'var(--ink-mute)', fontSize:'.78rem' } },
            '📜 変更履歴'),
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
  { emoji:'★', title:'リーダー制', body:'「主人公」→「リーダー」に。図鑑で字をタップ → ★ボタンで一発切替。🗂 編成プリセットで名前付き保存（最大12個）。' },
  { emoji:'⚡', title:'コンボ × 4,546 + パッシブ 16', body:'全熟語に固有効果と物語。さらに「100字発見」「30日連続」等のマイルストーンで⚙ パッシブが恒久発動。3層（特性×コンボ×パッシブ）で育つ。' },
  { emoji:'🎰', title:'物理＆タイマー UI', body:'コインプッシャー型：字が押されて棚から落ちると自動EXP化＝重くならない。タイマー円の縁をなぞって分数設定、長押しで休憩時間。' },
  { emoji:'👁', title:'現効果パネル & HUD', body:'パーティ下に EXP / 重力 / 融合 / 粒+ / ストック / 進化加速が常時表示。画面左上 HUD で次の推薦コンボも見える。図鑑は折りたたみで見やすく。' },
  { emoji:'📺', title:'画面外でも動く', body:'メニュー右上 ☰ →「📺 小窓タイマー」で他アプリ作業中も時計が前面に。Wake Lock で画面が暗くならず、🔔 通知でサイクル完了も逃さない。💾 データ管理で別端末引継ぎも。' },
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
          el('button', { class:'btn-primary', id:'tour-next', style:{ minWidth:'72px' } }, '▶'),
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
    $('#tour-next').textContent = (page === TOUR_PAGES.length - 1) ? '✓ 始める' : '▶';
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
          el('div', { class:'modal-title' }, '💾 データ管理'),
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
            '💡 別の端末で続きを遊ぶ：1) ここで書き出し  2) 別端末で同じアプリ開く  3) ここから復元'),
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
  hud.appendChild(el('div', { class:'hud-row hud-leader' }, `★ ${hero.char} Lv.${hero.level}`));
  hud.appendChild(el('div', { class:'hud-row hud-eff' },
    `⚡ EXP×${expFinal >= 100 ? fmtBig(expFinal) : expFinal.toFixed(2)}`,
    combo.combos?.length ? el('span', { class:'hud-combo' }, ` ・ ${combo.combos.length} コンボ`) : null,
  ));
  if (nextHint) hud.appendChild(el('div', { class:'hud-row hud-hint' }, '💡 ' + nextHint));
  // v1.0.1: 一時バフ表示（残り秒数）
  const buffs = getActiveTempBuffs ? getActiveTempBuffs() : [];
  for (const b of buffs) {
    const sec = Math.max(0, Math.ceil((b.until - Date.now()) / 1000));
    hud.appendChild(el('div', { class:'hud-row hud-buff' }, `✨ ${b.src}：${b.label.replace(/（.+?）/, '')}（${sec}s）`));
  }
}
function toggleHUD() {
  STATE.hudEnabled = !STATE.hudEnabled;
  saveState();
  const stateEl = $('#m-hud-state');
  if (stateEl) stateEl.textContent = STATE.hudEnabled ? 'オン' : 'オフ';
  if (STATE.hudEnabled) renderHUD();
  else $('#play-hud')?.remove();
  toast(`👁 HUD ${STATE.hudEnabled ? 'オン' : 'オフ'}`);
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
  STATE.partyPresets.push(preset);
  if (STATE.partyPresets.length > 12) STATE.partyPresets.shift();
  saveState();
  toast(`💾 「${trimmed}」保存`);
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
  toast(`🗑 削除`);
  if ($('#party-presets-modal')?.classList.contains('show')) renderPartyPresetsModal();
}
function openPartyPresets() {
  let modal = $('#party-presets-modal');
  if (!modal) {
    modal = el('div', { class:'modal', id:'party-presets-modal', role:'dialog' },
      el('div', { class:'modal-card', style:{ maxWidth:'520px' } },
        el('div', { class:'modal-head' },
          el('div', { class:'modal-title' }, '🗂 パーティ プリセット'),
          el('button', { class:'modal-close', onclick: () => modal.classList.remove('show') }, '×'),
        ),
        el('div', { id:'party-presets-list', style:{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:'8px' } }),
        el('div', { style:{ padding:'8px 16px 16px', display:'flex', gap:'8px' } },
          el('button', { class:'btn-primary', onclick: savePartyPreset, style:{ flex:1 } }, '💾 現パーティを保存'),
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
      el('button', { class:'btn-secondary', style:{ padding:'4px 10px', fontSize:'.78rem' },
        onclick: () => loadPartyPreset(p.id) }, '📂 読込'),
      el('button', { class:'btn-danger', style:{ padding:'4px 8px', fontSize:'.78rem' },
        onclick: () => deletePartyPreset(p.id) }, '🗑'),
    ));
  });
}

// v10n9: 現効果パネル ── party-bar 下に常時表示（折りたたみ可）
function renderEffectsPanel() {
  if (!isPartyChosen()) {
    $('#effects-panel')?.remove();
    return;
  }
  let panel = $('#effects-panel');
  if (!panel) {
    panel = el('div', { id:'effects-panel', class:'effects-panel' });
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
  const items = [
    // 成長系
    { ic:'📈', lbl:'EXP',     val:'×' + (expFinal >= 1000 ? fmtBig(expFinal) : fmt(expFinal)), hint:'貰える経験値の倍率',     grade: grade(expFinal, 1.10, 1.50), inv:false },
    { ic:'📦', lbl:'ストック', val:'×' + fmt(stockFinal),                                       hint:'拾った字からの EXP 倍率', grade: grade(stockFinal, 1.05, 1.30), inv:false },
    { ic:'🌱', lbl:'進化加速', val:'-' + Math.round(evoFinal * 100) + '%',                       hint:'次 Lv 必要 EXP 削減率',   grade: grade(evoFinal, 0.05, 0.20), inv:false },
    // 物理系
    { ic:'🌧', lbl:'重力',     val:'×' + fmt(gravFinal),                                        hint:'落下速度の倍率（低いほど緩い）', grade: grade(gravFinal, 0.95, 0.70, true), inv:true },
    { ic:'🤝', lbl:'融合範囲', val:'×' + fmt(mergeFinal),                                       hint:'同字どうしが合体する判定半径', grade: grade(mergeFinal, 1.05, 1.20), inv:false },
    { ic:'💧', lbl:'粒数+',    val:'+' + Math.round(dropFinal),                                 hint:'1 回の落下で増える追加粒数', grade: grade(dropFinal, 1, 3), inv:false },
    // 状態系
    { ic:'⭐', lbl:'Lv係数',   val:'×' + fmt(lvMul),                                            hint:'リーダー Lv 由来の全効果倍率', grade: grade(lvMul, 1.10, 1.30), inv:false },
    { ic:'⚙', lbl:'パッシブ',  val:passCount + '/20',                                          hint:'達成済の常時効果数', grade: grade(passCount, 2, 5), inv:false },
  ];
  for (const it of items) it.arr = arrow(it.grade, it.inv);
  const activeCount = items.filter(x => x.grade !== 'none').length;
  const strongCount = items.filter(x => x.grade === 'strong').length;
  const collapsed = panel.classList.contains('collapsed');
  panel.innerHTML = '';
  // v1.0.4: 簡潔ヘッダ「⚡ 効果 N/8（うち強 M）」
  const modeLabel = strongCount >= 3 ? '大爆発中' : strongCount >= 1 ? '強化中' : activeCount >= 4 ? '稼働中' : activeCount > 0 ? '静か' : '休眠';
  const modeColor = strongCount >= 3 ? '#ffd86b' : strongCount >= 1 ? '#ffc070' : activeCount > 0 ? '#cfe6ff' : 'var(--ink-mute)';
  const header = el('div', { class:'ep-head' },
    el('span', { class:'ep-toggle',
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, collapsed ? '▸' : '▾'),
    el('span', { class:'ep-title',
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, '⚡ 効果'),
    el('span', { class:'ep-mode', style:{ color: modeColor, fontWeight:700 },
      onclick: () => { panel.classList.toggle('collapsed'); renderEffectsPanel(); },
    }, `${activeCount}/8 ・ ${modeLabel}`),
    el('button', { class:'ep-preset-btn', title:'パーティ プリセット',
      onclick: (e) => { e.stopPropagation(); openPartyPresets(); },
    }, '🗂'),
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
      sortedActive.forEach(it => list.appendChild(
        el('div', {
          class:'ep-row ep-' + it.grade,
          title: `${it.lbl}：${it.hint}\n現在 ${it.val} ／ タップで小 EXP`,
          onclick: (e) => tapEffectCell(it, e),
        },
          el('span', { class:'ep-row-ic' }, it.ic),
          el('span', { class:'ep-row-lbl' }, it.lbl),
          el('span', { class:'ep-row-arr' }, it.arr),
          el('span', { class:'ep-row-val' }, it.val),
        )
      ));
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

// v10n8: お気に入り（⭐）── 字／熟語
function toggleFavoriteChar(c) {
  if (!STATE.favorites) STATE.favorites = { chars:{}, yoji:{} };
  if (STATE.favorites.chars[c]) {
    delete STATE.favorites.chars[c];
    toast(`☆ ${c} のお気に入り解除`);
  } else {
    STATE.favorites.chars[c] = Date.now();
    toast(`⭐ ${c} をお気に入りに`);
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
    toast(`⭐ ${w} をお気に入りに`);
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
  const members = found.map((f, i) => {
    const perks = pickInherentPerks(f.char, f.rarity);
    if (i === 0 && !perks.includes('guardian')) perks.push('guardian');
    return { char:f.char, rarity:f.rarity, level:1, exp:0, perks };
  });
  STATE.party = { hero: 0, members };
  saveState();
  renderParty();
  updateProgressPill();
  try { playSFX('unlock'); } catch(_) {}
  toast(`✨「${r.word}」コンボ編成完了`, r.rarity);
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
function showRandomYoji() {
  const recipes = window.YOJI_RECIPES || [];
  if (recipes.length === 0) return;
  const r = recipes[Math.floor(Math.random() * recipes.length)];
  showYojiDetail(r);
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
  toast(`💡 「${pick.missingChar}」を仲間にすれば「${pick.recipe.word}」発動`, pick.recipe.rarity);
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
    } }, '✦ 固有効果 ── ' + (UNIQUE_COMBO_EFFECTS[r.word].story || '物語のある効果')) : null,
    // v10n8: コンボ効果プレビュー（数値）
    found ? el('div', { class:'ydp-preview', style:{
      margin:'6px 0', padding:'6px 8px',
      background:'rgba(135,206,235,.10)', border:'1px solid rgba(135,206,235,.30)',
      borderRadius:'6px', fontSize:'.72rem', color:'#cfe6ff', lineHeight:1.4,
    } },
      el('div', { style:{ fontWeight:700, marginBottom:'2px', color:'#87ceeb' } }, '⚡ 発動時の効果（現在のリーダー Lv 基準）'),
      el('div', {}, formatComboEffect(previewComboEffect(r)))
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
    // v10n8: アクション行 ── ⭐ お気に入り ＋ ワンタップ編成
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
      }, isFavoriteYoji(r.word) ? '⭐ お気に入り' : '☆ お気に入り'),
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
          const res = assemblePartyFromYoji(r);
          if (res.ok) { pop.remove(); }
          else if (res.reason) { toast('⚠ ' + res.reason); }
        },
      }, allInParty ? '✓ 発動中' : '✨ このコンボで編成') : null,
    ),
  );
  document.body.appendChild(pop);
  pop.addEventListener('click', (e) => { if (e.target === pop) pop.remove(); });
  setTimeout(() => {
    document.addEventListener('click', function once(ev) {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', once); }
    });
  }, 100);
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
  const isAlreadyHero = hasParty && partyIdx >= 0 && partyIdx === (STATE.party.hero || 0);
  const canRecruit = hasParty && STATE.party.members.length < 4 && partyIdx < 0;
  const actionBtns = [];
  if (hasParty && !isAlreadyHero) {
    actionBtns.push(el('button', {
      class:'cd-recruit cd-leader-btn',
      style:{ background:'linear-gradient(135deg,#f0d48a,#d4a84a)', color:'#1a1208', fontWeight:700 },
      onclick: () => {
        if (setAsLeader(c, rarity)) {
          $$('.char-detail-pop').forEach(e => e.remove());
          renderCodex();
        }
      },
    }, '★ リーダーに設定'));
  }
  if (canRecruit) {
    actionBtns.push(el('button', { class:'cd-recruit', onclick: () => {
      recruitToParty(c, rarity);
      $$('.char-detail-pop').forEach(e => e.remove());
      renderCodex();
    } }, '＋ 仲間に加える'));
  }
  if (isAlreadyHero) {
    actionBtns.push(el('div', { class:'cd-leader-already', style:{ padding:'8px', textAlign:'center', color:'var(--gold)', fontWeight:700 } }, '★ 現在のリーダーです'));
  }
  // v10n8: ⭐ お気に入りボタン
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
  }, isFavoriteChar(c) ? '⭐ お気に入り' : '☆ お気に入りに追加'));
  const recruitBtn = actionBtns.length > 0
    ? el('div', { class:'cd-actions', style:{ display:'flex', flexDirection:'column', gap:'6px', margin:'8px 0' } }, ...actionBtns)
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
        `⚙ パッシブ ── 常時発動の弱効果（${active.size} / ${PASSIVES.length} 発動中）`
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
        },
      },
        el('div', { style:{ fontSize:'1.6rem', minWidth:'32px', textAlign:'center', opacity: on ? 1 : 0.4 } }, p.icon || '◆'),
        el('div', { style:{ flex:1, minWidth:0 } },
          el('div', { style:{ fontWeight:700, fontSize:'.9rem', color: on ? '#cfe6ff' : 'var(--ink-mute)' } },
            (on ? '✓ ' : '🔒 ') + p.name
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
    let ownedCnt = 0;
    perks.forEach(([pid, p]) => {
      const lv = perkLv(pid);
      const cat = p.category || 'basic';
      const isRare = cat === 'rare';
      const isSpecial = cat === 'special';
      const isOwned = ownedPerks.has(pid);
      if (isOwned) ownedCnt++;
      const catLabel = {
        basic:'基本', tag:'タグ系', rare:'✦ レア', special:'主人公専用',
      }[cat] || cat;
      // 未獲得：名前・効果を「???」でマスク。カテゴリと「入手方法」だけ見せる
      const displayName = isOwned
        ? ((isRare ? '✦ ' : isSpecial ? '★ ' : '') + p.name)
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
    // v10n8: 「⭐ お気に入りのみ」フィルタ
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
      S3:'熟語', S4:'四字熟語',
      S5:'昭和文化', S6:'令和現代', S7:'未来（萌芽）'
    };
    const section = el('div', { class:'codex-section' },
      el('h3', { class:'codex-section-title' },
        `${codexFilter.season} ${SEASON_LABEL[codexFilter.season] || ''}（${recipes.length} 個）`)
    );
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

  // 🚀 v10n 最適化：1 ティアあたり表示上限（"もっと見る" で解放）
  const CELL_CAP = 800;  // ★13-16 でも 800 字なら 60fps 維持
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
      : '🔒 Lv.' + UNLOCK_LV[tier];
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
    // tier 内ループも DocumentFragment 化（最大 800 cells/tier × 16 tier = 12,800 cells max）
    const tierFrag = document.createDocumentFragment();
    for (const k of renderList) {
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
      tierFrag.appendChild(cell);
    }
    tierGrid.appendChild(tierFrag);
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
    STATE.mode === 'work'   ? '🎯 作業中' :
    STATE.mode === 'rest'   ? '🫧 休憩中' :
    STATE.mode === 'paused' ? '⏸ 一時停止' :
    '⌛ 準備中';
  bandEl.textContent = `${modeLabel} ・ ${tierName}帯 ${achName}`;
  const streak = STATE.streak?.current || 0;
  const streakStr = streak > 0 ? `🔥${streak}日 ・ ` : '';
  // v10n17: セット進捗（target>0 かつ作業/休憩中）
  const tgt = STATE.timer?.setsTarget || 0;
  const done = STATE.timer?.setsDone || 0;
  const setsStr = (tgt > 0 && (STATE.mode === 'work' || STATE.mode === 'rest'))
    ? `🔁 ${done + (STATE.mode === 'work' ? 1 : 0)}/${tgt}セット ・ ` : '';
  cycEl.textContent = `${setsStr}${streakStr}${STATE.stats.totalCycles || 0} 回完了`;
  // リーダー Lv ＋ 次解放までの差分
  const ldrEl = $('#pp-leader');
  if (ldrEl) {
    if (isPartyChosen()) {
      const hero = STATE.party.members[STATE.party.hero || 0];
      const nextTierName = RARITY_TIERS[tier + 1];
      const nextLv = nextTierName ? UNLOCK_LV[nextTierName] : null;
      const remain = nextLv != null ? nextLv - hero.level : null;
      ldrEl.textContent = nextTierName && remain > 0
        ? `${hero.char} Lv.${hero.level} 🔓 ${nextTierName}まで-${remain}`
        : `${hero.char} Lv.${hero.level} ✦ 全解放済`;
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
    { label:'🔥 連続日数', value: `${STATE.streak?.current || 0} 日（最長 ${STATE.streak?.longest || 0}）` },
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
        el('div', { class:'milestone-date' }, dateStr + ' ▶')
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
      el('div', { class:'milestone-icon' }, '🔒'),
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
    const title = prevMode === 'work' ? '🫧 作業完了 ── 休憩へ' : '🌧 休憩完了 ── 次のサイクルへ';
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
    toast('⚠ PiP 非対応：Chrome/Edge デスクトップで利用可');
    return;
  }
  if (_pipWindow) { _pipWindow.close(); _pipWindow = null; return; }
  try {
    _pipWindow = await documentPictureInPicture.requestWindow({ width: 260, height: 260 });
    const doc = _pipWindow.document;
    doc.body.style.cssText = `
      margin:0; background:#07111c; color:#cfe6ff;
      font-family:'Noto Serif JP',serif; overflow:hidden;
      display:flex; align-items:center; justify-content:center; height:100vh;
      position:relative;
    `;
    doc.body.innerHTML = `
      <div style="position:relative; width:200px; height:200px;">
        <svg viewBox="0 0 100 100" width="200" height="200" style="display:block;position:absolute;inset:0;">
          <circle cx="50" cy="50" r="47" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="3"/>
          <circle id="pip-fg" cx="50" cy="50" r="47" fill="none" stroke="#87ceeb" stroke-width="3"
            stroke-dasharray="295.31" stroke-dashoffset="0" transform="rotate(-90 50 50)" stroke-linecap="round"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div id="pip-text" style="font-size:2.4rem;font-weight:900;color:#fff;letter-spacing:.04em;">--:--</div>
          <div id="pip-mode" style="font-size:.78rem;opacity:.7;margin-top:4px;">⏸ 待機</div>
        </div>
      </div>
    `;
    _pipWindow.addEventListener('pagehide', () => {
      _pipWindow = null;
      clearTimeout(_pipRaf);  // v10n15 fix: setTimeout なので clearTimeout
    });
    syncPiP();
    toast('📺 PiP 開始 ── 他アプリ作業中もタイマーが見える');
  } catch(e) {
    toast('⚠ PiP 起動失敗: ' + (e.message || ''));
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
    if (STATE.mode === 'work' || STATE.mode === 'rest') {
      const rem = Math.max(0, STATE.phaseEnd - Date.now());
      txt.textContent = fmtTime(Math.ceil(rem/1000));
      const total = STATE.mode === 'work' ? STATE.timer.workSec : STATE.timer.restSec;
      const pct = 1 - (rem/1000) / total;
      fg.style.strokeDashoffset = 295.31 * (1 - pct);
      fg.style.stroke = STATE.mode === 'work' ? '#87ceeb' : '#c0a8ff';
      mode.textContent = STATE.mode === 'work' ? '🌧 作業中' : '🫧 休憩中';
    } else {
      txt.textContent = fmtTime(STATE.timer.workSec);
      mode.textContent = '⏸ 待機';
      fg.style.strokeDashoffset = 295.31;
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
      // v10n14: 復帰時に WakeLock を再取得
      if (STATE.mode === 'work' || STATE.mode === 'rest') requestWakeLock();

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
  // v1.0.3: ヘルプ ＋ ツアー 統合（モーダルから両方アクセス）
  menuClick('#m-help',       openHelpPlusTour);
  menuClick('#m-stats',      openStats);
  menuClick('#m-codex',      openCodex);
  menuClick('#m-data',       openDataManager);
  menuClick('#m-hud',        toggleHUD);
  menuClick('#m-pip',        toggleTimerPiP);
  menuClick('#m-theme',      openThemePicker);
  menuClick('#m-writings',   openWritings);
  // v10n11: m-edit-party 廃止 ── 図鑑からリーダー設定／🗂 プリセットで全カバー済
  menuClick('#m-sleep', openSleep);
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
        // 💤 スリープを Z で起動／解除
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
  $('#timer-text').textContent = fmtTime(STATE.timer.workSec);
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
  // v10n19: テーマ適用
  try { applyTheme(); } catch(_) {}
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
