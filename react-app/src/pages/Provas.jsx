import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import apiService from '../services/api';
import styles from './PageLayout.module.css';

function Provas() {
  const [provas, setProvas] = useState([
    { id: 1, type: 'PRATA', dates: '10-11 MAI' },
    { id: 2, type: 'BRONZE', dates: '21-22 JUN' },
    { id: 3, type: 'PRATA', dates: '26-27 JUL' },
    { id: 4, type: 'OURO', dates: '15-17 AGO' },
    { id: 5, type: 'PRATA', dates: '20-21 SET' },
    { id: 6, type: 'BRONZE', dates: '18-19 OUT' }
  ]);

  useEffect(() => {
    // Fetch provas data from API when available
    apiService.getProvas()
      .then(data => {
        if (data && data.length > 0) setProvas(data);
      })
      .catch(err => console.error('Error fetching provas:', err));
  }, []);

  const handleProvaClick = (prova) => {
    // Handle prova click - could navigate to detail page or open modal
    console.log('Prova clicked:', prova);
  };

  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>PROVAS 2025</h1>

        <div className={styles.provasList}>
          {provas.map((prova) => (
            <button
              key={prova.id}
              className={styles.provaButton}
              onClick={() => handleProvaClick(prova)}
            >
              {prova.type} {prova.dates}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Provas;
