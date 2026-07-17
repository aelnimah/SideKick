// Step 5 (optional): face-api.js loaded from CDN at runtime. Everything in
// here is best-effort — any failure leaves the hotkey exposure path untouched.
const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const WEIGHTS_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';

let loadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export function loadFaceApi() {
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!window.faceapi) await loadScript(SCRIPT_URL);
      await window.faceapi.nets.tinyFaceDetector.loadFromUri(WEIGHTS_URL);
      return window.faceapi;
    })();
    loadPromise.catch(() => {
      loadPromise = null; // allow a retry on next toggle
    });
  }
  return loadPromise;
}

export async function detectFaces(video) {
  const faceapi = window.faceapi;
  if (!faceapi || !video || video.readyState < 2) return null;
  const detections = await faceapi.detectAllFaces(
    video,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }),
  );
  return detections.length;
}
