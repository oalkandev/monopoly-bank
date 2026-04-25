import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { useSocket } from './useSocket.js';
import { emit, describeTx } from './socket.js';
import { QrCode } from './QrCode.jsx';
import '../index.css';

const PLAYER_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#f59e0b', '#9333ea', '#0891b2', '#db2777', '#65a30d'];

function fmt(n, currency) {
  return `${n.toLocaleString('tr-TR')}${currency}`;
}

function App() {
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
    <div className="min-h-screen p-4 max-w-6xl mx-auto">
      <Toaster position="top-right" />
      <Header connected={connected} lanUrl={lanUrl} />
      {state.status === 'setup'
        ? <SetupView socket={socket} state={state} lanUrl={lanUrl} />
        : <ActiveView socket={socket} state={state} />}
    </div>
  );
}

function Header({ connected, lanUrl }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
      <h1 className="text-3xl font-black flex items-center gap-2">
        <span className="text-4xl">🏦</span> Monopoly Bank
      </h1>
      <div className="flex items-center gap-2">
        <code className="text-xs opacity-70 bg-base-300 px-2 py-1 rounded">{lanUrl}</code>
        <div className={`badge badge-lg ${connected ? 'badge-success' : 'badge-error'}`}>
          {connected ? '● Bağlı' : '○ Bağlantı yok'}
        </div>
      </div>
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">⚙️ Oyun Ayarları</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="form-control">
              <div className="label"><span className="label-text font-semibold">Başlangıç Parası</span></div>
              <input type="number" className="input input-bordered" value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)} min="1" />
            </label>
            <label className="form-control">
              <div className="label"><span className="label-text font-semibold">GO Bonusu</span></div>
              <input type="number" className="input input-bordered" value={passGoBonus}
                onChange={(e) => setPassGoBonus(e.target.value)} min="0" />
            </label>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">👥 Oyuncular ({state.players.length})</h2>
          <div className="flex flex-wrap gap-2 items-end">
            <input
              className="input input-bordered flex-1 min-w-40"
              placeholder="Oyuncu adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            />
            <div className="flex gap-1 flex-wrap">
              {PLAYER_COLORS.map(c => (
                <button
                  key={c}
                  className={`w-10 h-10 rounded-full border-4 ${color === c ? 'border-base-content' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Renk ${c}`}
                />
              ))}
            </div>
            <button className="btn btn-primary" onClick={addPlayer}>+ Ekle</button>
          </div>

          {state.players.length === 0 && (
            <div className="alert mt-4">
              <span>İlk oyuncuyu ekleyin. En az 2 oyuncu gerekiyor.</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {state.players.map(p => (
              <PlayerJoinCard key={p.id} player={p} lanUrl={lanUrl} onRemove={() => removePlayer(p.id, p.name)} />
            ))}
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg w-full"
        disabled={state.players.length < 2}
        onClick={startGame}
      >
        🎲 Oyunu Başlat
        {state.players.length < 2 && ` (${state.players.length}/2 oyuncu gerekli)`}
      </button>
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
    } catch {
      toast.error('Kopyalanamadı');
    }
  };

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4">
        <div className="flex items-center justify-between">
          <div className="badge badge-lg text-white font-bold" style={{ backgroundColor: player.color }}>
            {player.name}
          </div>
          <button className="btn btn-ghost btn-xs text-error" onClick={onRemove}>✕ Sil</button>
        </div>
        <div className="flex justify-center my-3">
          <QrCode value={link} size={140} />
        </div>
        <button className="btn btn-sm btn-outline w-full" onClick={copy}>
          {copied ? '✓ Kopyalandı' : '📋 Linki Kopyala'}
        </button>
      </div>
    </div>
  );
}

