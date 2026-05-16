'use strict';

// ═══════════════════════════════════════════════════════════════
// レアリティ体系 v2（2026-05-16）── 文字種ベース段階解放
// 配列順 = 解放順。★1-★10 → 将来 ★100 まで動的拡張可能設計
// ═══════════════════════════════════════════════════════════════
const POMOJI_RARITY = {
  '★1':  { stars: 1,  exp: 1,    weight: 70.0, color: '#9aa8b5', label: '★1',  tier: 1  },
  '★2':  { stars: 2,  exp: 3,    weight: 50.0, color: '#83b8d6', label: '★2',  tier: 2  },
  '★3':  { stars: 3,  exp: 8,    weight: 35.0, color: '#6ba6c7', label: '★3',  tier: 3  },
  '★4':  { stars: 4,  exp: 18,   weight: 22.0, color: '#5b8be0', label: '★4',  tier: 4  },
  '★5':  { stars: 5,  exp: 40,   weight: 14.0, color: '#5b78c8', label: '★5',  tier: 5  },
  '★6':  { stars: 6,  exp: 90,   weight: 8.0,  color: '#7a6cc4', label: '★6',  tier: 6  },
  '★7':  { stars: 7,  exp: 200,  weight: 4.0,  color: '#9b7ad0', label: '★7',  tier: 7  },
  '★8':  { stars: 8,  exp: 450,  weight: 1.8,  color: '#c89ae8', label: '★8',  tier: 8  },
  '★9':  { stars: 9,  exp: 900,  weight: 0.6,  color: '#e0b3d8', label: '★9',  tier: 9  },
  '★10': { stars: 10, exp: 2000, weight: 0.15, color: '#f0d48a', label: '★10', tier: 10 }
};

const KANJI_10KYU_STR =
  '一二三四五六七八九十百千万' +
  '日月火水木金土' +
  '人男女子父母兄姉弟妹友'+
  '上下左右前後内外中大小長短高低' +
  '山川田森林花草空雨雪風雲'+
  '石貝糸茶米麦豆魚鳥犬猫馬牛虫蝶蜂'+
  '手足口目耳心体頭' +
  '見行来立入出走歩飛'+
  '王玉光力気火'+
  '本字文音楽校先生学休年早'+
  '白黒赤青黄緑'+
  '朝昼夜春夏秋冬'+
  '右左下上中外内大小' +
  '不期命知新明葉死回多苦少' +
  '行止来去入出開閉' +
  '言話思見聞食寝走' +
  '同今古元始終' +
  '雨星玉夢';

const KANJI_5KYU_STR =
  '春夏秋冬朝晩夜暁昏'+
  '東西南北中央'+
  '理科社会算数体育美術音楽家庭'+
  '海湖池沼谷岡野原坂崎峠岩泉'+
  '時間分秒週月年代世紀'+
  '物事所者間室部局院館員'+
  '感情思考意志望願想念悲喜怒楽'+
  '走歩跳泳遊寝起食飲作切焼煮蒸'+
  '記録話語言声色光輝'+
  '読書写描画絵彫塑'+
  '建築造改修壊'+
  '勝負戦闘武剣弓矢盾'+
  '送届転届贈寄'+
  '銀河星辰彗流'+
  '路道里県市町村'+
  '雪霜雷虹霧靄'+
  '羊蛇竜亀蛙鯨'+
  '机椅窓壁扉鍵' +
  '族徒自由平和定愛勇有身教仕息味飯利化過去未代' +
  '温故専途難暗寒暑清紅運宿然太波常発初会' +
  '駅店館宿屋市区都府県島港湾橋路通街内' +
  '言葉文章書簡電灯杯皿椀盆椅' +
  '駆寄抱招応唱囁笑泣叫呼' +
  '断決絶賛対';

const KANJI_3KYU_STR =
  '勉強努力続貫励磨' +
  '夢志望希願想念創造' +
  '善悪正誤真偽誠虚' +
  '優劣秀才賢愚智慧' +
  '責任義務役職官員' +
  '存在現実虚空空間' +
  '永遠久長短早遅急' +
  '尊敬礼謙偉貴卑' +
  '誇恥感謝悲喜' +
  '純真高潔崇高' +
  '紀紙絹綿絲縫綴' +
  '泉潤滴渇涸湧' +
  '燃焼熱冷凍解' +
  '銅鉄鋼錆金属' +
  '雛燕鳳凰麒麟' +
  '幻夢虚実陰陽' +
  '律調響鳴奏歌' +
  '陣戦勝敗武士' +
  '槍弓矢馬鎧兜旗' +
  '麗華徳倫歴史使魔磋琢衣象勧懲徹意' +
  '翠紺碧緋茜紫蓮菖鴎廉静' +
  '季梅氷夕' +
  '敬厳宝格' +
  '動若老進退' +
  '托' +
  '我';

const KANJI_1KYU_STR =
  '哲学義道理論法則' +
  '禅悟瞑想修行解脱' +
  '宇宙銀河星辰彗' +
  '霊魂神聖仏釈迦陀' +
  '幻想夢虚陰陽' +
  '韻律調奏歌' +
  '雷嵐虹雹霜凍' +
  '繍錦綺綾繡綴' +
  '雛燕鳳凰麒麟龍獅' +
  '黎曙暁晨宵宛' +
  '幽玄奥秘謎妙微繊' +
  '驚駭慟憤慨哀愁憂' +
  '燦爛輝燿煌耀' +
  '殷富裕貴賤' +
  '叡智慧聖賢' +
  '孤独儒菩薩飢瞬侘為滅提伝髄魄羅' +
  '臥薪嘗胆撓屈' +
  '凛漣渦煌嶺鬱艶眩謐閑蝉' +
  '霖' +
  '諸' +
  '刻差別' +
  '地' +
  '哀如';

