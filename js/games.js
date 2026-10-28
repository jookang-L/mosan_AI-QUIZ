/* games.js — 게임 진행(분류·버그 잡기·점검), 연구소 이동, 게임 화면 */
'use strict';

function game() { return G.room.games[G.gi]; }

function gcount(g) { return g.kind === 'choice' ? 1 : g.items.length; }

function key(i) { return G.gi + '.' + i; }

function allKeys() { var a = []; G.room.games.forEach(function (g, gi) { for (var i = 0; i < gcount(g); i++) a.push(gi + '.' + i); }); return a; }

function isDone(s) { return s === 'ok' || s === 'fixed'; }

function gameDone(gi) { var g = G.room.games[gi]; for (var i = 0; i < gcount(g); i++) if (!isDone(G.st[gi + '.' + i])) return false; return true; }

function remaining() { var n = 0; G.room.games.forEach(function (_, gi) { if (!gameDone(gi)) n++; }); return n; }

function itemOf(k) { var p = k.split('.'), g = G.room.games[+p[0]]; return g.kind === 'choice' ? g : g.items[+p[1]]; }

function saveProg() { S.prog[G.room.id] = { st: G.st, picks: G.picks, stage: G.stage, miss: G.miss, fixWrong: G.fixWrong }; save(); }

function prepGame() {
  var g = game(); G.sel = -1; G.bub = g.say;
  G.badTap = null;
  if (g.kind === 'choice') G.order = shuffle(g.options.map(function (_, i) { return i; }));
  else if (g.kind === 'order') G.ord[G.gi] = shuffle(g.items.map(function (_, i) { return i; }));
  else for (var i = 0; i < g.items.length; i++) if (G.stage[G.gi + '.' + i] === 'fix') { G.sel = i; G.bub = pickOne(SAY.found); break; }
}

function startGame(r) {
  var p = S.prog[r.id] || {};
  G = { room: r, gi: 0, st: p.st || {}, picks: p.picks || {}, stage: p.stage || {}, miss: p.miss || {}, fixWrong: p.fixWrong || {}, fixOrder: {}, ord: {}, mpos: mposFor(r.games.length), badTap: null, boot: null, popKey: null, pulseKey: null, sel: -1, react: null, bub: '', pc: 3, pr: 4, walk: null, walkT: null };
  if (r.noLab) { G.gi = 0; prepGame(); go('game'); } else go('lab');
}

function openMachine(i) { stopWalk(); G.gi = i; prepGame(); go('game'); }

function react(kind) { G.bub = pickOne(SAY[kind]); G.react = { kind: kind, fresh: true }; }

function completeItem(i) {
  var k = key(i), was = gameDone(G.gi);
  G.st[k] = G.miss[k] ? 'fixed' : 'ok'; delete G.stage[k];
  G.popKey = k; G.pulseKey = k; react(G.st[k]); G.sel = -1;
  if (!was && gameDone(G.gi)) G.boot = G.gi;
}

function gradeAssign(i, ok) {
  var it = game().items[i], k = key(i);
  if (ok) {
    if (it.fix) { G.stage[k] = 'fix'; G.bub = pickOne(SAY.found); G.react = { kind: 'ok', fresh: true }; }
    else completeItem(i);
  } else { G.st[k] = 'broken'; G.miss[k] = true; react('bad'); G.sel = -1; }
  saveProg();
}

function gradeFix(i, oi) {
  var it = game().items[i], k = key(i);
  if (it.fix.options[oi].ok) completeItem(i);
  else { G.st[k] = 'broken'; G.miss[k] = true; (G.fixWrong[k] = G.fixWrong[k] || []).push(oi); react('bad'); }
  saveProg();
}

function fixOrderFor(k, n) {
  if (!G.fixOrder[k]) { var a = []; for (var i = 0; i < n; i++) a.push(i); G.fixOrder[k] = shuffle(a); }
  return G.fixOrder[k];
}

