import { Link } from 'react-router-dom';
import styles from './ErrorState.module.css';

function ErrorState({
  title = 'Erro',
  message = 'Ocorreu um erro inesperado.',
  linkTo = '/',
  linkText = 'Voltar ao Inicio',
  variant = 'card' // 'card' | 'inline'
}) {
  if (variant === 'inline') {
    return (
      <div className={styles.inline} role="alert">
        <p className={styles.inlineMessage}>{message}</p>
        {linkTo && (
          <Link to={linkTo} className={styles.inlineLink}>{linkText}</Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.card} role="alert">
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {linkTo && (
        <Link to={linkTo} className={styles.link}>{linkText}</Link>
      )}
    </div>
  );
}

export default ErrorState;
