import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import apiService from '../services/api';
import styles from './PageLayout.module.css';

function Provas() {
  const [provas, setProvas] = useState([
    { id: 1, type: 'PRATA', dates: '10-11 MAI', status: 'upcoming' },
    { id: 2, type: 'BRONZE', dates: '21-22 JUN', status: 'upcoming' },
    { id: 3, type: 'PRATA', dates: '26-27 JUL', status: 'upcoming' },
    { id: 4, type: 'OURO', dates: '15-17 AGO', status: 'upcoming' },
    { id: 5, type: 'PRATA', dates: '20-21 SET', status: 'upcoming' },
    { id: 6, type: 'BRONZE', dates: '18-19 OUT', status: 'upcoming' }
  ]);

  useEffect(() => {
    apiService.getProvas()
      .then(data => {
        if (data && data.length > 0) setProvas(data);
      })
      .catch(err => console.error('Error fetching provas:', err));
  }, []);

  const getBadgeClass = (type) => {
    switch (type.toUpperCase()) {
      case 'OURO':
        return styles.gold;
      case 'PRATA':
        return styles.silver;
      case 'BRONZE':
        return styles.bronze;
      default:
        return '';
    }
  };

  const handleProvaClick = (prova) => {
    console.log('Prova clicked:', prova);
  };

  return (
    <div className={styles.container}>
      <Link to="/profile" className={styles.profileButton}>
        <svg viewBox="0 0 24 24" className={styles.profileIcon}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </Link>

      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>PROVAS 2025</h1>

        <div className={styles.mainCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <h2 className={styles.cardTitle}>Calendário de Provas</h2>
          </div>

          <div className={styles.cardContent}>
            <div className={styles.provasList}>
              {provas.map((prova) => (
                <div
                  key={prova.id}
                  className={styles.provaCard}
                  onClick={() => handleProvaClick(prova)}
                >
                  <div className={styles.provaInfo}>
                    <span className={styles.provaType}>{prova.type}</span>
                    <span className={styles.provaDates}>{prova.dates}</span>
                  </div>
                  <span className={`${styles.provaBadge} ${getBadgeClass(prova.type)}`}>
                    {prova.status === 'upcoming' ? 'Próxima' : prova.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Provas;
