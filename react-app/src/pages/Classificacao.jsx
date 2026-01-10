import { useEffect, useState } from 'react';
import apiService from '../services/api';
import TopNavBar from '../components/TopNavBar';
import styles from './Classificacao.module.css';

function Classificacao() {
  const [maleRankings, setMaleRankings] = useState([]);
  const [femaleRankings, setFemaleRankings] = useState([]);
  const [mixedRankings, setMixedRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [expandedData, setExpandedData] = useState([]);
  const [loadingExpanded, setLoadingExpanded] = useState(false);

  useEffect(() => {
    loadPreviewData();
  }, []);

  const loadPreviewData = async () => {
    setLoading(true);
    try {
      // Load preview data for all three categories (top 3 each)
      const [maleData, femaleData, mixedData] = await Promise.all([
        apiService.getClassification('M', 3),
        apiService.getClassification('F', 3),
        apiService.getClassification(null, 3) // Mixed/All
      ]);

      setMaleRankings(maleData || []);
      setFemaleRankings(femaleData || []);
      setMixedRankings(mixedData || []);
    } catch (err) {
      console.error('Error fetching classification:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = async (category) => {
    setExpandedCategory(category);
    setLoadingExpanded(true);

    try {
      let data;
      switch (category) {
        case 'male':
          data = await apiService.getClassification('M', 50);
          break;
        case 'female':
          data = await apiService.getClassification('F', 50);
          break;
        case 'mixed':
        default:
          data = await apiService.getClassification(null, 50);
          break;
      }
      setExpandedData(data || []);
    } catch (err) {
      console.error('Error fetching expanded data:', err);
      setExpandedData([]);
    } finally {
      setLoadingExpanded(false);
    }
  };

  const handleClose = () => {
    setExpandedCategory(null);
    setExpandedData([]);
  };

  const getPositionBadgeClass = (position) => {
    switch (position) {
      case 1:
        return styles.first;
      case 2:
        return styles.second;
      case 3:
        return styles.third;
      default:
        return '';
    }
  };

  const getCategoryTitle = (category) => {
    switch (category) {
      case 'male':
        return 'Masculino';
      case 'female':
        return 'Feminino';
      case 'mixed':
      default:
        return 'Misto';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'male':
        return '\u2642';
      case 'female':
        return '\u2640';
      case 'mixed':
      default:
        return '\u26A5';
    }
  };

  const renderPreviewCard = (category, data) => (
    <div
      className={`${styles.categoryCard} ${styles[category]}`}
      onClick={() => handleExpand(category)}
    >
      <div className={styles.cardHeader}>
        <div className={styles.headerContent}>
          <div className={styles.genderIcon}>{getCategoryIcon(category)}</div>
          <h3 className={styles.categoryTitle}>{getCategoryTitle(category)}</h3>
        </div>
        <svg viewBox="0 0 24 24" className={styles.expandIcon}>
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className={styles.previewList}>
        {data.length > 0 ? (
          data.map((player) => (
            <div key={player.position} className={styles.previewItem}>
              <div className={styles.previewRank}>
                <span className={`${styles.positionBadge} ${getPositionBadgeClass(player.position)}`}>
                  {player.position}
                </span>
                <span className={styles.playerName}>{player.team}</span>
              </div>
              <span className={styles.playerPoints}>{player.points} pts</span>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <p>Sem dados disponíveis</p>
          </div>
        )}
      </div>

      <div className={styles.viewAllButton}>
        <span>Ver Classificação Completa</span>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );

  const renderExpandedModal = () => {
    if (!expandedCategory) return null;

    return (
      <div className={styles.expandedView} onClick={handleClose}>
        <div
          className={`${styles.expandedCard} ${styles[expandedCategory]}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.expandedHeader}>
            <div className={styles.expandedTitle}>
              <div className={styles.genderIcon}>{getCategoryIcon(expandedCategory)}</div>
              <h2>Ranking {getCategoryTitle(expandedCategory)}</h2>
            </div>
            <button className={styles.closeButton} onClick={handleClose}>
              <svg viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <div className={styles.expandedContent}>
            {loadingExpanded ? (
              <div className={styles.loadingSpinner}>
                <div className={styles.spinner}></div>
                <span>A carregar...</span>
              </div>
            ) : expandedData.length > 0 ? (
              <table className={styles.rankingTable}>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Jogador</th>
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {expandedData.map((player) => (
                    <tr key={player.position}>
                      <td>
                        <div className={styles.positionCell}>
                          <span className={`${styles.positionBadge} ${getPositionBadgeClass(player.position)}`}>
                            {player.position}
                          </span>
                        </div>
                      </td>
                      <td className={styles.playerName}>{player.team}</td>
                      <td className={styles.points}>{player.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <svg className={styles.emptyIcon} viewBox="0 0 24 24">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <path d="M9 9h.01M15 9h.01M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p>Sem dados disponíveis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <TopNavBar title="CLASSIFICAÇÃO" showBack={true} backTo="/" />
        <div className={styles.content}>
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <span>A carregar...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <TopNavBar title="CLASSIFICAÇÃO" showBack={true} backTo="/" />

      <div className={styles.content}>
        <div className={styles.categoriesGrid}>
          {renderPreviewCard('male', maleRankings)}
          {renderPreviewCard('female', femaleRankings)}
          {renderPreviewCard('mixed', mixedRankings)}
        </div>
      </div>

      {renderExpandedModal()}
    </div>
  );
}

export default Classificacao;
