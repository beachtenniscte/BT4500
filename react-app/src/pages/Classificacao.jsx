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
    // Fetch classification data from API when available
    apiService.getClassification()
      .then(data => {
        if (data && data.length > 0) setTeams(data);
      })
      .catch(err => console.error('Error fetching classification:', err));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>CLASSIFICAÇÃO</h1>

        <div className={styles.classificationTable}>
          <table>
            <thead>
              <tr>
                <th>Posição</th>
                <th>Equipa</th>
                <th>Pontos</th>
                <th>Jogos</th>
                <th>Vitórias</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.position}>
                  <td>{team.position}</td>
                  <td>{team.team}</td>
                  <td>{team.points}</td>
                  <td>{team.games}</td>
                  <td>{team.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Classificacao;
