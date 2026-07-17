export default function RolePicker() {
  return (
    <div className="picker-page">
      <div className="picker-brand">
        <span className="logo-square">TD</span> Sidekick
      </div>
      <p className="picker-sub">Anti-scam banking demo — open each role in its own window.</p>
      <div className="picker-buttons">
        <a className="picker-btn" href="#/phone">
          <span className="picker-emoji">📱</span>
          <span className="picker-title">Victim Phone</span>
          <span className="picker-desc">The banking app, in a phone frame</span>
        </a>
        <a className="picker-btn" href="#/scammer">
          <span className="picker-emoji">💻</span>
          <span className="picker-title">Scammer Laptop</span>
          <span className="picker-desc">Desktop bank login with stolen credentials</span>
        </a>
      </div>
    </div>
  );
}
