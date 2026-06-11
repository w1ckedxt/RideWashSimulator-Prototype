// Procedurele audio via WebAudio — geen assets nodig.
// Spray = gefilterde witte ruis, plus dingetjes voor sectie-klaar en winst.
export class AudioFX {
  constructor() {
    this.ctx = null;
    this.sprayGain = null;
  }

  /** Moet vanuit een user-gesture worden aangeroepen. */
  start() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;

    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;

    // Spuitgeluid
    const sprayNoise = ctx.createBufferSource();
    sprayNoise.buffer = noiseBuf;
    sprayNoise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2300;
    band.Q.value = 0.65;
    this.sprayGain = ctx.createGain();
    this.sprayGain.gain.value = 0;
    sprayNoise.connect(band).connect(this.sprayGain).connect(ctx.destination);
    sprayNoise.start();

    // Zachte wind-ambience
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuf;
    wind.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 320;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.035;
    wind.connect(low).connect(windGain).connect(ctx.destination);
    wind.start();
  }

  setSpray(on) {
    if (!this.sprayGain) return;
    const t = this.ctx.currentTime;
    this.sprayGain.gain.cancelScheduledValues(t);
    this.sprayGain.gain.setTargetAtTime(on ? 0.16 : 0, t, on ? 0.03 : 0.08);
  }

  #tone(freq, t0, dur, vol = 0.18, type = 'sine') {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  sectionDing() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.#tone(880, t, 0.25);
    this.#tone(1318.5, t + 0.09, 0.35);
  }

  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => this.#tone(f, t + i * 0.13, 0.5, 0.16, 'triangle'));
  }
}
