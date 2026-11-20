import React, { useEffect, useRef, useState } from 'react';
import Shell from '../components/Shell';
import '../ui.css';
import './Auth.css';
import { claimArcadeName, clearArcadeIdentity, getArcadeIdentity, getArcadePlayer, setArcadeIdentity, toIdentity } from '../lib/arcade';
import {
  authErrorMessage,
  consumeNext,
  getPlayerSession,
  onPlayerAuthChange,
  resendConfirmation,
  resetPlayerPassword,
  signInPlayer,
  signOutPlayer,
  signUpPlayer,
  updatePlayerPassword
} from '../lib/playerAuth';
import { validUsername } from '../lib/quizRoom';

const COPY = {
  login: {
    title: 'Entrar',
    text: 'Tu cuenta guarda las marcas, el nombre y la racha.'
  },
  register: {
    title: 'Crear cuenta',
    text: 'Te enviaremos un correo para confirmar la cuenta antes de jugar.'
  },
  sent: {
    title: 'Revisa tu correo',
    text: 'Confirma el email para poder entrar. Mira también la carpeta de spam.'
  },
  reset: {
    title: 'Recuperar contraseña',
    text: 'Escribe el email de tu cuenta y te enviamos un enlace para cambiarla.'
  },
  recover: {
    title: 'Nueva contraseña',
    text: 'Elige una contraseña nueva para tu cuenta.'
  },
  name: {
    title: 'Elige tu nombre',
    text: 'Es el nombre público del ranking. Podrás cambiarlo más adelante sin perder tus marcas.'
  }
};

