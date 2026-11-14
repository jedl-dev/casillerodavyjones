import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';

import GameMenu from './pages/GameMenu';
import QuizIntro from './pages/QuizIntro';
import WantedQuiz from './pages/WantedQuiz';
import Sala from './pages/Sala';
import Room from './pages/Room';
import RouteLoader from './components/RouteLoader';
import { supabaseConfigured } from './lib/supabase';
import { leaveRoom } from './lib/quizApi';
import { getTabId, resetClientId, resetTabId } from './lib/user';

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
    // Sin almacenamiento: la detecci?n de copia queda desactivada.
  }
};

// Si otra pesta?a viva comparte este tabId, esta es una copia: se le da
// identidad nueva y se descarta la sesi?n heredada antes de pintar nada.
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

const TITLES = {
  '/': 'Inicio',
  '/home': 'Inicio',
  '/quiz': 'Quiz',
  '/quiz/jugar': 'Partida',
  '/sala': 'Sala'
};

const labelFor = (path) => (path.startsWith('/sala/') ? 'Sala' : TITLES[path] || 'Inicio');

function App() {
  const [path, setPath] = useState(() => cleanPath(window.location.pathname));
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
    const next = cleanPath(to || '/');
    if (cleanPath(window.location.pathname) === next) return;

    clearTimers();
    const destination = labelFor(next);
    setTransition({ destination, leaving: false });

    timers.current.push(setTimeout(() => {
      window.history.pushState({}, '', next);
      setPath(next);
      window.scrollTo({ top: 0 });
      setTransition({ destination, leaving: true });
      timers.current.push(setTimeout(() => setTransition(null), 320));
    }, 900));
  };

  useEffect(() => () => clearTimers(), []);

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
      setPath(cleanPath(window.location.pathname));
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
        <button className="op-btn" onClick={() => navigate('/home')}>Volver al inicio</button>
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

  if (!supabaseConfigured && path !== '/') return configNotice;

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
    case '/quiz/jugar':
      content = <WantedQuiz navigate={navigate} />;
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
            />
          );
      } else {
        content = <GameMenu navigate={navigate} />;
      }
  }

  return (
    <div className="app-container" aria-busy={Boolean(transition)}>
      {content}
      {transition && (
        <RouteLoader destination={transition.destination} leaving={transition.leaving} />
      )}
    </div>
  );
}

export default App;
