import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './AdminCreateTournament.module.css';

function AdminCreateTournament() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
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
    M1: { selected: true, registrationType: 'none', registrationUrl: '' },
    M2: { selected: true, registrationType: 'none', registrationUrl: '' },
    F1: { selected: true, registrationType: 'none', registrationUrl: '' },
    F2: { selected: true, registrationType: 'none', registrationUrl: '' },
    MX1: { selected: true, registrationType: 'none', registrationUrl: '' },
    MX2: { selected: true, registrationType: 'none', registrationUrl: '' }
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Available categories with labels
  const availableCategories = [
    { code: 'M1', label: 'Masculinos N1', gender: 'M' },
    { code: 'M2', label: 'Masculinos N2', gender: 'M' },
    { code: 'F1', label: 'Femininos N1', gender: 'F' },
    { code: 'F2', label: 'Femininos N2', gender: 'F' },
    { code: 'MX1', label: 'Mistos N1', gender: 'MX' },
    { code: 'MX2', label: 'Mistos N2', gender: 'MX' }
  ];

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);
    } catch (err) {
      console.error('Error checking admin status:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle tournament form field changes
  const handleFormChange = (field, value) => {
    setTournamentForm(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-fill year and endDate from start date
      if (field === 'startDate' && value) {
        const year = value.split('-')[0];
        if (year) {
          updated.year = year;
        }
        // Auto-set end date to same as start if empty
        if (!prev.endDate) {
          updated.endDate = value;
        }
      }
      return updated;
    });
    setError(null);
    setSuccess(null);
  };

  // Handle category checkbox toggle
  const handleCategoryToggle = (categoryCode) => {
    setSelectedCategories(prev => ({
      ...prev,
      [categoryCode]: {
        ...prev[categoryCode],
        selected: !prev[categoryCode].selected
      }
    }));
  };

  // Handle category registration type change
  const handleCategoryRegistration = (categoryCode, field, value) => {
    setSelectedCategories(prev => ({
      ...prev,
      [categoryCode]: {
        ...prev[categoryCode],
        [field]: value
      }
    }));
  };

  // Create new tournament
  const handleCreateTournament = async () => {
    setError(null);
    setSuccess(null);

    // Validate required fields
    if (!tournamentForm.name || !tournamentForm.code || !tournamentForm.tier ||
        !tournamentForm.startDate || !tournamentForm.endDate || !tournamentForm.year) {
      setError('Preencha todos os campos obrigatorios');
      return;
    }

    // Get selected categories with registration config
    const categories = Object.entries(selectedCategories)
      .filter(([, config]) => config.selected)
      .map(([code, config]) => ({
        code,
        registrationType: config.registrationType,
        registrationUrl: config.registrationType === 'external' ? config.registrationUrl : null
      }));

    if (categories.length === 0) {
      setError('Selecione pelo menos uma categoria');
      return;
    }

    // Dates are already in YYYY-MM-DD format from the date inputs
    const startDate = tournamentForm.startDate;
    const endDate = tournamentForm.endDate;

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

      setSuccess(`Torneio "${result.tournament.name}" criado com sucesso!`);
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
        M1: { selected: true, registrationType: 'none', registrationUrl: '' },
        M2: { selected: true, registrationType: 'none', registrationUrl: '' },
        F1: { selected: true, registrationType: 'none', registrationUrl: '' },
        F2: { selected: true, registrationType: 'none', registrationUrl: '' },
        MX1: { selected: true, registrationType: 'none', registrationUrl: '' },
        MX2: { selected: true, registrationType: 'none', registrationUrl: '' }
      });
    } catch (err) {
      setError(err.message || 'Erro ao criar torneio');
    } finally {
      setCreatingTournament(false);
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

        <h1 className={styles.pageTitle}>CRIAR TORNEIO</h1>

        <div className={styles.mainCard}>
          <div className={styles.description}>
            <p>
              Crie um novo torneio definindo os detalhes e categorias.
              Apos criar, podera importar os resultados CSV.
            </p>
          </div>

          <div className={styles.formSection}>
            <div className={styles.tournamentForm}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nome *</label>
                  <input
                    type="text"
                    value={tournamentForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Liga BT4500 PRATA"
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Codigo *</label>
                  <input
                    type="text"
                    value={tournamentForm.code}
                    onChange={(e) => handleFormChange('code', e.target.value)}
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
                    onChange={(e) => handleFormChange('tier', e.target.value)}
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
                    onChange={(e) => handleFormChange('location', e.target.value)}
                    placeholder="BT Espinho"
                    className={styles.formInput}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Data Início *</label>
                  <input
                    type="date"
                    value={tournamentForm.startDate}
                    onChange={(e) => handleFormChange('startDate', e.target.value)}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Data Fim *</label>
                  <input
                    type="date"
                    value={tournamentForm.endDate}
                    onChange={(e) => handleFormChange('endDate', e.target.value)}
                    min={tournamentForm.startDate}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Ano</label>
                  <input
                    type="text"
                    value={tournamentForm.year}
                    readOnly
                    className={`${styles.formInput} ${styles.formInputReadonly}`}
                  />
                </div>
              </div>

              {/* Categories Selection with Registration Config */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Categorias e Inscricoes *</label>
                <div className={styles.categoriesList}>
                  {availableCategories.map(cat => (
                    <div key={cat.code} className={styles.categoryItem}>
                      <div className={styles.categoryHeader}>
                        <label className={styles.categoryCheckbox}>
                          <input
                            type="checkbox"
                            checked={selectedCategories[cat.code].selected}
                            onChange={() => handleCategoryToggle(cat.code)}
                            className={styles.checkbox}
                          />
                          <span className={styles.categoryLabel}>
                            <span className={styles.categoryCode}>{cat.code}</span>
                            <span className={styles.categoryName}>{cat.label}</span>
                          </span>
                        </label>
                      </div>

                      {selectedCategories[cat.code].selected && (
                        <div className={styles.registrationConfig}>
                          <select
                            value={selectedCategories[cat.code].registrationType}
                            onChange={(e) => handleCategoryRegistration(cat.code, 'registrationType', e.target.value)}
                            className={styles.registrationSelect}
                          >
                            <option value="none">Sem inscricoes</option>
                            <option value="form">Formulario interno</option>
                            <option value="external">Link externo</option>
                          </select>

                          {selectedCategories[cat.code].registrationType === 'external' && (
                            <input
                              type="url"
                              value={selectedCategories[cat.code].registrationUrl}
                              onChange={(e) => handleCategoryRegistration(cat.code, 'registrationUrl', e.target.value)}
                              placeholder="https://www.tietennis.com/..."
                              className={styles.registrationUrlInput}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className={styles.errorMessage}>
                  <svg viewBox="0 0 24 24" className={styles.messageIcon}>
                    <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {error}
                </div>
              )}

              {success && (
                <div className={styles.successMessage}>
                  <svg viewBox="0 0 24 24" className={styles.messageIcon}>
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {success}
                </div>
              )}

              <button
                onClick={handleCreateTournament}
                disabled={creatingTournament}
                className={styles.submitButton}
              >
                {creatingTournament ? 'A criar...' : 'Criar Torneio'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminCreateTournament;
