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

  // Tournament creation state
  const [tournaments, setTournaments] = useState([]);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [tournamentForm, setTournamentForm] = useState({
    name: '',
    code: '',
    tier: 'PRATA',
    location: 'BT Espinho',
    startDate: '',
    endDate: '',
    year: new Date().getFullYear().toString()
  });
  const [selectedCategories, setSelectedCategories] = useState({
    M1: true,
    M2: true,
    F1: true,
    F2: true,
    MX1: true,
    MX2: true
  });
  const [tournamentFormError, setTournamentFormError] = useState(null);
  const [tournamentFormSuccess, setTournamentFormSuccess] = useState(null);

  // Available categories with labels
  const availableCategories = [
    { code: 'M1', label: 'Masculinos N1', gender: 'M' },
    { code: 'M2', label: 'Masculinos N2', gender: 'M' },
    { code: 'F1', label: 'Femininos N1', gender: 'F' },
    { code: 'F2', label: 'Femininos N2', gender: 'F' },
    { code: 'MX1', label: 'Mistos N1', gender: 'MX' },
    { code: 'MX2', label: 'Mistos N2', gender: 'MX' }
  ];

  // Import state - tournament selection
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedTournamentInfo, setSelectedTournamentInfo] = useState(null);
  const [clearExisting, setClearExisting] = useState(false);

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
        // Load tournaments for the dropdown
        await loadTournaments();
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadTournaments = async () => {
    try {
      const tournamentsData = await apiService.getAdminTournaments();
      if (tournamentsData) {
        setTournaments(tournamentsData);
      }
    } catch (err) {
      console.error('Error loading tournaments:', err);
    }
  };

  // Handle tournament form field changes
  const handleTournamentFormChange = (field, value) => {
    setTournamentForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-fill year from start date
      if (field === 'startDate' && value) {
        const parts = value.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
          updated.year = parts[2];
        }
      }
      return updated;
    });
    setTournamentFormError(null);
    setTournamentFormSuccess(null);
  };

  // Handle category checkbox toggle
  const handleCategoryToggle = (categoryCode) => {
    setSelectedCategories(prev => ({
      ...prev,
      [categoryCode]: !prev[categoryCode]
    }));
  };

  // Create new tournament
  const handleCreateTournament = async () => {
    setTournamentFormError(null);
    setTournamentFormSuccess(null);

    // Validate required fields
    if (!tournamentForm.name || !tournamentForm.code || !tournamentForm.tier ||
        !tournamentForm.startDate || !tournamentForm.endDate || !tournamentForm.year) {
      setTournamentFormError('Preencha todos os campos obrigatórios');
      return;
    }

    // Get selected categories
    const categories = Object.entries(selectedCategories)
      .filter(([, selected]) => selected)
      .map(([code]) => code);

    if (categories.length === 0) {
      setTournamentFormError('Selecione pelo menos uma categoria');
      return;
    }

    // Parse dates from DD/MM/YYYY to YYYY-MM-DD
    const parsePortugueseDate = (dateStr) => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    };

    const startDate = parsePortugueseDate(tournamentForm.startDate);
    const endDate = parsePortugueseDate(tournamentForm.endDate);

    if (!startDate || !endDate) {
      setTournamentFormError('Data inválida. Use o formato DD/MM/YYYY');
      return;
    }

    setCreatingTournament(true);
    try {
      const result = await apiService.createTournament({
        name: tournamentForm.name,
        code: tournamentForm.code,
        tier: tournamentForm.tier,
        location: tournamentForm.location || 'BT Espinho',
        startDate,
        endDate,
        year: parseInt(tournamentForm.year),
        categories
      });

      setTournamentFormSuccess(`Torneio "${result.tournament.name}" criado com sucesso!`);
      // Reset form
      setTournamentForm({
        name: '',
        code: '',
        tier: 'PRATA',
        location: 'BT Espinho',
        startDate: '',
        endDate: '',
        year: new Date().getFullYear().toString()
      });
      // Reset categories to all selected
      setSelectedCategories({
        M1: true,
        M2: true,
        F1: true,
        F2: true,
        MX1: true,
        MX2: true
      });
      // Reload tournaments
      await loadTournaments();
      // Refresh stats
      const statsData = await apiService.getAdminStats();
      if (statsData) setStats(statsData);
    } catch (err) {
      setTournamentFormError(err.message || 'Erro ao criar torneio');
    } finally {
      setCreatingTournament(false);
    }
  };

  // Handle tournament selection for import
  const handleTournamentSelect = async (tournamentId) => {
    setSelectedTournamentId(tournamentId);
    setSelectedTournamentInfo(null);
    setClearExisting(false);

    if (!tournamentId) return;

    // Find tournament in list to get UUID
    const tournament = tournaments.find(t => t.id.toString() === tournamentId);
    if (tournament) {
      try {
        const info = await apiService.getTournamentWithStatus(tournament.uuid);
        setSelectedTournamentInfo(info);
      } catch (err) {
        console.error('Error fetching tournament info:', err);
      }
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
      setError('Selecione apenas ficheiros CSV');
      setFiles([]);
    }
  };

  const handleImport = async () => {
    if (files.length === 0) {
      setError('Selecione pelo menos um ficheiro');
      return;
    }

    if (!selectedTournamentId) {
      setError('Selecione um torneio primeiro');
      return;
    }

    // Check if tournament has results and clearExisting is not checked
    if (selectedTournamentInfo?.hasResults && !clearExisting) {
      setError('Este torneio já tem resultados. Marque a opção "Substituir dados existentes" para continuar.');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      let result;
      if (files.length === 1) {
        // Single file import
        result = await apiService.importCSV(files[0], selectedTournamentId, calculatePoints, clearExisting);
      } else {
        // Multiple files import
        result = await apiService.importCSVMultiple(files, selectedTournamentId, calculatePoints, clearExisting);
      }
      setImportResult(result);
      setFiles([]);
      setClearExisting(false);
      // Reset file input
      const fileInput = document.getElementById('csvFileInput');
      if (fileInput) fileInput.value = '';

      // Refresh stats and tournament info
      const statsData = await apiService.getAdminStats();
      if (statsData) setStats(statsData);

      // Refresh selected tournament info
      if (selectedTournamentId) {
        const tournament = tournaments.find(t => t.id.toString() === selectedTournamentId);
        if (tournament) {
          const info = await apiService.getTournamentWithStatus(tournament.uuid);
          setSelectedTournamentInfo(info);
        }
      }
    } catch (err) {
      setError(err.message || 'Falha na importação');
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

          {/* Tournament Creation Section */}
          <div className={styles.importSection}>
            <h3 className={styles.sectionTitle}>CRIAR TORNEIO</h3>

            <div className={styles.tournamentForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nome *</label>
                  <input
                    type="text"
                    value={tournamentForm.name}
                    onChange={(e) => handleTournamentFormChange('name', e.target.value)}
                    placeholder="Liga BT4500 PRATA"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Código *</label>
                  <input
                    type="text"
                    value={tournamentForm.code}
                    onChange={(e) => handleTournamentFormChange('code', e.target.value)}
                    placeholder="BT4500 PRATA 10-11 MAI"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tier *</label>
                  <select
                    value={tournamentForm.tier}
                    onChange={(e) => handleTournamentFormChange('tier', e.target.value)}
                    className={styles.formSelect}
                  >
                    <option value="OURO">OURO</option>
                    <option value="PRATA">PRATA</option>
                    <option value="BRONZE">BRONZE</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Local</label>
                  <input
                    type="text"
                    value={tournamentForm.location}
                    onChange={(e) => handleTournamentFormChange('location', e.target.value)}
                    placeholder="BT Espinho"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Data Início * (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={tournamentForm.startDate}
                    onChange={(e) => handleTournamentFormChange('startDate', e.target.value)}
                    placeholder="10/05/2025"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Data Fim * (DD/MM/YYYY)</label>
                  <input
                    type="text"
                    value={tournamentForm.endDate}
                    onChange={(e) => handleTournamentFormChange('endDate', e.target.value)}
                    placeholder="11/05/2025"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ano *</label>
                  <input
                    type="text"
                    value={tournamentForm.year}
                    onChange={(e) => handleTournamentFormChange('year', e.target.value)}
                    className={styles.formInput}
                  />
                </div>
              </div>

              {/* Categories Selection */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Categorias *</label>
                <div className={styles.categoriesGrid}>
                  {availableCategories.map(cat => (
                    <label key={cat.code} className={styles.categoryCheckbox}>
                      <input
                        type="checkbox"
                        checked={selectedCategories[cat.code]}
                        onChange={() => handleCategoryToggle(cat.code)}
                        className={styles.checkbox}
                      />
                      <span className={styles.categoryLabel}>
                        <span className={styles.categoryCode}>{cat.code}</span>
                        <span className={styles.categoryName}>{cat.label}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {tournamentFormError && (
                <div className={styles.errorCard}>
                  <p>{tournamentFormError}</p>
                </div>
              )}

              {tournamentFormSuccess && (
                <div className={styles.successCard}>
                  <p>{tournamentFormSuccess}</p>
                </div>
              )}

              <button
                onClick={handleCreateTournament}
                disabled={creatingTournament}
                className={styles.importButton}
              >
                {creatingTournament ? 'A criar...' : 'Criar Torneio'}
              </button>
            </div>
          </div>

          {/* CSV Import Section */}
          <div className={styles.importSection}>
            <h3 className={styles.sectionTitle}>IMPORTAR RESULTADOS CSV</h3>

            <div className={styles.importForm}>
              {/* Tournament Selector */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Selecionar Torneio *</label>
                <select
                  value={selectedTournamentId}
                  onChange={(e) => handleTournamentSelect(e.target.value)}
                  className={styles.formSelect}
                >
                  <option value="">-- Selecione um torneio --</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.tier}) - {t.year}
                    </option>
                  ))}
                </select>
              </div>

              {/* Warning if tournament has results */}
              {selectedTournamentInfo?.hasResults && (
                <div className={styles.warningCard}>
                  <p>
                    <strong>Atenção:</strong> Este torneio já tem {selectedTournamentInfo.matchCount} jogos registados.
                  </p>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={clearExisting}
                      onChange={(e) => setClearExisting(e.target.checked)}
                      className={styles.checkbox}
                    />
                    Substituir dados existentes
                  </label>
                </div>
              )}

              <div className={styles.fileInputWrapper}>
                <input
                  type="file"
                  id="csvFileInput"
                  accept=".csv"
                  multiple
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={!selectedTournamentId}
                />
                <label htmlFor="csvFileInput" className={`${styles.fileLabel} ${!selectedTournamentId ? styles.fileLabelDisabled : ''}`}>
                  <svg viewBox="0 0 24 24" className={styles.uploadIcon}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" fill="none"/>
                    <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="9 15 12 12 15 15" stroke="currentColor" strokeWidth="2" fill="none"/>
                  </svg>
                  {files.length === 0
                    ? 'Selecionar ficheiros CSV'
                    : files.length === 1
                      ? files[0].name
                      : `${files.length} ficheiros selecionados`}
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
                  Calcular pontos após importação
                </label>
              </div>

              <button
                onClick={handleImport}
                disabled={files.length === 0 || importing || !selectedTournamentId || (selectedTournamentInfo?.hasResults && !clearExisting)}
                className={styles.importButton}
              >
                {importing
                  ? 'A importar...'
                  : 'Importar Dados'}
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