const KANJI_SHODAN_STR =
  '叡睿哲聖賢' +
  '繍錦綺綾繡綴' +
  '雛燕鳳凰麒麟龍獅' +
  '黎曙暁晨宵' +
  '幽玄奥秘妙繊' +
  '驚駭慟憤慨' +
  '燦爛輝燿煌耀' +
  '殷富裕' +
  '叡慧聖' +
  '寂寞蓼' +
  '澪渚浬' +
  '蒼穹蒼瑶' +
  '寥刹那';

const KANJI_JUDAN_STR =
  '勤勉謙虚慈悲寛大純潔節制忍耐' +
  '怠惰傲慢強欲色欲嫉妬暴食憤怒' +
  '永無極天道空聖真虚寂幽玄奥闇';

// ─── ★1: ひらがな（始まりの音）───
// 清音46 + 濁音20 + 半濁音5 + 小書き9 = 80字
const HIRAGANA_STR =
  'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん' +
  'がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ' +
  'ぁぃぅぇぉっゃゅょゎ';

// ─── ★2: カタカナ（もうひとつの音）───
// 清音46 + 濁音20 + 半濁音5 + 小書き9 + 長音1 = 81字
const KATAKANA_STR =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ' +
  'ァィゥェォッャュョヮー';

// ─── ★3: 数字（量と順序）───
// 半角アラビア10 + 漢数字14 + ローマ数字10 = 34字
const NUMERAL_STR =
  '0123456789' +
  '〇零壱弐参肆伍陸漆捌玖拾' +
  '億兆' +
  'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ';

// ─── ★4: 英語（異邦の文字）───
// 大文字26 + 小文字26 = 52字
const ALPHABET_STR =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
  'abcdefghijklmnopqrstuvwxyz';

function buildKanjiCodex(){
  const all = [];
  const seen = new Set();
  const addStr = (str, rarity, tags) => {
    for (const c of str){
      if (seen.has(c)) continue;
      if (c === ' ' || c === '\n') continue;
      seen.add(c);
      all.push({ id:'k_'+c, c, rarity, yomi:'', tags: tags ? [...tags] : [] });
    }
  };
  // 文字種で段階解放（v2 / 2026-05-16）
  // 順番が大切：先に登録された rarity が優先される（seen.has で重複判定）
  addStr(HIRAGANA_STR,     '★1',  ['ひらがな','音']);
  addStr(KATAKANA_STR,     '★2',  ['カタカナ','音']);
  addStr(NUMERAL_STR,      '★3',  ['数字','数']);
  addStr(ALPHABET_STR,     '★4',  ['英語','異邦']);
  addStr(KANJI_10KYU_STR,  '★5',  ['漢字','拾級','基礎']);
  addStr(KANJI_5KYU_STR,   '★6',  ['漢字','五級','日常']);
  addStr(KANJI_3KYU_STR,   '★7',  ['漢字','三級']);
  addStr(KANJI_1KYU_STR,   '★8',  ['漢字','一級','深']);
  addStr(KANJI_SHODAN_STR, '★9',  ['漢字','初段','美']);
  addStr(KANJI_JUDAN_STR,  '★10', ['漢字','拾段','神字']);
  return all;
}

const KANJI_CODEX = buildKanjiCodex();

const SEVEN_VIRTUE_CHARS = '勤勉謙虚慈悲寛大純潔節制忍耐';
const SEVEN_SIN_CHARS    = '怠惰傲慢強欲色欲嫉妬暴食憤怒';
const SACRED_CHARS       = '永無極天道空聖真虚寂幽玄奥闇';
for (const k of KANJI_CODEX){
  if (SEVEN_VIRTUE_CHARS.includes(k.c)) k.tags.push('七徳');
  if (SEVEN_SIN_CHARS.includes(k.c))    k.tags.push('七大罪');
  if (SACRED_CHARS.includes(k.c))        k.tags.push('神字');
}

const KANJI_DESC = {
  '勤':'続けることが力', '勉':'励むこと', '謙':'自分を測る','虚':'空白の彫刻',
  '慈':'与えて満ちる', '悲':'共に痛む心', '寛':'比較しない','大':'器の広さ',
  '純':'選びきる', '潔':'澄ませる', '節':'満腹を選ばない','制':'律する',
  '忍':'流さない', '耐':'続けて崩れない',
  '怠':'明日に賭ける', '惰':'動かない', '傲':'測らない','慢':'軽んじる',
  '強':'強引な力', '欲':'閉じる手','色':'迷う心',
  '嫉':'比べる毒', '妬':'眩しさへの怒り', '暴':'満たし続ける','食':'飲み込む',
  '憤':'内に燃やす', '怒':'流す炎',
  '永':'時を越える', '無':'すべての始まり', '極':'果てなき頂','天':'上を見上げる',
  '道':'歩いて開く', '空':'満ちる前の余白', '聖':'清められた','真':'飾らぬもの',
  '寂':'静かなる音', '幽':'微かに見える', '玄':'奥にある黒','奥':'底にある',
  '闇':'光を吸い込む',
  '一':'始まり', '二':'対になるもの', '三':'整う数',
  '人':'存在する者', '水':'流れ', '火':'燃える', '木':'生長する',
  '土':'大地', '月':'満ち欠ける', '日':'太陽',
  '心':'動かす源', '気':'巡る力', '光':'闇を破るもの', '力':'動きの素',
  '夢':'目を閉じて見るもの', '愛':'与えてやまぬ心',
  '春':'始まりの季節', '夏':'盛りの季節', '秋':'実りの季節', '冬':'静かなる季節',
  '朝':'明けゆく時', '夕':'沈みゆく時', '風':'流れる気', '雪':'白の沈黙',
  '花':'咲いて散る', '草':'地を覆う', '森':'木々の集まり', '海':'すべてを抱く',
  '信':'真実とすること', '義':'正しさの基準', '命':'生のしるし', '言':'声に出す',
  '徳':'内に積もる善', '行':'歩いて進む', '礼':'敬う形',
  '美':'整って心動かす', '善':'進む方を選ぶ', '悪':'退く方を選ぶ',
  '動':'うごく ・ 引力に応じる', '若':'未だ完全になっていない', '老':'時を積んだ',
  '進':'前に出る', '退':'引き下がる',
  '知':'光を当てて見える', '想':'頭の中で組み立てる',
  '念':'胸の奥で繰り返す', '願':'空に投げる祈り',
  '志':'掲げて歩く方角', '思':'巡って戻る考え'
};

