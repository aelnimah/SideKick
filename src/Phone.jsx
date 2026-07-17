import { useCallback, useEffect, useRef, useState } from 'react';
import { send, subscribe } from './sync.js';
import RiskMeter from './RiskMeter.jsx';
import { loadFaceApi, detectFaces } from './faceDetect.js';
import {
  TdShield, StatusGlyphs, BellIcon, FaceIdIcon,
  HomeIcon, AccountsIcon, MoveMoneyIcon, InsightsIcon, MoreIcon,
  SendIcon, BillIcon, DepositIcon,
} from './Icons.jsx';

const BASELINE = 10;
const clamp = (n) => Math.max(0, Math.min(100, n));

const TRANSACTIONS = [
  { id: 1, name: 'Metro Grocery', date: 'Jul 16', amount: -64.12 },
  { id: 2, name: 'Payroll — Cedar Ridge Dental', date: 'Jul 15', amount: 2140.0 },
  { id: 3, name: 'Hydro One', date: 'Jul 14', amount: -128.4 },
  { id: 4, name: 'Tim Hortons', date: 'Jul 14', amount: -8.65 },
  { id: 5, name: 'E-transfer from Sam', date: 'Jul 12', amount: 45.0 },
];

const LOCKDOWN_LINES = [
  'Session revoked',
  'New payees cancelled',
  'Contact changes reverted',
  'Credentials rotated',
];

const money = (n) =>
  `${n < 0 ? '−' : '+'}$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2 })}`;

// Scale the 390x844 frame down so it always fits (iPad Split View, laptops).
function useFitScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () =>
      setScale(Math.min(1, (window.innerHeight - 16) / 872, (window.innerWidth - 12) / 418));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return scale;
}

