import styles from './LoadingState.module.css';

export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className={styles.wrapper} aria-busy="true" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
    </div>
  );
}
