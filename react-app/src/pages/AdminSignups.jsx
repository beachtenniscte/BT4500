import { Link, useParams } from 'react-router-dom';
import { useState, useEffect, useId } from 'react';
import apiService from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { TrashIcon } from '../components/icons';
import { formatDateCompact, getStatusColor, getStatusLabel } from '../utils';
import styles from './AdminSignups.module.css';

function AdminSignups() {
  const { uuid } = useParams();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState(null);
  const [signups, setSignups] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [error, setError] = useState(null);

  // Generate unique IDs for accessibility
  const filterId = useId();

  useEffect(() => {
    checkAdminAndLoadData();
  }, [uuid]);

  const checkAdminAndLoadData = async () => {
    try {
      const adminCheck = await apiService.isAdmin();
      setIsAdmin(adminCheck);

      if (adminCheck) {
        await loadSignups();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSignups = async () => {
    try {
      const data = await apiService.getAdminTournamentSignups(uuid);
      if (data) {
        setTournament(data.tournament);
        setSignups(data.data || []);
      }
    } catch (err) {
      console.error('Error loading signups:', err);
      setError('Erro ao carregar inscricoes');
    }
  };

  const handleStatusChange = async (signupUuid, newStatus) => {
    try {
      await apiService.updateSignupStatus(signupUuid, newStatus);
      await loadSignups();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDelete = async (signupUuid) => {
    if (!window.confirm('Tem a certeza que deseja eliminar esta inscricao?')) {
      return;
    }

    try {
      await apiService.deleteSignup(signupUuid);
      await loadSignups();
    } catch (err) {
      console.error('Error deleting signup:', err);
    }
  };

  // Get unique categories from signups
  const categories = [...new Set(signups.map(s => s.category_code))].sort();

  // Filter signups
  const filteredSignups = signups.filter(s => {
    if (selectedCategory !== 'all' && s.category_code !== selectedCategory) return false;
    if (selectedStatus !== 'all' && s.status !== selectedStatus) return false;
    return true;
  });

  // Group signups by category
  const signupsByCategory = {};
  for (const signup of filteredSignups) {
    const cat = signup.category_code;
    if (!signupsByCategory[cat]) {
      signupsByCategory[cat] = { pairs: [], individuals: [] };
    }
    if (signup.signup_type === 'pair') {
      signupsByCategory[cat].pairs.push(signup);
    } else {
      signupsByCategory[cat].individuals.push(signup);
    }
  }

  // Stats
  const totalSignups = signups.length;
  const pairSignups = signups.filter(s => s.signup_type === 'pair').length;
  const individualSignups = signups.filter(s => s.signup_type === 'individual').length;
  const confirmedSignups = signups.filter(s => s.status === 'confirmed').length;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span aria-hidden="true">&lt;&lt;</span>
            <span className={styles.visuallyHidden}>Voltar</span>
          </Link>
          <LoadingSpinner message="A carregar..." />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/" className={styles.backButton}>
            <span aria-hidden="true">&lt;&lt;</span>
            <span className={styles.visuallyHidden}>Voltar</span>
          </Link>
          <h1 className={styles.pageTitle}>ACESSO NEGADO</h1>
          <div className={styles.errorCard} role="alert">
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
        <Link to={`/tournament/${uuid}`} className={styles.backButton}>
          <span aria-hidden="true">&lt;&lt;</span>
          <span className={styles.visuallyHidden}>Voltar ao torneio</span>
        </Link>

        <h1 className={styles.pageTitle}>INSCRICOES</h1>

        {tournament && (
          <div className={styles.tournamentInfo}>
            <span className={styles.tournamentName}>{tournament.name}</span>
          </div>
        )}

        {/* Stats */}
        <div className={styles.statsBar} role="region" aria-label="Estatisticas de inscricoes">
          <div className={styles.statItem}>
            <span className={styles.statValue}>{totalSignups}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{pairSignups}</span>
            <span className={styles.statLabel}>Pares</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{individualSignups}</span>
            <span className={styles.statLabel}>Individuais</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{confirmedSignups}</span>
            <span className={styles.statLabel}>Confirmados</span>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersBar} role="search" aria-label="Filtros">
          <div className={styles.filterGroup}>
            <label htmlFor={`${filterId}-category`} className={styles.filterLabel}>
              Categoria
            </label>
            <select
              id={`${filterId}-category`}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Todas categorias</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor={`${filterId}-status`} className={styles.filterLabel}>
              Estado
            </label>
            <select
              id={`${filterId}-status`}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">Todos estados</option>
              <option value="pending">Pendente</option>
              <option value="confirmed">Confirmado</option>
              <option value="waitlist">Lista espera</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        {/* Signups List */}
        <main className={styles.mainCard}>
          {filteredSignups.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Sem inscricoes para mostrar</p>
            </div>
          ) : (
            Object.entries(signupsByCategory).map(([category, { pairs, individuals }]) => (
              <section key={category} className={styles.categorySection} aria-labelledby={`cat-${category}`}>
                <div className={styles.categoryHeader}>
                  <h2 id={`cat-${category}`} className={styles.categoryCode}>{category}</h2>
                  <span className={styles.categoryCount}>
                    {pairs.length + individuals.length} inscricoes
                  </span>
                </div>

                {/* Pairs */}
                {pairs.length > 0 && (
                  <div className={styles.signupGroup}>
                    <h3 className={styles.groupTitle}>Pares ({pairs.length})</h3>
                    <div className={styles.signupsList}>
                      {pairs.map(signup => (
                        <SignupCard
                          key={signup.uuid}
                          signup={signup}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Individuals */}
                {individuals.length > 0 && (
                  <div className={styles.signupGroup}>
                    <h3 className={styles.groupTitle}>Individuais ({individuals.length})</h3>
                    <div className={styles.signupsList}>
                      {individuals.map(signup => (
                        <SignupCard
                          key={signup.uuid}
                          signup={signup}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ))
          )}
        </main>
      </div>
    </div>
  );
}

// Signup Card Component
function SignupCard({ signup, onStatusChange, onDelete }) {
  const selectId = useId();

  return (
    <article className={styles.signupCard}>
      <div className={styles.signupMain}>
        <div className={styles.playerInfo}>
          <span className={styles.playerName}>{signup.player1_name}</span>
          {signup.player1_whatsapp && (
            <a
              href={`https://wa.me/351${signup.player1_whatsapp}`}
              className={styles.contactLink}
              aria-label={`Contactar ${signup.player1_name} por WhatsApp`}
            >
              {signup.player1_whatsapp}
            </a>
          )}
          {signup.player1_email && (
            <span className={styles.email}>{signup.player1_email}</span>
          )}
        </div>

        {signup.signup_type === 'pair' && signup.player2_name && (
          <div className={styles.playerInfo}>
            <span className={styles.partnerLabel} aria-hidden="true">+</span>
            <span className={styles.playerName}>{signup.player2_name}</span>
            {signup.player2_whatsapp && (
              <a
                href={`https://wa.me/351${signup.player2_whatsapp}`}
                className={styles.contactLink}
                aria-label={`Contactar ${signup.player2_name} por WhatsApp`}
              >
                {signup.player2_whatsapp}
              </a>
            )}
          </div>
        )}

        {signup.signup_type === 'individual' && signup.skill_pot && (
          <span className={styles.potBadge}>{signup.skill_pot.toUpperCase()}</span>
        )}
      </div>

      <div className={styles.signupMeta}>
        <span
          className={styles.statusBadge}
          style={{ backgroundColor: getStatusColor(signup.status) }}
        >
          {getStatusLabel(signup.status)}
        </span>
        <span className={styles.signupDate}>
          {formatDateCompact(signup.created_at)}
        </span>
      </div>

      <div className={styles.signupActions}>
        <label htmlFor={selectId} className={styles.visuallyHidden}>
          Alterar estado da inscricao de {signup.player1_name}
        </label>
        <select
          id={selectId}
          value={signup.status}
          onChange={(e) => onStatusChange(signup.uuid, e.target.value)}
          className={styles.statusSelect}
        >
          <option value="pending">Pendente</option>
          <option value="confirmed">Confirmado</option>
          <option value="waitlist">Lista Espera</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <button
          onClick={() => onDelete(signup.uuid)}
          className={styles.deleteButton}
          aria-label={`Eliminar inscricao de ${signup.player1_name}`}
        >
          <TrashIcon size={18} />
        </button>
      </div>

      {signup.notes && (
        <div className={styles.signupNotes}>
          <span className={styles.notesLabel}>Notas:</span> {signup.notes}
        </div>
      )}
    </article>
  );
}

export default AdminSignups;
