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

  return (
    <>
      <div
        className="card bg-base-200 shadow-xl mb-4 overflow-hidden border-2"
        style={{ borderColor: me.color }}
      >
        <div
          className="px-4 py-3 text-center text-white"
          style={{ backgroundColor: me.color }}
        >
          <span className="font-black text-xl tracking-wide drop-shadow">{me.name}</span>
        </div>
        <div className="card-body items-center text-center p-5">
          <div className="balance-display text-6xl font-black my-2 text-primary">
            {fmt(me.balance, cur)}
          </div>
          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => setShowSend(true)}
              disabled={otherPlayers.length === 0}
            >
              💸 Para Gönder
            </button>
            <button className="btn btn-accent btn-lg" onClick={() => setShowBank(true)}>
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
        <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide mb-2">Diğer oyuncular</h3>
        <div className="space-y-1.5">
          {others.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-lg overflow-hidden bg-base-100 border-l-4"
              style={{ borderLeftColor: p.color }}
            >
              <div className="flex-1 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold" style={{ color: p.color }}>{p.name}</span>
                  <span className={`badge badge-xs ${p.online ? 'badge-success' : 'badge-ghost'}`} />
                </div>
                <span className="font-bold balance-display">{fmt(p.balance, cur)}</span>
              </div>
            </div>
          ))}
        </div>
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
  const [filter, setFilter] = useState('all'); // 'all' | 'me' | 'bank'
  const allTxs = [...state.transactions].slice(-100).reverse();

  const filterFn = (t) => {
    if (filter === 'all') return true;
    if (filter === 'me') return t.from === me.id || t.to === me.id;
    if (filter === 'bank') return !t.from || !t.to;
    return true;
  };
  const txs = allTxs.filter(filterFn);

  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide">İşlem akışı</h3>
          <span className="badge badge-ghost badge-sm">
            {filter === 'all' ? allTxs.length : `${txs.length}/${allTxs.length}`}
          </span>
        </div>

        <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-300 mt-2">
          <button
            type="button"
            role="tab"
            className={`tab ${filter === 'all' ? 'tab-active' : ''}`}
            onClick={() => setFilter('all')}
          >Tümü</button>
          <button
            type="button"
            role="tab"
            className={`tab ${filter === 'me' ? 'tab-active' : ''}`}
            onClick={() => setFilter('me')}
            style={filter === 'me' ? { backgroundColor: me.color, color: 'white' } : undefined}
          >Ben</button>
          <button
            type="button"
            role="tab"
            className={`tab ${filter === 'bank' ? 'tab-active' : ''}`}
            onClick={() => setFilter('bank')}
          >🏦 Banka</button>
        </div>

        {allTxs.length === 0 ? (
          <div className="text-center py-6 opacity-50 text-sm">
            <div className="text-3xl">📭</div>
            <p>Henüz işlem yok</p>
          </div>
        ) : txs.length === 0 ? (
          <div className="text-center py-6 opacity-50 text-sm">
            <div className="text-3xl">🔍</div>
            <p>Bu filtreye uyan işlem yok</p>
          </div>
        ) : (
          <ul className="space-y-1 max-h-80 overflow-y-auto mt-2">
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
        )}
      </div>
    </div>
  );
}

