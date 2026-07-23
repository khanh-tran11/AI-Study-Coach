/**
 * PantherAvatar — Pink Panther-inspired style, dark navy colors.
 * Wide pear-shaped head, large oval eyes, round side ears,
 * broad two-tone muzzle, thick block brows, dramatic whiskers, smirk.
 */
import styles from './PantherAvatar.module.css';

export default function PantherAvatar({ size = 150, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 220"
      style={{ height: `${size}px`, width: 'auto' }}
      className={`${styles.avatar} ${className}`}
      role="presentation"
    >
      <g className={styles.bodyGroup}>
        <g className={styles.headGroup}>

          {/* Head — wide pear/diamond shape */}
          <path d="M140 12 Q180 12 210 35 Q240 58 245 95 Q248 125 235 148 Q218 175 185 188 Q160 196 140 198 Q120 196 95 188 Q62 175 45 148 Q32 125 35 95 Q40 58 70 35 Q100 12 140 12 Z" fill="#2d2d45"/>

          {/* Left ear — round, on the side */}
          <g className={styles.leftEar}>
            <ellipse cx="32" cy="72" rx="18" ry="17" fill="#2d2d45"/>
            <ellipse cx="32" cy="72" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/>
            <circle cx="36" cy="66" r="2.5" fill="#5a5080" opacity="0.5"/>
          </g>

          {/* Right ear — round, on the side */}
          <g className={styles.rightEar}>
            <ellipse cx="248" cy="65" rx="18" ry="17" fill="#2d2d45"/>
            <ellipse cx="248" cy="65" rx="11" ry="10" fill="#4a3f6b" opacity="0.6"/>
            <circle cx="252" cy="59" r="2.5" fill="#5a5080" opacity="0.5"/>
          </g>

          {/* Eyes — large, overlapping at center */}
          <g className={styles.eyeGroup}>
            {/* Left eye */}
            <g>
              <ellipse cx="112" cy="78" rx="30" ry="28" fill="#dbeafe"/>
              <ellipse cx="112" cy="80" rx="22" ry="22" fill="#60a5fa"/>
              <circle cx="112" cy="82" r="11" fill="#0a0f1f"/>
              <circle cx="120" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/>
              <circle cx="106" cy="88" r="2.5" fill="#ffffff" opacity="0.35"/>
              <ellipse cx="112" cy="78" rx="31" ry="29" fill="#2d2d45"
                className={styles.eyelid} style={{ transformOrigin: '112px 78px' }}/>
            </g>
            {/* Right eye */}
            <g>
              <ellipse cx="168" cy="78" rx="30" ry="28" fill="#dbeafe"/>
              <ellipse cx="168" cy="80" rx="22" ry="22" fill="#60a5fa"/>
              <circle cx="168" cy="82" r="11" fill="#0a0f1f"/>
              <circle cx="176" cy="72" r="5.5" fill="#ffffff" opacity="0.92"/>
              <circle cx="162" cy="88" r="2.5" fill="#ffffff" opacity="0.35"/>
              <ellipse cx="168" cy="78" rx="31" ry="29" fill="#2d2d45"
                className={styles.eyelid} style={{ transformOrigin: '168px 78px' }}/>
            </g>
          </g>

          {/* Eye bridge */}
          <path d="M130 85 Q140 80 150 85" fill="none" stroke="#2d2d45" strokeWidth="4" strokeLinecap="round"/>

          {/* Eyebrows — thick blocks */}
          <rect x="88" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(-8, 102, 47)"/>
          <rect x="162" y="42" width="28" height="10" rx="2" fill="#1a1a2e" transform="rotate(8, 176, 47)"/>

          {/* Outer muzzle */}
          <path d="M75 125 Q80 108 105 102 Q125 97 140 96 Q155 97 175 102 Q200 108 205 125 Q210 145 200 162 Q185 180 140 182 Q95 180 80 162 Q70 145 75 125 Z" fill="#3a3a55"/>

          {/* Inner muzzle — lighter */}
          <path d="M100 122 Q110 112 140 110 Q170 112 180 122 Q185 138 180 152 Q170 165 140 167 Q110 165 100 152 Q95 138 100 122 Z" fill="#4a4a65"/>

          {/* Nose */}
          <path d="M130 125 L140 116 L150 125 Q145 131 140 133 Q135 131 130 125 Z" fill="#1a1a2e"/>

          {/* Nose to mouth */}
          <path d="M140 133 L140 142" fill="none" stroke="#1a1a2e" strokeWidth="2.2" strokeLinecap="round"/>

          {/* Mouth */}
          <path d="M112 150 Q125 158 140 158 Q155 158 168 150" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M112 150 Q107 146 104 140" fill="none" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
          <path d="M168 150 Q172 147 174 143" fill="none" stroke="#1a1a2e" strokeWidth="1.8" strokeLinecap="round"/>

          {/* Left whiskers */}
          <path d="M78 135 Q50 126 8 130" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/>
          <path d="M76 148 Q44 144 5 152" fill="none" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round"/>
          <path d="M80 160 Q50 164 12 172" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round"/>

          {/* Right whiskers */}
          <path d="M202 135 Q230 126 272 130" fill="none" stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round"/>
          <path d="M204 148 Q236 144 275 152" fill="none" stroke="#1a1a2e" strokeWidth="2.8" strokeLinecap="round"/>
          <path d="M200 160 Q230 164 268 172" fill="none" stroke="#1a1a2e" strokeWidth="2.5" strokeLinecap="round"/>

          {/* Cheek contours */}
          <path d="M52 100 Q48 112 50 122" fill="none" stroke="#3a3a55" strokeWidth="1.5" opacity="0.35"/>
          <path d="M228 100 Q232 112 230 122" fill="none" stroke="#3a3a55" strokeWidth="1.5" opacity="0.35"/>

        </g>
      </g>
    </svg>
  );
}
