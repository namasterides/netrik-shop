const LOGO_PRIMARY = '/brand/original/netrikshop%20update%20logo.png';
const LOGO_LOGIN = '/brand/original/login%20logo.png';

// Reusable Netrik Shop logo (primary or login-specific).
export const NetrikLogo = ({ className = 'h-10 w-10', alt = 'Netrik Shop', variant = 'primary' }) => {
  const src = variant === 'login' ? LOGO_LOGIN : LOGO_PRIMARY;
  return <img src={src} alt={alt} className={`${className} object-contain block`} />;
};
export default NetrikLogo;
