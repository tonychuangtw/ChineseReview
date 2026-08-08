/* K12學霸養成 cloud sync — Google Identity Services + progress sync API.
 * 比照 LanExamMock/poker 同一套後端（app=chinese），跨裝置同步 localStorage 進度。 */
(function () {
  var CLIENT_ID = "481860179039-gb37qsdogd4vgnn2g5umh73jen02avj4.apps.googleusercontent.com";
  var API_BASE = "https://claudebot500.tailfcf67f.ts.net";

  if (!CLIENT_ID || !API_BASE || typeof window === "undefined") return;

  var TOKEN_KEY = "sync.token";
  var PREFIX = "chinese-review";        // 同步所有這個前綴的 key（目前只有 chinese-review-v1）
  var SYNC_TS_KEY = "chinese-review.sync_ts";
  var PUSH_INTERVAL_MS = 60000;
  var lastPushedHash = null;

  function token() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
  function setToken(t) { try { sessionStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  function jwtPayload(t) {
    try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch (e) { return null; }
  }
  function signedIn() {
    var p = jwtPayload(token());
    return p && p.exp * 1000 > Date.now() ? p : null;
  }

  function gatherKeys() {
    var out = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0 && k !== SYNC_TS_KEY) {
          out[k] = localStorage.getItem(k);
        }
      }
    } catch (e) {}
    return out;
  }
  function blobHash(obj) {
    var s = JSON.stringify(obj), h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h + ":" + s.length;
  }

  function api(method, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + "/api/progress?level=main&app=chinese");
    xhr.setRequestHeader("Authorization", "Bearer " + token());
    if (body) xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onload = function () {
      if (xhr.status === 401) { clearToken(); renderUi(); cb("auth"); return; }
      if (xhr.status < 200 || xhr.status >= 300) { cb("http " + xhr.status); return; }
      var data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) {}
      cb(null, data);
    };
    xhr.onerror = function () { cb("network"); };
    xhr.send(body ? JSON.stringify(body) : null);
  }

  function syncTs() {
    try { return parseInt(localStorage.getItem(SYNC_TS_KEY) || "0", 10) || 0; } catch (e) { return 0; }
  }
  function setSyncTs(ts) {
    try { localStorage.setItem(SYNC_TS_KEY, String(ts)); } catch (e) {}
  }

  function pull(done) {
    api("GET", null, function (err, res) {
      if (err || !res || !res.blob) { if (done) done(err); return; }
      var serverTs = res.updatedAt || 0;
      if (serverTs > syncTs()) {
        try {
          Object.keys(res.blob).forEach(function (k) {
            if (k.indexOf(PREFIX) === 0) localStorage.setItem(k, res.blob[k]);
          });
        } catch (e) {}
        setSyncTs(serverTs);
        if (done) done(null, true);   // applied → caller should reload
        return;
      }
      if (done) done(null, false);
    });
  }

  function push(done) {
    var data = gatherKeys();
    var h = blobHash(data);
    if (h === lastPushedHash) { if (done) done(null, false); return; }
    // 防蓋舊（2026-08-08）：背景舊分頁的定時 push 會把另一台裝置的新進度整包蓋掉。
    // 推送前先看雲端時間戳：比本機 sync_ts 新代表別台寫過 → 改成套用雲端資料並重載，不推。
    api("GET", null, function (gerr, gres) {
      if (!gerr && gres && (gres.updatedAt || 0) > syncTs()) {
        if (gres.blob) {
          try {
            Object.keys(gres.blob).forEach(function (k) {
              if (k.indexOf(PREFIX) === 0) localStorage.setItem(k, gres.blob[k]);
            });
          } catch (e) {}
          setSyncTs(gres.updatedAt);
          location.reload();
          return;
        }
      }
      api("PUT", data, function (err, res) {
        if (err) { if (done) done(err); return; }
        lastPushedHash = h;
        if (res && res.updatedAt) setSyncTs(res.updatedAt);
        setStatus("✓ 已同步");
        if (done) done(null, true);
      });
    });
  }

  /* ---------------- UI ---------------- */
  var ui = null, statusEl = null, statusTimer = null;

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { statusEl.textContent = ""; }, 3000);
  }

  function renderUi() {
    if (!ui) return;
    var p = signedIn();
    if (p) {
      ui.innerHTML = "";
      var chip = document.createElement("button");
      chip.className = "chip sync-chip";
      chip.title = (p.email || "") + " — 點擊登出";
      chip.textContent = (p.given_name || p.name || "?").charAt(0).toUpperCase();
      chip.addEventListener("click", function () {
        if (confirm("登出雲端同步？（本機進度會保留在此裝置）")) {
          clearToken(); lastPushedHash = null; renderUi();
        }
      });
      statusEl = document.createElement("span");
      statusEl.className = "sync-status";
      ui.appendChild(statusEl);
      ui.appendChild(chip);
    } else {
      ui.innerHTML = "";
      statusEl = null;
      var wrap = document.createElement("div");
      wrap.className = "sync-login-wrap";
      var pill = document.createElement("button");
      pill.type = "button";
      pill.className = "chip sync-login";
      pill.textContent = "登入";
      pill.title = "Google 登入，跨裝置同步進度";
      var slot = document.createElement("div");
      slot.className = "gsi-slot";
      wrap.appendChild(pill);
      wrap.appendChild(slot);
      ui.appendChild(wrap);
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.renderButton(slot, { type: "icon", shape: "circle", size: "large" });
      }
    }
  }

  function onCredential(resp) {
    if (!resp || !resp.credential) return;
    setToken(resp.credential);
    renderUi();
    setStatus("同步中…");
    pull(function (err, applied) {
      if (applied) { location.reload(); return; }
      push();
    });
  }

  function initGis() {
    google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: true });
    renderUi();
  }

  function boot() {
    var controls = document.querySelector(".topbar-controls");
    if (!controls) return;
    ui = document.createElement("div");
    ui.className = "sync-ui";
    controls.appendChild(ui);

    var s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = initGis;
    document.head.appendChild(s);

    setInterval(function () { if (signedIn()) push(); }, PUSH_INTERVAL_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && signedIn()) push();
      // 切回分頁時拉一次雲端（2026-08-08）：修「另一台做完、這台舊分頁看不到」——
      // 原本只有登入那一刻會 pull，掛在背景的分頁永遠不更新。
      if (document.visibilityState === "visible" && signedIn()) {
        pull(function (err, applied) { if (applied) location.reload(); });
      }
    });
    // 開頁時若已是登入狀態（分頁還原、session 未過期）也先拉一次
    if (signedIn()) pull(function (err, applied) { if (applied) location.reload(); });
  }

  // 給家長儀表板用的最小介面（授權管理 grants API 走這裡拿 token）
  window.CloudSync = { signedIn: signedIn, token: token, apiBase: API_BASE };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
