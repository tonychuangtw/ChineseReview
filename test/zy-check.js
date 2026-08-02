// 注音 ↔ 拼音一致性檢查：把兩邊都正規化成「無調拼音+調號數字」再比對
'use strict';
const fs = require('fs');
const path = require('path');
global.window = {};
const root = require('path').join(__dirname, '..');
for (const f of ['phonics', 'chars', 'idioms']) {
  eval(fs.readFileSync(path.join(root, 'js/data', f + '.js'), 'utf8'));
}
const D = window.APP_DATA;

const INIT = { 'ㄅ':'b','ㄆ':'p','ㄇ':'m','ㄈ':'f','ㄉ':'d','ㄊ':'t','ㄋ':'n','ㄌ':'l','ㄍ':'g','ㄎ':'k','ㄏ':'h','ㄐ':'j','ㄑ':'q','ㄒ':'x','ㄓ':'zh','ㄔ':'ch','ㄕ':'sh','ㄖ':'r','ㄗ':'z','ㄘ':'c','ㄙ':'s' };
const MED = { 'ㄧ':'i','ㄨ':'u','ㄩ':'v' };
const FIN = { 'ㄚ':'a','ㄛ':'o','ㄜ':'e','ㄝ':'eh','ㄞ':'ai','ㄟ':'ei','ㄠ':'ao','ㄡ':'ou','ㄢ':'an','ㄣ':'en','ㄤ':'ang','ㄥ':'eng','ㄦ':'er' };

function zySyl(z) {
  // 回傳 [無調拼音, tone]；無法解析回 null
  let tone = 1;
  if (z.startsWith('˙')) { tone = 5; z = z.slice(1); }
  if (z.endsWith('ˊ')) { tone = 2; z = z.slice(0, -1); }
  else if (z.endsWith('ˇ')) { tone = 3; z = z.slice(0, -1); }
  else if (z.endsWith('ˋ')) { tone = 4; z = z.slice(0, -1); }
  let init = '', med = '', fin = '';
  const cs = [...z];
  let i = 0;
  if (i < cs.length && INIT[cs[i]]) { init = INIT[cs[i]]; i++; }
  if (i < cs.length && MED[cs[i]]) { med = MED[cs[i]]; i++; }
  if (i < cs.length && FIN[cs[i]]) { fin = FIN[cs[i]]; i++; }
  if (i !== cs.length) return null;
  // 組合規則
  let syl;
  if (!init) {
    if (med === 'i') syl = fin ? ({'a':'ya','o':'yo','eh':'ye','ai':'yai','ao':'yao','ou':'you','an':'yan','en':'yin','ang':'yang','eng':'ying'}[fin] || null) : 'yi';
    else if (med === 'u') syl = fin ? ({'a':'wa','o':'wo','ai':'wai','ei':'wei','an':'wan','en':'wen','ang':'wang','eng':'weng'}[fin] || null) : 'wu';
    else if (med === 'v') syl = fin ? ({'eh':'yue','an':'yuan','en':'yun','eng':'yong'}[fin] || null) : 'yu';
    else syl = fin === 'eh' ? 'e' : fin;
  } else {
    if (med === 'i') {
      if (!fin) syl = init + 'i';
      else syl = init + ({'a':'ia','eh':'ie','ao':'iao','ou':'iu','an':'ian','en':'in','ang':'iang','eng':'ing'}[fin] || '?');
    } else if (med === 'u') {
      if (!fin) syl = init + 'u';
      else syl = init + ({'a':'ua','o':'uo','ai':'uai','ei':'ui','an':'uan','en':'un','ang':'uang','eng':'ong'}[fin] || '?');
    } else if (med === 'v') {
      const uml = ['j','q','x'].includes(init) ? 'u' : 'v';
      if (!fin) syl = init + uml;
      else syl = init + ({'eh': uml + 'e','an': uml + 'an','en': uml + 'n','eng':'iong'}[fin] || '?');
    } else {
      if (!fin) {
        if (['zh','ch','sh','r','z','c','s'].includes(init)) syl = init + 'i';
        else return null; // 光聲母無韻＝資料錯誤（如 ㄕ 漏韻母）
      } else syl = init + (fin === 'eh' ? 'e' : fin);
    }
  }
  if (!syl || syl.includes('?')) return null;
  return [syl, tone];
}

const TONED = { 'ā':['a',1],'á':['a',2],'ǎ':['a',3],'à':['a',4],'ē':['e',1],'é':['e',2],'ě':['e',3],'è':['e',4],'ī':['i',1],'í':['i',2],'ǐ':['i',3],'ì':['i',4],'ō':['o',1],'ó':['o',2],'ǒ':['o',3],'ò':['o',4],'ū':['u',1],'ú':['u',2],'ǔ':['u',3],'ù':['u',4],'ǖ':['v',1],'ǘ':['v',2],'ǚ':['v',3],'ǜ':['v',4],'ü':['v',0],'ê':['eh',0] };
function pySyl(p) {
  let tone = 0, out = '';
  for (const c of p) {
    if (TONED[c]) { out += TONED[c][0]; if (TONED[c][1]) tone = TONED[c][1]; }
    else out += c;
  }
  if (!tone) tone = 5; // 無調記號＝輕聲或一聲；一聲拼音應有 ā 等記號，這裡寬鬆處理
  return [out, tone];
}

function cmp(zy, py, where) {
  const a = zySyl(zy);
  if (!a) return where + '  注音無法解析: ' + zy;
  const b = pySyl(py);
  if (a[0] !== b[0]) return where + '  音節不符: ' + zy + '→' + a[0] + ' vs ' + py + '→' + b[0];
  if (b[1] !== 5 && a[1] !== b[1] && !(a[1] === 1 && b[1] === 5)) return where + '  聲調不符: ' + zy + '(' + a[1] + ') vs ' + py + '(' + b[1] + ')';
  return null;
}

let bad = [];
D.phonics.forEach(it => {
  const e = cmp(it.zhuyin, it.pinyin, 'phonics ' + it.id + ' ' + it.word);
  if (e) bad.push(e);
  it.wrong.forEach((w, i) => {
    const e2 = cmp(w.z, w.p, 'phonics ' + it.id + ' wrong' + i);
    if (e2) bad.push(e2);
  });
});
D.chars.forEach(it => {
  const e = cmp(it.zhuyin, it.pinyin, 'chars ' + it.id + ' ' + it.answer);
  if (e) bad.push(e);
});
D.idioms.forEach(it => {
  const zs = it.zhuyin.split(' ');
  const ps = it.pinyin.split(' ');
  if (zs.length !== ps.length) { bad.push('idioms ' + it.id + ' 音節數不符'); return; }
  zs.forEach((z, i) => {
    const e = cmp(z, ps[i], 'idioms ' + it.id + ' ' + it.term[i]);
    if (e) bad.push(e);
  });
});
console.log(bad.join('\n'));
console.log('---共 ' + bad.length + ' 個不一致');
