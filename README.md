# TD Sidekick — anti-scam banking demo

A hackathon prototype of a bank app that fights back against scams. Single
static React app (Vite), no backend — two browser windows of the same app
sync in real time over a BroadcastChannel named `sidekick` (falling back to
localStorage `storage` events). Everything here is fake and clearly
watermarked DEMO.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

Open **two windows** of the same URL:

- `#/` — role picker
- `#/phone` — the victim's banking app in a 390×844 phone frame
- `#/scammer` — desktop bank login pre-filled with stolen credentials

## Demo script

1. **Phone** — Sign in with Face ID (1.5 s scan). Home shows balance, full
   card number, transactions, and a live risk meter (green, 10).
2. **Scammer** — click Sign In. Password + OTP get accepted checkmarks, then
   the decoy trap: "Verifying device…" spins forever. The phone's risk jumps
   to 90 (red) and a full-screen alert slides up: *"We blocked a sign-in from
   a device we don't recognize."*
3. Tap **No — LOCK IT DOWN**: session revoked / payees cancelled / contact
   changes reverted / credentials rotated, checked off 600 ms apart, ending
   in *"You're safe. Victim → Defender 🛡️"*. The scammer window flips to a
   dead **Session terminated** screen.
4. **Hidden demo panel** — triple-click the TD logo (login or header).
   - *Trigger scam SMS*: iOS-style banner slides into the phone frame; tapping
     it opens a phishing page (`td-secure-verify.info` mock URL bar, red
     tint). Fields auto-fill on click, submit shows "Thank you, verifying…"
     and returns home after 2 s with risk +20.
   - *Exposure event* / hotkey **E**: balance, card number, and amounts blur
     (8 px, 150 ms), a "👀 Someone may be seeing this" banner appears, risk
     +30. Toggling off unblurs, leaves a "Recently exposed" tag, and the
     score decays 1 point per 2 s back to baseline.
   - *Enable BlindSpot camera*: loads face-api.js (tiny detector) from CDN
     and samples the front camera every 500 ms. Two or more faces fires the
     same exposure event; a single face for 3 consecutive checks clears it.
     If the camera or models fail, it fails silently — the hotkey path always
     keeps working.
   - *Reset demo*: resets both windows.

## Notes

- Broadcast message types: `exposure`, `risk_update`, `auth_attempt`,
  `auth_failed`, `lockdown`.
- Risk levels: 0–25 green · 26–50 yellow · 51–75 orange · 76–100 red.
- Works fully offline except the optional BlindSpot model download.
