import { useEffect, useState } from 'react';
import { createSocket } from './socket.js';

export function useSocket({ role } = {}) {
  const [socket, setSocket] = useState(null);
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = createSocket({ role });
    setSocket(s);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('state', setState);
    return () => { s.disconnect(); };
  }, [role]);

  return { socket, state, connected };
}
