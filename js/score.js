/* score.js — 점수 장부. 문항마다 "틀린 횟수(w)"와 "확정 상태(s)"를 기록한다.
 *   s = ''  : 아직 못 맞힘(틀린 적이 있으면 서버에는 b로 간다)
 *   s = 'o' : 한 번에 정답(틀린 횟수 0)
 *   s = 'f' : 틀린 뒤 수리
 * 확정된(o·f) 문항은 다시 풀어도 점수가 바뀌지 않는다. 장부는 방을 다시 해도 지워지지 않는다.
 * 여기 점수(A·B·C)는 학생 화면에 "+10" 같은 표시를 하는 용도이고, 반 순위는 관리자 화면이 계산한다. */
'use strict';

var Score = (function () {
  var A = 10, B = 2, C = 6;

  function id(k) { return G.room.id + ':' + k; }
  function mult(i) { return i.charAt(0) === '6' ? 2 : 1; }

  function wrong(k) {
    var i = id(k), e = S.score[i];
    if (e && e.s) return 0;
    if (!e) e = S.score[i] = { w: 0, s: '' };
    if (e.w < 99) e.w++;
    changed();
    return -B * mult(i);
  }

  function settle(k) {
    var i = id(k), e = S.score[i];
    if (e && e.s) return 0;
    if (!e) e = S.score[i] = { w: 0, s: '' };
    e.s = e.w ? 'f' : 'o';
    changed();
    return (e.w ? C : A) * mult(i);
  }

  function changed() { save(); NET.mark(); }

  /* 서버로 보내는 모양: { "3:0.2": "1f", "3:1.0": "2b", ... } */
  function enc() {
    var o = {}, i, e;
    for (i in S.score) { e = S.score[i]; if (e.s || e.w) o[i] = e.w + (e.s || 'b'); }
    return o;
  }

  function total() {
    var n = 0, i, e;
    for (i in S.score) { e = S.score[i]; n += ((e.s === 'o' ? A : e.s === 'f' ? C : 0) - B * e.w) * mult(i); }
    return n;
  }

  return { wrong: wrong, settle: settle, enc: enc, total: total };
})();