// ─── ★3 数字（量と順序）の意味 ───
const NUMERAL_DESC = {
  '0':'無の輪','1':'始まりの一','2':'対になる','3':'整う数','4':'四つの方角',
  '5':'手のひらの数','6':'六方','7':'幸を呼ぶ数','8':'末広がり','9':'極まりの数',
  '〇':'円・空・ゼロ', '零':'数の前夜', '壱':'一の正式', '弐':'二の正式', '参':'三の正式',
  '肆':'四の大字', '伍':'五の大字', '陸':'六の大字', '漆':'七の大字', '捌':'八の大字',
  '玖':'九の大字', '拾':'十の大字', '億':'人の限界の数', '兆':'前触れにして数の海',
  'Ⅰ':'ローマの一','Ⅱ':'ローマの二','Ⅲ':'ローマの三','Ⅳ':'ローマの四','Ⅴ':'ローマの五',
  'Ⅵ':'ローマの六','Ⅶ':'ローマの七','Ⅷ':'ローマの八','Ⅸ':'ローマの九','Ⅹ':'ローマの十',
};

// ─── ★4 英語（異邦の文字）の意味 ───
const ALPHABET_DESC = {
  'A':'始まりの母音','B':'息の破裂','C':'弧を描く音','D':'扉を叩く','E':'三本の棚',
  'I':'立つ一','J':'曲がる槍','M':'山並み','N':'谷川','O':'円・口・無',
  'S':'蛇','T':'十字','U':'器','V':'勝利のしるし','W':'波','X':'未知数','Z':'最後の稲妻',
  'a':'小さき始まり','e':'巡る音','i':'点を頂く','o':'丸の小','s':'流れる線'
};

for (const k of KANJI_CODEX){
  if (KANJI_DESC[k.c])    k.desc = KANJI_DESC[k.c];
  if (NUMERAL_DESC[k.c])  k.desc = NUMERAL_DESC[k.c];
  if (ALPHABET_DESC[k.c]) k.desc = ALPHABET_DESC[k.c];
}

