import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { useSocket } from './useSocket.js';
import { useWakeLock } from './useWakeLock.js';
import { emit, describeTx, txDirection, formatRelative } from './socket.js';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useTheme } from './useTheme.js';
import '../index.css';

function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

function fmt(n, currency) {
  return `${n.toLocaleString('tr-TR')}${currency}`;
}

function App() {
  useTheme();
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
      <Toaster position="top-center" toastOptions={{ duration: 2000 }} />
      <TopBar connected={connected} />
      {state.status === 'setup'
        ? <WaitingView me={me} />
        : <PlayingView socket={socket} state={state} me={me} />}
    </div>
  );
}

function TopBar({ connected }) {
  return (
    <div className="navbar bg-base-200 rounded-box mb-4 min-h-0 py-1 px-3">
      <div className="flex-1">
        <div className={`badge badge-sm gap-1 ${connected ? 'badge-success' : 'badge-error'}`}>
          {connected ? '● bağlı' : '○ bağlanılıyor'}
        </div>
      </div>
      <div className="flex-none">
        <ThemeToggle size="sm" />
      </div>
    </div>
  );
}

function NoToken() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card bg-base-200 shadow-xl max-w-md">
        <div className="card-body text-center">
          <div className="text-5xl mb-2">📱</div>
          <h2 className="card-title justify-center">Henüz katılmadın</h2>
          <p className="opacity-70">Bankacının QR kodunu telefon kameranla tara veya verdiği linke tıkla.</p>
        </div>
      </div>
    </div>
  );
}

function WaitingView({ me }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card bg-base-200 shadow-xl">
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

function PlayingView({ socket, state, me }) {
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
      <div className="card bg-base-200 shadow-xl mb-4">
        <div className="card-body items-center text-center p-5">
          <div className="badge badge-lg text-white font-bold text-base px-4 py-3" style={{ backgroundColor: me.color }}>
            {me.name}
          </div>
          <div className="balance-display text-6xl font-black my-3 text-primary">
            {fmt(me.balance, cur)}
          </div>
          <button className="btn btn-secondary btn-block btn-lg" onClick={passGo}>
            🎲 GO'dan Geçtim (+{fmt(state.config.passGoBonus, cur)})
          </button>
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              className="btn btn-primary"
              onClick={() => setShowSend(true)}
              disabled={otherPlayers.length === 0}
            >
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

      <SendModal
        open={showSend}
        socket={socket}
        state={state}
        me={me}
        others={otherPlayers}
        onClose={() => setShowSend(false)}
      />
      <PayBankModal
        open={showBank}
        socket={socket}
        state={state}
        me={me}
        onClose={() => setShowBank(false)}
      />
    </>
  );
}

function PlayerList({ state, me }) {
  const cur = state.config.currency;
  const others = state.players.filter(p => p.id !== me.id);
  if (others.length === 0) return null;
  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide">Diğer oyuncular</h3>
        <ul className="menu menu-sm bg-base-100 rounded-box p-1">
          {others.map(p => (
            <li key={p.id}>
              <div className="flex items-center justify-between hover:bg-base-300/50">
                <div className="flex items-center gap-2">
                  <div className={`badge badge-xs ${p.online ? 'badge-success' : 'badge-ghost'}`} />
                  <span className="badge text-white font-bold" style={{ backgroundColor: p.color }}>
                    {p.name}
                  </span>
                </div>
                <span className="font-bold balance-display">{fmt(p.balance, cur)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const TX_META = {
  'transfer': { icon: '↔', color: 'text-info' },
  'pass-go': { icon: '🎲', color: 'text-success' },
  'banker-credit': { icon: '⬆', color: 'text-success' },
  'banker-debit': { icon: '⬇', color: 'text-error' },
  'initial': { icon: '🏁', color: 'text-warning' },
};

function TransactionFeed({ state, me }) {
  const cur = state.config.currency;
  const txs = [...state.transactions].slice(-30).reverse();

  if (txs.length === 0) {
    return (
      <div className="card bg-base-200 shadow-md mb-4">
        <div className="card-body p-4 text-center opacity-50">
          <div className="text-3xl">📭</div>
          <p className="text-sm">Henüz işlem yok</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide">İşlem akışı</h3>
          <span className="badge badge-ghost badge-sm">{txs.length}</span>
        </div>
        <div className="divider my-1" />
        <ul className="space-y-1 max-h-80 overflow-y-auto">
          {txs.map(t => {
            const dir = txDirection(t, me.id);
            const meta = TX_META[t.type] ?? { icon: '•', color: 'opacity-60' };
            const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
            const amountClass = t.undone
              ? 'opacity-40 line-through'
              : dir === 'in' ? 'text-success font-bold'
              : dir === 'out' ? 'text-error font-bold'
              : '';
            return (
              <li key={t.id} className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-base-300/30 ${t.undone ? 'opacity-50' : ''}`}>
                <span className={`text-base ${meta.color}`}>{meta.icon}</span>
                <span className="flex-1 text-sm truncate">{describeTx(t, state.players)}</span>
                <span className={`balance-display ${amountClass}`}>
                  {sign}{fmt(t.amount, cur)}
                </span>
                <span className="text-xs opacity-50 w-14 text-right">{formatRelative(t.ts)}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SendModal({ open, socket, state, me, others, onClose }) {
  const cur = state.config.currency;
  const [toId, setToId] = useState(others[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setToId(others[0]?.id ?? '');
      setAmount('');
    }
  }, [open, others]);

  const send = async () => {
    const v = Number(amount);
    if (!v || v <= 0) return toast.error('Geçersiz miktar');
    if (v > me.balance) return toast.error('Yetersiz bakiye');
    setBusy(true);
    try {
      await emit(socket, 'transfer', { toId, amount: v });
      toast.success(`${fmt(v, cur)} gönderildi`);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="💸 Para Gönder">
      <label className="form-control w-full">
        <div className="label py-1"><span className="label-text">Alıcı</span></div>
        <select className="select select-bordered w-full" value={toId} onChange={(e) => setToId(e.target.value)}>
          {others.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="form-control w-full">
        <div className="label py-1"><span className="label-text">Miktar</span></div>
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
      <div className="modal-action mt-3">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>İptal</button>
        <button className="btn btn-primary" onClick={send} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : 'Gönder'}
        </button>
      </div>
    </Modal>
  );
}

function PayBankModal({ open, socket, state, me, onClose }) {
  const cur = state.config.currency;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setAmount(''); }, [open]);

  const send = async () => {
    const v = Number(amount);
    if (!v || v <= 0) return toast.error('Geçersiz miktar');
    if (v > me.balance) return toast.error('Yetersiz bakiye');
    setBusy(true);
    try {
      await emit(socket, 'pay-to-bank', { amount: v });
      toast.success(`Bankaya ${fmt(v, cur)} ödendi`);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="🏦 Bankaya Öde">
      <p className="text-sm opacity-70">Vergi, mülk satın alma vb. için kullan.</p>
      <label className="form-control w-full">
        <div className="label py-1"><span className="label-text">Miktar</span></div>
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
      <div className="modal-action mt-3">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>İptal</button>
        <button className="btn btn-accent" onClick={send} disabled={busy}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : 'Öde'}
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
        <button key={p} type="button" className="btn btn-xs btn-outline" onClick={() => onPick(p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>kapat</button>
      </form>
    </dialog>
  );
}

createRoot(document.getElementById('root')).render(<App />);
