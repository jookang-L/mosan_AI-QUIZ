/* app.js — 화면 그리기, 입력 처리, 시작 */
'use strict';

var ROOMS = (function () {
  var c = window.AIQ_CONTENT || { rooms: {}, final: null }, list = [];
  for (var i = 1; i <= 5; i++) if (c.rooms[i]) list.push(c.rooms[i]);
  if (c.final) list.push(c.final);
  return list;
})();

/* 정답이면 초록 동그라미, 오답이면 빨간 X를 화면 가운데에 잠깐 크게 보여 준다(#app 밖에 둬서 화면이 다시 그려져도 유지된다) */
var fxEl = document.createElement('div'), fxTimer = null;
fxEl.id = 'fx'; fxEl.setAttribute('aria-hidden', 'true'); document.body.appendChild(fxEl);
var FX_SHAPE = {
  ok: '<svg viewBox="0 0 200 200" fill="none"><circle cx="100" cy="100" r="68" style="stroke:var(--line)" stroke-width="38"/><circle cx="100" cy="100" r="68" style="stroke:var(--leaf)" stroke-width="22"/></svg>',
  bad: '<svg viewBox="0 0 200 200" fill="none" stroke-linecap="round"><path d="M50 50L150 150M150 50L50 150" style="stroke:var(--line)" stroke-width="38"/><path d="M50 50L150 150M150 50L50 150" style="stroke:var(--red)" stroke-width="22"/></svg>'
};

function flash(kind) {
  clearTimeout(fxTimer);
  fxEl.className = ''; fxEl.innerHTML = FX_SHAPE[kind];
  void fxEl.offsetWidth;
  fxEl.className = 'on ' + kind;
  fxTimer = setTimeout(function () { fxEl.className = ''; }, 800);
}

