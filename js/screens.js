/* screens.js — 듣기·로비·임무·도감·내 카드·결과 같은 일반 화면 */
'use strict';

function hud() {
  return '<header class="hud"><div class="av">' + me() + '</div><div class="who"><b>' + nickStr() + '</b><span>' + titleName() + '</span></div>' +
    '<button class="btn small" data-a="listen">' + ico('lc_headset') + '방송 듣기</button></header>';
}

/* 우리 반 고르기: 캐릭터 만들기 화면과, 반을 아직 안 고른 예전 저장의 로비에 나온다 */
function clsPicker() {
  var lock = S.clsLock ? ' disabled' : '', h = '<div class="stack clsbox"><h3>우리 반</h3><div class="clsgrid" role="group" aria-label="우리 반 번호">', i;
  for (i = 1; i <= CLS_N; i++) h += '<button class="chip clsb' + (S.cls === i ? ' on' : '') + '" data-a="cls" data-v="' + i + '" aria-pressed="' + (S.cls === i) + '"' + lock + '>' + i + '</button>';
  h += '</div><button class="chip clsb practice' + (S.cls === 0 ? ' on' : '') + '" data-a="cls" data-v="0" aria-pressed="' + (S.cls === 0) + '"' + lock + '>점수 없이 연습만 할래요</button>';
  if (UI.needCls) h += '<p class="warn" role="alert">먼저 우리 반을 골라 주세요</p>';
  else if (S.clsLock) h += '<p class="note">점수가 이미 들어가서 반을 바꿀 수 없어요. 잘못 골랐다면 선생님께 말씀드려요.</p>';
  else h += '<p class="note">' + (S.cls > 0 ? '2학년 ' + S.cls + '반 점수로 들어가요. 반별 순위는 방송실 화면에서만 볼 수 있어요.' : S.cls === 0 ? '점수는 쌓이지 않고 연습만 해요.' : '문제를 풀 때마다 우리 반 점수가 올라가요. 한 번에 맞히면 +10, 틀리면 −2, 고치면 +6!') + '</p>';
  return h + '</div>';
}

/* 내 카드: 내가 우리 반에 보탠 점수와 전송 상태 */
function scoreLine() {
  if (!(S.cls > 0)) return S.cls === 0 ? '<p class="note">점수 없이 연습하는 중이에요.</p>' : '';
  var n = NET.info(), t = n.at ? new Date(n.at) : null, hh = t ? ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2) : '';
  var msg = n.state === 'off' ? '시험용 주소라서 점수가 서버로 가지 않아요' : n.state === 'ok' ? '점수 전송 완료' + (hh ? ' (' + hh + ')' : '') : n.state === 'full' ? '이 반은 접속 기기가 가득 찼어요. 선생님께 알려 주세요' : '점수 전송 대기 중 · 인터넷이 되면 자동으로 올라가요';
  return '<p class="note">2학년 ' + S.cls + '반 · 내가 보탠 점수 ' + Score.total() + '점<br>' + msg + '</p>';
}

/* 소리 빠른 스위치(아이콘 하나): 효과음·배경음악 중 하나라도 켜져 있으면 둘 다 끄고, 둘 다 꺼져 있으면 둘 다 켠다 */
function sndBtn() {
  var on = S.sfx || S.bgm;
  return '<button class="btn small icon" data-a="snd" aria-label="소리 ' + (on ? '끄기' : '켜기') + '">' + ico(on ? 'vol' : 'mute') + '</button>';
}

/* 효과음·배경음악을 따로 켜고 끄는 두 버튼(로비와 내 카드) */
function sndRow() {
  function b(a, label, on) { return '<button class="btn small tgl' + (on ? ' on' : '') + '" data-a="' + a + '" aria-pressed="' + on + '">' + ico(on ? 'vol' : 'mute') + label + ': ' + (on ? '켜짐' : '꺼짐') + '</button>'; }
  return '<div class="row sndrow">' + b('sfx', '효과음', S.sfx) + b('bgm', '배경음악', S.bgm) + '</div>';
}

function tabs() {
  var T = [['lobby', 'home', '방'], ['dex', 'cards', '도감'], ['me', 'user', '내 카드']], h = '<nav class="tabs" aria-label="메뉴">';
  T.forEach(function (t) { h += '<button class="tab' + (UI.tab === t[0] ? ' on' : '') + '" data-a="tab" data-v="' + t[0] + '">' + ico(t[1]) + t[2] + '</button>'; });
  return h + '</nav>';
}

