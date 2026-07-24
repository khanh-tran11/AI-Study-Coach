// Hartnell College wordmark + black panther icon — SVG, no external file needed
// Colors: black panther with gold eyes on dark bg, Hartnell brand magenta accents

export function HartnellLogo({ size = 40, dark = false }) {
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
      <rect width="40" height="40" rx="8" fill="#1a1a2e" />
      {/* Panther head - sleek black */}
      <ellipse cx="20" cy="18" rx="11" ry="10" fill="#2d2d44" />
      {/* Ears - pointed */}
      <polygon points="11,10 8,2 15,8" fill="#2d2d44" />
      <polygon points="29,10 32,2 25,8" fill="#2d2d44" />
      {/* Inner ears */}
      <polygon points="11.5,9 9.5,4 14,8" fill="#860038" opacity="0.7"/>
      <polygon points="28.5,9 30.5,4 26,8" fill="#860038" opacity="0.7"/>
      {/* Face shape - darker muzzle */}
      <ellipse cx="20" cy="21" rx="5" ry="4" fill="#1a1a2e" />
      {/* Eyes - fierce gold */}
      <ellipse cx="15.5" cy="16" rx="2.5" ry="1.8" fill="#fdb913" />
      <ellipse cx="24.5" cy="16" rx="2.5" ry="1.8" fill="#fdb913" />
      {/* Pupils - vertical slits */}
      <ellipse cx="15.5" cy="16" rx="0.8" ry="1.6" fill="#1a1a2e" />
      <ellipse cx="24.5" cy="16" rx="0.8" ry="1.6" fill="#1a1a2e" />
      {/* Eye shine */}
      <circle cx="16.2" cy="15.3" r="0.5" fill="#fff" opacity="0.8" />
      <circle cx="25.2" cy="15.3" r="0.5" fill="#fff" opacity="0.8" />
      {/* Nose */}
      <ellipse cx="20" cy="20" rx="1.8" ry="1.2" fill="#111" />
      {/* Nose highlight */}
      <ellipse cx="20" cy="19.6" rx="0.8" ry="0.4" fill="#333" opacity="0.5" />
      {/* Mouth lines */}
      <path d="M18.5 22 Q20 23.5 21.5 22" stroke="#444" strokeWidth="0.5" fill="none" />
      {/* Jaw/chin */}
      <ellipse cx="20" cy="26" rx="6" ry="4" fill="#2d2d44" />
      {/* Neck/chest hint */}
      <ellipse cx="20" cy="34" rx="8" ry="5" fill="#2d2d44" />
      {/* Chest highlight */}
      <ellipse cx="20" cy="33" rx="4" ry="3" fill="#1a1a2e" opacity="0.5" />

      {/* HARTNELL text */}
      <text x="48" y="17" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="13" fill={dark ? '#ffffff' : '#1a1a2e'} letterSpacing="1">
        HARTNELL
      </text>
      {/* COLLEGE text */}
      <text x="48" y="30" fontFamily="Inter, sans-serif" fontWeight="600" fontSize="10" fill="#860038" letterSpacing="2">
        COLLEGE
      </text>
      {/* Accent dots */}
      <circle cx="48" cy="36" r="1.5" fill="#1a1a2e" />
      <circle cx="53" cy="36" r="1.5" fill="#fdb913" />
    </svg>
  );
}

// Compact black panther avatar for chat and tight spaces
export function PantherMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Panther AI" role="img">
      {/* Background circle - gives avatar feel */}
      <circle cx="20" cy="20" r="20" fill="#1a1a2e" />
      {/* Subtle ring glow */}
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="#860038" strokeWidth="1" opacity="0.4" />
      {/* Panther head */}
      <ellipse cx="20" cy="19" rx="11" ry="10" fill="#2d2d44" />
      {/* Ears */}
      <polygon points="11,11 8,3 15,9" fill="#2d2d44" />
      <polygon points="29,11 32,3 25,9" fill="#2d2d44" />
      {/* Inner ears - magenta accent */}
      <polygon points="11.5,10 9.5,5 14,9" fill="#860038" opacity="0.6"/>
      <polygon points="28.5,10 30.5,5 26,9" fill="#860038" opacity="0.6"/>
      {/* Face contour */}
      <ellipse cx="20" cy="22" rx="5" ry="4" fill="#1a1a2e" />
      {/* Eyes - gold with vertical pupils */}
      <ellipse cx="15.5" cy="17" rx="2.8" ry="2" fill="#fdb913" />
      <ellipse cx="24.5" cy="17" rx="2.8" ry="2" fill="#fdb913" />
      {/* Vertical slit pupils */}
      <ellipse cx="15.5" cy="17" rx="0.9" ry="1.7" fill="#1a1a2e" />
      <ellipse cx="24.5" cy="17" rx="0.9" ry="1.7" fill="#1a1a2e" />
      {/* Eye shine */}
      <circle cx="16.3" cy="16.2" r="0.6" fill="#fff" opacity="0.85" />
      <circle cx="25.3" cy="16.2" r="0.6" fill="#fff" opacity="0.85" />
      {/* Nose */}
      <ellipse cx="20" cy="21.5" rx="2" ry="1.3" fill="#111" />
      <ellipse cx="20" cy="21" rx="0.8" ry="0.4" fill="#333" opacity="0.5" />
      {/* Mouth */}
      <path d="M18.2 23.5 Q20 25 21.8 23.5" stroke="#444" strokeWidth="0.6" fill="none" />
      {/* Chin/jaw */}
      <ellipse cx="20" cy="27" rx="6" ry="4" fill="#2d2d44" />
      {/* Subtle chest */}
      <ellipse cx="20" cy="34" rx="9" ry="5" fill="#2d2d44" />
    </svg>
  );
}

