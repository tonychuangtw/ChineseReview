#!/usr/bin/env node
/* 成語配圖批次生成 — Gemini 2.5 Flash Image (nano banana)
 * 用法：node tools/gen-idiom-images.js [--grades 1-6] [--limit 50]
 * 金鑰讀 ~/.gemini/.env 的 GEMINI_API_KEY；已存在的 img/idioms/<id>.webp 跳過。
 * 產出 PNG 後用 cwebp 壓成 512px webp（約 30-60KB），進度寫 tools/gen-images.log。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'img', 'idioms');
const LOG = path.join(__dirname, 'gen-images.log');

function log(msg) {
  const line = new Date().toISOString() + ' ' + msg;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

const envTxt = fs.readFileSync(path.join(os.homedir(), '.gemini', '.env'), 'utf8');
const KEY = (envTxt.match(/^GEMINI_API_KEY=(.+)$/m) || [])[1];
if (!KEY) { console.error('GEMINI_API_KEY not found'); process.exit(1); }

global.window = {};
eval(fs.readFileSync(path.join(ROOT, 'js/data/idioms.js'), 'utf8'));
let idioms = window.APP_DATA.idioms;

const args = process.argv.slice(2);
const gi = args.indexOf('--grades');
if (gi >= 0) {
  const [lo, hi] = args[gi + 1].split('-').map(Number);
  idioms = idioms.filter(i => i.grade >= lo && i.grade <= (hi || lo));
}
const li = args.indexOf('--limit');
const limit = li >= 0 ? Number(args[li + 1]) : Infinity;

fs.mkdirSync(OUT_DIR, { recursive: true });

async function genOne(it) {
  const prompt =
    `A warm, friendly cartoon illustration for the Chinese idiom "${it.term}" ` +
    `(meaning: ${it.meaning}). Depict the idiom's imagery or story as a memorable scene. ` +
    `Children's textbook style, soft flat colors, simple shapes, single scene, ` +
    `absolutely no text, letters or Chinese characters anywhere in the image.`;
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
    {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));
  const j = await res.json();
  const part = (((j.candidates || [])[0] || {}).content || {}).parts?.find(p => p.inlineData);
  if (!part) throw new Error('no image: ' + JSON.stringify(j).slice(0, 150));
  return Buffer.from(part.inlineData.data, 'base64');
}

(async () => {
  const todo = idioms.filter(it => !fs.existsSync(path.join(OUT_DIR, it.id + '.webp'))).slice(0, limit);
  log(`start: ${todo.length} images to generate`);
  let okN = 0, failN = 0;
  for (const it of todo) {
    const tmpPng = path.join(os.tmpdir(), 'idiom-' + it.id + '.png');
    const out = path.join(OUT_DIR, it.id + '.webp');
    try {
      const buf = await genOne(it);
      fs.writeFileSync(tmpPng, buf);
      execFileSync('cwebp', ['-q', '75', '-resize', '512', '0', tmpPng, '-o', out], { stdio: 'ignore' });
      fs.unlinkSync(tmpPng);
      okN++;
      log(`ok ${it.id} ${it.term} (${Math.round(fs.statSync(out).size / 1024)}KB) [${okN}/${todo.length}]`);
    } catch (e) {
      failN++;
      log(`FAIL ${it.id} ${it.term}: ${e.message}`);
      if (/HTTP 429|quota/i.test(e.message)) {
        log('rate limited — sleeping 60s');
        await new Promise(r => setTimeout(r, 60000));
      }
    }
    await new Promise(r => setTimeout(r, 2500)); // rate limit 保守間隔
  }
  log(`done: ${okN} ok, ${failN} failed`);
})();
