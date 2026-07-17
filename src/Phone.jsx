import { useCallback, useEffect, useRef, useState } from 'react';
import { send, subscribe } from './sync.js';
import RiskMeter from './RiskMeter.jsx';
import { loadFaceApi, detectFaces } from './faceDetect.js';

const BASELINE = 10;
const clamp = (n) => Math.max(0, Math.min(100, n));

const TRANSACTIONS = [
  { id: 1, name: 'Metro Grocery', date: 'Jul 16', amount: -64.12, icon: '🛒' },
  { id: 2, name: 'Payroll — Cedar Ridge Dental', date: 'Jul 15', amount: 2140.0, icon: '💼' },
  { id: 3, name: 'Hydro One', date: 'Jul 14', amount: -128.4, icon: '⚡' },
  { id: 4, name: 'Tim Hortons', date: 'Jul 14', amount: -8.65, icon: '☕' },
  { id: 5, name: 'E-transfer from Sam', date: 'Jul 12', amount: 45.0, icon: '📥' },
];

const LOCKDOWN_LINES = [
  'Session revoked',
  'New payees cancelled',
  'Contact changes reverted',
  'Credentials rotated',
];

const money = (n) =>
  `${n < 0 ? '−' : '+'}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

export default function Phone() {
  // ---- core state ----
  const [screen, setScreen] = useState('login'); // login | scanning | home | phish
  const [risk, setRisk] = useState(BASELINE);
  const [exposed, setExposed] = useState(false);
  const [recentlyExposed, setRecentlyExposed] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [lockStep, setLockStep] = useState(-1); // -1 off; 0..3 lines; 4 "you're safe"
  const [smsVisible, setSmsVisible] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState('');

  // phishing page
  const [phishUser, setPhishUser] = useState('');
  const [phishPass, setPhishPass] = useState('');
  const [phishVerifying, setPhishVerifying] = useState(false);

  // BlindSpot camera
  const [camOn, setCamOn] = useState(false);
  const [faceCount, setFaceCount] = useState(null); // null = not running/failed
  const videoRef = useRef(null);

  const exposedRef = useRef(false);
  const exposureSourceRef = useRef(null);
  const lockdownActive = lockStep >= 0;

  // ---- exposure (shared by hotkey "E" and BlindSpot camera) ----
  const setExposure = useCallback((on, source = 'hotkey') => {
    if (on === exposedRef.current) return;
    exposedRef.current = on;
    setExposed(on);
    if (on) {
      exposureSourceRef.current = source;
      setRecentlyExposed(false);
      setRisk((r) => clamp(r + 30));
    } else {
      exposureSourceRef.current = null;
      setRecentlyExposed(true);
    }
    send('exposure', { on, source });
  }, []);

  // hotkey E toggles exposure
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'e' || e.key === 'E') setExposure(!exposedRef.current, 'hotkey');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setExposure]);

  // decay 1 point per 2s back toward baseline once nothing scary is on screen
  useEffect(() => {
    if (exposed || alertOpen || lockdownActive || risk <= BASELINE) return undefined;
    const t = setInterval(() => setRisk((r) => Math.max(BASELINE, r - 1)), 2000);
    return () => clearInterval(t);
  }, [exposed, alertOpen, lockdownActive, risk > BASELINE]);

  useEffect(() => {
    if (risk <= BASELINE && recentlyExposed) setRecentlyExposed(false);
  }, [risk, recentlyExposed]);

  // ---- incoming messages from the scammer window ----
  useEffect(
    () =>
      subscribe((msg) => {
        if (msg.type === 'auth_attempt') {
          setRisk((r) => Math.max(r, 40));
        } else if (msg.type === 'auth_failed') {
          setRisk(90);
          setAlertOpen(true);
        }
      }),
    [],
  );

  // broadcast risk updates so any window could mirror the meter
  useEffect(() => {
    send('risk_update', { score: risk });
  }, [risk]);

  // ---- lockdown sequence ----
  const startLockdown = () => {
    setAlertOpen(false);
    setLockStep(0);
    send('lockdown', { at: Date.now() });
  };
  useEffect(() => {
    if (lockStep < 0 || lockStep > 4) return undefined;
    if (lockStep === 4) {
      setRisk(BASELINE);
      setRecentlyExposed(false);
      return undefined;
    }
    const t = setTimeout(() => setLockStep((s) => s + 1), 600);
    return () => clearTimeout(t);
  }, [lockStep]);

  // ---- Face ID login ----
  const startFaceId = () => {
    setScreen('scanning');
    setTimeout(() => setScreen('home'), 1500);
  };

  // ---- demo panel (triple-click the logo) ----
  const clickTimes = useRef([]);
  const onLogoClick = () => {
    const now = Date.now();
    clickTimes.current = [...clickTimes.current.filter((t) => now - t < 700), now];
    if (clickTimes.current.length >= 3) {
      clickTimes.current = [];
      setPanelOpen((o) => !o);
    }
  };

  const resetDemo = () => {
    setScreen('login');
    setRisk(BASELINE);
    setExposed(false);
    exposedRef.current = false;
    setRecentlyExposed(false);
    setAlertOpen(false);
    setLockStep(-1);
    setSmsVisible(false);
    setPanelOpen(false);
    setPhishUser('');
    setPhishPass('');
    setPhishVerifying(false);
    setCamOn(false);
    send('risk_update', { score: BASELINE, reset: true });
  };

  // ---- phishing flow ----
  const openPhish = () => {
    setSmsVisible(false);
    setPhishUser('');
    setPhishPass('');
    setPhishVerifying(false);
    setScreen('phish');
  };
  const submitPhish = () => {
    if (phishVerifying) return;
    setPhishVerifying(true);
    setTimeout(() => {
      setScreen('home');
      setPhishVerifying(false);
      setRisk((r) => clamp(r + 20));
      setRecentlyExposed(true);
      send('risk_update', { reason: 'creds_leaked', delta: 20 });
    }, 2000);
  };

  // ---- BlindSpot camera (step 5, best-effort) ----
  useEffect(() => {
    if (!camOn) {
      setFaceCount(null);
      return undefined;
    }
    let stream = null;
    let timer = null;
    let stopped = false;
    let busy = false;
    let onesInARow = 0;
    (async () => {
      try {
        await loadFaceApi();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        timer = setInterval(async () => {
          if (busy || stopped) return;
          busy = true;
          try {
            const count = await detectFaces(videoRef.current);
            if (count == null || stopped) return;
            setFaceCount(count);
            if (count >= 2) {
              onesInARow = 0;
              if (!exposedRef.current) setExposure(true, 'camera');
            } else {
              onesInARow += 1;
              if (
                onesInARow >= 3 &&
                exposedRef.current &&
                exposureSourceRef.current === 'camera'
              ) {
                setExposure(false);
              }
            }
          } finally {
            busy = false;
          }
        }, 500);
      } catch {
        // camera or model unavailable — fail silently, hotkey still works
        if (!stopped) setFaceCount(null);
      }
    })();
    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [camOn, setExposure]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 1800);
  };

  // ---- render ----
  return (
    <div className="phone-stage">
      <div className="phone-frame">
        <div className="phone-screen">
          <div className="phone-notch" />

          {/* iOS-style scam SMS banner */}
          <div className={`sms-banner ${smsVisible ? 'show' : ''}`} onClick={openPhish}>
            <div className="sms-app-icon">💬</div>
            <div className="sms-body">
              <div className="sms-top">
                <span className="sms-from">TD Alert</span>
                <span className="sms-when">now</span>
              </div>
              <div className="sms-text">
                Did you approve this $890 charge at LUXE-ELECTRONICS? Tap to review now.
              </div>
            </div>
          </div>

          {/* exposure banner */}
          <div className={`exposure-banner ${exposed ? 'show' : ''}`}>
            👀 Someone may be seeing this — details hidden
          </div>

          {screen === 'login' && (
            <div className="screen login-screen">
              <div className="login-logo" onClick={onLogoClick}>
                <span className="logo-square big">TD</span>
              </div>
              <h1>TD Sidekick</h1>
              <p className="login-sub">Banking that has your back</p>
              <button className="btn-primary faceid-btn" onClick={startFaceId}>
                <span className="faceid-glyph">◉</span> Sign in with Face ID
              </button>
              <p className="login-hint">Maria Chen · maria.chen</p>
            </div>
          )}

          {screen === 'scanning' && (
            <div className="screen login-screen">
              <div className="faceid-scan">
                <div className="faceid-ring" />
                <span className="faceid-face">😐</span>
              </div>
              <p className="scan-label">Scanning…</p>
            </div>
          )}

          {screen === 'home' && (
            <div className={`screen home-screen ${exposed ? 'is-exposed' : ''}`}>
              <header className="app-header">
                <div className="header-brand" onClick={onLogoClick}>
                  <span className="logo-square">TD</span>
                  <span className="header-name">Sidekick</span>
                </div>
                <div className="header-right">
                  {camOn && faceCount != null && (
                    <span className="blindspot-chip">
                      BlindSpot active · {faceCount} face{faceCount === 1 ? '' : 's'}
                    </span>
                  )}
                  <RiskMeter score={risk} recentlyExposed={recentlyExposed && !exposed} />
                </div>
              </header>

              <div className="home-body">
                <p className="greeting">Good morning, Maria</p>

                <div className="balance-card">
                  <div className="balance-label">Everyday Chequing</div>
                  <div className="balance-amount sensitive">$8,432.19</div>
                  <div className="card-row">
                    <span className="card-chip" />
                    <span className="card-number sensitive">4520 1234 5678 4821</span>
                  </div>
                  <div className="card-meta">
                    <span>MARIA CHEN</span>
                    <span>Card ending 4821 · 09/28</span>
                  </div>
                </div>

                <button
                  className="btn-primary send-money"
                  onClick={() => showToast('Transfers are disabled in this demo')}
                >
                  Send Money
                </button>

                <div className="tx-section">
                  <div className="tx-heading">Recent activity</div>
                  {TRANSACTIONS.map((tx) => (
                    <div className="tx-row" key={tx.id}>
                      <span className="tx-icon">{tx.icon}</span>
                      <span className="tx-info">
                        <span className="tx-name">{tx.name}</span>
                        <span className="tx-date">{tx.date}</span>
                      </span>
                      <span className={`tx-amount sensitive ${tx.amount > 0 ? 'pos' : ''}`}>
                        {money(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {screen === 'phish' && (
            <div className="screen phish-screen">
              <div className="phish-urlbar">
                <span className="phish-lock">⚠︎</span>
                <span className="phish-url">td-secure-verify.info</span>
              </div>
              {!phishVerifying ? (
                <div className="phish-body">
                  <div className="login-logo small">
                    <span className="logo-square big">TD</span>
                  </div>
                  <h2>Verify your identity</h2>
                  <p className="phish-sub">
                    A charge of <b>$890.00</b> at LUXE-ELECTRONICS needs your review.
                  </p>
                  <label className="field">
                    <span>Username</span>
                    <input
                      value={phishUser}
                      onFocus={() => setPhishUser('maria.chen')}
                      onChange={(e) => setPhishUser(e.target.value)}
                      placeholder="Username"
                    />
                  </label>
                  <label className="field">
                    <span>Password</span>
                    <input
                      type="password"
                      value={phishPass}
                      onFocus={() => setPhishPass('Sunnyside2021!')}
                      onChange={(e) => setPhishPass(e.target.value)}
                      placeholder="Password"
                    />
                  </label>
                  <button className="btn-primary phish-submit" onClick={submitPhish}>
                    Review charge
                  </button>
                  <p className="phish-fineprint">Secure verification portal · TD Bank Grp</p>
                </div>
              ) : (
                <div className="phish-body verifying">
                  <div className="spinner" />
                  <p>Thank you, verifying…</p>
                </div>
              )}
            </div>
          )}

          {/* blocked sign-in alert sheet */}
          <div className={`alert-sheet ${alertOpen ? 'show' : ''}`}>
            <div className="alert-icon">⚠️</div>
            <h2>We blocked a sign-in from a device we don't recognize.</h2>
            <p className="alert-detail">
              Location: Unknown device, Chrome
              <br />
              Just now
            </p>
            <p className="alert-question">Was this you?</p>
            <button className="btn-danger" onClick={startLockdown}>
              No — LOCK IT DOWN
            </button>
            <button className="btn-ghost" onClick={() => setAlertOpen(false)}>
              Yes, that's me
            </button>
          </div>

          {/* lockdown sequence */}
          <div className={`lockdown-sheet ${lockdownActive ? 'show' : ''}`}>
            <div className="lockdown-inner">
              <h2>Locking it down</h2>
              <ul className="lockdown-lines">
                {LOCKDOWN_LINES.map((line, i) => (
                  <li key={line} className={lockStep > i ? 'done' : lockStep === i ? 'active' : ''}>
                    <span className="lockdown-check">{lockStep > i ? '✓' : ''}</span>
                    {line}
                  </li>
                ))}
              </ul>
              {lockStep >= 4 && (
                <div className="lockdown-final">
                  <p className="safe-line">You're safe.</p>
                  <p className="defender-line">Victim → Defender 🛡️</p>
                  <button className="btn-primary" onClick={() => setLockStep(-1)}>
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* hidden demo panel */}
          {panelOpen && (
            <div className="demo-panel">
              <div className="demo-panel-title">Demo controls</div>
              <button onClick={() => { setSmsVisible(true); setPanelOpen(false); }}>
                Trigger scam SMS
              </button>
              <button onClick={() => { setExposure(!exposedRef.current, 'hotkey'); setPanelOpen(false); }}>
                Exposure event
              </button>
              <button onClick={() => setCamOn((v) => !v)}>
                {camOn ? 'Disable' : 'Enable'} BlindSpot camera
              </button>
              <button onClick={resetDemo}>Reset demo</button>
              <div className="demo-panel-hint">Hotkey: press E to toggle exposure</div>
            </div>
          )}

          {toast && <div className="toast">{toast}</div>}
          <video ref={videoRef} className="blindspot-video" muted playsInline />
        </div>
      </div>
    </div>
  );
}
