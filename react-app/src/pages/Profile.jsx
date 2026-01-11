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
    return {
      name: data.full_name || playerInfo?.name || 'Jogador',
      age: data.age || '-',
      category: 'BT 4500',
      city: data.city || 'Portugal',
      ranking: data.ranking || playerInfo?.ranking || '-',
      photo: data.photo || '/images/default-avatar.png',
      competitions: data.tournaments || [],
      stats: {
        totalCompetitions: data.tournamentsPlayed || 0,
        wins: data.wins || 0,
        podiums: data.podiums || 0,
        totalPoints: data.total_points || playerInfo?.totalPoints || 0
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
    photo: '/images/default-avatar.png',
    competitions: [],
    stats: {
      totalCompetitions: 0,
      wins: 0,
      podiums: 0,
      totalPoints: 0
    }
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
                  src={displayProfile.photo}
                  alt={displayProfile.name}
                  className={styles.profilePhoto}
                  onError={(e) => {
                    e.target.src = '/images/default-avatar.png';
                  }}
                />
              </div>
              <div className={styles.rankingBadge}>
                <span className={styles.rankingLabel}>RANKING</span>
                <span className={styles.rankingNumber}>#{displayProfile.ranking}</span>
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

          {/* Statistics Section */}
          <div className={styles.statsSection}>
            <h3 className={styles.sectionTitle}>ESTATÍSTICAS</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{displayProfile.stats.totalCompetitions}</span>
                <span className={styles.statLabel}>Competições</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{displayProfile.stats.wins}</span>
                <span className={styles.statLabel}>Vitórias</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{displayProfile.stats.podiums}</span>
                <span className={styles.statLabel}>Pódios</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{displayProfile.stats.totalPoints}</span>
                <span className={styles.statLabel}>Pontos</span>
              </div>
            </div>
          </div>

          {/* Competition History */}
          <div className={styles.historySection}>
            <h3 className={styles.sectionTitle}>HISTÓRICO DE COMPETIÇÕES</h3>
            {displayProfile.competitions.length > 0 ? (
              <div className={styles.competitionsList}>
                {displayProfile.competitions.map((comp, index) => (
                  <div key={comp.id || index} className={styles.competitionCard}>
                    <div className={styles.compHeader}>
                      <span className={styles.compName}>{comp.name}</span>
                      <span className={styles.compYear}>{comp.year}</span>
                    </div>
                    <div className={styles.compDetails}>
                      <div className={styles.positionBadge}>
                        <span className={styles.positionLabel}>Posição</span>
                        <span className={styles.positionNumber}>{comp.position}º</span>
                      </div>
                      <div className={styles.pointsBadge}>
                        <span className={styles.pointsValue}>{comp.points}</span>
                        <span className={styles.pointsLabel}>pontos</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noCompetitions}>
                <p>Ainda não participou em nenhuma competição.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
