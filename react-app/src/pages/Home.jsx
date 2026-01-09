import { Link } from 'react-router-dom';
import styles from './Home.module.css';

function Home() {
  return (
    <div className={styles.container}>
      <Link to="/profile" className={styles.profileButton}>
        <svg viewBox="0 0 24 24" className={styles.profileIcon}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </Link>

      <div className={styles.logo}>
        <img
          src="/images/liga-logo.png"
          alt="Liga BT4500"
          className={styles.ligaLogo}
          onError={(e) => {
            // Fallback to text if image doesn't load
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = '<div class="' + styles.logoText + '">LIGA<span class="' + styles.logoNumber + '">4500</span></div>';
          }}
        />
      </div>

      <nav className={styles.navButtons}>
        <Link to="/info" className={styles.navButton}>INFO</Link>
        <Link to="/provas" className={styles.navButton}>PROVAS</Link>
        <Link to="/classificacao" className={styles.navButton}>CLASSIFICAÇÃO</Link>
      </nav>

      <div className={styles.clubLogo}>
        <a
          href="https://www.instagram.com/btespinho/#"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/images/club-logo.png"
            alt="Clube Ténis Espinho"
            onError={(e) => e.target.style.display = 'none'}
          />
        </a>
      </div>
    </div>
  );
}

export default Home;
