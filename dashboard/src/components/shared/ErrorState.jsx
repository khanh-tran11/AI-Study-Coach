import styles from './ErrorState.module.css';

export default function ErrorState({ message = 'Something went wrong. Please try again.' }) {
  return (
    <div className={styles.wrapper} role="alert">
      <p className={styles.message}>{message}</p>
    </div>
  );
}