function sTitle() {
  var h = '<section class="hero" style="padding-top:18px"><div class="crew">';
  CHARS.forEach(function (c, i) { h += charSVG({ type: c.id, color: [0, 3, 7, 2][i] }, {}); });
  h += '</div><span class="ribbon">모산중 2학년</span><h1 data-focus>AI 골든벨<br>준비 퀘스트</h1><p>방송을 듣고, 활동 시간에 고장난 연구소를 고쳐요.<br>오후 골든벨, 같이 준비해 봐요!</p></section>' +
    '<div class="stack" style="margin-top:auto">' +
    (S.started ? '<button class="btn grape block" data-a="resume">이어서 하기</button><button class="btn block" data-a="newgame">캐릭터 다시 만들기</button>' : '<button class="btn grape block" data-a="newgame">시작하기</button>') +
    '<p class="note" style="text-align:center">이름은 필요 없어요. 닉네임은 고르는 방식이에요.</p></div>';
  return h;
}

function sMake() {
  var h = '<section class="panel stack"><div class="row" style="justify-content:space-between"><span class="ribbon" data-focus>나의 캐릭터</span><button class="btn small" data-a="rand">' + ico('retry') + '랜덤</button></div>' +
    '<div class="disc">' + me() + '</div><div class="chargrid">';
  CHARS.forEach(function (c) { h += '<button class="charbtn' + (S.char.type === c.id ? ' on' : '') + '" data-a="chtype" data-v="' + c.id + '" aria-pressed="' + (S.char.type === c.id) + '">' + charSVG({ type: c.id, color: S.char.color }, {}) + c.n + '</button>'; });
  h += '</div><div class="swatches" role="group" aria-label="색">';
  COLORS.forEach(function (c, i) { h += '<button class="sw' + (S.char.color === i ? ' on' : '') + '" style="background:' + c.c + '" data-a="chcolor" data-v="' + i + '" aria-label="' + c.n + '" aria-pressed="' + (S.char.color === i) + '"></button>'; });
  h += '</div><h3>닉네임 고르기</h3>' +
    '<div class="pick"><button class="btn small" data-a="adj" data-v="-1" aria-label="이전 꾸밈말">' + ico('left') + '</button><div class="val">' + ADJ[S.nick.a] + '</div><button class="btn small" data-a="adj" data-v="1" aria-label="다음 꾸밈말">' + ico('right') + '</button></div>' +
    '<div class="pick"><button class="btn small" data-a="noun" data-v="-1" aria-label="이전 이름">' + ico('left') + '</button><div class="val">' + NOUN[S.nick.n] + '</div><button class="btn small" data-a="noun" data-v="1" aria-label="다음 이름">' + ico('right') + '</button></div>' +
    clsPicker() + '<button class="btn grape block" data-a="enter">이 모습으로 입장!</button></section>';
  return h;
}

function sListen() {
  var r = (UI.back && UI.back !== 'main' && UI.roomId) ? room(UI.roomId) : null;
  var line = r ? '방 ' + r.id + ' · ' + r.title + ' (' + r.refs + ')을 펴고 TV를 봐요. 하던 활동은 저장돼 있어요.' : '방송에서 안내하는 개념서 쪽을 펴고 TV를 봐요.';
  return '<section class="panel stack" style="text-align:center"><span class="ribbon" style="align-self:center">듣기 중</span><div class="disc still">' + me() + '</div>' +
    '<h2 data-focus>방송을 들어요</h2><p>' + line + '</p><p class="note">폰은 책상 위에 화면을 아래로 두면 돼요.<br>방송에서 “활동 시작”이라고 하면 눌러요.</p></section>' +
    '<div class="stack" style="margin-top:auto"><button class="btn grape block" data-a="resumeact">' + (UI.back ? '하던 활동으로 돌아가기' : '활동 시작') + ico('right') + '</button></div>';
}

