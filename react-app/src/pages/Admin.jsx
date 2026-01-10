import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './Admin.module.css';

function Admin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [calculatePoints, setCalculatePoints] = useState(true);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);

      if (adminCheck) {
        const statsData = await apiService.getAdminStats();
        if (statsData) {
          setStats(statsData);
        }
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = [];

    for (const file of selectedFiles) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        validFiles.push(file);
      }
    }

    if (validFiles.length > 0) {
      setFiles(validFiles);
      setError(null);
      setImportResult(null);
    } else if (selectedFiles.length > 0) {
      setError('Please select only CSV files');
      setFiles([]);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      let result;
      if (files.length === 1) {
        // Single file import
        result = await apiService.importCSV(files[0], calculatePoints);
      } else {
        // Multiple files import
        result = await apiService.importCSVMultiple(files, calculatePoints);
      }
      setImportResult(result);
      setFiles([]);
      // Reset file input
      const fileInput = document.getElementById('csvFileInput');
      if (fileInput) fileInput.value = '';

      // Refresh stats
      const statsData = await apiService.getAdminStats();
      if (statsData) setStats(statsData);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const handleRecalculateRankings = async () => {
    try {
      setError(null);
      await apiService.recalculateRankings();
      setImportResult({ message: 'Rankings recalculated successfully!' });
    } catch (err) {
      setError(err.message || 'Failed to recalculate rankings');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <div className={styles.loading}>Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <h1 className={styles.pageTitle}>ACCESS DENIED</h1>
          <div className={styles.errorCard}>
            <p>You must be logged in as an administrator to access this page.</p>
            <Link to="/" className={styles.homeLink}>Return to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>ADMIN PANEL</h1>

        <div className={styles.adminCard}>
          {/* Stats Section */}
          {stats && (
            <div className={styles.statsSection}>
              <h3 className={styles.sectionTitle}>DASHBOARD</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statNumber}>{stats.totalTournaments || 0}</span>
                  <span className={styles.statLabel}>Tournaments</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statNumber}>{stats.totalPlayers || 0}</span>
                  <span className={styles.statLabel}>Players</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statNumber}>{stats.totalMatches || 0}</span>
                  <span className={styles.statLabel}>Matches</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statNumber}>{stats.totalUsers || 0}</span>
                  <span className={styles.statLabel}>Users</span>
                </div>
              </div>
            </div>
          )}

          {/* CSV Import Section */}
          <div className={styles.importSection}>
            <h3 className={styles.sectionTitle}>IMPORT TOURNAMENT DATA</h3>

            <div className={styles.importForm}>
              <div className={styles.fileInputWrapper}>
                <input
                  type="file"
                  id="csvFileInput"
                  accept=".csv"
                  multiple
                  onChange={handleFileChange}
                  className={styles.fileInput}
                />
                <label htmlFor="csvFileInput" className={styles.fileLabel}>
                  <svg viewBox="0 0 24 24" className={styles.uploadIcon}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  {files.length === 0
                    ? 'Select CSV Files (multiple allowed)'
                    : files.length === 1
                      ? files[0].name
                      : `${files.length} files selected`}
                </label>
              </div>

              <div className={styles.optionRow}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={calculatePoints}
                    onChange={(e) => setCalculatePoints(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Calculate points after import
                </label>
              </div>

              <button
                onClick={handleImport}
                disabled={files.length === 0 || importing}
                className={styles.importButton}
              >
                {importing
                  ? 'Importing...'
                  : files.length <= 1
                    ? 'Import Tournament'
                    : `Import ${files.length} Tournaments`}
              </button>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={styles.resultCard}>
                <h4 className={styles.resultTitle}>
                  {importResult.results
                    ? 'Import Successful!'
                    : importResult.message || 'Import Complete'}
                </h4>

                {/* Single file result */}
                {importResult.results && !importResult.totalFiles && (
                  <div className={styles.resultDetails}>
                    <p><strong>Tournament:</strong> {importResult.results.tournament?.name}</p>
                    <p><strong>Categories:</strong> {importResult.results.categories?.length || 0}</p>
                    <p><strong>Players:</strong> {importResult.results.players?.length || 0}</p>
                    <p><strong>Teams:</strong> {importResult.results.teams?.length || 0}</p>
                    <p><strong>Matches:</strong> {importResult.results.matches?.length || 0}</p>
                    {importResult.results.errors?.length > 0 && (
                      <p className={styles.warningText}>
                        <strong>Warnings:</strong> {importResult.results.errors.length} rows had issues
                      </p>
                    )}
                  </div>
                )}

                {/* Multiple files result */}
                {importResult.totalFiles && (
                  <div className={styles.resultDetails}>
                    <p className={styles.summaryText}>
                      <strong>{importResult.successCount}</strong> of <strong>{importResult.totalFiles}</strong> files imported successfully
                    </p>

                    {importResult.results?.map((fileResult, index) => (
                      <div key={index} className={fileResult.success ? styles.fileResultSuccess : styles.fileResultError}>
                        <p className={styles.fileName}>
                          {fileResult.success ? '✓' : '✗'} {fileResult.filename}
                        </p>
                        {fileResult.success && fileResult.data && (
                          <div className={styles.fileDetails}>
                            <span>Tournament: {fileResult.data.tournament?.name}</span>
                            <span>Matches: {fileResult.data.matchesCount}</span>
                            <span>Players: {fileResult.data.playersCount}</span>
                          </div>
                        )}
                        {!fileResult.success && (
                          <p className={styles.fileError}>{fileResult.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {importResult.message && !importResult.results && !importResult.totalFiles && (
                  <p>{importResult.message}</p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className={styles.errorCard}>
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Actions Section */}
          <div className={styles.actionsSection}>
            <h3 className={styles.sectionTitle}>ACTIONS</h3>
            <div className={styles.actionsGrid}>
              <button onClick={handleRecalculateRankings} className={styles.actionButton}>
                Recalculate Rankings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;
