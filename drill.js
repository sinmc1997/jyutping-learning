/* drill.js — 跟打文章（粵拼網站專用插件）
   隨機文章或者自己貼上 → 逐個字顯示粵拼，撳啱一個鍵嗰個字母就變色，打完一個字自動跳下一個。
   資料（字典、分詞、隨機文章）喺 content.js 嘅 SITE._data；呢度淨係介面。 */
(function () {
  'use strict';
  var SITE = window.SITE, DD = SITE._data;
  var ID = 'drill', D = null, A = null, active = false, flashT = null;
  var KB = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  function opt() {
    var d = A.data();
    if (d.tone == null) d.tone = true;
    d.dict = d.dict || {};
    d.hist = d.hist || [];
    return d;
  }
  function target(t) { return D.tone ? t.jp : t.jp.replace(/[0-9]/g, ''); }
  function typable(t) { return t && !t.skip && t.jp; }
  function skipAhead() { while (D.i < D.toks.length && !typable(D.toks[D.i])) D.i++; }
  function total() { return D.toks.filter(typable).length; }
  function doneN() { return D.toks.slice(0, D.i).filter(typable).length; }

  // ---------- 選單 ----------
  function menu() {
    var o = opt(), esc = A.esc;
    var h = '<div class="bar"><a href="#" class="lnk" data-act="home">← 主頁</a></div><h2>⌨️ 跟打文章</h2>' +
      '<p class="muted">每個字會顯示要撳嘅鍵（例如 時 → s i 4）。撳啱嗰個字母就變色，成個字打完自動跳下一個，直到打完成篇。' +
      '記得用<b>英文鍵盤</b>（唔好開中文輸入法）。</p>';
    h += '<div class="card"><h3 style="margin-top:0">🎲 隨機文章</h3><div class="row">' +
      '<button class="primary" data-act="pa" data-arg="drill|rand|4">短（4 句）</button>' +
      '<button data-act="pa" data-arg="drill|rand|8">中（8 句）</button>' +
      '<button data-act="pa" data-arg="drill|rand|14">長（14 句）</button></div>' +
      '<div class="row"><button data-act="pa" data-arg="drill|tone">聲調數字：' + (o.tone ? '要打 ✔' : '唔使打') + '</button>' +
      '<span class="muted">唔打聲調＝淨係打字母</span></div></div>';
    h += '<div class="card"><h3 style="margin-top:0">📋 貼上自己嘅文章</h3>' +
      '<textarea id="dPaste" rows="5" placeholder="貼一段中文（繁體）入嚟，例如新聞、歌詞、短文…">' + esc(o.last || '') + '</textarea>' +
      '<div class="row"><button class="primary" data-act="pa" data-arg="drill|paste">開始跟打</button></div>' +
      '<p class="muted">內置約 ' + Object.keys(DD.CHAR_MAP).length + ' 個常用字同 ' + DD.WORDS.length + ' 個詞。唔識讀嘅字會叫你補讀音（之後會記住）；多音字讀錯可以喺跟打時撳「✏️ 改讀音」。' +
      (Object.keys(o.dict).length ? '<br>你自己補咗 ' + Object.keys(o.dict).length + ' 個字。<a href="#" data-act="pa" data-arg="drill|clearDict">清除</a>' : '') + '</p></div>';
    if (o.hist.length) {
      h += '<h3>最近成績</h3><div class="scroll"><table><tr><th>日期</th><th>字數</th><th>每分鐘</th><th>準確</th></tr>' +
        o.hist.slice().reverse().slice(0, 8).map(function (x) {
          return '<tr><td>' + new Date(x.t).toLocaleDateString() + '</td><td>' + x.n + '</td><td>' + x.cpm + ' 字</td><td>' + x.acc + '%</td></tr>';
        }).join('') + '</table></div>';
    }
    active = false;
    A.view(h);
  }

  // ---------- 補讀音 ----------
  function unknownView() {
    var esc = A.esc, list = [];
    D.toks.forEach(function (t) { if (!t.skip && !t.jp && list.indexOf(t.c) < 0) list.push(t.c); });
    D.unknown = list;
    var h = '<div class="bar"><a href="#" class="lnk" data-act="pa" data-arg="drill|menu">← 返回</a></div><div class="card">' +
      '<h2>有 ' + list.length + ' 個字未有讀音</h2><p class="muted">打粵拼（連聲調，例如 si4）。留空嘅字會略過唔使打。補咗嘅會記住，下次唔使再補。</p><div class="grid">';
    list.forEach(function (c, i) {
      h += '<label class="tile"><b style="font-size:1.6rem">' + esc(c) + '</b><input id="u' + i + '" class="ans" style="font-size:1rem;padding:6px" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="例如 si4"></label>';
    });
    h += '</div><div class="row"><button class="primary" data-act="pa" data-arg="drill|fill">開始</button>' +
      '<button data-act="pa" data-arg="drill|skipUnknown">全部略過</button></div></div>';
    active = false;
    A.view(h);
  }

  // ---------- 跟打畫面 ----------
  function start(toks) {
    D = { toks: toks, i: 0, k: 0, errs: 0, keys: 0, t0: 0, tone: opt().tone, miss: {}, fixing: false };
    skipAhead();
    if (D.i >= D.toks.length) { A.toast('冇字要打'); return menu(); }
    active = true;
    paint(true);
  }
  function articleHtml() {
    var esc = A.esc;
    return D.toks.map(function (t, j) {
      if (t.c === '\n') return '<br>';
      var cls = !typable(t) ? 'sk' : j < D.i ? 'ok' : j === D.i ? 'cur' : '';
      return '<span id="tk' + j + '" class="' + cls + '">' + esc(t.c) + '</span>';
    }).join('');
  }
  function panelHtml() {
    var t = D.toks[D.i], tg = target(t), esc = A.esc, need = tg[D.k];
    var h = '<div class="dchar">' + esc(t.c) + '</div><div class="djp">';
    for (var x = 0; x < tg.length; x++) h += '<span class="' + (x < D.k ? 'hit' : x === D.k ? 'need' : '') + '">' + tg[x] + '</span>';
    h += '</div><div class="muted" data-need="' + need + '">下一個鍵：<kbd class="bigkey">' + need + '</kbd>' +
      (/[0-9]/.test(need) ? '（聲調數字）' : '') + '</div>';
    if (D.fixing) {
      h += '<div class="row center"><input id="dFix" class="ans" style="max-width:160px;font-size:1rem" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(t.jp) + '">' +
        '<button class="primary" data-act="pa" data-arg="drill|fixSave">儲存</button><button data-act="pa" data-arg="drill|fixCancel">取消</button></div>';
    }
    return h;
  }
  function kbHtml() {
    var need = target(D.toks[D.i])[D.k];
    return KB.map(function (row, ri) {
      return '<div class="kbrow" style="padding-left:' + (ri > 1 ? (ri - 1) * 14 : 0) + 'px">' + row.split('').map(function (k) {
        if (ri === 0 && !/[1-6]/.test(k)) return '';
        return '<button class="key dkey' + (k === need ? ' on' : '') + '" data-act="pa" data-arg="drill|key|' + k + '">' + k + '</button>';
      }).join('') + '</div>';
    }).join('');
  }
  function statHtml() { return doneN() + ' / ' + total() + ' 字　✘ ' + D.errs; }
  function paint(full) {
    var el = document.getElementById('dPanel');
    if (!full && el) {
      el.innerHTML = panelHtml();
      var kb = document.getElementById('dKb'); if (kb) kb.innerHTML = kbHtml();
      var st = document.getElementById('dStat'); if (st) st.textContent = statHtml();
      var art = document.getElementById('dArt');
      if (art) {
        art.innerHTML = articleHtml();
        var cur = document.getElementById('tk' + D.i);
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      }
      if (D.fixing) { var fx = document.getElementById('dFix'); if (fx) fx.focus(); }
      return;
    }
    var h = '<div class="bar"><span class="pill">⌨️ 跟打文章</span><span id="dStat">' + statHtml() + '</span>' +
      '<a href="#" class="lnk" data-act="pa" data-arg="drill|menu">× 離開</a></div>';
    h += '<div class="card"><div id="dArt" class="dart">' + articleHtml() + '</div>';
    h += '<div id="dPanel" class="dpanel">' + panelHtml() + '</div>';
    h += '<div class="row center"><input id="dIn" class="din" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="en" placeholder="⌨️ 撳呢度開始打（英文鍵盤）"></div>';
    h += '<div id="dKb" class="kb dkb">' + kbHtml() + '</div>';
    h += '<div class="row center"><button data-act="pa" data-arg="drill|fixOpen">✏️ 改讀音</button>' +
      '<button data-act="pa" data-arg="drill|skipChar">略過呢個字</button><button data-act="pa" data-arg="drill|menu">換一篇</button></div></div>';
    A.view(h);
    var inp = document.getElementById('dIn');
    if (inp && inp.addEventListener) {
      // 手機鍵盤（例如 Gboard）會「組字」：組緊嘅時候唔可以清空，所以只處理新加嘅字母，組完先清
      var seen = '';
      inp.addEventListener('input', function (e) {
        var v = inp.value;
        if (v.length > seen.length && v.indexOf(seen) === 0) {
          var add = v.slice(seen.length);
          for (var q = 0; q < add.length; q++) feed(add[q]);
        }
        seen = v;
        if (!e.isComposing) { inp.value = ''; seen = ''; }
      });
      if (fine()) inp.focus();
    }
    var cur = document.getElementById('tk' + D.i);
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
  }
  function fine() { try { return window.matchMedia && window.matchMedia('(pointer:fine)').matches; } catch (e) { return false; } }
  function refocus() { var inp = document.getElementById('dIn'); if (inp && inp.focus && fine()) inp.focus(); }

  function feed(ch) {
    if (!active || !D || D.fixing || D.i >= D.toks.length) return;
    ch = String(ch).toLowerCase();
    if (!/^[a-z0-9]$/.test(ch)) return;
    var t = D.toks[D.i], tg = target(t);
    if (ch === tg[D.k]) {
      if (!D.t0) D.t0 = Date.now();
      D.keys++; D.k++;
      if (D.k >= tg.length) {
        D.i++; D.k = 0; skipAhead();
        if (D.i >= D.toks.length) return finish();
      }
      paint(false);
    } else {
      D.errs++;
      D.miss[t.c] = (D.miss[t.c] || 0) + 1;
      var p = document.getElementById('dPanel');
      if (p && p.classList) {
        p.classList.add('bad'); clearTimeout(flashT);
        flashT = setTimeout(function () { p.classList.remove('bad'); }, 250);
      }
      var st = document.getElementById('dStat'); if (st) st.textContent = statHtml();
    }
  }

  function finish() {
    active = false;
    var n = total(), ms = Math.max(1000, Date.now() - (D.t0 || Date.now()));
    var cpm = Math.round(n * 60000 / ms), acc = Math.round(100 * D.keys / Math.max(1, D.keys + D.errs));
    var o = opt(), best = o.hist.reduce(function (m, x) { return Math.max(m, x.cpm); }, 0);
    o.hist.push({ t: Date.now(), n: n, cpm: cpm, acc: acc });
    if (o.hist.length > 30) o.hist = o.hist.slice(-30);
    A.touchDay(); A.save();
    var miss = Object.keys(D.miss).sort(function (a, b) { return D.miss[b] - D.miss[a]; }).slice(0, 6);
    var jpOf = {}; D.toks.forEach(function (t) { if (typable(t)) jpOf[t.c] = t.jp; });
    var esc = A.esc;
    var h = '<div class="bar"><a href="#" class="lnk" data-act="pa" data-arg="drill|menu">← 跟打選單</a></div><div class="card">' +
      '<h2>🎉 打完成篇！</h2><p class="bigstars" style="font-size:1.6rem">' + cpm + ' 字／分鐘</p>' +
      '<p>' + n + ' 個字，用咗 ' + Math.round(ms / 1000) + ' 秒；按鍵準確率 ' + acc + '%（撳錯 ' + D.errs + ' 次）' +
      (cpm > best && o.hist.length > 1 ? '　🏆 新紀錄！' : '') + '</p>';
    if (miss.length) h += '<p>最多撳錯：' + miss.map(function (c) { return esc(c) + ' <code>' + esc(jpOf[c] || '') + '</code>（' + D.miss[c] + ' 次）'; }).join('、') + '</p>';
    h += '<div class="dart">' + D.toks.map(function (t) { return t.c === '\n' ? '<br>' : esc(t.c); }).join('') + '</div>';
    h += '<div class="row"><button class="primary" data-act="pa" data-arg="drill|rand|' + (D.n || 4) + '">再嚟一篇隨機</button>' +
      '<button data-act="pa" data-arg="drill|again">再打同一篇</button><button data-act="pa" data-arg="drill|menu">返選單</button></div></div>';
    A.view(h);
  }

  function act(a, g, api) {
    A = api;
    var o = opt();
    switch (a) {
      case 'menu': menu(); break;
      case 'tone': o.tone = !o.tone; A.save(); menu(); break;
      case 'rand': {
        var n = +g || 4;
        start(DD.article(SITE.util.mulberry(Math.floor(Math.random() * 1e9)), n));
        D.n = n; break;
      }
      case 'again': if (D) { var toks = D.toks, nn = D.n; start(toks); D.n = nn; } else menu(); break;
      case 'paste': {
        var ta = document.getElementById('dPaste'), txt = ta ? String(ta.value || '').trim() : '';
        if (!txt) { A.toast('未貼文章'); break; }
        o.last = txt.slice(0, 3000); A.save();
        var tk = DD.lookup(o.last, o.dict);
        if (!tk.some(function (t) { return !t.skip; })) { A.toast('入面冇中文字'); break; }
        D = { toks: tk };
        if (tk.some(function (t) { return !t.skip && !t.jp; })) unknownView(); else start(tk);
        break;
      }
      case 'fill': {
        var bad = [];
        (D.unknown || []).forEach(function (c, i) {
          var el = document.getElementById('u' + i), v = el ? String(el.value || '').trim().toLowerCase() : '';
          if (!v) return;
          if (/^[a-z]+[1-6]$/.test(v)) o.dict[c] = v; else bad.push(c);
        });
        if (bad.length) { A.toast('格式唔啱：' + bad.join('') + '（例如 si4）'); break; }
        A.save();
        start(DD.lookup(o.last || '', o.dict));
        break;
      }
      case 'skipUnknown': start(D.toks); break;
      case 'clearDict': o.dict = {}; A.save(); A.toast('已清除自己補嘅讀音'); menu(); break;
      case 'key': feed(g); refocus(); break;
      case 'skipChar':
        if (D && active) { D.i++; D.k = 0; skipAhead(); if (D.i >= D.toks.length) finish(); else paint(false); refocus(); }
        break;
      case 'fixOpen': if (D && active) { D.fixing = true; paint(false); } break;
      case 'fixCancel': if (D) { D.fixing = false; paint(false); refocus(); } break;
      case 'fixSave': {
        var f = document.getElementById('dFix'), v2 = f ? String(f.value || '').trim().toLowerCase() : '';
        if (!/^[a-z]+[1-6]$/.test(v2)) { A.toast('格式唔啱，例如 si4'); break; }
        var cur = D.toks[D.i];
        o.dict[cur.c] = v2; A.save();
        D.toks.forEach(function (t, j) { if (j >= D.i && t.c === cur.c) t.jp = v2; });
        D.fixing = false; D.k = 0;
        A.toast('已改：' + cur.c + ' ' + v2 + '（之後都會用）');
        paint(false); refocus();
        break;
      }
    }
  }

  // 電腦：焦點唔喺打字框都收到鍵（打字框有自己嘅 input 事件）
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('keydown', function (e) {
      if (!active || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      var tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key && e.key.length === 1 && /[a-z0-9]/i.test(e.key)) { e.preventDefault(); feed(e.key); }
    });
  }

  SITE.plugins = (SITE.plugins || []).concat([{
    id: ID, title: '⌨️ 跟打文章', desc: '逐個字顯示要撳嘅鍵，打完成篇',
    start: function (api) { A = api; menu(); },
    act: act,
    stop: function () { active = false; }
  }]);
})();
