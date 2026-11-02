import { useEffect, useRef, useState } from 'react';

export function useReceivedNotification(state, me) {
  const [tx, setTx] = useState(null);
  const seenRef = useRef(null);

  useEffect(() => {
    if (!state || !me) return;
    const txs = state.transactions;

    if (seenRef.current === null) {
      seenRef.current = txs.length > 0 ? txs[txs.length - 1].id : '__none__';
      return;
    }

    const idx = seenRef.current === '__none__'
      ? -1
      : txs.findIndex(t => t.id === seenRef.current);
    const fresh = idx >= 0 ? txs.slice(idx + 1) : txs;

    const incoming = fresh.filter(t =>
      t.to === me.id &&
      !t.undone &&
      (t.type === 'transfer' || t.type === 'banker-credit' || t.type === 'pass-go')
    );

    if (incoming.length > 0) {
      setTx(incoming[incoming.length - 1]);
    }
    if (txs.length > 0) seenRef.current = txs[txs.length - 1].id;
  }, [state, me]);

  useEffect(() => {
    if (!tx) return;
    const id = setTimeout(() => setTx(null), 5000);
    return () => clearTimeout(id);
  }, [tx]);

  return { tx, dismiss: () => setTx(null) };
}