function sLobby() {
  var done = clearedCount(), h = '<section class="banner"><h1 data-focus>활동 고르기</h1><p>방송에서 알려 주는 방으로 입장하세요</p></section><div class="pips" aria-label="복구한 방 ' + done + '개">';
  for (var i = 1; i <= 5; i++) h += '<i class="' + (cleared(i) ? 'on' : '') + '"></i>';
  h += '</div>' + (S.cls === null ? '<section class="panel stack">' + clsPicker() + '</section>' : '') + sndRow() + '<div class="stack">';
  ROOMS.forEach(function (r) {
    if (r.id > 5) return;
    var st = cleared(r.id) ? '<span class="st">' + ico('check') + '복구 완료</span>' : (r.ready !== false ? '<span class="st">' + (S.prog[r.id] ? '이어 하기' : '입장') + '</span>' : '<span class="st">준비 중</span>');
    h += '<button class="room' + (r.ready !== false ? (cleared(r.id) ? '' : ' go') : ' wip') + (cleared(r.id) ? ' done' : '') + '" data-a="room" data-v="' + r.id + '"><span class="num">' + r.id + '</span><span class="tx"><b>' + r.title + '</b><span>' + r.sub + '</span></span>' + st + '</button>';
  });
  var fin = room(6);
  if (fin) {
    var fdone = cleared(6), open = done === 5;
    h += '<button class="room' + (fdone ? ' done' : open ? ' go' : ' wip') + '" data-a="' + (open || fdone ? 'room' : 'none') + '" data-v="6"><span class="num">' + ico('trophy') + '</span><span class="tx"><b>' + fin.title + '</b><span>' + (open || fdone ? fin.sub : '방 5개를 모두 복구하면 열려요') + '</span></span><span class="st">' + (fdone ? ico('check') + '복구 완료' : open ? '입장' : '잠김') + '</span></button>';
  }
  h += '</div>';
  return h;
}

function sMission() {
  var r = room(UI.roomId), h = '<div class="top"><button class="btn small" data-a="lobby">' + ico('left') + '로비</button>' + sndBtn() + '</div>' +
    '<section class="panel stack"><div class="row" style="flex-wrap:wrap"><span class="ribbon">방 ' + r.id + ' · ' + r.title + '</span><span class="ref">' + r.refs + '</span></div>' +
    '<div class="ghud"><div class="av">' + me() + '</div><div class="bubble" data-focus>' + r.mission + '</div></div>' +
    '<h3>오늘의 핵심</h3><ul class="defs">';
  r.summary.forEach(function (s) { h += '<li><b>' + s.k + '</b>' + s.v + '</li>'; });
  h += '</ul><p class="note">방송에서 설명한 내용이에요. 자세한 카드는 도감에서 볼 수 있어요.</p></section>' +
    '<button class="btn grape block" data-a="gstart">' + (r.noLab ? '점검 시작!' : '연구소로 들어가기') + ico('right') + '</button>';
  return h;
}

function sClear() {
  var r = room(UI.roomId), it = itemFor(r.id), info = S.rooms[r.id], conf = '';
  if (!S.reduce) for (var i = 0; i < 26; i++) conf += '<i style="left:' + Math.round(Math.random() * 100) + '%;background:' + ['#FFC83D', '#7B5CFF', '#42C46B', '#FF6F61', '#2FD3BE'][i % 5] + ';animation-delay:' + (Math.random() * 0.7).toFixed(2) + 's"></i>';
  var weak = '';
  info.weak.forEach(function (w) { weak += '<li><span>' + w.topic + '</span><span class="ref">' + w.ref + '</span></li>'; });
  return '<section class="panel clear"><div class="confetti" aria-hidden="true">' + conf + '</div><span class="ribbon">방 ' + r.id + ' 복구 완료!</span><h2 data-focus>' + r.title + '</h2>' +
    '<div class="disc">' + me() + '</div><span class="titlechip">' + ico('trophy') + r.title2 + '</span>' + gaugeHTML(UI.keys || []) +
    '<p>바로 맞힌 ' + info.ok + '개 · 해설을 읽고 고친 ' + info.fixed + '개</p>' +
    (info.fixed ? '<div style="width:100%;text-align:left"><h3 style="margin-bottom:8px">오후 전에 한 번 더 볼 개념</h3><ul class="weak">' + weak + '</ul></div>' : '<p class="note">고장 없이 한 번에 복구했어요!</p>') +
    (it ? '<div class="reward">' + ico(it.ic) + '<div><b>새 아이템 · ' + it.n + '</b><div class="note">캐릭터가 바로 입었어요. 내 카드의 옷장에서 바꿀 수 있어요.</div></div></div>' : '') +
    '<button class="btn grape block" data-a="listen">' + ico('lc_headset') + '방송 듣기</button>' +
    '<div class="row" style="width:100%"><button class="btn" data-a="mecard" style="flex:1">내 카드</button><button class="btn" data-a="lobby" style="flex:1">로비</button></div></section>';
}

function sDex() {
  var h = '<section class="banner"><h1 data-focus>도감</h1><p>방에서 다룬 개념 카드를 다시 볼 수 있어요</p></section><div class="stack">';
  ROOMS.forEach(function (r) {
    if (!r.cards) return;
    if (r.ready === false) { h += '<div class="room wip"><span class="num">' + r.id + '</span><span class="tx"><b>' + r.title + '</b><span>준비 중이에요</span></span></div>'; return; }
    h += '<details><summary>방 ' + r.id + ' · ' + r.title + '</summary><div class="stack">';
    r.cards.forEach(function (c) { h += '<div class="panel big"><span class="ref">' + c.ref + '</span><h3>' + c.h + '</h3>' + c.html + '</div>'; });
    h += '</div></details>';
  });
  return h + '</div>';
}

