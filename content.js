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
    open: '開尾（單元音收結：aa、i、u、yu、e、o…）',
    iu: '-i ／ -u（複元音尾：ai、ei、ou、iu…）',
    nas: '-m ／ -n ／ -ng（鼻音尾）',
    stop: '-p ／ -t ／ -k（入聲）'
  };
  // [字, 粵拼]：聲母組、韻尾組由拼寫自動推算（parse），唔使人手標，避免標錯
  var RAW = [
    ['我', 'ngo5'], ['你', 'nei5'], ['好', 'hou2'], ['食', 'sik6'], ['水', 'seoi2'], ['人', 'jan4'],
    ['錢', 'cin4'], ['大', 'daai6'], ['學', 'hok6'], ['手', 'sau2'], ['口', 'hau2'], ['行', 'haang4'],
    ['去', 'heoi3'], ['頭', 'tau4'], ['來', 'loi4'], ['聽', 'teng1'], ['講', 'gong2'], ['書', 'syu1'],
    ['知', 'zi1'], ['道', 'dou6'], ['時', 'si4'], ['間', 'gaan1'], ['點', 'dim2'], ['解', 'gaai2'],
    ['嚟', 'lai4'], ['家', 'gaa1'], ['車', 'ce1'], ['屋', 'uk1'], ['愛', 'oi3'], ['一', 'jat1'],
    ['飯', 'faan6'], ['媽', 'maa1'], ['爸', 'baa4'], ['飲', 'jam2'], ['生', 'saang1'], ['今', 'gam1'],
    ['天', 'tin1'], ['日', 'jat6'], ['早', 'zou2'], ['晚', 'maan5'], ['多', 'do1'], ['少', 'siu2'],
    ['三', 'saam1'], ['四', 'sei3'], ['六', 'luk6'], ['七', 'cat1'], ['八', 'baat3'], ['九', 'gau2'],
    ['十', 'sap6'], ['二', 'ji6'], ['係', 'hai6'], ['嘅', 'ge3'],
    // v2 新增
    ['山', 'saan1'], ['火', 'fo2'], ['木', 'muk6'], ['金', 'gam1'], ['土', 'tou2'], ['月', 'jyut6'],
    ['星', 'sing1'], ['雨', 'jyu5'], ['風', 'fung1'], ['雲', 'wan4'], ['花', 'faa1'], ['魚', 'jyu4'],
    ['牛', 'ngau4'], ['狗', 'gau2'], ['貓', 'maau1'], ['鳥', 'niu5'], ['馬', 'maa5'], ['羊', 'joeng4'],
    ['米', 'mai5'], ['茶', 'caa4'], ['肉', 'juk6'], ['菜', 'coi3'], ['白', 'baak6'], ['黑', 'hak1'],
    ['紅', 'hung4'], ['綠', 'luk6'], ['長', 'coeng4'], ['高', 'gou1'], ['新', 'san1'], ['老', 'lou5'],
    ['細', 'sai3'], ['買', 'maai5'], ['賣', 'maai6'], ['坐', 'co5'], ['企', 'kei5'], ['睇', 'tai2'],
    ['寫', 'se2'], ['讀', 'duk6'], ['開', 'hoi1'], ['話', 'waa6'], ['熱', 'jit6'], ['凍', 'dung3'],
    ['快', 'faai3'], ['慢', 'maan6'], ['落', 'lok6'], ['出', 'ceot1'], ['入', 'jap6'], ['北', 'bak1'],
    ['東', 'dung1'], ['南', 'naam4'], ['西', 'sai1'], ['中', 'zung1'], ['香', 'hoeng1'], ['港', 'gong2'],
    ['安', 'on1'], ['鴨', 'aap3'], ['亞', 'aa3']
  ];
  var INI_LIST = ['gw', 'kw', 'ng', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'z', 'c', 's', 'j', 'w'];
  var INI_GROUP = { b: 'lab', p: 'lab', m: 'lab', f: 'lab', d: 'ald', t: 'ald', n: 'ald', l: 'ald',
    g: 'vel', k: 'vel', ng: 'vel', h: 'vel', gw: 'vel', kw: 'vel', z: 'sib', c: 'sib', s: 'sib', j: 'semi', w: 'semi', '': 'zero' };
  function parse(jp) {
    var tone = +jp.slice(-1), body = jp.slice(0, -1), ini = '';
    for (var i = 0; i < INI_LIST.length; i++) if (body.indexOf(INI_LIST[i]) === 0) { ini = INI_LIST[i]; break; }
    var fin = body.slice(ini.length), end;
    if (/[ptk]$/.test(fin)) end = 'stop';
    else if (/(m|n|ng)$/.test(fin)) end = 'nas';
    else if (fin.length >= 2 && /[iu]$/.test(fin) && fin !== 'yu') end = 'iu';
    else end = 'open';
    return { ini: ini, fin: fin, tone: tone, g: INI_GROUP[ini], end: end };
  }
  // 多音字：干擾項可能啱另一個讀音（例如 好 hou2／hou3），所以唔用嚟出「揀拼音」同「揀聲調」題
  var POLY = '好少中間行解話生白雨飲三車';
  function single(x) { return POLY.indexOf(x[0]) < 0; }
  // CHARS：[字, 粵拼, 聲母組, 韻尾組, 解析結果]
  var CHARS = RAW.map(function (r) { var p = parse(r[1]); return [r[0], r[1], p.g, p.end, p]; });
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
        say: c[0],
        options: [g].concat(others).map(function (x) { return { t: INI_LABEL[x], ok: x === g, k: 'i' + x }; }),
        expl: c[0] + '（' + c[1] + '）嘅聲母係 ' + (c[4].ini || '（冇）') + '，屬' + INI_LABEL[g] + '。'
      };
    };
  }
  function genEnd(e) {
    return function (rng) {
      var c = util.pick(rng, CHARS.filter(function (x) { return x[3] === e; }));
      return {
        prompt: '「' + c[0] + '」（' + c[1] + '）嘅韻尾屬以下邊一類？',
        visual: bigChar(c[0]),
        say: c[0],
        options: util.shuffle(Object.keys(END_LABEL), rng).map(function (x) {
          return { t: END_LABEL[x], ok: x === e, k: 'e' + x };
        }),
        expl: c[0] + '（' + c[1] + '）韻母係 ' + c[4].fin + '，屬' + END_LABEL[e] + '。'
      };
    };
  }

  // ---------- 生成器：睇字揀聲調（真字） ----------
  function genToneChar(n) {
    return function (rng) {
      var c = util.pick(rng, CHARS.filter(function (x) { return x[4].tone === n && single(x); }));
      var others = util.shuffle([1, 2, 3, 4, 5, 6].filter(function (x) { return x !== n; }), rng).slice(0, 3);
      return {
        prompt: '「' + c[0] + '」讀 ' + c[1].slice(0, -1) + '？，係第幾聲？',
        visual: bigChar(c[0]),
        say: c[0],
        options: [n].concat(others).map(function (m) {
          return { t: '第 ' + m + ' 聲（' + TONE[m].d + ' ' + TONE[m].v + '）', ok: m === n, k: 't' + m };
        }),
        expl: c[0] + ' ＝ ' + c[1] + '，第 ' + n + ' 聲（' + TONE[n].n + '，' + TONE[n].d + '）。' +
          (c[4].end === 'stop' ? '入聲字（-p／-t／-k）只會係第 1、3、6 聲。' : '')
      };
    };
  }

  // ---------- 生成器：揀正確粵拼（干擾項只改一個部分，針對常見懶音） ----------
  var INI_SWAP = {
    n: ['l', 'ng'], l: ['n'], ng: ['', 'n'], '': ['ng', 'h'], z: ['c', 's'], c: ['z', 's'], s: ['z', 'c'],
    g: ['k', 'gw'], k: ['g', 'h'], b: ['p', 'm'], p: ['b'], d: ['t'], t: ['d'], h: ['', 'k'],
    j: ['', 'w'], m: ['b', 'n'], f: ['h', 'w'], w: ['j', 'f'], gw: ['g', 'kw'], kw: ['k', 'gw']
  };
  function finSwaps(f) {
    var out = [];
    if (/ng$/.test(f)) out.push(f.replace(/ng$/, 'n'));
    else if (/n$/.test(f)) { out.push(f + 'g'); out.push(f.replace(/n$/, 'm')); }
    else if (/m$/.test(f)) out.push(f.replace(/m$/, 'n'));
    if (/k$/.test(f)) out.push(f.replace(/k$/, 't'));
    else if (/t$/.test(f)) { out.push(f.replace(/t$/, 'k')); out.push(f.replace(/t$/, 'p')); }
    else if (/p$/.test(f)) out.push(f.replace(/p$/, 't'));
    if (/^aa./.test(f)) out.push(f.slice(1));
    else if (/^a[^a]/.test(f)) out.push('a' + f);
    return out.filter(function (x) { return x && x !== f; });
  }
  function genSpell(rng) {
    var c = util.pick(rng, CHARS.filter(single)), p = c[4], right = c[1];
    var tones = (p.end === 'stop' ? [1, 3, 6] : [1, 2, 3, 4, 5, 6]).filter(function (t) { return t !== p.tone; });
    var lists = [
      tones.map(function (t) { return p.ini + p.fin + t; }),
      (INI_SWAP[p.ini] || []).map(function (i) { return i + p.fin + p.tone; }),
      finSwaps(p.fin).map(function (f) { return p.ini + f + p.tone; })
    ].map(function (l) { return util.shuffle(l, rng); });
    var bad = [];
    lists.forEach(function (l) { if (l.length && bad.indexOf(l[0]) < 0 && l[0] !== right) bad.push(l[0]); });
    var rest = util.shuffle([].concat.apply([], lists), rng);
    for (var i = 0; bad.length < 3 && i < rest.length; i++) if (rest[i] !== right && bad.indexOf(rest[i]) < 0) bad.push(rest[i]);
    return {
      prompt: '「' + c[0] + '」嘅粵拼係？',
      visual: bigChar(c[0]),
      say: c[0],
      options: [{ t: right, ok: true, k: 'spell' }].concat(bad.slice(0, 3).map(function (b) { return { t: b, ok: false, k: 'spell' }; })),
      expl: c[0] + ' ＝ ' + right + '（聲母 ' + (p.ini || '冇') + '、韻母 ' + p.fin + '、第 ' + p.tone + ' 聲）。干擾項各改咗一部分：聲調、聲母或者韻母。'
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

  // ---------- 項目（18 課） ----------
  var ITEMS = {
    t1: { name: '第 1 聲・陰平（高平 55）', cat: '聲調', mn: '「高平」：由頭到尾都高，好似唱長音',
      features: ['調值 55', '最高、平', '例：si1 詩'], principle: '聲調編號 = Jyutping 最尾嗰個數字',
      fail: '同第 3 聲（中平）混淆', tip: '陰平係最高嘅平調。', gens: [genToneVisual(1), genToneName(1), genToneChar(1)] },
    t2: { name: '第 2 聲・陰上（高升 25）', cat: '聲調', mn: '「高升」：由中升到高',
      features: ['調值 25', '由中向上', '例：si2 史'], principle: '升調係陰上獨有嘅「上」感',
      fail: '同第 5 聲（低升）混淆', tip: '陰上係高升，陽上係低升。', gens: [genToneVisual(2), genToneName(2), genToneChar(2)] },
    t3: { name: '第 3 聲・陰去（中平 33）', cat: '聲調', mn: '「中平」：中間高度，平',
      features: ['調值 33', '中段、平', '例：si3 試'], principle: '中平係陰去',
      fail: '同第 6 聲（低平）混淆', tip: '陰去比陽去高，要聽清高低。', gens: [genToneVisual(3), genToneName(3), genToneChar(3)] },
    t4: { name: '第 4 聲・陽平（低降 21）', cat: '聲調', mn: '「低降」：由低向下跌',
      features: ['調值 21', '低而降', '例：si4 時'], principle: '陽平係低降',
      fail: '同第 1 聲（高平）完全相反，要留意', tip: '陽平係下跌，唔係平。', gens: [genToneVisual(4), genToneName(4), genToneChar(4)] },
    t5: { name: '第 5 聲・陽上（低升 23）', cat: '聲調', mn: '「低升」：由低向上',
      features: ['調值 23', '低而升', '例：si5 市'], principle: '陽上係低升',
      fail: '同第 2 聲（高升）混淆', tip: '低升同高升，一低一高。', gens: [genToneVisual(5), genToneName(5), genToneChar(5)] },
    t6: { name: '第 6 聲・陽去（低平 22）', cat: '聲調', mn: '「低平」：低而平',
      features: ['調值 22', '低、平', '例：si6 事'], principle: '陽去係低平',
      fail: '同第 3 聲（中平）混淆', tip: '低平係最低嘅平調。', gens: [genToneVisual(6), genToneName(6), genToneChar(6)] },
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
    eopen: { name: '韻尾：開尾', cat: '韻尾', mn: '單一個元音收結，冇鼻音、冇塞音',
      features: ['韻母只得一個元音：aa、i、u、yu、e、o、oe', '例：我 ngo5、家 gaa1、書 syu1、知 zi1'], principle: '單元音韻母，嘴形由頭到尾唔變',
      fail: '誤以為有 -ng', tip: '「家」係 gaa1，冇 -ng。', gens: [genEnd('open')] },
    eiu: { name: '韻尾：-i ／ -u', cat: '韻尾', mn: '元音尾，嘴型收窄向 i 或 u',
      features: ['-i：你 nei5、水 seoi2', '-u：好 hou2、少 siu2', '要係「兩個元音」先算（syu、zi 唔算）'], principle: '複元音：由一個元音滑向 i 或 u',
      fail: '將 -i 同 -u 同鼻音混淆', tip: '收尾嘅 i、u 唔會閉唇或者塞住。', gens: [genEnd('iu')] },
    enas: { name: '韻尾：-m ／ -n ／ -ng', cat: '韻尾', mn: '鼻音收結：m 閉唇、n 舌尖、ng 舌根',
      features: ['-m：飲 jam2', '-n：人 jan4', '-ng：聽 teng1'], principle: '鼻音收結，氣由鼻出',
      fail: '分唔到 -n 同 -ng', tip: '-n 舌尖頂齦；-ng 舌根，嘴形較開。', gens: [genEnd('nas')] },
    estop: { name: '韻尾：-p ／ -t ／ -k', cat: '韻尾', mn: '入聲：短促、收結唔拖長',
      features: ['-p：十 sap6', '-t：日 jat6', '-k：食 sik6'], principle: '塞音收結，聲音突然停',
      fail: '讀成長音', tip: '入聲要讀得短、結得乾淨。', gens: [genEnd('stop')] },
    spell: { name: '揀正確粵拼', cat: '拼寫', mn: '逐部分核對：聲母 → 韻母 → 聲調',
      features: ['錯選項只改咗一個部分', '常見錯：n／l、ng／冇聲母、-n／-ng、-t／-k、aa／a'],
      principle: '將字拆成 聲母＋韻母＋聲調，逐樣核對', fail: '只睇聲調，忽略韻尾',
      tip: '懶音（n→l、ng→冇、-ng→-n、-k→-t）係最常見嘅錯。', gens: [genSpell] },
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
