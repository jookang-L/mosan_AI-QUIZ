/* admin.js — 방송실 컴퓨터용 반 대항 순위판.
 * 로그인한 관리자만 서버의 집계(admin_board)를 읽는다. 점수는 여기서 계산하므로 규칙(+10/−2/+6/종합 2배)을 설정에서 바꿀 수 있다.
 * ?demo=1 을 붙이면 서버 없이 가짜 점수로 화면을 미리 볼 수 있다. */
'use strict';

(function () {
  var cfg = window.AIQ_NET, C = window.AIQ_CONTENT || { rooms: {}, final: null }, root = document.getElementById('root');
  var DEMO = /[?&]demo=1(?:&|$)/.test(location.search), POLL = DEMO ? 3000 : 5000;

  function jget(k, d) { try { var s = localStorage.getItem(k); if (s) { var o = JSON.parse(s), r = {}, i; for (i in d) r[i] = (o && o[i] !== undefined) ? o[i] : d[i]; return r; } } catch (e) {} return d; }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function $(i) { return document.getElementById(i); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function strip(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* 반 점수 = 그 반 학생들이 받은 점수의 합(나누지 않는다) */
  var RULE = jget('aiq-admin-rule', { a: 10, b: 2, c: 6, fm: 2 });
  function fmt(v) { return Math.round(v).toLocaleString('ko-KR'); }
  function subtitle() { return '반 점수 = 학생들이 받은 점수의 합'; }
  var VIEW = jget('aiq-admin-view', { hide: false });
  var busy = false, gen = 0, sess = null, board = null, frozen = false, lastOk = 0, err = '', prevRank = null, toastT = null, upT = {}, rh = 40, built = 0, timer = null, demo = null;
  try { sess = JSON.parse(sessionStorage.getItem('aiq-admin-sess')); } catch (e) {}

  /* 역전 연출과 마지막 스퍼트. TOP위 안에서 일어난 역전만 알려 주고, 종료 시각(t, 밀리초)과 스퍼트 시작 분(m)은 이 컴퓨터에만 저장한다(데모는 따로). */
  var TOP = 5, END_KEY = DEMO ? 'aiq-admin-end-demo' : 'aiq-admin-end', END = jget(END_KEY, { t: 0, m: 10 });
  var flipT = null, flipAt = 0, burstT = null, chgT = {}, lastPhase, spOn = false;

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
    var rows = b.classes.map(function (c) { return { c: c, per: pts(c) }; }), order = rows.slice(), rank = {}, prev = null, rk = 0;
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
      rows += '<div class="row" id="r' + i + '" data-c="' + i + '"><div class="rank"></div><div class="chg"></div><div class="cls">' + i + '반</div><div class="track"><div class="fill" style="background:linear-gradient(90deg,hsl(' + h + ' 70% 46%),hsl(' + h + ' 85% 62%))"></div></div><div class="val"><b></b><span></span></div></div>';
    }
    root.innerHTML = '<div class="wrap" id="wrap"><header class="top"><h1>AI 골든벨 반 대항전</h1><span class="sub" id="sub"></span><span class="sp"></span>' +
      '<span class="stat cd" id="cd" hidden></span><span class="stat" id="st"><i></i><span id="stx">연결 중…</span></span>' +
      '<div class="tools"><button class="btn ghost" id="b-hide"></button><button class="btn ghost" id="b-frz"></button><button class="btn ghost" id="b-ana">분석</button><button class="btn ghost" id="b-set">설정</button><button class="btn ghost" id="b-full">전체화면</button></div></header>' +
      '<div class="sprint" id="sprint" hidden></div><main class="board" id="board">' + rows + '<div class="cover" id="cover" hidden><div>점수는 비공개예요<small>공개하면 순위가 짠! 하고 자리를 잡아요</small></div></div></main>' +
      '<footer class="foot">H 점수 숨김·공개 · F 화면 고정 · 학생이 문제를 풀면 몇 초 안에 순위판에 반영돼요</footer></div><div class="toast" id="toast"></div><div class="flip" id="flip" role="status"><b></b><span></span></div><div class="burst" id="burst" role="status"><div><b></b><span></span></div></div><div id="modal"></div>';
    built = n; spOn = false;
    $('b-hide').onclick = toggleHide; $('b-frz').onclick = toggleFreeze; $('b-ana').onclick = openAnalysis; $('b-set').onclick = openSettings;
    $('b-full').onclick = function () { var d = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (d.requestFullscreen) d.requestFullscreen(); };
    buttons(); layout(); paintClock();
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
    var rk = ranked(board), leader = rk.order.length ? Math.max(rk.order[0].per, 0) : 0, scale = Math.max(500, leader);
    $('sub').textContent = (DEMO ? '데모 · 가짜 점수 · ' : '') + subtitle();
    rk.order.forEach(function (x, idx) {
      var c = x.c, el = $('r' + c.cls); if (!el) return;
      var pos = VIEW.hide ? c.cls - 1 : idx, r = rk.rank[c.cls], tie = rk.ties[r] > 1;
      el.style.transform = 'translateY(' + (pos * rh) + 'px)';
      el.classList.toggle('first', !VIEW.hide && r === 1 && x.per > 0);
      el.querySelector('.rank').innerHTML = VIEW.hide ? '' : (tie ? '<small>공동</small>' : '') + r;
      el.querySelector('.fill').style.width = (!VIEW.hide && x.per > 0) ? Math.max(1.5, Math.min(100, x.per / scale * 100)) + '%' : '0%';
      el.querySelector('.val b').textContent = VIEW.hide ? '?' : fmt(x.per);
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

  /* ---------- 역전 연출 ----------
   * 지난 집계에서 뒤에 있던 반이 이번에 앞 반을 제치면 "역전". 앞지른 반이 TOP위 안일 때만 알린다.
   * 점수를 숨긴 동안과 화면 고정 중에는 알리지 않는다(순위가 새어 나가면 안 되니까). */
  function flips(rk) {
    var cl = rk.order.map(function (x) { return x.c.cls; }), per = {}, ev = {};
    rk.order.forEach(function (x) { per[x.c.cls] = x.per; });
    cl.forEach(function (a) {
      if (prevRank[a] === undefined || rk.rank[a] > TOP || !(per[a] > 0)) return;
      cl.forEach(function (b) {
        if (a !== b && prevRank[b] !== undefined && prevRank[a] > prevRank[b] && rk.rank[a] < rk.rank[b]) (ev[a] = ev[a] || []).push(b);
      });
    });
    return ev;   // { 앞지른 반: [제친 반들] }
  }

  /* 순위표 옆 ▲▼ 표시와 노란 테두리(몇 초 뒤 저절로 사라진다) */
  function mark(c, dir, n) {
    var el = $('r' + c); if (!el) return;
    var g = el.querySelector('.chg');
    g.className = 'chg ' + dir; g.textContent = (dir === 'up' ? '▲' : '▼') + n;
    clearTimeout(chgT[c]); chgT[c] = setTimeout(function () { g.className = 'chg'; g.textContent = ''; }, 6000);
    if (dir === 'up') { el.classList.add('up'); clearTimeout(upT[c]); upT[c] = setTimeout(function () { el.classList.remove('up'); }, 4000); }
  }

  function clearFx() {
    var f = $('flip'), c;
    clearTimeout(flipT); if (f) f.className = 'flip';
    for (c in chgT) { clearTimeout(chgT[c]); var el = $('r' + c); if (el) { el.querySelector('.chg').className = 'chg'; el.querySelector('.chg').textContent = ''; } }
    for (c in upT) { clearTimeout(upT[c]); var r = $('r' + c); if (r) r.classList.remove('up'); }
    chgT = {}; upT = {};
  }

  function showFlip(h, s, lead) {
    var f = $('flip'); if (!f) return;
    f.querySelector('b').textContent = h; f.querySelector('span').textContent = s;
    f.className = 'flip on' + (lead ? ' lead' : '');
    clearTimeout(flipT); flipT = setTimeout(function () { f.className = 'flip'; }, lead ? 5200 : 3800);
  }

  function announce(rk) {
    var ev = flips(rk), ids = Object.keys(ev), lead = 0, best = 0, a, bs, names, ph, cool;
    if (!ids.length) return;
    ids.forEach(function (k) {
      var c = +k, n = rk.rank[c];
      mark(c, 'up', prevRank[c] - n);
      ev[k].forEach(function (b) { if (rk.rank[b] > prevRank[b]) mark(b, 'dn', rk.rank[b] - prevRank[b]); });
      if (n === 1 && prevRank[c] !== 1 && rk.ties[1] === 1) lead = c;
      if (!best || n < rk.rank[best] || (n === rk.rank[best] && prevRank[c] - n > prevRank[best] - rk.rank[best])) best = c;
    });
    ph = phase(); cool = (ph && (ph.k === 'spurt' || ph.k === 'last')) ? 6000 : 12000;   // 너무 잦으면 정신없어서 간격을 둔다(1위가 바뀔 때는 늘 알린다)
    if (!lead && Date.now() - flipAt < cool) return;
    a = lead || best;
    bs = ev[a].slice().sort(function (p, q) { return prevRank[p] - prevRank[q] || p - q; });   // 원래 더 높았던 반부터
    names = bs.slice(0, 2).map(function (c) { return c + '반'; }).join('·') + (bs.length > 2 ? ' 외 ' + (bs.length - 2) + '반' : '');
    showFlip(lead ? '👑 1위 교체!' : '🔄 역전!', a + '반이 ' + names + '을 제쳤어요 · ' + prevRank[a] + '위 → ' + rk.rank[a] + '위', !!lead);
    flipAt = Date.now();
  }

  /* ---------- 종료 시각과 마지막 스퍼트 ---------- */
  function fmtLeft(ms) { var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ':' + pad(m) : pad(m)) + ':' + pad(s % 60); }

  /* wait(아직 멀었어요) → spurt(마지막 N분) → last(마지막 1분) → over(끝). 끝난 지 30분이 지나면 잊는다 */
  function phase() {
    if (!END.t) return null;
    var left = END.t - Date.now();
    if (left <= -30 * 60000) return null;
    if (left <= 0) return { k: 'over', left: 0 };
    if (left <= 60000) return { k: 'last', left: left };
    if (left <= END.m * 60000) return { k: 'spurt', left: left };
    return { k: 'wait', left: left };
  }

  function burst(k, p) {
    var b = $('burst'); if (!b) return;
    var t = { spurt: ['🔥 마지막 스퍼트!', Math.ceil(p.left / 60000) + '분 남았어요. 한 문제라도 더 풀어요!'], last: ['⏱ 마지막 1분!', '끝까지 힘내요!'], over: ['🏁 시간 종료!', VIEW.hide ? 'H 키를 눌러 점수를 공개해요' : '수고했어요! 순위를 확인해요'] }[k];
    b.className = 'burst on ' + k; b.querySelector('b').textContent = t[0]; b.querySelector('span').textContent = t[1];
    clearTimeout(burstT); burstT = setTimeout(function () { b.className = 'burst ' + k; }, 3600);
  }

  /* 1초마다: 남은 시간 칩, 스퍼트 띠, 단계가 바뀔 때의 큰 알림 */
  function paintClock() {
    var sp = $('sprint'), cd = $('cd'); if (!sp || !cd) return;
    var p = phase(), k = p ? p.k : 'none', on = k === 'spurt' || k === 'last' || k === 'over';
    if (k !== lastPhase) { if (lastPhase !== undefined && on) burst(k, p); lastPhase = k; }
    cd.hidden = k !== 'wait'; if (k === 'wait') cd.textContent = '⏱ 종료까지 ' + fmtLeft(p.left);
    sp.hidden = !on;
    if (on) {
      var hint = k === 'over' ? (VIEW.hide ? 'H 점수 공개 · F 화면 고정' : 'F 화면 고정으로 순위를 굳힐 수 있어요') : (VIEW.hide ? 'H 키로 점수 공개' : '');
      sp.className = 'sprint ' + k;
      sp.innerHTML = '<b>' + (k === 'spurt' ? '🔥 마지막 스퍼트!' : k === 'last' ? '⏱ 마지막 1분!' : '🏁 시간 종료') + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + (k === 'over' ? '' : '<strong>' + fmtLeft(p.left) + '</strong>');
    }
    if (on !== spOn) { spOn = on; layout(); }   // 띠가 생기거나 사라지면 순위 칸 높이를 다시 맞춘다
  }

  /* 새 집계가 오면: 역전을 알리고 순위판을 다시 그린다 */
  function apply() {
    if (frozen) { paintStatus(); return; }
    var rk = ranked(board);
    if (prevRank && !VIEW.hide) announce(rk);
    prevRank = rk.rank;
    paint();
  }

  function toggleHide() { VIEW.hide = !VIEW.hide; jset('aiq-admin-view', VIEW); if (VIEW.hide) clearFx(); else if (board) prevRank = ranked(board).rank; buttons(); paint(); paintClock(); }
  function toggleFreeze() { frozen = !frozen; buttons(); if (!frozen && board) { prevRank = null; apply(); } else paintStatus(); }   // 고정을 풀 때는 그동안 바뀐 것을 한꺼번에 알리지 않는다

  /* ---------- 설정·분석 창 ---------- */
  function closeModal() { $('modal').innerHTML = ''; }

  /* 설정 창의 시간 칸에 넣을 값: 오늘의 종료 시각이면 "HH:MM", 아니면 빈 칸 */
  function endVal() { if (!END.t || new Date(END.t).toDateString() !== new Date().toDateString()) return ''; var d = new Date(END.t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function openSettings() {
    var cl = board ? board.classes : [], h = '<div class="modal"><div class="sheet" role="dialog" aria-label="설정"><h2>설정</h2><h3>반별 인원</h3><p>순위에는 쓰이지 않아요(반 점수는 학생들이 받은 점수의 합이에요). 반별 "접속 n/인원명" 표시와, 가짜 기기를 막는 상한(인원의 1.5배+3대)에 쓰여요. 접속 기기가 인원보다 많으면 순위판에 ⚠가 떠요.</p><div class="grid">';
    cl.forEach(function (c) { h += '<label>' + c.cls + '반 <input type="number" min="1" max="100" data-hc="' + c.cls + '" value="' + c.headcount + '"></label>'; });
    h += '</div><h3>점수 규칙</h3><p>화면 계산에만 쓰이는 값이라 언제든 바꿀 수 있어요. 바꾸면 지금까지의 점수도 새 규칙으로 다시 계산돼요.</p><div class="rule">' +
      '<label>한 번에 정답 +<input data-r="a" type="number" value="' + RULE.a + '"></label><label>틀릴 때마다 −<input data-r="b" type="number" value="' + RULE.b + '"></label>' +
      '<label>수리 +<input data-r="c" type="number" value="' + RULE.c + '"></label><label>종합 도전 ×<input data-r="fm" type="number" value="' + RULE.fm + '"></label></div>' +
      '<h3>종료 시각 · 마지막 스퍼트</h3><p>종료 시각을 정하면 위쪽에 남은 시간이 보이고, 마지막 몇 분이 되면 "마지막 스퍼트!" 배너가 떠요. 점수는 저절로 공개되지 않아요(H 키로 직접). 시간이 끝나도 점수 반영은 멈추지 않으니, 순위를 굳히려면 F 키로 화면을 고정하세요.</p><div class="rule">' +
      '<label>종료 시각 <input id="endt" type="time" value="' + endVal() + '" style="width:130px"></label><label>또는 지금부터 <input id="endin" type="number" min="1" max="300" placeholder="분"> 분 뒤</label>' +
      '<label>스퍼트 시작 <input id="spm" type="number" min="1" max="30" value="' + END.m + '"> 분 전</label><button class="btn ghost" id="end-clr" type="button" style="height:40px;font-size:15px">종료 시각 지우기</button></div>' +
      '<h3>점수 초기화</h3><p>리허설 기록을 모두 지워요. 되돌릴 수 없어요. 아래 칸에 "초기화"라고 입력해야 눌러져요.</p><div class="acts"><input id="rs" placeholder="초기화" style="height:40px;border-radius:10px;border:2px solid var(--line);background:var(--bg);padding:0 10px;color:#fff"><button class="btn danger" id="do-rs">모두 지우기</button></div>' +
      '<div class="err" id="se"></div><div class="acts"><button class="btn ghost" id="x-out">로그아웃</button><button class="btn ghost" id="x-close">닫기</button><button class="btn" id="x-save">저장</button></div></div></div>';
    $('modal').innerHTML = h;
    $('x-close').onclick = closeModal;
    $('end-clr').onclick = function () { END.t = 0; jset(END_KEY, END); $('endt').value = ''; $('endin').value = ''; paintClock(); };
    $('x-out').onclick = function () { sess = null; try { sessionStorage.removeItem('aiq-admin-sess'); } catch (e) {} closeModal(); showLogin(''); };
    $('x-save').onclick = function () {
      var inputs = $('modal').querySelectorAll('[data-r]'), i, chg = [];
      var spm = Math.round(parseFloat($('spm').value)), eIn = $('endin').value, eT = $('endt').value, newEnd = END.t, mins, tm, dd;
      if (!(spm >= 1 && spm <= 30)) { $('se').textContent = '스퍼트 시작은 1~30분 전으로 넣어 주세요'; return; }
      if (eIn !== '') {
        mins = parseFloat(eIn);
        if (!(mins >= 1 && mins <= 300)) { $('se').textContent = '"지금부터 몇 분 뒤"는 1~300 사이로 넣어 주세요'; return; }
        newEnd = Date.now() + mins * 60000;
      } else if (eT && eT !== endVal()) {
        tm = /^(\d\d):(\d\d)$/.exec(eT); dd = new Date(); dd.setHours(+tm[1], +tm[2], 0, 0); newEnd = dd.getTime();
        if (newEnd < Date.now() - 30 * 60000) { $('se').textContent = '이미 지난 시각이에요. 종료 시각을 다시 넣어 주세요'; return; }
      }
      for (i = 0; i < inputs.length; i++) { var v = parseFloat(inputs[i].value); if (!isFinite(v) || v < 0) { $('se').textContent = '점수는 0 이상의 숫자로 넣어 주세요'; return; } RULE[inputs[i].getAttribute('data-r')] = v; }
      jset('aiq-admin-rule', RULE);
      if (newEnd !== END.t || spm !== END.m) { END.t = newEnd; END.m = spm; jset(END_KEY, END); lastPhase = 'none'; paintClock(); }   // 시각을 바꾸면 해당 단계의 큰 알림이 바로 뜬다
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
  setInterval(function () { paintStatus(); paintClock(); }, 1000);
  document.addEventListener('keydown', function (e) {
    if (!built || /INPUT|TEXTAREA/.test(e.target.tagName) || $('modal').firstChild) return;
    if (e.key === 'h' || e.key === 'H') toggleHide(); else if (e.key === 'f' || e.key === 'F') toggleFreeze();
  });

  if (DEMO) { demoInit(); start(); }
  else if (sess) start();
  else showLogin('');
})();
