'use client';

import { useState } from 'react';

const LOGO_CANDIDATES = [
  '/brand/original/loading%20logo.png',
  '/brand/original/lodiing%20logo.png',
  '/brand/original/netrikshop%20update%20logo.png',
];

export default function LoadingLogo({ className = 'h-12 w-12', alt = 'Loading' }) {
  const [logoIndex, setLogoIndex] = useState(0);
  const src = LOGO_CANDIDATES[Math.min(logoIndex, LOGO_CANDIDATES.length - 1)];

  return (
    <div className={`netrik-loading-wrap ${className}`} aria-label={alt} role="img">
      <span className="netrik-loading-ring" aria-hidden="true" />
      <img
        src={src}
        alt={alt}
        className="netrik-loading-logo"
        loading="eager"
        decoding="async"
        onError={() => setLogoIndex((prev) => (prev + 1 < LOGO_CANDIDATES.length ? prev + 1 : prev))}
      />
    </div>
  );
}
