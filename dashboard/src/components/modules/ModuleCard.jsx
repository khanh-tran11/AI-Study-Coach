import styles from './ModuleCard.module.css';

// Map status values to human-readable labels
const STATUS_LABELS = {
  'not-started': 'Not Started',
  'in-progress': 'In Progress',
  'completed': 'Completed',
};

// Map status values to CSS module class names
const STATUS_CLASS = {
  'not-started': styles.badgeNotStarted,
  'in-progress': styles.badgeInProgress,
  'completed': styles.badgeCompleted,
};

// CTA button text per status
const CTA_LABEL = {
  'not-started': 'Start',
  'in-progress': 'Continue',
  'completed': 'Review',
};

// Lock icon SVG (inline, aria-hidden — text label carries the meaning)
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ModuleCard({ id, title, description, status, locked }) {
  const statusLabel = STATUS_LABELS[status] ?? 'Unknown';
  const badgeClass = STATUS_CLASS[status] ?? '';
  const ctaLabel = CTA_LABEL[status] ?? 'Start';

  return (
    <article
      className={`${styles.card} ${locked ? styles.cardLocked : ''}`}
      aria-label={`${title}${locked ? ', locked' : ''}`}
    >
      {/* Status badge */}
      <span className={`${styles.badge} ${badgeClass}`} aria-label={`Status: ${statusLabel}`}>
        {statusLabel}
      </span>

      {/* Title */}
      <h3 className={styles.title}>{title}</h3>

      {/* Description */}
      <p className={styles.description}>{description}</p>

      {/* CTA or Locked indicator */}
      {locked ? (
        <div
          className={styles.lockedIndicator}
          role="button"
          tabIndex={0}
          aria-disabled="true"
          aria-label="Locked — complete previous modules to unlock"
          title="Complete previous modules to unlock"
        >
          <LockIcon />
          <span>Locked</span>
        </div>
      ) : (
        <button
          type="button"
          className={styles.ctaButton}
          aria-label={`${ctaLabel} ${title}`}
        >
          {ctaLabel}
        </button>
      )}
    </article>
  );
}
