#!/usr/bin/env node
/* 家長週報 — 每週日 20:00 由 systemd timer 觸發（chinese-weekly-report.timer）
 * 從 LanExamMock 後端的 progress.db 撈 app=chinese 的雲端同步資料，
 * 彙整過去 7 天的每日練習紀錄，透過 @Tonychinesereviewbot 發到 Tony 的 Telegram。
 * 沒有任何資料也會發「本週未練習」，不靜默。 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const BACKEND = path.join(os.homedir(), 'TelegramClaude', 'claude-shared', 'projects', 'LanExamMock', 'backend');
const Database = require(path.join(BACKEND, 'node_modules', 'better-sqlite3'));
const DB_PATH = path.join(BACKEND, 'progress.db');
const CHAT_ID = process.env.REPORT_CHAT_ID || '711631512';

function tgToken() {
  const envPath = path.join(os.homedir(), '.claude', 'channels', 'telegram-chinese', '.env');
  const m = fs.readFileSync(envPath, 'utf8').match(/^TELEGRAM_BOT_TOKEN=(.+)$/m);
  if (!m) throw new Error('TELEGRAM_BOT_TOKEN not found in telegram-chinese/.env');
  return m[1].trim();
}

function fmtDate(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(fmtDate(d));
  }
  return out;
}

const CAT_NAME = { idioms: '成語', slang: '俚語諺語', phonics: '字音', chars: '字形', reading: '閱讀', write: '手寫' };

function reportForUser(state, idx, total) {
  const days = lastNDays(7);
  const daily = state.daily || {};
  const lines = [];
  if (total > 1) lines.push(`👤 帳號 ${idx + 1}`);

  let doneN = 0;
  const dayLines = days.map((d) => {
    const r = daily[d];
    const wd = '日一二三四五六'[new Date(d + 'T00:00:00').getDay()];
    if (!r || !r.done) { return `  ${d.slice(5)}(${wd}) ❌ 未完成`; }
    doneN++;
    const pct = r.total ? Math.round(100 * r.firstOk / r.total) : 0;
    const mins = Math.max(1, Math.round((r.ms || 0) / 60000));
    return `  ${d.slice(5)}(${wd}) ✅ 首次答對 ${r.firstOk}/${r.total}（${pct}%）· ${mins}分` +
      (r.rounds > 1 ? ` · 重做${r.rounds - 1}輪` : '');
  });
  lines.push(`本週每日練習完成 ${doneN}/7 天`);
  lines.push(...dayLines);

  // 本週錯過的題目彙整（取每日紀錄裡的 wrong）
  const wrongCount = {};
  days.forEach((d) => {
    const r = daily[d];
    if (r && r.wrong) r.wrong.forEach((w) => {
      const k = w.t + ':' + w.id;
      wrongCount[k] = (wrongCount[k] || 0) + 1;
    });
  });
  const topWrong = Object.entries(wrongCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topWrong.length) {
    lines.push('');
    lines.push('本週答錯過的題目（前 5）：');
    topWrong.forEach(([k]) => {
      const [t, id] = k.split(':');
      lines.push(`  · ${CAT_NAME[t] || t} ${id}`);
    });
  }

  // 各類累計正確率
  const stats = state.stats || {};
  const statLine = Object.entries(stats)
    .filter(([, s]) => s.n > 0)
    .map(([c, s]) => `${CAT_NAME[c] || c} ${Math.round(100 * s.ok / s.n)}%`)
    .join(' · ');
  if (statLine) {
    lines.push('');
    lines.push('累計正確率：' + statLine);
  }

  // 錯題本現況
  if (Array.isArray(state.wrong)) lines.push(`錯題本待複習：${state.wrong.length} 題`);

  // 本週仿寫
  const wlog = state.writingLog || {};
  const wDays = days.filter((d) => wlog[d]);
  if (wDays.length) lines.push(`寫作仿寫：完成 ${wDays.length} 天`);

  return { text: lines.join('\n'), doneN };
}

async function main() {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT user_id, blob FROM progress WHERE app='chinese' AND level='main'").all();
  db.close();

  let body;
  if (!rows.length) {
    body = '📚 中文複習週報\n\n目前還沒有任何雲端同步資料。\n請確認孩子的裝置已用 Google 登入網站（右上角登入鈕），登入後練習紀錄才會同步上來。';
  } else {
    const parts = [];
    let anyDone = 0;
    rows.forEach((row, i) => {
      let state = null;
      try {
        const blob = JSON.parse(row.blob);
        state = JSON.parse(blob['chinese-review-v1'] || 'null');
      } catch (e) { /* 壞資料跳過 */ }
      if (!state) return;
      const r = reportForUser(state, i, rows.length);
      anyDone += r.doneN;
      parts.push(r.text);
    });
    body = '📚 中文複習週報（' + lastNDays(7)[0] + ' ~ ' + lastNDays(7)[6] + '）\n\n' + parts.join('\n\n──────────\n\n');
    if (!anyDone) body += '\n\n⚠️ 本週完全沒有完成任何每日練習，提醒孩子每天做一回！';
  }

  const res = await fetch(`https://api.telegram.org/bot${tgToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text: body }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error('telegram send failed: ' + JSON.stringify(j).slice(0, 200));
  console.log('weekly report sent');
}

main().catch((e) => { console.error(e); process.exit(1); });