function cmpHTML(f) {
  return '<span class="cmp"><span class="cmp-row"><i>고치기 전</i><span>' + f.before + '</span></span><span class="cmp-row after"><i>고친 후</i><span>' + f.after + '</span></span></span>';
}

function finishRoom() {
  var id = G.room.id, ok = 0, fx = 0, weak = [], seen = {}, it = itemFor(id);
  allKeys().forEach(function (k) {
    if (G.st[k] === 'ok') ok++;
    else { fx++; var x = itemOf(k); if (!seen[x.topic]) { seen[x.topic] = 1; weak.push({ topic: x.topic, ref: x.ref }); } }
  });
  S.rooms[id] = { cleared: true, ok: ok, fixed: fx, weak: weak };
  recordConcepts();
  S.titleId = id;
  if (it) S.equip[it.slot] = it.id;
  delete S.prog[id];
  save(); UI.roomId = id; UI.back = null; UI.keys = allKeys().map(function (k) { return G.st[k]; }); dropG(); go('clear');
}

/* 개념 확인 기록: S.topics[개념] = 'ok'(바로 맞힘) | 'fixed'(해설을 읽고 고침). 다시 도전하거나 종합 도전에서 만나면 최신 결과로 바뀐다. */
function conceptOf(t) { return t.replace(/:.*$/, ''); }

function eachItem(r, fn) { r.games.forEach(function (g) { (g.kind === 'choice' ? [g] : g.items).forEach(fn); }); }

function conceptList() {
  var a = [], seen = {};
  ROOMS.forEach(function (r) {
    if (r.noLab) return;
    eachItem(r, function (x) {
      var c = conceptOf(x.topic);
      if (!seen[c]) { seen[c] = 1; a.push({ c: c, page: parseInt(x.ref.replace(/\D/g, ''), 10), i: a.length }); }
    });
  });
  return a.sort(function (p, q) { return p.page - q.page || p.i - q.i; });
}

function recordConcepts() {
  var mark = {}, c;
  allKeys().forEach(function (k) {
    c = conceptOf(itemOf(k).topic);
    if (G.st[k] !== 'ok') mark[c] = 'fixed'; else if (!mark[c]) mark[c] = 'ok';
  });
  S.topics = S.topics || {};
  for (c in mark) S.topics[c] = mark[c];
}

function migrateTopics() {
  if (S.topics) return;
  S.topics = {};
  ROOMS.forEach(function (r) {
    var info = S.rooms[r.id], weak = {};
    if (!info || !info.cleared) return;
    (info.weak || []).forEach(function (w) { weak[conceptOf(w.topic)] = 1; });
    eachItem(r, function (x) { var c = conceptOf(x.topic); if (weak[c]) S.topics[c] = 'fixed'; else if (S.topics[c] !== 'fixed') S.topics[c] = 'ok'; });
  });
  save();
}

function gaugeHTML(states) {
  var c = '';
  states.forEach(function (s) { c += '<i class="' + (s === 'u' || !s ? '' : s) + '"></i>'; });
  return '<div class="gauge" aria-hidden="true">' + c + '</div>';
}

function gaugeBlock() {
  var keys = allKeys(), done = 0, c = '';
  keys.forEach(function (k) { var s = G.st[k] || 'u'; if (isDone(s)) done++; c += '<i class="' + (s === 'u' ? '' : s) + (G.popKey === k ? ' pop' : '') + '"></i>'; });
  G.popKey = null;
  return '<div class="gtext"><span>연구소 복구 ' + done + ' / ' + keys.length + '</span><span class="legend"><span><i class="ok"></i>정상</span><span><i class="fixed"></i>수리</span><span><i class="broken"></i>고장</span></span></div><div class="gauge" aria-hidden="true">' + c + '</div>';
}

