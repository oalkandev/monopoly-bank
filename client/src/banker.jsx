import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { useSocket } from './useSocket.js';
import { emit, formatRelative } from './socket.js';
import { QrCode } from './QrCode.jsx';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useTheme } from './useTheme.js';
import '../index.css';

const PLAYER_COLORS = [
  '#3b82f6', // mavi
  '#ef4444', // kırmızı
  '#eab308', // sarı
  '#22c55e', // yeşil
  '#a855f7', // mor
  '#06b6d4', // turkuaz
  '#ec4899', // pembe
  '#f97316', // turuncu
];

function fmt(n, currency) {
  return `${n.toLocaleString('tr-TR')}${currency}`;
}

function App() {
  useTheme();
  const { socket, state, connected } = useSocket({ role: 'banker' });
  const [lanUrl, setLanUrl] = useState(location.origin);

  useEffect(() => {
    fetch('/api/server-info')
      .then(r => r.json())
      .then(d => { if (d.lanUrl) setLanUrl(d.lanUrl); })
      .catch(() => {});
  }, []);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-[1600px] mx-auto">
      <Toaster position="top-right" />
      <Header connected={connected} lanUrl={lanUrl} socket={socket} state={state} />
      {state.status === 'setup'
        ? <SetupView socket={socket} state={state} lanUrl={lanUrl} />
        : <ActiveView socket={socket} state={state} lanUrl={lanUrl} />}
    </div>
  );
}

