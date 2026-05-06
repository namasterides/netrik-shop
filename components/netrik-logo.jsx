const LOGO_MARK = '/brand/original/netrik-mark.png';
const LOGO_WORDMARK = '/brand/original/netrik-wordmark.png';

// Reusable Netrik Shop logo (mark or wordmark).
export const NetrikLogo = ({ className = 'h-10 w-10', alt = 'Netrik Shop', variant = 'mark' }) => {
  const src = variant === 'wordmark' ? LOGO_WORDMARK : LOGO_MARK;
  return <img src={src} alt={alt} className={`${className} object-contain block`} />;
};

export default NetrikLogo;
