import { useEffect, useState, useId } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import apiService from '../services/api';
import TopNavBar from '../components/TopNavBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { PairIcon, IndividualIcon, CheckCircleIcon, AlertIcon } from '../components/icons';
import { formatDate, SKILL_POTS } from '../utils';
import styles from './TournamentRegistration.module.css';

function TournamentRegistration() {
  const { uuid } = useParams();
  const [searchParams] = useSearchParams();
  const [tournament, setTournament] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Generate unique IDs for form accessibility
  const formId = useId();

  // Form state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [signupType, setSignupType] = useState('pair');
  const [formData, setFormData] = useState({
    player1Name: '',
    player1Whatsapp: '',
    player1Email: '',
    player2Name: '',
    player2Whatsapp: '',
    player2Email: '',
    skillPot: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    loadTournamentInfo();
  }, [uuid]);

  const loadTournamentInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getTournamentSignupInfo(uuid);
      if (data) {
        setTournament(data.tournament);
        const formCategories = data.categories.filter(
          cat => cat.registration_type === 'form' && cat.registration_open
        );
        setCategories(formCategories);
        if (formCategories.length > 0) {
          const urlCategory = searchParams.get('category');
          if (urlCategory && formCategories.some(c => c.code === urlCategory)) {
            setSelectedCategory(urlCategory);
          } else {
            setSelectedCategory(formCategories[0].code);
          }
        }
      } else {
        setError('Torneio nao encontrado');
      }
    } catch (err) {
      setError('Erro ao carregar informacoes do torneio');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSubmitError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    if (!formData.player1Name.trim()) {
      setSubmitError('Nome do jogador 1 e obrigatorio');
      return;
    }

    if (signupType === 'pair' && !formData.player2Name.trim()) {
      setSubmitError('Nome do parceiro e obrigatorio para inscricao em par');
      return;
    }

    if (signupType === 'individual' && !formData.skillPot) {
      setSubmitError('Selecione o seu nivel de jogo');
      return;
    }

    if (!formData.player1Whatsapp && !formData.player1Email) {
      setSubmitError('Indique pelo menos um contacto (WhatsApp ou Email)');
      return;
    }

    setSubmitting(true);
    try {
      await apiService.createSignup({
        tournamentUuid: uuid,
        categoryCode: selectedCategory,
        signupType,
        player1Name: formData.player1Name,
        player1Whatsapp: formData.player1Whatsapp,
        player1Email: formData.player1Email,
        player2Name: signupType === 'pair' ? formData.player2Name : null,
        player2Whatsapp: signupType === 'pair' ? formData.player2Whatsapp : null,
        player2Email: signupType === 'pair' ? formData.player2Email : null,
        skillPot: signupType === 'individual' ? formData.skillPot : null,
        notes: formData.notes
      });

      setSubmitSuccess(true);
      setFormData({
        player1Name: '',
        player1Whatsapp: '',
        player1Email: '',
        player2Name: '',
        player2Whatsapp: '',
        player2Email: '',
        skillPot: '',
        notes: ''
      });
    } catch (err) {
      setSubmitError(err.message || 'Erro ao submeter inscricao');
    } finally {
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className={styles.container}>
        <TopNavBar title="INSCRICAO" showBack={true} backTo="/" />
        <div className={styles.content}>
          <LoadingSpinner message="A carregar..." />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !tournament) {
    return (
      <div className={styles.container}>
        <TopNavBar title="INSCRICAO" showBack={true} backTo="/" />
        <div className={styles.content}>
          <div className={styles.errorState} role="alert">
            <span>{error || 'Torneio nao encontrado'}</span>
            <Link to="/" className={styles.backLink}>Voltar ao inicio</Link>
          </div>
        </div>
      </div>
    );
  }

  // No categories available
  if (categories.length === 0) {
    return (
      <div className={styles.container}>
        <TopNavBar title="INSCRICAO" showBack={true} backTo={`/tournament/${uuid}`} />
        <div className={styles.content}>
          <div className={styles.emptyState}>
            <h2>{tournament.name}</h2>
            <p>Inscricoes nao disponiveis para este torneio</p>
            <Link to={`/tournament/${uuid}`} className={styles.backLink}>Ver detalhes do torneio</Link>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (submitSuccess) {
    return (
      <div className={styles.container}>
        <TopNavBar title="INSCRICAO" showBack={true} backTo={`/tournament/${uuid}`} />
        <div className={styles.content}>
          <div className={styles.successState} role="status" aria-live="polite">
            <div className={styles.successIcon}>
              <CheckCircleIcon size={80} />
            </div>
            <h2>Inscricao Realizada!</h2>
            <p>A sua inscricao foi registada com sucesso.</p>
            <p className={styles.successNote}>Recebera confirmacao em breve.</p>
            <div className={styles.successActions}>
              <button
                onClick={() => setSubmitSuccess(false)}
                className={styles.newSignupButton}
              >
                Nova Inscricao
              </button>
              <Link to={`/tournament/${uuid}`} className={styles.viewTournamentLink}>
                Ver Torneio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const errorId = `${formId}-error`;

  return (
    <div className={styles.container}>
      <TopNavBar title="INSCRICAO" showBack={true} backTo={`/tournament/${uuid}`} />

      <div className={styles.content}>
        {/* Tournament Header */}
        <div className={styles.tournamentHeader}>
          <span className={`${styles.tierBadge} ${styles[tournament.tier?.toLowerCase()]}`}>
            {tournament.tier}
          </span>
          <h1 className={styles.tournamentName}>{tournament.name}</h1>
          <p className={styles.tournamentInfo}>
            {tournament.location} | {formatDate(tournament.start_date, { day: 'numeric', month: 'short' })} - {formatDate(tournament.end_date, { day: 'numeric', month: 'short' })}
          </p>
        </div>

        {/* Registration Form */}
        <form
          onSubmit={handleSubmit}
          className={styles.formCard}
          aria-describedby={submitError ? errorId : undefined}
          noValidate
        >
          {/* Required fields notice */}
          <p className={styles.requiredNotice}>
            <span aria-hidden="true">*</span> Campos obrigatorios
          </p>

          {/* Category Selection */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionLabel}>Categoria *</legend>
            <div className={styles.categorySelector} role="radiogroup">
              {categories.map(cat => (
                <button
                  key={cat.code}
                  type="button"
                  role="radio"
                  aria-checked={selectedCategory === cat.code}
                  onClick={() => setSelectedCategory(cat.code)}
                  className={`${styles.categoryButton} ${selectedCategory === cat.code ? styles.categoryButtonActive : ''}`}
                >
                  <span className={styles.catCode}>{cat.code}</span>
                  <span className={styles.catName}>{cat.name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Signup Type */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionLabel}>Tipo de Inscricao *</legend>
            <div className={styles.signupTypeSelector} role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={signupType === 'pair'}
                onClick={() => setSignupType('pair')}
                className={`${styles.typeButton} ${signupType === 'pair' ? styles.typeButtonActive : ''}`}
              >
                <PairIcon className={styles.typeIcon} />
                <span>Em Par</span>
                <small>Ja tenho parceiro/a</small>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={signupType === 'individual'}
                onClick={() => setSignupType('individual')}
                className={`${styles.typeButton} ${signupType === 'individual' ? styles.typeButtonActive : ''}`}
              >
                <IndividualIcon className={styles.typeIcon} />
                <span>Individual</span>
                <small>Procuro parceiro/a</small>
              </button>
            </div>
          </fieldset>

          {/* Player 1 Info */}
          <fieldset className={styles.formSection}>
            <legend className={styles.sectionLabel}>
              {signupType === 'pair' ? 'Jogador 1' : 'Os Seus Dados'}
            </legend>
            <div className={styles.inputGroup}>
              <div className={styles.inputWrapper}>
                <label htmlFor={`${formId}-p1-name`} className={styles.visuallyHidden}>
                  Nome completo
                </label>
                <input
                  id={`${formId}-p1-name`}
                  type="text"
                  value={formData.player1Name}
                  onChange={(e) => handleInputChange('player1Name', e.target.value)}
                  placeholder="Nome completo *"
                  className={styles.input}
                  aria-required="true"
                  autoComplete="name"
                />
              </div>
              <div className={styles.inputWrapper}>
                <label htmlFor={`${formId}-p1-whatsapp`} className={styles.visuallyHidden}>
                  WhatsApp
                </label>
                <input
                  id={`${formId}-p1-whatsapp`}
                  type="tel"
                  value={formData.player1Whatsapp}
                  onChange={(e) => handleInputChange('player1Whatsapp', e.target.value)}
                  placeholder="WhatsApp (ex: 912345678)"
                  className={styles.input}
                  autoComplete="tel"
                />
              </div>
              <div className={styles.inputWrapper}>
                <label htmlFor={`${formId}-p1-email`} className={styles.visuallyHidden}>
                  Email
                </label>
                <input
                  id={`${formId}-p1-email`}
                  type="email"
                  value={formData.player1Email}
                  onChange={(e) => handleInputChange('player1Email', e.target.value)}
                  placeholder="Email"
                  className={styles.input}
                  autoComplete="email"
                />
              </div>
            </div>
            <p className={styles.inputHint}>
              Indique pelo menos um contacto (WhatsApp ou Email)
            </p>
          </fieldset>

          {/* Player 2 Info (for pairs) */}
          {signupType === 'pair' && (
            <fieldset className={styles.formSection}>
              <legend className={styles.sectionLabel}>Jogador 2 (Parceiro/a)</legend>
              <div className={styles.inputGroup}>
                <div className={styles.inputWrapper}>
                  <label htmlFor={`${formId}-p2-name`} className={styles.visuallyHidden}>
                    Nome completo do parceiro
                  </label>
                  <input
                    id={`${formId}-p2-name`}
                    type="text"
                    value={formData.player2Name}
                    onChange={(e) => handleInputChange('player2Name', e.target.value)}
                    placeholder="Nome completo *"
                    className={styles.input}
                    aria-required="true"
                    autoComplete="off"
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <label htmlFor={`${formId}-p2-whatsapp`} className={styles.visuallyHidden}>
                    WhatsApp do parceiro
                  </label>
                  <input
                    id={`${formId}-p2-whatsapp`}
                    type="tel"
                    value={formData.player2Whatsapp}
                    onChange={(e) => handleInputChange('player2Whatsapp', e.target.value)}
                    placeholder="WhatsApp (ex: 912345678)"
                    className={styles.input}
                    autoComplete="off"
                  />
                </div>
                <div className={styles.inputWrapper}>
                  <label htmlFor={`${formId}-p2-email`} className={styles.visuallyHidden}>
                    Email do parceiro
                  </label>
                  <input
                    id={`${formId}-p2-email`}
                    type="email"
                    value={formData.player2Email}
                    onChange={(e) => handleInputChange('player2Email', e.target.value)}
                    placeholder="Email"
                    className={styles.input}
                    autoComplete="off"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {/* Skill Pot (for individuals) */}
          {signupType === 'individual' && (
            <fieldset className={styles.formSection}>
              <legend className={styles.sectionLabel}>Nivel de Jogo *</legend>
              <p className={styles.sectionHint} id={`${formId}-pot-hint`}>
                Selecione o seu nivel para ajudar a encontrar um parceiro adequado
              </p>
              <div
                className={styles.potSelector}
                role="radiogroup"
                aria-describedby={`${formId}-pot-hint`}
              >
                {SKILL_POTS.map(pot => (
                  <button
                    key={pot.value}
                    type="button"
                    role="radio"
                    aria-checked={formData.skillPot === pot.value}
                    onClick={() => handleInputChange('skillPot', pot.value)}
                    className={`${styles.potButton} ${formData.skillPot === pot.value ? styles.potButtonActive : ''}`}
                  >
                    <span className={styles.potLabel}>{pot.label}</span>
                    <span className={styles.potDesc}>{pot.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Notes */}
          <div className={styles.formSection}>
            <label htmlFor={`${formId}-notes`} className={styles.sectionLabel}>
              Observacoes (opcional)
            </label>
            <textarea
              id={`${formId}-notes`}
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Informacoes adicionais..."
              className={styles.textarea}
              rows={3}
            />
          </div>

          {/* Error Message */}
          {submitError && (
            <div
              id={errorId}
              className={styles.errorMessage}
              role="alert"
              aria-live="assertive"
            >
              <AlertIcon className={styles.errorIcon} />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className={styles.submitButton}
            aria-busy={submitting}
          >
            {submitting ? 'A submeter...' : 'Confirmar Inscricao'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default TournamentRegistration;
