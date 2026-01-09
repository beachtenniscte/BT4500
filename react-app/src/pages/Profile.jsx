import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import apiService from '../services/api';
import styles from './Profile.module.css';

function Profile() {
  const [profile, setProfile] = useState({
    name: 'João Silva',
    age: 28,
    category: 'BT 4500',
    city: 'Espinho',
    ranking: 12,
    photo: '/images/default-avatar.png',
    competitions: [
      { id: 1, name: 'PRATA 10-11 MAI', year: 2025, position: 3, points: 250 },
      { id: 2, name: 'BRONZE 21-22 JUN', year: 2024, position: 1, points: 400 },
      { id: 3, name: 'OURO 15-17 AGO', year: 2024, position: 5, points: 180 },
      { id: 4, name: 'PRATA 20-21 SET', year: 2023, position: 2, points: 320 }
    ],
    stats: {
      totalCompetitions: 24,
      wins: 8,
      podiums: 15,
      totalPoints: 3240
    }
  });

  useEffect(() => {
    // Fetch profile data from API when available
    apiService.getProfile()
      .then(data => {
        if (data) setProfile(data);
      })
      .catch(err => console.error('Error fetching profile:', err));
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.innerPage}>
        <Link to="/" className={styles.backButton}>
          <span>&lt;&lt;</span>
        </Link>

        <h1 className={styles.pageTitle}>PERFIL DO ATLETA</h1>

        <div className={styles.profileCard}>
          {/* Profile Header with Photo */}
          <div className={styles.profileHeader}>
            <div className={styles.photoSection}>
              <div className={styles.photoFrame}>
                <img
                  src={profile.photo}
                  alt={profile.name}
                  className={styles.profilePhoto}
                  onError={(e) => {
                    e.target.src = '/images/default-avatar.png';
                  }}
                />
              </div>
              <div className={styles.rankingBadge}>
                <span className={styles.rankingLabel}>RANKING</span>
                <span className={styles.rankingNumber}>#{profile.ranking}</span>
              </div>
            </div>

            <div className={styles.basicInfo}>
              <h2 className={styles.playerName}>{profile.name}</h2>
              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>IDADE</span>
                  <span className={styles.infoValue}>{profile.age} anos</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CATEGORIA</span>
                  <span className={styles.infoValue}>{profile.category}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>CIDADE</span>
                  <span className={styles.infoValue}>{profile.city}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics Section */}
          <div className={styles.statsSection}>
            <h3 className={styles.sectionTitle}>ESTATÍSTICAS</h3>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{profile.stats.totalCompetitions}</span>
                <span className={styles.statLabel}>Competições</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{profile.stats.wins}</span>
                <span className={styles.statLabel}>Vitórias</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{profile.stats.podiums}</span>
                <span className={styles.statLabel}>Pódios</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statNumber}>{profile.stats.totalPoints}</span>
                <span className={styles.statLabel}>Pontos</span>
              </div>
            </div>
          </div>

          {/* Competition History */}
          <div className={styles.historySection}>
            <h3 className={styles.sectionTitle}>HISTÓRICO DE COMPETIÇÕES</h3>
            <div className={styles.competitionsList}>
              {profile.competitions.map((comp) => (
                <div key={comp.id} className={styles.competitionCard}>
                  <div className={styles.compHeader}>
                    <span className={styles.compName}>{comp.name}</span>
                    <span className={styles.compYear}>{comp.year}</span>
                  </div>
                  <div className={styles.compDetails}>
                    <div className={styles.positionBadge}>
                      <span className={styles.positionLabel}>Posição</span>
                      <span className={styles.positionNumber}>{comp.position}º</span>
                    </div>
                    <div className={styles.pointsBadge}>
                      <span className={styles.pointsValue}>{comp.points}</span>
                      <span className={styles.pointsLabel}>pontos</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
