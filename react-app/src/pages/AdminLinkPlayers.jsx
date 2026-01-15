import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './AdminLinkPlayers.module.css';

function AdminLinkPlayers() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('M');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAdminAndLoadPlayers();
  }, []);

  const checkAdminAndLoadPlayers = async () => {
    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);

      if (adminCheck) {
        await loadPlayers();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      const response = await apiService.getAllPlayers({ limit: 500 });
      if (response?.data) {
        // Sort players alphabetically
        const sorted = response.data.sort((a, b) =>
          (a.full_name || '').localeCompare(b.full_name || '')
        );
        setPlayers(sorted);
      }
    } catch (err) {
      console.error('Error loading players:', err);
    }
  };

  const handlePlayerSelect = (player) => {
    setSelectedPlayer(player);
    setEmail(player.email || '');
    setGender(player.gender || 'M');
    setMessage(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedPlayer) {
      setError('Selecione um jogador primeiro');
      return;
    }

    // Email is optional - only validate if provided
    const emailToSave = email.trim() || null;
    if (emailToSave) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailToSave)) {
        setError('Email invalido');
        return;
      }
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await apiService.updatePlayerInfo(selectedPlayer.uuid, {
        email: emailToSave,
        gender: gender
      });

      const messages = [];
      if (emailToSave) {
        messages.push(`Email "${emailToSave}" associado`);
      }
      if (gender !== selectedPlayer.gender) {
        messages.push(`Genero alterado para ${gender === 'M' ? 'Masculino' : 'Feminino'}`);
      }

      setMessage(messages.length > 0
        ? `${selectedPlayer.full_name}: ${messages.join(', ')}`
        : 'Dados guardados com sucesso!');

      // Update local state
      setPlayers(prev => prev.map(p =>
        p.id === selectedPlayer.id ? { ...p, email: emailToSave, gender: gender } : p
      ));
      setSelectedPlayer(prev => ({ ...prev, email: emailToSave, gender: gender }));
    } catch (err) {
      setError(err.message || 'Erro ao guardar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleClearEmail = async () => {
    if (!selectedPlayer) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await apiService.linkPlayerEmail(selectedPlayer.uuid, null);

      setMessage(`Email removido de ${selectedPlayer.full_name}`);
      setEmail('');

      // Update local state
      setPlayers(prev => prev.map(p =>
        p.id === selectedPlayer.id ? { ...p, email: null } : p
      ));
      setSelectedPlayer(prev => ({ ...prev, email: null }));
    } catch (err) {
      setError(err.message || 'Erro ao remover email');
    } finally {
      setSaving(false);
    }
  };

  // Filter players based on search term
  const filteredPlayers = players.filter(player => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (player.full_name || '').toLowerCase().includes(searchLower) ||
      (player.email || '').toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/admin" className={styles.backButton}>
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
        <Link to="/admin" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>ASSOCIAR JOGADORES</h1>

        <div className={styles.mainCard}>
          <div className={styles.description}>
            <p>
              Associe um email a um jogador para que quando esse utilizador faca login,
              seja automaticamente ligado ao perfil do jogador.
            </p>
          </div>

          <div className={styles.splitLayout}>
            {/* Left Side - Player Selection */}
            <div className={styles.playerPanel}>
              <h3 className={styles.panelTitle}>Selecionar Jogador</h3>

              <div className={styles.searchBox}>
                <svg viewBox="0 0 24 24" className={styles.searchIcon}>
                  <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  placeholder="Procurar jogador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <div className={styles.playerList}>
                {filteredPlayers.map(player => (
                  <button
                    key={player.id}
                    className={`${styles.playerItem} ${selectedPlayer?.id === player.id ? styles.playerItemSelected : ''}`}
                    onClick={() => handlePlayerSelect(player)}
                  >
                    <div className={styles.playerInfo}>
                      <span className={styles.playerName}>{player.full_name}</span>
                      {player.email && (
                        <span className={styles.playerEmail}>{player.email}</span>
                      )}
                    </div>
                    <span className={`${styles.playerGender} ${styles[`gender${player.gender}`]}`}>
                      {player.gender}
                    </span>
                  </button>
                ))}
                {filteredPlayers.length === 0 && (
                  <div className={styles.noResults}>
                    Nenhum jogador encontrado
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Email Input */}
            <div className={styles.emailPanel}>
              <h3 className={styles.panelTitle}>Email do Utilizador</h3>

              {selectedPlayer ? (
                <div className={styles.emailForm}>
                  <div className={styles.selectedPlayerInfo}>
                    <span className={styles.selectedLabel}>Jogador selecionado:</span>
                    <span className={styles.selectedName}>{selectedPlayer.full_name}</span>
                  </div>

                  <div className={styles.emailInputGroup}>
                    <label className={styles.emailLabel}>Genero</label>
                    <div className={styles.genderSelector}>
                      <button
                        type="button"
                        className={`${styles.genderOption} ${gender === 'M' ? styles.genderOptionActive : ''}`}
                        onClick={() => setGender('M')}
                      >
                        M - Masculino
                      </button>
                      <button
                        type="button"
                        className={`${styles.genderOption} ${gender === 'F' ? styles.genderOptionActive : ''}`}
                        onClick={() => setGender('F')}
                      >
                        F - Feminino
                      </button>
                    </div>
                  </div>

                  <div className={styles.emailInputGroup}>
                    <label className={styles.emailLabel}>Email (opcional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemplo@email.com"
                      className={styles.emailInput}
                    />
                    <p className={styles.emailHint}>
                      Quando um utilizador fizer login com este email, sera automaticamente
                      ligado ao perfil deste jogador.
                    </p>
                  </div>

                  <div className={styles.buttonRow}>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={styles.saveButton}
                    >
                      {saving ? 'A guardar...' : 'Guardar'}
                    </button>
                    {selectedPlayer.email && (
                      <button
                        onClick={handleClearEmail}
                        disabled={saving}
                        className={styles.clearButton}
                      >
                        Remover Email
                      </button>
                    )}
                  </div>

                  {message && (
                    <div className={styles.successMessage}>
                      <svg viewBox="0 0 24 24" className={styles.messageIcon}>
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {message}
                    </div>
                  )}

                  {error && (
                    <div className={styles.errorMessage}>
                      <svg viewBox="0 0 24 24" className={styles.messageIcon}>
                        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {error}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.noSelection}>
                  <svg viewBox="0 0 24 24" className={styles.noSelectionIcon}>
                    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>Selecione um jogador da lista para associar um email</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLinkPlayers;