function recordHTML() {
  var list = conceptList(), st = [], ok = 0, fx = 0, page = 0, lab = { ok: '확인', fixed: '다시 보기', u: '아직' };
  list.forEach(function (x) { var s = S.topics[x.c] || 'u'; st.push(s); if (s === 'ok') ok++; else if (s === 'fixed') fx++; });
  var h = '<div style="text-align:left"><h3 style="margin-bottom:8px">개념 확인 기록</h3>' + gaugeHTML(st).replace('class="gauge"', 'class="gauge sm"') +
    '<p class="note" style="margin-top:8px">확인 ' + ok + '개 · 다시 볼 개념 ' + fx + '개 · 아직 ' + (list.length - ok - fx) + '개</p>' +
    (fx ? '<p class="note">노란 칸은 해설을 읽고 고친 개념이에요. 오후 전에 개념서에서 한 번 더 보고, 그 방이나 종합 도전에 다시 도전하면 바뀔 수 있어요.</p>' : '');
  list.forEach(function (x) {
    var s = S.topics[x.c] || 'u';
    if (x.page !== page) { if (page) h += '</ul>'; page = x.page; h += '<h4 class="recpage">개념서 ' + page + '쪽</h4><ul class="rec">'; }
    h += '<li class="' + s + '"><span class="mk">' + (s === 'ok' ? ico('check') : s === 'fixed' ? ico('tool') : '') + '</span><span class="tx">' + x.c + '</span><span class="tag">' + lab[s] + '</span></li>';
  });
  return h + '</ul></div>';
}

function sMe() {
  var h = '<section class="panel stack" style="text-align:center"><span class="ribbon" style="align-self:center" data-focus>내 카드</span><div class="disc">' + me() + '</div><h2>' + nickStr() + '</h2><p>' + titleName() + ' · 해설을 읽고 고친 문제 ' + fixedTotal() + '개</p>' + scoreLine() + '<div class="badges">';
  ROOMS.forEach(function (r) { h += '<div class="badge' + (cleared(r.id) ? ' on' : '') + '" title="방 ' + r.id + '">' + ico(cleared(r.id) ? r.ic : 'lock') + '</div>'; });
  h += '</div><div style="text-align:left"><h3 style="margin-bottom:10px">받은 칭호</h3><div class="chips">';
  var anyT = false;
  ROOMS.forEach(function (r) { if (cleared(r.id)) { anyT = true; h += '<button class="chip' + (S.titleId === r.id ? ' on' : '') + '" data-a="title" data-v="' + r.id + '" aria-pressed="' + (S.titleId === r.id) + '">' + r.title2 + '</button>'; } });
  if (!anyT) h += '<span class="note">방을 복구하면 칭호를 받아요.</span>';
  h += '</div></div>' + recordHTML() + '<p class="note">화면을 캡처해서 담임 선생님께 보여 주세요.' + (saveOK ? ' 이 폰에 저장돼요.' : ' 저장이 막혀 있어서 새로고침하면 사라져요.') + '</p></section>';
  h += '<section class="panel stack"><h3>옷장</h3><div class="closet">';
  ITEMS.forEach(function (it) {
    var has = cleared(it.room), on = S.equip[it.slot] === it.id;
    h += '<button class="gear' + (on ? ' on' : '') + (has ? '' : ' lock') + '" data-a="equip" data-v="' + it.id + '" aria-pressed="' + on + '">' + ico(has ? it.ic : 'lock') + (has ? it.n : '방 ' + it.room) + '</button>';
  });
  h += '</div><p class="note">모자는 한 번에 하나만 쓸 수 있어요.</p></section>';
  h += '<section class="panel stack"><h3>설정</h3>' + sndRow() + '<p class="note">소리가 안 나면 폰의 무음 모드와 볼륨을 확인해요. 방송 듣기 화면에서는 항상 조용해요.</p><button class="btn small" data-a="reduce" aria-pressed="' + S.reduce + '">움직임 줄이기: ' + (S.reduce ? '켜짐' : '꺼짐') + '</button><button class="btn small" data-a="newgame">캐릭터 다시 만들기</button></section>';
  if (DEV) h += '<details open><summary>교사용 점검 도구</summary><div class="stack"><button class="btn small" data-a="devclear">방 1~5 모두 복구 처리</button><button class="btn small" data-a="devreset">저장 지우고 처음부터</button></div></details>';
  return h;
}
