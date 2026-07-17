// Two-window sync over BroadcastChannel "sidekick", falling back to
// localStorage `storage` events when BroadcastChannel is unavailable.
const CHANNEL = 'sidekick';
const LS_KEY = 'sidekick-msg';

let bc = null;
try {
  bc = new BroadcastChannel(CHANNEL);
} catch {
  bc = null;
}

export function send(type, payload = {}) {
  const msg = { type, payload, ts: Date.now(), nonce: Math.random().toString(36).slice(2) };
  if (bc) {
    bc.postMessage(msg);
  } else {
    // storage events only fire in OTHER windows, which is exactly what we want
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(msg));
    } catch {
      /* ignore */
    }
  }
}

export function subscribe(fn) {
  if (bc) {
    const handler = (e) => fn(e.data);
    bc.addEventListener('message', handler);
    return () => bc.removeEventListener('message', handler);
  }
  const handler = (e) => {
    if (e.key !== LS_KEY || !e.newValue) return;
    try {
      fn(JSON.parse(e.newValue));
    } catch {
      /* ignore */
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
