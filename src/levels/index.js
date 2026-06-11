// Levelregister — volgorde = unlock-volgorde.
import { CAROUSEL } from './carousel.js';
import { SHIP } from './ship.js';
import { TOPSPIN } from './topspin.js';
import { DARKRIDE } from './darkride.js';
import { WOODIE } from './woodie.js';
import { STEELCOMET } from './steelcomet.js';

export const LEVELS = [CAROUSEL, SHIP, TOPSPIN, DARKRIDE, WOODIE, STEELCOMET];

const DONE_KEY = 'rws_done';

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY)) || {};
  } catch {
    return {};
  }
}

export function markDone(id) {
  const done = loadProgress();
  done[id] = true;
  localStorage.setItem(DONE_KEY, JSON.stringify(done));
}

// Prototype / full game mode: alles direct speelbaar, geen unlock-gate.
// (✓-states worden wel bijgehouden voor het menu.)
export function isUnlocked() {
  return true;
}
