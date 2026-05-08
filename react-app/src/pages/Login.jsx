import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/api';
import { useAuthRedirect } from '../hooks';
import { useAuth } from '../context/AuthContext';
import styles from './Login.module.css';

// Google Client ID - should match the one configured in Auth0
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function Login() {
  const navigate = useNavigate();
  const { refresh: refreshAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  // Redirect if already authenticated
  useAuthRedirect('/profile');

  // Handle Google Sign-In response
  const handleGoogleResponse = useCallback(async (response) => {
    if (response.credential) {
      setSubmitting(true);
      setError('');
      try {
        const result = await apiService.loginWithGoogle(response.credential);
        if (result.token) {
          await refreshAuth();
          navigate('/profile');
        }
      } catch (err) {
        setError(err.message || 'Google login failed. Please try again.');
      } finally {
        setSubmitting(false);
      }
    }
  }, [navigate, refreshAuth]);

  // Load Google Identity Services script
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      return;
    }

    // Check if script already loaded
    if (window.google?.accounts?.id) {
      setGoogleLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Initialize Google Sign-In when script is loaded
  useEffect(() => {
    if (googleLoaded && GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
    }
  }, [googleLoaded, handleGoogleResponse]);

  // Render Google button when ready
  useEffect(() => {
    if (googleLoaded && GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      const buttonContainer = document.getElementById('google-signin-button');
      if (buttonContainer) {
        buttonContainer.innerHTML = '';
        window.google.accounts.id.renderButton(buttonContainer, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width: 300,
        });
      }
    }
  }, [googleLoaded]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await apiService.login(email, password);
      if (response.token) {
        await refreshAuth();
        navigate('/profile');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, insira o seu e-mail.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      await apiService.forgotPassword(email);
      setForgotPasswordSent(true);
    } catch (err) {
      setError(err.message || 'Erro ao enviar e-mail de recuperacao.');
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Login Form */}
      <form
        className={styles.form}
        onSubmit={forgotPasswordMode ? handleForgotPassword : handleLogin}
        aria-label={forgotPasswordMode ? 'Formulario de recuperacao de palavra-passe' : 'Formulario de login'}
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

        {!forgotPasswordMode && (
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
            autoComplete="current-password"
          />
        )}

        {error && (
          <div className={styles.errorMessage} role="alert" aria-live="polite">
            {error}
          </div>
        )}

        {forgotPasswordSent && (
          <div className={styles.successMessage} role="status" aria-live="polite">
            E-mail de recuperacao enviado. Verifique a sua caixa de entrada.
          </div>
        )}

        {forgotPasswordMode ? (
          <>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
              aria-label="Enviar e-mail de recuperacao"
            >
              {submitting ? 'A ENVIAR...' : 'ENVIAR'}
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setForgotPasswordMode(false);
                setForgotPasswordSent(false);
                setError('');
              }}
              aria-label="Voltar ao login"
            >
              VOLTAR AO LOGIN
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={submitting}
              aria-label="Entrar na conta"
            >
              {submitting ? 'A ENTRAR...' : 'ENTRAR'}
            </button>

            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => {
                setForgotPasswordMode(true);
                setError('');
              }}
              aria-label="Esqueci-me da palavra-passe"
            >
              ESQUECI-ME DA PALAVRA-PASSE
            </button>

            <Link
              to="/register"
              className={styles.secondaryButton}
              aria-label="Criar nova conta"
            >
              NAO ESTOU REGISTADO
            </Link>
          </>
        )}
      </form>

      {/* Google Sign-In Button */}
      {GOOGLE_CLIENT_ID && !forgotPasswordMode && (
        <div className={styles.googleSection}>
          <div id="google-signin-button" className={styles.googleButton}></div>
        </div>
      )}

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

export default Login;
