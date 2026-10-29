/* admin.js — 방송실 컴퓨터용 반 대항 순위판.
 * 로그인한 관리자만 서버의 집계(admin_board)를 읽는다. 점수는 여기서 계산하므로 규칙(+10/−2/+6/종합 2배)을 설정에서 바꿀 수 있다.
 * ?demo=1 을 붙이면 서버 없이 가짜 점수로 화면을 미리 볼 수 있다. */
'use strict';

(function () {
  var cfg = window.AIQ_NET, C = window.AIQ_CONTENT || { rooms: {}, final: null }, root = document.getElementById('root');
  var DEMO = /[?&]demo=1(?:&|$)/.test(location.search), POLL = DEMO ? 3000 : 10000;

  function jget(k, d) { try { var s = localStorage.getItem(k); if (s) { var o = JSON.parse(s), r = {}, i; for (i in d) r[i] = (o && o[i] !== undefined) ? o[i] : d[i]; return r; } } catch (e) {} return d; }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(i) { return document.getElementById(i); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function strip(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }

  var RULE = jget('aiq-admin-rule', { a: 10, b: 2, c: 6, fm: 2 });
  var VIEW = jget('aiq-admin-view', { hide: false });
  var busy = false, gen = 0, sess = null, board = null, frozen = false, lastOk = 0, err = '', prevRank = null, toastT = null, upT = {}, rh = 40, built = 0, timer = null, demo = null;
  try { sess = JSON.parse(sessionStorage.getItem('aiq-admin-sess')); } catch (e) {}

  /* ---------- 로그인과 서버 호출 ---------- */
  function saveSess(j) {
    sess = { a: j.access_token, r: j.refresh_token, e: Date.now() + (j.expires_in || 3600) * 1000 };
    try { sessionStorage.setItem('aiq-admin-sess', JSON.stringify(sess)); } catch (e) {}
  }

  /* 15초 안에 답이 없으면 끊는다(멈춘 요청 하나가 순위판 갱신을 막지 않게) */
  function tfetch(u, o) {
    var ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 15000);
    if (ctl) o.signal = ctl.signal;
    return fetch(u, o).then(function (r) { clearTimeout(to); return r; }, function (e) { clearTimeout(to); throw e; });
  }

  function authCall(grant, body) {
    return tfetch(cfg.url + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.key }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j || {} }; }, function () { return { ok: r.ok, j: {} }; }); })
      .then(function (x) {
        if (!x.ok) throw { auth: true, msg: /invalid|credentials/i.test(JSON.stringify(x.j)) ? '이메일이나 비밀번호가 맞지 않아요' : (x.j.msg || x.j.error_description || '로그인할 수 없어요') };
        saveSess(x.j);
      });
  }

  function token() {
    if (!sess) return Promise.reject({ auth: true, msg: '' });
    if (sess.e - Date.now() > 60000) return Promise.resolve(sess.a);
    return authCall('refresh_token', { refresh_token: sess.r }).then(function () { return sess.a; });
  }

  function rpc(fn, args) {
    return token().then(function (t) {
      return tfetch(cfg.url + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + t }, body: JSON.stringify(args || {}) });
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (r.status === 401 || r.status === 403) throw { auth: true, msg: r.status === 403 ? '관리자 목록에 없는 계정이에요' : '' };
        if (!r.ok) throw { msg: (j && j.message) || ('HTTP ' + r.status) };
        return j;
      });
    });
  }

  function showLogin(msg) {
    clearInterval(timer); timer = null; built = 0; board = null; prevRank = null; gen++; busy = false;
    root.innerHTML = '<div class="login"><form class="card" id="lf"><h1>반 대항전 관리자</h1><p>방송실 컴퓨터에서 로그인하면 반별 순위가 실시간으로 보여요. 학생 폰에는 순위가 나가지 않아요.</p>' +
      '<label>이메일<input id="em" type="email" autocomplete="username" required></label><label>비밀번호<input id="pw" type="password" autocomplete="current-password" required></label>' +
      '<div class="err" id="le" role="alert">' + esc(msg || '') + '</div><button class="btn" type="submit">로그인</button></form></div>';
    $('lf').addEventListener('submit', function (e) {
      e.preventDefault();
      $('le').textContent = '확인하는 중…';
      authCall('password', { email: $('em').value.trim(), password: $('pw').value }).then(start, function (x) { $('le').textContent = x && x.msg ? x.msg : '서버에 연결할 수 없어요. 인터넷을 확인해 주세요'; });
    });
    $('em').focus();
  }

  /* ---------- 점수 계산과 순위 ---------- */
  function pts(c) { return (c.o1 * RULE.a + c.f1 * RULE.c - c.w1 * RULE.b) + RULE.fm * (c.o2 * RULE.a + c.f2 * RULE.c - c.w2 * RULE.b); }

  function ranked(b) {
    var rows = b.classes.map(function (c) { return { c: c, per: pts(c) / Math.max(1, c.headcount) }; }), order = rows.slice(), rank = {}, prev = null, rk = 0;
    order.sort(function (x, y) { return y.per - x.per || x.c.cls - y.c.cls; });
    order.forEach(function (x, i) { if (prev === null || Math.abs(x.per - prev) > 1e-9) rk = i + 1; rank[x.c.cls] = rk; prev = x.per; });
    var ties = {}; order.forEach(function (x) { ties[rank[x.c.cls]] = (ties[rank[x.c.cls]] || 0) + 1; });
    return { order: order, rank: rank, ties: ties };
  }

  /* ---------- 순위판 그리기 ---------- */
  function build(n) {
    var rows = '', i;
    for (i = 1; i <= n; i++) {
      var h = (i * 47) % 360;
      rows += '<div class="row" id="r' + i + '" data-c="' + i + '"><div class="rank"></div><div class="cls">' + i + '반</div><div class="track"><div class="fill" style="background:linear-gradient(90deg,hsl(' + h + ' 70% 46%),hsl(' + h + ' 85% 62%))"></div></div><div class="val"><b></b><span></span></div></div>';
    }
    root.innerHTML = '<div class="wrap" id="wrap"><header class="top"><h1>AI 골든벨 반 대항전</h1><span class="sub">' + (DEMO ? '데모 화면 · 가짜 점수예요' : '1인당 평균 점수 · 총점 ÷ 반 인원') + '</span><span class="sp"></span>' +
      '<span class="stat" id="st"><i></i><span id="stx">연결 중…</span></span>' +
      '<div class="tools"><button class="btn ghost" id="b-hide"></button><button class="btn ghost" id="b-frz"></button><button class="btn ghost" id="b-ana">분석</button><button class="btn ghost" id="b-set">설정</button><button class="btn ghost" id="b-full">전체화면</button></div></header>' +
      '<main class="board" id="board">' + rows + '<div class="cover" id="cover" hidden><div>점수는 비공개예요<small>공개하면 순위가 짠! 하고 자리를 잡아요</small></div></div></main>' +
      '<footer class="foot">H 점수 숨김·공개 · F 화면 고정 · 학생이 문제를 풀 때마다 약 10초 간격으로 갱신돼요</footer></div><div class="toast" id="toast"></div><div id="modal"></div>';
    built = n;
    $('b-hide').onclick = toggleHide; $('b-frz').onclick = toggleFreeze; $('b-ana').onclick = openAnalysis; $('b-set').onclick = openSettings;
    $('b-full').onclick = function () { var d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); };
    buttons(); layout();
  }

  function buttons() {
    $('b-hide').textContent = VIEW.hide ? '점수 공개하기' : '점수 숨기기';
    $('b-frz').textContent = frozen ? '고정 해제' : '화면 고정';
    $('cover').hidden = !VIEW.hide; $('board').classList.toggle('hidemode', VIEW.hide);
  }

  function layout() {
    var b = $('board'); if (!b || !built) return;
    rh = Math.max(28, Math.floor(b.clientHeight / built)); b.style.setProperty('--rh', rh + 'px');
    if (board) paint();
  }

  function paint() {
    if (!board || !built) return;
    var rk = ranked(board), leader = rk.order.length ? Math.max(rk.order[0].per, 0) : 0, scale = Math.max(80, leader);
    rk.order.forEach(function (x, idx) {
      var c = x.c, el = $('r' + c.cls); if (!el) return;
      var pos = VIEW.hide ? c.cls - 1 : idx, r = rk.rank[c.cls], tie = rk.ties[r] > 1;
      el.style.transform = 'translateY(' + (pos * rh) + 'px)';
      el.classList.toggle('first', !VIEW.hide && r === 1 && x.per > 0);
      el.querySelector('.rank').innerHTML = VIEW.hide ? '' : (tie ? '<small>공동</small>' : '') + r;
      el.querySelector('.fill').style.width = (!VIEW.hide && x.per > 0) ? Math.max(1.5, Math.min(100, x.per / scale * 100)) + '%' : '0%';
      el.querySelector('.val b').textContent = VIEW.hide ? '?' : x.per.toFixed(1);
      var over = c.devices > c.headcount;
      el.querySelector('.val span').innerHTML = (over ? '⚠ ' : '') + c.devices + '/' + c.headcount + '명';
      el.querySelector('.val span').className = over ? 'over' : '';
    });
    paintStatus();
  }

  function paintStatus() {
    var st = $('st'), tx = $('stx'); if (!st) return;
    var total = board ? board.classes.reduce(function (s, c) { return s + c.headcount; }, 0) : 0, stale = !DEMO && lastOk && Date.now() - lastOk > 30000;
    var cls = 'stat', msg;
    if (DEMO) msg = '데모 · ' + clock(Date.now());
    else if (err) { cls += ' bad'; msg = '연결 오류 · 마지막 ' + (lastOk ? clock(lastOk) : '없음') + ' · ' + err; }
    else if (stale) { cls += ' warn'; msg = '갱신이 늦어요 · 마지막 ' + clock(lastOk); }
    else msg = '실시간 · ' + (lastOk ? clock(lastOk) : '대기') + ' · 접속 ' + (board ? board.devices : 0) + '대 / ' + total + '명';
    if (frozen) { cls += ' warn'; msg += ' · 화면 고정'; }
    st.className = cls; tx.textContent = msg;
  }

  function toast(msg) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('on'); }, 4500);
  }

  /* 새 집계가 오면: 순위가 바뀐 반을 알려 준다 */
  function apply() {
    if (frozen) { paintStatus(); return; }
    var rk = ranked(board);
    if (prevRank && !VIEW.hide) {
      var best = null, first = null, c;
      rk.order.forEach(function (x) {
        c = x.c.cls;
        var was = prevRank[c], now = rk.rank[c];
        if (was !== undefined && now < was) { if (!best || was - now > best.d) best = { c: c, d: was - now, now: now }; }
        if (now === 1 && was !== 1 && rk.ties[1] === 1 && x.per > 0) first = c;
        if (was !== undefined && now < was) { var el = $('r' + c); if (el) { el.classList.add('up'); clearTimeout(upT[c]); upT[c] = setTimeout(function (e) { return function () { e.classList.remove('up'); }; }(el), 4000); } }
      });
      if (first) toast('👑 ' + first + '반이 1위로 올라섰어요!');
      else if (best) toast('🔥 ' + best.c + '반이 ' + best.now + '위로 올라왔어요!');
    }
    prevRank = rk.rank;
    paint();
  }

  function toggleHide() { VIEW.hide = !VIEW.hide; jset('aiq-admin-view', VIEW); if (!VIEW.hide && board) prevRank = ranked(board).rank; buttons(); paint(); }
  function toggleFreeze() { frozen = !frozen; buttons(); if (!frozen && board) apply(); else paintStatus(); }

  /* ---------- 설정·분석 창 ---------- */
  function closeModal() { $('modal').innerHTML = ''; }

  function openSettings() {
    var cl = board ? board.classes : [], h = '<div class="modal"><div class="sheet" role="dialog" aria-label="설정"><h2>설정</h2><h3>반별 인원</h3><p>순위는 총점을 이 인원으로 나눠요. 접속하지 않은 학생은 0점으로 계산돼요. 접속 기기가 인원보다 많으면 순위판에 ⚠가 떠요.</p><div class="grid">';
    cl.forEach(function (c) { h += '<label>' + c.cls + '반 <input type="number" min="1" max="100" data-hc="' + c.cls + '" value="' + c.headcount + '"></label>'; });
    h += '</div><h3>점수 규칙</h3><p>화면 계산에만 쓰이는 값이라 언제든 바꿀 수 있어요. 바꾸면 지금까지의 점수도 새 규칙으로 다시 계산돼요.</p><div class="rule">' +
      '<label>한 번에 정답 +<input data-r="a" type="number" value="' + RULE.a + '"></label><label>틀릴 때마다 −<input data-r="b" type="number" value="' + RULE.b + '"></label>' +
      '<label>수리 +<input data-r="c" type="number" value="' + RULE.c + '"></label><label>종합 도전 ×<input data-r="fm" type="number" value="' + RULE.fm + '"></label></div>' +
      '<h3>점수 초기화</h3><p>리허설 기록을 모두 지워요. 되돌릴 수 없어요. 아래 칸에 "초기화"라고 입력해야 눌러져요.</p><div class="acts"><input id="rs" placeholder="초기화" style="height:40px;border-radius:10px;border:2px solid var(--line);background:var(--bg);padding:0 10px;color:#fff"><button class="btn danger" id="do-rs">모두 지우기</button></div>' +
      '<div class="err" id="se"></div><div class="acts"><button class="btn ghost" id="x-out">로그아웃</button><button class="btn ghost" id="x-close">닫기</button><button class="btn" id="x-save">저장</button></div></div></div>';
    $('modal').innerHTML = h;
    $('x-close').onclick = closeModal;
    $('x-out').onclick = function () { sess = null; try { sessionStorage.removeItem('aiq-admin-sess'); } catch (e) {} closeModal(); showLogin(''); };
    $('x-save').onclick = function () {
      var inputs = $('modal').querySelectorAll('[data-r]'), i, chg = [];
      for (i = 0; i < inputs.length; i++) { var v = parseFloat(inputs[i].value); if (!isFinite(v) || v < 0) { $('se').textContent = '점수는 0 이상의 숫자로 넣어 주세요'; return; } RULE[inputs[i].getAttribute('data-r')] = v; }
      jset('aiq-admin-rule', RULE);
      var hc = $('modal').querySelectorAll('[data-hc]');
      for (i = 0; i < hc.length; i++) { var n = Math.round(parseFloat(hc[i].value)), cn = +hc[i].getAttribute('data-hc'), cur = cl.filter(function (c) { return c.cls === cn; })[0]; if (cur && n >= 1 && n <= 100 && n !== cur.headcount) chg.push([cn, n]); }
      $('se').textContent = '저장하는 중…';
      var p = Promise.resolve();
      chg.forEach(function (x) { p = p.then(function () { if (DEMO) { cl.forEach(function (c) { if (c.cls === x[0]) c.headcount = x[1]; }); return; } return rpc('admin_set_headcount', { p_cls: x[0], p_n: x[1] }); }); });
      p.then(function () { closeModal(); return DEMO ? (apply()) : poll(); }).catch(function (e) { $('se').textContent = '저장하지 못했어요: ' + (e && e.msg || '연결을 확인해 주세요'); });
    };
    $('do-rs').onclick = function () {
      if ($('rs').value.trim() !== '초기화') { $('se').textContent = '"초기화"라고 입력해 주세요'; return; }
      if (DEMO) { demoInit(); closeModal(); apply(); return; }
      rpc('admin_reset').then(function (n) { closeModal(); toast('학생 점수 ' + n + '건을 지웠어요'); return poll(); }).catch(function (e) { $('se').textContent = '지우지 못했어요: ' + (e && e.msg || ''); });
    };
  }

  function describe(key) {
    var m = /^(\d+):(\d+)\.(\d+)$/.exec(key); if (!m) return null;
    var room = +m[1] === 6 ? C.final : C.rooms[+m[1]], g = room && room.games[+m[2]], it, text;
    if (!g) return null;
    it = g.kind === 'choice' ? g : g.items[+m[3]]; if (!it) return null;
    text = g.kind === 'choice' ? g.q : g.kind === 'order' ? it.label : it.t;
    return { room: room.title, game: g.name, text: strip(text), topic: strip(it.topic), ref: it.ref || g.ref || '' };
  }

  function openAnalysis() {
    var items = board ? board.items : {}, arr = Object.keys(items).map(function (k) { var v = items[k]; return { k: k, o: v[0], f: v[1], b: v[2], w: v[3], n: v[0] + v[1] + v[2] }; })
      .filter(function (x) { return x.w > 0; }).sort(function (x, y) { return y.w - x.w; }).slice(0, 10);
    var h = '<div class="modal"><div class="sheet" role="dialog" aria-label="분석"><h2>많이 틀린 문항</h2><p>틀린 횟수가 많은 순서예요. 오후 골든벨 전에 방송에서 한 번 더 짚으면 좋은 개념이에요. 문항 번호는 행사 중에 바꾸지 마세요.</p><ol class="list">';
    if (!arr.length) h += '<li><b>·</b><span>아직 틀린 기록이 없어요</span><em></em></li>';
    arr.forEach(function (x, i) {
      var d = describe(x.k);
      h += '<li><b>' + (i + 1) + '</b><span>' + (d ? esc(d.room) + ' · ' + esc(d.game) + '<br>' + esc(d.text) + '<small>' + esc(d.topic) + (d.ref ? ' · ' + esc(d.ref) : '') + '</small>' : esc(x.k)) + '</span><em>' + x.w + '번 틀림 · ' + x.n + '명</em></li>';
    });
    $('modal').innerHTML = h + '</ol><div class="acts"><button class="btn" id="x-close">닫기</button></div></div></div>';
    $('x-close').onclick = closeModal;
  }

  /* 앱의 문항 키("방:게임.문항") 전체 목록 */
  function contentKeys() {
    var a = [];
    [1, 2, 3, 4, 5, 6].forEach(function (r) {
      var room = r === 6 ? C.final : C.rooms[r];
      if (!room) return;
      room.games.forEach(function (g, gi) { var n = g.kind === 'choice' ? 1 : g.items.length, i; for (i = 0; i < n; i++) a.push(r + ':' + gi + '.' + i); });
    });
    return a;
  }

  /* ---------- 데모(서버 없이 미리 보기) ---------- */
  function demoInit() {
    demo = { t: 0, cls: [] };
    for (var i = 1; i <= cfg.classes; i++) demo.cls.push({ cls: i, hc: 26 + Math.floor(Math.random() * 6), speed: 0.5 + Math.random() * 1.0, skill: 0.5 + Math.random() * 0.45, p: 0 });
  }

  function demoBoard() {
    demo.t++;
    var devs = 0, items = {}, k;
    var classes = demo.cls.map(function (d) {
      d.p = Math.min(1, d.p + d.speed * 0.014 * (0.4 + Math.random()));
      var dv = Math.round(d.hc * Math.min(0.97, 0.35 + demo.t * 0.04)), settled1 = dv * d.p * 44, pf = Math.max(0, (d.p - 0.82) / 0.18), settled2 = dv * pf * 10;
      devs += dv;
      return { cls: d.cls, headcount: d.hc, devices: dv, last: null,
        o1: Math.round(settled1 * d.skill), f1: Math.round(settled1 * (1 - d.skill)), w1: Math.round(settled1 * (1 - d.skill) * 1.8),
        o2: Math.round(settled2 * d.skill), f2: Math.round(settled2 * (1 - d.skill)), w2: Math.round(settled2 * (1 - d.skill) * 1.8) };
    });
    var all = contentKeys(), step = Math.max(1, Math.floor(all.length / 8));
    for (k = 0; k < 8 && k * step < all.length; k++) items[all[k * step]] = [30, 20 - k, 3, 60 - k * 6];
    return { now: new Date().toISOString(), devices: devs, classes: classes, items: items };
  }

  /* ---------- 불러오기 반복 ---------- */
  function poll() {
    if (DEMO) { board = demoBoard(); lastOk = Date.now(); if (!built) build(board.classes.length); apply(); return Promise.resolve(); }
    if (busy) return Promise.resolve();   // 한 번에 하나만: 느린 응답이 새 순위를 되돌리지 않게
    busy = true;
    var my = gen;
    return rpc('admin_board').then(function (b) {
      busy = false; if (my !== gen) return;
      board = b; lastOk = Date.now(); err = '';
      if (!built || built !== b.classes.length) build(b.classes.length);
      apply();
    }, function (e) {
      busy = false; if (my !== gen) return;
      if (e && e.auth) { showLogin(e.msg || '다시 로그인해 주세요'); return; }
      err = (e && e.name === 'AbortError') ? '응답이 너무 늦어요' : ((e && e.msg) || '서버에 연결할 수 없어요'); paintStatus();
    });
  }

  function start() {
    clearInterval(timer);
    built = 0; prevRank = null;
    poll();
    timer = setInterval(function () { poll(); }, POLL);
  }

  window.addEventListener('resize', layout);
  setInterval(paintStatus, 1000);
  document.addEventListener('keydown', function (e) {
    if (!built || /INPUT|TEXTAREA/.test(e.target.tagName) || $('modal').firstChild) return;
    if (e.key === 'h' || e.key === 'H') toggleHide(); else if (e.key === 'f' || e.key === 'F') toggleFreeze();
  });

  if (DEMO) { demoInit(); start(); }
  else if (sess) start();
  else showLogin('');
})();
