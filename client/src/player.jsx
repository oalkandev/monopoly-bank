import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { useSocket } from './useSocket.js';
import { useWakeLock } from './useWakeLock.js';
import { emit, describeTx, txDirection } from './socket.js';
import '../index.css';

function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

function fmt(n, currency) {
  return `${n.toLocaleString('tr-TR')}${currency}`;
}

function App() {
  const cookieToken = getCookie('playerToken');
  useWakeLock(true);

  if (!cookieToken) return <NoToken />;

  const { socket, state, connected } = useSocket();

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const me = state.players.find(p => p.token === cookieToken);
  if (!me) return <NoToken />;

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <Toaster position="top-center" />
      <ConnectionBadge connected={connected} />
      {state.status === 'setup'
        ? <WaitingView me={me} />
        : <PlayingView socket={socket} state={state} me={me} />}
    </div>
  );
}

function ConnectionBadge({ connected }) {
  return (
    <div className="flex justify-end mb-2">
      <span className={`badge badge-sm ${connected ? 'badge-success' : 'badge-error'}`}>
        {connected ? '● bağlı' : '○ bağlanılıyor…'}
      </span>
    </div>
  );
}

function NoToken() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card bg-base-100 shadow-xl max-w-md">
        <div className="card-body text-center">
          <h2 className="card-title justify-center">📱 Henüz katılmadın</h2>
          <p>Bankacının QR kodunu telefon kamerasıyla tara veya verdiği linke tıkla.</p>
        </div>
      </div>
    </div>
  );
}

function WaitingView({ me }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body text-center">
          <div className="badge badge-lg text-white font-bold mx-auto" style={{ backgroundColor: me.color }}>
            {me.name}
          </div>
          <h2 className="card-title justify-center mt-4">⏳ Oyun başlamayı bekliyor</h2>
          <p className="opacity-70">Bankacı oyunu başlattığında buradan oynamaya başlayabilirsin.</p>
          <span className="loading loading-dots loading-md mx-auto mt-2"></span>
        </div>
      </div>
    </div>
  );
}