function Header({ connected, lanUrl, socket, state }) {
  const onReset = async () => {
    if (!confirm('Tüm oyun sıfırlansın mı? Oyuncular ve bakiyeler silinecek.')) return;
    try { await emit(socket, 'reset'); toast.success('Oyun sıfırlandı'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
        <span className="text-3xl md:text-4xl">🏦</span> Monopoly Bank
      </h1>
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs opacity-70 bg-base-300 px-2 py-1 rounded hidden sm:inline">{lanUrl}</code>
        <div className={`badge badge-lg gap-1 ${connected ? 'badge-success' : 'badge-error'}`}>
          {connected ? '● Bağlı' : '○ Yok'}
        </div>
        <ThemeToggle />
        {state.status === 'active' && (
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost btn-circle" aria-label="Menü">
              <span className="text-xl">⋮</span>
            </label>
            <ul tabIndex={0} className="menu dropdown-content mt-3 z-[1] p-2 shadow-xl bg-base-200 rounded-box w-52">
              <li><a onClick={onReset} className="text-error">🔄 Oyunu Sıfırla</a></li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── SETUP VIEW ───────── */

function SetupView({ socket, state, lanUrl }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PLAYER_COLORS[state.players.length % PLAYER_COLORS.length]);
  const [startingBalance, setStartingBalance] = useState(state.config.startingBalance);
  const [passGoBonus, setPassGoBonus] = useState(state.config.passGoBonus);

  const addPlayer = async () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.error('İsim girin');
    try {
      await emit(socket, 'add-player', { name: trimmed, color });
      setName('');
      setColor(PLAYER_COLORS[(state.players.length + 1) % PLAYER_COLORS.length]);
    } catch (e) { toast.error(e.message); }
  };

  const removePlayer = async (id, playerName) => {
    if (!confirm(`${playerName} silinsin mi?`)) return;
    try { await emit(socket, 'remove-player', { playerId: id }); }
    catch (e) { toast.error(e.message); }
  };

  const startGame = async () => {
    const sb = Number(startingBalance);
    const pg = Number(passGoBonus);
    if (!Number.isFinite(sb) || sb <= 0) return toast.error('Geçerli başlangıç parası girin');
    try { await emit(socket, 'start-game', { startingBalance: sb, passGoBonus: pg }); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-base">⚙️ Ayarlar</h2>
            <label className="form-control">
              <div className="label py-1"><span className="label-text">Başlangıç Parası</span></div>
              <input type="number" className="input input-bordered" value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)} min="1" />
            </label>
            <label className="form-control">
              <div className="label py-1"><span className="label-text">GO Bonusu</span></div>
              <input type="number" className="input input-bordered" value={passGoBonus}
                onChange={(e) => setPassGoBonus(e.target.value)} min="0" />
            </label>
          </div>
        </div>

        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-base">➕ Oyuncu Ekle</h2>
            <input
              className="input input-bordered"
              placeholder="Oyuncu adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            />
            <div className="flex gap-1 flex-wrap mt-2">
              {PLAYER_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-base-content scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Renk ${c}`}
                />
              ))}
            </div>
            <button className="btn btn-primary mt-2" onClick={addPlayer}>+ Ekle</button>
          </div>
        </div>

        <button
          className="btn btn-success btn-lg w-full"
          disabled={state.players.length < 2}
          onClick={startGame}
        >
          🎲 Oyunu Başlat
          {state.players.length < 2 && ` (${state.players.length}/2)`}
        </button>
      </div>

      <div className="lg:col-span-2">
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title text-base">👥 Oyuncular ({state.players.length})</h2>
            {state.players.length === 0 && (
              <div className="alert alert-info mt-2">
                <span>İlk oyuncuyu ekleyin. En az 2 oyuncu gerekiyor.</span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {state.players.map(p => (
                <PlayerJoinCard key={p.id} player={p} lanUrl={lanUrl} onRemove={() => removePlayer(p.id, p.name)} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerJoinCard({ player, lanUrl, onRemove }) {
  const link = `${lanUrl}/join/${player.token}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Kopyalanamadı'); }
  };

  return (
    <div
      className="card bg-base-100 shadow-sm overflow-hidden border-2"
      style={{ borderColor: player.color }}
    >
      <div
        className="px-3 py-2 flex items-center justify-between text-white"
        style={{ backgroundColor: player.color }}
      >
        <span className="font-bold text-sm drop-shadow-sm">{player.name}</span>
        <button
          className="btn btn-ghost btn-xs text-white hover:bg-white/20"
          onClick={onRemove}
          aria-label="Sil"
        >✕</button>
      </div>
      <div className="card-body p-3">
        <div className="flex gap-3 items-center">
          <QrCode value={link} size={110} />
          <div className="flex-1 min-w-0">
            <p className="text-xs opacity-60 mb-1">QR'ı tara veya:</p>
            <button className="btn btn-sm btn-outline w-full" onClick={copy}>
              {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── ACTIVE VIEW ───────── */

function ActiveView({ socket, state, lanUrl }) {
  const [qrPlayer, setQrPlayer] = useState(null);
  return (
    <>
      <ConfigBar socket={socket} state={state} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {state.players.map(p => (
              <BankerPlayerCard
                key={p.id}
                socket={socket}
                player={p}
                state={state}
                onShowQr={() => setQrPlayer(p)}
              />
            ))}
          </div>
        </div>
        <div className="lg:col-span-1">
          <TransactionFeed socket={socket} state={state} />
        </div>
      </div>
      {qrPlayer && (
        <QrModal player={qrPlayer} lanUrl={lanUrl} onClose={() => setQrPlayer(null)} />
      )}
    </>
  );
}

function QrModal({ player, lanUrl, onClose }) {
  const link = `${lanUrl}/join/${player.token}`;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error('Kopyalanamadı'); }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="card bg-base-100 shadow-2xl max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="card-body items-center text-center">
          <div className="badge badge-lg text-white font-bold text-base px-4 py-3" style={{ backgroundColor: player.color }}>
            {player.name}
          </div>
          <p className="text-sm opacity-70 mt-1">Telefon kameranı QR'a tut</p>
          <div className="bg-white p-3 rounded-xl my-2">
            <QrCode value={link} size={240} />
          </div>
          <code className="text-xs opacity-60 break-all bg-base-200 px-2 py-1 rounded w-full">{link}</code>
          <div className="flex gap-2 w-full mt-2">
            <button className="btn btn-outline flex-1" onClick={copy}>
              {copied ? '✓ Kopyalandı' : '📋 Kopyala'}
            </button>
            <button className="btn btn-primary flex-1" onClick={onClose}>Kapat</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigBar({ socket, state }) {
  const [bonus, setBonus] = useState(state.config.passGoBonus);
  const [editing, setEditing] = useState(false);

  const save = async () => {
    const v = Number(bonus);
    if (!Number.isFinite(v) || v < 0) return toast.error('Geçersiz miktar');
    try {
      await emit(socket, 'update-config', { passGoBonus: v });
      toast.success('GO bonusu güncellendi');
      setEditing(false);
    } catch (e) { toast.error(e.message); }
  };

  const totalMoney = state.players.reduce((sum, p) => sum + p.balance, 0);
  const onlineCount = state.players.filter(p => p.online).length;

  return (
    <div className="card bg-base-200 shadow-md">
      <div className="card-body p-3">
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <Stat label="Oyuncu" value={`${onlineCount}/${state.players.length}`} icon="👥" />
          <Stat label="Toplam Para" value={fmt(totalMoney, state.config.currency)} icon="💰" />
          <Stat label="İşlem" value={state.transactions.filter(t => !t.undone).length} icon="📝" />
          <div className="flex items-center gap-2 ml-auto">
            <span className="opacity-70 text-xs">GO bonusu:</span>
            {editing ? (
              <>
                <input
                  type="number"
                  className="input input-bordered input-sm w-24"
                  value={bonus}
                  onChange={(e) => setBonus(e.target.value)}
                  min="0"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' ? save() : e.key === 'Escape' ? setEditing(false) : null}
                />
                <button className="btn btn-sm btn-primary" onClick={save}>✓</button>
                <button className="btn btn-sm btn-ghost" onClick={() => { setBonus(state.config.passGoBonus); setEditing(false); }}>✕</button>
              </>
            ) : (
              <>
                <span className="font-bold balance-display">{fmt(state.config.passGoBonus, state.config.currency)}</span>
                <button className="btn btn-xs btn-ghost" onClick={() => setEditing(true)}>✎</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <div className="text-xs opacity-60 leading-tight">{label}</div>
        <div className="font-bold balance-display leading-tight">{value}</div>
      </div>
    </div>
  );
}

function BankerPlayerCard({ socket, player, state, onShowQr }) {
  const [amount, setAmount] = useState('');
  const cur = state.config.currency;
  const numAmount = Number(amount) || 0;

  const adjust = async (sign) => {
    if (!Number.isFinite(numAmount) || numAmount <= 0) return toast.error('Pozitif miktar girin');
    try {
      await emit(socket, 'banker-adjust', { playerId: player.id, amount: sign * numAmount });
      setAmount('');
      toast.success(sign > 0 ? `+${fmt(numAmount, cur)} verildi` : `−${fmt(numAmount, cur)} alındı`);
    } catch (e) { toast.error(e.message); }
  };

  const addQuick = (n) => setAmount(String(numAmount + n));

  const passGo = async () => {
    try {
      await emit(socket, 'pass-go', { playerId: player.id });
      toast.success(`+${fmt(state.config.passGoBonus, cur)} (GO)`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div
      className="card bg-base-200 shadow-md hover:shadow-xl transition-all overflow-hidden border-2"
      style={{ borderColor: player.color }}
    >
      <div
        className="px-4 py-2 flex items-center justify-between text-white"
        style={{ backgroundColor: player.color }}
      >
        <span className="font-black text-base tracking-wide drop-shadow-sm">{player.name}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium opacity-90">
            {player.online ? '● çevrimiçi' : '○ çevrimdışı'}
          </span>
          <button
            className="btn btn-ghost btn-xs btn-circle text-white hover:bg-white/20"
            onClick={onShowQr}
            title="QR kodu göster"
            aria-label="QR kodu göster"
          >
            <span className="text-base">📱</span>
          </button>
        </div>
      </div>
      <div className="card-body p-4">
        <div className="balance-display text-center text-3xl xl:text-4xl font-black my-1">
          {fmt(player.balance, cur)}
        </div>
        <div className="join w-full">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Miktar"
            className="input input-bordered input-sm join-item flex-1 min-w-0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            onKeyDown={(e) => e.key === 'Enter' && adjust(1)}
          />
          <button className="btn btn-success btn-sm join-item" onClick={() => adjust(1)} title="Para ver">+</button>
          <button className="btn btn-error btn-sm join-item" onClick={() => adjust(-1)} title="Para al">−</button>
        </div>
        <div className="grid grid-cols-5 gap-1 mt-1">
          {[50, 100, 200, 500, 1000].map(n => (
            <button
              key={n}
              type="button"
              className="btn btn-xs btn-outline"
              onClick={() => addQuick(n)}
            >
              +{n}
            </button>
          ))}
        </div>
        <button className="btn btn-outline btn-warning btn-block mt-2" onClick={passGo}>
          🎲 GO Bonusu Ver (+{fmt(state.config.passGoBonus, cur)})
        </button>
      </div>
    </div>
  );
}

function TransactionFeed({ socket, state }) {
  const [, force] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'bank' | 'player:<id>'

  useEffect(() => {
    const id = setInterval(() => force(n => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const undo = async (id) => {
    try { await emit(socket, 'undo', { transactionId: id }); toast.success('Geri alındı'); }
    catch (e) { toast.error(e.message); }
  };

  const allTxs = [...state.transactions].reverse();
  const txs = allTxs.filter(t => matchFilter(t, filter));

  return (
    <div className="card bg-base-200 shadow-md sticky top-4">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-base">📜 İşlem Geçmişi</h2>
          <span className="badge badge-ghost badge-sm">
            {filter === 'all' ? allTxs.length : `${txs.length}/${allTxs.length}`}
          </span>
        </div>

        <FilterBar state={state} filter={filter} setFilter={setFilter} />

        {allTxs.length === 0 ? (
          <div className="text-center py-8 opacity-50 text-sm">
            <div className="text-3xl mb-2">📭</div>
            Henüz işlem yok
          </div>
        ) : txs.length === 0 ? (
          <div className="text-center py-8 opacity-50 text-sm">
            <div className="text-3xl mb-2">🔍</div>
            Bu filtreye uyan işlem yok
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[65vh] -mx-2 px-2">
            {txs.map(t => (
              <TxRow key={t.id} tx={t} state={state} onUndo={undo} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function matchFilter(tx, filter) {
  if (filter === 'all') return true;
  if (filter === 'bank') {
    // Banka taraflı: en az bir taraf yok (yani Banka)
    return !tx.from || !tx.to;
  }
  if (filter.startsWith('player:')) {
    const id = filter.slice(7);
    return tx.from === id || tx.to === id;
  }
  return true;
}

function FilterBar({ state, filter, setFilter }) {
  const FilterChip = ({ value, label, color, active }) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition-all whitespace-nowrap ${active ? 'shadow-sm scale-105' : 'opacity-60 hover:opacity-100'}`}
      style={{
        borderColor: color,
        backgroundColor: active ? color : 'transparent',
        color: active ? 'white' : color,
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex gap-1.5 flex-wrap mt-1 mb-2">
      <button
        type="button"
        onClick={() => setFilter('all')}
        className={`btn btn-xs ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
      >
        Tümü
      </button>
      <FilterChip
        value="bank"
        label="🏦 Banka"
        color="#64748b"
        active={filter === 'bank'}
      />
      {state.players.map(p => (
        <FilterChip
          key={p.id}
          value={`player:${p.id}`}
          label={p.name}
          color={p.color}
          active={filter === `player:${p.id}`}
        />
      ))}
    </div>
  );
}

function TxRow({ tx, state, onUndo }) {
  const cur = state.config.currency;
  const fromP = state.players.find(p => p.id === tx.from);
  const toP = state.players.find(p => p.id === tx.to);
  const meta = TX_META[tx.type] ?? { icon: '•', label: tx.type, color: 'opacity-60' };

  return (
    <div className={`group rounded-lg p-2 hover:bg-base-300/50 transition-colors ${tx.undone ? 'opacity-40' : ''}`}>
      <div className="flex items-start gap-2">
        <span className={`text-lg leading-none mt-0.5 ${meta.color}`}>{meta.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap text-sm">
            {fromP ? <Chip player={fromP} /> : <span className="opacity-60 text-xs">Banka</span>}
            <span className="opacity-50">→</span>
            {toP ? <Chip player={toP} /> : <span className="opacity-60 text-xs">Banka</span>}
          </div>
          <div className="flex items-baseline justify-between gap-2 mt-1">
            <span className={`font-bold balance-display ${tx.undone ? 'line-through' : ''}`}>
              {fmt(tx.amount, cur)}
            </span>
            <span className="text-xs opacity-50">{formatRelative(tx.ts)}</span>
          </div>
        </div>
        {!tx.undone && (
          <button
            className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onUndo(tx.id)}
            title="Geri al"
          >
            ↩
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ player }) {
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded text-white"
      style={{ backgroundColor: player.color }}
    >
      {player.name}
    </span>
  );
}

const TX_META = {
  'transfer': { icon: '↔', label: 'Transfer', color: 'text-info' },
  'pass-go': { icon: '🎲', label: 'GO', color: 'text-success' },
  'banker-credit': { icon: '⬆', label: 'Banka kredisi', color: 'text-success' },
  'banker-debit': { icon: '⬇', label: 'Banka borcu', color: 'text-error' },
  'initial': { icon: '🏁', label: 'Başlangıç', color: 'text-warning' },
};

createRoot(document.getElementById('root')).render(<App />);
