// Reusable Netrik Shop logo - SVG, no images needed.
export const NetrikLogo = ({ className = 'h-10 w-10' }) => (
  <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="netrik-g1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fbbf24"/>
        <stop offset="55%" stopColor="#f59e0b"/>
        <stop offset="100%" stopColor="#fb7185"/>
      </linearGradient>
      <linearGradient id="netrik-g2" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0%" stopColor="#0a0a0e"/>
        <stop offset="100%" stopColor="#1f1f2e"/>
      </linearGradient>
      <radialGradient id="netrik-g3" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#fde68a" stopOpacity="0.18"/>
        <stop offset="100%" stopColor="#fde68a" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="68" height="68" rx="18" fill="url(#netrik-g1)"/>
    <rect x="6" y="6" width="60" height="60" rx="15" fill="url(#netrik-g2)"/>
    <circle cx="36" cy="36" r="20" fill="none" stroke="#fbbf24" strokeOpacity="0.75" strokeWidth="2"/>
    <circle cx="36" cy="36" r="16" fill="url(#netrik-g3)"/>
    <text x="36" y="43" textAnchor="middle" fontSize="19" fontWeight="800" fontFamily="Verdana, sans-serif" fill="#fdf4d0">NS</text>
    <path d="M50 14 L50 23 M53 14 L53 23 M56 14 L56 23" stroke="#fbbf24" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="53" cy="27" r="1.6" fill="#fbbf24"/>
  </svg>
);

export default NetrikLogo;
