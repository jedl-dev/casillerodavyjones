import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

import RouteLoader from './components/RouteLoader';
import RouteBoundary from './components/RouteBoundary';
import { supabaseConfigured } from './lib/supabase';
import { leaveRoom } from './lib/quizApi';
import { getTabId, resetClientId, resetTabId } from './lib/user';
import { clearArcadeIdentity, getArcadeIdentity, getArcadePlayer, setArcadeIdentity, toIdentity } from './lib/arcade';
import { getPlayerSession, onPlayerAuthChange } from './lib/playerAuth';

// Cada ruta carga su trozo: la home no arrastra el quiz, las salas ni html2canvas.
const GameMenu = lazy(() => import('./pages/GameMenu'));
const QuizIntro = lazy(() => import('./pages/QuizIntro'));
const Auth = lazy(() => import('./pages/Auth'));
const WantedQuiz = lazy(() => import('./pages/WantedQuiz'));
const Sala = lazy(() => import('./pages/Sala'));
const Ranking = lazy(() => import('./pages/Ranking'));
const Room = lazy(() => import('./pages/Room'));
const Admin = import.meta.env.DEV ? lazy(() => import('./pages/Admin')) : null;

const ROOM_KEY = 'opq:room';

const readRoom = () => {
  try {
    const room = JSON.parse(sessionStorage.getItem(ROOM_KEY) || 'null');
    if (!room || room.tab_id !== getTabId()) return null;
    return room;
  } catch {
    return null;
  }
};

const saveRoom = (room) => {
  try {
    if (room) sessionStorage.setItem(ROOM_KEY, JSON.stringify({ ...room, tab_id: getTabId() }));
    else sessionStorage.removeItem(ROOM_KEY);
  } catch {
    // Sin almacenamiento disponible: la sala se pierde al recargar.
  }
};

const LIVE_KEY = 'opq:liveTab';

const announceTab = () => {
  try {
    localStorage.setItem(LIVE_KEY, JSON.stringify({
      tabId: getTabId(),
      born: performance.timeOrigin,
      at: Date.now()
    }));
  } catch {
    // Sin almacenamiento: la detección de copia queda desactivada.
  }
};

// Si otra pestaña viva comparte este tabId, esta es una copia: se le da
// identidad nueva y se descarta la sesión heredada antes de pintar nada.
const bootstrapTab = () => {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    if (raw) {
      const live = JSON.parse(raw);
      const fresh = live && Date.now() - live.at < 60000;
      const nav = performance.getEntriesByType?.('navigation')?.[0];
      const isReload = nav?.type === 'reload';
      if (!isReload && fresh && live.tabId === getTabId() && live.born < performance.timeOrigin) {
        resetTabId();
        resetClientId();
        saveRoom(null);
      }
    }
  } catch {
    // Sin storage: se sigue con la identidad en memoria.
  }
  announceTab();
};

const cleanPath = (path) => path.replace(/\/+$/, '') || '/';