function PlayingView({ socket, state, me, others }) {
  const cur = state.config.currency;
  const otherPlayers = state.players.filter(p => p.id !== me.id);
  const [showSend, setShowSend] = useState(false);
  const [showBank, setShowBank] = useState(false);

  const passGo = async () => {
    try {
      await emit(socket, 'pass-go');
      toast.success(`+${fmt(state.config.passGoBonus, cur)} GO bonusu`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <div className="card bg-base-100 shadow-xl mb-4">
        <div className="card-body items-center text-center">
          <div className="badge badge-lg text-white font-bold text-base px-4 py-3" style={{ backgroundColor: me.color }}>
            {me.name}
          </div>
          <div className="balance-display text-6xl font-black my-3 text-primary">
            {fmt(me.balance, cur)}
          </div>
          <button
            className="btn btn-secondary btn-lg w-full"
            onClick={passGo}
          >
            🎲 GO'dan Geçtim (+{fmt(state.config.passGoBonus, cur)})
          </button>
          <div className="grid grid-cols-2 gap-2 w-full mt-2">
            <button className="btn btn-primary" onClick={() => setShowSend(true)} disabled={otherPlayers.length === 0}>
              💸 Para Gönder
            </button>
            <button className="btn btn-accent" onClick={() => setShowBank(true)}>
              🏦 Bankaya Öde
            </button>
          </div>
        </div>
      </div>

      <PlayerList state={state} me={me} />
      <TransactionFeed state={state} me={me} />

      {showSend && (
        <SendModal
          socket={socket}
          state={state}
          me={me}
          others={otherPlayers}
          onClose={() => setShowSend(false)}
        />
      )}
      {showBank && (
        <PayBankModal
          socket={socket}
          state={state}
          onClose={() => setShowBank(false)}
        />
      )}
    </>
  );
}

function PlayerList({ state, me }) {
  const cur = state.config.currency;
  const others = state.players.filter(p => p.id !== me.id);
  if (others.length === 0) return null;
  return (
    <div className="card bg-base-100 shadow-md mb-4">
      <div className="card-body p-4">
        <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide">Diğer oyuncular</h3>
        <div className="space-y-1">
          {others.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className={p.online ? 'text-success' : 'opacity-40'}>●</span>
                <span className="badge text-white" style={{ backgroundColor: p.color }}>{p.name}</span>
              </div>
              <span className="font-bold balance-display">{fmt(p.balance, cur)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionFeed({ state, me }) {
  const cur = state.config.currency;
  const txs = [...state.transactions].slice(-30).reverse();
  if (txs.length === 0) return null;

  return (
    <div className="card bg-base-100 shadow-md mb-4">
      <div className="card-body p-4">
        <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide">İşlem akışı</h3>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {txs.map(t => {
            const dir = txDirection(t, me.id);
            const colorClass = t.undone
              ? 'opacity-40 line-through'
              : dir === 'in' ? 'text-success font-bold'
              : dir === 'out' ? 'text-error font-bold'
              : '';
            const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
            return (
              <div key={t.id} className={`flex justify-between py-1 text-sm ${colorClass}`}>
                <span>{describeTx(t, state.players)}</span>
                <span className="balance-display">{sign}{fmt(t.amount, cur)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SendModal({ socket, state, me, others, onClose }) {
  const cur = state.config.currency;
  const [toId, setToId] = useState(others[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const v = Number(amount);
    if (!v || v <= 0) return toast.error('Geçersiz miktar');
    if (v > me.balance) return toast.error('Yetersiz bakiye');
    setBusy(true);
    try {
      await emit(socket, 'transfer', { toId, amount: v });
      toast.success(`${fmt(v, cur)} gönderildi`);
      onClose();
    } catch (e) { toast.error(e.message); setBusy(false); }
  };

  return (
    <Modal title="💸 Para Gönder" onClose={onClose}>
      <label className="form-control">
        <div className="label"><span className="label-text">Alıcı</span></div>
        <select className="select select-bordered" value={toId} onChange={(e) => setToId(e.target.value)}>
          {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="form-control">
        <div className="label"><span className="label-text">Miktar</span></div>
        <input
          type="number"
          inputMode="numeric"
          className="input input-bordered text-2xl text-center balance-display"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="0"
        />
      </label>
      <QuickAmounts onPick={(v) => setAmount(String(v))} />
      <div className="flex gap-2 mt-2">
        <button className="btn btn-ghost flex-1" onClick={onClose} disabled={busy}>İptal</button>
        <button className="btn btn-primary flex-1" onClick={send} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Gönder'}
        </button>
      </div>
    </Modal>
  );
}

function PayBankModal({ socket, state, onClose }) {
  const cur = state.config.currency;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const v = Number(amount);
    if (!v || v <= 0) return toast.error('Geçersiz miktar');
    setBusy(true);
    try {
      await emit(socket, 'pay-to-bank', { amount: v });
      toast.success(`Bankaya ${fmt(v, cur)} ödendi`);
      onClose();
    } catch (e) { toast.error(e.message); setBusy(false); }
  };

  return (
    <Modal title="🏦 Bankaya Öde" onClose={onClose}>
      <p className="text-sm opacity-70">Vergi, mülk satın alma vb. için kullan.</p>
      <label className="form-control">
        <div className="label"><span className="label-text">Miktar</span></div>
        <input
          type="number"
          inputMode="numeric"
          className="input input-bordered text-2xl text-center balance-display"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="0"
        />
      </label>
      <QuickAmounts onPick={(v) => setAmount(String(v))} />
      <div className="flex gap-2 mt-2">
        <button className="btn btn-ghost flex-1" onClick={onClose} disabled={busy}>İptal</button>
        <button className="btn btn-accent flex-1" onClick={send} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-sm"></span> : 'Öde'}
        </button>
      </div>
    </Modal>
  );
}

function QuickAmounts({ onPick }) {
  const presets = [50, 100, 200, 500, 1000];
  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {presets.map(p => (
        <button key={p} className="btn btn-xs btn-outline" onClick={() => onPick(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="card bg-base-100 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="card-body">
          <h2 className="card-title">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