function mposFor(n) { var cols = n >= 4 ? [0, 2, 4, 6] : [1, 3, 5]; return cols.slice(0, n).map(function (c) { return { c: c, r: 1 }; }); }

function mAt(c, r) { for (var i = 0; i < G.mpos.length; i++) if (G.mpos[i].c === c && G.mpos[i].r === r) return i; return -1; }

function labFree(c, r) { return c >= 0 && c < 7 && r >= 1 && r < 5 && mAt(c, r) < 0; }

function machProg(i) { var g = G.room.games[i], n = gcount(g), d = 0; for (var k = 0; k < n; k++) if (isDone(G.st[i + '.' + k])) d++; return d + '/' + n; }

function sLab() {
  var rem = remaining(), total = G.room.games.length, boot = G.boot, booted = boot !== null && boot !== undefined; G.boot = null;
  var say = booted ? (rem === 0 ? '연구소 복구 완료! 불이 모두 켜졌어요.' : G.room.games[boot].mname + ' 가동! 연구소가 밝아졌어요.') : (rem === total ? '기계를 눌러서 고치러 가요!' : '고장난 기계가 ' + rem + '대 남았어요. 기계 쪽으로 가 보세요!');
  var h = '<div class="top"><button class="btn small" data-a="lobby">' + ico('left') + '로비</button>' + sndBtn() + '<button class="btn small" data-a="listen">' + ico('lc_headset') + '방송 듣기</button></div>' +
    '<section class="stack"><div class="ghud"><div class="av' + (booted ? ' jump' : '') + '">' + me() + '</div><div class="bubble" data-focus role="status">' + say + '</div></div><div>' + gaugeBlock() + '</div></section>' +
    '<div class="plate' + (rem === 0 ? ' on' : '') + '" role="status"><span>' + G.room.lab + '</span><b>' + (rem === 0 ? '가동 중' : '점검 중') + '</b></div>' +
    '<div class="lab" id="lab" style="--dim:' + (0.26 * rem / total).toFixed(2) + '"><div class="wall" aria-hidden="true"></div>';
  G.room.games.forEach(function (g, gi) {
    var d = gameDone(gi), cx = G.mpos[gi].c * 100 / 7 + 100 / 14;
    h += '<i class="lamp' + (d ? ' on' : '') + '" style="left:' + cx + '%" aria-hidden="true"></i><i class="cable' + (d ? ' on' : '') + '" style="left:' + cx + '%" aria-hidden="true"></i>' +
      '<button class="mach ' + (d ? 'ok' : 'bad') + (booted && boot === gi ? ' boot' : '') + '" data-a="mach" data-v="' + gi + '" aria-label="' + (gi + 1) + '번 ' + g.mname + ' ' + (d ? '정상' : '고장') + '" style="left:' + (G.mpos[gi].c * 100 / 7) + '%;top:' + (G.mpos[gi].r * 20) + '%"><span class="box">' + ico(d ? 'check' : g.mic) + '</span><span class="mn">' + (gi + 1) + '</span></button>';
  });
  h += '<div class="player" id="labp" style="left:' + (G.pc * 100 / 7) + '%;top:' + (G.pr * 20) + '%">' + me() + '</div></div>' +
    '<div class="labctl"><div class="dpad"><span></span><button class="btn" data-a="dp" data-v="u" aria-label="위로">' + ico('up') + '</button><span></span>' +
    '<button class="btn" data-a="dp" data-v="l" aria-label="왼쪽">' + ico('left') + '</button><button class="btn" data-a="dp" data-v="d" aria-label="아래로">' + ico('down') + '</button><button class="btn" data-a="dp" data-v="r" aria-label="오른쪽">' + ico('right') + '</button></div>' +
    '<p class="note">기계 쪽으로 걸어가면 바로 시작해요.<br>기계를 눌러도 알아서 걸어가요.</p></div>' +
    (rem === 0 ? '<button class="btn grape block" data-a="gfinish">결과 보기' + ico('right') + '</button>' : '') +
    '<section class="stack"><h3>바로 가기</h3>';
  G.room.games.forEach(function (g, gi) {
    var d = gameDone(gi);
    h += '<button class="room' + (d ? ' done' : '') + '" data-a="mopen" data-v="' + gi + '"><span class="num">' + (gi + 1) + '</span><span class="tx"><b>' + g.mname + '</b><span>' + g.name + ' · ' + machProg(gi) + '</span></span><span class="st">' + (d ? ico('check') + '정상' : ico('bug') + '고장') + '</span></button>';
  });
  return h + '</section>';
}

