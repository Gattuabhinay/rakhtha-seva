/** Inline brand mark — never depends on a broken/missing /logo.png path. */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg
      className={`${className} brand-mark-morph`}
      viewBox="0 0 64 64"
      width={44}
      height={44}
      role="img"
      aria-label="Rakhtha Seva"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="rsDrop" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="55%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id="rsTile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1f232b" />
          <stop offset="100%" stopColor="#12151a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rsTile)" />
      <path
        d="M32 8C32 8 14 30 14 42c0 9.941 8.059 18 18 18s18-8.059 18-18C50 30 32 8 32 8z"
        fill="url(#rsDrop)"
      />
      <path
        d="M16 36h8l3-8 5 16 4-12 3 6h9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
