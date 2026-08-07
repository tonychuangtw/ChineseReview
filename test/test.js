// 資料完整性 + 純邏輯測試（node test/test.js）
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const root = path.join(__dirname, '..');
for (const f of ['idioms', 'slang', 'phonics', 'chars', 'reading', 'writing', 'custom']) {
  eval(fs.readFileSync(path.join(root, 'js/data', f + '.js'), 'utf8'));
}
global.window.APP_DATA = window.APP_DATA;
eval(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'));
const PURE = window.PURE;
const D = window.APP_DATA;

let failed = 0;
function ok(cond, msg) {
  if (cond) console.log('  ✓ ' + msg);
  else { failed++; console.error('  ✗ ' + msg); }
}

const ZY_WORD = /^[ㄅ-ㄩˊˇˋ˙ ]+$/;  // 詞注音（可含空格）
const ZY_CHAR = /^[ㄅ-ㄩˊˇˋ˙]+$/;   // 單字注音

console.log('資料完整性');
ok(D.idioms.length >= 150, `成語 ≥150（實際 ${D.idioms.length}）`);
ok(D.slang.length >= 60, `俚語諺語 ≥60（實際 ${D.slang.length}）`);
ok(D.phonics.length >= 120, `字音 ≥120（實際 ${D.phonics.length}）`);
ok(D.chars.length >= 120, `字形 ≥120（實際 ${D.chars.length}）`);

for (const [cat, items] of Object.entries(D)) {
  const ids = new Set(items.map(i => i.id));
  ok(ids.size === items.length, `${cat} id 不重複`);
  if (cat !== 'custom') ok(items.every(i => i.grade >= 1 && i.grade <= 12), `${cat} grade 都在 1-12`);
}
ok(D.custom.every(c => c.q && Array.isArray(c.options) && c.options.length >= 2 && c.answer >= 0 && c.answer < c.options.length),
  '自創題庫欄位合法（目前 ' + D.custom.length + ' 題）');
ok(D.idioms.every(i => i.term && i.meaning && i.example && ZY_WORD.test(i.zhuyin) && i.pinyin),
  '成語欄位完整、注音格式正確');
ok(D.slang.every(i => i.term && i.meaning && i.example && ['俚語', '諺語', '歇後語'].includes(i.kind)),
  '俚語諺語欄位完整、kind 合法');
ok(D.phonics.every(i => i.word.includes(i.target) && ZY_CHAR.test(i.zhuyin) && i.pinyin &&
  Array.isArray(i.wrong) && i.wrong.length >= 2 && i.wrong.every(w => w.z && w.p)),
  '字音欄位完整、target 在 word 內、誤讀成對');
ok(D.chars.every(i => i.sentence.includes('（') && !i.sentence.includes(i.answer) &&
  i.answer.length === 1 && Array.isArray(i.wrong) && i.wrong.length >= 2 &&
  !i.wrong.includes(i.answer) && ZY_CHAR.test(i.zhuyin)),
  '字形欄位完整、句不洩答案、誤字合法');

console.log('題目生成');
for (let t = 0; t < 200; t++) {
  const iq = PURE.buildIdiomQ(D.idioms[t % D.idioms.length], D.idioms);
  if (!(iq.options.length === 4 && iq.correct >= 0 && iq.correct < 4)) { ok(false, '成語題選項/答案異常 @' + t); break; }
  if (t === 199) ok(true, '成語題 200 次生成皆 4 選項且答案索引有效');
}
for (let t = 0; t < 200; t++) {
  const pq = PURE.buildPhonicsQ(D.phonics[t % D.phonics.length], D.phonics, t % 2 ? 'zhuyin' : 'pinyin');
  const uniq = new Set(pq.options);
  if (!(pq.correct >= 0 && uniq.size === pq.options.length)) { ok(false, '字音題選項重複或答案異常 @' + t); break; }
  if (t === 199) ok(true, '字音題 200 次生成選項不重複、答案索引有效');
}
for (let t = 0; t < 200; t++) {
  const cq = PURE.buildCharsQ(D.chars[t % D.chars.length], D.chars, 'zhuyin');
  if (!(cq.options[cq.correct] === D.chars[t % D.chars.length].answer)) { ok(false, '字形題答案索引錯 @' + t); break; }
  if (t === 199) ok(true, '字形題 200 次生成答案索引正確');
}
const sq = PURE.buildSlangQ(D.slang[0], D.slang);
ok(sq.options[sq.correct] === D.slang[0].meaning, '俚語題答案對應正確');

console.log('工具函式');
ok(PURE.filterByGrade(D.idioms, 6, true).every(i => i.grade <= 6), '含以下年級過濾正確');
ok(PURE.filterByGrade(D.idioms, 6, false).every(i => i.grade === 6), '單一年級過濾正確');
ok(PURE.nextDue(1, '2026-08-02') === '2026-08-03', 'Leitner 盒1 +1 天');
ok(PURE.nextDue(2, '2026-08-02') === '2026-08-04', 'Leitner 盒2 +2 天');
ok(PURE.nextDue(3, '2026-08-02') === '2026-08-07', 'Leitner 盒3 +5 天');
ok(PURE.gradeLabel(1) === '小一' && PURE.gradeLabel(7) === '國一' && PURE.gradeLabel(12) === '高三', '年級標籤');

console.log('閱讀測驗');
ok(D.reading.length >= 30, `閱讀題組 ≥30（實際 ${D.reading.length}）`);
ok(D.reading.every(r => r.passage && r.questions.length >= 2 &&
  r.questions.every(q => q.options.length === 4 && q.answer >= 0 && q.answer <= 3 && q.exp)),
  '閱讀題組欄位完整、每題 4 選項有解說');
{
  const dist = [0, 0, 0, 0];
  D.reading.forEach(r => r.questions.forEach(q => dist[q.answer]++));
  const total = dist.reduce((a, b) => a + b, 0);
  ok(Math.max(...dist) / total < 0.5, `閱讀答案位置分散（${dist.join('/')}）`);
  const rq = PURE.buildReadingQ(D.reading[0], 0);
  ok(rq.options[rq.correct] === D.reading[0].questions[0].options[D.reading[0].questions[0].answer],
    '閱讀題答案索引正確');
}

console.log('同義成語');
{
  const withSyn = D.idioms.filter(i => Array.isArray(i.syn) && i.syn.length);
  ok(withSyn.length >= 100, `含同義詞成語 ≥100（實際 ${withSyn.length}）`);
  ok(withSyn.every(i => !i.syn.includes(i.term)), 'syn 不含自身');
  for (let t = 0; t < 100; t++) {
    const it = withSyn[t % withSyn.length];
    const q = PURE.buildSynQ(it, D.idioms);
    if (!(q.options.length === 4 && it.syn.includes(q.options[q.correct]))) {
      ok(false, '同義題答案不在 syn 內 @' + it.id); break;
    }
    if (t === 99) ok(true, '同義題 100 次生成答案皆為同義成語');
  }
}

console.log('每日練習');
{
  const G = [1, 2, 3, 4, 5];
  const a = PURE.composeDaily(D, G, '2026-08-02|x');
  const b = PURE.composeDaily(D, G, '2026-08-02|x');
  const c = PURE.composeDaily(D, G, '2026-08-03|x');
  ok(JSON.stringify(a) === JSON.stringify(b), '同種子組卷結果一致');
  ok(JSON.stringify(a) !== JSON.stringify(c), '不同日期組卷不同');
  ok(a.length >= 22, `組卷題數 ≥22（實際 ${a.length}）`);
  const cats = new Set(a.map(e => e.t));
  ok(cats.has('idioms') && cats.has('slang') && cats.has('phonics') && cats.has('chars'), '組卷涵蓋四大類');
  const w = PURE.composeDaily(D, G, '2026-08-02|x', { idioms: 8, chars: 4 });
  ok(w.filter(e => e.t === 'idioms').length === 8 && w.filter(e => e.t === 'chars').length === 4, '弱點加權可調各類題數');
  ok(PURE.dailyStreak({ '2026-08-01': { done: true }, '2026-08-02': { done: true } }, '2026-08-02') === 2, '連續天數計算（今天已做）');
  ok(PURE.dailyStreak({ '2026-08-01': { done: true } }, '2026-08-02') === 1, '連續天數計算（今天未做從昨天回數）');
}

console.log('總結測驗');
{
  const G = [1, 2, 3, 4, 5];
  const day1 = PURE.composeDaily(D, G, '2026-08-05|x');
  const day2 = PURE.composeDaily(D, G, '2026-08-06|x');
  const wrongPool = [{ t: 'idioms', id: D.idioms[0].id }, { t: 'chars', id: D.chars[0].id }, { t: 'phonics', id: D.phonics[0].id }];
  const rng = () => PURE.rngFromString('rv-test');
  const r = PURE.composeReview([day1, day2], wrongPool, 20, 6, rng());
  ok(r.length === 20, `總結測驗共 20 題（實際 ${r.length}）`);
  const keys = r.map(e => e.t + ':' + e.id + (e.qi != null ? '#' + e.qi : ''));
  ok(new Set(keys).size === keys.length, '總結測驗題目不重複');
  ok(r.filter(e => e.rev).length <= 6, '錯題本混入至多 6 題');
  // 同篇閱讀子題必須連續出現
  const rIdx = {};
  r.forEach((e, i) => { if (e.t === 'reading') (rIdx[e.id] = rIdx[e.id] || []).push(i); });
  const contiguous = Object.keys(rIdx).every(id => rIdx[id].every((v, k) => k === 0 || v === rIdx[id][k - 1] + 1));
  ok(contiguous, '同篇閱讀子題連續出現');
  // 同種子決定性
  const r2 = PURE.composeReview([day1, day2], wrongPool, 20, 6, rng());
  ok(JSON.stringify(r) === JSON.stringify(r2), '同種子組卷一致');
  // 排除當日混入的複習題（rev）與跨天重複
  const dayDup = day1.concat([{ t: 'idioms', id: day1.find(e => e.t === 'idioms').id, rev: true }]);
  const r3 = PURE.composeReview([dayDup, day1], [], 50, 0, rng());
  const k3 = r3.map(e => e.t + ':' + e.id + (e.qi != null ? '#' + e.qi : ''));
  ok(new Set(k3).size === k3.length && r3.every(e => !e.rev), '跨天去重且不收當日 rev 條目');
  // 題池不足時題數縮減不爆
  const small = PURE.composeReview([day1.slice(0, 3)], [], 20, 6, rng());
  ok(small.length === 3, '題池不足時以實際題數出卷');
}

console.log('多選年級 / 弱點 / 錯題排程 / 寫作素材');
{
  ok(PURE.filterByGrades(D.idioms, [3, 7]).every(i => i.grade === 3 || i.grade === 7), '多選年級過濾正確');
  ok(PURE.gradesLabel([1, 2, 3, 4]) === '小一–小四', '年級標籤連續縮寫');
  ok(PURE.gradesLabel([1, 2, 7]) === '小一–小二、國一', '年級標籤混合區間');
  const ws = PURE.weakStrong({ idioms: { n: 20, ok: 10 }, chars: { n: 20, ok: 19 } });
  ok(ws && ws.weak === 'idioms' && ws.strong === 'chars', '弱點分析找出最弱/最強');
  ok(PURE.weakStrong({ idioms: { n: 5, ok: 1 } }) === null, '樣本不足不加權');
  const w1 = { box: 1, due: '2026-08-02' };
  ok(PURE.bumpWrongSchedule(w1, true, '2026-08-02') === 'up' && w1.box === 2 && w1.due === '2026-08-05', '錯題答對升級 +3 天');
  ok(PURE.bumpWrongSchedule(w1, true, '2026-08-05') === 'up' && w1.box === 3 && w1.due === '2026-08-12', '再答對 +7 天');
  ok(PURE.bumpWrongSchedule(w1, true, '2026-08-12') === 'graduate', '三關後畢業');
  ok(PURE.bumpWrongSchedule(w1, false, '2026-08-12') === 'reset' && w1.box === 1, '答錯重排隔天');
  ok(D.writing.length >= 50, `寫作素材 ≥50（實際 ${D.writing.length}）`);
  const u1 = PURE.buildUnits(D, 5), u2 = PURE.buildUnits(D, 5);
  ok(JSON.stringify(u1) === JSON.stringify(u2), '單元切分決定性一致');
  ok(u1.length >= 3 && u1.every(u => u.length >= 6), `小五單元 ≥3 且每單元 ≥6 條（實際 ${u1.length} 單元）`);
  const allIds = u1.flat().map(e => e.t + e.id);
  ok(new Set(allIds).size === allIds.length, '單元內詞條不重複');
  ok(D.writing.every(w => w.quote && w.src && w.tip && w.prompt && w.grade >= 1 && w.grade <= 12), '寫作素材欄位完整');
}

console.log('全科架構 / 自創分冊分課 / 解析強化');
{
  const fake = [
    { id: 'x001', book: '五上', lesson: '第1課', q: 'q1', options: ['a', 'b', 'c', 'd'], answer: 0 },
    { id: 'x002', book: '五上', lesson: '第2課', q: 'q2', options: ['a', 'b', 'c', 'd'], answer: 1 },
    { id: 'x003', book: '五下', lesson: '第1課', q: 'q3', options: ['a', 'b', 'c', 'd'], answer: 2 },
    { id: 'x004', q: 'q4', options: ['a', 'b', 'c', 'd'], answer: 3 }
  ];
  const books = PURE.customBooks(fake);
  ok(books.length === 3 && books[0].book === '五上' && books[0].lessons.length === 2, '自創題庫分冊分課結構正確');
  ok(books.some(b => b.book === '未分類'), '沒標冊的題歸入未分類');
  ok(PURE.customPool(fake, '五上', null).length === 2 && PURE.customPool(fake, '五上', '第1課').length === 1, '冊/課範圍過濾正確');
  for (let t = 0; t < 50; t++) {
    const q = PURE.buildIdiomQ(D.idioms[t % D.idioms.length], D.idioms);
    if (q.explain.indexOf('其他選項') < 0) { ok(false, '成語解析缺其他選項說明 @' + t); break; }
    if (t === 49) ok(true, '成語解析含其他 3 個選項的成語意思');
  }
  const deepIt = D.idioms.find(i => i.id === 'i013');
  ok(deepIt && deepIt.deep && deepIt.deep.indexOf('典故由來') >= 0 && deepIt.deep.indexOf('引申意思') >= 0, 'i013 典故解析範例存在');
  const dq = PURE.buildIdiomQ(deepIt, D.idioms);
  ok(dq.explain.indexOf('注音比較') >= 0 && dq.explain.indexOf('楚：ㄔㄨˇ（三聲）') >= 0, '成語注音比較自動生成');
  ok(dq.explain.indexOf('典故與成語意思') >= 0, '典故解析會出現在答題回饋');
  const dq2 = PURE.buildIdiomQ(D.idioms.find(i => i.id === 'i001'), D.idioms);
  ok(dq2.explain.indexOf('注音比較') >= 0, '沒寫 deep 的成語也自動有注音比較');
  for (const k of ['idioms', 'phonics', 'chars']) {
    const n = D[k].filter(i => i.deep && i.deep.length >= 30).length;
    ok(n === D[k].length, `${k} 深度解析全數覆蓋（${n}/${D[k].length}）`);
  }
  const noExp = D.custom.filter(c => !c.exp || c.exp.trim().length < 2).length;
  ok(noExp === 0, `自創題庫解析零缺漏（缺 ${noExp} 題）`);
  ok(D.custom.every(c => ['易', '中', '難'].includes(c.diff) && c.qtype), '自創題庫難易度/題型欄位完整');
}

console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
process.exit(failed ? 1 : 0);