function ActiveView({ socket, state }) {
  return (
    <div className="space-y-4">
      <ConfigBar socket={socket} state={state} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.players.map(p => (
          <BankerPlayerCard key={p.id} socket={socket} player={p} state={state} />
        ))}
      </div>
      <TransactionList socket={socket} state={state} canUndo />
      <ResetButton socket={socket} />
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

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body p-4 flex-row items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-70">Para birimi:</span>
          <span className="font-bold">{state.config.currency}</span>
          <span className="divider divider-horizontal"></span>
          <span className="text-sm opacity-70">GO bonusu:</span>
          {editing ? (
            <>
              <input
                type="number"
                className="input input-bordered input-sm w-24"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                min="0"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <button className="btn btn-sm btn-primary" onClick={save}>Kaydet</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { setBonus(state.config.passGoBonus); setEditing(false); }}>İptal</button>
            </>
          ) : (
            <>
              <span className="font-bold">{fmt(state.config.passGoBonus, state.config.currency)}</span>
              <button className="btn btn-xs btn-ghost" onClick={() => setEditing(true)}>✎ Değiştir</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BankerPlayerCard({ socket, player, state }) {
  const [amount, setAmount] = useState('');
  const cur = state.config.currency;

  const adjust = async (sign) => {
    const v = Number(amount);
    if (!Number.isFinite(v) || v <= 0) return toast.error('Pozitif bir miktar girin');
    try {
      await emit(socket, 'banker-adjust', { playerId: player.id, amount: sign * v });
      setAmount('');
      toast.success(sign > 0 ? `+${fmt(v, cur)} verildi` : `-${fmt(v, cur)} alındı`);
    } catch (e) { toast.error(e.message); }
  };

  const passGo = async () => {
    try {
      await emit(socket, 'banker-adjust', { playerId: player.id, amount: state.config.passGoBonus });
      toast.success(`GO bonusu verildi: ${fmt(state.config.passGoBonus, cur)}`);
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="badge badge-lg text-white font-bold" style={{ backgroundColor: player.color }}>
            {player.name}
          </div>
          <span className={`badge ${player.online ? 'badge-success' : 'badge-ghost'} badge-sm`}>
            {player.online ? '● çevrimiçi' : '○ çevrimdışı'}
          </span>
        </div>
        <div className="balance-display text-center text-5xl font-black my-2">
          {fmt(player.balance, cur)}
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Miktar"
            className="input input-bordered flex-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-success flex-1" onClick={() => adjust(1)}>+ Para Ver</button>
          <button className="btn btn-error flex-1" onClick={() => adjust(-1)}>− Para Al</button>
        </div>
        <button className="btn btn-outline btn-sm mt-2" onClick={passGo}>
          🎲 GO Bonusu (+{fmt(state.config.passGoBonus, cur)})
        </button>
      </div>
    </div>
  );
}

function TransactionList({ socket, state, canUndo }) {
  const cur = state.config.currency;
  const txs = [...state.transactions].reverse();

  const undo = async (id) => {
    try {
      await emit(socket, 'undo', { transactionId: id });
      toast.success('İşlem geri alındı');
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <h2 className="card-title">📜 İşlem Geçmişi</h2>
        {txs.length === 0 && <p className="opacity-60">Henüz işlem yok.</p>}
        <div className="overflow-y-auto max-h-96">
          {txs.map(t => (
            <div
              key={t.id}
              className={`flex items-center justify-between py-2 border-b last:border-b-0 border-base-300 ${t.undone ? 'opacity-40 line-through' : ''}`}
            >
              <div className="flex items-center gap-2">
                <TxIcon type={t.type} />
                <span>{describeTx(t, state.players)}</span>
                <span className="font-bold balance-display">{fmt(t.amount, cur)}</span>
              </div>
              {canUndo && !t.undone && (
                <button className="btn btn-ghost btn-xs" onClick={() => undo(t.id)}>↩ Geri Al</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TxIcon({ type }) {
  const map = {
    'transfer': '↔️',
    'pass-go': '🎲',
    'banker-credit': '💵',
    'banker-debit': '💸',
    'initial': '🏁',
  };
  return <span>{map[type] ?? '•'}</span>;
}

function ResetButton({ socket }) {
  const onReset = async () => {
    if (!confirm('Tüm oyun sıfırlansın mı? Oyuncular ve bakiyeler silinecek.')) return;
    try {
      await emit(socket, 'reset');
      toast.success('Oyun sıfırlandı');
    } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="text-center">
      <button className="btn btn-error btn-outline" onClick={onReset}>🔄 Oyunu Sıfırla</button>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
