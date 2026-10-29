/* core.js — 상수, 아이콘, 캐릭터 그림, 저장, 공용 도우미 (자주 안 바뀜) */
'use strict';

var INK = '#2B2458', GOLD = '#FFC83D';

var COLORS = [
  { n: '하늘', c: '#5BC0FF' }, { n: '파랑', c: '#4F7CFF' }, { n: '보라', c: '#9B7BFF' }, { n: '분홍', c: '#FF8FB8' }, { n: '빨강', c: '#FF6B6B' },
  { n: '주황', c: '#FF9A57' }, { n: '노랑', c: '#FFD04D' }, { n: '초록', c: '#4CC76A' }, { n: '민트', c: '#3DDBC4' }, { n: '회색', c: '#B4BAD3' }
];

var CHARS = [{ id: 'robot', n: '로봇' }, { id: 'cat', n: '고양이' }, { id: 'penguin', n: '펭귄' }, { id: 'astro', n: '우주인' }];

var ADJ = ['반짝이는', '용감한', '빠른', '느긋한', '똑똑한', '씩씩한', '상냥한', '엉뚱한', '든든한', '신나는', '조용한', '멋진'];

var NOUN = ['고래', '여우', '부엉이', '별', '구름', '토끼', '곰', '돌고래', '번개', '달', '코끼리', '로봇'];

var ITEMS = [
  { id: 'glasses', n: '인식 안경', slot: 'face', room: 1, ic: 'lc_glasses' },
  { id: 'gradcap', n: '학습 모자', slot: 'hat', room: 2, ic: 'lc_cap' },
  { id: 'headset', n: '코드 헤드셋', slot: 'hat', room: 3, ic: 'lc_headset' },
  { id: 'shield', n: '안전 방패', slot: 'hand', room: 4, ic: 'lc_shield' },
  { id: 'crown', n: '역사 왕관', slot: 'hat', room: 5, ic: 'lc_crown' },
  { id: 'trophy', n: '골든벨 트로피', slot: 'lhand', room: 6, ic: 'lc_trophy' }
];

var SAY = {
  found: ['오류 발견! 이제 고쳐 봐요', '찾았어요! 어떻게 고칠까요?'],
  ok: ['좋아요!', '정확해요!', '부품이 제자리를 찾았어요!', '버그 잡았다!'],
  fixed: ['수리 완료! 대단해요', '고쳤어요! 해설을 읽은 보람이 있죠?', '다시 해서 맞혔어요!'],
  bad: ['앗, 고장이에요. 이유를 읽고 다시 눌러 봐요', '괜찮아요. 해설을 보고 고쳐 봐요', '한 번 더 살펴볼까요?']
};

var ICONS = {
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<polyline points="5 12 10 17 19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<polyline points="15 5 8 12 15 19"/>',
  right: '<polyline points="9 5 16 12 9 19"/>',
  up: '<polyline points="5 15 12 8 19 15"/>',
  down: '<polyline points="5 9 12 16 19 9"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><polyline points="8.5 12 11 14.5 15.5 9.5"/>',
  history: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M10 17h4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  retry: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/>',
  cards: '<rect x="4" y="3" width="12" height="16" rx="2"/><path d="M8 21h10a2 2 0 0 0 2-2V8"/>',
  bug: '<path d="M9 9V8a3 3 0 0 1 6 0v1"/><path d="M8 9h8a6 6 0 0 1 1 3v3a5 5 0 0 1-10 0v-3a6 6 0 0 1 1-3"/><path d="M3 13h4M17 13h4M12 20v-6M4 19l3.35-2M20 19l-3.35-2M4 7l3.75 2.4M20 7l-3.75 2.4"/>',
  tool: '<path d="M7 10h3V7L6.5 3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1-3 3l-6-6a6 6 0 0 1-8-8L7 10"/>',
  vol: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>',
  mute: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M16 9l6 6M22 9l-6 6"/>',
  lc_trophy: '<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/><path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/><path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>',
  lc_glasses: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/>',
  lc_cap: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  lc_headset: '<path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/>',
  lc_shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  lc_crown: '<path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"/><path d="M5 21h14"/>'
};

