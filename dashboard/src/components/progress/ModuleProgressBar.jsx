import { useProgress } from '../../context/ProgressContext';
import styles from './ModuleProgressBar.module.css';

export default function ModuleProgressBar() {
  const { moduleName, currentStep, totalSteps, advanceStep } = useProgress();

  const percent = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;
  const ariaLabel = `Module progress: Step ${currentStep} of ${totalSteps}`;
  const isComplete = currentStep >= totalSteps;

  return (
    <section className={styles.card} aria-label="Module progress">
      {/* Module name */}
      <h2 className={styles.moduleName}>{moduleName}</h2>

      {/* Step counter + Next Step button */}
      <div className={styles.stepRow}>
        <span className={styles.stepCounter}>
          Step {currentStep} of {totalSteps}
        </span>
        <button
          type="button"
          className={styles.nextBtn}
          onClick={advanceStep}
          disabled={isComplete}
          aria-label={isComplete ? 'All steps completed' : 'Advance to next step'}
        >
          {isComplete ? 'Completed' : 'Next Step'}
        </button>
      </div>

      {/* Visually-hidden native <progress> for screen reader semantics */}
      <progress
        className={styles.nativeProgress}
        value={currentStep}
        max={totalSteps}
        aria-valuenow={currentStep}
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-label={ariaLabel}
      />

      {/* Styled progress bar (div role="progressbar") */}
      <div className={styles.track}>
        <div
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={0}
          aria-valuemax={totalSteps}
          aria-label={ariaLabel}
          className={styles.fill}
          style={{ width: `${percent}%` }}
        />
      </div>
    </section>
  );
}
