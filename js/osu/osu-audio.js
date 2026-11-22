/* osu-audio.js —— 音频上下文、解码、命中音效、内置演示曲合成 */
var OSU = window.Osu = window.Osu || {};

(function () {
  'use strict';
  var S = OSU.S;

  var ctx = null, master = null, musicBus = null, noise = null, src = null, demoStep = 0;
  var mix = { master: .75, music: .8, sfx: .85 };

  var A = OSU.audio = {};

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ctx.createGain();
    master.gain.value = mix.master;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = mix.music;
    musicBus.connect(master);
    var len = Math.floor(ctx.sampleRate * 0.6);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  A.setMuted = function (m) {
    A.muted = !!m;
    if (master) master.gain.value = A.muted ? 0 : mix.master;
  };

  /* 设置面板调用：主 / 音乐 / 音效 三档增益（0–100） */
  A.applyMix = function (o) {
    if (!o) return;
    if (typeof o.master === 'number') mix.master = Math.max(0, Math.min(1, o.master / 100));
    if (typeof o.music === 'number') mix.music = Math.max(0, Math.min(1, o.music / 100));
    if (typeof o.sfx === 'number') mix.sfx = Math.max(0, Math.min(1, o.sfx / 100));
    if (master) master.gain.value = A.muted ? 0 : mix.master;
    if (musicBus) musicBus.gain.value = mix.music;
  };
  A.mixState = function () { return mix; };

  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume().catch(function () {}); };
  A.suspend = function () { if (ctx) try { ctx.suspend(); } catch (e) {} };
  A.now = function () { return ctx ? ctx.currentTime : 0; };
  /* 音频是否真的在走：被浏览器挂起时 currentTime 冻结，谱面必须改走墙钟 */
  A.isLive = function () { return !!ctx && ctx.state === 'running'; };

  A.decode = function (blob) {
    return new Promise(function (res, rej) {
      A.init();
      if (!ctx) { rej(new Error('no audio')); return; }
      var fr = new FileReader();
      fr.onload = function (e) { ctx.decodeAudioData(e.target.result, res, rej); };
      fr.onerror = rej;
      fr.readAsArrayBuffer(blob);
    });
  };

  function env(node, t, vol, dur) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol * mix.sfx, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    node.connect(g); g.connect(master);
    return g;
  }

  A.blip = function (freq, vol, dur, type) {
    if (!ctx) return;
    var t = ctx.currentTime;
    var o = ctx.createOscillator();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    env(o, t, vol || .12, dur || .09);
    o.start(t); o.stop(t + (dur || .09) + .02);
  };

  A.noiseHit = function (vol, freq, dur) {
    if (!ctx || !noise) return;
    var t = ctx.currentTime;
    var s = ctx.createBufferSource(); s.buffer = noise;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq || 3000;
    s.connect(f);
    env(f, t, vol, dur || .04);
    s.start(t); s.stop(t + (dur || .04) + .02);
  };

  /* 命中音效：跟判定等级走 */
  A.hitSfx = function (res) {
    if (!ctx) return;
    if (S.mods.AT) return;
    var map = { PERFECT: [520, .16], GREAT: [420, .13], GOOD: [330, .1], OK: [260, .07], MEH: [180, .05] };
    var m = map[res];
    A.blip(m ? m[0] : 260, m ? m[1] : .05, .07);
    A.noiseHit(res === 'PERFECT' ? .1 : .06, res === 'PERFECT' ? 5200 : 3400, .03);
  };

  /* 模式专属打击音 */
  A.don = function () {
    if (!ctx) return;
    var t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(70, t + .09);
    g.gain.setValueAtTime(.5 * mix.sfx, t);
    g.gain.exponentialRampToValueAtTime(.001, t + .18);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + .2);
  };
  A.kat = function () {
    A.noiseHit(.22, 5200, .05);
    A.blip(880, .06, .05, 'square');
  };
  A.catchFruit = function (n) { A.blip(420 + (n || 0) * 20, .1, .06); };
  A.sliderTick = function () { A.noiseHit(.05, 2600, .02); };

  /* 歌曲播放 */
  A.playBuffer = function (buffer, speed, offsetSec, atTime) {
    if (!ctx || !buffer) return;
    A.stopBuffer();
    src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = speed || 1;
    src.connect(musicBus || master);
    try { src.start(atTime || ctx.currentTime, Math.max(0, offsetSec || 0)); }
    catch (e) { try { src.start(); } catch (_) {} }
  };
  A.stopBuffer = function () {
    if (!src) return;
    try { src.stop(); } catch (e) {}
    try { src.disconnect(); } catch (e) {}
    src = null;
  };

  /* 演示曲合成：按拍点排布 kick/snare/hat/旋律 */
  A.resetDemoSynth = function () { demoStep = 0; };
  A.demoSynth = function (songTime, speed) {
    if (!ctx || !S.demo) return;
    var beat = 60 / OSU.DEMO.bpm;
    var totalSteps = (OSU.DEMO.steps || 320);
    var horizon = songTime + 0.5;
    while (demoStep < totalSteps) {
      var t = OSU.DEMO.limit + demoStep * (beat / 4);
      if (t > horizon) break;
      var when = S.songStartAt + (t - songTime) / (speed || 1);
      if (when < ctx.currentTime) when = ctx.currentTime;
      var step = demoStep;
      /* 每 4 步一小节，kick 1/3 拍、hat 全部 */
      if (step % 4 === 0) A.donAt(when);
      if (step % 8 === 4) A.snareAt(when);
      if (step % 2 === 1) A.hatAt(when, 0.03);
      var scale = [261.63, 329.63, 392.00, 523.25, 440.00];
      if (step % 4 === 2) A.pitchAt(when, scale[(step >> 3) % scale.length], .04);
      demoStep++;
    }
  };
  A.donAt = function (t) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + .1);
    g.gain.setValueAtTime(.8, t); g.gain.exponentialRampToValueAtTime(.001, t + .2);
    o.connect(g); g.connect(musicBus || master); o.start(t); o.stop(t + .22);
  };
  A.snareAt = function (t) {
    if (!ctx || !noise) return;
    var s = ctx.createBufferSource(); s.buffer = noise;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = .9;
    var g = ctx.createGain();
    g.gain.setValueAtTime(.3, t); g.gain.exponentialRampToValueAtTime(.001, t + .14);
    s.connect(f); f.connect(g); g.connect(musicBus || master); s.start(t); s.stop(t + .16);
  };
  A.hatAt = function (t, v) {
    if (!ctx || !noise) return;
    var s = ctx.createBufferSource(); s.buffer = noise;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7600;
    var g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .04);
    s.connect(f); f.connect(g); g.connect(musicBus || master); s.start(t); s.stop(t + .05);
  };
  A.pitchAt = function (t, freq, vol) {
    if (!ctx) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol || .05, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    o.connect(g); g.connect(musicBus || master); o.start(t); o.stop(t + .16);
  };

  /* 节拍器（延迟校准用） */
  A.tick = function () { A.blip(1000, .4, .05, 'sine'); };
})();
