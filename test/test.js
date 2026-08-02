// 資料完整性 + 純邏輯測試（node test/test.js）
'use strict';
const fs = require('fs');
const path = require('path');

global.window = {};
const root = path.join(__dirname, '..');
for (const f of ['idioms', 'slang', 'phonics', 'chars']) {
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
  ok(items.every(i => i.grade >= 1 && i.grade <= 12), `${cat} grade 都在 1-12`);
}
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

console.log(failed ? `\n${failed} 項失敗` : '\n全部通過');
process.exit(failed ? 1 : 0);
