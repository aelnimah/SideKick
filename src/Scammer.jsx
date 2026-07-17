import { useEffect, useState } from 'react';
import { send, subscribe } from './sync.js';

export default function Scammer() {
  // idle → accepted (checkmarks) → trap (spinner forever) → dead (lockdown)
  const [phase, setPhase] = useState('idle');

  useEffect(
    () =>
      subscribe((msg) => {
        if (msg.type === 'lockdown') setPhase('dead');
        else if (msg.type === 'risk_update' && msg.payload?.reset) setPhase('idle');
      }),
    [],
  );

  useEffect(() => {
    if (phase !== 'accepted') return undefined;
    const t = setTimeout(() => {
      setPhase('trap');
      send('auth_failed', { device: 'Chrome', location: 'Unknown' });
    }, 1200);
    return () => clearTimeout(t);
  }, [phase]);

  const signIn = () => {
    if (phase !== 'idle') return;
    send('auth_attempt', { user: 'maria.chen' });
    setPhase('accepted');
  };

  if (phase === 'dead') {
    return (
      <div className="scammer-dead">
        <div className="dead-icon">⛔</div>
        <h1>Session terminated</h1>
        <p>This session has been revoked by the account holder.</p>
        <p className="dead-sub">All credentials associated with this session are no longer valid.</p>
      </div>
    );
  }

  const accepted = phase === 'accepted' || phase === 'trap';

  return (
    <div className="scammer-page">
      <header className="scammer-topbar">
        <span className="logo-square">TD</span>
        <span className="scammer-brand">TD Sidekick Online Banking</span>
        <span className="scammer-topbar-right">EasyWeb · Personal</span>
      </header>
      <main className="scammer-main">
        <div className="scammer-card">
          <h1>Sign in</h1>
          <label className="field">
            <span>Username</span>
            <div className="field-check-wrap">
              <input defaultValue="maria.chen" readOnly />
              {accepted && <span className="field-check">✓</span>}
            </div>
          </label>
          <label className="field">
            <span>Password</span>
            <div className="field-check-wrap">
              <input type="password" defaultValue="••••••••" readOnly />
              {accepted && <span className="field-check">✓</span>}
            </div>
          </label>
          <label className="field">
            <span>One-time passcode</span>
            <div className="field-check-wrap">
              <input defaultValue="284913" readOnly />
              {accepted && <span className="field-check">✓</span>}
            </div>
          </label>
          <button className="btn-primary scammer-signin" onClick={signIn} disabled={phase !== 'idle'}>
            {phase === 'idle' ? 'Sign In' : 'Signing in…'}
          </button>
          {phase === 'trap' && (
            <div className="verify-trap">
              <div className="spinner" />
              <span>Verifying device…</span>
              <span className="verify-small">Additional verification required</span>
            </div>
          )}
        </div>
        <p className="scammer-foot">Bank-grade security · 256-bit encryption</p>
      </main>
    </div>
  );
}