function useClock() {
  const fmt = () =>
    new Date().toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: false });
  const [time, setTime] = useState(fmt);
  useEffect(() => {
    const t = setInterval(() => setTime(fmt()), 15000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function StatusBar({ dark }) {
  const time = useClock();
  return (
    <div className={`status-bar ${dark ? 'dark' : ''}`}>
      <span className="status-time">{time}</span>
      <StatusGlyphs />
    </div>
  );
}

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
  const [camLive, setCamLive] = useState(false);
  const [faceCount, setFaceCount] = useState(null); // null = detector not reporting
  const videoRef = useRef(null);

  const exposedRef = useRef(false);
  const exposureSourceRef = useRef(null);
  const lockdownActive = lockStep >= 0;
  const scale = useFitScale();

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

  // ---- demo panel (triple-click/tap the shield logo) ----
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

  // ---- BlindSpot camera: preview opens first; detection is best-effort on top ----
  useEffect(() => {
    if (!camOn) {
      setFaceCount(null);
      setCamLive(false);
      return undefined;
    }
    let stream = null;
    let timer = null;
    let stopped = false;
    let busy = false;
    let detectReady = false;
    let onesInARow = 0;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play().catch(() => {});
        setCamLive(true);
      } catch {
        // camera denied or unavailable — silently switch back off
        if (!stopped) setCamOn(false);
        return;
      }
      // models load in the background; the preview never waits on them
      loadFaceApi()
        .then(() => { detectReady = true; })
        .catch(() => {});
      timer = setInterval(async () => {
        if (!detectReady || busy || stopped) return;
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
        } catch {
          /* one bad frame never kills the loop */
        } finally {
          busy = false;
        }
      }, 500);
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
      <div className="phone-frame" style={{ transform: `scale(${scale})` }}>
        <div className="phone-screen">
          <div className="phone-notch" />

          {/* iOS-style scam SMS banner */}
          <div className={`sms-banner ${smsVisible ? 'show' : ''}`} onClick={openPhish}>
            <div className="sms-app-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <path d="M12 3C6.5 3 2 6.8 2 11.4c0 2.6 1.4 4.9 3.6 6.4-.2 1-.8 2.4-1.6 3.2 1.7-.2 3.5-1 4.6-1.8 1.1.3 2.2.5 3.4.5 5.5 0 10-3.7 10-8.3S17.5 3 12 3Z" />
              </svg>
            </div>
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
              <StatusBar dark />
              <div className="login-top">
                <div className="login-logo" onClick={onLogoClick}>
                  <TdShield size={72} />
                </div>
                <h1>Welcome back, Maria</h1>
                <p className="login-sub">TD Sidekick · Personal Banking</p>
              </div>
              <div className="login-bottom">
                <button className="faceid-btn" onClick={startFaceId}>
                  <FaceIdIcon /> Sign in with Face ID
                </button>
                <button className="login-alt">Use password instead</button>
                <p className="login-hint">Protected by TD Fraud Shield</p>
              </div>
            </div>
          )}

          {screen === 'scanning' && (
            <div className="screen login-screen centered">
              <div className="faceid-scan">
                <div className="faceid-ring" />
                <FaceIdIcon />
              </div>
              <p className="scan-label">Scanning…</p>
            </div>
          )}

          {screen === 'home' && (
            <div className={`screen home-screen ${exposed ? 'is-exposed' : ''}`}>
              <header className="app-header">
                <StatusBar dark />
                <div className="header-row">
                  <div className="header-brand" onClick={onLogoClick}>
                    <TdShield size={34} />
                  </div>
                  <div className="header-right">
                    <RiskMeter score={risk} recentlyExposed={recentlyExposed && !exposed} />
                    <button className="bell-btn" aria-label="Notifications">
                      <BellIcon />
                      <span className="bell-dot" />
                    </button>
                  </div>
                </div>
                <p className="greeting">Good morning, Maria</p>
              </header>

              <div className="home-body">
                <section className="account-card">
                  <div className="account-top">
                    <span className="account-name">TD Every Day Chequing</span>
                    <span className="account-num">4821</span>
                  </div>
                  <div className="balance-amount sensitive">$8,432.19</div>
                  <div className="account-sub">Available balance</div>
                </section>

                <section className="visa-card">
                  <div className="visa-top">
                    <TdShield size={26} />
                    <span className="visa-brand">VISA</span>
                  </div>
                  <div className="card-row">
                    <span className="card-chip" />
                    <span className="card-number sensitive">4520 1234 5678 4821</span>
                  </div>
                  <div className="card-meta">
                    <span>MARIA CHEN</span>
                    <span>09/28</span>
                  </div>
                </section>

                <section className="quick-actions">
                  <button
                    className="qa-btn"
                    onClick={() => showToast('Transfers are disabled in this demo')}
                  >
                    <span className="qa-icon"><SendIcon /></span>
                    Send Money
                  </button>
                  <button className="qa-btn" onClick={() => showToast('Demo only')}>
                    <span className="qa-icon"><BillIcon /></span>
                    Pay Bills
                  </button>
                  <button className="qa-btn" onClick={() => showToast('Demo only')}>
                    <span className="qa-icon"><DepositIcon /></span>
                    Deposit
                  </button>
                </section>

                <section className="tx-section">
                  <div className="tx-heading">
                    <span>Recent activity</span>
                    <button className="tx-viewall">View all</button>
                  </div>
                  {TRANSACTIONS.map((tx) => (
                    <div className="tx-row" key={tx.id}>
                      <span className="tx-info">
                        <span className="tx-name">{tx.name}</span>
                        <span className="tx-date">{tx.date}</span>
                      </span>
                      <span className={`tx-amount sensitive ${tx.amount > 0 ? 'pos' : ''}`}>
                        {money(tx.amount)}
                      </span>
                    </div>
                  ))}
                </section>
              </div>

              <nav className="tab-bar">
                <button className="tab active"><HomeIcon />Home</button>
                <button className="tab"><AccountsIcon />Accounts</button>
                <button className="tab"><MoveMoneyIcon />Move Money</button>
                <button className="tab"><InsightsIcon />Insights</button>
                <button className="tab"><MoreIcon />More</button>
              </nav>
            </div>
          )}

          {screen === 'phish' && (
            <div className="screen phish-screen">
              <StatusBar />
              <div className="phish-urlbar">
                <span className="phish-lock">⚠︎</span>
                <span className="phish-url">td-secure-verify.info</span>
              </div>
              {!phishVerifying ? (
                <div className="phish-body">
                  <div className="phish-shield"><TdShield size={56} /></div>
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
            <div className="alert-badge">
              <TdShield size={40} />
            </div>
            <span className="alert-kicker">TD Fraud Shield</span>
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

          {/* BlindSpot live camera preview */}
          <div className={`blindspot-preview ${camOn && camLive ? 'show' : ''}`}>
            <video ref={videoRef} muted playsInline />
            <span className="blindspot-chip">
              {faceCount == null
                ? 'BlindSpot active'
                : `BlindSpot · ${faceCount} face${faceCount === 1 ? '' : 's'}`}
            </span>
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
        </div>
      </div>
    </div>
  );
}