// Lleva a un ancla y la marca un instante: pushState no dispara :target.
const revealHash = (hash) => {
  if (!hash) return;
  const node = document.getElementById(hash);
  if (!node) return;
  node.classList.remove('is-targeted');
  void node.offsetWidth;
  node.classList.add('is-targeted');
  window.setTimeout(() => node.classList.remove('is-targeted'), 1100);
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const TITLES = {
  '/': 'Inicio',
  '/home': 'Inicio',
  '/quiz': 'Quiz',
  '/login': 'Entrar',
  '/quiz/jugar': 'Partida',
  '/sala': 'Sala',
  '/ranking': 'Ranking'
};

const labelFor = (path) => (path.startsWith('/sala/') ? 'Sala' : TITLES[path] || 'Inicio');

function App() {
  const [path, setPath] = useState(() => cleanPath(window.location.pathname));
  const [search, setSearch] = useState(() => window.location.search || '');
  const [roomSession, setRoomSession] = useState(() => {
    bootstrapTab();
    return readRoom();
  });
  const [transition, setTransition] = useState(null);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const navigate = (to) => {
    // Query (?mode=register) y hash (#juegos) viajan en la URL pero no en `path`:
    // el router decide por pathname.
    const [rawTarget, rawHash = ''] = String(to || '/').split('#');
    const [rawPath, rawQuery = ''] = rawTarget.split('?');
    const next = cleanPath(rawPath);
    const query = rawQuery ? `?${rawQuery}` : '';
    const hash = rawHash ? `#${rawHash}` : '';

    const scrollToHash = () => {
      if (!rawHash) return;
      revealHash(rawHash);
    };

    const samePath = cleanPath(window.location.pathname) === next;
    const currentQuery = window.location.search || '';

    if (samePath && currentQuery !== query) {
      clearTimers();
      setTransition(null);
      window.history.pushState({}, '', next + query + hash);
      setSearch(query);
      window.scrollTo({ top: 0 });
      if (hash) revealHash(rawHash);
      return;
    }

    if (samePath && currentQuery === query) {
      if (hash) window.history.replaceState({}, '', next + query + hash);
      if (hash) scrollToHash();
      else window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    clearTimers();
    const destination = labelFor(next);
    setTransition({ destination, leaving: false });

    timers.current.push(setTimeout(() => {
      window.history.pushState({}, '', next + query + hash);
      setPath(next);
      setSearch(query);
      window.scrollTo({ top: 0 });
      if (hash) timers.current.push(setTimeout(scrollToHash, 140));
      setTransition({ destination, leaving: true });
      timers.current.push(setTimeout(() => setTransition(null), 320));
    }, 600));
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return undefined;
    const timer = setTimeout(() => revealHash(hash), 120);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let alive = true;

    const sync = async (session) => {
      if (!alive) return;
      if (!session) {
        if (getArcadeIdentity()?.token) clearArcadeIdentity();
        return;
      }

      try {
        const before = getArcadeIdentity();
        const player = await getArcadePlayer();
        if (!alive) return;
        if (!player?.exists) {
          // No borrar una identidad recién creada mientras la consulta estaba en vuelo.
          if (before?.token && getArcadeIdentity()?.token === before.token) {
            clearArcadeIdentity();
          }
          return;
        }
        setArcadeIdentity(toIdentity(player, before));
      } catch {
        // Sin conexión: la identidad local se resolverá al entrar al quiz.
      }
    };

    getPlayerSession().then(({ data }) => sync(data.session)).catch(() => {});
    const { data } = onPlayerAuthChange((session) => sync(session));

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const heartbeat = setInterval(announceTab, 30000);
    const channel = new BroadcastChannel('opq:tabs');
    const mine = { tabId: getTabId(), born: performance.timeOrigin };

    channel.postMessage(mine);
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.tabId !== getTabId() || data.born === mine.born) return;

      if (data.born > mine.born) {
        // La otra pestaña es más nueva: se le informa de que ya existía.
        channel.postMessage(mine);
        return;
      }

      resetTabId();
      resetClientId();
      saveRoom(null);
      setRoomSession(null);
    };

    return () => {
      clearInterval(heartbeat);
      channel.close();
    };
  }, []);

  useEffect(() => {
    const onPop = () => {
      clearTimers();
      setTransition(null);
      setSearch(window.location.search || '');
      setPath(cleanPath(window.location.pathname));
      const hash = window.location.hash.replace('#', '');
      if (hash) window.setTimeout(() => revealHash(hash), 160);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const roomCode = path.startsWith('/sala/') ? path.slice(6).toUpperCase() : '';
    const title = import.meta.env.DEV && path === '/admin'
      ? 'Administración'
      : TITLES[path] || (roomCode ? `Sala ${roomCode}` : 'Inicio');
    document.title = `${title} · El Casillero de Davy D. Jones`;
  }, [path]);

  const enterRoom = (room) => {
    saveRoom(room);
    setRoomSession(room);
    navigate(`/sala/${room.code}`);
  };

  const exitRoom = () => {
    saveRoom(null);
    setRoomSession(null);
    navigate('/sala');
  };

  const leaveActiveRoom = async () => {
    if (roomSession) {
      try {
        await leaveRoom(roomSession.code, roomSession.token);
      } catch {
        // La sala pudo expirar o haberse cerrado.
      }
    }
    saveRoom(null);
    setRoomSession(null);
  };

  const configNotice = (
    <div className="op-page">
      <div className="op-card op-card--wide">
        <h1 className="op-title">Configura Supabase</h1>
        <p className="op-subtitle">
          Copia <code>.env.example</code> a <code>.env</code> y completa{' '}
          <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <button className="op-btn" onClick={() => window.location.reload()}>Ya configuré, reintentar</button>
      </div>
    </div>
  );

  if (import.meta.env.DEV && path === '/admin') {
    if (!supabaseConfigured) return configNotice;
    return (
      <Suspense fallback={<div className="op-page"><p className="op-subtitle">Abriendo el panel...</p></div>}>
        <Admin navigate={navigate} />
      </Suspense>
    );
  }

  if (!supabaseConfigured) return configNotice;

  const isRoom = path.startsWith('/sala/');
  const roomCode = isRoom ? path.slice(6).toUpperCase() : '';
  const room = roomSession && roomSession.code === roomCode ? roomSession : null;

  let content;
  switch (path) {
    case '/':
    case '/home':
      content = <GameMenu navigate={navigate} />;
      break;
    case '/quiz':
      content = <QuizIntro navigate={navigate} />;
      break;
    case '/login':
      content = <Auth key={`${path}|${search}`} navigate={navigate} />;
      break;
    case '/quiz/jugar':
      content = <WantedQuiz navigate={navigate} />;
      break;
    case '/ranking':
      content = <Ranking navigate={navigate} />;
      break;
    case '/sala':
      content = (
        <Sala
          navigate={navigate}
          onEnterRoom={enterRoom}
          activeRoom={roomSession}
          onLeaveRoom={leaveActiveRoom}
        />
      );
      break;
    default:
      if (isRoom) {
        content = room
          ? <Room session={room} onExit={exitRoom} />
          : (
            <Sala
              navigate={navigate}
              onEnterRoom={enterRoom}
              activeRoom={roomSession}
              onLeaveRoom={leaveActiveRoom}
              initialCode={roomCode}
            />
          );
      } else {
        content = <GameMenu navigate={navigate} />;
      }
  }

  return (
    <div className="app-container" aria-busy={Boolean(transition)}>
      <RouteBoundary key={path}>
        <Suspense fallback={<RouteLoader destination={labelFor(path)} />}>
          {content}
        </Suspense>
      </RouteBoundary>
      {transition && (
        <RouteLoader destination={transition.destination} leaving={transition.leaving} />
      )}
    </div>
  );
}

export default App;
