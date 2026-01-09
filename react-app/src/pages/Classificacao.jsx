import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import apiService from '../services/api';
import styles from './PageLayout.module.css';

function Classificacao() {
  const [teams, setTeams] = useState([
    { position: 1, team: 'Equipa A', points: 150, games: 10, wins: 8 },
    { position: 2, team: 'Equipa B', points: 140, games: 10, wins: 7 },
    { position: 3, team: 'Equipa C', points: 130, games: 10, wins: 6 },
    { position: 4, team: 'Equipa D', points: 120, games: 10, wins: 5 },
    { position: 5, team: 'Equipa E', points: 110, games: 10, wins: 4 }
  ]);

  useEffect(() => {
    apiService.getClassification()
      .then(data => {
        if (data && data.length > 0) setTeams(data);
      })
      .catch(err => console.error('Error fetching classification:', err));
  }, []);

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

  return (
    <div className={styles.container}>
      <Link to="/profile" className={styles.profileButton}>
        <svg viewBox="0 0 24 24" className={styles.profileIcon}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          <path d="M6.5 18.5C7.5 16.5 9.5 15 12 15C14.5 15 16.5 16.5 17.5 18.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      </Link>

      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>CLASSIFICACAO</h1>

        <div className={styles.classificationTable}>
          <div className={styles.tableHeader}>
            <h2 className={styles.tableTitle}>Ranking Geral</h2>
          </div>
          <div className={styles.tableContent}>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Equipa</th>
                  <th>Pontos</th>
                  <th>Jogos</th>
                  <th>Vitorias</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.position}>
                    <td>
                      <div className={styles.positionCell}>
                        <span className={`${styles.positionBadge} ${getPositionBadgeClass(team.position)}`}>
                          {team.position}
                        </span>
                      </div>
                    </td>
                    <td><strong>{team.team}</strong></td>
                    <td><strong style={{ color: '#774494' }}>{team.points}</strong></td>
                    <td>{team.games}</td>
                    <td>{team.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Classificacao;
