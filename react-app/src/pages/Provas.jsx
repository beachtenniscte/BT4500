import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import TopNavBar from '../components/TopNavBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { TrophyIcon, CalendarIcon, EmptyCalendarIcon } from '../components/icons';
import { TIER_CLASSES } from '../utils';
import styles from './Provas.module.css';

function Provas() {
  const navigate = useNavigate();
  const [allProvas, setAllProvas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);

  useEffect(() => {
    loadAllProvas();
  }, []);

  const loadAllProvas = async () => {
    setLoading(true);
    setError(null);
    try {
      const years = await apiService.getAvailableYears();
      setAvailableYears(years);

      // Load provas for all years with year info attached
      const allProvasData = [];
      for (const year of years) {
        const data = await apiService.getProvas(year);
        // Attach year to each prova
        const provasWithYear = data.map(p => ({ ...p, year }));
        allProvasData.push(...provasWithYear);
      }
      setAllProvas(allProvasData);
    } catch (err) {
      console.error('Error fetching provas:', err);
      setError('Erro ao carregar provas');
      setAllProvas([]);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeClass = (type) => {
    const tierKey = type?.toUpperCase();
    const className = TIER_CLASSES[tierKey];
    return className ? styles[className.replace('tier', '').toLowerCase()] : '';
  };

  const handleProvaClick = (prova) => {
    if (prova.uuid) {
      navigate(`/tournament/${prova.uuid}`);
    }
  };

  // Group provas by year
  const getProvasByYear = () => {
    const grouped = {};
    for (const prova of allProvas) {
      const year = prova.year || new Date().getFullYear();

      if (!grouped[year]) {
        grouped[year] = { completed: [], upcoming: [] };
      }

      if (prova.status === 'completed') {
        grouped[year].completed.push(prova);
      } else {
        grouped[year].upcoming.push(prova);
      }
    }
    return grouped;
  };

  const provasByYear = getProvasByYear();
  const sortedYears = Object.keys(provasByYear).sort((a, b) => b - a);

  const renderProvaCard = (prova, isCompleted) => (
    <button
      key={prova.id}
      className={`${styles.provaCard} ${isCompleted ? styles.provaCardCompleted : styles.provaCardUpcoming}`}
      onClick={() => handleProvaClick(prova)}
      aria-label={`${prova.name || prova.type} - ${isCompleted ? 'Ver resultados' : prova.status === 'in_progress' ? 'A Decorrer' : 'Brevemente'}`}
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
          <CalendarIcon size={14} className={styles.icon} />
          {prova.dates}
        </span>
      </div>
      <div className={styles.provaAction}>
        {isCompleted ? (
          <span className={styles.resultsLabel}>Ver resultados →</span>
        ) : (
          <span className={styles.upcomingLabel}>
            {prova.status === 'in_progress' ? 'A Decorrer' : 'Brevemente'}
          </span>
        )}
      </div>
    </button>
  );

  return (
    <div className={styles.container}>
      <TopNavBar title="PROVAS" showBack={true} backTo="/" />

      <div className={styles.content}>
        {loading ? (
          <LoadingSpinner message="A carregar provas..." />
        ) : error ? (
          <div className={styles.errorState} role="alert">
            <span>{error}</span>
            <button onClick={loadAllProvas} className={styles.retryButton}>
              Tentar novamente
            </button>
          </div>
        ) : sortedYears.length === 0 ? (
          <div className={styles.emptyState}>
            <EmptyCalendarIcon size={64} className={styles.emptyIcon} />
            <h3>Sem provas agendadas</h3>
            <p>Nao existem provas registadas</p>
          </div>
        ) : (
          <div className={styles.yearsList}>
            {sortedYears.map((year) => {
              const { completed, upcoming } = provasByYear[year];
              const hasCompleted = completed.length > 0;
              const hasUpcoming = upcoming.length > 0;

              return (
                <section key={year} className={styles.yearSection} aria-labelledby={`year-${year}`}>
                  <div className={styles.yearHeader}>
                    <h2 id={`year-${year}`} className={styles.yearTitle}>{year}</h2>
                    <span className={styles.yearCount}>
                      {completed.length + upcoming.length} prova{completed.length + upcoming.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {hasCompleted && (
                    <div className={styles.statusSection}>
                      <div className={styles.sectionHeader}>
                        <TrophyIcon size={20} className={styles.icon} />
                        <h3>Concluidos</h3>
                        <span className={styles.sectionCount}>{completed.length}</span>
                      </div>
                      <div className={styles.provasList}>
                        {completed.map((prova) => renderProvaCard(prova, true))}
                      </div>
                    </div>
                  )}

                  {hasUpcoming && (
                    <div className={styles.statusSection}>
                      <div className={styles.sectionHeaderUpcoming}>
                        <CalendarIcon size={20} className={styles.icon} />
                        <h3>Proximos</h3>
                        <span className={styles.sectionCount}>{upcoming.length}</span>
                      </div>
                      <div className={styles.provasList}>
                        {upcoming.map((prova) => renderProvaCard(prova, false))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Provas;
