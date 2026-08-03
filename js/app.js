/* 中文複習 — 應用邏輯（vanilla JS，無依賴，資料存 localStorage） */
(function () {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : this;
  var DATA = W.APP_DATA || {};
  ['idioms', 'slang', 'phonics', 'chars', 'reading', 'writing', 'custom',
   'english', 'math', 'science', 'social'].forEach(function (k) {
    if (!Array.isArray(DATA[k])) DATA[k] = [];
  });
  var SUBJECTS = W.APP_SUBJECTS || [{ key: 'chinese', name: '國語', icon: '📖', ready: true, desc: '' }];

  /* ---------- 純函式（node 測試用，經 window.PURE 匯出） ---------- */

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickOthers(pool, self, field, n) {
    // 從 pool 挑 n 個不同於 self 且 field 值不重複的干擾項
    var seen = {}; seen[self[field]] = true;
    var out = [];
    var cand = shuffle(pool);
    for (var i = 0; i < cand.length && out.length < n; i++) {
      var v = cand[i][field];
      if (cand[i].id !== self.id && v && !seen[v]) { seen[v] = true; out.push(cand[i]); }
    }
    return out;
  }

  function filterByGrade(pool, grade, cumulative) {
    return pool.filter(function (it) {
      return cumulative ? it.grade <= grade : it.grade === grade;
    });
  }

  // 多選年級（grades 為 1-12 的陣列）
  function filterByGrades(pool, grades) {
    return pool.filter(function (it) { return grades.indexOf(it.grade) >= 0; });
  }

  // 年級組合顯示：連續區間縮寫，如 [1,2,3,4] → 小一–小四
  function gradesLabel(grades) {
    if (!grades.length) return '未選年級';
    if (grades.length === 12) return '全部年級';
    var g = grades.slice().sort(function (a, b) { return a - b; });
    var parts = [], start = g[0], prev = g[0];
    for (var i = 1; i <= g.length; i++) {
      if (i < g.length && g[i] === prev + 1) { prev = g[i]; continue; }
      parts.push(start === prev ? gradeLabel(start) : gradeLabel(start) + '–' + gradeLabel(prev));
      if (i < g.length) { start = g[i]; prev = g[i]; }
    }
    return parts.join('、');
  }

  function gradeLabel(g) {
    var names = ['', '小一', '小二', '小三', '小四', '小五', '小六', '國一', '國二', '國三', '高一', '高二', '高三'];
    return names[g] || ('年級' + g);
  }

  // 其他選項的成語意思（Tony 2026-08-03：錯誤選項也要給解析）
  function otherIdiomsExp(others) {
    if (!others.length) return '';
    return '\n📖 其他選項：' + others.map(function (o) { return o.term + '＝' + o.meaning; }).join('；');
  }

  // 注音聲調名（一聲不標調號）
  function toneName(zy) {
    if (zy.indexOf('˙') >= 0) return '輕聲';
    var last = zy.charAt(zy.length - 1);
    return last === 'ˊ' ? '二聲' : last === 'ˇ' ? '三聲' : last === 'ˋ' ? '四聲' : '一聲';
  }

  // 成語注音比較：由 term+zhuyin 自動逐字產生（Tony 2026-08-03：成語解析要含注音比較）
  function idiomZyCompare(item) {
    if (!item.term || !item.zhuyin) return '';
    var chars = item.term.split('');
    var zys = item.zhuyin.split(' ');
    if (chars.length !== zys.length) return '';
    return '\n🔤 注音比較：\n' + chars.map(function (c, i) {
      return c + '：' + zys[i] + '（' + toneName(zys[i]) + '）';
    }).join('\n');
  }

  // 深度解析（存 item.deep，逐條人工撰寫）：
  // 成語＝典故與成語意思（注音比較自動生成，不含國字拆解）；字音/字形＝注音比較＋國字拆解與造字原因
  function deepExp(item) {
    var isIdiom = item.id && item.id.charAt(0) === 'i';
    var auto = isIdiom ? idiomZyCompare(item) : '';
    var deep = item.deep ? '\n📚 ' + (isIdiom ? '典故與成語意思' : '深度解析') + '：\n' + item.deep : '';
    return auto + deep;
  }

  function buildIdiomQ(item, pool) {
    // 兩種題型隨機：釋義選擇 / 例句克漏字
    var cloze = item.example && item.example.indexOf(item.term) >= 0 && Math.random() < 0.5;
    if (cloze) {
      var others = pickOthers(pool, item, 'term', 3);
      var opts = shuffle([item].concat(others));
      return {
        type: 'idioms', item: item,
        question: item.example.split(item.term).join('（　　　　）') + '\n括號中應填入哪個成語？',
        options: opts.map(function (o) { return o.term; }),
        correct: opts.indexOf(item),
        explain: item.term + '：' + item.meaning + (item.wordExp ? '\n🔍 逐字解析：' + item.wordExp : '') + (item.misuse ? '\n⚠️ ' + item.misuse : '') + otherIdiomsExp(others) + deepExp(item)
      };
    }
    var others2 = pickOthers(pool, item, 'meaning', 3);
    var opts2 = shuffle([item].concat(others2));
    return {
      type: 'idioms', item: item,
      question: '「' + item.term + '」的意思是？',
      options: opts2.map(function (o) { return o.meaning; }),
      correct: opts2.indexOf(item),
      explain: '例句：' + item.example + (item.wordExp ? '\n🔍 逐字解析：' + item.wordExp : '') + (item.misuse ? '\n⚠️ ' + item.misuse : '') + otherIdiomsExp(others2) + deepExp(item)
    };
  }

  function buildSlangQ(item, pool) {
    var others = pickOthers(pool, item, 'meaning', 3);
    var opts = shuffle([item].concat(others));
    return {
      type: 'slang', item: item,
      question: '「' + item.term + '」（' + item.kind + '）的意思是？',
      options: opts.map(function (o) { return o.meaning; }),
      correct: opts.indexOf(item),
      explain: '例句：' + item.example
    };
  }

  function buildPhonicsQ(item, pool, phon) {
    var z = phon === 'zhuyin';
    var correctTxt = z ? item.zhuyin : item.pinyin;
    var opts = [{ txt: correctTxt, ok: true }];
    (item.wrong || []).forEach(function (wr) {
      opts.push({ txt: z ? wr.z : wr.p, ok: false });
    });
    // 補一個別題的讀音當第 4 選項（避免與現有重複）
    var texts = opts.map(function (o) { return o.txt; });
    var extra = shuffle(pool).find(function (o) {
      var t = z ? o.zhuyin : o.pinyin;
      return o.id !== item.id && texts.indexOf(t) < 0;
    });
    if (extra) opts.push({ txt: z ? extra.zhuyin : extra.pinyin, ok: false });
    opts = shuffle(opts);
    var correct = -1;
    opts.forEach(function (o, i) { if (o.ok) correct = i; });
    var qWord = item.word.split(item.target).join('「' + item.target + '」');
    // 借來的第 4 選項標明出處，note 已涵蓋同字誤讀的正確用法
    var extraExp = extra ? '\n📖 選項「' + (z ? extra.zhuyin : extra.pinyin) + '」是「' + extra.word + '」的「' + extra.target + '」的讀音。' : '';
    return {
      type: 'phonics', item: item,
      question: qWord + ' — 「' + item.target + '」的讀音是？',
      options: opts.map(function (o) { return o.txt; }),
      correct: correct,
      explain: (item.note || '') + '\n正確讀音：' + item.zhuyin + '（' + item.pinyin + '）' + extraExp + deepExp(item)
    };
  }

  function buildCharsQ(item, pool, phon) {
    var reading = phon === 'zhuyin' ? item.zhuyin : item.pinyin;
    var opts = shuffle([item.answer].concat(item.wrong || []));
    return {
      type: 'chars', item: item,
      question: item.sentence + '\n括號中讀「' + reading + '」的字是？',
      options: opts,
      correct: opts.indexOf(item.answer),
      explain: (item.note || '') + '\n正確答案：' + item.answer + deepExp(item)
    };
  }

  function buildSynQ(item, pool) {
    // 同義成語題：從 syn 挑一個當正解，干擾項取庫內非同義成語
    var syn = (item.syn || []).slice();
    var ans = syn[Math.floor(Math.random() * syn.length)];
    var cand = pool.filter(function (o) { return syn.indexOf(o.term) < 0 && o.term !== ans; });
    var distractItems = pickOthers(cand, item, 'term', 3);
    var opts = shuffle([ans].concat(distractItems.map(function (o) { return o.term; })));
    return {
      type: 'idioms', item: item,
      question: '下列哪個成語與「' + item.term + '」意義最接近？',
      options: opts,
      correct: opts.indexOf(ans),
      explain: item.term + '：' + item.meaning + '\n同義成語：' + syn.join('、') + otherIdiomsExp(distractItems) + deepExp(item)
    };
  }

  function buildReadingQ(item, qi) {
    var q = item.questions[qi];
    return {
      type: 'reading', item: item, qi: qi,
      passage: (item.title ? '《' + item.title + '》\n' : '') + item.passage,
      question: '（' + (qi + 1) + '/' + item.questions.length + '）' + q.q,
      options: q.options.slice(),
      correct: q.answer,
      explain: q.exp
    };
  }

  function buildCustomQ(item) {
    var scope = [item.book, item.lesson].filter(Boolean).join(' ');
    var tag = scope || item.tag;
    return {
      type: 'custom', item: item,
      question: (tag ? '【' + tag + '】' : '') + item.q,
      options: item.options.slice(),
      correct: item.answer,
      explain: (item.exp || '') + '\n正確答案：' + item.options[item.answer]
    };
  }

  // 自創題庫分冊分課：冊→[課]，沒標 book 的歸「未分類」
  function customBooks(pool) {
    var books = [], seen = {};
    pool.forEach(function (it) {
      var b = it.book || '未分類';
      if (!seen[b]) { seen[b] = { book: b, lessons: [], ls: {} }; books.push(seen[b]); }
      var l = it.lesson || '未分課';
      if (!seen[b].ls[l]) { seen[b].ls[l] = true; seen[b].lessons.push(l); }
    });
    return books;
  }

  function customPool(pool, book, lesson) {
    return pool.filter(function (it) {
      if (book && (it.book || '未分類') !== book) return false;
      if (lesson && (it.lesson || '未分課') !== lesson) return false;
      return true;
    });
  }

  // 以字串種子產生決定性亂數（每日練習：同一天同年級 → 同一組題）
  function rngFromString(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      var t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededPick(pool, n, rng) {
    var a = pool.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, n);
  }

  // 每日練習組卷：回傳 entry 清單 [{t, id, syn?, qi?}]，同一種子必產出同一組。
  // counts 可覆寫各類題數（弱點加權用），預設共 22 題 + 1 篇閱讀題組（2-3 題）≈ 25 題。
  function composeDaily(data, grades, seed, counts) {
    var c = counts || {};
    var n = {
      idioms: c.idioms != null ? c.idioms : 6,
      slang: c.slang != null ? c.slang : 4,
      phonics: c.phonics != null ? c.phonics : 6,
      chars: c.chars != null ? c.chars : 6
    };
    var rng = rngFromString(seed);
    var entries = [];
    function poolOf(cat) { return filterByGrades(data[cat] || [], grades); }
    seededPick(poolOf('idioms'), n.idioms, rng).forEach(function (it, i) {
      // 前兩題若有同義詞資料就出同義題
      entries.push({ t: 'idioms', id: it.id, syn: i < 2 && (it.syn || []).length > 0 });
    });
    seededPick(poolOf('slang'), n.slang, rng).forEach(function (it) { entries.push({ t: 'slang', id: it.id }); });
    seededPick(poolOf('phonics'), n.phonics, rng).forEach(function (it) { entries.push({ t: 'phonics', id: it.id }); });
    seededPick(poolOf('chars'), n.chars, rng).forEach(function (it) { entries.push({ t: 'chars', id: it.id }); });
    var reads = seededPick(poolOf('reading'), 1, rng);
    reads.forEach(function (r) {
      for (var qi = 0; qi < r.questions.length; qi++) entries.push({ t: 'reading', id: r.id, qi: qi });
    });
    return entries;
  }

  // 單元學習：把單一年級的題庫依 id 序切成單元（4成語+2俚語+4字音+4字形≈14 條），
  // 尾端不足 6 條就併入前一單元。決定性切法：同年級永遠切出同樣的單元。
  function buildUnits(data, grade, take) {
    var cats = ['idioms', 'slang', 'phonics', 'chars'];
    take = take || { idioms: 4, slang: 2, phonics: 4, chars: 4 };
    var qs = {}, idx = {};
    cats.forEach(function (c) { qs[c] = filterByGrades(data[c] || [], [grade]); idx[c] = 0; });
    var units = [];
    while (true) {
      var u = [];
      cats.forEach(function (c) {
        for (var i = 0; i < take[c] && idx[c] < qs[c].length; i++) u.push({ t: c, id: qs[c][idx[c]++].id });
      });
      if (!u.length) break;
      if (u.length < 6 && units.length) units[units.length - 1] = units[units.length - 1].concat(u);
      else units.push(u);
    }
    return units;
  }

  // 弱點分析：由累計統計找出正確率最低與最高的類別（各類至少答過 10 題才納入）
  function weakStrong(stats) {
    var cats = ['idioms', 'slang', 'phonics', 'chars'];
    var rated = cats.map(function (c) {
      var s = stats[c] || { n: 0, ok: 0 };
      return { cat: c, n: s.n, rate: s.n ? s.ok / s.n : null };
    }).filter(function (r) { return r.n >= 10; });
    if (rated.length < 2) return null;
    rated.sort(function (a, b) { return a.rate - b.rate; });
    if (rated[rated.length - 1].rate - rated[0].rate < 0.1) return null; // 差距小就不加權
    return { weak: rated[0].cat, strong: rated[rated.length - 1].cat, weakRate: rated[0].rate };
  }

  // 錯題間隔重考：答對升級（1→3→7 天），三級後畢業；答錯回到隔天重考
  function bumpWrongSchedule(w, ok, todayStr) {
    var days = [1, 3, 7];
    if (!ok) { w.box = 1; w.due = nextDueDays(todayStr, 1); return 'reset'; }
    var box = (w.box || 1) + 1;
    if (box > 3) return 'graduate';
    w.box = box;
    w.due = nextDueDays(todayStr, days[box - 1]);
    return 'up';
  }

  function nextDueDays(todayStr, days) {
    var d = new Date(todayStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  }

  // 一律用本地日期（toISOString 是 UTC，台灣早上 8 點前會差一天）
  function fmtDate(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function nextDue(box, today) {
    var days = box >= 3 ? 5 : (box === 2 ? 2 : 1);
    var d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return fmtDate(d);
  }

  // 由每日紀錄計算連續完成天數（today 為 YYYY-MM-DD）
  function dailyStreak(daily, todayStr) {
    var n = 0;
    var d = new Date(todayStr + 'T00:00:00');
    if (!daily[todayStr] || !daily[todayStr].done) d.setDate(d.getDate() - 1); // 今天還沒做，從昨天往回數
    while (true) {
      var key = fmtDate(d);
      if (daily[key] && daily[key].done) { n++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return n;
  }

  W.PURE = {
    shuffle: shuffle, pickOthers: pickOthers, filterByGrade: filterByGrade,
    filterByGrades: filterByGrades, gradesLabel: gradesLabel,
    buildIdiomQ: buildIdiomQ, buildSlangQ: buildSlangQ,
    buildPhonicsQ: buildPhonicsQ, buildCharsQ: buildCharsQ,
    buildSynQ: buildSynQ, buildReadingQ: buildReadingQ, buildCustomQ: buildCustomQ,
    rngFromString: rngFromString, seededPick: seededPick, composeDaily: composeDaily,
    weakStrong: weakStrong, bumpWrongSchedule: bumpWrongSchedule, buildUnits: buildUnits,
    dailyStreak: dailyStreak, customBooks: customBooks, customPool: customPool,
    nextDue: nextDue, gradeLabel: gradeLabel
  };

  if (typeof document === 'undefined') return; // node 測試環境到此為止

  /* ---------- 狀態 ---------- */

  var LS_KEY = 'chinese-review-v1';
  var state = load();
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) {}
    if (!s || typeof s !== 'object') {
      s = {
        phon: 'zhuyin', grades: [1, 2, 3, 4, 5],
        stats: {}, streak: { last: '', days: 0 }, wrong: [], leitner: {}
      };
    }
    // 舊版單選年級 → 多選遷移
    if (!Array.isArray(s.grades) || !s.grades.length) {
      var g = s.grade || 5;
      s.grades = [];
      if (s.cumulative === false) s.grades = [g];
      else for (var i = 1; i <= g; i++) s.grades.push(i);
    }
    // 錯題排程遷移
    (s.wrong || []).forEach(function (w) {
      if (!w.box) { w.box = 1; w.due = w.due || fmtDate(new Date()); }
    });
    return s;
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  function today() { return fmtDate(new Date()); }

  function bumpStat(cat, ok) {
    if (!state.stats[cat]) state.stats[cat] = { n: 0, ok: 0 };
    state.stats[cat].n++;
    if (ok) state.stats[cat].ok++;
    var t = today();
    if (state.streak.last !== t) {
      var y = new Date(); y.setDate(y.getDate() - 1);
      state.streak.days = (state.streak.last === fmtDate(y)) ? state.streak.days + 1 : 1;
      state.streak.last = t;
    }
    save();
  }

  function addWrong(type, id) {
    var hit = state.wrong.find(function (w) { return w.t === type && w.id === id; });
    if (hit) { hit.n++; hit.ok = 0; hit.lastWrong = Date.now(); hit.due = nextDueDays(today(), 1); }
    else state.wrong.push({ t: type, id: id, n: 1, ok: 0, added: Date.now(), lastWrong: Date.now(), due: nextDueDays(today(), 1) });
    if ((type === 'idioms' || type === 'slang') && !state.leitner[id]) {
      state.leitner[id] = { box: 1, due: today() };
    }
    save();
  }

  // 錯題保留制（Tony 2026-08-02 定案）：答對只記連對次數並延後複習日，不自動移除，由家長/學生手動刪
  function touchWrongOnCorrect(t, id) {
    var w = state.wrong.find(function (x) { return x.t === t && x.id === id; });
    if (!w) return;
    w.ok = (w.ok || 0) + 1;
    var days = [3, 7, 14][Math.min(w.ok - 1, 2)];
    w.due = nextDueDays(today(), days);
    save();
  }

  function deleteWrong(keys) { // keys: ['t:id', ...]
    var set = {};
    keys.forEach(function (k) { set[k] = true; });
    state.wrong = state.wrong.filter(function (x) { return !set[x.t + ':' + x.id]; });
    save();
  }

  function labelOf(t, id) {
    var it = findItem(t, id);
    if (!it) return id;
    if (t === 'custom') return (it.q || '').slice(0, 18) + '…';
    return it.term || (it.word ? it.word : it.answer || it.title || id);
  }

  function findItem(type, id) {
    return (DATA[type] || []).find(function (it) { return it.id === id; });
  }

  /* ---------- 視圖切換 ---------- */

  var views = ['subject', 'home', 'quiz', 'write', 'flash', 'wrongbook', 'progress', 'writing', 'units', 'lesson', 'drill', 'custom'];
  function show(name) {
    views.forEach(function (v) {
      document.getElementById('view-' + v).classList.toggle('hidden', v !== name);
    });
    if (name === 'home') renderHome();
    if (name === 'subject') renderSubjects();
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- 首頁 ---------- */

  function pool(cat) { return filterByGrades(DATA[cat], state.grades); }

  function subjectOf(key) {
    return SUBJECTS.find(function (s) { return s.key === key; }) || SUBJECTS[0];
  }

  // 科目選擇頁
  function renderSubjects() {
    var box = $('subjectCards');
    box.innerHTML = '';
    SUBJECTS.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'card' + (state.subject === s.key ? ' daily-done' : '');
      var bank = s.key === 'chinese' ? null : DATA[s.key];
      var sub = s.key === 'chinese' ? s.desc : (bank && bank.length ? bank.length + ' 題' : s.desc);
      b.innerHTML = '<span class="card-icon">' + s.icon + '</span><span class="card-title">' + s.name + '</span>' +
        '<span class="card-sub">' + sub + '</span>';
      b.addEventListener('click', function () {
        state.subject = s.key;
        save();
        show('home');
      });
      box.appendChild(b);
    });
  }

  function renderHome() {
    var subj = subjectOf(state.subject);
    $('subjectBtn').textContent = subj.icon + ' ' + subj.name + ' ▾';
    var cards = document.querySelector('#view-home .cards');
    var ph = $('homePlaceholder');
    var isChinese = subj.key === 'chinese';
    cards.classList.toggle('hidden', !isChinese);
    $('phonToggle').classList.toggle('hidden', !isChinese);
    if (!isChinese) {
      var bank = DATA[subj.key] || [];
      ph.classList.remove('hidden');
      ph.innerHTML = subj.icon + ' ' + subj.name + '科' +
        (bank.length ? '共 ' + bank.length + ' 題' : '題庫建置中') +
        '<br><small>' + (bank.length ? '' : '架構已就緒——把題庫（Word 檔等）傳到 Telegram，轉檔後就能在這裡練習。') + '</small>';
      if (bank.length) {
        var go = document.createElement('button');
        go.className = 'btn-primary';
        go.textContent = '開始練習';
        go.addEventListener('click', function () { startSubjectQuiz(subj.key); });
        ph.appendChild(go);
      }
      renderGradeBtn();
      return;
    }
    ph.classList.add('hidden');
    $('cnt-idioms').textContent = pool('idioms').length + ' 題可練';
    $('cnt-slang').textContent = pool('slang').length + ' 題可練';
    $('cnt-phonics').textContent = pool('phonics').length + ' 題可練';
    $('cnt-chars').textContent = pool('chars').length + ' 題可練';
    $('cnt-reading').textContent = pool('reading').length + ' 篇可練';
    var rec = (state.daily || {})[today()];
    var dCard = document.querySelector('.card[data-go="daily"]');
    $('cnt-daily').textContent = rec && rec.done ? '今天完成了 ✅' : '今天還沒做';
    if (dCard) dCard.classList.toggle('daily-done', !!(rec && rec.done));
    var due = dueCards().length;
    $('cnt-flash').textContent = due ? due + ' 張到期' : '間隔複習';
    $('cnt-wrong').textContent = state.wrong.length + ' 題待複習';
    var ds = dailyStreak(state.daily || {}, today());
    $('cnt-streak').textContent = ds ? '每日練習連續 ' + ds + ' 天' : '開始累積吧';
    var dueN = state.wrong.filter(function (w) { return (w.due || '') <= today(); }).length;
    if (dueN) $('cnt-wrong').textContent = state.wrong.length + ' 題待複習 · ' + dueN + ' 題到期';
    $('cnt-writing').textContent = '每日一句 · 仿寫';
    var uDone = Object.keys(state.units || {}).length;
    $('cnt-units').textContent = uDone ? '已完成 ' + uDone + ' 個單元' : '先教後考 · 逐關解鎖';
    $('cnt-drill').textContent = '照順序一題不漏';
    $('cnt-custom').textContent = DATA.custom.length ? DATA.custom.length + ' 題' : '傳 Word 檔給我建題';
    $('phonToggle').textContent = state.phon === 'zhuyin' ? '注音' : '拼音';
    renderGradeBtn();
  }

  // 年級多選面板
  function renderGradeBtn() { $('gradeBtn').textContent = gradesLabel(state.grades) + ' ▾'; }
  (function initGradePanel() {
    var panel = $('gradePanel');
    var quick = [['全部', 1, 12], ['國小', 1, 6], ['國中', 7, 9], ['高中', 10, 12]];
    var qrow = document.createElement('div');
    qrow.className = 'gp-quick';
    quick.forEach(function (q) {
      var b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = q[0];
      b.addEventListener('click', function () {
        state.grades = [];
        for (var i = q[1]; i <= q[2]; i++) state.grades.push(i);
        save(); syncChecks(); renderHome();
      });
      qrow.appendChild(b);
    });
    panel.appendChild(qrow);
    var grid = document.createElement('div');
    grid.className = 'gp-grid';
    var boxes = [];
    for (var g = 1; g <= 12; g++) {
      (function (g) {
        var lab = document.createElement('label');
        var cb = document.createElement('input');
        cb.type = 'checkbox'; cb.value = g;
        cb.addEventListener('change', function () {
          var set = state.grades.filter(function (x) { return x !== g; });
          if (cb.checked) set.push(g);
          if (!set.length) { cb.checked = true; return; } // 至少留一個
          state.grades = set.sort(function (a, b) { return a - b; });
          save(); renderHome();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(gradeLabel(g)));
        grid.appendChild(lab);
        boxes.push(cb);
      })(g);
    }
    panel.appendChild(grid);
    function syncChecks() {
      boxes.forEach(function (cb) { cb.checked = state.grades.indexOf(parseInt(cb.value, 10)) >= 0; });
    }
    syncChecks();
    $('gradeBtn').addEventListener('click', function (e) {
      e.stopPropagation();
      syncChecks();
      panel.classList.toggle('hidden');
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { panel.classList.add('hidden'); });
  })();

  $('phonToggle').addEventListener('click', function () {
    state.phon = state.phon === 'zhuyin' ? 'pinyin' : 'zhuyin';
    save(); renderHome();
  });
  $('homeLink').addEventListener('click', function () { show('home'); });
  $('subjectBtn').addEventListener('click', function () { show('subject'); });

  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('click', function () {
      var go = c.getAttribute('data-go');
      if (go === 'idioms' || go === 'slang' || go === 'phonics' || go === 'chars') startQuiz(go, null);
      else if (go === 'daily') startDaily();
      else if (go === 'reading') startReading();
      else if (go === 'writing') showWriting();
      else if (go === 'units') showUnits();
      else if (go === 'drill') showDrill();
      else if (go === 'custom') showCustom();
      else if (go === 'write') startWrite();
      else if (go === 'flash') startFlash();
      else if (go === 'wrongbook') showWrongbook();
      else if (go === 'progress') showProgress();
    });
  });

  /* ---------- 選擇題測驗（一般／閱讀／每日練習共用引擎） ---------- */

  var quiz = null; // {entries, i, score, mode, round, firstTry, wrongNow, startedAt, combo}
  var CAT_NAME = {
    idioms: '成語', slang: '俚語諺語', phonics: '字音辨正', chars: '字形辨正', reading: '閱讀測驗', custom: '自創題庫',
    english: '英文', math: '數學', science: '自然', social: '社會'
  };
  var SUBJECT_CATS = ['english', 'math', 'science', 'social'];

  function buildQ(type, item, p) {
    if (type === 'idioms') return buildIdiomQ(item, p);
    if (type === 'slang') return buildSlangQ(item, p);
    if (type === 'phonics') return buildPhonicsQ(item, p, state.phon);
    return buildCharsQ(item, p, state.phon);
  }

  function quizCatOf(item) {
    var c = item.id.charAt(0);
    return c === 'i' ? 'idioms' : c === 's' ? 'slang' : c === 'p' ? 'phonics' : c === 'r' ? 'reading' :
      c === 'x' ? 'custom' : c === 'e' ? 'english' : c === 'm' ? 'math' : c === 'n' ? 'science' : c === 'o' ? 'social' : 'chars';
  }

  function entryKey(e) { return e.t + ':' + e.id + (e.qi != null ? '#' + e.qi : '') + (e.syn ? ':syn' : ''); }

  function buildEntryQ(e) {
    var it = findItem(e.t, e.id);
    if (!it) return null;
    if (e.t === 'custom' || SUBJECT_CATS.indexOf(e.t) >= 0) {
      var q = buildCustomQ(it);
      q.type = e.t;
      return q;
    }
    if (e.t === 'reading') return buildReadingQ(it, e.qi);
    if (e.syn && (it.syn || []).length) return buildSynQ(it, DATA.idioms);
    return buildQ(e.t, it, DATA[e.t]);
  }

  // 非國語科目的練習（schema 同 custom）
  function startSubjectQuiz(key) {
    var p = filterByGrades(DATA[key], state.grades);
    if (!p.length) p = DATA[key];
    if (!p.length) { alert('這科還沒有題目。'); return; }
    var entries = shuffle(p).slice(0, 10).map(function (it) { return { t: key, id: it.id }; });
    beginQuiz(entries, 'normal', key);
  }

  function itemsToEntries(items) {
    return items.map(function (it) { return { t: it._t || quizCatOf(it), id: it.id }; });
  }

  function startQuiz(cat, itemsOverride) {
    var items = itemsOverride || shuffle(pool(cat)).slice(0, 10);
    if (!items.length) { alert('這個年級目前沒有題目，換個年級或勾選「含以下年級」。'); return; }
    beginQuiz(itemsToEntries(items), itemsOverride ? 'retry' : 'normal', cat);
  }

  function startReading() {
    // 挑 2 篇文章，展開全部子題
    var picks = shuffle(pool('reading')).slice(0, 2);
    if (!picks.length) { alert('這個年級目前沒有閱讀題，換個年級或勾選「含以下年級」。'); return; }
    var entries = [];
    picks.forEach(function (r) {
      for (var qi = 0; qi < r.questions.length; qi++) entries.push({ t: 'reading', id: r.id, qi: qi });
    });
    beginQuiz(entries, 'normal', 'reading');
  }

  function beginQuiz(entries, mode, cat) {
    quiz = {
      entries: entries, i: 0, score: 0, mode: mode, cat: cat,
      round: 1, firstTry: {}, wrongNow: [], startedAt: Date.now(), combo: 0, best: 0,
      snaps: [], view: null // 已出過的題目快照（供「上一題」回顧）
    };
    $('quizResult').classList.add('hidden');
    document.querySelector('#view-quiz .quiz-card').classList.remove('hidden');
    show('quiz');
    renderQ();
  }

  function renderQ() {
    var e = quiz.entries[quiz.i];
    var q = buildEntryQ(e);
    if (!q) { quiz.i++; if (quiz.i < quiz.entries.length) return renderQ(); return finishRound(); }
    quiz.snaps.push({ q: q, e: e, no: quiz.i + 1, round: quiz.round, answered: null });
    paintSnap(quiz.snaps.length - 1);
  }

  // 畫出第 k 個快照；k < 最新 ⇒ 回顧模式（唯讀）
  function paintSnap(k) {
    var snap = quiz.snaps[k];
    var q = snap.q, e = snap.e;
    var latest = k === quiz.snaps.length - 1;
    quiz.view = k;
    quiz.cur = q; quiz.curEntry = e;
    $('quizProgress').textContent = latest
      ? snap.no + ' / ' + quiz.entries.length + (quiz.mode === 'daily' && quiz.round > 1 ? ' · 第' + quiz.round + '輪' : '')
      : '🔎 回顧 第' + snap.no + '題';
    $('quizScore').textContent = quiz.mode === 'daily' ? '' : '得分 ' + quiz.score;
    $('quizBar').style.width = Math.round(100 * (snap.no - 1) / quiz.entries.length) + '%';
    $('quizTag').textContent = (quiz.mode === 'daily' ? '📅 每日練習 · ' : '') +
      (e.rev ? '🔁 錯題複習 · ' : '') +
      CAT_NAME[q.type] + (q.item.grade ? ' · ' + gradeLabel(q.item.grade) : '');
    var pas = $('quizPassage');
    if (q.passage) { pas.textContent = q.passage; pas.classList.remove('hidden'); }
    else pas.classList.add('hidden');
    $('quizQuestion').textContent = q.question;
    var box = $('quizOptions');
    box.innerHTML = '';
    q.options.forEach(function (opt, idx) {
      var b = document.createElement('button');
      b.className = 'q-opt';
      b.textContent = opt;
      if (snap.answered) {
        b.disabled = true;
        if (idx === q.correct) b.classList.add('correct');
        if (!snap.answered.ok && idx === snap.answered.idx) b.classList.add('wrongpick');
      } else {
        b.addEventListener('click', function () { answer(idx, b); });
      }
      box.appendChild(b);
    });
    var fb = $('quizFeedback');
    if (snap.answered) {
      fb.textContent = (snap.answered.ok ? '✓ 答對了！' : '✗ 答錯了。（已自動加入錯題本安排複習）') + '\n' + q.explain;
      fb.className = 'q-feedback ' + (snap.answered.ok ? 'good' : 'bad');
      fb.classList.remove('hidden');
      maybeImg(fb, q.type, q.item.id);
      $('quizNext').textContent = latest ? '下一題' : '返回 →';
      $('quizNext').classList.remove('hidden');
    } else {
      fb.classList.add('hidden');
      $('quizNext').classList.add('hidden');
    }
    // 用猜的按鈕：只在「最新一題、已答且答對」時顯示（規則：答錯自動進錯題本，不需此鈕）
    var gBtn = $('quizGuess');
    if (latest && snap.answered && snap.answered.ok && q.type !== 'reading') {
      gBtn.textContent = '🤔 這題用猜的（加入複習）';
      gBtn.disabled = false;
      gBtn.classList.remove('hidden');
      gBtn.onclick = function () {
        addWrong(q.type, q.item.id);
        gBtn.textContent = '✓ 已加入錯題本';
        gBtn.disabled = true;
      };
    } else gBtn.classList.add('hidden');
    $('quizPrev').classList.toggle('hidden', k === 0);
  }

  function maybeImg(container, type, id) {
    if (type !== 'idioms') return;
    var img = document.createElement('img');
    img.className = 'q-img';
    img.alt = '';
    img.src = 'img/idioms/' + id + '.webp';
    img.onerror = function () { img.remove(); };
    container.appendChild(img);
  }

  function answer(idx, btn) {
    var q = quiz.cur, e = quiz.curEntry;
    var opts = document.querySelectorAll('#quizOptions .q-opt');
    opts.forEach(function (o) { o.disabled = true; });
    var ok = idx === q.correct;
    var snap = quiz.snaps[quiz.snaps.length - 1];
    if (snap) snap.answered = { idx: idx, ok: ok };
    // 規則：答對才顯示「用猜的」按鈕（答錯已自動進錯題本）；一律先處理按鈕，避免後續流程影響
    var gBtn = $('quizGuess');
    if (ok && q.type !== 'reading') {
      gBtn.textContent = '🤔 這題用猜的（加入複習）';
      gBtn.disabled = false;
      gBtn.classList.remove('hidden');
      gBtn.onclick = function () {
        addWrong(q.type, q.item.id);
        gBtn.textContent = '✓ 已加入錯題本';
        gBtn.disabled = true;
      };
    } else gBtn.classList.add('hidden');
    if (opts[q.correct]) opts[q.correct].classList.add('correct');
    if (!ok) btn.classList.add('wrongpick');
    if (ok) quiz.score++;
    // 連對計數
    quiz.combo = ok ? quiz.combo + 1 : 0;
    if (quiz.combo > quiz.best) quiz.best = quiz.combo;
    $('quizCombo').textContent = quiz.combo >= 3 ? '🔥' + quiz.combo : '';
    // 每日練習：只記第一次遇到這題的結果
    var k = entryKey(e);
    var firstEncounter = quiz.firstTry[k] === undefined;
    if (firstEncounter) quiz.firstTry[k] = ok;
    if (firstEncounter && quiz.mode === 'drill') {
      state.drillPos = state.drillPos || {};
      state.drillPos[quiz.drillKey] = quiz.drillBase + quiz.i + 1;
      save();
    }
    // 答對：更新錯題本連對紀錄（保留制，不自動移除）
    if (ok && q.type !== 'reading') touchWrongOnCorrect(q.type, q.item.id);
    if (!ok) quiz.wrongNow.push(e);
    bumpStat(q.type, ok);
    if (!ok && q.type !== 'reading' && quiz.round === 1) addWrong(q.type, q.item.id);
    var fb = $('quizFeedback');
    fb.textContent = (ok ? '✓ 答對了！' : '✗ 答錯了。（已自動加入錯題本安排複習）') + '\n' + q.explain;
    fb.className = 'q-feedback ' + (ok ? 'good' : 'bad');
    fb.classList.remove('hidden');
    maybeImg(fb, q.type, q.item.id);
    $('quizNext').textContent = '下一題';
    $('quizNext').classList.remove('hidden');
    if (quiz.mode !== 'daily') $('quizScore').textContent = '得分 ' + quiz.score;
  }

  function finishRound() {
    if (quiz.mode === 'daily' || quiz.mode === 'unit') {
      if (quiz.wrongNow.length) {
        // 精熟迴圈：錯的題目下一輪重做，直到全對
        var again = shuffle(quiz.wrongNow);
        quiz.wrongNow = [];
        quiz.entries = again;
        quiz.i = 0;
        quiz.round++;
        var fb = $('quizFeedback');
        renderQ();
        setStatusToast('還有 ' + again.length + ' 題沒答對，再來一輪 💪');
        return;
      }
      if (quiz.mode === 'unit') completeUnit(); else completeDaily();
      return;
    }
    document.querySelector('#view-quiz .quiz-card').classList.add('hidden');
    var r = $('quizResult');
    r.innerHTML = '本回合結束<br><b style="font-size:1.6rem">' + quiz.score + ' / ' + quiz.entries.length +
      '</b>' + (quiz.best >= 3 ? '<br>最長連對 🔥' + quiz.best : '') +
      '<br>' + (quiz.score === quiz.entries.length ? '全對，太強了 🎉' : '答錯的題目已加入錯題本') +
      '<br><button class="btn-primary" id="quizAgain">再來一回合</button>';
    r.classList.remove('hidden');
    if (quiz.score === quiz.entries.length) confetti();
    var cat = quiz.cat, retry = quiz.mode === 'retry', drill = quiz.mode === 'drill';
    if (drill) {
      var done = Math.min(quiz.drillBase + quiz.entries.length, quiz.drillTotal);
      var finished = done >= quiz.drillTotal;
      $('quizAgain').textContent = finished ? '回列表' : '繼續刷下一批 →';
      var prog = document.createElement('div');
      prog.textContent = finished
        ? '🎉 「' + (quiz.drillDesc || CAT_NAME[cat]) + '」的題目已完整刷完一輪！（共 ' + quiz.drillTotal + ' 題）'
        : (quiz.drillDesc || CAT_NAME[cat]) + ' 進度：' + done + ' / ' + quiz.drillTotal;
      $('quizResult').insertBefore(prog, $('quizAgain'));
      if (finished) setStatusToast('🎉 這一類題目做完一輪了！');
    }
    var dBook = quiz.drillBook, dLesson = quiz.drillLesson, dKey = quiz.drillKey;
    $('quizAgain').addEventListener('click', function () {
      if (retry) showWrongbook();
      else if (drill) {
        if ((state.drillPos[dKey] || 0) >= quiz.drillTotal) { if (cat === 'custom') showCustom(); else showDrill(); }
        else startDrill(cat, dBook, dLesson);
      }
      else if (cat === 'reading') startReading();
      else if (SUBJECT_CATS.indexOf(cat) >= 0) startSubjectQuiz(cat);
      else startQuiz(cat, null);
    });
  }

  $('quizNext').addEventListener('click', function () {
    // 回顧模式：往前走回最新一題
    if (quiz.view != null && quiz.view < quiz.snaps.length - 1) { paintSnap(quiz.view + 1); return; }
    quiz.i++;
    if (quiz.i >= quiz.entries.length) finishRound();
    else renderQ();
  });
  $('quizPrev').addEventListener('click', function () {
    var k = (quiz.view == null ? quiz.snaps.length - 1 : quiz.view) - 1;
    if (k >= 0) paintSnap(k);
  });
  $('quizExit').addEventListener('click', function () {
    if (quiz && quiz.mode === 'daily' && !((state.daily || {})[today()] || {}).done) {
      if (!confirm('今日練習還沒完成，確定要離開？（進度不會保留）')) return;
    }
    show('home');
  });

  /* ---------- 每日練習 ---------- */

  function dailyRec() { return (state.daily = state.daily || {})[today()]; }

  function startDaily() {
    var rec = dailyRec();
    if (rec && rec.done) { showDailySummary(rec); return; }
    // 弱點加權：正確率最低的類別 +2 題、最高的 -2 題
    var ws = weakStrong(state.stats);
    var counts = { idioms: 6, slang: 4, phonics: 6, chars: 6 };
    if (ws) {
      counts[ws.weak] += 2;
      if (counts[ws.strong] > 3) counts[ws.strong] -= 2;
    }
    var entries = composeDaily(DATA, state.grades, today() + '|' + state.grades.join(','), counts);
    if (entries.length < 5) { alert('所選年級題目不足，請多勾幾個年級。'); return; }
    // 錯題到期複習：最多 3 題混入今日練習
    var t = today();
    state.wrong.filter(function (w) { return (w.due || t) <= t; }).slice(0, 3)
      .forEach(function (w) { entries.push({ t: w.t, id: w.id, rev: true }); });
    beginQuiz(entries, 'daily', null);
    quiz.total = entries.length;
    quiz.weakBoost = ws ? ws.weak : null;
  }

  function completeDaily() {
    var firstOk = 0, total = 0, wrongList = [];
    Object.keys(quiz.firstTry).forEach(function (k) {
      total++;
      if (quiz.firstTry[k]) firstOk++;
      else {
        var parts = k.split(':');
        wrongList.push({ t: parts[0], id: parts[1].split('#')[0] });
      }
    });
    var ms = Date.now() - quiz.startedAt;
    state.daily[today()] = {
      done: true, grade: state.grades[state.grades.length - 1], gradesTxt: gradesLabel(state.grades),
      total: total, firstOk: firstOk, rounds: quiz.round,
      ms: ms, finishedAt: Date.now(), wrong: wrongList
    };
    save();
    document.querySelector('#view-quiz .quiz-card').classList.add('hidden');
    var mins = Math.max(1, Math.round(ms / 60000));
    var streak = dailyStreak(state.daily, today());
    var r = $('quizResult');
    r.innerHTML = '🎉 今日練習完成！<br>' +
      '<b style="font-size:1.6rem">' + firstOk + ' / ' + total + '</b><small> 第一次就答對</small><br>' +
      (quiz.round > 1 ? '錯題重做 ' + (quiz.round - 1) + ' 輪後全部答對<br>' : '一輪全對，超強！<br>') +
      '用時約 ' + mins + ' 分鐘 · 連續完成 ' + streak + ' 天🔥<br>' +
      '<small>家長可在「學習進度」查看每日紀錄</small><br>' +
      '<button class="btn-primary" id="quizAgain">回首頁</button>';
    r.classList.remove('hidden');
    confetti();
    $('quizAgain').addEventListener('click', function () { show('home'); });
  }

  function showDailySummary(rec) {
    show('quiz');
    document.querySelector('#view-quiz .quiz-card').classList.add('hidden');
    var r = $('quizResult');
    var mins = Math.max(1, Math.round(rec.ms / 60000));
    r.innerHTML = '✅ 今天已完成每日練習<br>' +
      '<b style="font-size:1.6rem">' + rec.firstOk + ' / ' + rec.total + '</b><small> 第一次就答對</small><br>' +
      '重做 ' + (rec.rounds - 1) + ' 輪 · 用時約 ' + mins + ' 分鐘<br>' +
      '<button class="btn-primary" id="quizAgain">再練一回（不列入紀錄）</button> ' +
      '<button class="btn-ghost" id="quizHome">回首頁</button>';
    r.classList.remove('hidden');
    $('quizAgain').addEventListener('click', function () {
      var items = shuffle(pool('idioms').concat(pool('phonics')).concat(pool('chars'))).slice(0, 10);
      startQuiz('mixed', items);
    });
    $('quizHome').addEventListener('click', function () { show('home'); });
  }

  /* ---------- 小工具：吐司與彩帶 ---------- */

  var toastTimer = null;
  function setStatusToast(msg) {
    var t = $('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  function confetti() {
    var colors = ['#5b8def', '#3fb46f', '#e0a13f', '#e05555', '#a06fe0'];
    for (var i = 0; i < 36; i++) {
      var p = document.createElement('div');
      p.className = 'confetti';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.8) + 's';
      p.style.animationDuration = (1.8 + Math.random() * 1.4) + 's';
      document.body.appendChild(p);
      (function (el) { setTimeout(function () { el.remove(); }, 3800); })(p);
    }
  }

  /* ---------- 手寫練習（看注音寫國字） ---------- */

  var wr = null;
  function startWrite() {
    var items = shuffle(pool('chars')).slice(0, 10);
    if (!items.length) { alert('這個年級目前沒有題目。'); return; }
    wr = { items: items, i: 0, score: 0 };
    $('writeResult').classList.add('hidden');
    document.querySelector('#view-write .quiz-card').classList.remove('hidden');
    show('write');
    renderWrite();
  }

  function renderWrite() {
    var it = wr.items[wr.i];
    var reading = state.phon === 'zhuyin' ? it.zhuyin : it.pinyin;
    $('writeProgress').textContent = (wr.i + 1) + ' / ' + wr.items.length;
    $('writeScore').textContent = '寫對 ' + wr.score;
    $('writeTag').textContent = '手寫 · ' + gradeLabel(it.grade);
    $('writePrompt').textContent = it.sentence + '\n括號中讀「' + reading + '」— 請在下方寫出這個字';
    $('writeAnswer').classList.add('hidden');
    $('writeAnswer').textContent = it.answer;
    $('writeJudge').classList.add('hidden');
    $('writeNote').classList.add('hidden');
    $('writeReveal').classList.remove('hidden');
    $('strokeWrap').classList.add('hidden');
    clearCanvas();
  }

  // 畫布
  var cv = $('writeCanvas');
  var ctx = cv.getContext('2d');
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = '#222';
  var drawing = false;
  function pos(e) {
    var r = cv.getBoundingClientRect();
    var p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (cv.width / r.width), y: (p.clientY - r.top) * (cv.height / r.height) };
  }
  function down(e) { e.preventDefault(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function up() { drawing = false; }
  cv.addEventListener('mousedown', down); cv.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  cv.addEventListener('touchstart', down, { passive: false });
  cv.addEventListener('touchmove', move, { passive: false });
  cv.addEventListener('touchend', up);
  function clearCanvas() { ctx.clearRect(0, 0, cv.width, cv.height); }

  $('writeClear').addEventListener('click', clearCanvas);
  $('writeReveal').addEventListener('click', function () {
    var it = wr.items[wr.i];
    $('writeAnswer').classList.remove('hidden');
    $('writeJudge').classList.remove('hidden');
    $('writeReveal').classList.add('hidden');
    showStroke(it.answer);
    if (it.note) {
      $('writeNote').textContent = it.note;
      $('writeNote').className = 'q-feedback';
      $('writeNote').classList.remove('hidden');
    }
  });
  function judgeWrite(ok) {
    var it = wr.items[wr.i];
    if (ok) { wr.score++; touchWrongOnCorrect('chars', it.id); }
    bumpStat('write', ok);
    if (!ok) addWrong('chars', it.id);
    wr.i++;
    if (wr.i >= wr.items.length) {
      document.querySelector('#view-write .quiz-card').classList.add('hidden');
      var r = $('writeResult');
      r.innerHTML = '手寫練習結束<br><b style="font-size:1.6rem">' + wr.score + ' / ' + wr.items.length +
        '</b><br><button class="btn-primary" id="writeAgain">再來一回合</button>';
      r.classList.remove('hidden');
      $('writeAgain').addEventListener('click', startWrite);
    } else renderWrite();
  }
  $('writeRight').addEventListener('click', function () { judgeWrite(true); });
  $('writeWrong').addEventListener('click', function () { judgeWrite(false); });
  $('writeExit').addEventListener('click', function () { show('home'); });

  // 筆順動畫:讀本地 strokes/uXXXX.json(hanzi-writer 資料),載不到就靜默隱藏
  var strokeWriter = null;
  function showStroke(ch) {
    var wrap = $('strokeWrap'), panel = $('strokePanel');
    if (!window.HanziWriter || typeof fetch === 'undefined') return;
    panel.innerHTML = '';
    fetch('strokes/u' + ch.codePointAt(0).toString(16) + '.json')
      .then(function (r) { if (!r.ok) throw new Error('404'); return r.json(); })
      .then(function (data) {
        wrap.classList.remove('hidden');
        strokeWriter = HanziWriter.create(panel, ch, {
          width: 170, height: 170, padding: 10,
          showOutline: true,
          strokeColor: '#1a1c22', outlineColor: '#d5d8e0', radicalColor: '#2c66d9',
          strokeAnimationSpeed: 1, delayBetweenStrokes: 220,
          charDataLoader: function (c, onComplete) { onComplete(data); }
        });
        strokeWriter.animateCharacter();
      })
      .catch(function () { wrap.classList.add('hidden'); });
  }
  $('strokeReplay').addEventListener('click', function () {
    if (strokeWriter) strokeWriter.animateCharacter();
  });

  /* ---------- 字卡複習（Leitner 三盒） ---------- */

  var fl = null;
  function dueCards() {
    var t = today();
    return Object.keys(state.leitner).filter(function (id) {
      return state.leitner[id].due <= t && findItem(id.charAt(0) === 'i' ? 'idioms' : 'slang', id);
    });
  }

  function startFlash() {
    var due = dueCards();
    show('flash');
    if (!due.length) {
      $('flashEmpty').classList.remove('hidden');
      $('flashCard').classList.add('hidden');
      $('flashFlip').parentElement.classList.add('hidden');
      $('flashJudge').classList.add('hidden');
      // 提供快速加卡
      if (!$('flashSeed')) {
        var b = document.createElement('button');
        b.id = 'flashSeed'; b.className = 'btn-primary';
        b.textContent = '從目前年級隨機加入 20 張字卡';
        b.addEventListener('click', function () {
          var cand = shuffle(pool('idioms').concat(pool('slang')))
            .filter(function (it) { return !state.leitner[it.id]; }).slice(0, 20);
          cand.forEach(function (it) { state.leitner[it.id] = { box: 1, due: today() }; });
          save(); startFlash();
        });
        $('flashEmpty').appendChild(b);
      }
      $('flashInfo').textContent = '字卡複習';
      return;
    }
    $('flashEmpty').classList.add('hidden');
    $('flashCard').classList.remove('hidden');
    $('flashFlip').parentElement.classList.remove('hidden');
    fl = { ids: shuffle(due), i: 0 };
    renderFlash();
  }

  function renderFlash() {
    var id = fl.ids[fl.i];
    var it = findItem(id.charAt(0) === 'i' ? 'idioms' : 'slang', id);
    var box = state.leitner[id].box;
    $('flashInfo').textContent = (fl.i + 1) + ' / ' + fl.ids.length + ' · 盒' + box;
    $('flashFront').textContent = it.term;
    $('flashFront').classList.remove('hidden');
    $('flashBack').innerHTML = '';
    $('flashBack').textContent = it.meaning;
    var small = document.createElement('small');
    small.textContent = '例：' + it.example;
    $('flashBack').appendChild(small);
    maybeImg($('flashBack'), id.charAt(0) === 'i' ? 'idioms' : 'slang', id);
    $('flashBack').classList.add('hidden');
    $('flashJudge').classList.add('hidden');
    $('flashFlip').classList.remove('hidden');
  }

  function flipFlash() {
    $('flashFront').classList.add('hidden');
    $('flashBack').classList.remove('hidden');
    $('flashFlip').classList.add('hidden');
    $('flashJudge').classList.remove('hidden');
  }
  $('flashFlip').addEventListener('click', flipFlash);
  $('flashCard').addEventListener('click', function () {
    if ($('flashBack').classList.contains('hidden')) flipFlash();
  });

  function judgeFlash(know) {
    var id = fl.ids[fl.i];
    var L = state.leitner[id];
    if (know) { L.box = Math.min(3, L.box + 1); }
    else { L.box = 1; }
    L.due = nextDue(L.box, today());
    save();
    fl.i++;
    if (fl.i >= fl.ids.length) startFlash();
    else renderFlash();
  }
  $('flashKnow').addEventListener('click', function () { judgeFlash(true); });
  $('flashForget').addEventListener('click', function () { judgeFlash(false); });
  $('flashExit').addEventListener('click', function () { show('home'); });

  /* ---------- 錯題本 ---------- */

  var wb = { time: 'all', cat: 'all', edit: false, sel: {} };

  function wrongFiltered() {
    var cut = 0;
    var now = Date.now();
    if (wb.time === 'today') { var d = new Date(); d.setHours(0, 0, 0, 0); cut = d.getTime(); }
    else if (wb.time === '7d') cut = now - 7 * 86400000;
    else if (wb.time === '30d') cut = now - 30 * 86400000;
    return state.wrong.filter(function (w) {
      if (wb.cat !== 'all' && w.t !== wb.cat) return false;
      return (w.lastWrong || w.added || 0) >= cut;
    }).sort(function (a, b) { return (b.lastWrong || 0) - (a.lastWrong || 0); });
  }

  function fmtTs(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function showWrongbook() {
    show('wrongbook');
    // 時間 + 類別篩選
    var f = $('wrongFilters');
    f.innerHTML = '';
    [['all', '全部時間'], ['today', '今天'], ['7d', '近7天'], ['30d', '近30天']].forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'chip' + (wb.time === t[0] ? ' active' : '');
      b.textContent = t[1];
      b.addEventListener('click', function () { wb.time = t[0]; showWrongbook(); });
      f.appendChild(b);
    });
    var cats = [['all', '全類別']];
    Object.keys(CAT_NAME).forEach(function (c) {
      if (state.wrong.some(function (w) { return w.t === c; })) cats.push([c, CAT_NAME[c]]);
    });
    cats.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'chip' + (wb.cat === t[0] ? ' active' : '');
      b.textContent = t[1];
      b.addEventListener('click', function () { wb.cat = t[0]; showWrongbook(); });
      f.appendChild(b);
    });
    // 工具列
    var tools = $('wrongTools');
    tools.innerHTML = '';
    var list = wrongFiltered();
    var info = document.createElement('span');
    info.className = 'prog-hint';
    info.textContent = '共 ' + list.length + ' 題';
    tools.appendChild(info);
    var editBtn = document.createElement('button');
    editBtn.className = 'chip' + (wb.edit ? ' active' : '');
    editBtn.textContent = wb.edit ? '完成編輯' : '☑ 編輯／刪除';
    editBtn.addEventListener('click', function () { wb.edit = !wb.edit; wb.sel = {}; showWrongbook(); });
    tools.appendChild(editBtn);
    if (wb.edit) {
      var allBtn = document.createElement('button');
      allBtn.className = 'chip';
      allBtn.textContent = '全選';
      allBtn.addEventListener('click', function () {
        list.forEach(function (w) { wb.sel[w.t + ':' + w.id] = true; });
        showWrongbook();
      });
      tools.appendChild(allBtn);
      var delBtn = document.createElement('button');
      delBtn.className = 'chip danger';
      var n = Object.keys(wb.sel).filter(function (k) { return wb.sel[k]; }).length;
      delBtn.textContent = '🗑 刪除選取（' + n + '）';
      delBtn.addEventListener('click', function () {
        var keys = Object.keys(wb.sel).filter(function (k) { return wb.sel[k]; });
        if (!keys.length) { setStatusToast('先勾選要刪的題目'); return; }
        if (!confirm('確定刪除 ' + keys.length + ' 題？（確定已記牢再刪）')) return;
        deleteWrong(keys);
        wb.sel = {};
        showWrongbook();
      });
      tools.appendChild(delBtn);
    }
    // 清單
    var box = $('wrongList');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="empty">這個範圍沒有錯題 🎉</div>';
      return;
    }
    list.forEach(function (w) {
      var it = findItem(w.t, w.id);
      if (!it) return;
      var key = w.t + ':' + w.id;
      var div = document.createElement('div');
      div.className = 'wrong-item';
      var head = document.createElement('div');
      head.className = 'wb-row';
      if (wb.edit) {
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!wb.sel[key];
        cb.addEventListener('change', function () { wb.sel[key] = cb.checked; showWrongbook(); });
        head.appendChild(cb);
      }
      var label = w.t === 'custom' ? labelOf(w.t, w.id) :
        (it.term || (it.word ? it.word + '（' + it.target + '）' : it.answer + '：' + it.sentence));
      var bEl = document.createElement('b');
      bEl.textContent = label;
      head.appendChild(bEl);
      var del = document.createElement('button');
      del.className = 'wb-del';
      del.textContent = '✕';
      del.title = '確定記牢了，刪除這題';
      del.addEventListener('click', function () {
        if (confirm('刪除「' + label + '」？')) { deleteWrong([key]); showWrongbook(); }
      });
      head.appendChild(del);
      div.appendChild(head);
      var meta = document.createElement('small');
      var dueTxt = (w.due || '') <= today() ? '⏰今日複習' : '下次 ' + (w.due || '—');
      meta.textContent = CAT_NAME[w.t] + ' · 錯 ' + w.n + ' 次 · 連對 ' + (w.ok || 0) + ' 次 · 最後錯 ' + fmtTs(w.lastWrong) + ' · ' + dueTxt;
      div.appendChild(meta);
      var sub = document.createElement('small');
      sub.className = 'wb-sub';
      sub.textContent = w.t === 'custom' ? '' : (it.meaning || it.note || '');
      div.appendChild(sub);
      box.appendChild(div);
    });
  }
  $('wrongRetry').addEventListener('click', function () {
    var entries = wrongFiltered().map(function (w) { return { t: w.t, id: w.id }; });
    if (!entries.length) { setStatusToast('這個範圍沒有錯題'); return; }
    beginQuiz(shuffle(entries).slice(0, 20), 'retry', null);
  });
  $('wrongExit').addEventListener('click', function () { show('home'); });

  /* ---------- 進度 ---------- */

  function showProgress() {
    show('progress');
    var body = $('progBody');
    body.innerHTML = '';
    var rows = [
      ['成語', 'idioms'], ['俚語諺語', 'slang'], ['字音辨正', 'phonics'],
      ['字形辨正', 'chars'], ['手寫練習', 'write']
    ];
    rows.forEach(function (r) {
      var s = state.stats[r[1]] || { n: 0, ok: 0 };
      var pct = s.n ? Math.round(100 * s.ok / s.n) : 0;
      var div = document.createElement('div');
      div.className = 'prog-row';
      div.innerHTML = '<b>' + r[0] + '</b><span>' + s.n + ' 題 · 正確率 ' + pct + '%</span>';
      body.appendChild(div);
    });
    var extra = document.createElement('div');
    extra.className = 'prog-row';
    var boxes = [0, 0, 0];
    Object.keys(state.leitner).forEach(function (id) { boxes[state.leitner[id].box - 1]++; });
    extra.innerHTML = '<b>字卡</b><span>盒1×' + boxes[0] + ' 盒2×' + boxes[1] + ' 盒3×' + boxes[2] + '</span>';
    body.appendChild(extra);
    // 弱點分析
    var ws = weakStrong(state.stats);
    var weakDiv = document.createElement('div');
    weakDiv.className = 'prog-hint';
    if (ws) {
      weakDiv.textContent = '📊 弱點分析：「' + CAT_NAME[ws.weak] + '」正確率最低（' +
        Math.round(ws.weakRate * 100) + '%），每日練習已自動對它加重出題。';
    } else {
      weakDiv.textContent = '📊 弱點分析：各類作答量還不夠或表現平均，累積更多作答後會自動對最弱類別加重出題。';
    }
    body.appendChild(weakDiv);
    renderDailyCal(body);
  }

  // 家長檢視：近 14 天每日練習完成狀況，點日期看細節
  function renderDailyCal(body) {
    var daily = state.daily || {};
    var head = document.createElement('h3');
    head.className = 'prog-h3';
    head.textContent = '👨‍👩‍👧 家長檢視 — 每日練習紀錄';
    body.appendChild(head);
    var hint = document.createElement('div');
    hint.className = 'prog-hint';
    var ds = dailyStreak(daily, today());
    var week = 0;
    for (var i = 0; i < 7; i++) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var k = fmtDate(d);
      if (daily[k] && daily[k].done) week++;
    }
    hint.textContent = '連續完成 ' + ds + ' 天 · 最近 7 天完成 ' + week + ' 天。點日期看做了什麼、錯了什麼。';
    body.appendChild(hint);
    var cal = document.createElement('div');
    cal.className = 'daily-cal';
    var detail = document.createElement('div');
    detail.className = 'daily-detail hidden';
    for (var j = 13; j >= 0; j--) {
      (function (offset) {
        var d = new Date(); d.setDate(d.getDate() - offset);
        var key = fmtDate(d);
        var rec = daily[key];
        var cell = document.createElement('button');
        cell.className = 'cal-cell' + (rec && rec.done ? ' done' : offset === 0 ? ' today' : '');
        cell.innerHTML = '<small>' + (d.getMonth() + 1) + '/' + d.getDate() + '</small>' +
          (rec && rec.done ? '✅' : offset === 0 ? '⬜' : '❌');
        cell.addEventListener('click', function () { showDayDetail(detail, key, rec); });
        cal.appendChild(cell);
      })(j);
    }
    body.appendChild(cal);
    body.appendChild(detail);
  }

  function showDayDetail(box, key, rec) {
    box.classList.remove('hidden');
    if (!rec || !rec.done) {
      box.innerHTML = '<b>' + key + '</b><br>這一天沒有完成每日練習。';
      return;
    }
    var mins = Math.max(1, Math.round(rec.ms / 60000));
    var fin = new Date(rec.finishedAt);
    var pct = rec.total ? Math.round(100 * rec.firstOk / rec.total) : 0;
    var html = '<b>' + key + '</b>（' + (rec.gradesTxt || gradeLabel(rec.grade)) + '）<br>' +
      '✅ 完成於 ' + ('0' + fin.getHours()).slice(-2) + ':' + ('0' + fin.getMinutes()).slice(-2) +
      ' · 用時約 ' + mins + ' 分鐘<br>' +
      '第一次答對 ' + rec.firstOk + ' / ' + rec.total + '（' + pct + '%）· 錯題重做 ' + (rec.rounds - 1) + ' 輪後全對';
    if (rec.wrong && rec.wrong.length) {
      html += '<br><br><b>當天答錯過的題目：</b>';
      rec.wrong.forEach(function (w) {
        var it = findItem(w.t, w.id);
        if (!it) return;
        var label = it.term || (it.word ? it.word + '（' + it.target + '）' : it.title ? '閱讀《' + it.title + '》' : it.answer);
        html += '<br>· ' + (CAT_NAME[w.t] || w.t) + '：' + label;
      });
    } else {
      html += '<br>全部一次答對 💯';
    }
    box.innerHTML = html;
  }
  $('progReset').addEventListener('click', function () {
    if (confirm('確定清除所有練習紀錄、錯題本與字卡進度？')) {
      localStorage.removeItem(LS_KEY);
      state = load(); save(); renderHome(); show('home');
    }
  });
  $('progExit').addEventListener('click', function () { show('home'); });

  /* ---------- 自創題庫（分冊分課選範圍） ---------- */

  var customSel = { book: null, diff: null, qtype: null };

  // 依難易度/題型過濾（null＝全部）
  function customFilter(pool) {
    return pool.filter(function (it) {
      if (customSel.diff && (it.diff || '中') !== customSel.diff) return false;
      if (customSel.qtype && (it.qtype || '綜合') !== customSel.qtype) return false;
      return true;
    });
  }

  function showCustom() {
    if (!DATA.custom.length) {
      alert('自創題庫還沒有題目。請把 Word 題庫檔傳到 Telegram，轉檔後會自動分冊分課出現在這裡。');
      return;
    }
    show('custom');
    var books = customBooks(DATA.custom);
    if (!customSel.book || !books.some(function (b) { return b.book === customSel.book; })) {
      customSel.book = books[0].book;
    }
    var row = $('customBooks');
    row.innerHTML = '';
    books.forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'chip' + (customSel.book === b.book ? ' active' : '');
      btn.textContent = b.book;
      btn.addEventListener('click', function () { customSel.book = b.book; showCustom(); });
      row.appendChild(btn);
    });
    // 難易度篩選
    var drow = $('customDiffs');
    drow.innerHTML = '';
    [[null, '全部難度'], ['易', '易'], ['中', '中'], ['難', '難']].forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip' + (customSel.diff === o[0] ? ' active' : '');
      b.textContent = o[1];
      b.addEventListener('click', function () { customSel.diff = o[0]; showCustom(); });
      drow.appendChild(b);
    });
    // 題型篩選（只列該冊實際存在的題型）
    var trow = $('customTypes');
    trow.innerHTML = '';
    var typesHere = [];
    customPool(DATA.custom, customSel.book, null).forEach(function (it) {
      var t = it.qtype || '綜合';
      if (typesHere.indexOf(t) < 0) typesHere.push(t);
    });
    [[null, '全部題型']].concat(typesHere.map(function (t) { return [t, t]; })).forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'chip' + (customSel.qtype === o[0] ? ' active' : '');
      b.textContent = o[1];
      b.addEventListener('click', function () { customSel.qtype = o[0]; showCustom(); });
      trow.appendChild(b);
    });
    var list = $('customList');
    list.innerHTML = '';
    state.drillPos = state.drillPos || {};
    var cur = books.find(function (b) { return b.book === customSel.book; });
    var rows = cur.lessons.map(function (l) { return { label: l, lesson: l }; });
    rows.push({ label: '整冊全部', lesson: null });
    rows.forEach(function (r) {
      var p = customFilter(customPool(DATA.custom, cur.book, r.lesson));
      var key = customDrillKey(cur.book, r.lesson);
      var pos = Math.min(state.drillPos[key] || 0, p.length);
      var pct = p.length ? Math.round(100 * pos / p.length) : 0;
      var div = document.createElement('button');
      div.className = 'unit-item';
      div.innerHTML = '<b>' + r.label + '</b>' +
        '<small>' + pos + ' / ' + p.length + ' 題（' + pct + '%）' + (pos >= p.length && p.length ? ' · 已刷完一輪 🎉 可重頭再刷' : '') + '</small>' +
        '<div class="drill-track"><div class="drill-bar" style="width:' + pct + '%"></div></div>';
      div.addEventListener('click', function () {
        if (!p.length) { setStatusToast('這個範圍沒有符合篩選的題目'); return; }
        startDrill('custom', cur.book, r.lesson);
      });
      list.appendChild(div);
    });
  }
  $('customExit').addEventListener('click', function () { show('home'); });

  function customDrillKey(book, lesson) {
    // 舊 key 'custom'（全庫）沿用；有選冊/課/難度/題型才加後綴
    return 'custom' + (book ? '|' + book : '') + (lesson ? '|' + lesson : '') +
      (customSel.diff ? '|d:' + customSel.diff : '') + (customSel.qtype ? '|t:' + customSel.qtype : '');
  }

  /* ---------- 依序刷題（含自創題庫，做到哪記到哪） ---------- */

  var DRILL_CHUNK = 20;

  function drillPool(cat, book, lesson) {
    if (cat === 'custom') return customFilter(book ? customPool(DATA.custom, book, lesson) : DATA.custom);
    return filterByGrades(DATA[cat] || [], state.grades);
  }
  function drillKey(cat, book, lesson) {
    return cat === 'custom' ? customDrillKey(book, lesson) : cat + '|' + state.grades.join(',');
  }

  function showDrill() {
    show('drill');
    var list = $('drillList');
    list.innerHTML = '';
    var hint = document.createElement('div');
    hint.className = 'prog-hint';
    hint.textContent = '照題庫順序一題不漏地刷（目前年級範圍：' + gradesLabel(state.grades) + '），一批 ' + DRILL_CHUNK + ' 題，進度自動記住。';
    list.appendChild(hint);
    var cats = ['idioms', 'slang', 'phonics', 'chars'];
    if (DATA.custom.length) cats.push('custom');
    state.drillPos = state.drillPos || {};
    cats.forEach(function (cat) {
      var pool = drillPool(cat);
      var pos = Math.min(state.drillPos[drillKey(cat)] || 0, pool.length);
      var pct = pool.length ? Math.round(100 * pos / pool.length) : 0;
      var div = document.createElement('button');
      div.className = 'unit-item';
      div.innerHTML = '<b>' + CAT_NAME[cat] + '</b>' +
        '<small>' + pos + ' / ' + pool.length + ' 題（' + pct + '%）' + (pos >= pool.length && pool.length ? ' · 已刷完，可重頭再刷' : '') + '</small>' +
        '<div class="drill-track"><div class="drill-bar" style="width:' + pct + '%"></div></div>';
      div.addEventListener('click', function () { startDrill(cat); });
      list.appendChild(div);
    });
  }
  $('drillExit').addEventListener('click', function () { show('home'); });

  function startDrill(cat, book, lesson) {
    var pool = drillPool(cat, book, lesson);
    if (!pool.length) { alert(cat === 'custom' ? '自創題庫還沒有題目。請把 Word 題庫檔傳到 Telegram，轉檔後就會出現。' : '這個年級範圍沒有題目。'); return; }
    state.drillPos = state.drillPos || {};
    var key = drillKey(cat, book, lesson);
    var pos = state.drillPos[key] || 0;
    if (pos >= pool.length) {
      if (!confirm('這個範圍已經刷完一輪，要從第 1 題重新開始嗎？')) return;
      pos = 0;
      state.drillPos[key] = 0;
      save();
    }
    var entries = pool.slice(pos, pos + DRILL_CHUNK).map(function (it) { return { t: cat, id: it.id }; });
    beginQuiz(entries, 'drill', cat);
    quiz.drillKey = key;
    quiz.drillBase = pos;
    quiz.drillTotal = pool.length;
    quiz.drillBook = book || null;
    quiz.drillLesson = lesson || null;
    quiz.drillDesc = cat === 'custom'
      ? [book, lesson, customSel.diff ? '難度:' + customSel.diff : '', customSel.qtype ? '題型:' + customSel.qtype : ''].filter(Boolean).join(' ') || '自創題庫'
      : CAT_NAME[cat] + '（' + gradesLabel(state.grades) + '）';
  }

  /* ---------- 單元學習（先教後考，逐關解鎖） ---------- */

  var lessonState = null; // {grade, unitIdx, items, i}

  var UNIT_SIZES = {
    10: { idioms: 3, slang: 1, phonics: 3, chars: 3 },
    14: { idioms: 4, slang: 2, phonics: 4, chars: 4 },
    21: { idioms: 6, slang: 3, phonics: 6, chars: 6 }
  };
  function unitSize() { return state.unitSize || 14; }
  function unitKey(g, i) {
    var s = unitSize();
    return s === 14 ? 'g' + g + '-u' + i : 'g' + g + '-s' + s + '-u' + i;
  }

  function showUnits() {
    show('units');
    if (!state.unitGrade) state.unitGrade = state.grades[state.grades.length - 1] || 5;
    var srow = $('unitSizeRow');
    srow.innerHTML = '';
    [[10, '小單元 10 條'], [14, '標準 14 條'], [21, '大單元 21 條']].forEach(function (opt) {
      var b = document.createElement('button');
      b.className = 'chip' + (unitSize() === opt[0] ? ' active' : '');
      b.textContent = opt[1];
      b.addEventListener('click', function () { state.unitSize = opt[0]; save(); showUnits(); });
      srow.appendChild(b);
    });
    var row = $('unitGradeRow');
    row.innerHTML = '';
    for (var g = 1; g <= 12; g++) {
      (function (g) {
        var b = document.createElement('button');
        b.className = 'chip' + (g === state.unitGrade ? ' active' : '');
        b.textContent = gradeLabel(g);
        b.addEventListener('click', function () { state.unitGrade = g; save(); showUnits(); });
        row.appendChild(b);
      })(g);
    }
    var list = $('unitList');
    list.innerHTML = '';
    var units = buildUnits(DATA, state.unitGrade, UNIT_SIZES[unitSize()]);
    state.units = state.units || {};
    if (!units.length) { list.innerHTML = '<div class="empty">這個年級目前沒有教材。</div>'; return; }
    units.forEach(function (u, i) {
      var done = !!state.units[unitKey(state.unitGrade, i)];
      var locked = i > 0 && !state.units[unitKey(state.unitGrade, i - 1)];
      var div = document.createElement('button');
      div.className = 'unit-item' + (done ? ' done' : locked ? ' locked' : '');
      div.innerHTML = '<b>' + (done ? '✅' : locked ? '🔒' : '▶️') + ' 第 ' + (i + 1) + ' 單元</b>' +
        '<small>' + u.length + ' 個詞條 · ' + (done ? '已完成，可重新練習' : locked ? '完成上一單元後解鎖' : '教學 → 測驗全對過關') + '</small>';
      if (!locked) div.addEventListener('click', function () { startLesson(state.unitGrade, i, u); });
      list.appendChild(div);
    });
  }
  $('unitsExit').addEventListener('click', function () { show('home'); });

  function startLesson(grade, unitIdx, items) {
    lessonState = { grade: grade, unitIdx: unitIdx, items: items, i: 0 };
    show('lesson');
    renderLessonCard();
  }

  function renderLessonCard() {
    var L = lessonState;
    var e = L.items[L.i];
    var it = findItem(e.t, e.id);
    $('lessonInfo').textContent = gradeLabel(L.grade) + ' 第' + (L.unitIdx + 1) + '單元 · ' + (L.i + 1) + '/' + L.items.length;
    $('lessonTag').textContent = '📖 教學 · ' + CAT_NAME[e.t];
    var body = $('lessonBody');
    body.innerHTML = '';
    if (!it) { body.textContent = '資料載入失敗'; return; }
    var z = state.phon === 'zhuyin';
    function line(cls, text) {
      var d = document.createElement('div');
      d.className = cls; d.textContent = text;
      body.appendChild(d);
    }
    if (e.t === 'idioms') {
      line('lesson-term', it.term);
      line('lesson-zy', z ? it.zhuyin : it.pinyin);
      line('lesson-meaning', '💡 ' + it.meaning);
      if (it.wordExp) line('lesson-meaning', '🔍 逐字解析：' + it.wordExp);
      line('lesson-example', '例：' + it.example);
      if (it.syn && it.syn.length) line('lesson-extra', '同義：' + it.syn.join('、'));
      if (it.misuse) line('lesson-extra', '⚠️ ' + it.misuse);
      maybeImg(body, 'idioms', it.id);
    } else if (e.t === 'slang') {
      line('lesson-term', it.term);
      line('lesson-extra', '（' + it.kind + '）');
      line('lesson-meaning', '💡 ' + it.meaning);
      line('lesson-example', '例：' + it.example);
    } else if (e.t === 'phonics') {
      line('lesson-term', it.word);
      line('lesson-zy', '「' + it.target + '」讀 ' + (z ? it.zhuyin : it.pinyin));
      if (it.note) line('lesson-meaning', '💡 ' + it.note);
    } else {
      line('lesson-term', it.answer);
      line('lesson-zy', z ? it.zhuyin : it.pinyin);
      if (it.note) line('lesson-meaning', '💡 ' + it.note);
      line('lesson-example', '例：' + it.sentence.split('（　）').join(it.answer));
    }
    var dx = deepExp(it);
    if (dx) line('lesson-extra', dx.replace(/^\n/, ''));
    $('lessonPrev').disabled = L.i === 0;
    $('lessonNext').textContent = L.i === L.items.length - 1 ? '開始單元測驗 ✍️' : '下一個 →';
  }

  $('lessonPrev').addEventListener('click', function () {
    if (lessonState.i > 0) { lessonState.i--; renderLessonCard(); }
  });
  $('lessonNext').addEventListener('click', function () {
    var L = lessonState;
    if (L.i < L.items.length - 1) { L.i++; renderLessonCard(); return; }
    var entries = shuffle(L.items.slice());
    beginQuiz(entries, 'unit', null);
    quiz.total = entries.length;
    quiz.unitKey = unitKey(L.grade, L.unitIdx);
  });
  $('lessonExit').addEventListener('click', function () { showUnits(); });

  function completeUnit() {
    state.units = state.units || {};
    state.units[quiz.unitKey] = { done: true, ts: Date.now() };
    save();
    document.querySelector('#view-quiz .quiz-card').classList.add('hidden');
    var r = $('quizResult');
    r.innerHTML = '🎉 單元完成！<br><b style="font-size:1.6rem">' + quiz.total + ' 題全部答對</b><br>' +
      (quiz.round > 1 ? '錯題重做 ' + (quiz.round - 1) + ' 輪後過關' : '一次全對，太強了！') +
      '<br>下一單元已解鎖<br><button class="btn-primary" id="quizAgain">回單元列表</button>';
    r.classList.remove('hidden');
    confetti();
    $('quizAgain').addEventListener('click', function () { showUnits(); });
  }

  /* ---------- 寫作素材（每日一句 + 仿寫） ---------- */

  function showWriting() {
    show('writing');
    var poolW = filterByGrades(DATA.writing, state.grades);
    if (!poolW.length) poolW = DATA.writing;
    if (!poolW.length) { alert('素材庫載入失敗'); return; }
    var it = seededPick(poolW, 1, rngFromString(today() + '|writing'))[0];
    $('wrTag').textContent = '今日素材 · ' + today();
    $('wrQuote').textContent = '「' + it.quote + '」';
    $('wrSrc').textContent = '—— ' + it.src;
    $('wrTip').textContent = '💡 怎麼用：' + it.tip;
    $('wrTip').className = 'q-feedback';
    $('wrPrompt').textContent = '✍️ 仿寫練習：' + it.prompt;
    state.writingLog = state.writingLog || {};
    var saved = state.writingLog[today()];
    $('wrInput').value = saved ? saved.text : '';
    renderWrHistory();
    $('wrSave').onclick = function () {
      var text = $('wrInput').value.trim();
      if (!text) { setStatusToast('先寫點內容再儲存'); return; }
      state.writingLog[today()] = { id: it.id, quote: it.quote, text: text, ts: Date.now() };
      save();
      setStatusToast('✓ 已儲存，家長檢視也看得到');
      renderWrHistory();
    };
  }

  function renderWrHistory() {
    var box = $('wrHistory');
    box.innerHTML = '';
    var log = state.writingLog || {};
    var dates = Object.keys(log).sort().reverse().slice(0, 7);
    if (!dates.length) return;
    var h = document.createElement('h3');
    h.className = 'prog-h3';
    h.textContent = '最近的仿寫';
    box.appendChild(h);
    dates.forEach(function (d) {
      var div = document.createElement('div');
      div.className = 'wrong-item';
      var meta = document.createElement('small');
      meta.textContent = d + ' · 「' + log[d].quote.slice(0, 14) + '…」';
      var body = document.createElement('div');
      body.textContent = log[d].text;
      div.appendChild(meta);
      div.appendChild(body);
      box.appendChild(div);
    });
  }

  $('writingExit').addEventListener('click', function () { show('home'); });

  /* ---------- 啟動 ---------- */
  renderHome();
  show(state.subject ? 'home' : 'subject'); // 首次進站先選科目
})();
