/* content.js — 粵拼打字：學用鍵盤／手機打粵拼。純邏輯、無 DOM，可以喺 Node 直接測試。
   題型：
   - 選擇題 {prompt, visual, options:[{t, ok, k}], expl}
   - 打字題 {input:true, prompt, visual, answerText, check(v)->{ok,k,note}, unit?, lang?, expl}
   makeQ(key, seed) 確定性：同一個 seed 永遠出同一題（錯題本可以重做）。
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
  var TONE = {
    1: { n: '陰平', d: '高平', v: '55' }, 2: { n: '陰上', d: '高升', v: '25' }, 3: { n: '陰去', d: '中平', v: '33' },
    4: { n: '陽平', d: '低降', v: '21' }, 5: { n: '陽上', d: '低升', v: '23' }, 6: { n: '陽去', d: '低平', v: '22' }
  };
  // 單字 [字, 粵拼]
  var RAW = [
    ['我', 'ngo5'], ['你', 'nei5'], ['食', 'sik6'], ['水', 'seoi2'], ['人', 'jan4'], ['錢', 'cin4'], ['大', 'daai6'],
    ['學', 'hok6'], ['手', 'sau2'], ['口', 'hau2'], ['去', 'heoi3'], ['頭', 'tau4'], ['來', 'loi4'], ['聽', 'teng1'],
    ['講', 'gong2'], ['書', 'syu1'], ['知', 'zi1'], ['道', 'dou6'], ['時', 'si4'], ['點', 'dim2'], ['嚟', 'lai4'],
    ['家', 'gaa1'], ['屋', 'uk1'], ['愛', 'oi3'], ['一', 'jat1'], ['飯', 'faan6'], ['媽', 'maa1'], ['爸', 'baa4'],
    ['今', 'gam1'], ['天', 'tin1'], ['日', 'jat6'], ['早', 'zou2'], ['晚', 'maan5'], ['多', 'do1'], ['四', 'sei3'],
    ['六', 'luk6'], ['七', 'cat1'], ['八', 'baat3'], ['九', 'gau2'], ['十', 'sap6'], ['二', 'ji6'], ['係', 'hai6'],
    ['嘅', 'ge3'], ['山', 'saan1'], ['火', 'fo2'], ['木', 'muk6'], ['金', 'gam1'], ['土', 'tou2'], ['月', 'jyut6'],
    ['星', 'sing1'], ['風', 'fung1'], ['雲', 'wan4'], ['花', 'faa1'], ['魚', 'jyu4'], ['牛', 'ngau4'], ['狗', 'gau2'],
    ['貓', 'maau1'], ['鳥', 'niu5'], ['馬', 'maa5'], ['羊', 'joeng4'], ['米', 'mai5'], ['茶', 'caa4'], ['肉', 'juk6'],
    ['菜', 'coi3'], ['黑', 'hak1'], ['紅', 'hung4'], ['綠', 'luk6'], ['高', 'gou1'], ['新', 'san1'], ['老', 'lou5'],
    ['細', 'sai3'], ['買', 'maai5'], ['賣', 'maai6'], ['坐', 'co5'], ['企', 'kei5'], ['睇', 'tai2'], ['寫', 'se2'],
    ['讀', 'duk6'], ['開', 'hoi1'], ['熱', 'jit6'], ['凍', 'dung3'], ['快', 'faai3'], ['慢', 'maan6'], ['落', 'lok6'],
    ['出', 'ceot1'], ['入', 'jap6'], ['北', 'bak1'], ['東', 'dung1'], ['南', 'naam4'], ['西', 'sai1'], ['香', 'hoeng1'],
    ['港', 'gong2'], ['安', 'on1'], ['鴨', 'aap3'], ['亞', 'aa3'],
    ['佢', 'keoi5'], ['對', 'deoi3'], ['女', 'neoi5'], ['春', 'ceon1'], ['句', 'geoi3'], ['腳', 'goek3'], ['良', 'loeng4'],
    ['想', 'soeng2'], ['豬', 'zyu1'], ['樹', 'syu6'], ['雪', 'syut3'], ['血', 'hyut3'], ['完', 'jyun4'], ['遠', 'jyun5'],
    ['船', 'syun4'], ['短', 'dyun2'], ['眼', 'ngaan5'], ['外', 'ngoi6'], ['牙', 'ngaa4'], ['五', 'ng5'], ['唔', 'm4'],
    ['心', 'sam1'], ['林', 'lam4'], ['針', 'zam1'], ['急', 'gap1'], ['立', 'laap6'], ['鹹', 'haam4'], ['減', 'gaam2'],
    ['站', 'zaam6'], ['光', 'gwong1'], ['國', 'gwok3'], ['誇', 'kwaa1'], ['群', 'kwan4'], ['關', 'gwaan1'], ['貴', 'gwai3']
  ];
  // 詞語 [詞, 粵拼（每字一個音節，空格分隔）]
  var WORDS = [
    ['你好', 'nei5 hou2'], ['早晨', 'zou2 san4'], ['多謝', 'do1 ze6'], ['唔該', 'm4 goi1'], ['對唔住', 'deoi3 m4 zyu6'],
    ['再見', 'zoi3 gin3'], ['食飯', 'sik6 faan6'], ['飲茶', 'jam2 caa4'], ['香港', 'hoeng1 gong2'],
    ['廣東話', 'gwong2 dung1 waa2'], ['粵拼', 'jyut6 ping3'], ['學生', 'hok6 saang1'], ['老師', 'lou5 si1'],
    ['朋友', 'pang4 jau5'], ['電話', 'din6 waa2'], ['電腦', 'din6 nou5'], ['手機', 'sau2 gei1'], ['鍵盤', 'gin6 pun4'],
    ['打字', 'daa2 zi6'], ['中文', 'zung1 man4'], ['英文', 'jing1 man4'], ['今日', 'gam1 jat6'], ['聽日', 'ting1 jat6'],
    ['琴日', 'kam4 jat6'], ['而家', 'ji4 gaa1'], ['點解', 'dim2 gaai2'], ['乜嘢', 'mat1 je5'], ['邊度', 'bin1 dou6'],
    ['幾多', 'gei2 do1'], ['鍾意', 'zung1 ji3'], ['返工', 'faan1 gung1'], ['放工', 'fong3 gung1'], ['食嘢', 'sik6 je5'],
    ['好味', 'hou2 mei6'], ['天氣', 'tin1 hei3'], ['落雨', 'lok6 jyu5'], ['巴士', 'baa1 si2'], ['地鐵', 'dei6 tit3'],
    ['我哋', 'ngo5 dei6'], ['佢哋', 'keoi5 dei6'], ['你哋', 'nei5 dei6'], ['冇問題', 'mou5 man6 tai4'],
    ['唔緊要', 'm4 gan2 jiu3'], ['少少', 'siu2 siu2'], ['一齊', 'jat1 cai4'], ['學習', 'hok6 zaap6'],
    ['練習', 'lin6 zaap6'], ['輸入法', 'syu1 jap6 faat3'],
    // v4 加：日常用語
    ['早抖', 'zou2 dau2'], ['晚安', 'maan5 on1'], ['歡迎', 'fun1 jing4'], ['恭喜', 'gung1 hei2'],
    ['新年快樂', 'san1 nin4 faai3 lok6'], ['生日快樂', 'saang1 jat6 faai3 lok6'], ['唔使客氣', 'm4 sai2 haak3 hei3'],
    ['唔好意思', 'm4 hou2 ji3 si1'], ['冇事', 'mou5 si6'], ['得閒', 'dak1 haan4'], ['好耐', 'hou2 noi6'],
    // 時間
    ['等陣', 'dang2 zan6'], ['一陣間', 'jat1 zan6 gaan1'], ['頭先', 'tau4 sin1'], ['後日', 'hau6 jat6'],
    ['星期一', 'sing1 kei4 jat1'], ['禮拜日', 'lai5 baai3 jat6'], ['上晝', 'soeng6 zau3'], ['下晝', 'haa6 zau3'],
    ['夜晚', 'je6 maan5'], ['今晚', 'gam1 maan5'], ['鐘頭', 'zung1 tau4'], ['時間', 'si4 gaan3'],
    // 地方
    ['屋企', 'uk1 kei2'], ['學校', 'hok6 haau6'], ['公司', 'gung1 si1'], ['醫院', 'ji1 jyun2'], ['餐廳', 'caan1 teng1'],
    ['超級市場', 'ciu1 kap1 si5 coeng4'], ['街市', 'gaai1 si5'], ['洗手間', 'sai2 sau2 gaan1'], ['廁所', 'ci3 so2'],
    ['車站', 'ce1 zaam6'], ['機場', 'gei1 coeng4'], ['呢度', 'ni1 dou6'], ['嗰度', 'go2 dou6'],
    ['中國', 'zung1 gwok3'], ['九龍', 'gau2 lung4'], ['新界', 'san1 gaai3'], ['銅鑼灣', 'tung4 lo4 waan1'],
    ['旺角', 'wong6 gok3'], ['尖沙咀', 'zim1 saa1 zeoi2'], ['中環', 'zung1 waan4'], ['澳門', 'ou3 mun2'], ['廣州', 'gwong2 zau1'],
    // 交通
    ['的士', 'dik1 si2'], ['小巴', 'siu2 baa1'], ['電車', 'din6 ce1'], ['搭車', 'daap3 ce1'], ['上車', 'soeng5 ce1'], ['落車', 'lok6 ce1'],
    // 生活動作
    ['行街', 'haang4 gaai1'], ['睇戲', 'tai2 hei3'], ['瞓覺', 'fan3 gaau3'], ['起身', 'hei2 san1'], ['沖涼', 'cung1 loeng4'],
    ['返學', 'faan1 hok6'], ['放學', 'fong3 hok6'], ['做嘢', 'zou6 je5'], ['傾偈', 'king1 gai2'], ['打電話', 'daa2 din6 waa2'],
    ['買嘢', 'maai5 je5'], ['埋單', 'maai4 daan1'], ['幾錢', 'gei2 cin2'], ['幫手', 'bong1 sau2'], ['返屋企', 'faan1 uk1 kei2'],
    ['識講', 'sik1 gong2'], ['飲水', 'jam2 seoi2'],
    // 形容
    ['好靚', 'hou2 leng3'], ['好食', 'hou2 sik6'], ['好攰', 'hou2 gui6'], ['好凍', 'hou2 dung3'], ['好熱', 'hou2 jit6'],
    ['開心', 'hoi1 sam1'], ['明白', 'ming4 baak6'], ['慢慢', 'maan6 maan2'], ['快啲', 'faai3 di1'], ['多啲', 'do1 di1'], ['少啲', 'siu2 di1'],
    // 連接詞、問句
    ['可以', 'ho2 ji5'], ['應該', 'jing1 goi1'], ['一定', 'jat1 ding6'], ['或者', 'waak6 ze2'], ['因為', 'jan1 wai6'],
    ['所以', 'so2 ji5'], ['但係', 'daan6 hai6'], ['如果', 'jyu4 gwo2'], ['然後', 'jin4 hau6'], ['已經', 'ji5 ging1'],
    ['仲未', 'zung6 mei6'], ['呢個', 'ni1 go3'], ['嗰個', 'go2 go3'], ['邊個', 'bin1 go3'], ['幾時', 'gei2 si4'],
    ['點樣', 'dim2 joeng2'], ['咁樣', 'gam2 joeng2'], ['多少', 'do1 siu2'], ['有冇', 'jau5 mou5'], ['唔係', 'm4 hai6'], ['係咪', 'hai6 mai6'],
    // 人
    ['爸爸', 'baa4 baa1'], ['媽媽', 'maa4 maa1'], ['哥哥', 'go4 go1'], ['家姐', 'gaa1 ze1'], ['細佬', 'sai3 lou2'], ['妹妹', 'mui4 mui2'],
    ['老公', 'lou5 gung1'], ['老婆', 'lou5 po4'], ['仔女', 'zai2 neoi2'], ['同事', 'tung4 si6'], ['老闆', 'lou5 baan2'], ['醫生', 'ji1 sang1'],
    // 食物
    ['早餐', 'zou2 caan1'], ['午餐', 'ng5 caan1'], ['晚餐', 'maan5 caan1'], ['奶茶', 'naai5 caa4'], ['咖啡', 'gaa3 fe1'],
    ['菠蘿包', 'bo1 lo4 baau1'], ['雞蛋', 'gai1 daan2'], ['白飯', 'baak6 faan6'], ['麵包', 'min6 baau1'], ['水果', 'seoi2 gwo2'],
    ['蘋果', 'ping4 gwo2'], ['雪糕', 'syut3 gou1'], ['啤酒', 'be1 zau2'],
    // 其他
    ['電視', 'din6 si6'], ['問題', 'man6 tai4'], ['工作', 'gung1 zok3'], ['功課', 'gung1 fo3'], ['考試', 'haau2 si5'],
    ['太陽', 'taai3 joeng4'], ['冷氣', 'laang5 hei3'], ['熱天', 'jit6 tin1']
  ];
  // 句子：由詞語組成 [[詞, 粵拼], ...]
  var SENTS = [
    [['我哋', 'ngo5 dei6'], ['一齊', 'jat1 cai4'], ['飲茶', 'jam2 caa4']],
    [['今日', 'gam1 jat6'], ['天氣', 'tin1 hei3'], ['好好', 'hou2 hou2']],
    [['聽日', 'ting1 jat6'], ['會', 'wui5'], ['落雨', 'lok6 jyu5']],
    [['我', 'ngo5'], ['鍾意', 'zung1 ji3'], ['學', 'hok6'], ['粵拼', 'jyut6 ping3']],
    [['你', 'nei5'], ['而家', 'ji4 gaa1'], ['喺', 'hai2'], ['邊度', 'bin1 dou6']],
    [['我', 'ngo5'], ['用', 'jung6'], ['手機', 'sau2 gei1'], ['打字', 'daa2 zi6']],
    [['唔該', 'm4 goi1'], ['你', 'nei5'], ['等', 'dang2'], ['我', 'ngo5']],
    [['冇問題', 'mou5 man6 tai4'], ['多謝', 'do1 ze6'], ['你', 'nei5']],
    [['佢哋', 'keoi5 dei6'], ['返工', 'faan1 gung1'], ['喇', 'laa3']],
    [['點解', 'dim2 gaai2'], ['你', 'nei5'], ['唔', 'm4'], ['食飯', 'sik6 faan6']],
    // v4 加：日常句子
    [['你', 'nei5'], ['食咗', 'sik6 zo2'], ['飯', 'faan6'], ['未', 'mei6']],
    [['我', 'ngo5'], ['好', 'hou2'], ['肚餓', 'tou5 ngo6']],
    [['呢個', 'ni1 go3'], ['幾錢', 'gei2 cin2']],
    [['唔該', 'm4 goi1'], ['埋單', 'maai4 daan1']],
    [['我', 'ngo5'], ['要', 'jiu3'], ['一杯', 'jat1 bui1'], ['奶茶', 'naai5 caa4']],
    [['洗手間', 'sai2 sau2 gaan1'], ['喺', 'hai2'], ['邊度', 'bin1 dou6']],
    [['我', 'ngo5'], ['而家', 'ji4 gaa1'], ['返屋企', 'faan1 uk1 kei2']],
    [['聽日', 'ting1 jat6'], ['見', 'gin3']],
    [['你', 'nei5'], ['得閒', 'dak1 haan4'], ['未', 'mei6']],
    [['我哋', 'ngo5 dei6'], ['去', 'heoi3'], ['行街', 'haang4 gaai1'], ['啦', 'laa1']],
    [['今日', 'gam1 jat6'], ['好', 'hou2'], ['熱', 'jit6']],
    [['佢', 'keoi5'], ['係', 'hai6'], ['我', 'ngo5'], ['朋友', 'pang4 jau5']],
    [['我', 'ngo5'], ['唔', 'm4'], ['明白', 'ming4 baak6']],
    [['你', 'nei5'], ['講', 'gong2'], ['慢啲', 'maan6 di1'], ['得唔得', 'dak1 m4 dak1']],
    [['等陣', 'dang2 zan6'], ['再', 'zoi3'], ['傾', 'king1']],
    [['祝', 'zuk1'], ['你', 'nei5'], ['生日快樂', 'saang1 jat6 faai3 lok6']],
    [['我', 'ngo5'], ['搭', 'daap3'], ['地鐵', 'dei6 tit3'], ['返工', 'faan1 gung1']],
    [['你', 'nei5'], ['幾時', 'gei2 si4'], ['放工', 'fong3 gung1']],
    [['我', 'ngo5'], ['已經', 'ji5 ging1'], ['食咗', 'sik6 zo2'], ['早餐', 'zou2 caan1']],
    [['唔好意思', 'm4 hou2 ji3 si1'], ['我', 'ngo5'], ['遲到', 'ci4 dou3'], ['喇', 'laa3']],
    [['冇問題', 'mou5 man6 tai4'], ['我', 'ngo5'], ['幫', 'bong1'], ['你', 'nei5']],
    [['呢度', 'ni1 dou6'], ['唔可以', 'm4 ho2 ji5'], ['食煙', 'sik6 jin1']],
    [['我', 'ngo5'], ['鍾意', 'zung1 ji3'], ['飲', 'jam2'], ['咖啡', 'gaa3 fe1']],
    [['你', 'nei5'], ['識唔識', 'sik1 m4 sik1'], ['講', 'gong2'], ['廣東話', 'gwong2 dung1 waa2']],
    [['佢', 'keoi5'], ['去咗', 'heoi3 zo2'], ['澳門', 'ou3 mun2']],
    [['外面', 'ngoi6 min6'], ['落緊雨', 'lok6 gan2 jyu5']],
    [['記得', 'gei3 dak1'], ['帶', 'daai3'], ['遮', 'ze1']],
    [['早啲', 'zou2 di1'], ['瞓覺', 'fan3 gaau3'], ['啦', 'laa1']],
    [['點樣', 'dim2 joeng2'], ['去', 'heoi3'], ['機場', 'gei1 coeng4']],
    [['我哋', 'ngo5 dei6'], ['喺', 'hai2'], ['銅鑼灣', 'tung4 lo4 waan1'], ['等', 'dang2']],
    [['今晚', 'gam1 maan5'], ['食', 'sik6'], ['乜嘢', 'mat1 je5']],
    [['你', 'nei5'], ['屋企', 'uk1 kei2'], ['有', 'jau5'], ['幾多', 'gei2 do1'], ['人', 'jan4']],
    [['多謝', 'do1 ze6'], ['你', 'nei5'], ['幫手', 'bong1 sau2']],
    [['小心', 'siu2 sam1'], ['啲', 'di1']],
    [['我', 'ngo5'], ['用', 'jung6'], ['粵拼', 'jyut6 ping3'], ['打字', 'daa2 zi6']],
    [['你', 'nei5'], ['做緊', 'zou6 gan2'], ['乜嘢', 'mat1 je5']],
    [['好耐', 'hou2 noi6'], ['冇見', 'mou5 gin3']],
    [['一齊', 'jat1 cai4'], ['加油', 'gaa1 jau4']]
  ];

  // ---------- 拼音解析 ----------
  var INI_LIST = ['gw', 'kw', 'ng', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'z', 'c', 's', 'j', 'w'];
  function parse(jp) {
    var tone = /[0-9]$/.test(jp) ? +jp.slice(-1) : 0, body = tone ? jp.slice(0, -1) : jp, ini = '';
    for (var i = 0; i < INI_LIST.length; i++) if (body.indexOf(INI_LIST[i]) === 0) { ini = INI_LIST[i]; break; }
    return { ini: ini, fin: body.slice(ini.length), tone: tone };
  }
  // 有另一個常用讀音嘅字（聽 teng1／ting1、坐 co5／zo6…）唔出題，避免「錯答案」其實都啱
  var NOQ = '聽坐嚟星讀';
  var CHARS = RAW.filter(function (r) { return NOQ.indexOf(r[0]) < 0; })
    .map(function (r) { return { c: r[0], jp: r[1], p: parse(r[1]) }; });
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ''); }
  function stripTone(s) { return String(s).replace(/[0-9]/g, ''); }

  // ---------- 跟打文章：字典、分詞、隨機文章 ----------
  // 常用字（每字一個最常用讀音；多音字以詞語優先，唔啱可以喺跟打時「改讀音」，會記低）
  var EXTRA = '的dik1 是si6 了liu5 在zoi6 有jau5 不bat1 這ze5 他taa1 她taa1 它taa1 們mun4 個go3 上soeng6 中zung1 和wo4 為wai4 ' +
    '以ji5 會wui5 說syut3 就zau6 也jaa5 要jiu3 年nin4 生saang1 能nang4 而ji4 子zi2 那naa5 得dak1 於jyu1 着zoek6 下haa6 自zi6 ' +
    '之zi1 後hau6 作zok3 裏leoi5 裡leoi5 用jung6 行hang4 所so2 然jin4 種zung2 事si6 成sing4 方fong1 經ging1 麼mo1 法faat3 如jyu4 ' +
    '都dou1 同tung4 現jin6 當dong1 沒mut6 動dung6 面min6 起hei2 看hon3 定ding6 分fan1 還waan4 進zeon3 好hou2 小siu2 部bou6 其kei4 ' +
    '些se1 主zyu2 樣joeng6 理lei5 本bun2 前cin4 但daan6 因jan1 只zi2 從cung4 實sat6 者ze2 意ji3 無mou4 力lik6 與jyu5 長coeng4 ' +
    '把baa2 機gei1 民man4 第dai6 公gung1 此ci2 已ji5 工gung1 使sai2 情cing4 明ming4 性sing3 全cyun4 三saam1 又jau6 正zing3 業jip6 ' +
    '將zoeng1 兩loeng5 間gaan1 由jau4 問man6 很han2 最zeoi3 重zung6 並bing6 物mat6 應jing1 向hoeng3 文man4 體tai2 美mei5 相soeng1 ' +
    '見gin3 被bei6 利lei6 等dang2 或waak6 己gei2 身san1 果gwo2 加gaa1 話waa6 合hap6 回wui4 特dak6 代doi6 內noi6 信seon3 表biu2 ' +
    '化faa3 給kap1 世sai3 位wai6 次ci3 度dou6 門mun4 任jam6 常soeng4 先sin1 海hoi2 通tung1 教gaau3 兒ji4 原jyun4 聲sing1 提tai4 ' +
    '及kap6 比bei2 員jyun4 解gaai2 真zan1 處cyu3 走zau2 各gok3 幾gei2 認jing6 條tiu4 平ping4 氣hei3 題tai4 活wut6 更gang3 別bit6 ' +
    '打daa2 變bin3 神san4 總zung2 何ho4 電din6 少siu2 報bou3 才coi4 結git3 反faan2 受sau6 目muk6 太taai3 再zoi3 感gam2 做zou6 ' +
    '接zip3 必bit1 場coeng4 件gin6 計gai3 管gun2 期kei4 市si5 直zik6 德dak1 命ming6 指zi2 許heoi2 區keoi1 保bou2 至zi3 便bin6 ' +
    '空hung1 決kyut3 展zin2 科fo1 司si1 非fei1 白baak6 界gaai3 達daat6 放fong3 強koeng4 像zoeng6 難naan4 思si1 王wong4 設cit3 ' +
    '色sik1 路lou6 記gei3 品ban2 住zyu6 告gou3 求kau4 邊bin1 死sei2 該goi1 交gaau1 萬maan6 望mong6 覺gok3 共gung6 確kok3 師si1 ' +
    '清cing1 讓joeng6 識sik1 帶daai3 運wan6 笑siu3 飛fei1 步bou6 改goi2 收sau1 言jin4 每mui5 車ce1 親can1 服fuk6 辦baan6 往wong5 ' +
    '元jyun4 英jing1 近kan5 失sat1 轉zyun2 準zeon2 始ci2 怎zam2 未mei6 叫giu3 單daan1 影jing2 字zi6 流lau4 連lin4 深sam1 算syun3 ' +
    '百baak3 價gaa3 城sing4 石sek6 級kap1 整zing2 離lei4 請ceng2 際zai3 示si6 病beng6 線sin3 似ci5 精zing1 滿mun5 消siu1 越jyut6 ' +
    '容jung4 照ziu3 增zang1 功gung1 嗎maa3 包baau1 片pin3 史si2 查caa4 輕hing1 除ceoi4 找zaau2 顯hin2 阿aa3 李lei5 談taam4 吃hek3 ' +
    '圖tou4 念nim6 引jan5 首sau2 專zyun1 號hou6 另ling6 注zyu3 語jyu5 青cing1 選syun2 響hoeng2 雖seoi1 參caam1 希hei1 古gu2 ' +
    '房fong4 半bun3 節zit3 某mau5 案on3 態taai3 護wu6 孩haai4 夠gau3 音jam1 跟gan1 底dai2 例lai6 留lau4 終zung1 答daap3 緊gan2 ' +
    '黃wong4 故gu3 河ho4 江gong1 客haak3 低dai1 友jau5 止zi2 千cin1 值zik6 男naam4 網mong5 助zo6 倒dou2 球kau4 怕paa3 苦fu2 ' +
    '久gau2 錯co3 試si3 腦nou5 誰seoi4 陽joeng4 送sung3 驚ging1 傷soeng1 藥joek6 夜je6 初co1 喜hei2 歡fun1 冷laang5 停ting4 ' +
    '遊jau4 龍lung4 室sat1 簡gaan2 靜zing6 衣ji1 您nei5 痛tung3 寶bou2 唱coeng3 歌go1 洗sai2 衫saam1 褲fu3 鞋haai4 窗coeng1 ' +
    '枱toi2 櫈dang3 床cong4 燈dang1 雨jyu5 晴cing4 冬dung1 秋cau1 夏haa6 鐘zung1 錶biu1 筆bat1 紙zi2 玩waan2 跑paau2 跳tiu3 ' +
    '飲jam2 喺hai2 咗zo2 嗰go2 呢ni1 啲di1 冇mou5 咁gam3 乜mat1 嘢je5 哋dei6 咪mai6 囉lo1 喎wo3 㗎gaa3 吖aa1 呀aa3 啦laa1 喇laa3 ' +
    '嘛maa3 噉gam2 畀bei2 俾bei2 攞lo2 搵wan2 揾wan2 諗nam2 啱ngaam1 靚leng3 攰gui6 瞓fan3 傾king1 嬲nau1 返faan1 嚟lai4';
  var CHAR_MAP = {}, WORD_MAP = {}, MAXW = 1;
  EXTRA.replace(/(\S)([a-z]+[1-6])/g, function (_, c, jp) { CHAR_MAP[c] = jp; return ''; });
  RAW.forEach(function (r) { CHAR_MAP[r[0]] = r[1]; });
  function addWord(w, jp) {
    if (w.length === 1) { CHAR_MAP[w] = jp; return; }
    WORD_MAP[w] = jp; if (w.length > MAXW) MAXW = w.length;
  }
  SENTS.forEach(function (s) { s.forEach(function (t) { addWord(t[0], t[1]); }); });
  WORDS.forEach(function (w) { addWord(w[0], w[1]); });
  function isHan(c) { return /[㐀-鿿豈-﫿]/.test(c); }
  // 文字 → [{c, jp}]；標點／英文／數字 → {c, skip:true}；唔識讀 → {c, jp:null}
  // custom：用戶自己補／改嘅讀音（單字），優先過內置
  function lookup(text, custom) {
    custom = custom || {};
    var chars = Array.from(String(text).replace(/\r/g, '')), out = [], i = 0;
    while (i < chars.length) {
      var c = chars[i];
      if (!isHan(c)) { out.push({ c: c, skip: true }); i++; continue; }
      var hit = 0;
      if (!custom[c]) {
        for (var L = Math.min(MAXW, chars.length - i); L >= 2 && !hit; L--) {
          var w = chars.slice(i, i + L).join('');
          if (WORD_MAP[w]) {
            var sy = WORD_MAP[w].split(' ');
            for (var j = 0; j < L; j++) out.push({ c: chars[i + j], jp: custom[chars[i + j]] || sy[j] });
            hit = L;
          }
        }
      }
      if (hit) { i += hit; continue; }
      out.push({ c: c, jp: custom[c] || CHAR_MAP[c] || null });
      i++;
    }
    return out;
  }
  // 隨機文章：揀 n 句，兩句一組（，。）
  function article(rng, n) {
    var idx = util.shuffle(SENTS.map(function (_, i) { return i; }), rng).slice(0, Math.min(n, SENTS.length)), out = [];
    idx.forEach(function (si, k) {
      SENTS[si].forEach(function (t) {
        var sy = t[1].split(' ');
        t[0].split('').forEach(function (c, j) { out.push({ c: c, jp: sy[j] }); });
      });
      out.push({ c: (k % 2 === 0 && k < idx.length - 1) ? '，' : '。', skip: true });
    });
    return out;
  }

  // ---------- 視覺 ----------
  function bigChar(c) { return '<div class="big">' + c + '</div>'; }
  function hint(jp) { return '<details class="hint"><summary>粵拼提示（唔識先睇）</summary><div class="jp">' + jp + '</div></details>'; }
  var KB_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  // 鍵盤圖：hl = 要強調嘅字母；note = 圖下說明
  function keyboard(hl, note) {
    var h = '<div class="kb">';
    KB_ROWS.forEach(function (row, i) {
      h += '<div class="kbrow" style="padding-left:' + (i * 14) + 'px">';
      row.split('').forEach(function (k) { h += '<span class="key' + (hl.indexOf(k) >= 0 ? ' on' : '') + '">' + k + '</span>'; });
      h += '</div>';
    });
    h += '<div class="kbrow"><span class="key wide">1 2 3 4 5 6 ＝ 聲調（數字列）</span></div>';
    return h + '</div>' + (note ? '<div class="cap">' + note + '</div>' : '');
  }
  function pitchSvg(n) {
    var v = TONE[n].v, a = +v[0], b = +v[1];
    var y = function (L) { return 60 - (L - 1) * 12; };
    var ya = y(a), yb = y(b), ym = (ya + yb) / 2, grid = '';
    for (var L = 1; L <= 5; L++) grid += '<line x1="10" y1="' + y(L) + '" x2="150" y2="' + y(L) + '" class="grid"/>';
    return '<svg viewBox="0 0 160 80" class="pitch" role="img" aria-label="音高走勢圖">' + grid +
      '<polyline points="20,' + ya + ' 80,' + ym + ' 140,' + yb + '" class="line"/>' +
      '<circle cx="20" cy="' + ya + '" r="4" class="dot"/><circle cx="140" cy="' + yb + '" r="4" class="dot"/></svg>';
  }
  function toneTable() {
    var h = '<table class="tt"><tr><th>數字</th><th>名</th><th>音高</th><th>例</th></tr>';
    var ex = { 1: '詩 si1', 2: '史 si2', 3: '試 si3', 4: '時 si4', 5: '市 si5', 6: '事 si6' };
    for (var n = 1; n <= 6; n++) h += '<tr><td><b>' + n + '</b></td><td>' + TONE[n].n + '</td><td>' + TONE[n].d + ' ' + TONE[n].v + '</td><td>' + ex[n] + '</td></tr>';
    return h + '</table>';
  }

  // ---------- 診斷：打錯咗邊部分 ----------
  function diagSyl(typed, right) {
    var t = norm(typed);
    if (t === right) return { ok: true };
    if (!/[0-9]$/.test(t) && stripTone(right) === t) return { ok: false, k: 'ERR:notone', note: '拼音啱，但漏咗聲調數字（應該打 ' + right + '）。' };
    var pt = parse(t), pr = parse(right), parts = [];
    var wi = pt.ini !== pr.ini, wf = pt.fin !== pr.fin, wt = pt.tone !== pr.tone;
    if (wi) parts.push('聲母打咗「' + (pt.ini || '冇') + '」，應該係「' + (pr.ini || '冇') + '」');
    if (wf) parts.push('韻母打咗「' + (pt.fin || '冇') + '」，應該係「' + (pr.fin || '冇') + '」');
    if (wt) parts.push(pt.tone ? '聲調打咗 ' + pt.tone + '，應該係 ' + pr.tone : '漏咗聲調 ' + pr.tone);
    var k = wi && wf ? 'ERR:both' : wi ? 'ERR:ini' : wf ? 'ERR:fin' : 'ERR:tone';
    return { ok: false, k: k, note: parts.join('；') + '。' };
  }

  // ---------- 生成器 ----------
  // 揀正確拼法（識別，鷹架）：干擾項只改一部分
  var INI_SWAP = {
    n: ['l', 'ng'], l: ['n'], ng: ['', 'n'], '': ['ng', 'h'], z: ['c', 's', 'j'], c: ['z', 's'], s: ['z', 'c'],
    g: ['k', 'gw'], k: ['g', 'h'], b: ['p', 'm'], p: ['b'], d: ['t'], t: ['d'], h: ['', 'k'],
    j: ['', 'w', 'z'], m: ['b', 'n'], f: ['h', 'w'], w: ['j', 'f'], gw: ['g', 'kw'], kw: ['k', 'gw']
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
    if (/^eo/.test(f)) out.push(f.replace(/^eo/, 'oe'));
    if (/^oe/.test(f)) out.push(f.replace(/^oe/, 'eo'));
    if (/^yu/.test(f)) out.push(f.replace(/^yu/, 'u'));
    return out.filter(function (x) { return x !== f; });
  }
  function genSpellMC(pred, key) {
    return function (rng) {
      var x = util.pick(rng, CHARS.filter(pred)), p = x.p, right = x.jp;
      var stop = /[ptk]$/.test(p.fin);
      var tones = (stop ? [1, 3, 6] : [1, 2, 3, 4, 5, 6]).filter(function (t) { return t !== p.tone; });
      var lists = [
        tones.map(function (t) { return { s: p.ini + p.fin + t, k: 'ERR:tone' }; }),
        (INI_SWAP[p.ini] || []).map(function (i) { return { s: i + p.fin + p.tone, k: 'ERR:ini' }; }),
        finSwaps(p.fin).map(function (f) { return { s: p.ini + f + p.tone, k: 'ERR:fin' }; })
      ].map(function (l) {
        return util.shuffle(l.filter(function (o) { return /^[a-z]+[1-6]$/.test(o.s) && o.s !== right; }), rng);
      });
      var bad = [], seen = {};
      var add = function (o) { if (o && !seen[o.s] && bad.length < 3) { seen[o.s] = 1; bad.push(o); } };
      util.shuffle(lists.slice(), rng).forEach(function (l) { add(l[0]); });
      util.shuffle([].concat.apply([], lists), rng).forEach(add);
      return {
        prompt: '「' + x.c + '」嘅粵拼係邊個？',
        visual: bigChar(x.c), say: x.c,
        options: [{ t: right, ok: true, k: key }].concat(bad.map(function (o) { return { t: o.s, ok: false, k: o.k }; })),
        expl: x.c + ' ＝ ' + right + '（聲母 ' + (p.ini || '冇') + '、韻母 ' + (p.fin || '冇') + '、第 ' + p.tone + ' 聲）。'
      };
    };
  }
  // 打出單字粵拼（生成，連聲調）
  function genTypeChar(pred) {
    return function (rng) {
      var x = util.pick(rng, CHARS.filter(pred || function () { return true; }));
      return {
        input: true,
        prompt: '打出「' + x.c + '」嘅粵拼（連聲調數字）',
        visual: bigChar(x.c), say: x.c,
        placeholder: '例如 nei5', answerText: x.jp,
        check: function (v) { return diagSyl(v, x.jp); },
        expl: x.c + ' ＝ ' + x.jp + '（聲母 ' + (x.p.ini || '冇') + '、韻母 ' + (x.p.fin || '冇') + '、第 ' + x.p.tone + ' 聲）。'
      };
    };
  }
  // 打聲調數字
  function genTypeTone(rng) {
    var x = util.pick(rng, CHARS), n = x.p.tone;
    return {
      input: true, inputmode: 'numeric',
      prompt: '「' + x.c + '」讀 ' + stripTone(x.jp) + '？，打個聲調數字（1–6）',
      visual: bigChar(x.c), say: x.c,
      placeholder: '1–6', answerText: String(n),
      check: function (v) {
        return norm(v) === String(n) ? { ok: true }
          : { ok: false, k: 'ERR:tone', note: '應該係第 ' + n + ' 聲（' + TONE[n].n + '，' + TONE[n].d + '）。' };
      },
      expl: x.c + ' ＝ ' + x.jp + '。' + (/[ptk]$/.test(x.p.fin) ? '入聲字（-p／-t／-k）只會係 1、3、6 聲。' : '')
    };
  }
  // 睇音高圖揀聲調（選擇題）
  function genToneVisual(rng) {
    var n = util.int(rng, 1, 6);
    var others = util.shuffle([1, 2, 3, 4, 5, 6].filter(function (x) { return x !== n; }), rng).slice(0, 3);
    return {
      prompt: '見圖嘅音高走勢（5 ＝最高，1 ＝最低），應該打邊個數字？',
      visual: pitchSvg(n),
      options: [n].concat(others).map(function (m) {
        return { t: m + '（' + TONE[m].n + '・' + TONE[m].d + '）', ok: m === n, k: 'T' + m };
      }),
      expl: '第 ' + n + ' 聲：' + TONE[n].n + '，' + TONE[n].d + '，調值 ' + TONE[n].v + '。'
    };
  }
  // 打詞語（聲調可打可唔打，空格可有可無）
  function genTypeWord(rng) { return typeWordQ(util.pick(rng, WORDS)); }
  function typeWordQ(w) {
    var syl = w[1].split(' '), chars = w[0].split('');
    var withT = norm(w[1]), noT = stripTone(withT);
    return {
      input: true, word: w[0],
      prompt: '打出「' + w[0] + '」嘅粵拼（聲調可打可唔打）',
      visual: bigChar(w[0]), say: w[0],
      placeholder: '例如 neihou 或者 nei5hou2', answerText: w[1],
      check: function (v) {
        var t = norm(v);
        if (t === withT || t === noT) return { ok: true };
        if (/[0-9]/.test(t)) {
          var parts = t.match(/[a-z]+[0-9]?/g) || [];
          if (parts.length === syl.length) {
            for (var i = 0; i < syl.length; i++) {
              var d = diagSyl(parts[i], syl[i]);
              if (!d.ok) return { ok: false, k: d.k, note: '第 ' + (i + 1) + ' 個字「' + chars[i] + '」：' + d.note };
            }
          }
        }
        var pos = 0, plain = stripTone(t);
        for (var j = 0; j < syl.length; j++) {
          var s = stripTone(syl[j]);
          if (plain.substr(pos, s.length) !== s) return { ok: false, k: 'ERR:word', note: '第 ' + (j + 1) + ' 個字「' + chars[j] + '」應該打 ' + s + '（' + syl[j] + '）。' };
          pos += s.length;
        }
        return { ok: false, k: 'ERR:word', note: '聲調唔啱，或者多咗字母。正確係 ' + w[1] + '。' };
      },
      expl: w[0] + ' ＝ ' + w[1] + '。真輸入法通常打 ' + noT + ' 就出到。'
    };
  }
  // 實戰：用自己嘅輸入法打中文
  function imeQ(text, jp, kind) {
    var chars = text.split(''), syl = jp.split(' ');
    return {
      input: true, lang: 'zh-HK', unit: chars.length, word: text,
      prompt: '用你嘅粵拼輸入法，打出呢個' + kind + '（打完撳 Enter）',
      visual: '<div class="sent">' + text + '</div>' + hint(jp),
      say: text, placeholder: '喺度用輸入法打中文', answerText: text,
      check: function (v) {
        var t = String(v).replace(/[\s，。！？、,.!?]/g, '');
        if (t === text) return { ok: true };
        var bad = [];
        for (var i = 0; i < chars.length; i++) {
          if (t[i] !== chars[i]) bad.push('第 ' + (i + 1) + ' 字應該係「' + chars[i] + '」（' + syl[i] + '）' + (t[i] ? '，你打咗「' + t[i] + '」' : ''));
        }
        if (t.length > chars.length) bad.push('多咗「' + t.slice(chars.length) + '」');
        return { ok: false, k: 'ERR:ime', note: bad.slice(0, 3).join('；') + '。' };
      },
      expl: text + ' ＝ ' + jp + '。打詞語（連住打）通常比逐個字打快，亦少啲揀錯同音字。'
    };
  }
  function genImeWord(rng) { var w = util.pick(rng, WORDS); return imeQ(w[0], w[1], '詞語'); }
  function genImeSent(rng) {
    var s = util.pick(rng, SENTS);
    return imeQ(s.map(function (t) { return t[0]; }).join(''), s.map(function (t) { return t[1]; }).join(' '), '句子');
  }

  // ---------- 規則（揀字用） ----------
  var P = {
    ini: function (x) { return ['z', 'c', 's', 'j', 'gw', 'kw'].indexOf(x.p.ini) >= 0; },
    aa: function (x) { return /^a/.test(x.p.fin); },
    eo: function (x) { return /eo|oe/.test(x.p.fin); },
    yu: function (x) { return /yu/.test(x.p.fin); },
    end: function (x) { return /(ng|n|k|t|m|p)$/.test(x.p.fin) && x.p.fin.length > 1; },
    ng: function (x) { return x.p.ini === '' || x.p.ini === 'ng' || x.p.fin === ''; }
  };

  // ---------- 課（項目） ----------
  var ITEMS = {
    ini_rule: { name: '聲母拼法：z c s j gw kw', cat: '拼寫規則', mn: 'z c s 唔係 ts ch sh；英文 y 音寫 j',
      diagram: keyboard('zcsjgwk', '粵拼專用寫法：z（知 zi1）、c（車 ce1）、s（書 syu1）、j（人 jan4）、gw／kw（光 gwong1、群 kwan4）'),
      features: ['知 zi1、針 zam1（唔係 chi、tsz）', '人 jan4、一 jat1（唔係 yan、yat）', '光 gwong1、群 kwan4（圓唇 gw kw）'],
      principle: '粵拼用 z c 代替 ts ch；用 j 代表英文嘅 y 音', fail: '打咗 yan、chi、tsz（其他拼音方案嘅寫法）',
      tip: '輸入法只認粵拼寫法，打 yan 係搵唔到「人」嘅。', gens: [genSpellMC(P.ini, 'ini_rule'), genTypeChar(P.ini)] },
    aa_rule: { name: '長短元音：aa ／ a', cat: '拼寫規則', mn: '長 aa、短 a：鹹 haam4 ／ 心 sam1',
      diagram: '<div class="pairbox"><div><b>aa（長）</b><br>鹹 haam4<br>八 baat3<br>山 saan1</div><div><b>a（短）</b><br>心 sam1<br>七 cat1<br>新 san1</div></div>',
      features: ['aa 拉長：鹹 haam4、八 baat3', 'a 短促：心 sam1、七 cat1', '唔同元音＝唔同字，唔可以互換'],
      principle: '長短元音分辨唔同字', fail: '將 haam 打成 ham', tip: '單獨一個 a 喺粵拼一定寫 aa（例如 媽 maa1）。',
      gens: [genSpellMC(P.aa, 'aa_rule'), genTypeChar(P.aa)] },
    eo_rule: { name: 'eo ／ oe ／ eoi', cat: '拼寫規則', mn: 'oe 跟 ng／k；eo 跟 i／n／t',
      diagram: '<div class="pairbox"><div><b>oe + ng／k</b><br>香 hoeng1<br>腳 goek3<br>想 soeng2</div><div><b>eo + i／n／t</b><br>水 seoi2<br>春 ceon1<br>出 ceot1</div></div>',
      features: ['eoi：水 seoi2、去 heoi3、佢 keoi5', 'oeng／oek：香 hoeng1、腳 goek3', 'eon／eot：春 ceon1、出 ceot1'],
      principle: '口訣：oeng、oek；eoi、eon、eot', fail: '打咗 sui、heung（其他方案寫法）', tip: '打「香港」係 hoeng gong，唔係 heung kong。',
      gens: [genSpellMC(P.eo, 'eo_rule'), genTypeChar(P.eo)] },
    yu_rule: { name: 'yu ／ jyu', cat: '拼寫規則', mn: 'yu 係 ü 音；字頭有 y 音要加 j：魚 jyu4',
      diagram: '<div class="pairbox"><div><b>有聲母 + yu</b><br>書 syu1<br>豬 zyu1<br>雪 syut3</div><div><b>j + yu</b><br>魚 jyu4<br>月 jyut6<br>完 jyun4</div></div>',
      features: ['書 syu1、豬 zyu1、船 syun4', '魚 jyu4、月 jyut6、遠 jyun5（j＋yu）', 'yu 唔可以單獨開頭'],
      principle: 'yu 代表 ü；字頭嘅 y 音一定寫 j', fail: '打咗 yu4、yut6（少咗 j）', tip: '「粵拼」本身就係 jyut6 ping3。',
      gens: [genSpellMC(P.yu, 'yu_rule'), genTypeChar(P.yu)] },
    end_rule: { name: '韻尾：-n／-ng、-t／-k、-m／-p', cat: '拼寫規則', mn: '韻尾要打啱，懶音會令你搵唔到字',
      diagram: '<table class="tt"><tr><th>鼻音尾</th><th>入聲尾</th></tr><tr><td>-m 心 sam1</td><td>-p 急 gap1</td></tr><tr><td>-n 新 san1</td><td>-t 七 cat1</td></tr><tr><td>-ng 香 hoeng1</td><td>-k 食 sik6</td></tr></table>',
      features: ['-ng：香 hoeng1、紅 hung4；-n：新 san1', '-k：食 sik6、六 luk6；-t：七 cat1', '-m：心 sam1；-p：急 gap1'],
      principle: '-m／-n／-ng 同 -p／-t／-k 係成對嘅', fail: '將 gong 打成 gon、sik 打成 sit', tip: '-m 配 -p、-n 配 -t、-ng 配 -k：口形一樣。',
      gens: [genSpellMC(P.end, 'end_rule'), genTypeChar(P.end)] },
    ng_rule: { name: 'ng、零聲母、唔 m 五 ng', cat: '拼寫規則', mn: '我 ngo5 有 ng；愛 oi3 冇聲母',
      diagram: '<div class="pairbox"><div><b>ng 開頭</b><br>我 ngo5<br>牛 ngau4<br>眼 ngaan5</div><div><b>冇聲母</b><br>愛 oi3<br>屋 uk1<br>安 on1</div><div><b>成音節</b><br>唔 m4<br>五 ng5</div></div>',
      features: ['ng 聲母：我 ngo5、牛 ngau4、牙 ngaa4', '零聲母：愛 oi3、屋 uk1、鴨 aap3', '成音節：唔 m4、五 ng5'],
      principle: '跟標準讀音決定有冇 ng', fail: '我 打成 o5、愛 打成 ngoi3', tip: '打唔出字就試另一個（有／冇 ng），睇輸入法出邊個。',
      gens: [genSpellMC(P.ng, 'ng_rule'), genTypeChar(P.ng)] },
    tone_num: { name: '聲調數字 1–6', cat: '聲調', mn: '1 高平 2 高升 3 中平 4 低降 5 低升 6 低平',
      diagram: toneTable(),
      features: ['數字打喺每個字最尾', '入聲字（-p／-t／-k）只得 1、3、6', '好多輸入法聲調可以唔打，打咗就少啲同音字'],
      principle: '聲調數字＝音高走勢', fail: '4 同 6、3 同 6 撈亂', tip: '唔肯定聲調就唔好打，等輸入法列晒同音字。',
      gens: [genToneVisual, genTypeTone] },
    type_char: { name: '打單字（連聲調）', cat: '打字', mn: '聲母 → 韻母 → 聲調，一氣呵成',
      diagram: keyboard('neiho', '例：你 → n e i 5；好 → h o u 2'),
      features: ['先諗讀音，再逐部分打', '最尾加聲調數字（以單字本調為準，唔計變調）', '打錯會話你錯喺聲母、韻母定聲調'],
      principle: '自己打出嚟（生成）記得最牢', fail: '睇住字估拼音', tip: '慢慢打，準確先，速度自然會嚟。',
      gens: [genTypeChar(null)] },
    type_word: { name: '打詞語', cat: '打字', mn: '一個詞連住打，聲調可省',
      diagram: keyboard('neihou', '例：你好 → neihou（或者 nei5hou2）'),
      features: ['你好 neihou 或者 nei5hou2', '空格可有可無', '真輸入法通常唔使打聲調'],
      principle: '輸入法以詞為單位，打詞比逐字快', fail: '一個字一個字打再逐個揀', tip: '常用詞打熟咗，速度會快好多。',
      gens: [genTypeWord] },
    ime_word: { name: '實戰：輸入法打詞語', cat: '實戰', mn: '用你自己嘅粵拼輸入法打出中文',
      diagram: '<div class="cap">打字框會用你部機而家嘅輸入法：電腦切去粵拼輸入法，手機轉去粵拼鍵盤。打完撳 Enter，網站會計你每分鐘打幾多字。</div>',
      features: ['電腦：Rime（小狼毫／鼠鬚管）粵拼方案', '手機：粵拼鍵盤（詳見「輸入法教學」）', '唔識打可以撳「粵拼提示」'],
      principle: '真打字＝拼音＋揀字', fail: '揀錯同音字', tip: '同音字多，打詞語比打單字更準。', gens: [genImeWord] },
    ime_sent: { name: '實戰：輸入法打句子', cat: '實戰', mn: '一句一句打，計速度',
      diagram: '<div class="cap">目標：先求準，再求快。統計頁會顯示你嘅平均速度（字／分鐘）。</div>',
      features: ['標點唔使打', '每句 4–7 個字', '速度記錄喺統計頁'], principle: '大量練習先會變自動',
      fail: '一見錯就刪晒重打', tip: '用詞語做單位：我哋／一齊／飲茶。', gens: [genImeSent] }
  };

  // ---------- 關卡 ----------
  var LEVELS = [
    { id: 'L1', name: '聲母拼法', desc: 'z c s j gw kw', items: ['ini_rule'], n: 8 },
    { id: 'L2', name: '長短元音', desc: 'aa ／ a', items: ['aa_rule'], n: 8 },
    { id: 'L3', name: 'eo 同 oe', desc: '水 seoi2、香 hoeng1', items: ['eo_rule'], n: 8 },
    { id: 'L4', name: 'yu 同 jyu', desc: '書 syu1、魚 jyu4', items: ['yu_rule'], n: 8 },
    { id: 'L5', name: '韻尾', desc: '-n／-ng、-t／-k、-m／-p', items: ['end_rule'], n: 8 },
    { id: 'L6', name: 'ng 同零聲母', desc: '我 ngo5、愛 oi3、唔 m4', items: ['ng_rule'], n: 8 },
    { id: 'L7', name: '規則大混戰', desc: '第 1–6 關混合', items: ['ini_rule', 'aa_rule', 'eo_rule', 'yu_rule', 'end_rule', 'ng_rule'], n: 10 },
    { id: 'L8', name: '聲調數字', desc: '1–6 聲', items: ['tone_num'], n: 8 },
    { id: 'L9', name: '打單字', desc: '連聲調打出粵拼', items: ['type_char'], n: 10 },
    { id: 'L10', name: '打詞語', desc: '聲調可省', items: ['type_word'], n: 10 },
    { id: 'L11', name: '實戰詞語', desc: '用輸入法打中文', items: ['ime_word'], n: 8 },
    { id: 'L12', name: '實戰句子', desc: '用輸入法打句子', items: ['ime_sent'], n: 6 },
    { id: 'L13', name: '畢業考', desc: '全部混合', items: ['ini_rule', 'aa_rule', 'eo_rule', 'yu_rule', 'end_rule', 'ng_rule', 'tone_num', 'type_char', 'type_word', 'ime_word', 'ime_sent'], n: 15 }
  ];

  // ---------- 輸入法教學 ----------
  var GUIDE = [
    '<h2>📱 點樣用鍵盤同手機打粵拼</h2>',
    '<p class="muted">以下係常見選擇。App 名同安裝步驟可能會變，裝之前喺官方網站／App Store／Google Play 搜尋名稱確認。</p>',
    '<h3>💻 電腦</h3><ul>',
    '<li><b>Rime 輸入法＋粵拼方案</b>：Windows 版叫「小狼毫」，Mac 版叫「鼠鬚管」。官方網站 rime.im；裝好之後加入「粵拼」（jyut6ping3）方案。</li>',
    '<li>切換輸入法：Windows 通常係 <code>Win＋空白鍵</code>，Mac 係 <code>Control＋空白鍵</code>。</li></ul>',
    '<h3>📱 手機</h3><ul>',
    '<li><b>TypeDuck</b>：支援粵拼嘅輸入法，有 iPhone 同 Android 版。</li>',
    '<li><b>Android：同文輸入法（Trime）</b>：Rime 嘅手機版，可以加粵拼方案。</li>',
    '<li><b>iPhone 內置「粵語」鍵盤</b>有拼音排列，但佢用嘅拼法唔一定同粵拼一樣，用之前試下。</li></ul>',
    '<h3>⌨️ 打字技巧</h3><ol>',
    '<li><b>聲調可以唔打</b>：打 <code>neihou</code> 就會出「你好」；打埋數字（<code>nei5hou2</code>）同音字會少啲。</li>',
    '<li><b>打詞唔好打單字</b>：一次打成個詞，揀字次數少好多。</li>',
    '<li><b>揀字</b>：撳空白鍵揀第一個，或者撳數字揀其他。</li>',
    '<li><b>簡拼</b>：部分輸入法只打每個字第一個字母都得（例如 nh → 你好），試下你嘅輸入法支唔支援。</li>',
    '<li><b>本網站「打拼音」題</b>要用英文鍵盤打字母；手機記得轉返英文鍵盤。</li></ol>',
    '<h3>🔤 舊式拼法 → 粵拼</h3>',
    '<table class="tt"><tr><th>字</th><th>常見舊寫法</th><th>粵拼</th></tr>',
    '<tr><td>人</td><td>yan</td><td>jan4</td></tr><tr><td>知</td><td>chi</td><td>zi1</td></tr>',
    '<tr><td>水</td><td>sui</td><td>seoi2</td></tr><tr><td>香</td><td>heung</td><td>hoeng1</td></tr>',
    '<tr><td>魚</td><td>yue</td><td>jyu4</td></tr><tr><td>出</td><td>chut</td><td>ceot1</td></tr>',
    '<tr><td>書</td><td>shu</td><td>syu1</td></tr></table>',
    '<h3>🗺️ 建議次序</h3><p>關卡 1–7（拼寫規則）→ 8（聲調）→ 9–10（自己打粵拼）→ 11–13（用輸入法實戰）。</p>'
  ].join('');

  // ---------- 出題（確定性） ----------
  function makeQ(k, seed) {
    var it = ITEMS[k];
    var rng = util.mulberry(seed);
    var gi = seed % it.gens.length;
    var q = it.gens[gi](rng);
    if (q.options) q.options = util.shuffle(q.options.slice(), rng);
    q.key = k; q.seed = seed; q.gi = gi;
    return q;
  }

  var labels = {
    'ERR:ini': '聲母打錯', 'ERR:fin': '韻母打錯', 'ERR:tone': '聲調打錯', 'ERR:notone': '漏咗聲調',
    'ERR:both': '聲母同韻母都錯', 'ERR:word': '詞語拼錯', 'ERR:ime': '實戰打錯字'
  };
  for (var n = 1; n <= 6; n++) labels['T' + n] = '第 ' + n + ' 聲';

  var SITE = {
    id: 'jyutping-typing-v1',
    title: '粵拼打字',
    subtitle: '學用鍵盤同手機打粵拼：規則 → 自己打 → 輸入法實戰',
    util: util,
    items: ITEMS,
    order: Object.keys(ITEMS),
    labels: labels,
    levels: LEVELS,
    guide: GUIDE, guideTitle: '📱 輸入法教學', guideDesc: '電腦／手機點樣打粵拼',
    timed: {
      title: '⏱ 計時挑戰', desc: '60 秒內打得幾多個詞', seconds: 60,
      modes: [
        { id: 'jp', name: '打粵拼', desc: '睇詞語打粵拼（英文鍵盤，聲調可省）' },
        { id: 'ime', name: '輸入法打中文', desc: '用你嘅粵拼輸入法打出詞語' }
      ],
      makeQ: function (mode, seed) {
        var w = util.pick(util.mulberry(seed), WORDS);
        var q = mode === 'ime' ? imeQ(w[0], w[1], '詞語') : typeWordQ(w);
        if (mode !== 'ime') q.prompt = '打出粵拼（聲調可省）';
        return q;
      }
    },
    makeQ: makeQ,
    _data: { CHARS: CHARS, WORDS: WORDS, SENTS: SENTS, parse: parse, diagSyl: diagSyl, lookup: lookup, article: article, CHAR_MAP: CHAR_MAP }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SITE;
  else root.SITE = SITE;
})(typeof window !== 'undefined' ? window : globalThis);
