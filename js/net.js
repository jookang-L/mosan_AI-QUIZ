/* net.js — 점수 장부를 반 대항 서버(Supabase)로 올린다.
 * 원칙: 서버가 막히거나 느려도 게임은 멈추지 않는다. 장부는 폰에 남아 있다가 연결되면 올라간다.
 * 올리는 때: 답을 하고 3초 뒤(그 사이 답은 묶어서 한 번에), 기계 하나를 끝냈을 때, 방송 듣기로 갈 때, 화면을 떠날 때, 반을 고른 때.
 * 한 번에 하나만 올리고(직렬), 실패하면 간격을 늘려 다시 시도한다. */
'use strict';

var NET = (function () {
  var cfg = window.AIQ_NET, busy = false, again = false, dirty = false, ver = 0, timer = null, retryT = null, fails = 0;
  var st = { ok: false, at: 0, err: '' };

  /* 내 컴퓨터(localhost)에서 열었을 때는 시험 점수가 실제 서버에 쌓이지 않게 막는다. 서버까지 시험하려면 주소 끝에 ?net=1 */
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]net=1(?:&|$)/.test(location.search);

  function enabled() { return !!(cfg && S.cls > 0 && !LOCAL); }

  function did() {
    if (!S.did) {
      var a = new Uint8Array(24), s = '', i, cs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      try { crypto.getRandomValues(a); } catch (e) { for (i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
      for (i = 0; i < a.length; i++) s += cs.charAt(a[i] % cs.length);
      S.did = s; save();
    }
    return S.did;
  }

  function mark() {
    ver++; dirty = true;
    if (!timer) timer = setTimeout(function () { timer = null; flush(); }, 3000);   // 답을 하고 3초 안에 올라간다(그 사이 답은 한 번에 묶는다)
  }

  function later(sec) { clearTimeout(retryT); retryT = setTimeout(function () { flush(true); }, sec * 1000 + Math.random() * 1500); }

  function flush(force) {
    if (!enabled()) return;
    if (busy) { again = true; return; }
    if (!dirty && !force && S.regCls === S.cls) return;
    busy = true; again = false;
    var myVer = ver, sent = S.cls, led = Score.enc(), ctl = window.AbortController ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    fetch(cfg.url + '/rest/v1/rpc/submit_ledger', {
      method: 'POST', keepalive: true, signal: ctl ? ctl.signal : undefined,
      headers: { 'Content-Type': 'application/json', apikey: cfg.key },
      body: JSON.stringify({ p_did: did(), p_cls: S.cls, p_ledger: led })
    }).then(function (r) {
      return r.json().then(function (j) { return { s: r.status, j: j }; }, function () { return { s: r.status, j: null }; });
    }).then(function (res) {
      clearTimeout(to); busy = false;
      var j = res.j;
      if (j && j.ok) {
        fails = 0; st = { ok: true, at: Date.now(), err: '' };
        S.regCls = j.cls;
        if (myVer === ver) dirty = false;
        if (Object.keys(led).length) S.clsLock = true;
        if (S.cls !== sent) again = true;   // 보내는 동안 학생이 반을 바꿨으면 새 반으로 다시 올린다
        else if (j.cls !== S.cls) { S.cls = j.cls; save(); if (UI.screen === 'make' || UI.screen === 'main') render(); }
        else save();
        if (again || dirty || S.regCls !== S.cls) later(2);
      } else if (j && j.err === 'slow') { later(2); }
      else if (j && j.err) { st = { ok: false, at: st.at, err: j.err }; later(j.err === 'full' ? 60 : 120); }
      else { fail('http ' + res.s); }
    }).catch(function (e) { clearTimeout(to); busy = false; fail(String(e && e.message || e)); });
  }

  function fail(msg) {
    fails++; st = { ok: false, at: st.at, err: msg };
    later(Math.min(60, 3 * Math.pow(2, Math.min(fails, 5))));
  }

  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('pagehide', function () { flush(); });
  window.addEventListener('online', function () { flush(true); });

  /* 화면에 보여 줄 상태: 'off'(연습·반 미선택) | 'ok' | 'wait' | 'full' */
  function info() {
    if (!enabled()) return { state: 'off', at: 0 };
    if (st.err === 'full') return { state: 'full', at: st.at };
    return { state: (st.ok && !dirty) ? 'ok' : 'wait', at: st.at };
  }

  /* 급하지 않은 올리기는 0~1.5초 흩어서 보낸다(방송 신호에 맞춰 수백 대가 같은 순간에 올리는 일을 줄인다) */
  function soon(force) { setTimeout(function () { flush(force); }, Math.random() * 1500); }

  return { mark: mark, flush: flush, soon: soon, info: info };
})();
