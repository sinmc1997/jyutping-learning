/* content.js — 粵拼：聲調、聲母、韻尾、最小對立。純邏輯、無 DOM，可以喺 Node 直接測試。
   每個生成器 gen(rng) 回傳 {prompt, visual, options:[{t, ok, k}], expl}。
   k = 混淆矩陣用嘅項目 key。makeQ(key, seed) 確定性：同一個 seed 永遠出同一題。
   注意：字音資料請對照你常用嘅粵語字典核對（見 README）。 */
(function (root) {
  'use strict';

  // ---------- 亂數 / 工具 ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var util = {
    mulberry: mulberry32,
    int: function (rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); },
    pick: function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; },
    shuffle: function (arr, rng) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  };

  // ---------- 資料 ----------
  // 聲調：調值用 1–5 表示音高（5 最高）
  var TONE = {
    1: { n: '陰平', d: '高平', v: '55' },
    2: { n: '陰上', d: '高升', v: '25' },
    3: { n: '陰去', d: '中平', v: '33' },
    4: { n: '陽平', d: '低降', v: '21' },
    5: { n: '陽上', d: '低升', v: '23' },
    6: { n: '陽去', d: '低平', v: '22' }
  };
  var INI_LABEL = {
    lab: '唇音（b p m f）',
    ald: '舌尖（d t n l）',
    vel: '舌根／喉（g k ng h）',
    sib: '齒音（z c s）',
    semi: '半元音（j w）',
    zero: '零聲母（開頭冇子音）'
  };
  var END_LABEL = {
    open: '開尾（元音收結）',
    iu: '-i ／ -u',
    nas: '-m ／ -n ／ -ng',
    stop: '-p ／ -t ／ -k'
  };
  // [字, 粵拼, 聲母組, 韻尾組]
  var CHARS = [
    ['我', 'ngo5', 'vel', 'open'], ['你', 'nei5', 'ald', 'iu'], ['好', 'hou2', 'vel', 'iu'],
    ['食', 'sik6', 'sib', 'stop'], ['水', 'seoi2', 'sib', 'iu'], ['人', 'jan4', 'semi', 'nas'],
    ['錢', 'cin4', 'sib', 'nas'], ['大', 'daai6', 'ald', 'iu'], ['學', 'hok6', 'vel', 'stop'],
    ['手', 'sau2', 'sib', 'iu'], ['口', 'hau2', 'vel', 'iu'], ['行', 'haang4', 'vel', 'nas'],
    ['去', 'heoi3', 'vel', 'iu'], ['頭', 'tau4', 'ald', 'iu'], ['來', 'loi4', 'ald', 'iu'],
    ['聽', 'teng1', 'ald', 'nas'], ['講', 'gong2', 'vel', 'nas'], ['書', 'syu1', 'sib', 'iu'],
    ['知', 'zi1', 'sib', 'iu'], ['道', 'dou6', 'ald', 'iu'], ['時', 'si4', 'sib', 'iu'],
    ['間', 'gaan1', 'vel', 'nas'], ['點', 'dim2', 'ald', 'nas'], ['解', 'gaai2', 'vel', 'iu'],
    ['嚟', 'lai4', 'ald', 'iu'], ['家', 'gaa1', 'vel', 'open'], ['車', 'ce1', 'sib', 'open'],
    ['屋', 'uk1', 'zero', 'stop'], ['愛', 'oi3', 'zero', 'iu'], ['一', 'jat1', 'semi', 'stop'],
    ['飯', 'faan6', 'lab', 'nas'], ['媽', 'maa1', 'lab', 'open'], ['爸', 'baa4', 'lab', 'open'],
    ['飲', 'jam2', 'semi', 'nas'], ['生', 'saang1', 'sib', 'nas'], ['今', 'gam1', 'vel', 'nas'],
    ['天', 'tin1', 'ald', 'nas'], ['日', 'jat6', 'semi', 'stop'], ['早', 'zou2', 'sib', 'iu'],
    ['晚', 'maan5', 'lab', 'nas'], ['多', 'do1', 'ald', 'open'], ['少', 'siu2', 'sib', 'iu'],
    ['三', 'saam1', 'sib', 'nas'], ['四', 'sei3', 'sib', 'iu'], ['六', 'luk6', 'ald', 'stop'],
    ['七', 'cat1', 'sib', 'stop'], ['八', 'baat3', 'lab', 'stop'], ['九', 'gau2', 'vel', 'iu'],
    ['十', 'sap6', 'sib', 'stop'], ['二', 'ji6', 'semi', 'iu'], ['係', 'hai6', 'vel', 'iu'],
    ['嘅', 'ge3', 'vel', 'open']
  ];
  var INIS = ['b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'ng', 'h', 'z', 'c', 's', 'j', 'w'];
  var FINS = ['aa', 'aai', 'aau', 'aam', 'aan', 'aang', 'aap', 'aat', 'aak', 'oi', 'ou', 'ei', 'in', 'ung', 'ok'];

  // ---------- 視覺 ----------
  function pitchSvg(n) {
    var v = TONE[n].v, a = +v[0], b = +v[1];
    var y = function (L) { return 60 - (L - 1) * 12; };
    var ya = y(a), yb = y(b), ym = (ya + yb) / 2;
    var grid = '';
    for (var L = 1; L <= 5; L++) grid += '<line x1="10" y1="' + y(L) + '" x2="150" y2="' + y(L) + '" class="grid"/>';
    return '<svg viewBox="0 0 160 80" class="pitch" role="img" aria-label="音高走勢圖">' + grid +
      '<polyline points="20,' + ya + ' 80,' + ym + ' 140,' + yb + '" class="line"/>' +
      '<circle cx="20" cy="' + ya + '" r="4" class="dot"/><circle cx="140" cy="' + yb + '" r="4" class="dot"/></svg>';
  }
  function bigChar(c) { return '<div class="big">' + c + '</div>'; }

  // ---------- 生成器：聲調 ----------
  function genToneVisual(n) {
    return function (rng) {
      var others = util.shuffle([1, 2, 3, 4, 5, 6].filter(function (x) { return x !== n; }), rng).slice(0, 3);
      return {
        prompt: '見圖嘅音高走勢（5 ＝最高，1 ＝最低）係邊個聲調？',
        visual: pitchSvg(n),
        options: [n].concat(others).map(function (m) {
          return { t: '第 ' + m + ' 聲（' + TONE[m].n + '・' + TONE[m].d + '）', ok: m === n, k: 't' + m };
        }),
        expl: '第 ' + n + ' 聲係' + TONE[n].n + '，' + TONE[n].d + '，調值 ' + TONE[n].v + '。'
      };
    };
  }
  function genToneName(n) {
    return function (rng) {
      var others = util.shuffle([1, 2, 3, 4, 5, 6].filter(function (x) { return x !== n; }), rng).slice(0, 3);
      return {
        prompt: '「si' + n + '」嘅音高（調值）係以下邊個？',
        visual: '<div class="big">si' + n + '</div>',
        options: [n].concat(others).map(function (m) {
          return { t: TONE[m].v + '（' + TONE[m].d + '）', ok: m === n, k: 't' + m };
        }),
        expl: 'si' + n + ' 係第 ' + n + ' 聲，' + TONE[n].n + '，調值 ' + TONE[n].v + '（' + TONE[n].d + '）。'
      };
    };
  }

  // ---------- 生成器：聲母／韻尾（用字） ----------
  function genIni(g) {
    return function (rng) {
      var c = util.pick(rng, CHARS.filter(function (x) { return x[2] === g; }));
      var others = util.shuffle(Object.keys(INI_LABEL).filter(function (x) { return x !== g; }), rng).slice(0, 3);
      return {
        prompt: '「' + c[0] + '」（' + c[1] + '）嘅聲母屬以下邊一組？',
        visual: bigChar(c[0]),
        options: [g].concat(others).map(function (x) { return { t: INI_LABEL[x], ok: x === g, k: 'i' + x }; }),
        expl: c[0] + '（' + c[1] + '）嘅聲母係' + INI_LABEL[g] + '。'
      };
    };
  }
  function genEnd(e) {
    return function (rng) {
      var c = util.pick(rng, CHARS.filter(function (x) { return x[3] === e; }));
      return {
        prompt: '「' + c[0] + '」（' + c[1] + '）嘅韻尾屬以下邊一類？',
        visual: bigChar(c[0]),
        options: util.shuffle(Object.keys(END_LABEL), rng).map(function (x) {
          return { t: END_LABEL[x], ok: x === e, k: 'e' + x };
        }),
        expl: c[0] + '（' + c[1] + '）嘅韻尾係' + END_LABEL[e] + '。'
      };
    };
  }

  // ---------- 生成器：最小對立（邊樣唔同） ----------
  var MP_TYPES = {
    'ini': '只係聲母唔同',
    'fin': '只係韻母唔同',
    'tone': '只係聲調唔同',
    'ini+tone': '聲母同聲調都唔同'
  };
  function genMP(rng) {
    var type = util.pick(rng, Object.keys(MP_TYPES));
    var i = util.pick(rng, INIS), f = util.pick(rng, FINS), t = util.int(rng, 1, 6);
    var i2 = i, f2 = f, t2 = t;
    if (type === 'ini' || type === 'ini+tone') { do { i2 = util.pick(rng, INIS); } while (i2 === i); }
    if (type === 'fin') { do { f2 = util.pick(rng, FINS); } while (f2 === f); }
    if (type === 'tone' || type === 'ini+tone') { do { t2 = util.int(rng, 1, 6); } while (t2 === t); }
    var a = i + f + t, b = i2 + f2 + t2;
    var keys = Object.keys(MP_TYPES);
    return {
      prompt: '兩個音節之間，「邊樣」唔同？',
      visual: '<div class="pair"><span>' + a + '</span><span class="vs">vs</span><span>' + b + '</span></div>',
      options: util.shuffle(keys.slice(), rng).map(function (x) {
        return { t: MP_TYPES[x], ok: x === type, k: 'MP:' + x };
      }),
      expl: a + ' vs ' + b + '：' + MP_TYPES[type] + '（聲母 ' + i + '→' + i2 + '，韻母 ' + f + '→' + f2 + '，聲調 ' + t + '→' + t2 + '）。'
    };
  }

  // ---------- 項目（17 課） ----------
  var ITEMS = {
    t1: { name: '第 1 聲・陰平（高平 55）', cat: '聲調', mn: '「高平」：由頭到尾都高，好似唱長音',
      features: ['調值 55', '最高、平', '例：si1 詩'], principle: '聲調編號 = Jyutping 最尾嗰個數字',
      fail: '同第 3 聲（中平）混淆', tip: '陰平係最高嘅平調。', gens: [genToneVisual(1), genToneName(1)] },
    t2: { name: '第 2 聲・陰上（高升 25）', cat: '聲調', mn: '「高升」：由中升到高',
      features: ['調值 25', '由中向上', '例：si2 史'], principle: '升調係陰上獨有嘅「上」感',
      fail: '同第 5 聲（低升）混淆', tip: '陰上係高升，陽上係低升。', gens: [genToneVisual(2), genToneName(2)] },
    t3: { name: '第 3 聲・陰去（中平 33）', cat: '聲調', mn: '「中平」：中間高度，平',
      features: ['調值 33', '中段、平', '例：si3 試'], principle: '中平係陰去',
      fail: '同第 6 聲（低平）混淆', tip: '陰去比陽去高，要聽清高低。', gens: [genToneVisual(3), genToneName(3)] },
    t4: { name: '第 4 聲・陽平（低降 21）', cat: '聲調', mn: '「低降」：由低向下跌',
      features: ['調值 21', '低而降', '例：si4 時'], principle: '陽平係低降',
      fail: '同第 1 聲（高平）完全相反，要留意', tip: '陽平係下跌，唔係平。', gens: [genToneVisual(4), genToneName(4)] },
    t5: { name: '第 5 聲・陽上（低升 23）', cat: '聲調', mn: '「低升」：由低向上',
      features: ['調值 23', '低而升', '例：si5 市'], principle: '陽上係低升',
      fail: '同第 2 聲（高升）混淆', tip: '低升同高升，一低一高。', gens: [genToneVisual(5), genToneName(5)] },
    t6: { name: '第 6 聲・陽去（低平 22）', cat: '聲調', mn: '「低平」：低而平',
      features: ['調值 22', '低、平', '例：si6 事'], principle: '陽去係低平',
      fail: '同第 3 聲（中平）混淆', tip: '低平係最低嘅平調。', gens: [genToneVisual(6), genToneName(6)] },
    ilab: { name: '聲母：唇音', cat: '聲母', mn: '雙唇 b p m；唇齒 f',
      features: ['b p m f', '用唇發音', '例：八 baat3、媽 maa1'], principle: '按發音部位分類',
      fail: '同舌尖 d t n l 混淆', tip: '發音部位決定聲母類別。', gens: [genIni('lab')] },
    iald: { name: '聲母：舌尖', cat: '聲母', mn: '舌尖頂上齦（d t n l）',
      features: ['d t n l', '舌尖位置', '例：你 nei5、大 daai6'], principle: '舌尖接觸上齒齦',
      fail: '同舌根 g k 混淆', tip: 'n 同 l 最易混，要留意鼻音同邊音。', gens: [genIni('ald')] },
    ivel: { name: '聲母：舌根／喉', cat: '聲母', mn: '舌根 g k ng；喉 h',
      features: ['g k ng h', '舌根或喉', '例：我 ngo5、學 hok6'], principle: 'ng 係鼻音，同 n 唔同',
      fail: '將 ng 讀成 n', tip: '「我」係 ng，「你」係 n。', gens: [genIni('vel')] },
    isib: { name: '聲母：齒音', cat: '聲母', mn: '舌尖貼齒背（z c s）',
      features: ['z c s', '不送氣 z、送氣 c', '例：知 zi1、車 ce1、書 syu1'], principle: 'z 不送氣，c 送氣，s 擦音',
      fail: '分唔到 z 同 c', tip: 'z 唔送氣，c 會送氣。', gens: [genIni('sib')] },
    isemi: { name: '聲母：半元音', cat: '聲母', mn: 'j 似英文 y；w 似 w',
      features: ['j w', '好似元音嘅起頭', '例：人 jan4、一 jat1'], principle: 'j 同 i 近似',
      fail: '以為 j 係 g', tip: 'j 會同 i、yu 相似。', gens: [genIni('semi')] },
    izero: { name: '聲母：零聲母', cat: '聲母', mn: '音節開頭冇子音',
      features: ['開頭冇聲母', '直接由元音開始', '例：屋 uk1、愛 oi3'], principle: '冇聲母都係一類',
      fail: '以為一定有聲母', tip: '例如 oi3 愛、uk1 屋。', gens: [genIni('zero')] },
    eopen: { name: '韻尾：開尾', cat: '韻尾', mn: '元音收結，嘴唔閉',
      features: ['收結喺元音', '例：我 ngo5、家 gaa1'], principle: '元音結尾，冇鼻音或塞音',
      fail: '誤以為有 -ng', tip: '「家」係 gaa1，冇 -ng。', gens: [genEnd('open')] },
    eiu: { name: '韻尾：-i ／ -u', cat: '韻尾', mn: '元音尾，嘴型收窄向 i 或 u',
      features: ['-i：你 nei5', '-u：好 hou2', '例：書 syu1'], principle: 'i 同 u 係元音尾',
      fail: '將 -i 同 -u 同鼻音混淆', tip: '收尾嘅 i、u 唔會閉唇或者塞住。', gens: [genEnd('iu')] },
    enas: { name: '韻尾：-m ／ -n ／ -ng', cat: '韻尾', mn: '鼻音收結：m 閉唇、n 舌尖、ng 舌根',
      features: ['-m：飲 jam2', '-n：人 jan4', '-ng：聽 teng1'], principle: '鼻音收結，氣由鼻出',
      fail: '分唔到 -n 同 -ng', tip: '-n 舌尖頂齦；-ng 舌根，嘴形較開。', gens: [genEnd('nas')] },
    estop: { name: '韻尾：-p ／ -t ／ -k', cat: '韻尾', mn: '入聲：短促、收結唔拖長',
      features: ['-p：十 sap6', '-t：日 jat6', '-k：食 sik6'], principle: '塞音收結，聲音突然停',
      fail: '讀成長音', tip: '入聲要讀得短、結得乾淨。', gens: [genEnd('stop')] },
    mp: { name: '最小對立（邊樣唔同）', cat: '對比', mn: '只一樣唔同 → 最易分辨',
      features: ['聲母、韻母、聲調各自獨立', '對比練習最有效', '一次只變一樣'],
      principle: '對比兩個音節，分辨邊個部分唔同', fail: '將所有唔同都當成聲調',
      tip: '每次先睇聲母，再睇韻母，最後睇聲調。', gens: [genMP] }
  };

  // ---------- 出題（確定性） ----------
  function makeQ(k, seed) {
    var it = ITEMS[k];
    var rng = util.mulberry(seed);
    var gi = seed % it.gens.length;
    var q = it.gens[gi](rng);
    q.options = util.shuffle(q.options.slice(), rng);
    q.key = k; q.seed = seed; q.gi = gi;
    return q;
  }

  var labels = {};
  Object.keys(MP_TYPES).forEach(function (x) { labels['MP:' + x] = '最小對立：' + MP_TYPES[x]; });

  var SITE = {
    id: 'jyutping-learning-v1',
    title: '粵拼學習',
    subtitle: '聲調、聲母、韻尾：每題隨機生成，錯咗就記低點解',
    util: util,
    items: ITEMS,
    order: Object.keys(ITEMS),
    labels: labels,
    makeQ: makeQ
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SITE;
  else root.SITE = SITE;
})(typeof window !== 'undefined' ? window : globalThis);
