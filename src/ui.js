// HUD en overlays — leest het DirtSystem, schrijft naar de DOM.
export class UI {
  constructor(dirt) {
    this.dirt = dirt;
    this.hud = document.getElementById('hud');
    this.startOverlay = document.getElementById('startOverlay');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.winOverlay = document.getElementById('winOverlay');
    this.progressFill = document.getElementById('progressFill');
    this.progressLabel = document.getElementById('progressLabel');
    this.statsEl = document.getElementById('stats');
    this.toasts = document.getElementById('toasts');

    this.sectionRows = new Map();
    const sections = document.getElementById('sections');
    for (const m of dirt.masks.values()) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<span class="name">${m.label}</span><span class="bar"><i></i></span>`;
      sections.appendChild(row);
      this.sectionRows.set(m.id, row);
    }
  }

  onStart(cb) {
    this.startOverlay.addEventListener('click', cb);
    this.pauseOverlay.addEventListener('click', cb);
  }

  onRestart(cb) {
    this.winOverlay.addEventListener('click', cb);
  }

  showPlaying() {
    this.startOverlay.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.hud.classList.add('active');
  }

  showPause() {
    if (!this.winOverlay.classList.contains('hidden')) return;
    this.pauseOverlay.classList.remove('hidden');
  }

  showWin(seconds, liters) {
    this.hud.classList.remove('active');
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    document.getElementById('winStats').innerHTML =
      `⏱ Tijd: <b>${mins}m ${secs}s</b> &nbsp;·&nbsp; 💧 Water: <b>${liters.toFixed(1)} liter</b>`;
    this.winOverlay.classList.remove('hidden');
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = `✨ ${text} schoon!`;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3900);
  }

  refresh(seconds, liters) {
    const p = this.dirt.progress();
    this.progressFill.style.width = `${(p * 100).toFixed(1)}%`;
    this.progressLabel.textContent = `SCHOON: ${(p * 100).toFixed(1)}%`;

    for (const m of this.dirt.masks.values()) {
      const row = this.sectionRows.get(m.id);
      row.querySelector('i').style.width = `${((m.cleaned / m.total) * 100).toFixed(0)}%`;
      row.classList.toggle('done', m.done);
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.statsEl.innerHTML = `⏱ <b>${mins}:${secs}</b> &nbsp; 💧 <b>${liters.toFixed(1)} L</b>`;
  }
}
