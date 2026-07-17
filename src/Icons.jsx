// Small inline SVG icon set, stroke follows currentColor.
const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const HomeIcon = () => (
  <svg {...base}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </svg>
);

export const AccountsIcon = () => (
  <svg {...base}>
    <rect x="3" y="6" width="18" height="14" rx="2.5" />
    <path d="M3 10h18" />
    <path d="M7 15h4" />
  </svg>
);

export const MoveMoneyIcon = () => (
  <svg {...base}>
    <path d="M4 8h13l-3-3" />
    <path d="M20 16H7l3 3" />
  </svg>
);

export const InsightsIcon = () => (
  <svg {...base}>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M21 20H3" />
  </svg>
);

export const MoreIcon = () => (
  <svg {...base}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

export const BellIcon = () => (
  <svg {...base}>
    <path d="M18 16v-5a6 6 0 1 0-12 0v5l-1.7 2.4h15.4Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);

export const SendIcon = () => (
  <svg {...base}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3l-6.8 18-3.7-7.3L3 10Z" />
  </svg>
);

export const BillIcon = () => (
  <svg {...base}>
    <path d="M6 2.5h12V21l-3-1.6-3 1.6-3-1.6-3 1.6Z" />
    <path d="M9 8h6" />
    <path d="M9 12h6" />
  </svg>
);

export const DepositIcon = () => (
  <svg {...base}>
    <path d="M12 3v10" />
    <path d="m8 9 4 4 4-4" />
    <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const FaceIdIcon = () => (
  <svg {...base}>
    <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" />
    <path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" />
    <path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" />
    <path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
    <path d="M8.5 9.5v1.2" />
    <path d="M15.5 9.5v1.2" />
    <path d="M12 9.5v3.6h-1" />
    <path d="M8.7 15.6a4.6 4.6 0 0 0 6.6 0" />
  </svg>
);

// TD-style shield logo: white shield, green "TD".
export function TdShield({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="TD">
      <path
        d="M4 5h32v18c0 8-7.2 13-16 17C11.2 36 4 31 4 23Z"
        fill="#fff"
        stroke="rgba(0,0,0,0.08)"
      />
      <text
        x="20"
        y="22.5"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="15"
        fontWeight="800"
        fill="#008a00"
      >
        TD
      </text>
    </svg>
  );
}

export const StatusGlyphs = () => (
  <svg width="58" height="12" viewBox="0 0 58 12" fill="currentColor">
    <rect x="0" y="7" width="2.6" height="4" rx="0.6" />
    <rect x="4" y="5.2" width="2.6" height="5.8" rx="0.6" />
    <rect x="8" y="3.4" width="2.6" height="7.6" rx="0.6" />
    <rect x="12" y="1.4" width="2.6" height="9.6" rx="0.6" />
    <path d="M25.8 4.3a7.4 7.4 0 0 0-9.2 0l1.3 1.5a5.4 5.4 0 0 1 6.6 0Zm-2 2.4a4.4 4.4 0 0 0-5.2 0l1.3 1.6a2.4 2.4 0 0 1 2.6 0Zm-2.6 3 1.5 1.8 1.4-1.8a2 2 0 0 0-2.9 0Z" />
    <rect x="33" y="2" width="20" height="8.4" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    <rect x="34.6" y="3.5" width="13" height="5.4" rx="1.2" />
    <path d="M54.6 4.7v3a1.7 1.7 0 0 0 0-3Z" opacity="0.5" />
  </svg>
);