function ico(n, cls) { return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + '</svg>'; }

function shade(hex, p) {
  var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  function f(x) { return Math.max(0, Math.min(255, Math.round(x * (1 + p)))); }
  return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
}

var HEAD = {
  robot: { top: 26, eye: 52, ex: [46, 74] },
  cat: { top: 32, eye: 61, ex: [46, 74] },
  penguin: { top: 22, eye: 48, ex: [48, 72] },
  astro: { top: 18, eye: 53, ex: [50, 70] }
};

function itemFront(id, h) {
  var t = h.top, e = h.eye;
  if (id === 'glasses') {
    return '<g fill="none" stroke="' + GOLD + '" stroke-width="4"><circle cx="' + h.ex[0] + '" cy="' + e + '" r="12"/><circle cx="' + h.ex[1] + '" cy="' + e + '" r="12"/><path d="M' + (h.ex[0] + 12) + ' ' + e + ' H' + (h.ex[1] - 12) + '"/></g>';
  }
  if (id === 'gradcap') {
    return '<g transform="translate(60 ' + (t + 6) + ')" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><rect x="-17" y="0" width="34" height="13" rx="4" fill="#2F2766"/><polygon points="-34,0 0,-15 34,0 0,15" fill="#3D3480"/><path d="M26 2 V18" stroke="' + GOLD + '" stroke-width="3"/><circle cx="26" cy="20" r="3.5" fill="' + GOLD + '"/></g>';
  }
  if (id === 'headset') {
    return '<g stroke="' + INK + '" stroke-linecap="round"><path d="M22 ' + (e - 2) + ' C22 ' + (t - 16) + ' 98 ' + (t - 16) + ' 98 ' + (e - 2) + '" fill="none" stroke-width="5"/><rect x="15" y="' + (e - 10) + '" width="13" height="24" rx="5" fill="#7B5CFF" stroke-width="3"/><rect x="92" y="' + (e - 10) + '" width="13" height="24" rx="5" fill="#7B5CFF" stroke-width="3"/><path d="M98 ' + (e + 13) + ' q2 16 -24 20" fill="none" stroke-width="3"/><circle cx="73" cy="' + (e + 33) + '" r="4" fill="' + INK + '"/></g>';
  }
  if (id === 'shield') {
    return '<g transform="translate(78 72)" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M0 4 Q14 0 28 4 V18 Q28 32 14 39 Q0 32 0 18 Z" fill="#7B5CFF"/><path d="M8 19 l5 5 9 -10" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></g>';
  }
  if (id === 'trophy') {
    return '<g transform="translate(2 74)" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M6 0 H26 V12 Q26 24 16 24 Q6 24 6 12 Z" fill="' + GOLD + '"/><path d="M6 4 H0 Q0 14 7 15 M26 4 H32 Q32 14 25 15" fill="none"/><path d="M16 24 V31 M8 33 H24" fill="none"/></g>';
  }
  if (id === 'crown') {
    return '<g transform="translate(60 ' + (t + 6) + ')" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"><path d="M-24 0 L-24 -17 L-12 -7 L0 -22 L12 -7 L24 -17 L24 0 Z" fill="' + GOLD + '"/><circle cx="0" cy="-22" r="3.5" fill="#FF6F61"/></g>';
  }
  return '';
}

