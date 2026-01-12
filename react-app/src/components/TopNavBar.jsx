import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import apiService from '../services/api';
import styles from './TopNavBar.module.css';

/**
 * TopNavBar - Unified navigation bar for all pages
 *
 * Props:
 * - title: Page title to display (default: "BT4500")
 * - showBack: Show back button (default: true for inner pages)
 * - backTo: Route to navigate to on back (default: "/" home)
 * - showProfile: Show profile button (default: true)
 * - variant: "home" | "inner" - styling variant
 */
function TopNavBar({
  title = "BT4500",
  showBack = true,
  backTo = "/",
  showProfile = true,
  variant = "inner"
}) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminMenuRef = useRef(null);

  useEffect(() => {
    const checkAdmin = async () => {
      const adminStatus = await apiService.isAdmin();
      setIsAdmin(adminStatus);
    };
    checkAdmin();
  }, []);

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

  const handleAdminMenuToggle = () => {
    setAdminMenuOpen(!adminMenuOpen);
  };

  const handleAdminNavigation = (path) => {
    setAdminMenuOpen(false);
    navigate(path);
  };

  const handleBack = () => {
    navigate(backTo);
  };

  return (
    <nav className={`${styles.navbar} ${styles[variant]}`}>
      {/* Left Section - Back Button */}
      <div className={styles.leftSection}>
        {showBack && (
          <button
            onClick={handleBack}
            className={styles.navButton}
            aria-label="Voltar"
          >
            <svg viewBox="0 0 24 24" className={styles.icon}>
              <path
                d="M19 12H5M12 19l-7-7 7-7"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Center Section - Title */}
      <div className={styles.centerSection}>
        <h1 className={styles.title}>{title}</h1>
      </div>

      {/* Right Section - Profile & Admin */}
      <div className={styles.rightSection}>
        {showProfile && (
          <Link to="/profile" className={styles.navButton} aria-label="Perfil">
            <svg viewBox="0 0 24 24" className={styles.icon}>
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path
                d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          </Link>
        )}

        {isAdmin && (
          <div className={styles.adminMenuWrapper} ref={adminMenuRef}>
            <button
              onClick={handleAdminMenuToggle}
              className={`${styles.navButton} ${styles.adminButton} ${adminMenuOpen ? styles.adminButtonActive : ''}`}
              aria-label="Admin Menu"
              aria-expanded={adminMenuOpen}
            >
              <svg viewBox="0 0 24 24" className={styles.icon}>
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
                  <svg viewBox="0 0 24 24" className={styles.dropdownIcon}>
                    <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Criar Torneio
                </button>
                <button
                  className={styles.adminDropdownItem}
                  onClick={() => handleAdminNavigation('/admin/import-results')}
                >
                  <svg viewBox="0 0 24 24" className={styles.dropdownIcon}>
                    <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Importar Resultados
                </button>
                <button
                  className={styles.adminDropdownItem}
                  onClick={() => handleAdminNavigation('/admin/link-players')}
                >
                  <svg viewBox="0 0 24 24" className={styles.dropdownIcon}>
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 11l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Associar Jogadores
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default TopNavBar;
