// Levelregister — volgorde = unlock-volgorde.
import { CAROUSEL } from './carousel.js';
import { SHIP } from './ship.js';
import { TOPSPIN } from './topspin.js';
import { WOODIE } from './woodie.js';
import { STEELCOMET } from './steelcomet.js';

export const LEVELS = [CAROUSEL, SHIP, TOPSPIN, WOODIE, STEELCOMET];

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

export function isUnlocked(index, done = loadProgress()) {
  return index === 0 || !!done[LEVELS[index - 1].id];
}
