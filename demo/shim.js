/* ══════════════════════════════════════════════════════════════════════
 * 🎬 시연 모드 장치 (shim) — 부모웹앱(test.html / index.html) 안에서만 돈다.
 *
 *  시연 키트(demo/index.html)가 부모웹앱을 iframe(srcdoc)으로 띄울 때
 *  supabase-js 를 불러오는 <script> 자리에 이 파일을 끼워 넣는다.
 *  → 부모웹앱 코드는 한 줄도 안 바꾼다. 화면은 진짜 부모웹앱 그대로다.
 *
 *  하는 일
 *   ① window.supabase.createClient → 가짜 클라이언트 (데이터는 키트의 SN_DB)
 *   ② fetch → 서버(*.supabase.co)로 가는 요청은 가짜로 답한다. 진짜로는 0건 나간다.
 *   ③ localStorage / sessionStorage → 'sndemo:' 이름표로 따로 쓴다
 *      (태블릿에 진짜 자녀를 연결해 둬도 섞이지 않는다)
 *   ④ 서비스워커·푸시 등록 → 아무것도 안 한다
 *
 *  🔴 진짜 서버로 나가려는 요청이 있으면 막고, 키트 화면에 빨간 경고를 띄운다(조용히 넘어가지 않는다).
 * ══════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var P = window.parent;
  var KIT = P && P.SN_KIT;
  if (!KIT) { document.write('<p style="padding:20px;font:16px sans-serif">시연 키트 안에서만 열려요.</p>'); return; }

  /* ── ③ 저장소 이름표 ── */
  var PFX = 'sndemo:';
  var SP = Storage.prototype, gI = SP.getItem, sI = SP.setItem, rI = SP.removeItem, kI = SP.key;
  SP.getItem = function(k){ return gI.call(this, PFX + k); };
  SP.setItem = function(k, v){ return sI.call(this, PFX + k, v); };
  SP.removeItem = function(k){ return rI.call(this, PFX + k); };
  SP.clear = function(){ var a = []; for (var i = 0; i < this.length; i++){ var k = kI.call(this, i); if (k && k.indexOf(PFX) === 0) a.push(k); } a.forEach(function(k){ rI.call(this, k); }, this); };

  /* 첫 화면 바로 열기 — 연결·비밀번호를 건너뛴다 (키트가 매번 지우고 다시 심는다) */
  KIT.seedStorage(localStorage, sessionStorage);

  /* ── ④ 서비스워커·푸시·알림 ── */
  try {
    var fakeReg = { pushManager: { getSubscription: function(){ return Promise.resolve(null); },
                                   subscribe: function(){ return Promise.reject(new Error('시연 모드에서는 알림을 켜지 않아요')); },
                                   permissionState: function(){ return Promise.resolve('denied'); } },
                    update: function(){ return Promise.resolve(); }, unregister: function(){ return Promise.resolve(true); },
                    addEventListener: function(){}, installing: null, waiting: null, active: null, scope: '' };
    if (navigator.serviceWorker) {
      Object.defineProperty(navigator.serviceWorker, 'register', { value: function(){ return Promise.resolve(fakeReg); } });
      Object.defineProperty(navigator.serviceWorker, 'getRegistration', { value: function(){ return Promise.resolve(fakeReg); } });
      Object.defineProperty(navigator.serviceWorker, 'ready', { get: function(){ return Promise.resolve(fakeReg); } });
    }
  } catch(e){}

  /* ── ① 가짜 supabase ── */
  function clone(x){ return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function cmp(a, b){ var na = Number(a), nb = Number(b);
    if (a !== '' && b !== '' && !isNaN(na) && !isNaN(nb)) return na - nb;
    return String(a).localeCompare(String(b)); }

  function Q(table){ this.t = table; this.f = []; this.op = 'select'; this.ord = null; this.lim = null; this.rng = null;
                     this.one = 0; this.cnt = false; this.head = false; this.payload = null; this.conf = null; }
  Q.prototype.select = function(cols, opt){ if (this.op === 'select') this.op = 'select'; if (opt && opt.count) this.cnt = true; if (opt && opt.head) this.head = true; this.sel = true; return this; };
  ['eq','neq','gt','gte','lt','lte','is','like','ilike'].forEach(function(m){
    Q.prototype[m] = function(c, v){ this.f.push([m, c, v]); return this; };
  });
  Q.prototype['in'] = function(c, v){ this.f.push(['in', c, v || []]); return this; };
  Q.prototype.match = function(o){ for (var k in o) this.f.push(['eq', k, o[k]]); return this; };
  Q.prototype.filter = function(c, op, v){ if (op === 'eq') this.f.push(['eq', c, v]); return this; };
  Q.prototype.or = Q.prototype.not = Q.prototype.contains = Q.prototype.textSearch = function(){ return this; };
  Q.prototype.order = function(c, o){ this.ord = [c, !(o && o.ascending === false)]; return this; };
  Q.prototype.limit = function(n){ this.lim = n; return this; };
  Q.prototype.range = function(a, b){ this.rng = [a, b]; return this; };
  Q.prototype.maybeSingle = function(){ this.one = 1; return this; };
  Q.prototype.single = function(){ this.one = 2; return this; };
  Q.prototype.abortSignal = Q.prototype.returns = function(){ return this; };
  Q.prototype.insert = function(rows){ this.op = 'insert'; this.payload = rows; return this; };
  Q.prototype.upsert = function(rows, opt){ this.op = 'upsert'; this.payload = rows; this.conf = (opt && opt.onConflict) || null; return this; };
  Q.prototype.update = function(vals){ this.op = 'update'; this.payload = vals; return this; };
  Q.prototype['delete'] = function(){ this.op = 'delete'; return this; };

  function hit(row, f){
    var m = f[0], v = row[f[1]], x = f[2];
    switch (m){
      case 'eq':  return String(v) === String(x);
      case 'neq': return String(v) !== String(x);
      case 'gt':  return cmp(v, x) > 0;
      case 'gte': return cmp(v, x) >= 0;
      case 'lt':  return cmp(v, x) < 0;
      case 'lte': return cmp(v, x) <= 0;
      case 'is':  return x === null ? v == null : v === x;
      case 'in':  return x.map(String).indexOf(String(v)) >= 0;
      case 'like': case 'ilike':
        var re = new RegExp('^' + String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', m === 'ilike' ? 'i' : '');
        return re.test(String(v == null ? '' : v));
    }
    return true;
  }

  Q.prototype.run = function(){
    if (KIT.touch) KIT.touch(this.t);
    var db = KIT.db(), self = this;
    var tbl = db[this.t]; if (!tbl) tbl = db[this.t] = [];
    var match = function(r){ return self.f.every(function(f){ return hit(r, f); }); };
    var res;
    if (this.op === 'select'){
      var rows = tbl.filter(match);
      if (this.ord){ var c = this.ord[0], asc = this.ord[1]; rows.sort(function(a, b){ return asc ? cmp(a[c], b[c]) : cmp(b[c], a[c]); }); }
      var total = rows.length;
      if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      rows = clone(rows);
      if (this.one) res = { data: rows[0] || null, error: (this.one === 2 && !rows.length) ? { message: '행이 없어요', code: 'PGRST116' } : null };
      else res = { data: this.head ? null : rows, error: null, count: this.cnt ? total : null };
      return res;
    }
    var list = Array.isArray(this.payload) ? this.payload : (this.payload ? [this.payload] : []);
    var changed = [];
    if (this.op === 'insert' || this.op === 'upsert'){
      var keys = (this.conf || '').split(',').map(function(s){ return s.trim(); }).filter(Boolean);
      if (!keys.length && this.op === 'upsert') keys = guessKeys(this.t);
      list.forEach(function(r){
        r = clone(r);
        var i = keys.length ? tbl.findIndex(function(x){ return keys.every(function(k){ return String(x[k]) === String(r[k]); }); }) : -1;
        if (!r.id && self.t !== 'policies' && self.t !== 'global_policies') r.id = 'demo-' + Math.random().toString(36).slice(2, 10);
        r.updated_at = new Date().toISOString();
        if (i >= 0) tbl[i] = Object.assign(tbl[i], r); else tbl.push(r);
        changed.push(r);
      });
    } else if (this.op === 'update'){
      tbl.forEach(function(r){ if (match(r)){ Object.assign(r, clone(self.payload)); changed.push(r); } });
    } else if (this.op === 'delete'){
      for (var i = tbl.length - 1; i >= 0; i--) if (match(tbl[i])) changed.push(tbl.splice(i, 1)[0]);
    }
    KIT.onWrite(this.t, this.op, clone(changed));
    var out = this.sel ? clone(changed) : null;
    return { data: this.one ? (out && out[0]) || null : out, error: null };
  };
  Q.prototype.then = function(ok, no){
    var self = this;
    return new Promise(function(r){ setTimeout(function(){ r(self.run()); }, KIT.latency()); }).then(ok, no);
  };
  function guessKeys(t){ return t === 'policies' ? ['device_code', 'key'] : t === 'global_policies' ? ['key'] : []; }

  function client(){
    return {
      from: function(t){ return new Q(t); },
      rpc: function(fn, args){
        return { then: function(ok, no){ return new Promise(function(r){ setTimeout(function(){ r(KIT.rpc(fn, args || {})); }, KIT.latency()); }).then(ok, no); } };
      },
      channel: function(){ var ch = { on: function(){ return ch; }, subscribe: function(cb){ if (cb) setTimeout(function(){ cb('SUBSCRIBED'); }, 0); return ch; }, unsubscribe: function(){ return Promise.resolve('ok'); } }; return ch; },
      removeChannel: function(){ return Promise.resolve('ok'); },
      removeAllChannels: function(){ return Promise.resolve([]); },
      auth: { getSession: function(){ return Promise.resolve({ data: { session: null }, error: null }); } }
    };
  }
  window.supabase = { createClient: function(){ return client(); } };

  /* ── ② fetch ── */
  var realFetch = window.fetch.bind(window);
  function reply(body, status){
    var txt = typeof body === 'string' ? body : JSON.stringify(body);
    return Promise.resolve(new Response(txt, { status: status || 200, headers: { 'Content-Type': 'application/json' } }));
  }
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var u; try { u = new URL(url, document.baseURI); } catch(e){ u = null; }
    if (u && /\.supabase\.co$/.test(u.hostname)){
      var m = u.pathname.match(/\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/);
      var body = {}; try { body = JSON.parse((init && init.body) || '{}'); } catch(e){}
      if (m) return new Promise(function(r){ setTimeout(function(){ var x = KIT.rpc(m[1], body); r(x.error ? reply(x.error.message || 'error', 400) : reply(x.data)); }, KIT.latency()); });
      if ((init && init.method || 'GET').toUpperCase() === 'GET') return reply([]);
      return reply([], 201);
    }
    if (u && u.origin === location.origin && /\/(test|index)\.html$/.test(u.pathname)){
      return Promise.resolve(new Response(KIT.parentHtml(), { status: 200, headers: { 'Content-Type': 'text/html' } }));
    }
    if (u && u.origin !== location.origin){
      // 밖(유튜브 제목·지도 등)은 시연에 필요 없다 — 조용히 실패시킨다(서버 장애처럼 보이지 않게 404)
      return Promise.resolve(new Response('', { status: 404 }));
    }
    return realFetch(input, init);
  };
  /* XMLHttpRequest·sendBeacon 으로 서버에 가려는 것도 막는다 */
  var XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url){
    if (/supabase\.co/.test(String(url))){ KIT.alarm('XMLHttpRequest ' + url); throw new Error('시연 모드: 서버 요청 막음'); }
    return XO.apply(this, arguments);
  };
  if (navigator.sendBeacon){ var SB = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function(url){ if (/supabase\.co/.test(String(url))){ KIT.alarm('sendBeacon ' + url); return true; } return SB.apply(null, arguments); }; }


  /* 「테스트판입니다 · 진짜로 적용됩니다」 띠(test.html 에만 있음)를 시연 띠로 바꾼다. 없으면(index.html) 작은 표시를 단다 */
  document.addEventListener("DOMContentLoaded", function(){
    var hit = null;
    Array.prototype.forEach.call(document.querySelectorAll("body > div"), function(d){ if (!hit && /테스트판입니다/.test(d.textContent || "")) hit = d; });
    if (hit){ hit.textContent = "🎬 시연 화면이에요 · 진짜 자녀폰과는 연결되지 않아요"; hit.style.background = "#FFF1D6"; hit.style.color = "#8A5A12"; }
    else {
      var b = document.createElement("div");
      b.textContent = "🎬 시연 화면";
      b.style.cssText = "position:fixed;left:50%;top:6px;transform:translateX(-50%);z-index:99999;background:#FFF1D6;color:#8A5A12;font:700 11px/1.8 sans-serif;border-radius:999px;padding:0 10px;pointer-events:none";
      document.body.appendChild(b);
    }
  });
})();
