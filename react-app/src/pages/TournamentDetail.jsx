import { Link, useParams } from 'react-router-dom';
import { useState, useMemo, useCallback } from 'react';
import apiService from '../services/api';
import { useTournamentData, useModal } from '../hooks';
import { TrophyIcon, CalendarIcon, LocationIcon, CloseIcon } from '../components/icons';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import { formatDateRange, getCategoryLabel, getTierClass, getGenderFromCategory, DEFAULT_AVATAR, getTournamentStatusLabel } from '../utils';
import styles from './TournamentDetail.module.css';

function TournamentDetail() {
  const { uuid } = useParams();

  // Use custom hooks for data and modal management
  const {
    tournament,
    categories,
    loading,
    error,
    getWinnerForCategory,
    getRunnerUpForCategory
  } = useTournamentData(uuid);

  const modal = useModal();

  // Modal-specific state
  const [modalMatches, setModalMatches] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Registration level expansion state
  const [expandedLevel, setExpandedLevel] = useState(null);

  // Memoize category groupings for registration section
  const { level1Cats, level2Cats, hasLevel1Open, hasLevel2Open, hasAnyRegistration } = useMemo(() => {
    const level1 = categories.filter(c => c.code?.endsWith('1'));
    const level2 = categories.filter(c => c.code?.endsWith('2'));

    const checkOpen = (cats) => cats.some(c =>
      (c.registration_type === 'form' && c.registration_open) ||
      (c.registration_type === 'external' && c.registration_url)
    );

    return {
      level1Cats: level1,
      level2Cats: level2,
      hasLevel1Open: checkOpen(level1),
      hasLevel2Open: checkOpen(level2),
      hasAnyRegistration: checkOpen([...level1, ...level2])
    };
  }, [categories]);

  const openCategoryModal = useCallback(async (categoryCode) => {
    if (modal.isOpen && modal.data === categoryCode) return;

    modal.open(categoryCode);
    setModalLoading(true);

    try {
      const data = await apiService.getTournamentMatchesByRound(uuid, categoryCode);

      // Deduplicate rounds
      const deduplicatedRounds = [];
      const seenRounds = new Set();

      for (const roundGroup of (data || [])) {
        if (!seenRounds.has(roundGroup.round)) {
          seenRounds.add(roundGroup.round);
          const seenMatchIds = new Set();
          const uniqueMatches = roundGroup.matches.filter(m => {
            if (seenMatchIds.has(m.id)) return false;
            seenMatchIds.add(m.id);
            return true;
          });
          deduplicatedRounds.push({ ...roundGroup, matches: uniqueMatches });
        }
      }

      setModalMatches(deduplicatedRounds);
    } catch (err) {
      console.error('Error loading matches:', err);
      setModalMatches([]);
    } finally {
      setModalLoading(false);
    }
  }, [modal, uuid]);

  const handleCloseModal = useCallback(() => {
    modal.close();
    setModalMatches([]);
  }, [modal]);

  const toggleLevel = useCallback((level) => {
    setExpandedLevel(prev => prev === level ? null : level);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>
          <LoadingSpinner message="A carregar torneio..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tournament) {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>
          <ErrorState
            title="Erro"
            message={error || 'Torneio nao encontrado'}
            linkTo="/provas"
            linkText="Voltar as Provas"
          />
        </div>
      </div>
    );
  }

  // "Open" — announced but registrations not yet available
  if (tournament.status === 'scheduled') {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>

          <TournamentHero tournament={tournament} />

          <div className={styles.registrationSection}>
            <h2 className={styles.sectionTitle}>Em Breve</h2>
            <div className={styles.registrationCard}>
              <p className={styles.registrationText}>
                As inscricoes para este torneio estarao brevemente disponiveis.
              </p>
              {categories.length > 0 && (
                <div className={styles.categoriesPreview}>
                  <span className={styles.categoriesLabel}>Categorias:</span>
                  {categories.map(cat => (
                    <span key={cat.code} className={styles.categoryTag}>{cat.code}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // "Open for registrations" — show the registration form/links
  if (tournament.status === 'open_registration') {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>

          <TournamentHero tournament={tournament} />

          <div className={styles.registrationSection}>
            <h2 className={styles.sectionTitle}>Inscricoes</h2>

            {!hasAnyRegistration ? (
              <div className={styles.registrationCard}>
                <p className={styles.registrationText}>
                  As inscricoes para este torneio estarao disponiveis em breve.
                </p>
                {categories.length > 0 && (
                  <div className={styles.categoriesPreview}>
                    <span className={styles.categoriesLabel}>Categorias:</span>
                    {categories.map(cat => (
                      <span key={cat.code} className={styles.categoryTag}>{cat.code}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className={styles.registrationLevels}>
                {level1Cats.length > 0 && (
                  <LevelAccordion
                    level={1}
                    title="Nivel 1"
                    subtitle="Competitivo"
                    categories={level1Cats}
                    isExpanded={expandedLevel === 1}
                    hasOpenRegistration={hasLevel1Open}
                    onToggle={() => toggleLevel(1)}
                    tournamentUuid={uuid}
                  />
                )}

                {level2Cats.length > 0 && (
                  <LevelAccordion
                    level={2}
                    title="Nivel 2"
                    subtitle="Lazer"
                    categories={level2Cats}
                    isExpanded={expandedLevel === 2}
                    hasOpenRegistration={hasLevel2Open}
                    onToggle={() => toggleLevel(2)}
                    tournamentUuid={uuid}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // "In progress" — placeholder, no winners yet
  if (tournament.status === 'in_progress') {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>

          <TournamentHero tournament={tournament} />

          <div className={styles.registrationSection}>
            <h2 className={styles.sectionTitle}>Torneio em Progresso</h2>
            <div className={styles.registrationCard}>
              <p className={styles.registrationText}>
                O torneio esta a decorrer. Os vencedores serao publicados quando terminar.
              </p>
              {categories.length > 0 && (
                <div className={styles.categoriesPreview}>
                  <span className={styles.categoriesLabel}>Categorias:</span>
                  {categories.map(cat => (
                    <span key={cat.code} className={styles.categoryTag}>{cat.code}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // "Cancelled" — short notice
  if (tournament.status === 'cancelled') {
    return (
      <div className={styles.container}>
        <div className={styles.innerPage}>
          <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
            <span>←</span> Voltar
          </Link>

          <TournamentHero tournament={tournament} />

          <div className={styles.registrationSection}>
            <div className={styles.registrationCard}>
              <p className={styles.registrationText}>
                Torneio cancelado.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // "Closed" / completed — show winners + finalists
  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/provas" className={styles.backButton} aria-label="Voltar as provas">
          <span>←</span> Voltar
        </Link>

        {/* Hero Section */}
        <TournamentHero tournament={tournament} />

        {/* Winners by Category */}
        <div className={styles.winnersSection}>
          <h2 className={styles.sectionTitle}>
            <TrophyIcon /> Vencedores por Categoria
          </h2>
          <p className={styles.sectionSubtitle}>
            Clique numa categoria para ver todos os resultados
          </p>

          <div className={styles.categoryGrid}>
            {categories.map(cat => (
              <CategoryCard
                key={cat.code}
                category={cat}
                winner={getWinnerForCategory(cat.code)}
                runnerUp={getRunnerUpForCategory(cat.code)}
                onClick={() => openCategoryModal(cat.code)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Results Modal */}
      {modal.isOpen && (
        <ResultsModal
          categoryCode={modal.data}
          matches={modalMatches}
          loading={modalLoading}
          onClose={handleCloseModal}
          modalRef={modal.modalRef}
          overlayProps={modal.overlayProps}
        />
      )}
    </div>
  );
}

// ============ Sub-Components ============

function TournamentHero({ tournament }) {
  return (
    <div className={styles.heroSection}>
      <span className={`${styles.tierBadge} ${getTierClass(tournament.tier, styles)}`}>
        {tournament.tier}
      </span>
      <h1 className={styles.heroTitle}>{tournament.name}</h1>
      <div className={styles.heroMeta}>
        <span className={styles.metaItem}>
          <CalendarIcon />
          {formatDateRange(tournament.start_date, tournament.end_date)}
        </span>
        <span className={styles.metaItem}>
          <LocationIcon />
          {tournament.location}
        </span>
      </div>
      <div className={styles.statusBadge} data-status={tournament.status}>
        {getTournamentStatusLabel(tournament.status)}
      </div>
    </div>
  );
}

function LevelAccordion({
  level,
  title,
  subtitle,
  categories,
  isExpanded,
  hasOpenRegistration,
  onToggle,
  tournamentUuid
}) {
  const panelId = `level-${level}-panel`;
  const buttonId = `level-${level}-button`;

  return (
    <div className={styles.levelGroup}>
      <button
        id={buttonId}
        className={`${styles.levelHeader} ${isExpanded ? styles.levelHeaderExpanded : ''} ${!hasOpenRegistration ? styles.levelHeaderClosed : ''}`}
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <div className={styles.levelInfo}>
          <span className={styles.levelTitle}>{title}</span>
          <span className={styles.levelSubtitle}>{subtitle}</span>
        </div>
        <span className={styles.levelChevron} aria-hidden="true">
          {isExpanded ? '−' : '+'}
        </span>
      </button>

      {isExpanded && (
        <div
          id={panelId}
          className={styles.levelContent}
          role="region"
          aria-labelledby={buttonId}
        >
          {categories.map(cat => (
            <CategoryRegistrationItem
              key={cat.code}
              category={cat}
              tournamentUuid={tournamentUuid}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRegistrationItem({ category, tournamentUuid }) {
  const hasFormReg = category.registration_type === 'form' && category.registration_open;
  const hasExternalReg = category.registration_type === 'external' && category.registration_url;
  const genderLabel = getGenderFromCategory(category.code);

  if (!hasFormReg && !hasExternalReg) {
    return (
      <div className={styles.regSubItem}>
        <span className={styles.regGender}>{genderLabel}</span>
        <span className={styles.regClosed}>Em breve</span>
      </div>
    );
  }

  if (hasFormReg) {
    return (
      <Link
        to={`/tournament/${tournamentUuid}/register?category=${category.code}`}
        className={styles.regSubItem}
      >
        <span className={styles.regGender}>{genderLabel}</span>
        <span className={styles.regAction}>Inscrever →</span>
      </Link>
    );
  }

  return (
    <a
      href={category.registration_url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.regSubItem}
    >
      <span className={styles.regGender}>{genderLabel}</span>
      <span className={styles.regActionExternal}>TieTennis ↗</span>
    </a>
  );
}

function CategoryCard({ category, winner, runnerUp, onClick }) {
  return (
    <button
      className={styles.categoryCard}
      onClick={onClick}
      aria-label={`Ver resultados de ${getCategoryLabel(category.code)}`}
    >
      <div className={styles.categoryHeader}>
        <span className={styles.categoryCode}>{category.code}</span>
        <span className={styles.categoryName}>{getCategoryLabel(category.code)}</span>
      </div>

      {winner ? (
        <div className={styles.winnerDisplay}>
          <div className={styles.winnerPhotos}>
            <img
              src={winner.player1_photo || DEFAULT_AVATAR}
              alt={winner.player1_name}
              loading="lazy"
              width="48"
              height="48"
              onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
            />
            <img
              src={winner.player2_photo || DEFAULT_AVATAR}
              alt={winner.player2_name}
              loading="lazy"
              width="48"
              height="48"
              onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
            />
          </div>
          <div className={styles.winnerInfo}>
            <span className={styles.winnerLabel}>
              <TrophyIcon size={14} /> Vencedor
            </span>
            <span className={styles.winnerNames}>
              {winner.player1_name?.split(' ')[0]} & {winner.player2_name?.split(' ')[0]}
            </span>
          </div>
        </div>
      ) : (
        <div className={styles.noWinner}>
          <span>Sem resultados</span>
        </div>
      )}

      {runnerUp && (
        <div className={styles.runnerUpLine}>
          <span className={styles.runnerUpLabel}>Finalista</span>
          <span className={styles.runnerUpSeparator}>·</span>
          <span className={styles.runnerUpNames}>
            {runnerUp.player1_name?.split(' ')[0]} & {runnerUp.player2_name?.split(' ')[0]}
          </span>
        </div>
      )}

      <div className={styles.viewResults}>
        Ver resultados →
      </div>
    </button>
  );
}

function ResultsModal({ categoryCode, matches, loading, onClose, modalRef, overlayProps }) {
  return (
    <div
      className={styles.modalOverlay}
      {...overlayProps}
    >
      <div
        ref={modalRef}
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 id="modal-title" className={styles.modalTitle}>
              {categoryCode}
            </h2>
            <p className={styles.modalSubtitle}>{getCategoryLabel(categoryCode)}</p>
          </div>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <CloseIcon />
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.modalLoading}>
              <div className={styles.spinner}></div>
              <span>A carregar resultados...</span>
            </div>
          ) : matches.length > 0 ? (
            <div className={styles.matchesContainer}>
              {matches.map((roundGroup, roundIndex) => (
                <div key={`${roundGroup.round}-${roundIndex}`} className={styles.roundGroup}>
                  <h3 className={styles.roundTitle}>{roundGroup.round}</h3>
                  <div className={styles.matchesList}>
                    {roundGroup.matches.map((match, matchIndex) => (
                      <MatchCard key={`${match.id}-${matchIndex}`} match={match} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noMatches}>
              <p>Nao ha resultados disponiveis para esta categoria.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ match }) {
  return (
    <div className={styles.matchCard}>
      <div className={`${styles.matchTeam} ${match.winner_team_id === match.team1_id ? styles.matchWinner : ''}`}>
        <span className={styles.teamName}>{match.team1_name || 'TBD'}</span>
        {match.winner_team_id === match.team1_id && (
          <span className={styles.winnerBadge}>
            <TrophyIcon size={16} />
          </span>
        )}
      </div>
      <div className={styles.matchScore}>
        {match.result || 'vs'}
      </div>
      <div className={`${styles.matchTeam} ${match.winner_team_id === match.team2_id ? styles.matchWinner : ''}`}>
        <span className={styles.teamName}>{match.team2_name || 'TBD'}</span>
        {match.winner_team_id === match.team2_id && (
          <span className={styles.winnerBadge}>
            <TrophyIcon size={16} />
          </span>
        )}
      </div>
    </div>
  );
}

export default TournamentDetail;