function SendModal({ open, socket, state, me, others, onClose }) {
  const cur = state.config.currency;
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setToId('');
      setAmount('');
    }
  }, [open]);

  const recipient = others.find(p => p.id === toId);
  const numAmount = Number(amount) || 0;
  const exceeds = numAmount > me.balance;
  const remaining = me.balance - numAmount;
  const canSend = recipient && numAmount > 0 && !exceeds && !busy;

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      await emit(socket, 'transfer', { toId, amount: numAmount });
      toast.success(`${recipient.name}'e ${fmt(numAmount, cur)} gönderildi`);
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="💸 Para Gönder" headerColor={me.color}>
      {/* Bakiye chip */}
      <div className="flex items-center justify-between bg-base-300 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs opacity-70 uppercase tracking-wide">Bakiye</span>
        <span className="font-bold balance-display text-lg">{fmt(me.balance, cur)}</span>
      </div>

      {/* Alıcı */}
      <div className="form-control w-full">
        <div className="label py-1">
          <span className="label-text font-semibold">Alıcı</span>
          {recipient && (
            <span className="label-text-alt text-xs" style={{ color: recipient.color }}>
              ✓ {recipient.name} seçildi
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {others.map(p => {
            const selected = toId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setToId(p.id)}
                className={`relative rounded-xl border-2 px-3 py-3 flex items-center gap-2 transition-all text-left ${selected ? 'shadow-lg scale-[1.02]' : 'opacity-60 hover:opacity-100 active:scale-95'}`}
                style={{
                  borderColor: p.color,
                  backgroundColor: selected ? p.color : 'transparent',
                  color: selected ? 'white' : undefined,
                }}
              >
                {selected && (
                  <span className="absolute top-1 right-1 text-xs">✓</span>
                )}
                <div
                  className="w-3 h-3 rounded-full flex-none"
                  style={{
                    backgroundColor: selected ? 'white' : p.color,
                    boxShadow: selected ? `0 0 0 2px white` : undefined,
                  }}
                />
                <span className="font-bold truncate">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Miktar */}
      <div className="form-control w-full mt-3">
        <div className="label py-1">
          <span className="label-text font-semibold">Miktar</span>
          <button
            type="button"
            className="label-text-alt link link-primary"
            onClick={() => setAmount(String(me.balance))}
          >
            Tümü
          </button>
        </div>
        <label className={`input input-bordered flex items-center gap-2 h-16 ${exceeds ? 'input-error' : ''}`}>
          <input
            type="number"
            inputMode="numeric"
            className="grow text-3xl font-black text-center balance-display bg-transparent border-0 focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="0"
          />
          <span className="text-2xl font-bold opacity-60">{cur}</span>
        </label>
        <div className="label py-1">
          <span className="label-text-alt">
            {exceeds ? (
              <span className="text-error font-semibold">⚠ Yetersiz bakiye</span>
            ) : numAmount > 0 ? (
              <span className="opacity-70">Kalan: <span className="font-semibold balance-display">{fmt(remaining, cur)}</span></span>
            ) : (
              <span className="opacity-50">Hızlı seç ↓</span>
            )}
          </span>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="grid grid-cols-5 gap-1.5">
        {[50, 100, 200, 500, 1000].map(p => (
          <button
            key={p}
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setAmount(String(p))}
            disabled={p > me.balance}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Aksiyonlar */}
      <div className="modal-action mt-4">
        <button className="btn btn-ghost flex-1" onClick={onClose} disabled={busy}>İptal</button>
        <button
          className="btn btn-primary flex-[2] btn-lg"
          onClick={send}
          disabled={!canSend}
        >
          {busy ? (
            <span className="loading loading-spinner loading-sm" />
          ) : !recipient ? (
            'Alıcı seç'
          ) : !numAmount ? (
            'Miktar gir'
          ) : exceeds ? (
            'Yetersiz bakiye'
          ) : (
            <>💸 {recipient.name}'e {fmt(numAmount, cur)} Gönder</>
          )}
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

  const numAmount = Number(amount) || 0;
  const exceeds = numAmount > me.balance;
  const remaining = me.balance - numAmount;
  const canPay = numAmount > 0 && !exceeds && !busy;

  return (
    <Modal open={open} onClose={onClose} title="🏦 Bankaya Öde">
      <p className="text-sm opacity-70 -mt-2 mb-3">Vergi, mülk satın alma vb. için kullan.</p>

      <div className="flex items-center justify-between bg-base-300 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs opacity-70 uppercase tracking-wide">Bakiye</span>
        <span className="font-bold balance-display text-lg">{fmt(me.balance, cur)}</span>
      </div>

      <div className="form-control w-full">
        <div className="label py-1">
          <span className="label-text font-semibold">Miktar</span>
          <button type="button" className="label-text-alt link link-primary" onClick={() => setAmount(String(me.balance))}>Tümü</button>
        </div>
        <label className={`input input-bordered flex items-center gap-2 h-16 ${exceeds ? 'input-error' : ''}`}>
          <input
            type="number"
            inputMode="numeric"
            className="grow text-3xl font-black text-center balance-display bg-transparent border-0 focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="0"
          />
          <span className="text-2xl font-bold opacity-60">{cur}</span>
        </label>
        <div className="label py-1">
          <span className="label-text-alt">
            {exceeds ? (
              <span className="text-error font-semibold">⚠ Yetersiz bakiye</span>
            ) : numAmount > 0 ? (
              <span className="opacity-70">Kalan: <span className="font-semibold balance-display">{fmt(remaining, cur)}</span></span>
            ) : (
              <span className="opacity-50">Hızlı seç ↓</span>
            )}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {[50, 100, 200, 500, 1000].map(p => (
          <button
            key={p}
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setAmount(String(p))}
            disabled={p > me.balance}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="modal-action mt-4">
        <button className="btn btn-ghost flex-1" onClick={onClose} disabled={busy}>İptal</button>
        <button className="btn btn-accent flex-[2] btn-lg" onClick={send} disabled={!canPay}>
          {busy ? (
            <span className="loading loading-spinner loading-sm" />
          ) : !numAmount ? (
            'Miktar gir'
          ) : exceeds ? (
            'Yetersiz bakiye'
          ) : (
            <>🏦 Bankaya {fmt(numAmount, cur)} Öde</>
          )}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ open, onClose, title, headerColor, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <dialog className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box p-0 overflow-hidden border-2" style={headerColor ? { borderColor: headerColor } : undefined}>
        {headerColor ? (
          <div
            className="px-4 py-3 flex items-center justify-between text-white"
            style={{ backgroundColor: headerColor }}
          >
            <h3 className="font-bold text-lg">{title}</h3>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle text-white hover:bg-white/20"
              aria-label="Kapat"
            >✕</button>
          </div>
        ) : (
          <h3 className="font-bold text-lg p-4">{title}</h3>
        )}
        <div className="p-4">{children}</div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>kapat</button>
      </form>
    </dialog>
  );
}

createRoot(document.getElementById('root')).render(<App />);
