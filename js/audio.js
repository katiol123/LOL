'use strict';
/* Синтезированные звуки (Web Audio, без внешних файлов) и фоновая музыка */

const Sound = {
  ctx: null, master: null, sfxBus: null, musicBus: null,
  enabled: true, music: true, vol: 0.7,
  last: {}, active: 0, musicTimer: null, chordIdx: 0,

  init() {
    try {
      const s = JSON.parse(localStorage.getItem('lk-sound') || '{}');
      if (s.enabled === false) this.enabled = false;
      if (s.music === false) this.music = false;
      if (typeof s.vol === 'number') this.vol = s.vol;
    } catch (e) { /* хранилище недоступно */ }
  },
  save() { try { localStorage.setItem('lk-sound', JSON.stringify({ enabled: this.enabled, music: this.music, vol: this.vol })); } catch (e) { /* ignore */ } },

  /* Контекст создаётся только после жеста пользователя */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 6;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.vol : 0;
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.9;
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.music ? 0.22 : 0;
    this.sfxBus.connect(comp); this.musicBus.connect(comp); comp.connect(this.master); this.master.connect(this.ctx.destination);
    // общий буфер шума
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  setEnabled(on) { this.enabled = on; if (this.master) this.master.gain.setTargetAtTime(on ? this.vol : 0, this.ctx.currentTime, 0.05); this.save(); },
  setMusic(on) { this.music = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.3); this.save(); },

  ok(name, gap) {
    if (!this.ctx || !this.enabled || Clock.headless) return false;
    const now = performance.now();
    // на высокой скорости звуки реже
    const g = gap * Math.max(1, Clock.speed / 2);
    if (this.last[name] && now - this.last[name] < g) return false;
    if (this.active > 24) return false;
    this.last[name] = now;
    return true;
  },

  tone(freq, dur, o = {}) {
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    const v = o.vol == null ? 0.25 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filter; osc.connect(f); node = f; }
    node.connect(g); g.connect(o.bus || this.sfxBus);
    osc.start(t); osc.stop(t + dur + 0.05);
    this.active++; osc.onended = () => { this.active--; };
  },
  noise(dur, o = {}) {
    const c = this.ctx, t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.ftype || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 1200, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.3, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxBus);
    src.start(t); src.stop(t + dur + 0.05);
    this.active++; src.onended = () => { this.active--; };
  },

  /* ---------- Звуковые эффекты ---------- */
  // ноты пентатоники для камней: ⚔ 🛡 ✚ ◆ ● ◉
  GEM_NOTE: [0, 3, 7, 10, 12, 15],
  play(name, a = {}) {
    if (!this.ctx) return;
    const f0 = 293.66; // ре
    const st = n => f0 * Math.pow(2, n / 12);
    switch (name) {
      case 'click': if (this.ok(name, 40)) this.tone(900, 0.06, { type: 'triangle', vol: 0.12 }); break;
      case 'hover': if (this.ok(name, 60)) this.tone(1300, 0.03, { type: 'sine', vol: 0.05 }); break;
      case 'swap': if (this.ok(name, 60)) { this.tone(420, 0.09, { type: 'triangle', vol: 0.12, slide: 640 }); this.noise(0.07, { freq: 3000, ftype: 'highpass', vol: 0.04 }); } break;
      case 'match': {
        if (!this.ok(name, 70)) break;
        const casc = Math.min(8, a.cascade || 0);
        const t = a.type != null ? a.type : 0;
        const n = this.GEM_NOTE[t] + casc * 2;
        this.tone(st(n + 12), 0.28, { type: 'triangle', vol: 0.16 });
        this.tone(st(n + 19), 0.22, { type: 'sine', vol: 0.08, delay: 0.03 });
        this.noise(0.08, { freq: 5000, ftype: 'highpass', vol: 0.05 });
        if (casc >= 2) this.tone(st(n + 24), 0.35, { type: 'sine', vol: 0.07, delay: 0.06 });
        break;
      }
      case 'line': if (this.ok(name, 90)) { this.tone(1800, 0.3, { type: 'sawtooth', vol: 0.08, slide: 200, filter: 3000 }); this.noise(0.25, { freq: 4000, sweep: 400, vol: 0.12 }); } break;
      case 'bomb': if (this.ok(name, 110)) { this.tone(110, 0.45, { type: 'sine', vol: 0.4, slide: 40 }); this.noise(0.5, { freq: 900, sweep: 80, vol: 0.35 }); } break;
      case 'prism': if (this.ok(name, 200)) { [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(st(n + 12), 0.5, { type: 'sine', vol: 0.12, delay: i * 0.045 })); this.noise(0.6, { freq: 6000, ftype: 'highpass', vol: 0.06 }); } break;
      case 'stone': if (this.ok(name, 120)) this.noise(0.18, { freq: 600, vol: 0.18, q: 3 }); break;
      case 'ice': if (this.ok(name, 120)) { this.tone(2400, 0.25, { type: 'sine', vol: 0.08, slide: 3200 }); this.tone(3100, 0.2, { type: 'sine', vol: 0.06, delay: 0.05 }); } break;
      case 'fog': if (this.ok(name, 150)) this.noise(0.6, { freq: 500, sweep: 1500, vol: 0.12, attack: 0.2 }); break;
      case 'hit': if (this.ok(name, 70)) { this.tone(160, 0.14, { type: 'square', vol: 0.09, slide: 70, filter: 900 }); this.noise(0.1, { freq: 1500, vol: 0.12 }); } break;
      case 'bigHit': if (this.ok(name, 120)) { this.tone(90, 0.3, { type: 'sine', vol: 0.35, slide: 40 }); this.noise(0.22, { freq: 2000, sweep: 200, vol: 0.2 }); } break;
      case 'heal': if (this.ok(name, 160)) { this.tone(st(19), 0.35, { type: 'sine', vol: 0.08, attack: 0.05 }); this.tone(st(24), 0.4, { type: 'sine', vol: 0.06, delay: 0.08, attack: 0.05 }); } break;
      case 'shield': if (this.ok(name, 160)) this.tone(st(7), 0.3, { type: 'triangle', vol: 0.08, slide: st(14), filter: 2500 }); break;
      case 'coin': if (this.ok(name, 120)) { this.tone(1975, 0.08, { type: 'square', vol: 0.05, filter: 5000 }); this.tone(2637, 0.22, { type: 'square', vol: 0.05, delay: 0.07, filter: 5000 }); } break;
      case 'cast': if (this.ok(name, 200)) {
        this.noise(0.45, { freq: 400, sweep: 5000, vol: 0.14, attack: 0.15, ftype: 'bandpass', q: 2 });
        const ult = a.ult;
        [0, 7, 12].forEach((n, i) => this.tone(st(n + (ult ? 0 : 12)), ult ? 0.9 : 0.5, { type: 'sawtooth', vol: ult ? 0.07 : 0.05, delay: 0.12 + i * 0.03, filter: 1800, attack: 0.04 }));
        if (ult) this.tone(st(-12), 1.0, { type: 'sine', vol: 0.25, delay: 0.1 });
        break;
      }
      case 'stun': if (this.ok(name, 200)) [0, 1, 2].forEach(i => this.tone(st(24 + i * 5), 0.12, { type: 'sine', vol: 0.06, delay: i * 0.08 })); break;
      case 'kill': if (this.ok(name, 250)) {
        this.tone(st(-12), 0.9, { type: 'sawtooth', vol: 0.12, filter: 600 });
        this.tone(st(-9), 0.9, { type: 'sawtooth', vol: 0.08, filter: 600, delay: 0.02 });
        this.tone(70, 0.6, { type: 'sine', vol: 0.4, slide: 35 });
        this.noise(0.5, { freq: 1800, sweep: 150, vol: 0.2 });
        break;
      }
      case 'levelUp': if (this.ok(name, 250)) [0, 4, 7, 12].forEach((n, i) => this.tone(st(n + 12), 0.25, { type: 'triangle', vol: 0.09, delay: i * 0.06 })); break;
      case 'banner': if (this.ok(name, 400)) {
        // гонг
        [1, 2.4, 3.8, 5.1].forEach((m, i) => this.tone(110 * m, 2.2 - i * 0.3, { type: 'sine', vol: 0.16 / (i + 1), attack: 0.01 }));
        this.noise(0.3, { freq: 2500, vol: 0.08 });
        break;
      }
      case 'tower': if (this.ok(name, 400)) { this.noise(1.6, { freq: 500, sweep: 60, vol: 0.45, attack: 0.05 }); this.tone(55, 1.2, { type: 'sine', vol: 0.35, slide: 30 }); } break;
      case 'roar': if (this.ok(name, 600)) {
        this.tone(75, 1.3, { type: 'sawtooth', vol: 0.18, slide: 50, filter: 500, attack: 0.15 });
        this.tone(82, 1.3, { type: 'sawtooth', vol: 0.14, slide: 45, filter: 450, attack: 0.15 });
        this.noise(1.2, { freq: 300, sweep: 120, vol: 0.25, attack: 0.15, q: 4, ftype: 'bandpass' });
        break;
      }
      case 'gank': if (this.ok(name, 400)) { [0, 6].forEach((n, i) => this.tone(st(n), 0.35, { type: 'square', vol: 0.06, delay: i * 0.12, filter: 1200 })); } break;
      case 'recall': if (this.ok(name, 300)) { this.tone(st(12), 0.6, { type: 'sine', vol: 0.06, slide: st(24), attack: 0.2 }); } break;
      case 'draft': if (this.ok(name, 80)) this.tone(st(12 + (a.n || 0)), 0.08, { type: 'triangle', vol: 0.06 }); break;
      case 'lockin': if (this.ok(name, 150)) { this.tone(st(0), 0.6, { type: 'sawtooth', vol: 0.08, filter: 1500 }); this.tone(st(7), 0.6, { type: 'sawtooth', vol: 0.06, filter: 1500 }); this.noise(0.25, { freq: 3000, vol: 0.1 }); } break;
      case 'whoosh': if (this.ok(name, 300)) this.noise(0.7, { freq: 300, sweep: 4000, vol: 0.18, attack: 0.3, ftype: 'bandpass', q: 1.5 }); break;
      case 'victory': {
        [[0, 0], [4, 0.18], [7, 0.36], [12, 0.6]].forEach(([n, d]) => { this.tone(st(n), 1.4, { type: 'sawtooth', vol: 0.08, delay: d, filter: 2200, attack: 0.03 }); this.tone(st(n + 12), 1.2, { type: 'triangle', vol: 0.06, delay: d }); });
        this.tone(st(-12), 2.2, { type: 'sine', vol: 0.3, delay: 0.6 });
        break;
      }
    }
  },

  /* ---------- Фоновая музыка: медленные минорные аккорды ---------- */
  CHORDS: [[0, 3, 7, 10], [-4, 0, 3, 8], [-7, -3, 0, 5], [-2, 2, 5, 9]],
  startMusic() {
    if (this.musicTimer) return;
    const step = () => {
      if (!this.ctx) return;
      if (this.music && this.enabled) {
        const ch = this.CHORDS[this.chordIdx++ % this.CHORDS.length];
        const base = 146.83;
        ch.forEach((n, i) => {
          const f = base * Math.pow(2, n / 12);
          this.tone(f, 7.5, { type: 'triangle', vol: 0.07, attack: 2.2, filter: 900, bus: this.musicBus, detune: (i % 2 ? 6 : -6) });
        });
        this.tone(base / 2 * Math.pow(2, ch[0] / 12), 7.5, { type: 'sine', vol: 0.12, attack: 1.5, bus: this.musicBus });
        // редкие «звёздочки»
        [0, 1].forEach(k => { if (Math.random() < 0.6) this.tone(base * 4 * Math.pow(2, U.pick(ch) / 12), 1.5, { type: 'sine', vol: 0.03, delay: 1.5 + k * 2 + Math.random(), attack: 0.02, bus: this.musicBus }); });
      }
      this.musicTimer = setTimeout(step, 6000);
    };
    step();
  },
};