function charSVG(spec, equip) {
  var type = spec.type, c = COLORS[spec.color].c, d = shade(c, -0.2), h = HEAD[type], body = '', eq = equip || {};
  var st = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
  var eyes = function (r, pr) {
    return '<circle cx="' + h.ex[0] + '" cy="' + h.eye + '" r="' + r + '" fill="#fff"/><circle cx="' + h.ex[1] + '" cy="' + h.eye + '" r="' + r + '" fill="#fff"/>' +
      '<circle cx="' + (h.ex[0] + 1) + '" cy="' + (h.eye + 1) + '" r="' + pr + '" fill="' + INK + '" stroke="none"/><circle cx="' + (h.ex[1] + 1) + '" cy="' + (h.eye + 1) + '" r="' + pr + '" fill="' + INK + '" stroke="none"/>';
  };
  if (type === 'robot') {
    body = '<line x1="60" y1="26" x2="60" y2="13"/><circle cx="60" cy="10" r="5" fill="' + GOLD + '"/>' +
      '<rect x="15" y="46" width="11" height="22" rx="4" fill="' + d + '"/><rect x="94" y="46" width="11" height="22" rx="4" fill="' + d + '"/>' +
      '<rect x="38" y="86" width="44" height="26" rx="10" fill="' + c + '"/><rect x="26" y="26" width="68" height="60" rx="18" fill="' + c + '"/>' +
      '<rect x="48" y="96" width="24" height="8" rx="3" fill="' + d + '"/>' +
      eyes(10, 4.5) + '<path d="M48 72 q12 8 24 0" fill="none"/>';
  } else if (type === 'cat') {
    body = '<ellipse cx="60" cy="106" rx="26" ry="12" fill="' + c + '"/>' +
      '<path d="M24 50 L28 16 L52 34 Z" fill="' + c + '"/><path d="M96 50 L92 16 L68 34 Z" fill="' + c + '"/>' +
      '<path d="M31 38 L32 25 L44 33 Z" fill="#FFB3C7" stroke="none"/><path d="M89 38 L88 25 L76 33 Z" fill="#FFB3C7" stroke="none"/>' +
      '<ellipse cx="60" cy="64" rx="38" ry="32" fill="' + c + '"/>' +
      '<ellipse cx="46" cy="60" rx="8" ry="10" fill="#fff"/><ellipse cx="74" cy="60" rx="8" ry="10" fill="#fff"/>' +
      '<circle cx="47" cy="62" r="4.5" fill="' + INK + '" stroke="none"/><circle cx="75" cy="62" r="4.5" fill="' + INK + '" stroke="none"/>' +
      '<path d="M56 71 h8 l-4 5z" fill="#FF7FA3"/><path d="M60 76 q-5 6 -10 3 M60 76 q5 6 10 3" fill="none"/>' +
      '<path d="M25 70 L9 66 M25 77 L9 80 M95 70 L111 66 M95 77 L111 80" fill="none" stroke-width="2.5"/>';
  } else if (type === 'penguin') {
    body = '<ellipse cx="46" cy="111" rx="11" ry="5" fill="#FFA23A"/><ellipse cx="74" cy="111" rx="11" ry="5" fill="#FFA23A"/>' +
      '<ellipse cx="60" cy="64" rx="34" ry="42" fill="' + c + '"/>' +
      '<ellipse cx="60" cy="76" rx="21" ry="29" fill="#FFF8E3" stroke="none"/>' +
      '<path d="M27 58 q-12 16 -3 34 q11 -9 12 -29z" fill="' + d + '"/><path d="M93 58 q12 16 3 34 q-11 -9 -12 -29z" fill="' + d + '"/>' +
      eyes(8, 3.5) + '<path d="M51 59 h18 l-9 11z" fill="#FFA23A"/>';
  } else {
    body = '<rect x="30" y="68" width="60" height="38" rx="12" fill="#DAD6F7"/>' +
      '<rect x="38" y="84" width="44" height="28" rx="12" fill="' + c + '"/>' +
      '<line x1="60" y1="17" x2="60" y2="7"/><circle cx="60" cy="6" r="4" fill="' + c + '"/>' +
      '<circle cx="60" cy="53" r="36" fill="#fff"/>' +
      '<rect x="32" y="38" width="56" height="34" rx="17" fill="#2B3A67"/>' +
      '<path d="M42 47 q6 -6 14 -6" fill="none" stroke="#9DB8FF" stroke-width="3"/>' +
      '<circle cx="50" cy="55" r="3.2" fill="#fff" stroke="none"/><circle cx="70" cy="55" r="3.2" fill="#fff" stroke="none"/>' +
      '<path d="M53 62 q7 5 14 0" fill="none" stroke="#fff" stroke-width="2.5"/>';
  }
  var front = (eq.hand ? itemFront(eq.hand, h) : '') + (eq.lhand ? itemFront(eq.lhand, h) : '') + (eq.face ? itemFront(eq.face, h) : '') + (eq.hat ? itemFront(eq.hat, h) : '');
  return '<svg viewBox="0 0 120 120" role="img" aria-label="' + chName(type) + ' 캐릭터"><g ' + st + '>' + body + '</g>' + front + '</svg>';
}

