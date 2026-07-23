import { useEffect, useRef } from 'react';
import styles from './LearnerDetailDrawer.module.css';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function LearnerDetailDrawer({ learner, onClose }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Open the dialog as modal
    dialog.showModal();

    // Focus the close button
    if (closeBtnRef.current) {
      closeBtnRef.current.focus();
    }

    // Handle click on backdrop (outside dialog content)
    function handleBackdropClick(event) {
      if (event.target === dialog) {
        onClose();
      }
    }

    // Handle native close event (Escape key)
    function handleClose() {
      onClose();
    }

    dialog.addEventListener('click', handleBackdropClick);
    dialog.addEventListener('close', handleClose);

    return () => {
      dialog.removeEventListener('click', handleBackdropClick);
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-label={`Learner detail: ${learner.name}`}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 className={styles.name}>{learner.name}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 5L5 15M5 5l10 10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="sr-only">Close</span>
          </button>
        </header>

        {learner.modules && learner.modules.length > 0 ? (
          <ul className={styles.moduleList}>
            {learner.modules.map((mod) => {
              const pct =
                mod.totalSteps > 0
                  ? Math.round((mod.stepsCompleted / mod.totalSteps) * 100)
                  : 0;

              return (
                <li key={mod.moduleId} className={styles.moduleItem}>
                  <div className={styles.moduleHeader}>
                    <span className={styles.moduleName}>{mod.moduleName}</span>
                    <span className={styles.moduleStats}>
                      {mod.stepsCompleted}/{mod.totalSteps} steps
                    </span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={mod.stepsCompleted}
                      aria-valuemin={0}
                      aria-valuemax={mod.totalSteps}
                      aria-label={`${mod.moduleName} progress: ${mod.stepsCompleted} of ${mod.totalSteps} steps`}
                    />
                  </div>
                  <span className={styles.moduleTime}>
                    {formatTime(mod.timeSpentSeconds)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className={styles.empty}>No module data available.</p>
        )}
      </div>
    </dialog>
  );
}
