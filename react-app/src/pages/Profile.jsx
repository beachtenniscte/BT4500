import { Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import styles from './Profile.module.css';

// Google Client ID - should match the one configured in Auth0
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function Profile() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Login form state
  const [loginMode, setLoginMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  // Handle Google Sign-In response
  const handleGoogleResponse = useCallback(async (response) => {
    if (response.credential) {
      setSubmitting(true);
      setError('');
      try {
        const result = await apiService.loginWithGoogle(response.credential);
        if (result.token) {
          setIsAuthenticated(true);
          setUser(result.user);
          if (result.player) {
            const profileData = await apiService.getProfile(result.player.id);
            if (profileData) {
              setProfile(formatProfileData(profileData, result.player));
            }
          }
        }
      } catch (err) {
        setError(err.message || 'Google login failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    }
  }, [formatProfileData]);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.log('Google Client ID not configured');
      return;
    }

    // Check if script already loaded
    if (window.google?.accounts?.id) {
      setGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Initialize Google Sign-In when script is loaded
  useEffect(() => {
    if (googleLoaded && GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }
  }, [googleLoaded, handleGoogleResponse]);

  // Render Google button when ready
  useEffect(() => {
    if (googleLoaded && GOOGLE_CLIENT_ID && !isAuthenticated && window.google?.accounts?.id) {
      const buttonContainer = document.getElementById('google-signin-button');
      if (buttonContainer) {
        buttonContainer.innerHTML = ''; // Clear previous button
        window.google.accounts.id.renderButton(buttonContainer, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 280,
        });
      }
    }
  }, [googleLoaded, isAuthenticated, loginMode]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      const userData = await apiService.getCurrentUser();
      if (userData && userData.user) {
        setIsAuthenticated(true);
        setUser(userData.user);
        // Fetch profile data
        if (userData.player) {
          const profileData = await apiService.getProfile(userData.player.id);
          if (profileData) {
            setProfile(formatProfileData(profileData, userData.player));
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiService.login(username, password);
      if (response.token) {
        setIsAuthenticated(true);
        setUser(response.user);
        if (response.player) {
          const profileData = await apiService.getProfile(response.player.id);
          if (profileData) {
            setProfile(formatProfileData(profileData, response.player));
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiService.register({
        email: username,
        password,
        firstName,
        lastName
      });
      if (response.token) {
        setIsAuthenticated(true);
        setUser(response.user);
        if (response.player) {
          setProfile(formatProfileData({}, response.player));
        }
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setProfile(null);
    setUsername('');
    setPassword('');
    setFirstName('');
    setLastName('');
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

  // Login/Register form
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>

          <h1 className={styles.pageTitle}>
            {loginMode === 'login' ? 'INICIAR SESSÃO' : 'CRIAR CONTA'}
          </h1>

          <div className={styles.profileCard}>
            <div className={styles.loginSection}>
              <div className={styles.loginHeader}>
                <svg viewBox="0 0 24 24" className={styles.loginIcon}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
                <p className={styles.loginSubtitle}>
                  {loginMode === 'login'
                    ? 'Entre para aceder ao seu perfil'
                    : 'Crie uma conta para participar'}
                </p>
              </div>

              <form onSubmit={loginMode === 'login' ? handleLogin : handleRegister} className={styles.loginForm}>
                {loginMode === 'register' && (
                  <>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label htmlFor="firstName">Nome</label>
                        <input
                          type="text"
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="João"
                          required
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label htmlFor="lastName">Apelido</label>
                        <input
                          type="text"
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Silva"
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className={styles.formGroup}>
                  <label htmlFor="username">Utilizador</label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="password">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                {error && <div className={styles.errorMessage}>{error}</div>}

                <button type="submit" className={styles.submitButton} disabled={submitting}>
                  {submitting
                    ? 'A processar...'
                    : (loginMode === 'login' ? 'Entrar' : 'Criar Conta')}
                </button>
              </form>

              {/* Google Sign-In Button */}
              {GOOGLE_CLIENT_ID && loginMode === 'login' && (
                <div className={styles.socialLogin}>
                  <div className={styles.divider}>
                    <span>ou</span>
                  </div>
                  <div id="google-signin-button" className={styles.googleButton}></div>
                </div>
              )}

              <div className={styles.switchMode}>
                {loginMode === 'login' ? (
                  <p>
                    Não tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => { setLoginMode('register'); setError(''); }}
                      className={styles.switchButton}
                    >
                      Criar conta
                    </button>
                  </p>
                ) : (
                  <p>
                    Já tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => { setLoginMode('login'); setError(''); }}
                      className={styles.switchButton}
                    >
                      Iniciar sessão
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