function placeLab() {
  var p = $('labp'); if (!p || !G) return;
  p.style.left = (G.pc * 100 / 7) + '%'; p.style.top = (G.pr * 20) + '%';
  var ms = document.querySelectorAll('.mach');
  for (var i = 0; i < ms.length; i++) ms[i].classList.toggle('adj', Math.abs(G.mpos[i].c - G.pc) + Math.abs(G.mpos[i].r - G.pr) === 1);
}

function labStep(dc, dr) {
  if (UI.screen !== 'lab' || !G) return;
  stopWalk();
  var c = G.pc + dc, r = G.pr + dr, m = mAt(c, r);
  if (m >= 0) { openMachine(m); return; }
  if (labFree(c, r)) { G.pc = c; G.pr = r; placeLab(); SND.step(); }
}

function labPath(i) {
  var m = G.mpos[i], goal = {}, D = [[1, 0], [-1, 0], [0, 1], [0, -1]], start = G.pc + ',' + G.pr;
  D.forEach(function (d) { var c = m.c + d[0], r = m.r + d[1]; if (labFree(c, r)) goal[c + ',' + r] = 1; });
  var q = [[G.pc, G.pr]], prev = {}, seen = {}; seen[start] = 1;
  while (q.length) {
    var cur = q.shift(), k = cur[0] + ',' + cur[1];
    if (goal[k]) { var p = []; while (k !== start) { var s = k.split(','); p.unshift([+s[0], +s[1]]); k = prev[k]; } return p; }
    D.forEach(function (d) { var c = cur[0] + d[0], r = cur[1] + d[1], nk = c + ',' + r; if (labFree(c, r) && !seen[nk]) { seen[nk] = 1; prev[nk] = k; q.push([c, r]); } });
  }
  return null;
}

function walkTo(i) {
  stopWalk();
  var p = labPath(i);
  if (!p || !p.length) { openMachine(i); return; }
  var k = 0;
  G.walk = setInterval(function () {
    var s = p[k++]; G.pc = s[0]; G.pr = s[1]; placeLab(); SND.step();
    if (k >= p.length) { clearInterval(G.walk); G.walk = null; G.walkT = setTimeout(function () { if (G && UI.screen === 'lab') openMachine(i); }, 170); }
  }, 130);
}

function sGame() {
  var g = game(), rc = (G.react && G.react.fresh) ? (G.react.kind === 'bad' ? ' wobble' : ' jump') : '';
  if (G.react) G.react.fresh = false;
  var h = '<div class="top"><button class="btn small" data-a="' + (G.room.noLab ? 'lobby' : 'tolab') + '">' + ico('left') + (G.room.noLab ? '로비' : '연구소') + '</button>' + sndBtn() + '<button class="btn small" data-a="listen">' + ico('lc_headset') + '방송 듣기</button></div>' +
    '<section class="stack"><div class="ghud"><div class="av' + rc + '">' + me() + '</div><div class="bubble" role="status">' + G.bub + '</div></div><div>' + gaugeBlock() + '</div></section>';
  if (g.kind === 'assign') h += gAssign(g); else if (g.kind === 'order') h += gOrder(g); else h += gChoice(g);
  if (gameDone(G.gi)) {
    var all = remaining() === 0, nl = G.room.noLab;
    h += '<section class="fb ok"><div class="h">' + ico('check') + (all ? (nl ? '점검 완료!' : '연구소 복구 완료!') : g.mname + ' 수리 완료!') + '</div><p>' + (all ? (nl ? '기록실의 오류를 모두 바로잡았어요.' : '모든 기계가 다시 켜졌어요.') : '고장난 기계가 ' + remaining() + '대 남았어요.') + '</p><button class="btn block" data-a="' + (all && nl ? 'gfinish' : 'tolab') + '">' + (all ? (nl ? '결과 보기' : '연구소 불 켜기') : '연구소로 돌아가기') + ico('right') + '</button></section>';
  }
  return h;
}

