// Hartnell College wordmark + panther icon — SVG, no external file needed
// Colors match official brand guidelines (#860038 magenta, #fdb913 gold)

export function HartnellLogo({ size = 40, dark = false }) {
  const text = dark ? '#ffffff' : '#860038';
  const gold  = '#fdb913';
  const bg    = dark ? '#860038' : '#ffffff';

  return (
    <svg
      width={size * 3.8}
      height={size}
      viewBox="0 0 152 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Hartnell College"
      role="img"
    >
      {/* Panther icon mark */}
      <rect width="40" height="40" rx="6" fill="#860038" />
      {/* Stylised panther head silhouette */}
      <circle cx="20" cy="15" r="9" fill={gold} />
      <ellipse cx="20" cy="30" rx="8" ry="6" fill={gold} />
      {/* Eyes */}
      <circle cx="17" cy="14" r="1.5" fill="#860038" />
      <circle cx="23" cy="14" r="1.5" fill="#860038" />
      {/* Nose */}
      <ellipse cx="20" cy="17" rx="1.2" ry="0.8" fill="#860038" />
      {/* Ears */}
      <polygon points="13,8 10,3 16,6" fill={gold} />
      <polygon points="27,8 30,3 24,6" fill={gold} />
      {/* Inner ear */}
      <polygon points="13,7 11,4.5 15,6" fill="#860038" opacity="0.5"/>
      <polygon points="27,7 29,4.5 25,6" fill="#860038" opacity="0.5"/>
      {/* Whiskers */}
      <line x1="20" y1="17" x2="9"  y2="16" stroke="#860038" strokeWidth="0.6" />
      <line x1="20" y1="17" x2="31" y2="16" stroke="#860038" strokeWidth="0.6" />
      <line x1="20" y1="18" x2="9"  y2="19" stroke="#860038" strokeWidth="0.6" />
      <line x1="20" y1="18" x2="31" y2="19" stroke="#860038" strokeWidth="0.6" />

      {/* HARTNELL text */}
      <text x="48" y="17" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="13" fill="#860038" letterSpacing="1">
        HARTNELL
      </text>
      {/* COLLEGE text */}
      <text x="48" y="30" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="10" fill="#fdb913" letterSpacing="2">
        COLLEGE
      </text>
      {/* Tagline dot accent */}
      <circle cx="48" cy="36" r="1.5" fill="#860038" />
      <circle cx="53" cy="36" r="1.5" fill="#fdb913" />
    </svg>
  );
}

// Compact icon-only mark for tight spaces
export function PantherMark({ size = 32 }) {
  const gold = '#fdb913';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Hartnell Panther" role="img">
      <rect width="40" height="40" rx="8" fill="#860038" />
      <circle cx="20" cy="15" r="9" fill={gold} />
      <ellipse cx="20" cy="30" rx="8" ry="6" fill={gold} />
      <circle cx="17" cy="14" r="1.5" fill="#860038" />
      <circle cx="23" cy="14" r="1.5" fill="#860038" />
      <ellipse cx="20" cy="17" rx="1.2" ry="0.8" fill="#860038" />
      <polygon points="13,8 10,3 16,6" fill={gold} />
      <polygon points="27,8 30,3 24,6" fill={gold} />
      <line x1="20" y1="17" x2="9"  y2="16" stroke="#860038" strokeWidth="0.7" />
      <line x1="20" y1="17" x2="31" y2="16" stroke="#860038" strokeWidth="0.7" />
    </svg>
  );
}