function chName(t) { for (var i = 0; i < CHARS.length; i++) if (CHARS[i].id === t) return CHARS[i].n; return ''; }

var KEY = 'ai-room-quiz-v2', saveOK = true;
var DEV = /[?&]dev=1(?:&|$)/.test(location.search);

function fresh() { return { v: 2, started: false, nick: { a: 0, n: 0 }, char: { type: 'robot', color: 0 }, rooms: {}, topics: {}, prog: {}, equip: { hat: null, face: null, hand: null, lhand: null }, titleId: 0, reduce: false, sfx: true, bgm: true, cls: null, score: {}, did: null, clsLock: false, regCls: null }; }

function load() {
  try { var s = localStorage.getItem(KEY); if (s) { var o = JSON.parse(s); if (o && o.v === 2) return o; } } catch (e) { saveOK = false; }
  return null;
}

function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { saveOK = false; } }

var S = load() || fresh();

if (!S.prog) S.prog = {};

if (S.sfx === undefined) S.sfx = true;
if (S.bgm === undefined) S.bgm = true;

/* 반 대항: cls = null(아직 안 고름) | 0(점수 없이 연습) | 1~반 개수. score = 점수 장부(score.js) */
if (S.cls === undefined) S.cls = null;
if (!S.score) S.score = {};
if (S.did === undefined) S.did = null;
if (S.regCls === undefined) S.regCls = null;
var CLS_N = (window.AIQ_NET && AIQ_NET.classes) || 15;

for (var rk in S.rooms) (S.rooms[rk].weak || []).forEach(function (w) { w.ref = String(w.ref).replace(/PDF /g, '개념서 ').replace(/\s*§\d+/g, ''); });

var UI = { screen: S.started ? 'listen' : 'title', tab: 'lobby', roomId: 0, scroll: false, back: null, keys: [] };

var G = null;

function $(i) { return document.getElementById(i); }

function room(id) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i]; return null; }

function itemFor(roomId) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].room === roomId) return ITEMS[i]; return null; }

function cleared(id) { return !!(S.rooms[id] && S.rooms[id].cleared); }

function clearedCount() { var n = 0; for (var i = 1; i <= 5; i++) if (cleared(i)) n++; return n; }

function fixedTotal() { var n = 0; for (var k in S.rooms) n += S.rooms[k].fixed || 0; return n; }

function nickStr() { return ADJ[S.nick.a] + ' ' + NOUN[S.nick.n]; }

function titleName() { return (S.titleId && cleared(S.titleId)) ? room(S.titleId).title2 : 'AI 마스터 Lv.' + (clearedCount() + 1); }

function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

function pickOne(a) { return a[Math.floor(Math.random() * a.length)]; }

function me() { return charSVG(S.char, S.equip); }

function stopWalk() { if (G) { if (G.walk) { clearInterval(G.walk); G.walk = null; } if (G.walkT) { clearTimeout(G.walkT); G.walkT = null; } } }

function dropG() { stopWalk(); G = null; }

function go(screen) { stopWalk(); UI.screen = screen; UI.scroll = true; render(); }