const YOJI_RECIPES = [
  { word:'勤勉', chars:['勤','勉'], rarity:'★6', tags:['七徳','仏教','儒教'], desc:'続ける力 ・ 今日に賭ける' },
  { word:'謙虚', chars:['謙','虚'], rarity:'★6', tags:['七徳','儒教'],       desc:'自分を測る ・ 他を立てる' },
  { word:'慈悲', chars:['慈','悲'], rarity:'★6', tags:['七徳','仏教'],       desc:'与えるほど満ちる ・ 質量保存' },
  { word:'寛大', chars:['寛','大'], rarity:'★6', tags:['七徳'],             desc:'比較しない ・ 受け容れる' },
  { word:'純潔', chars:['純','潔'], rarity:'★6', tags:['七徳','キリスト教'], desc:'選びきる ・ 本筋を強める' },
  { word:'節制', chars:['節','制'], rarity:'★6', tags:['七徳'],             desc:'満腹を選ばない ・ 創造を湧かす' },
  { word:'忍耐', chars:['忍','耐'], rarity:'★6', tags:['七徳'],             desc:'流さない ・ 未来に目を置く' },

  { word:'怠惰', chars:['怠','惰'], rarity:'★6', tags:['七大罪'], desc:'明日に賭ける ・ 今日を捨てる' },
  { word:'傲慢', chars:['傲','慢'], rarity:'★6', tags:['七大罪'], desc:'自分を測らぬ ・ 他を軽んじる' },
  { word:'強欲', chars:['強','欲'], rarity:'★6', tags:['七大罪'], desc:'閉じた手 ・ 与えられぬ' },
  { word:'色欲', chars:['色','欲'], rarity:'★6', tags:['七大罪'], desc:'迷う心 ・ 選びきれぬ' },
  { word:'嫉妬', chars:['嫉','妬'], rarity:'★6', tags:['七大罪'], desc:'比べる毒 ・ 足元を見ぬ' },
  { word:'暴食', chars:['暴','食'], rarity:'★6', tags:['七大罪'], desc:'満たし続ける ・ 終わらぬ飢え' },
  { word:'憤怒', chars:['憤','怒'], rarity:'★6', tags:['七大罪'], desc:'流す炎 ・ 焼け野原' },

  { word:'宇宙', chars:['宇','宙'], rarity:'★4', tags:['天体','物理'], desc:'すべて' },
  { word:'銀河', chars:['銀','河'], rarity:'★4', tags:['天体'] },
  { word:'流星', chars:['流','星'], rarity:'★3', tags:['天体'] },
  { word:'天空', chars:['天','空'], rarity:'★4', tags:['天体','神字'] },
  { word:'雷光', chars:['雷','光'], rarity:'★4', tags:['天体'] },
  { word:'霧雨', chars:['霧','雨'], rarity:'★4', tags:['天候'] },
  { word:'虹色', chars:['虹','色'], rarity:'★4', tags:['色','天候'] },
  { word:'蒼穹', chars:['蒼','穹'], rarity:'★5', tags:['天体','古典'] },

  { word:'日本', chars:['日','本'], rarity:'★2', tags:['国'] },
  { word:'家庭', chars:['家','庭'], rarity:'★2', tags:['場所'] },
  { word:'学校', chars:['学','校'], rarity:'★2', tags:['場所','学'] },
  { word:'家族', chars:['家','族'], rarity:'★2', tags:['人','関係'] },

  { word:'学者', chars:['学','者'], rarity:'★3', tags:['職','学'] },
  { word:'先生', chars:['先','生'], rarity:'★2', tags:['職','人'] },
  { word:'生徒', chars:['生','徒'], rarity:'★2', tags:['人'] },
  { word:'人間', chars:['人','間'], rarity:'★2', tags:['存在'] },
  { word:'家族', chars:['家','族'], rarity:'★2', tags:['人'] },
  { word:'武士', chars:['武','士'], rarity:'★3', tags:['職','武'] },

  { word:'真実', chars:['真','実'], rarity:'★3', tags:['思想'] },
  { word:'夢想', chars:['夢','想'], rarity:'★3', tags:['思想','心'] },
  { word:'創造', chars:['創','造'], rarity:'★3', tags:['思想'] },
  { word:'自由', chars:['自','由'], rarity:'★3', tags:['思想'] },
  { word:'平和', chars:['平','和'], rarity:'★3', tags:['思想'] },
  { word:'正義', chars:['正','義'], rarity:'★3', tags:['思想','法'] },
  { word:'修行', chars:['修','行'], rarity:'★4', tags:['道','仏教','禅'] },
  { word:'瞑想', chars:['瞑','想'], rarity:'★4', tags:['道','仏教','禅'] },
  { word:'解脱', chars:['解','脱'], rarity:'★4', tags:['道','仏教'] },
  { word:'禅定', chars:['禅','定'], rarity:'★5', tags:['禅','仏教'] },
  { word:'極道', chars:['極','道'], rarity:'★5', tags:['道','神字'] },
  { word:'空無', chars:['空','無'], rarity:'★5', tags:['禅','仏教','神字'] },
  { word:'真理', chars:['真','理'], rarity:'★3', tags:['思想','哲学'] },
  { word:'哲学', chars:['哲','学'], rarity:'★4', tags:['学','思想'] },

  { word:'愛情', chars:['愛','情'], rarity:'★3', tags:['感情'] },
  { word:'友情', chars:['友','情'], rarity:'★3', tags:['感情','関係'] },
  { word:'感謝', chars:['感','謝'], rarity:'★3', tags:['感情'] },
  { word:'希望', chars:['希','望'], rarity:'★3', tags:['感情'] },
  { word:'勇気', chars:['勇','気'], rarity:'★3', tags:['感情'] },
  { word:'情熱', chars:['情','熱'], rarity:'★3', tags:['感情'] },
  { word:'孤独', chars:['孤','独'], rarity:'★4', tags:['感情'] },
  { word:'寂寥', chars:['寂','寥'], rarity:'★5', tags:['感情','古典','神字'] },

  { word:'永遠', chars:['永','遠'], rarity:'★4', tags:['時','神字'] },
  { word:'刹那', chars:['刹','那'], rarity:'★5', tags:['時','仏教'] },
  { word:'瞬間', chars:['瞬','間'], rarity:'★4', tags:['時'] },
  { word:'過去', chars:['過','去'], rarity:'★2', tags:['時'] },
  { word:'未来', chars:['未','来'], rarity:'★2', tags:['時'] },
  { word:'現在', chars:['現','在'], rarity:'★2', tags:['時'] },

  { word:'幽玄', chars:['幽','玄'], rarity:'★5', tags:['美','禅','神字'] },
  { word:'侘寂', chars:['侘','寂'], rarity:'★5', tags:['美','禅'] },
  { word:'美麗', chars:['美','麗'], rarity:'★3', tags:['美'] },
  { word:'華麗', chars:['華','麗'], rarity:'★3', tags:['美'] },

  { word:'聖人', chars:['聖','人'], rarity:'★5', tags:['神字','宗教'] },
  { word:'神聖', chars:['神','聖'], rarity:'★4', tags:['神字','宗教'] },
  { word:'仏陀', chars:['仏','陀'], rarity:'★5', tags:['仏教'] },
  { word:'菩薩', chars:['菩','薩'], rarity:'★5', tags:['仏教'] },
  { word:'天使', chars:['天','使'], rarity:'★4', tags:['キリスト教','宗教'] },
  { word:'悪魔', chars:['悪','魔'], rarity:'★4', tags:['キリスト教','悪'] },
  { word:'神話', chars:['神','話'], rarity:'★3', tags:['宗教','古典'] },

  { word:'美味', chars:['美','味'], rarity:'★3', tags:['食'] },
  { word:'飢渇', chars:['飢','渇'], rarity:'★4', tags:['食'] },
  { word:'米飯', chars:['米','飯'], rarity:'★2', tags:['食'] },

  { word:'勝利', chars:['勝','利'], rarity:'★2', tags:['武'] },
  { word:'敗北', chars:['敗','北'], rarity:'★2', tags:['武'] },
  { word:'闘志', chars:['闘','志'], rarity:'★3', tags:['武','感情'] },
  { word:'武道', chars:['武','道'], rarity:'★3', tags:['武','道'] },
  { word:'剣道', chars:['剣','道'], rarity:'★3', tags:['武','道'] },
  { word:'弓道', chars:['弓','道'], rarity:'★3', tags:['武','道'] },

  { word:'読書', chars:['読','書'], rarity:'★2', tags:['学'] },
  { word:'数学', chars:['数','学'], rarity:'★2', tags:['学','数'] },
  { word:'物理', chars:['物','理'], rarity:'★2', tags:['学','物理'] },
  { word:'化学', chars:['化','学'], rarity:'★2', tags:['学','化学'] },
  { word:'生物', chars:['生','物'], rarity:'★2', tags:['学','生物'] },
  { word:'歴史', chars:['歴','史'], rarity:'★2', tags:['学'] },

  { word:'水火', chars:['水','火'], rarity:'★1', tags:['自然','元素'] },
  { word:'山河', chars:['山','河'], rarity:'★2', tags:['自然'] },
  { word:'森林', chars:['森','林'], rarity:'★1', tags:['自然'] },
  { word:'草花', chars:['草','花'], rarity:'★1', tags:['自然','植物'] },
  { word:'空気', chars:['空','気'], rarity:'★1', tags:['自然'] },
  { word:'光陰', chars:['光','陰'], rarity:'★4', tags:['時'] },

  { word:'一二', chars:['一','二'], rarity:'★1', tags:['数'] },
  { word:'千万', chars:['千','万'], rarity:'★1', tags:['数'] },
  { word:'万有', chars:['万','有'], rarity:'★4', tags:['哲学'] },

  { word:'心身', chars:['心','身'], rarity:'★2', tags:['体','心'] },
  { word:'手足', chars:['手','足'], rarity:'★1', tags:['体'] },
  { word:'目耳', chars:['目','耳'], rarity:'★1', tags:['体'] },

  { word:'仏教', chars:['仏','教'], rarity:'★3', tags:['宗教'] },
  { word:'神道', chars:['神','道'], rarity:'★3', tags:['宗教'] },
  { word:'儒教', chars:['儒','教'], rarity:'★3', tags:['宗教','儒教'] },
  { word:'道徳', chars:['道','徳'], rarity:'★4', tags:['思想'] },
  { word:'倫理', chars:['倫','理'], rarity:'★4', tags:['思想'] },

  { word:'家事', chars:['家','事'], rarity:'★2', tags:['暮らし'] },
  { word:'仕事', chars:['仕','事'], rarity:'★2', tags:['暮らし'] },
  { word:'休息', chars:['休','息'], rarity:'★2', tags:['暮らし'] },

  { word:'一期一会', chars:['一','期','一','会'], rarity:'★6', tags:['四字熟語','茶道','禅'], desc:'この瞬間は二度と来ない' },
  { word:'温故知新', chars:['温','故','知','新'], rarity:'★5', tags:['四字熟語','儒教'], desc:'古きを訪ねて新しきを知る' },
  { word:'一意専心', chars:['一','意','専','心'], rarity:'★5', tags:['四字熟語','心'], desc:'心を一つに集中' },
  { word:'切磋琢磨', chars:['切','磋','琢','磨'], rarity:'★5', tags:['四字熟語'], desc:'互いに磨き合う' },
  { word:'前途多難', chars:['前','途','多','難'], rarity:'★4', tags:['四字熟語'] },
  { word:'臥薪嘗胆', chars:['臥','薪','嘗','胆'], rarity:'★6', tags:['四字熟語','武'], desc:'復讐のため苦難に耐える' },
  { word:'七転八起', chars:['七','転','八','起'], rarity:'★5', tags:['四字熟語','数'], desc:'倒れても立ち上がる' },
  { word:'十人十色', chars:['十','人','十','色'], rarity:'★2', tags:['四字熟語','数'], desc:'人それぞれ' },
  { word:'四苦八苦', chars:['四','苦','八','苦'], rarity:'★4', tags:['四字熟語','仏教','数'] },
  { word:'天衣無縫', chars:['天','衣','無','縫'], rarity:'★6', tags:['四字熟語','美','神字'], desc:'自然で美しい' },
  { word:'森羅万象', chars:['森','羅','万','象'], rarity:'★6', tags:['四字熟語','禅'], desc:'すべての現象' },
  { word:'有言実行', chars:['有','言','実','行'], rarity:'★3', tags:['四字熟語','徳'] },
  { word:'不言実行', chars:['不','言','実','行'], rarity:'★3', tags:['四字熟語','徳'] },
  { word:'自由自在', chars:['自','由','自','在'], rarity:'★2', tags:['四字熟語','禅'] },
  { word:'青天白日', chars:['青','天','白','日'], rarity:'★4', tags:['四字熟語'] },
  { word:'勧善懲悪', chars:['勧','善','懲','悪'], rarity:'★5', tags:['四字熟語','道徳'] },
  { word:'起死回生', chars:['起','死','回','生'], rarity:'★5', tags:['四字熟語'] },
  { word:'一念発起', chars:['一','念','発','起'], rarity:'★3', tags:['四字熟語','仏教'] },
  { word:'初志貫徹', chars:['初','志','貫','徹'], rarity:'★5', tags:['四字熟語','徳'] },
  { word:'不撓不屈', chars:['不','撓','不','屈'], rarity:'★6', tags:['四字熟語','徳'] },

  { word:'光陰', chars:['光','陰'], rarity:'★4', tags:['時'] },
  { word:'山水', chars:['山','水'], rarity:'★1', tags:['自然'] },
  { word:'風月', chars:['風','月'], rarity:'★3', tags:['自然','美'] },
  { word:'花鳥', chars:['花','鳥'], rarity:'★1', tags:['自然'] },
  { word:'明暗', chars:['明','暗'], rarity:'★2', tags:['対比'] },
  { word:'生死', chars:['生','死'], rarity:'★2', tags:['対比','仏教'] },
  { word:'喜悲', chars:['喜','悲'], rarity:'★2', tags:['感情'] },
  { word:'寒暑', chars:['寒','暑'], rarity:'★2', tags:['対比'] },
  { word:'明月', chars:['明','月'], rarity:'★2', tags:['自然'] },
  { word:'清流', chars:['清','流'], rarity:'★2', tags:['自然'] },
  { word:'清風', chars:['清','風'], rarity:'★3', tags:['自然'] },
  { word:'青春', chars:['青','春'], rarity:'★3', tags:['時','人'] },
  { word:'白夜', chars:['白','夜'], rarity:'★4', tags:['時'] },
  { word:'紅葉', chars:['紅','葉'], rarity:'★3', tags:['自然'] },
  { word:'秋空', chars:['秋','空'], rarity:'★2', tags:['自然'] },
  { word:'雪原', chars:['雪','原'], rarity:'★2', tags:['自然'] },
  { word:'霊魂', chars:['霊','魂'], rarity:'★4', tags:['神字','宗教'] },
  { word:'魂魄', chars:['魂','魄'], rarity:'★5', tags:['古典','宗教'] },
  { word:'天命', chars:['天','命'], rarity:'★4', tags:['神字','儒教'] },
  { word:'運命', chars:['運','命'], rarity:'★3', tags:['思想'] },
  { word:'宿命', chars:['宿','命'], rarity:'★4', tags:['思想'] },
  { word:'自然', chars:['自','然'], rarity:'★3', tags:['自然'] },
  { word:'宇宙', chars:['宇','宙'], rarity:'★4', tags:['天体'] },
  { word:'銀河', chars:['銀','河'], rarity:'★4', tags:['天体'] },
  { word:'太陽', chars:['太','陽'], rarity:'★3', tags:['天体'] },
  { word:'流水', chars:['流','水'], rarity:'★1', tags:['自然'] },
  { word:'波光', chars:['波','光'], rarity:'★2', tags:['自然'] },
  { word:'禅心', chars:['禅','心'], rarity:'★4', tags:['禅'] },
  { word:'無心', chars:['無','心'], rarity:'★4', tags:['禅','神字'] },
  { word:'無常', chars:['無','常'], rarity:'★4', tags:['仏教','神字'] },
  { word:'有為', chars:['有','為'], rarity:'★4', tags:['仏教'] },
  { word:'空寂', chars:['空','寂'], rarity:'★5', tags:['禅','神字'] },
  { word:'寂滅', chars:['寂','滅'], rarity:'★5', tags:['仏教','神字'] },
  { word:'菩提', chars:['菩','提'], rarity:'★5', tags:['仏教'] },
  { word:'悟道', chars:['悟','道'], rarity:'★5', tags:['仏教','禅'] },
  { word:'仏道', chars:['仏','道'], rarity:'★4', tags:['仏教'] },
  { word:'神道', chars:['神','道'], rarity:'★3', tags:['宗教'] },
  { word:'武道', chars:['武','道'], rarity:'★3', tags:['武'] },
  { word:'茶道', chars:['茶','道'], rarity:'★3', tags:['文化'] },
  { word:'華道', chars:['華','道'], rarity:'★3', tags:['文化'] },
  { word:'書道', chars:['書','道'], rarity:'★3', tags:['文化','書'] },
  { word:'画道', chars:['画','道'], rarity:'★3', tags:['文化'] },
  { word:'歌道', chars:['歌','道'], rarity:'★3', tags:['文化'] },
  { word:'人道', chars:['人','道'], rarity:'★3', tags:['道徳'] },
  { word:'天道', chars:['天','道'], rarity:'★4', tags:['神字','儒教'] },
  { word:'王道', chars:['王','道'], rarity:'★3', tags:['儒教'] },
  { word:'極意', chars:['極','意'], rarity:'★5', tags:['神字','武'] },
  { word:'秘伝', chars:['秘','伝'], rarity:'★5', tags:['武'] },
  { word:'奥義', chars:['奥','義'], rarity:'★5', tags:['神字','武'] },
  { word:'真髄', chars:['真','髄'], rarity:'★5', tags:['思想'] },

  { word:'凛然', chars:['凛','然'], rarity:'★5', tags:['美'], desc:'引き締まった様子' },
  { word:'清廉', chars:['清','廉'], rarity:'★3', tags:['徳'], desc:'清く廉潔' },
  { word:'高潔', chars:['高','潔'], rarity:'★3', tags:['徳'] },
  { word:'静謐', chars:['静','謐'], rarity:'★5', tags:['美','禅'], desc:'深い静けさ' },
  { word:'閑寂', chars:['閑','寂'], rarity:'★5', tags:['美','禅'] },
  { word:'空蝉', chars:['空','蝉'], rarity:'★5', tags:['古典','神字'] },
  { word:'夢幻', chars:['夢','幻'], rarity:'★3', tags:['思想','禅'] },

  { word:'雨季', chars:['雨','季'], rarity:'★2', tags:['天候','時'] },
  { word:'雨情', chars:['雨','情'], rarity:'★3', tags:['天候','感情','古典'] },
  { word:'梅雨', chars:['梅','雨'], rarity:'★2', tags:['天候','日本'] },
  { word:'氷雨', chars:['氷','雨'], rarity:'★3', tags:['天候','美'] },
  { word:'時雨', chars:['時','雨'], rarity:'★3', tags:['天候','古典','日本'] },
  { word:'夕立', chars:['夕','立'], rarity:'★2', tags:['天候','日本'] },
  { word:'霖雨', chars:['霖','雨'], rarity:'★5', tags:['天候','古典'] },

  { word:'諸行無常', chars:['諸','行','無','常'], rarity:'★6', tags:['四字熟語','仏教','禅'], desc:'すべては移ろう' },
  { word:'不立文字', chars:['不','立','文','字'], rarity:'★6', tags:['四字熟語','禅','仏教'], desc:'真理は言葉では伝わらない' },
  { word:'風林火山', chars:['風','林','火','山'], rarity:'★6', tags:['四字熟語','武','日本'], desc:'疾如風 徐如林 侵掠如火 不動如山' },

  { word:'花鳥風月', chars:['花','鳥','風','月'], rarity:'★6', tags:['四字熟語','自然','美','日本'], desc:'自然の美の総称' },
  { word:'山紫水明', chars:['山','紫','水','明'], rarity:'★5', tags:['四字熟語','自然','美'], desc:'山は紫に水は明に' },
  { word:'風花雪月', chars:['風','花','雪','月'], rarity:'★5', tags:['四字熟語','自然','美'], desc:'四季の景物' },

  { word:'一日一善', chars:['一','日','一','善'], rarity:'★5', tags:['四字熟語','仏教','徳'], desc:'毎日一つの善行' },
  { word:'一刻千金', chars:['一','刻','千','金'], rarity:'★5', tags:['四字熟語','時'], desc:'時間の貴重さ' },
  { word:'千差万別', chars:['千','差','万','別'], rarity:'★4', tags:['四字熟語','数'], desc:'千差万別な様' },

  { word:'春夏秋冬', chars:['春','夏','秋','冬'], rarity:'★6', tags:['四字熟語','時','自然'], desc:'四季の総称' },
  { word:'東西南北', chars:['東','西','南','北'], rarity:'★6', tags:['四字熟語','方位'], desc:'四方の総称' },
  { word:'真善美', chars:['真','善','美'], rarity:'★5', tags:['三字熟語','哲学','古典'], desc:'人類の三つの理想' },
  { word:'天地人', chars:['天','地','人'], rarity:'★5', tags:['三字熟語','儒教','古典'], desc:'三才・万物の主宰' },

  { word:'喜怒哀楽', chars:['喜','怒','哀','楽'], rarity:'★5', tags:['四字熟語','感情'], desc:'人間のさまざまな感情' },
  { word:'自由意志', chars:['自','由','意','志'], rarity:'★4', tags:['四字熟語','哲学'], desc:'主体的に選ぶ力' },
  { word:'光陰矢如', chars:['光','陰','矢','如'], rarity:'★5', tags:['四字熟語','時'], desc:'光陰矢の如し' },

  { word:'心身一如', chars:['心','身','一','如'], rarity:'★5', tags:['四字熟語','禅','仏教'], desc:'心と身は一つ' },
  { word:'無念無想', chars:['無','念','無','想'], rarity:'★6', tags:['四字熟語','禅','仏教'], desc:'心を空にする' },
  { word:'四海兄弟', chars:['四','海','兄','弟'], rarity:'★4', tags:['四字熟語','儒教','人倫'], desc:'世界中の人は皆兄弟' },

  { word:'一日千秋', chars:['一','日','千','秋'], rarity:'★5', tags:['四字熟語','時'], desc:'一日が千年に感じる' },
  { word:'武者修行', chars:['武','者','修','行'], rarity:'★4', tags:['四字熟語','武','道'], desc:'武術を究めるための修行' },
  { word:'山水画', chars:['山','水','画'], rarity:'★2', tags:['三字熟語','文化','美'], desc:'山と水の景色を描いた絵' },

  { word:'決断', chars:['決','断'], rarity:'★2', tags:['行動','徳'], desc:'決めて断つ' },
  { word:'絶対', chars:['絶','対'], rarity:'★2', tags:['思想'], desc:'比較を超えた' },
  { word:'言語道断', chars:['言','語','道','断'], rarity:'★5', tags:['四字熟語','古典'], desc:'言葉では言い表せないほど' },
  { word:'自画自賛', chars:['自','画','自','賛'], rarity:'★3', tags:['四字熟語'], desc:'自分で自分を褒める' },

  { word:'八百万', chars:['八','百','万'], rarity:'★5', tags:['三字熟語','神道','日本'], desc:'数えきれない神々' },
  { word:'大和魂', chars:['大','和','魂'], rarity:'★5', tags:['三字熟語','日本','古典'], desc:'日本の心' },
  { word:'風土', chars:['風','土'], rarity:'★2', tags:['自然','文化'] },
  { word:'木霊', chars:['木','霊'], rarity:'★3', tags:['神道','自然'], desc:'山や谷に住む霊' },

  { word:'大慈大悲', chars:['大','慈','大','悲'], rarity:'★6', tags:['四字熟語','仏教'], desc:'仏の広大な慈悲' },
  { word:'法則', chars:['法','則'], rarity:'★4', tags:['哲学','学'], desc:'宇宙の決まりごと' },
  { word:'自然体', chars:['自','然','体'], rarity:'★3', tags:['三字熟語','禅','武'], desc:'力を抜いた本来の構え' },

  { word:'真心', chars:['真','心'], rarity:'★2', tags:['徳','感情'], desc:'飾らぬ気持ち' },
  { word:'一心', chars:['一','心'], rarity:'★2', tags:['心','禅'], desc:'一つに集中する' },
  { word:'義理', chars:['義','理'], rarity:'★3', tags:['倫理','儒教'], desc:'守るべき筋' },
  { word:'義務', chars:['義','務'], rarity:'★3', tags:['倫理'], desc:'果たすべきこと' },

  { word:'海千山千', chars:['海','千','山','千'], rarity:'★5', tags:['四字熟語','古典'], desc:'世の経験を積み重ねた' },
  { word:'古今東西', chars:['古','今','東','西'], rarity:'★5', tags:['四字熟語','時','方位'], desc:'いつの時代も・どの場所も' },

  { word:'一切無常', chars:['一','切','無','常'], rarity:'★6', tags:['四字熟語','仏教','禅'], desc:'すべてのものは移ろう' },
  { word:'万物流転', chars:['万','物','流','転'], rarity:'★6', tags:['四字熟語','哲学','古典'], desc:'万物は絶えず変化する' },

  { word:'真剣勝負', chars:['真','剣','勝','負'], rarity:'★5', tags:['四字熟語','武'], desc:'本気の戦い' },
  { word:'七難八苦', chars:['七','難','八','苦'], rarity:'★4', tags:['四字熟語','仏教','数'], desc:'多くの困難' },

  { word:'電光石火', chars:['電','光','石','火'], rarity:'★5', tags:['四字熟語','武','時'], desc:'稲妻のように速い' },

  { word:'尊敬', chars:['尊','敬'], rarity:'★3', tags:['儒教','倫理'], desc:'重んじて慕う' },
  { word:'厳格', chars:['厳','格'], rarity:'★3', tags:['倫理'], desc:'妥協なき厳しさ' },
  { word:'宝物', chars:['宝','物'], rarity:'★2', tags:['物'], desc:'大切なもの' },

  { word:'一日三秋', chars:['一','日','三','秋'], rarity:'★5', tags:['四字熟語','時'], desc:'会えない時の長さ' },
  { word:'行雲流水', chars:['行','雲','流','水'], rarity:'★6', tags:['四字熟語','禅','古典'], desc:'雲のように行き水のように流れる' },

  { word:'一望千里', chars:['一','望','千','里'], rarity:'★5', tags:['四字熟語','古典'], desc:'広大に開けた眺め' },
  { word:'百発百中', chars:['百','発','百','中'], rarity:'★5', tags:['四字熟語','武'], desc:'放つたびに当たる' },

  { word:'不動心', chars:['不','動','心'], rarity:'★5', tags:['三字熟語','禅','武'], desc:'揺るがぬ心' },
  { word:'静動', chars:['静','動'], rarity:'★3', tags:['対比','禅'], desc:'静と動の二面' },
  { word:'老若', chars:['老','若'], rarity:'★2', tags:['対比'], desc:'年齢の対比' },

  { word:'一蓮托生', chars:['一','蓮','托','生'], rarity:'★6', tags:['四字熟語','仏教'], desc:'運命を共にする' },

  { word:'諸法無我', chars:['諸','法','無','我'], rarity:'★6', tags:['四字熟語','仏教','禅'], desc:'すべては実体を持たない' }
];

