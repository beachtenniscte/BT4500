import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuthRedirect } from '../hooks';
import styles from './Register.module.css';

function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  // Redirect if already authenticated
  useAuthRedirect('/profile');

  const validateForm = () => {
    if (!email) {
      setError('Por favor, insira o seu e-mail.');
      return false;
    }

    if (!password) {
      setError('Por favor, insira uma palavra-passe.');
      return false;
    }

    if (password.length < 6) {
      setError('A palavra-passe deve ter pelo menos 6 caracteres.');
      return false;
    }

    if (password !== confirmPassword) {
      setError('As palavras-passe nao coincidem.');
      return false;
    }

    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiService.register({
        email,
        password,
        whatsapp: whatsapp || undefined
      });
      if (response.token) {
        // Show verification message if email verification is required
        if (response.requiresVerification) {
          setRegistrationComplete(true);
        } else {
          navigate('/profile');
        }
      }
    } catch (err) {
      setError(err.message || 'Erro ao criar conta. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  // Show verification pending message after successful registration
  if (registrationComplete) {
    return (
      <div className={styles.container}>
        <div className={styles.logo}>
          <img
            src="/images/liga-logo.png"
            alt="Liga BT4500"
            className={styles.ligaLogo}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>

        <div className={styles.verificationMessage}>
          <h2 className={styles.verificationTitle}>VERIFICAR E-MAIL</h2>
          <p className={styles.verificationText}>
            Enviamos um e-mail de verificacao para <strong>{email}</strong>.
          </p>
          <p className={styles.verificationText}>
            Por favor, clique no link no e-mail para ativar a sua conta.
          </p>
          <Link to="/login" className={styles.primaryButton}>
            IR PARA LOGIN
          </Link>
        </div>

        <div className={styles.clubLogo}>
          <a
            href="https://www.instagram.com/btespinho/#"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="/images/club-logo.png"
              alt="Clube Tenis Espinho"
              onError={(e) => e.target.style.display = 'none'}
            />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* BT4500 Logo */}
      <div className={styles.logo}>
        <img
          src="/images/liga-logo.png"
          alt="Liga BT4500"
          className={styles.ligaLogo}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </div>

      {/* Registration Form */}
      <form
        className={styles.form}
        onSubmit={handleRegister}
        aria-label="Formulario de registo"
      >
        <input
          type="email"
          id="email"
          className={styles.input}
          placeholder="E-MAIL"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Endereco de e-mail"
          autoComplete="email"
        />

        <input
          type="password"
          id="password"
          className={styles.input}
          placeholder="PALAVRA-PASSE"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          aria-label="Palavra-passe"
          autoComplete="new-password"
        />

        <input
          type="password"
          id="confirmPassword"
          className={styles.input}
          placeholder="REPETIR PALAVRA-PASSE"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          aria-label="Repetir palavra-passe"
          autoComplete="new-password"
        />

        <input
          type="tel"
          id="whatsapp"
          className={styles.input}
          placeholder="NUMERO WHATSAPP"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          aria-label="Numero de WhatsApp (opcional)"
          autoComplete="tel"
        />

        {error && (
          <div className={styles.errorMessage} role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
          aria-label="Criar conta"
        >
          {submitting ? 'A REGISTAR...' : 'REGISTAR'}
        </button>

        <Link
          to="/login"
          className={styles.secondaryButton}
          aria-label="Voltar ao login"
        >
          JA TENHO CONTA
        </Link>
      </form>

      {/* Club Logo */}
      <div className={styles.clubLogo}>
        <a
          href="https://www.instagram.com/btespinho/#"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visitar Instagram do BT Espinho"
        >
          <img
            src="/images/club-logo.png"
            alt="Clube Tenis Espinho"
            onError={(e) => e.target.style.display = 'none'}
          />
        </a>
      </div>
    </div>
  );
}

export default Register;