// Animated panther avatar for chat header — adds a subtle breathing pulse
export function PantherAvatar({ size = 48 }) {
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Panther AI Assistant" role="img">
        {/* Outer glow ring */}
        <circle cx="24" cy="24" r="23" fill="none" stroke="#fdb913" strokeWidth="1.5" opacity="0.3">
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Background */}
        <circle cx="24" cy="24" r="21" fill="#1a1a2e" />
        {/* Inner accent ring */}
        <circle cx="24" cy="24" r="19.5" fill="none" stroke="#860038" strokeWidth="0.8" opacity="0.5" />
        {/* Panther head */}
        <ellipse cx="24" cy="22" rx="12" ry="11" fill="#2d2d44" />
        {/* Ears */}
        <polygon points="14,13 10,4 18,11" fill="#2d2d44" />
        <polygon points="34,13 38,4 30,11" fill="#2d2d44" />
        {/* Inner ears */}
        <polygon points="14.5,12 11.5,6 17,11" fill="#860038" opacity="0.6"/>
        <polygon points="33.5,12 36.5,6 31,11" fill="#860038" opacity="0.6"/>
        {/* Face */}
        <ellipse cx="24" cy="25" rx="5.5" ry="4.5" fill="#1a1a2e" />
        {/* Eyes */}
        <ellipse cx="19" cy="20" rx="3" ry="2.2" fill="#fdb913">
          <animate attributeName="ry" values="2.2;2.2;0.3;2.2;2.2" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="29" cy="20" rx="3" ry="2.2" fill="#fdb913">
          <animate attributeName="ry" values="2.2;2.2;0.3;2.2;2.2" dur="4s" repeatCount="indefinite" />
        </ellipse>
        {/* Pupils */}
        <ellipse cx="19" cy="20" rx="1" ry="1.8" fill="#1a1a2e">
          <animate attributeName="ry" values="1.8;1.8;0.2;1.8;1.8" dur="4s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="29" cy="20" rx="1" ry="1.8" fill="#1a1a2e">
          <animate attributeName="ry" values="1.8;1.8;0.2;1.8;1.8" dur="4s" repeatCount="indefinite" />
        </ellipse>
        {/* Eye shine */}
        <circle cx="20" cy="19" r="0.7" fill="#fff" opacity="0.85" />
        <circle cx="30" cy="19" r="0.7" fill="#fff" opacity="0.85" />
        {/* Nose */}
        <ellipse cx="24" cy="24.5" rx="2.2" ry="1.5" fill="#111" />
        <ellipse cx="24" cy="24" rx="0.9" ry="0.4" fill="#333" opacity="0.5" />
        {/* Smile */}
        <path d="M21.5 27 Q24 29 26.5 27" stroke="#555" strokeWidth="0.7" fill="none" />
        {/* Jaw */}
        <ellipse cx="24" cy="31" rx="7" ry="4.5" fill="#2d2d44" />
        {/* Chest */}
        <ellipse cx="24" cy="39" rx="10" ry="6" fill="#2d2d44" />
      </svg>
      {/* Status dot - online */}
      <span style={{
        position: 'absolute', bottom: 2, right: 2,
        width: size * 0.22, height: size * 0.22,
        borderRadius: '50%', background: '#22c55e',
        border: '2px solid #1a1a2e',
      }} />
    </div>
  );
}