const CHAR_TO_WORDS = {};
for (const r of YOJI_RECIPES){
  for (const c of r.chars){
    if (!CHAR_TO_WORDS[c]) CHAR_TO_WORDS[c] = [];
    CHAR_TO_WORDS[c].push(r);
  }
}

if (typeof window !== 'undefined'){
  window.POMOJI_RARITY = POMOJI_RARITY;
  window.KANJI_CODEX = KANJI_CODEX;
  window.YOJI_RECIPES = YOJI_RECIPES;
  window.CHAR_TO_WORDS = CHAR_TO_WORDS;
}

// 熟語レシピを★10 体系に合わせて +4 シフト（★1 → ★5 …… ★6 → ★10）
// 熟語は漢字のみで構成されるので、漢字レアの底辺（★5=拾級）と一致させる
const _RARITY_SHIFT = { '★1':'★5', '★2':'★6', '★3':'★7', '★4':'★8', '★5':'★9', '★6':'★10' };
for (const r of YOJI_RECIPES){
  if (_RARITY_SHIFT[r.rarity]) r.rarity = _RARITY_SHIFT[r.rarity];
}

(function summary(){
  const byR = {};
  for (const k of KANJI_CODEX){ byR[k.rarity] = (byR[k.rarity]||0) + 1; }
  const byRYoji = {};
  for (const r of YOJI_RECIPES){ byRYoji[r.rarity] = (byRYoji[r.rarity]||0) + 1; }
  console.log('%c☔ codex.js v15 ── 文字種ベース10段階レアリティ', 'color:#f0d48a;font-weight:900;');
  console.log(`  字: ${KANJI_CODEX.length} 字  ${JSON.stringify(byR)}`);
  console.log(`  熟語: ${YOJI_RECIPES.length} 個  ${JSON.stringify(byRYoji)}`);
})();
