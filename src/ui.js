// HUD, overlays en levelmenu — leest het DirtSystem, schrijft naar de DOM.
import { LEVELS, loadProgress, isUnlocked } from './levels/index.js';

export class UI {
  constructor(dirt, level) {
    this.dirt = dirt;
    this.level = level;
    this.hud = document.getElementById('hud');
    this.startOverlay = document.getElementById('startOverlay');
    this.pauseOverlay = document.getElementById('pauseOverlay');
    this.winOverlay = document.getElementById('winOverlay');
    this.progressFill = document.getElementById('progressFill');
    this.progressLabel = document.getElementById('progressLabel');
    this.statsEl = document.getElementById('stats');
    this.toasts = document.getElementById('toasts');

    document.getElementById('levelName').textContent =
      `RIDE ${LEVELS.indexOf(level) + 1}/${LEVELS.length} — ${level.name.toUpperCase()}`;
    document.getElementById('levelTagline').textContent = level.tagline;

    this.#buildLevelMenu();
    this.#buildSections();
  }

  #buildLevelMenu() {
    const menu = document.getElementById('levelMenu');
    const done = loadProgress();
    LEVELS.forEach((lvl, i) => {
      const card = document.createElement('div');
      card.className = 'level-card';
      const unlocked = isUnlocked(i, done);
      if (lvl.id === this.level.id) card.classList.add('current');
      if (done[lvl.id]) card.classList.add('done');
      if (!unlocked) card.classList.add('locked');
      const state = done[lvl.id] ? '✓ CLEAN' : unlocked ? 'DIRTY' : '🔒 LOCKED';
      card.innerHTML =
        `<div class="num">RIDE ${i + 1}</div><div class="name">${lvl.name}</div><div class="state">${state}</div>`;
      if (unlocked && lvl.id !== this.level.id) {
        card.addEventListener('click', () => {
          location.search = `?level=${lvl.id}`;
        });
      }
      menu.appendChild(card);
    });
  }

  #buildSections() {
    // groepeer per label: asset-modellen hebben vaak meerdere masks per sectie
    this.sectionGroups = new Map();
    const sections = document.getElementById('sections');
    for (const m of this.dirt.masks.values()) {
      let group = this.sectionGroups.get(m.label);
      if (!group) {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<span class="name">${m.label}</span><span class="bar"><i></i></span>`;
        sections.appendChild(row);
        group = { row, ids: [] };
        this.sectionGroups.set(m.label, group);
      }
      group.ids.push(m.id);
    }
  }

  onStart(cb) {
    document.getElementById('startBtn').addEventListener('click', cb);
    document.getElementById('resumeBtn').addEventListener('click', cb);
  }

  onNext(cb) {
    document.getElementById('nextBtn').addEventListener('click', cb);
  }

  onMenu(cb) {
    document.getElementById('menuBtn').addEventListener('click', cb);
    document.getElementById('pauseMenuBtn').addEventListener('click', cb);
  }

  onRestart(cb) {
    document.getElementById('restartBtn').addEventListener('click', cb);
  }

  /** Settings-panel in het pauzemenu koppelen. */
  initSettings(settings, { onSound, onSensitivity, onReset }) {
    const sound = document.getElementById('setSound');
    const sens = document.getElementById('setSens');
    sound.checked = settings.sound;
    sens.value = settings.sensitivity;
    sound.addEventListener('change', () => onSound(sound.checked));
    sens.addEventListener('input', () => onSensitivity(parseFloat(sens.value)));
    document.getElementById('setReset').addEventListener('click', onReset);
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

  showWin(seconds, liters, hasNext) {
    this.hud.classList.remove('active');
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    document.getElementById('winStats').innerHTML =
      `⏱ Time: <b>${mins}m ${secs}s</b> &nbsp;·&nbsp; 💧 Water: <b>${liters.toFixed(1)} L</b>`;
    document.getElementById('winSub').textContent =
      `${this.level.name} is ready for guests again.`;
    document.getElementById('nextBtn').style.display = hasNext ? '' : 'none';
    this.winOverlay.classList.remove('hidden');
  }

  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3900);
  }

  refresh(seconds, liters) {
    const p = this.dirt.progress();
    this.progressFill.style.width = `${(p * 100).toFixed(1)}%`;
    this.progressLabel.textContent = `CLEAN: ${(p * 100).toFixed(1)}%`;

    for (const group of this.sectionGroups.values()) {
      let cleaned = 0, total = 0, done = true;
      for (const id of group.ids) {
        const m = this.dirt.masks.get(id);
        cleaned += m.cleaned;
        total += m.total;
        done = done && m.done;
      }
      group.row.querySelector('i').style.width = `${((cleaned / total) * 100).toFixed(0)}%`;
      group.row.classList.toggle('done', done);
    }

    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    this.statsEl.innerHTML = `⏱ <b>${mins}:${secs}</b> &nbsp; 💧 <b>${liters.toFixed(1)} L</b>`;
  }
}
