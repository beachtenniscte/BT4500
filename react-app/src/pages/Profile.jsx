import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import styles from './Profile.module.css';

function Profile() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [emailVerified, setEmailVerified] = useState(true);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const formatProfileData = useCallback((data, playerInfo) => {
    const tournaments = data.tournaments || [];
    const totalCompetitions = data.tournamentsPlayed || tournaments.length || 0;
    const titles = data.wins || tournaments.filter(t => t.position === 1).length || 0;
    const podiums = data.podiums || tournaments.filter(t => t.position <= 3).length || 0;
    const totalPoints = data.total_points || playerInfo?.totalPoints || 0;
    const matchesWon = data.matchesWon || 0;
    const matchesLost = data.matchesLost || 0;
    const totalMatches = matchesWon + matchesLost;

    // Calculate match win rate percentage
    const matchWinRate = totalMatches > 0 ? Math.round((matchesWon / totalMatches) * 100) : 0;
    // Calculate podium rate
    const podiumRate = totalCompetitions > 0 ? Math.round((podiums / totalCompetitions) * 100) : 0;
    // Calculate average points per tournament
    const avgPoints = totalCompetitions > 0 ? Math.round(totalPoints / totalCompetitions) : 0;

    // Sort competitions by date (most recent first)
    const sortedCompetitions = [...tournaments].sort((a, b) => {
      const dateA = a.date || a.year || 0;
      const dateB = b.date || b.year || 0;
      return dateB - dateA;
    });

    return {
      name: data.full_name || playerInfo?.name || 'Jogador',
      age: data.age || '-',
      category: 'BT 4500',
      city: data.city || 'Portugal',
      ranking: data.ranking || playerInfo?.ranking || '-',
      photo: data.photo || null,
      competitions: sortedCompetitions,
      // New: Ratio (points per unique tournament)
      ratio: data.ratio || '0',
      // New: Rankings by category gender
      rankings: data.rankings || {
        gender_rank: null,
        gender_points: 0,
        gender_label: data.gender === 'M' ? 'Masculino' : 'Feminino',
        mixed_rank: null,
        mixed_points: 0
      },
      stats: {
        totalCompetitions,
        titles,
        podiums,
        totalPoints,
        matchesWon,
        matchesLost,
        matchWinRate,
        podiumRate,
        avgPoints
      }
    };
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        const userData = await apiService.getCurrentUser();
        if (userData && userData.user) {
          setIsAuthenticated(true);
          setUser(userData.user);
          setEmailVerified(userData.user.emailVerified !== false);
          // Fetch profile data
          if (userData.player) {
            const profileData = await apiService.getProfile(userData.player.id);
            if (profileData) {
              setProfile(formatProfileData(profileData, userData.player));
            }
          }
        } else {
          // Not authenticated - redirect to login
          navigate('/login');
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        // Auth failed - redirect to login
        navigate('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [navigate, formatProfileData]);

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
    navigate('/login');
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setResendSuccess(false);
    try {
      await apiService.resendVerificationEmail();
      setResendSuccess(true);
    } catch (err) {
      console.error('Failed to resend verification email:', err);
    } finally {
      setResendingEmail(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>A carregar...</p>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

  // Default profile data if none loaded
  const displayProfile = profile || {
    name: user?.email || 'Jogador',
    age: '-',
    category: 'BT 4500',
    city: 'Portugal',
    ranking: '-',
    photo: null,
    competitions: [],
    ratio: '0',
    rankings: {
      gender_rank: null,
      gender_points: 0,
      gender_label: 'Masculino',
      mixed_rank: null,
      mixed_points: 0
    },
    stats: {
      totalCompetitions: 0,
      titles: 0,
      podiums: 0,
      totalPoints: 0,
      matchesWon: 0,
      matchesLost: 0,
      matchWinRate: 0,
      podiumRate: 0,
      avgPoints: 0
    }
  };

  // Helper function to get position class for podium styling
  const getPositionClass = (position) => {
    if (position === 1) return styles.positionGold;
    if (position === 2) return styles.positionSilver;
    if (position === 3) return styles.positionBronze;
    return '';
  };

  // Helper to get tier display info
  const getTierBadge = (tier) => {
    const tierMap = {
      'major': { label: 'Major', className: styles.tierMajor },
      'challenger': { label: 'Challenger', className: styles.tierChallenger },
      'regular': { label: 'Regular', className: styles.tierRegular },
      'open': { label: 'Open', className: styles.tierOpen }
    };
    return tierMap[tier?.toLowerCase()] || { label: tier || '', className: '' };
  };

  // Authenticated profile view
  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <div className={styles.headerRow}>
          <h1 className={styles.pageTitle}>PERFIL DO ATLETA</h1>
          <button onClick={handleLogout} className={styles.logoutButton}>
            Sair
          </button>
        </div>

        {/* Email Verification Banner */}
        {!emailVerified && (
          <div className={styles.verificationBanner}>
            <p>
              O seu e-mail ainda nao foi verificado.
              {resendSuccess ? (
                <span className={styles.resendSuccess}> E-mail enviado!</span>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendingEmail}
                  className={styles.resendButton}
                >
                  {resendingEmail ? 'A enviar...' : 'Reenviar e-mail'}
                </button>
              )}
            </p>
          </div>
        )}

        <div className={styles.profileCard}>
          {/* Profile Header with Photo */}
          <div className={styles.profileHeader}>
            <div className={styles.photoSection}>
              <div className={styles.photoFrame}>
                <img
                  src={displayProfile.photo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="48" fill="%23e0e0e0"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23bdbdbd"/%3E%3Cellipse cx="50" cy="85" rx="28" ry="22" fill="%23bdbdbd"/%3E%3C/svg%3E'}
                  alt={displayProfile.name}
                  className={styles.profilePhoto}
                  onError={(e) => {
                    // Prevent infinite loop by only setting fallback once
                    if (!e.target.dataset.fallback) {
                      e.target.dataset.fallback = 'true';
                      e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="48" fill="%23e0e0e0"/%3E%3Ccircle cx="50" cy="38" r="18" fill="%23bdbdbd"/%3E%3Cellipse cx="50" cy="85" rx="28" ry="22" fill="%23bdbdbd"/%3E%3C/svg%3E';
                    }
                  }}
                />
              </div>
            </div>

            <div className={styles.basicInfo}>
              <h2 className={styles.playerName}>{displayProfile.name}</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>IDADE</span>
                  <span className={styles.infoValue}>{displayProfile.age} {displayProfile.age !== '-' ? 'anos' : ''}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CATEGORIA</span>
                  <span className={styles.infoValue}>{displayProfile.category}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CIDADE</span>
                  <span className={styles.infoValue}>{displayProfile.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rankings Row - Gender and Mixed Rankings */}
          <div className={styles.rankingsRow}>
            <div className={styles.rankCard}>
              <span className={styles.rankLabel}>Ranking {displayProfile.rankings.gender_label}</span>
              <span className={styles.rankValue}>#{displayProfile.rankings.gender_rank || '-'}</span>
              <span className={styles.rankSubtext}>{displayProfile.rankings.gender_points || 0} pts</span>
            </div>
            <div className={styles.rankCard}>
              <span className={styles.rankLabel}>Ranking Mistos</span>
              <span className={styles.rankValue}>#{displayProfile.rankings.mixed_rank || '-'}</span>
              <span className={styles.rankSubtext}>{displayProfile.rankings.mixed_points || 0} pts</span>
            </div>
          </div>

          {/* Statistics Section */}
          <section className={styles.statsSection} aria-labelledby="stats-title">
            <h3 id="stats-title" className={styles.sectionTitle}>ESTATISTICAS DA TEMPORADA</h3>
            <div className={styles.statsGrid} role="list" aria-label="Estatisticas do jogador">
              <div className={styles.statCard} role="listitem">
                <span className={styles.statNumber} aria-label={`${displayProfile.stats.totalCompetitions} competicoes`}>
                  {displayProfile.stats.totalCompetitions}
                </span>
                <span className={styles.statLabel}>Torneios</span>
              </div>
              <div className={styles.statCard} role="listitem">
                <span className={styles.statNumber} aria-label={`${displayProfile.stats.matchesWon} jogos ganhos`}>
                  {displayProfile.stats.matchesWon}
                </span>
                <span className={styles.statLabel}>Jogos Ganhos</span>
                {(displayProfile.stats.matchesWon + displayProfile.stats.matchesLost) > 0 && (
                  <span className={styles.statSubtext}>{displayProfile.stats.matchWinRate}% taxa</span>
                )}
              </div>
              <div className={styles.statCard} role="listitem">
                <span className={styles.statNumber} aria-label={`${displayProfile.stats.podiums} podios`}>
                  {displayProfile.stats.podiums}
                </span>
                <span className={styles.statLabel}>Podios</span>
                {displayProfile.stats.totalCompetitions > 0 && (
                  <span className={styles.statSubtext}>{displayProfile.stats.podiumRate}% taxa</span>
                )}
              </div>
              <div className={`${styles.statCard} ${styles.statCardHighlight}`} role="listitem">
                <span className={styles.statNumber} aria-label={`${displayProfile.stats.totalPoints} pontos totais`}>
                  {displayProfile.stats.totalPoints}
                </span>
                <span className={styles.statLabel}>Pontos Totais</span>
                {displayProfile.stats.totalCompetitions > 0 && (
                  <span className={styles.statSubtext}>{displayProfile.stats.avgPoints} media/torneio</span>
                )}
              </div>
              <div className={styles.statCard} role="listitem">
                <span className={styles.statNumber} aria-label={`${displayProfile.ratio} racio`}>
                  {displayProfile.ratio}
                </span>
                <span className={styles.statLabel}>Racio</span>
                <span className={styles.statSubtext}>pts/torneio</span>
              </div>
            </div>
          </section>

          {/* Competition History */}
          <section className={styles.historySection} aria-labelledby="history-title">
            <h3 id="history-title" className={styles.sectionTitle}>HISTORICO DE TORNEIOS</h3>
            {displayProfile.competitions.length > 0 ? (
              <div className={styles.competitionsList} role="list" aria-label="Lista de torneios">
                {displayProfile.competitions.map((comp, index) => {
                  const tierInfo = getTierBadge(comp.tier || comp.type);
                  // Check if any category has a podium finish
                  const hasPodium = comp.categories?.some(cat => cat.position <= 3) || comp.position <= 3;

                  return (
                    <article
                      key={comp.id || index}
                      className={`${styles.competitionCard} ${hasPodium ? styles.podiumCard : ''}`}
                      role="listitem"
                      aria-label={`${comp.name}, ${comp.totalPoints || comp.points} pontos`}
                    >
                      <div className={styles.compHeader}>
                        <div className={styles.compTitleRow}>
                          <span className={styles.compName}>{comp.name}</span>
                          {tierInfo.label && (
                            <span className={`${styles.tierBadge} ${tierInfo.className}`}>
                              {tierInfo.label}
                            </span>
                          )}
                        </div>
                        <span className={styles.compDate}>
                          {comp.date ? new Date(comp.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' }) : comp.year}
                        </span>
                      </div>

                      {/* Categories list - new format with multiple categories per tournament */}
                      {comp.categories && comp.categories.length > 0 ? (
                        <div className={styles.categoriesList}>
                          {comp.categories.map((cat, catIndex) => {
                            const isPodium = cat.position <= 3;
                            return (
                              <div key={catIndex} className={styles.categoryRow}>
                                <span className={styles.categoryName}>{cat.category}</span>
                                <div className={styles.categoryDetails}>
                                  <span className={`${styles.categoryPosition} ${isPodium ? styles.podiumPosition : ''}`}>
                                    {cat.position}o
                                  </span>
                                  <span className={styles.categoryPoints}>{cat.points} pts</span>
                                </div>
                              </div>
                            );
                          })}
                          {/* Total points row */}
                          <div className={styles.totalPointsRow}>
                            <span className={styles.totalLabel}>Total</span>
                            <span className={styles.totalPoints}>{comp.totalPoints} pontos</span>
                          </div>
                        </div>
                      ) : (
                        /* Fallback for old format without categories array */
                        <div className={styles.compDetails}>
                          <div className={`${styles.positionBadge} ${getPositionClass(comp.position)}`}>
                            {comp.position <= 3 && (
                              <span className={styles.podiumIcon} aria-hidden="true">
                                {comp.position}
                              </span>
                            )}
                            <div className={styles.positionContent}>
                              <span className={styles.positionLabel}>Posicao</span>
                              <span className={styles.positionNumber}>{comp.position}o</span>
                            </div>
                          </div>
                          <div className={styles.pointsBadge}>
                            <span className={styles.pointsValue}>{comp.points}</span>
                            <span className={styles.pointsLabel}>pontos</span>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.noCompetitions}>
                <p>Ainda nao participou em nenhum torneio esta temporada.</p>
                <p className={styles.noCompetitionsHint}>
                  Inscreva-se num torneio para comecar a acumular pontos!
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default Profile;
