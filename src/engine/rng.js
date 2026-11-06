export function hashSeed(value) {
  const text = String(value ?? 'star-realms');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function nextRandom(state) {
  let t = (state.rngState += 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.rngState = state.rngState >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomFrom(seed) {
  const box = { rngState: hashSeed(seed) };
  return () => nextRandom(box);
}

export function shuffle(state, array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
