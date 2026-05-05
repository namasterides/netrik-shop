// Reusable Netrik Shop logo - SVG, light theme, emerald accent.
export const NetrikLogo = ({ className = 'h-10 w-10' }) => (
  <svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="netrik-emerald" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#065f46" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="68" height="68" rx="18" fill="url(#netrik-emerald)" />
    <circle cx="36" cy="36" r="20" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
    <text
      x="36"
      y="44"
      textAnchor="middle"
      fontSize="22"
      fontWeight="800"
      fontFamily="'Plus Jakarta Sans', Inter, sans-serif"
      fill="#ffffff"
      letterSpacing="-1"
    >
      NS
    </text>
    <circle cx="55" cy="17" r="2.2" fill="#ffffff" />
  </svg>
);

export default NetrikLogo;
