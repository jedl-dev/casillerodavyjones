import { supabase } from './supabase';

const NEXT_KEY = 'opq:authNext';
const SAFE_NEXT = new Set(['/', '/quiz', '/sala', '/ranking', '/home']);

const isSafeNext = (value) => (
  SAFE_NEXT.has(value)
  || /^\/sala\/[A-Za-z0-9]{4,8}$/.test(value || '')
  || /^\/sala\?game=[a-z0-9_]{2,32}$/.test(value || '')
);

const redirectTo = (path) => `${window.location.origin}${path}`;

export const getPlayerSession = () => supabase.auth.getSession();

export const onPlayerAuthChange = (callback) => supabase.auth.onAuthStateChange(
  (event, session) => callback(session, event)
);

export const signInPlayer = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUpPlayer = (email, password) => supabase.auth.signUp({
  email,
  password,
  options: { emailRedirectTo: redirectTo('/login?confirmed=1') }
});

export const resendConfirmation = (email) => supabase.auth.resend({
  type: 'signup',
  email,
  options: { emailRedirectTo: redirectTo('/login?confirmed=1') }
});

export const resetPlayerPassword = (email) => supabase.auth.resetPasswordForEmail(email, {
  redirectTo: redirectTo('/login?reset=1')
});

export const updatePlayerPassword = (password) => supabase.auth.updateUser({ password });

export const signOutPlayer = () => supabase.auth.signOut();

export function rememberNext(path) {
  try {
    sessionStorage.setItem(NEXT_KEY, isSafeNext(path) ? path : '/home');
  } catch {
    // Sin almacenamiento: el destino por defecto es la home.
  }
}

export function consumeNext() {
  try {
    const value = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    if (value === '/') return '/home';
    return isSafeNext(value) ? value : '/home';
  } catch {
    return '/home';
  }
}

export function authErrorMessage(message) {
  const text = String(message || '');
  if (/Invalid login credentials/i.test(text)) return 'Email o contraseña incorrectos.';
  if (/Email not confirmed/i.test(text)) return 'Confirma tu correo antes de entrar.';
  if (/User already registered/i.test(text)) return 'Ese email ya tiene cuenta. Entra o recupera la contraseña.';
  if (/Password should be at least/i.test(text)) return 'La contraseña necesita al menos 8 caracteres.';
  if (/For security purposes/i.test(text)) return 'Espera unos segundos antes de reintentar.';
  if (/Email rate limit/i.test(text)) return 'Demasiados correos seguidos. Espera un momento.';
  return text || 'No se pudo completar la operación.';
}
