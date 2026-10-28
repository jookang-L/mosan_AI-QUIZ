/* sound.js — 효과음과 배경음악. 음악 파일 없이 웹 오디오로 그 자리에서 합성한다.
 * 방송 듣기 화면은 항상 무음이고, 켜고 끄는 값은 S.sfx(효과음)·S.bgm(배경음악)에 저장된다. */
'use strict';

var SND = (function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null, master = null, sfxBus = null, bgm = null, timer = null, nextT = 0, bar = 0, played = false, alt = 0, lastStep = 0, fails = 0;
  var BGM_VOL = 0.35, STEP = 60 / 100 / 2;   // 100BPM, 8분음표 길이(초)
  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* 한 음: 파형, 시작·끝 높이(Hz), 시작 시각, 길이, 최대 볼륨, (선택) 로우패스 */
  function tone(c, out, type, f0, f1, t, dur, vol, lp) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
    g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }

  /* 효과음 4가지: 버튼 / 걸음 / 정답 / 오답 */
  var VOICE = {
    tap: function (c, o, t) { tone(c, o, 'triangle', 620, 880, t, 0.09, 0.3); },
    step: function (c, o, t, i) { tone(c, o, 'triangle', i ? 330 : 400, i ? 240 : 290, t, 0.06, 0.2); },
    ok: function (c, o, t) {
      [72, 76, 79, 84].forEach(function (m, i) {
        var d = i === 3 ? 0.42 : 0.2;
        tone(c, o, 'triangle', hz(m), 0, t + i * 0.085, d, 0.28); tone(c, o, 'sine', hz(m + 12), 0, t + i * 0.085, d * 0.7, 0.06);
      });
    },
    bad: function (c, o, t) { tone(c, o, 'sawtooth', 294, 0, t, 0.17, 0.22, 1100); tone(c, o, 'sawtooth', 220, 0, t + 0.17, 0.34, 0.22, 900); }
  };

  /* 배경음악: C - Am - F - G 두 번(8마디) 반복. 낮은 베이스 + 잔잔한 아르페지오 + 펜타토닉 멜로디 */
  var ROOT = [48, 45, 53, 55];
  var CHORD = [[60, 64, 67], [57, 60, 64], [60, 65, 69], [59, 62, 67]];
  var ARP = [0, 1, 2, 1, 0, 1, 2, 1];
  var MEL = [
    [76, 0, 79, 0, 81, 79, 0, 76], [72, 0, 76, 0, 79, 0, 76, 0], [74, 0, 76, 79, 0, 76, 74, 0], [79, 0, 76, 0, 74, 0, 72, 0],
    [76, 0, 79, 0, 81, 0, 84, 0], [81, 79, 0, 76, 0, 79, 0, 0], [74, 76, 79, 0, 81, 0, 79, 0], [76, 0, 74, 0, 72, 0, 0, 0]
  ];

  function schedBar(c, o, t0, b) {
    var k = b % 4, i, t, m;
    for (i = 0; i < 8; i++) {
      t = t0 + i * STEP;
      if (i % 4 === 0) { tone(c, o, 'triangle', hz(ROOT[k]), 0, t, STEP * 3.4, 0.2); tone(c, o, 'triangle', hz(ROOT[k] + 12), 0, t, STEP * 3, 0.1); }   // 한 옥타브 위 베이스를 겹쳐 폰 스피커에서도 들리게
      tone(c, o, 'square', hz(CHORD[k][ARP[i]]), 0, t, STEP * 0.9, 0.035, 1400);
      m = MEL[b][i]; if (m) tone(c, o, 'triangle', hz(m), 0, t, STEP * 1.8, 0.13);
    }
  }

  function ensure() {
    if (!ctx && AC) {
      try {
        ctx = new AC();
        var soft = ctx.createWaveShaper(), curve = new Float32Array(1025), i;   // 소리가 겹쳐도 깨지지 않게 부드럽게 눌러 주는 안전장치
        for (i = 0; i < curve.length; i++) curve[i] = Math.tanh(1.5 * (i / 512 - 1)) / Math.tanh(1.5);
        soft.curve = curve;
        master = ctx.createGain(); master.gain.value = 0.6;
        master.connect(soft); soft.connect(ctx.destination);
      } catch (e) {
        try { if (ctx) ctx.close(); } catch (e2) {}
        ctx = null; master = null; if (++fails > 2) AC = null;   // 한두 번 실패는 다음 누름에 다시 시도
      }
    }
    return ctx;
  }

  /* 멈춰 있거나(suspended) 사파리가 끊은(interrupted) 소리 장치를 다시 깨운다. 거절돼도 앱은 계속 돈다 */
  function wake() {
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
  }

  /* 효과음 통로를 그 자리에서 막는다. 이미 예약된 소리도 바로 끊기고, 다시 켜면 새 통로를 쓴다 */
  function muteSfx() {
    if (!sfxBus) return;
    var old = sfxBus; sfxBus = null; old.gain.value = 0;
    setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 800);
  }

  function tick() {
    if (!ctx || !bgm) return;
    while (nextT < ctx.currentTime + 0.4) { schedBar(ctx, bgm, nextT, bar % 8); nextT += STEP * 8; bar++; }
  }

  function startBgm() {
    if (timer || !ctx) return;
    var now = ctx.currentTime;
    bgm = ctx.createGain(); bgm.connect(master);
    bgm.gain.setValueAtTime(0.0001, now); bgm.gain.linearRampToValueAtTime(BGM_VOL, now + 0.6);
    bar = 0; nextT = now + 0.1; tick(); timer = setInterval(tick, 250);
  }

  function stopBgm() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    var old = bgm, now = ctx.currentTime; bgm = null;
    old.gain.cancelScheduledValues(now); old.gain.setValueAtTime(old.gain.value, now); old.gain.linearRampToValueAtTime(0.0001, now + 0.06);   // 방송 듣기로 넘어가면 거의 즉시 끊는다
    setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 400);
  }

  function wantBgm() {
    var s = UI.screen;
    return !!(S.bgm && !document.hidden && (s === 'main' || s === 'mission' || s === 'lab' || s === 'game' || s === 'clear'));
  }

  /* 화면이 바뀔 때마다 부른다: 배경음악을 켜거나 끈다 */
  function sync() {
    try {
      if (ctx && !(S.sfx && UI.screen !== 'listen')) muteSfx();
      if (wantBgm()) { if (!ensure()) return; wake(); startBgm(); } else if (ctx) stopBgm();
    } catch (e) { if (window.console) console.warn('sound', e); }
  }

  function play(name, arg) {
    try {
      if (!S.sfx || UI.screen === 'listen' || !ensure()) return;
      played = true; wake();
      if (!sfxBus) { sfxBus = ctx.createGain(); sfxBus.connect(master); }
      VOICE[name](ctx, sfxBus, ctx.currentTime + 0.01, arg);
    } catch (e) { if (window.console) console.warn('sound', e); }
  }

  /* 브라우저는 사용자가 한 번 누른 뒤에야 소리를 허용한다. 폰을 잠갔다 켠 뒤에도 다음 누름에 다시 깨운다 */
  function unlock() { if ((S.sfx || S.bgm) && ensure()) wake(); sync(); }
  ['click', 'keydown', 'touchend'].forEach(function (e) { document.addEventListener(e, unlock, true); });
  document.addEventListener('visibilitychange', sync);

  return {
    sync: sync,
    begin: function () { played = false; },
    after: function () { if (!played) play('tap'); },
    step: function () { var n = Date.now(); if (n - lastStep < 40) return; lastStep = n; alt ^= 1; play('step', alt); },
    judge: function (kind) { play(kind === 'bad' ? 'bad' : 'ok'); },
    voices: VOICE, schedBar: schedBar, STEP: STEP,
    debug: function () { return { sfxBus: sfxBus ? sfxBus.gain.value : null, bgm: !!timer, state: ctx ? ctx.state : null }; }
  };
})();
