import { Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './TournamentDetail.module.css';

// Default avatar SVG for players without photos
const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="48" fill="%23e0e0e0"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23bdbdbd"/%3E%3Cellipse cx="50" cy="85" rx="28" ry="22" fill="%23bdbdbd"/%3E%3C/svg%3E';

function TournamentDetail() {
  const { uuid } = useParams();
  const [tournament, setTournament] = useState(null);
  const [categories, setCategories] = useState([]);
  const [winners, setWinners] = useState([]);
  const [matchesByRound, setMatchesByRound] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTournamentData();
  }, [uuid]);

  useEffect(() => {
    if (selectedCategory && tournament?.status === 'completed') {
      loadMatchesByCategory(selectedCategory);
    }
  }, [selectedCategory, tournament?.status]);

  const loadTournamentData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get tournament info and categories
      const data = await apiService.getTournament(uuid);
      if (!data) {
        setError('Torneio nao encontrado');
        return;
      }

      setTournament(data.tournament);
      setCategories(data.categories || []);

      // Load winners if tournament is completed
      if (data.tournament.status === 'completed') {
        const winnersData = await apiService.getTournamentWinners(uuid);
        setWinners(winnersData || []);

        // Set default category if available
        if (data.categories && data.categories.length > 0) {
          setSelectedCategory(data.categories[0].code);
        }
      }
    } catch (err) {
      console.error('Error loading tournament:', err);
      setError('Erro ao carregar torneio');
    } finally {
      setLoading(false);
    }
  };

  const loadMatchesByCategory = async (categoryCode) => {
    try {
      const data = await apiService.getTournamentMatchesByRound(uuid, categoryCode);
      setMatchesByRound(data || []);
    } catch (err) {
      console.error('Error loading matches:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getTierClass = (tier) => {
    const tierMap = {
      'OURO': styles.tierOuro,
      'PRATA': styles.tierPrata,
      'BRONZE': styles.tierBronze
    };
    return tierMap[tier?.toUpperCase()] || '';
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <div className={styles.loading}>A carregar...</div>
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <h1 className={styles.pageTitle}>ERRO</h1>
          <div className={styles.errorCard}>
            <p>{error || 'Torneio nao encontrado'}</p>
            <Link to="/provas" className={styles.homeLink}>Voltar a Provas</Link>
          </div>
        </div>
      </div>
    );
  }

  // Upcoming tournament view
  if (tournament.status === 'scheduled') {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>

          <h1 className={styles.pageTitle}>{tournament.name}</h1>

          <div className={styles.mainCard}>
            <div className={styles.upcomingSection}>
              {/* Info Card */}
              <div className={styles.infoCard}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Data</span>
                  <span className={styles.infoValue}>
                    {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Local</span>
                  <span className={styles.infoValue}>{tournament.location}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Tier</span>
                  <span className={`${styles.tierBadge} ${getTierClass(tournament.tier)}`}>
                    {tournament.tier}
                  </span>
                </div>
                {categories.length > 0 && (
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Categorias</span>
                    <span className={styles.infoValue}>
                      {categories.map(c => c.code).join(', ')}
                    </span>
                  </div>
                )}
              </div>

              {/* Registration Buttons (Placeholders) */}
              <div className={styles.registrationButtons}>
                <h4>Inscricoes</h4>
                <button className={styles.registerBtn} disabled>
                  Registo Nivel 1
                </button>
                <button className={styles.registerBtn} disabled>
                  Registo Nivel 2
                </button>
                <button className={styles.registerBtn} disabled>
                  Registo Nivel 3
                </button>
                <p className={styles.comingSoon}>Em breve...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed/In Progress tournament view
  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/provas" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>{tournament.name}</h1>

        <div className={styles.mainCard}>
          {/* Winners Section - Horizontal Scroll */}
          {winners.length > 0 && (
            <div className={styles.winnersSection}>
              <h3 className={styles.winnersSectionTitle}>Vencedores</h3>
              <div className={styles.winnersScroll}>
                {winners.map((w, idx) => (
                  <div key={`${w.category_code}-${idx}`} className={styles.winnerCard}>
                    <div className={styles.winnerPhotos}>
                      <img
                        src={w.player1_photo || defaultAvatar}
                        alt={w.player1_name}
                        onError={(e) => { e.target.src = defaultAvatar; }}
                      />
                      <img
                        src={w.player2_photo || defaultAvatar}
                        alt={w.player2_name}
                        onError={(e) => { e.target.src = defaultAvatar; }}
                      />
                    </div>
                    <span className={styles.winnerNames}>
                      {w.player1_name?.split(' ')[0]} / {w.player2_name?.split(' ')[0]}
                    </span>
                    <span className={styles.winnerCategory}>{w.category_code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter */}
          {categories.length > 0 && (
            <div className={styles.categoryFilter}>
              {categories.map(cat => (
                <button
                  key={cat.code}
                  className={`${styles.categoryBtn} ${selectedCategory === cat.code ? styles.categoryBtnActive : ''}`}
                  onClick={() => setSelectedCategory(cat.code)}
                >
                  {cat.code}
                </button>
              ))}
            </div>
          )}

          {/* Results by Round */}
          {matchesByRound.length > 0 && (
            <div className={styles.resultsSection}>
              {matchesByRound.map(roundGroup => (
                <div key={roundGroup.round} className={styles.roundGroup}>
                  <h4 className={styles.roundTitle}>{roundGroup.round}</h4>
                  <div className={styles.matchesList}>
                    {roundGroup.matches.map(match => (
                      <div key={match.id} className={styles.matchCard}>
                        <span className={`${styles.teamName} ${styles.team1} ${match.winner_team_id === match.team1_id ? styles.winner : ''}`}>
                          {match.team1_name || 'TBD'}
                        </span>
                        <span className={styles.score}>
                          {match.result || 'vs'}
                        </span>
                        <span className={`${styles.teamName} ${styles.team2} ${match.winner_team_id === match.team2_id ? styles.winner : ''}`}>
                          {match.team2_name || 'TBD'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No matches message */}
          {matchesByRound.length === 0 && selectedCategory && (
            <div className={styles.noMatches}>
              <p>Nao ha resultados disponiveis para esta categoria.</p>
            </div>
          )}

          {/* Tournament Info Footer */}
          <div className={styles.tournamentInfo}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Data</span>
              <span className={styles.infoValue}>
                {formatDate(tournament.start_date)} - {formatDate(tournament.end_date)}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Local</span>
              <span className={styles.infoValue}>{tournament.location}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Tier</span>
              <span className={`${styles.tierBadge} ${getTierClass(tournament.tier)}`}>
                {tournament.tier}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TournamentDetail;
