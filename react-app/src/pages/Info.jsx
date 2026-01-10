import { useEffect, useState } from 'react';
import apiService from '../services/api';
import TopNavBar from '../components/TopNavBar';
import styles from './Info.module.css';

function Info() {
  const [content, setContent] = useState({
    paragraph1: 'E com este objectivo em mente que nasce a Liga BT4500, uma prova piloto realizada com o apoio da Federacao Portuguesa de Tenis que pretende marcar um passo importante na evolucao do Tenis de Praia em Portugal.',
    paragraph2: 'Acreditamos que a colaboracao da comunidade e fundamental para o sucesso desta nova etapa, pelo que convidamos todos os entusiastas, atletas e interessados a participar ativamente, oferecendo sugestoes e ideias para aperfeicoar o formato e as regras da competicao.'
  });

  useEffect(() => {
    apiService.getInfo()
      .then(data => {
        if (data) setContent(data);
      })
      .catch(err => console.error('Error fetching info:', err));
  }, []);

  return (
    <div className={styles.container}>
      <TopNavBar title="LIGA BT4500" showBack={true} backTo="/" />

      <div className={styles.content}>
        <div className={styles.infoCard}>
          <div className={styles.cardHeader}>
            <div className={styles.headerIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4M12 8h.01"/>
              </svg>
            </div>
            <h2 className={styles.cardTitle}>Sobre a Liga</h2>
          </div>

          <div className={styles.cardContent}>
            <p className={styles.paragraph}>{content.paragraph1}</p>
            <p className={styles.paragraph}>{content.paragraph2}</p>
          </div>

          <div className={styles.cardFooter}>
            <a
              href="/regulamento.pdf"
              className={styles.regulamentoButton}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.buttonIcon}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              VER REGULAMENTO
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Info;
