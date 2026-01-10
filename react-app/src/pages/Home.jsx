import { Link } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import styles from './Home.module.css';

function Home() {
  return (
    <div className={styles.container}>
      <TopNavBar title="" showBack={false} variant="home" />

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
