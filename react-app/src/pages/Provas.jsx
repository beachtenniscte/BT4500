import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import TopNavBar from '../components/TopNavBar';
import styles from './Provas.module.css';

function Provas() {
  const navigate = useNavigate();
  const [provas, setProvas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    loadAvailableYears();
  }, []);

  useEffect(() => {
    loadProvas(selectedYear);
  }, [selectedYear]);

  const loadAvailableYears = async () => {
    const years = await apiService.getAvailableYears();
    setAvailableYears(years);
    // If current year has no tournaments, select the most recent year with data
    const currentYear = new Date().getFullYear();
    if (years.length > 0 && !years.includes(currentYear)) {
      setSelectedYear(years[0]);
    }
  };

  const loadProvas = async (year) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getProvas(year);
      setProvas(data);
    } catch (err) {
      console.error('Error fetching provas:', err);
      setError('Erro ao carregar provas');
      setProvas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const getBadgeClass = (type) => {
    switch (type?.toUpperCase()) {
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

  const getStatusLabel = (prova) => {
    if (prova.status === 'completed') return 'Concluído';
    if (prova.status === 'in_progress') return 'A Decorrer';
    return 'Próxima';
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'completed':
        return styles.statusCompleted;
      case 'in_progress':
        return styles.statusLive;
      default:
        return styles.statusUpcoming;
    }
  };

  const handleProvaClick = (prova) => {
    // Navigate to tournament details page
    if (prova.uuid) {
      navigate(`/tournament/${prova.uuid}`);
    }
  };

  return (
    <div className={styles.container}>
      <TopNavBar title={`PROVAS ${selectedYear}`} showBack={true} backTo="/" />

      <div className={styles.content}>
        {/* Year Filter - show if more than 1 year OR if current selection differs from available */}
        {availableYears.length > 0 && (availableYears.length > 1 || !availableYears.includes(selectedYear)) && (
          <div className={styles.yearFilter}>
            {availableYears.map((year) => (
              <button
                key={year}
                className={`${styles.yearButton} ${selectedYear === year ? styles.yearButtonActive : ''}`}
                onClick={() => handleYearChange(year)}
              >
                {year}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <span>A carregar provas...</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <span>{error}</span>
            <button onClick={() => loadProvas(selectedYear)} className={styles.retryButton}>
              Tentar novamente
            </button>
          </div>
        ) : provas.length === 0 ? (
          <div className={styles.emptyState}>
            <svg viewBox="0 0 24 24" className={styles.emptyIcon}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/>
              <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
              <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <h3>Sem provas agendadas</h3>
            <p>Não existem provas registadas para {selectedYear}</p>
          </div>
        ) : (
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
                      <div className={styles.provaMain}>
                        <span className={`${styles.tierBadge} ${getBadgeClass(prova.type)}`}>
                          {prova.type}
                        </span>
                        {prova.name && (
                          <span className={styles.provaName}>{prova.name}</span>
                        )}
                      </div>
                      <span className={styles.provaDates}>
                        <svg viewBox="0 0 24 24" className={styles.dateIcon}>
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth="2"/>
                          <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                          <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                          <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        {prova.dates}
                      </span>
                    </div>
                    <span className={`${styles.statusBadge} ${getStatusClass(prova.status)}`}>
                      {getStatusLabel(prova)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Provas;
