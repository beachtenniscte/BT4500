import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Home.module.css';

function Home() {
  const navigate = useNavigate();
  const { isAdmin, isAuthenticated } = useAuth();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  // Close admin menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setAdminMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdminNavigation = (path) => {
    setAdminMenuOpen(false);
    navigate(path);
  };

  return (
    <div className={styles.container}>
      {/* Top-right actions */}
      {(isAdmin || isAuthenticated) && (
        <div className={styles.topRightActions}>
          {isAdmin && (
            <div className={styles.adminWrapper} ref={adminMenuRef}>
              <button
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className={styles.adminButton}
                aria-label="Admin Menu"
                aria-expanded={adminMenuOpen}
              >
                <svg viewBox="0 0 24 24" className={styles.adminIcon}>
                  <path
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {adminMenuOpen && (
                <div className={styles.adminDropdown}>
                  <button
                    className={styles.adminDropdownItem}
                    onClick={() => handleAdminNavigation('/admin/create-tournament')}
                  >
                    Criar Torneio
                  </button>
                  <button
                    className={styles.adminDropdownItem}
                    onClick={() => handleAdminNavigation('/admin/import-results')}
                  >
                    Editar Torneio
                  </button>
                  <button
                    className={styles.adminDropdownItem}
                    onClick={() => handleAdminNavigation('/admin/link-players')}
                  >
                    Associar Jogadores
                  </button>
                </div>
              )}
            </div>
          )}

          {isAuthenticated && (
            <Link to="/profile" className={styles.profileButton} aria-label="Perfil">
              <svg viewBox="0 0 24 24" className={styles.profileIcon}>
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path
                  d="M4 21c0-4.418 3.582-8 8-8s8 3.582 8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </Link>
          )}
        </div>
      )}

      {/* BT4500 Logo */}
      <div className={styles.logo}>
        <img
          src="/images/liga-logo.png"
          alt="Liga BT4500"
          className={styles.ligaLogo}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = '<div class="' + styles.logoText + '">BT<span class="' + styles.logoNumber + '">4500</span></div>';
          }}
        />
      </div>

      {/* Main Navigation Buttons */}
      <nav className={styles.navButtons}>
        <Link to="/provas" className={styles.navButton}>PROVAS</Link>
        <Link to="/classificacao" className={styles.navButton}>CLASSIFICAÇÃO</Link>
        <Link to="/info" className={styles.navButton}>+ INFO</Link>
      </nav>

      {/* Login Button - hidden when authenticated */}
      {!isAuthenticated && (
        <Link to="/login" className={styles.loginButton}>
          ENTRAR
        </Link>
      )}

      {/* Club Logo */}
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