function polish(html) {
  return html.replace(/>([^<>]+)</g, function (m, t) {
    t = t.replace(/\//g, '⁠/⁠').replace(/([가-힣A-Za-z0-9])·/g,'$1⁠·').replace(/·/g, '·<wbr>').replace(/([가-힣’”])\(/g, '$1⁠(').replace(/([’”])([가-힣])/g, '$1⁠$2').replace(/\)([가-힣]{1,3})(?![가-힣])/g, ')⁠$1');
    return '>' + t + '<';
  });
}

function render() {
  var app = $('app'), h = '', s = UI.screen, fx = null;
  document.documentElement.setAttribute('data-reduce', S.reduce ? '1' : '0');
  if (s === 'title') h = sTitle();
  else if (s === 'make') h = sMake();
  else if (s === 'listen') h = sListen();
  else if (s === 'mission') h = hud() + sMission();
  else if (s === 'lab') h = sLab();
  else if (s === 'game') { if (G && G.react && G.react.fresh) fx = G.react.kind === 'bad' ? 'bad' : 'ok'; h = sGame(); }
  else if (s === 'clear') h = sClear();
  else { h = hud() + (UI.tab === 'dex' ? sDex() : UI.tab === 'me' ? sMe() : sLobby()) + tabs(); }
  app.innerHTML = polish('<div class="app">' + h + '</div>');
  if (s === 'lab') placeLab();
  if (fx) { flash(fx); SND.judge(fx); }
  SND.sync();
  if (UI.snap) {
    var t = app.querySelector(UI.snap); UI.snap = null;
    if (t) { var b = t.getBoundingClientRect(); if (b.bottom > window.innerHeight || b.top < 0) t.scrollIntoView({ block: 'nearest', behavior: S.reduce ? 'auto' : 'smooth' }); }
  }
  if (UI.scroll) {
    UI.scroll = false; window.scrollTo(0, 0);
    var f = app.querySelector('[data-focus]');
    if (f) { f.setAttribute('tabindex', '-1'); try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
}

function wrap(v, d, n) { return (v + d + n) % n; }

var DIR = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

function act(a, el) {
  var v = el.getAttribute('data-v'), r, k, g, s;
  switch (a) {
    case 'newgame': go('make'); break;
    case 'resume': UI.back = null; go('listen'); break;
    case 'rand': S.char.type = CHARS[Math.floor(Math.random() * 4)].id; S.char.color = Math.floor(Math.random() * COLORS.length); S.nick.a = Math.floor(Math.random() * ADJ.length); S.nick.n = Math.floor(Math.random() * NOUN.length); render(); break;
    case 'chtype': S.char.type = v; render(); break;
    case 'chcolor': S.char.color = +v; render(); break;
    case 'adj': S.nick.a = wrap(S.nick.a, +v, ADJ.length); render(); break;
    case 'noun': S.nick.n = wrap(S.nick.n, +v, NOUN.length); render(); break;
    case 'enter': S.started = true; save(); UI.back = null; go('listen'); break;
    case 'listen': UI.back = (UI.screen === 'listen' || UI.screen === 'clear') ? null : UI.screen; go('listen'); break;
    case 'resumeact':
      if (UI.back && (G || UI.back === 'main' || UI.back === 'mission')) { var b = UI.back; UI.back = null; go(b); } else { UI.back = null; UI.tab = 'lobby'; go('main'); }
      break;
    case 'tab': UI.tab = v; UI.scroll = true; render(); break;
    case 'room': r = room(+v); if (r && r.ready !== false) { UI.roomId = r.id; UI.back = null; dropG(); go('mission'); } break;
    case 'lobby': dropG(); UI.back = null; UI.tab = 'lobby'; go('main'); break;
    case 'mecard': dropG(); UI.tab = 'me'; go('main'); break;
    case 'gstart': startGame(room(UI.roomId)); break;
    case 'tolab': go('lab'); break;
    case 'dp': labStep(DIR[v][0], DIR[v][1]); break;
    case 'mach': walkTo(+v); break;
    case 'mopen': openMachine(+v); break;
    case 'gitem':
      s = G.st[key(+v)]; if (isDone(s)) break;
      G.sel = (G.sel === +v) ? -1 : +v; if (G.sel >= 0) UI.snap = '.bins'; render(); break;
    case 'gbin':
      if (G.sel < 0) { G.bub = '먼저 위의 카드를 눌러 주세요'; render(); break; }
      g = game(); gradeAssign(G.sel, +v === g.items[G.sel].a); if (G.sel >= 0 && G.stage[key(G.sel)] === 'fix') UI.snap = '.opts'; render(); break;
    case 'gfix': if (G.sel >= 0) { gradeFix(G.sel, +v); render(); } break;
    case 'gord': tapOrder(+v); render(); break;
    case 'gchoice':
      g = game(); k = key(0); s = G.st[k] || 'u'; if (isDone(s)) break;
      if (+v === g.a) { G.st[k] = s === 'u' ? 'ok' : 'fixed'; G.popKey = k; react(G.st[k]); if (gameDone(G.gi)) G.boot = G.gi; }
      else { G.st[k] = 'broken'; (G.picks[k] = G.picks[k] || []).push(+v); react('bad'); }
      saveProg(); render(); break;
    case 'gfinish': finishRoom(); break;
    case 'title': S.titleId = +v; save(); render(); break;
    case 'equip': for (k = 0; k < ITEMS.length; k++) if (ITEMS[k].id === v && cleared(ITEMS[k].room)) { S.equip[ITEMS[k].slot] = S.equip[ITEMS[k].slot] === v ? null : v; save(); render(); } break;
    case 'reduce': S.reduce = !S.reduce; save(); render(); break;
    case 'snd': S.sfx = S.bgm = !(S.sfx || S.bgm); save(); render(); break;
    case 'sfx': S.sfx = !S.sfx; save(); render(); break;
    case 'bgm': S.bgm = !S.bgm; save(); render(); break;
    case 'devclear': if (!DEV) break; for (k = 1; k <= 5; k++) if (!cleared(k)) { S.rooms[k] = { cleared: true, ok: 8, fixed: 0, weak: [] }; eachItem(room(k), function (x) { var c = conceptOf(x.topic); if (!S.topics[c]) S.topics[c] = 'ok'; }); } if (!S.titleId) S.titleId = 3; save(); render(); break;
    case 'devreset': if (!DEV) break; try { localStorage.removeItem(KEY); } catch (e) {} S = fresh(); dropG(); UI.back = null; UI.tab = 'lobby'; go('title'); break;
  }
}

$('app').addEventListener('click', function (e) {
  var el = e.target.closest ? e.target.closest('[data-a]') : null;
  if (el) { SND.begin(); act(el.getAttribute('data-a'), el); SND.after(); }
});

document.addEventListener('keydown', function (e) {
  if (UI.screen !== 'lab' || !G) return;
  var m = { ArrowUp: DIR.u, ArrowDown: DIR.d, ArrowLeft: DIR.l, ArrowRight: DIR.r }[e.key];
  if (m) { e.preventDefault(); labStep(m[0], m[1]); }
});

migrateTopics();
render();
