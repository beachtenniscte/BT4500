import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './AdminImportResults.module.css';

function AdminImportResults() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedTournamentInfo, setSelectedTournamentInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [calculatePoints, setCalculatePoints] = useState(true);
  const [clearExisting, setClearExisting] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);

      if (adminCheck) {
        await loadTournaments();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
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

  // Handle tournament selection for import
  const handleTournamentSelect = async (tournamentId) => {
    setSelectedTournamentId(tournamentId);
    setSelectedTournamentInfo(null);
    setClearExisting(false);
    setImportResult(null);
    setError(null);

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
      setError('Este torneio ja tem resultados. Marque a opcao "Substituir dados existentes" para continuar.');
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

      // Refresh selected tournament info
      if (selectedTournamentId) {
        const tournament = tournaments.find(t => t.id.toString() === selectedTournamentId);
        if (tournament) {
          const info = await apiService.getTournamentWithStatus(tournament.uuid);
          setSelectedTournamentInfo(info);
        }
      }
    } catch (err) {
      setError(err.message || 'Falha na importacao');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span>&lt;&lt;</span>
          </Link>
          <div className={styles.loading}>A carregar...</div>
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
          <h1 className={styles.pageTitle}>ACESSO NEGADO</h1>
          <div className={styles.errorCard}>
            <p>Precisa de ser administrador para aceder a esta pagina.</p>
            <Link to="/" className={styles.homeLink}>Voltar ao Inicio</Link>
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

        <h1 className={styles.pageTitle}>IMPORTAR RESULTADOS</h1>

        <div className={styles.mainCard}>
          <div className={styles.description}>
            <p>
              Importe resultados de torneios a partir de ficheiros CSV.
              Selecione o torneio e carregue os ficheiros com os resultados.
            </p>
          </div>

          <div className={styles.formSection}>
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
                    <strong>Atencao:</strong> Este torneio ja tem {selectedTournamentInfo.matchCount} jogos registados.
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
                  Calcular pontos apos importacao
                </label>
              </div>

              <button
                onClick={handleImport}
                disabled={files.length === 0 || importing || !selectedTournamentId || (selectedTournamentInfo?.hasResults && !clearExisting)}
                className={styles.submitButton}
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
                    ? 'Importacao concluida!'
                    : importResult.message || 'Importacao Completa'}
                </h4>

                {/* Single file result */}
                {importResult.data && !importResult.totalFiles && (
                  <div className={styles.resultDetails}>
                    <p><strong>Torneio:</strong> {importResult.data.tournament?.name}</p>
                    <p><strong>Categorias:</strong> {importResult.data.categoriesCount || 0}</p>
                    <p><strong>Jogadores:</strong> {importResult.data.playersCount || 0}</p>
                    <p><strong>Equipas:</strong> {importResult.data.teamsCount || 0}</p>
                    <p><strong>Jogos:</strong> {importResult.data.matchesCount || 0}</p>
                    {importResult.data.errorsCount > 0 && (
                      <p className={styles.warningText}>
                        <strong>Avisos:</strong> {importResult.data.errorsCount} linhas com problemas
                      </p>
                    )}
                  </div>
                )}

                {/* Multiple files result */}
                {importResult.totalFiles && (
                  <div className={styles.resultDetails}>
                    <p className={styles.summaryText}>
                      <strong>{importResult.successCount}</strong> de <strong>{importResult.totalFiles}</strong> ficheiros importados com sucesso
                    </p>

                    {importResult.results?.map((fileResult, index) => (
                      <div key={index} className={fileResult.success ? styles.fileResultSuccess : styles.fileResultError}>
                        <p className={styles.fileName}>
                          {fileResult.success ? '✓' : '✗'} {fileResult.filename}
                        </p>
                        {fileResult.success && fileResult.data && (
                          <div className={styles.fileDetails}>
                            <span>Torneio: {fileResult.data.tournament?.name}</span>
                            <span>Jogos: {fileResult.data.matchesCount}</span>
                            <span>Jogadores: {fileResult.data.playersCount}</span>
                          </div>
                        )}
                        {!fileResult.success && (
                          <p className={styles.fileError}>{fileResult.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {importResult.message && !importResult.data && !importResult.totalFiles && (
                  <p>{importResult.message}</p>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className={styles.errorMessage}>
                <svg viewBox="0 0 24 24" className={styles.messageIcon}>
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminImportResults;