const Auth = ({ navigate }) => {
  const [mode, setMode] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'register'
      ? 'register'
      : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const resolving = useRef(false);
  const flags = useRef(typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search));

  const confirmed = flags.current.get('confirmed');
  const recovery = flags.current.get('reset');

  const resolvePlayer = async (session) => {
    if (!session || resolving.current) return;
    resolving.current = true;
    try {
      const player = await getArcadePlayer();
      if (player?.exists) {
        setArcadeIdentity(toIdentity(player, getArcadeIdentity()));
        navigate(consumeNext());
        return;
      }
      setMode('name');
    } catch (err) {
      setError(authErrorMessage(err.message));
      setMode('login');
    } finally {
      setChecking(false);
      resolving.current = false;
    }
  };

  useEffect(() => {
    let alive = true;

    getPlayerSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) {
        setChecking(false);
        if (recovery) {
          setMode('reset');
          setError('El enlace de recuperación no es válido o ha caducado. Pide otro.');
        } else if (confirmed) {
          setNotice('Cuenta confirmada. Entra con tu email y contraseña.');
        }
        return;
      }
      if (recovery) {
        setChecking(false);
        setMode('recover');
        return;
      }
      resolvePlayer(data.session);
    }).catch(() => {
      if (alive) {
        setChecking(false);
        setError('No se pudo comprobar tu sesión. Revisa la conexión e inténtalo de nuevo.');
      }
    });

    const { data } = onPlayerAuthChange((session, event) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        setChecking(false);
        setMode('recover');
        return;
      }
      if (event === 'SIGNED_OUT') {
        setChecking(false);
        setMode('login');
        setError('');
        setNotice('');
        setPassword('');
        setConfirm('');
        return;
      }
      if (event === 'SIGNED_IN' && session) resolvePlayer(session);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!cooldown) return undefined;
    const id = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirm('');
  };

  const submitLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const { data, error: authError } = await signInPlayer(email.trim(), password);
    setBusy(false);
    if (authError) {
      const message = authErrorMessage(authError.message);
      setError(message);
      if (/confirma/i.test(message)) {
        setSentTo(email.trim());
        setMode('sent');
      }
      return;
    }
    await resolvePlayer(data.session);
  };

  const submitRegister = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    const { data, error: authError } = await signUpPlayer(email.trim(), password);
    setBusy(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    if (data.session) {
      await resolvePlayer(data.session);
      return;
    }
    setSentTo(email.trim());
    setMode('sent');
    setNotice('');
  };

  const submitName = async (event) => {
    event.preventDefault();
    setError('');
    if (!validUsername(name)) {
      setError('Usa de 3 a 16 letras, números o guion bajo.');
      return;
    }

    setBusy(true);
    try {
      await claimArcadeName(name);
      navigate(consumeNext());
    } catch (err) {
      setError(authErrorMessage(err.message));
    } finally {
      setBusy(false);
    }
  };

  const requestReset = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const { error: authError } = await resetPlayerPassword(email.trim());
    setBusy(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    setNotice('Si ese email tiene cuenta, recibirás un enlace para cambiar la contraseña.');
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    const { error: authError } = await updatePlayerPassword(password);
    setBusy(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    setNotice('Contraseña actualizada.');
    const { data } = await getPlayerSession();
    if (data.session) await resolvePlayer(data.session);
    else setMode('login');
  };

  const resend = async () => {
    if (cooldown || busy) return;
    setBusy(true);
    setError('');
    const { error: authError } = await resendConfirmation(sentTo || email.trim());
    setBusy(false);
    if (authError) {
      setError(authErrorMessage(authError.message));
      return;
    }
    setNotice('Correo reenviado.');
    setCooldown(60);
  };

  const logout = async () => {
    await signOutPlayer();
    clearArcadeIdentity();
    switchMode('login');
  };

  const copy = COPY[mode] || COPY.login;
  const isForm = mode === 'login' || mode === 'register';

  if (checking) {
    return (
      <Shell current="quiz" navigate={navigate} className="shell--center">
        <section className="auth-card auth-card--loading" aria-live="polite">
          <span className="auth-spinner" aria-hidden="true" />
          <p>Comprobando tu cuenta...</p>
        </section>
      </Shell>
    );
  }

  return (
    <Shell current="quiz" navigate={navigate} className="shell--center">
      <section className="auth-card" aria-labelledby="auth-title">
        <span className="auth-eyebrow">Cuenta de jugador</span>
        <h1 className="auth-title" id="auth-title">{copy.title}</h1>
        <p className="auth-lede">{copy.text}</p>

        {isForm && (
          <div className="auth-tabs" role="tablist" aria-label="Cuenta">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={`auth-tab${mode === 'login' ? ' is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={`auth-tab${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Crear cuenta
            </button>
          </div>
        )}

        {isForm && (
          <form className="auth-form" onSubmit={mode === 'login' ? submitLogin : submitRegister}>
            <label className="op-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="op-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="tu@email.com"
              required
            />

            <label className="op-label" htmlFor="auth-password">Contraseña</label>
            <input
              id="auth-password"
              className="op-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              autoCapitalize="none"
              spellCheck={false}
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
              required
            />

            {mode === 'register' && (
              <>
                <label className="op-label" htmlFor="auth-confirm">Repite la contraseña</label>
                <input
                  id="auth-confirm"
                  className="op-input"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </>
            )}

            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}

            <button className="op-btn op-btn--primary auth-submit" type="submit" disabled={busy}>
              {busy
                ? 'Un momento...'
                : mode === 'login' ? 'Entrar' : 'Crear cuenta y enviar correo'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                className="auth-link"
                onClick={() => { switchMode('reset'); setEmail(email); }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </form>
        )}

        {mode === 'sent' && (
          <div className="auth-form">
            <p className="auth-note">
              Hemos enviado un enlace a <strong>{sentTo}</strong>. Ábrelo y confirma la cuenta.
            </p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="op-btn op-btn--primary auth-submit" type="button" onClick={resend} disabled={busy || cooldown > 0}>
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar correo'}
            </button>
            <button className="auth-link" type="button" onClick={() => switchMode('login')}>
              Ya lo he confirmado, entrar
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <form className="auth-form" onSubmit={requestReset}>
            <label className="op-label" htmlFor="auth-reset-email">Email de la cuenta</label>
            <input
              id="auth-reset-email"
              className="op-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="op-btn op-btn--primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Enviando...' : 'Enviar enlace'}
            </button>
            <button className="auth-link" type="button" onClick={() => switchMode('login')}>
              Volver a entrar
            </button>
          </form>
        )}

        {mode === 'recover' && (
          <form className="auth-form" onSubmit={savePassword}>
            <label className="op-label" htmlFor="auth-new-password">Nueva contraseña</label>
            <input
              id="auth-new-password"
              className="op-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Mínimo 8 caracteres"
              required
            />
            <label className="op-label" htmlFor="auth-new-confirm">Repite la contraseña</label>
            <input
              id="auth-new-confirm"
              className="op-input"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            {notice && <p className="auth-notice" role="status">{notice}</p>}
            <button className="op-btn op-btn--primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : 'Guardar contraseña'}
            </button>
            <button type="button" className="auth-link" onClick={() => switchMode('reset')}>
              Pedir otro enlace
            </button>
          </form>
        )}

        {mode === 'name' && (
          <form className="auth-form" onSubmit={submitName}>
            <p className="auth-note">
              Ya tienes cuenta. Elige tu nombre público para entrar al ranking.
            </p>
            <label className="op-label" htmlFor="auth-name">Nombre de jugador</label>
            <input
              id="auth-name"
              className="op-input"
              value={name}
              maxLength={16}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Mugiwara"
              autoComplete="nickname"
              required
            />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="op-btn op-btn--primary auth-submit" type="submit" disabled={busy}>
              {busy ? 'Guardando...' : 'Entrar al quiz'}
            </button>
            <button className="auth-link" type="button" onClick={logout}>
              Cerrar sesión
            </button>
          </form>
        )}

        <button className="auth-back" type="button" onClick={() => navigate('/home')}>
          Volver al inicio
        </button>
      </section>
    </Shell>
  );
};

export default Auth;