function gAssign(g) {
  var bug = g.theme === 'bug', h = '<section class="panel stack"><div><span class="ribbon">' + g.name + '</span></div><p class="how">' + g.how + '</p><div class="gitems">';
  var pk = G.pulseKey; G.pulseKey = null;
  g.items.forEach(function (it, i) {
    var k = key(i), s = G.st[k] || 'u', cls = (s === 'u' ? '' : ' ' + s) + (G.sel === i ? ' sel' : '') + (pk === k ? ' pulse' : ''), st, why = '';
    if (s === 'ok' || s === 'fixed') st = ico(s === 'fixed' ? 'tool' : 'check'); else if (s === 'broken') st = ico(bug ? 'bug' : 'x'); else st = bug ? ico('bug') : '';
    if (isDone(s)) {
      why = '<span class="why">' + it.why + (bug ? '<br><b>' + g.bins[it.a].n + '</b> · ' + g.defs[it.a] : '') + (it.fix ? cmpHTML(it.fix) : '') + '</span>';
    } else if (G.stage[k] === 'fix') {
      why = bug ? '<span class="why"><b>버그 발견!</b> 어긴 조건은 <b>' + g.bins[it.a].n + '</b> · ' + g.defs[it.a] + '</span>' : '<span class="why"><b>오류 발견!</b> 이 안에 틀린 부분이 있어요.</span>';
    } else if (s === 'broken') {
      why = '<span class="why"><b>고장!</b> ' + it.why + ' <b>다시 눌러서 고쳐 봐요.</b></span>';
    }
    h += '<button class="gcard' + cls + '" data-a="gitem" data-v="' + i + '" aria-pressed="' + (G.sel === i) + '"><span class="tx">' + it.t + why + '</span><span class="state">' + st + '</span></button>';
  });
  var ready = G.sel >= 0;
  if (ready && G.stage[key(G.sel)] === 'fix') {
    var f = g.items[G.sel].fix, ord = fixOrderFor(key(G.sel), f.options.length), wrong = G.fixWrong[key(G.sel)] || [];
    h += '</div><p class="hint">' + f.q + '</p><div class="opts">';
    ord.forEach(function (oi, n) {
      var o = f.options[oi], bad = wrong.indexOf(oi) > -1;
      h += '<button class="opt' + (bad ? ' bad' : '') + '" data-a="gfix" data-v="' + oi + '"><span class="tag">' + 'ABC'.charAt(n) + '</span><span class="tx">' + o.t + (bad ? '<span class="why">' + o.why + '</span>' : '') + '</span>' + (bad ? ico('x') : '') + '</button>';
    });
    return h + '</div></section>';
  }
  h += '</div><p class="hint">' + (ready ? (g.ask || (bug ? '이 레시피가 어긴 조건은?' : '이 카드는 어디에 들어갈까요?')) : '먼저 위의 카드를 눌러 주세요') + '</p><div class="bins n' + g.bins.length + '">';
  g.bins.forEach(function (b, k) { h += '<button class="bin' + (ready ? ' ready' : '') + '" data-a="gbin" data-v="' + k + '">' + (b.ic ? ico(b.ic) : '') + b.n + '</button>'; });
  return h + '</div></section>';
}

