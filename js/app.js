/* 中文複習 — 應用邏輯（vanilla JS，無依賴，資料存 localStorage） */
(function () {
  'use strict';

  var W = (typeof window !== 'undefined') ? window : this;
  var DATA = W.APP_DATA || {};
  ['idioms', 'slang', 'phonics', 'chars'].forEach(function (k) {
    if (!Array.isArray(DATA[k])) DATA[k] = [];
  });

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

  function gradeLabel(g) {
    var names = ['', '小一', '小二', '小三', '小四', '小五', '小六', '國一', '國二', '國三', '高一', '高二', '高三'];
    return names[g] || ('年級' + g);
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
        explain: item.term + '：' + item.meaning + (item.misuse ? '\n⚠️ ' + item.misuse : '')
      };
    }
    var others2 = pickOthers(pool, item, 'meaning', 3);
    var opts2 = shuffle([item].concat(others2));
    return {
      type: 'idioms', item: item,
      question: '「' + item.term + '」的意思是？',
      options: opts2.map(function (o) { return o.meaning; }),
      correct: opts2.indexOf(item),
      explain: '例句：' + item.example + (item.misuse ? '\n⚠️ ' + item.misuse : '')
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
    return {
      type: 'phonics', item: item,
      question: qWord + ' — 「' + item.target + '」的讀音是？',
      options: opts.map(function (o) { return o.txt; }),
      correct: correct,
      explain: (item.note || '') + '\n正確讀音：' + item.zhuyin + '（' + item.pinyin + '）'
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
      explain: (item.note || '') + '\n正確答案：' + item.answer
    };
  }

  function nextDue(box, today) {
    var days = box >= 3 ? 5 : (box === 2 ? 2 : 1);
    var d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  W.PURE = {
    shuffle: shuffle, pickOthers: pickOthers, filterByGrade: filterByGrade,
    buildIdiomQ: buildIdiomQ, buildSlangQ: buildSlangQ,
    buildPhonicsQ: buildPhonicsQ, buildCharsQ: buildCharsQ,
    nextDue: nextDue, gradeLabel: gradeLabel
  };

  if (typeof document === 'undefined') return; // node 測試環境到此為止

  /* ---------- 狀態 ---------- */

  var LS_KEY = 'chinese-review-v1';
  var state = load();
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && typeof s === 'object') return s;
    } catch (e) {}
    return {
      phon: 'zhuyin', grade: 5, cumulative: true,
      stats: {}, streak: { last: '', days: 0 }, wrong: [], leitner: {}
    };
  }
  function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  function today() { return new Date().toISOString().slice(0, 10); }

  function bumpStat(cat, ok) {
    if (!state.stats[cat]) state.stats[cat] = { n: 0, ok: 0 };
    state.stats[cat].n++;
    if (ok) state.stats[cat].ok++;
    var t = today();
    if (state.streak.last !== t) {
      var y = new Date(); y.setDate(y.getDate() - 1);
      state.streak.days = (state.streak.last === y.toISOString().slice(0, 10)) ? state.streak.days + 1 : 1;
      state.streak.last = t;
    }
    save();
  }

  function addWrong(type, id) {
    var hit = state.wrong.find(function (w) { return w.t === type && w.id === id; });
    if (hit) hit.n++;
    else state.wrong.push({ t: type, id: id, n: 1 });
    if ((type === 'idioms' || type === 'slang') && !state.leitner[id]) {
      state.leitner[id] = { box: 1, due: today() };
    }
    save();
  }

  function findItem(type, id) {
    return (DATA[type] || []).find(function (it) { return it.id === id; });
  }

  /* ---------- 視圖切換 ---------- */

  var views = ['home', 'quiz', 'write', 'flash', 'wrongbook', 'progress'];
  function show(name) {
    views.forEach(function (v) {
      document.getElementById('view-' + v).classList.toggle('hidden', v !== name);
    });
    if (name === 'home') renderHome();
  }
  function $(id) { return document.getElementById(id); }

  /* ---------- 首頁 ---------- */

  function pool(cat) { return filterByGrade(DATA[cat], state.grade, state.cumulative); }

  function renderHome() {
    $('cnt-idioms').textContent = pool('idioms').length + ' 題可練';
    $('cnt-slang').textContent = pool('slang').length + ' 題可練';
    $('cnt-phonics').textContent = pool('phonics').length + ' 題可練';
    $('cnt-chars').textContent = pool('chars').length + ' 題可練';
    var due = dueCards().length;
    $('cnt-flash').textContent = due ? due + ' 張到期' : '間隔複習';
    $('cnt-wrong').textContent = state.wrong.length + ' 題待複習';
    $('cnt-streak').textContent = state.streak.days ? '連續 ' + state.streak.days + ' 天' : '開始累積吧';
    $('phonToggle').textContent = state.phon === 'zhuyin' ? '注音' : '拼音';
    $('cumChk').checked = state.cumulative;
    $('gradeSel').value = String(state.grade);
  }

  // 年級下拉
  (function initGradeSel() {
    var sel = $('gradeSel');
    var groups = [['國小', 1, 6], ['國中', 7, 9], ['高中', 10, 12]];
    groups.forEach(function (g) {
      var og = document.createElement('optgroup');
      og.label = g[0];
      for (var i = g[1]; i <= g[2]; i++) {
        var op = document.createElement('option');
        op.value = i; op.textContent = gradeLabel(i);
        og.appendChild(op);
      }
      sel.appendChild(og);
    });
    sel.value = String(state.grade);
    sel.addEventListener('change', function () {
      state.grade = parseInt(sel.value, 10); save(); renderHome();
    });
  })();

  $('phonToggle').addEventListener('click', function () {
    state.phon = state.phon === 'zhuyin' ? 'pinyin' : 'zhuyin';
    save(); renderHome();
  });
  $('cumChk').addEventListener('change', function () {
    state.cumulative = $('cumChk').checked; save(); renderHome();
  });
  $('homeLink').addEventListener('click', function () { show('home'); });

  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('click', function () {
      var go = c.getAttribute('data-go');
      if (go === 'idioms' || go === 'slang' || go === 'phonics' || go === 'chars') startQuiz(go, null);
      else if (go === 'write') startWrite();
      else if (go === 'flash') startFlash();
      else if (go === 'wrongbook') showWrongbook();
      else if (go === 'progress') showProgress();
    });
  });

  /* ---------- 選擇題測驗 ---------- */

  var quiz = null; // {qs, i, score, retry}
  var CAT_NAME = { idioms: '成語', slang: '俚語諺語', phonics: '字音辨正', chars: '字形辨正' };

  function buildQ(type, item, p) {
    if (type === 'idioms') return buildIdiomQ(item, p);
    if (type === 'slang') return buildSlangQ(item, p);
    if (type === 'phonics') return buildPhonicsQ(item, p, state.phon);
    return buildCharsQ(item, p, state.phon);
  }

  function startQuiz(cat, itemsOverride) {
    var p = itemsOverride ? null : pool(cat);
    var items = itemsOverride || shuffle(p).slice(0, 10);
    if (!items.length) { alert('這個年級目前沒有題目，換個年級或勾選「含以下年級」。'); return; }
    quiz = { items: items, i: 0, score: 0, retry: !!itemsOverride };
    $('quizResult').classList.add('hidden');
    document.querySelector('#view-quiz .quiz-card').classList.remove('hidden');
    show('quiz');
    renderQ();
  }

  function renderQ() {
    var it = quiz.items[quiz.i];
    var type = it._t || quizCatOf(it);
    var srcPool = DATA[type];
    var q = buildQ(type, it, srcPool);
    quiz.cur = q;
    $('quizProgress').textContent = (quiz.i + 1) + ' / ' + quiz.items.length;
    $('quizScore').textContent = '得分 ' + quiz.score;
    $('quizTag').textContent = CAT_NAME[type] + ' · ' + gradeLabel(it.grade);
    $('quizQuestion').textContent = q.question;
    var box = $('quizOptions');
    box.innerHTML = '';
    q.options.forEach(function (opt, idx) {
      var b = document.createElement('button');
      b.className = 'q-opt';
      b.textContent = opt;
      b.addEventListener('click', function () { answer(idx, b); });
      box.appendChild(b);
    });
    $('quizFeedback').classList.add('hidden');
    $('quizNext').classList.add('hidden');
  }

  function quizCatOf(item) {
    var c = item.id.charAt(0);
    return c === 'i' ? 'idioms' : c === 's' ? 'slang' : c === 'p' ? 'phonics' : 'chars';
  }

  function answer(idx, btn) {
    var q = quiz.cur;
    var opts = document.querySelectorAll('#quizOptions .q-opt');
    opts.forEach(function (o) { o.disabled = true; });
    var ok = idx === q.correct;
    opts[q.correct].classList.add('correct');
    if (!ok) btn.classList.add('wrongpick');
    if (ok) quiz.score++;
    bumpStat(q.type, ok);
    if (!ok) addWrong(q.type, q.item.id);
    var fb = $('quizFeedback');
    fb.textContent = (ok ? '✓ 答對了！' : '✗ 答錯了。') + '\n' + q.explain;
    fb.className = 'q-feedback ' + (ok ? 'good' : 'bad');
    fb.classList.remove('hidden');
    $('quizNext').classList.remove('hidden');
    $('quizScore').textContent = '得分 ' + quiz.score;
  }

  $('quizNext').addEventListener('click', function () {
    quiz.i++;
    if (quiz.i >= quiz.items.length) {
      document.querySelector('#view-quiz .quiz-card').classList.add('hidden');
      var r = $('quizResult');
      r.innerHTML = '本回合結束<br><b style="font-size:1.6rem">' + quiz.score + ' / ' + quiz.items.length +
        '</b><br>' + (quiz.score === quiz.items.length ? '全對，太強了 🎉' : '答錯的題目已加入錯題本') +
        '<br><button class="btn-primary" id="quizAgain">再來一回合</button>';
      r.classList.remove('hidden');
      $('quizAgain').addEventListener('click', function () {
        var type = quiz.cur.type;
        if (quiz.retry) showWrongbook(); else startQuiz(type, null);
      });
    } else renderQ();
  });
  $('quizExit').addEventListener('click', function () { show('home'); });

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
    if (it.note) {
      $('writeNote').textContent = it.note;
      $('writeNote').className = 'q-feedback';
      $('writeNote').classList.remove('hidden');
    }
  });
  function judgeWrite(ok) {
    var it = wr.items[wr.i];
    if (ok) wr.score++;
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

  function showWrongbook() {
    show('wrongbook');
    var box = $('wrongList');
    box.innerHTML = '';
    if (!state.wrong.length) {
      box.innerHTML = '<div class="empty">目前沒有錯題 🎉</div>';
      return;
    }
    state.wrong.slice().sort(function (a, b) { return b.n - a.n; }).forEach(function (w) {
      var it = findItem(w.t, w.id);
      if (!it) return;
      var div = document.createElement('div');
      div.className = 'wrong-item';
      var label = it.term || (it.word ? it.word + '（' + it.target + '）' : it.answer + '：' + it.sentence);
      div.innerHTML = '<b>' + label + '</b> <small>' + CAT_NAME[w.t] + ' · 錯 ' + w.n + ' 次</small><br><small>' +
        (it.meaning || it.note || '') + '</small>';
      box.appendChild(div);
    });
  }
  $('wrongRetry').addEventListener('click', function () {
    var items = state.wrong.map(function (w) { return findItem(w.t, w.id); }).filter(Boolean);
    if (!items.length) return;
    startQuiz('mixed', shuffle(items).slice(0, 15));
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
    extra.innerHTML = '<b>字卡</b><span>盒1×' + boxes[0] + ' 盒2×' + boxes[1] + ' 盒3×' + boxes[2] +
      ' · 連續 ' + state.streak.days + ' 天</span>';
    body.appendChild(extra);
  }
  $('progReset').addEventListener('click', function () {
    if (confirm('確定清除所有練習紀錄、錯題本與字卡進度？')) {
      localStorage.removeItem(LS_KEY);
      state = load(); save(); renderHome(); show('home');
    }
  });
  $('progExit').addEventListener('click', function () { show('home'); });

  /* ---------- 啟動 ---------- */
  renderHome();
  show('home');
})();
