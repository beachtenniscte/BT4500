import styles from './LoadingSpinner.module.css';

function LoadingSpinner({ message = 'A carregar...', size = 'medium' }) {
  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={`${styles.spinner} ${styles[size]}`}></div>
      {message && <span className={styles.message}>{message}</span>}
    </div>
  );
}

export default LoadingSpinner;