function gChoice(g) {
  var k = key(0), s = G.st[k] || 'u', picks = G.picks[k] || [], h = '<section class="panel q stack"><div><span class="ribbon">' + g.name + '</span></div><h2>' + g.q + '</h2></section><div class="opts">';
  G.order.forEach(function (oi, i) {
    var cls = '', mark = '';
    if (isDone(s) && oi === g.a) { cls = ' ok'; mark = ico('check'); } else if (picks.indexOf(oi) > -1) { cls = ' bad'; mark = ico('x'); }
    h += '<button class="opt' + cls + '" data-a="gchoice" data-v="' + oi + '"><span class="tag">' + 'ABCD'.charAt(i) + '</span><span class="tx">' + g.options[oi] + '</span>' + mark + '</button>';
  });
  h += '</div>';
  if (s === 'broken') h += '<section class="fb bad"><div class="h">' + ico('x') + '고장!</div><p>' + g.why + '</p><p><b>해설을 읽고 다시 골라서 고쳐 봐요.</b></p></section>';
  else if (isDone(s)) h += '<section class="fb ok"><div class="h">' + ico('check') + '정답이에요!</div><p>' + g.why + '</p><span class="ref">다시 볼 곳 · ' + g.ref + '</span></section>';
  return h;
}

/* 순서 맞추기: 카드를 순서대로 눌러요. 틀리면 그 자리가 "고장"이 되고 이유가 나와요. */
function orderNext(gi) {
  var g = G.room.games[gi];
  for (var i = 0; i < g.items.length; i++) if (!isDone(G.st[gi + '.' + i])) return i;
  return g.items.length;
}

function tapOrder(idx) {
  var nxt = orderNext(G.gi), k = key(idx);
  if (isDone(G.st[k]) || nxt >= game().items.length) return;
  if (idx === nxt) { G.badTap = null; completeItem(idx); }
  else { var ek = key(nxt); G.st[ek] = 'broken'; G.miss[ek] = true; G.badTap = idx; react('bad'); }
  saveProg();
}

function gOrder(g) {
  var nxt = orderNext(G.gi), bt = G.badTap, pk = G.pulseKey, h;
  G.badTap = null; G.pulseKey = null;
  h = '<section class="panel stack"><div><span class="ribbon">' + g.name + '</span></div><p class="how">' + g.how + '</p><ol class="slots">';
  g.items.forEach(function (it, i) {
    var k = key(i), s = G.st[k] || 'u', done = isDone(s), body;
    if (done) body = '<strong>' + it.label + '</strong><span class="why">' + it.why + '</span>';
    else if (i === nxt) body = s === 'broken' ? '<span class="why"><b>고장!</b> 아직 이 순서가 아니에요. 다시 골라 봐요.</span>' : '<span class="why">여기에는 무엇이 올까요?</span>';
    else body = '<span class="why">…</span>';
    h += '<li class="slot' + (done ? ' ' + s : '') + (i === nxt ? ' next' : '') + (pk === k ? ' pulse' : '') + '"><b>' + (i + 1) + '</b><span class="tx">' + body + '</span></li>';
  });
  h += '</ol>';
  if (nxt < g.items.length) {
    h += '<p class="hint">' + (nxt + 1) + '번째는 무엇일까요?</p><div class="gitems">';
    G.ord[G.gi].forEach(function (idx) {
      if (isDone(G.st[key(idx)])) return;
      var it = g.items[idx], bad = bt === idx;
      h += '<button class="gcard' + (bad ? ' broken' : '') + '" data-a="gord" data-v="' + idx + '"><span class="tx">' + it.t + (bad ? '<span class="why"><b>고장!</b> ' + it.why + '</span>' : '') + '</span><span class="state">' + (bad ? ico('x') : '') + '</span></button>';
    });
    h += '</div>';
  }
  return h + '</section>';
}
