import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import './i18n.js';
import { useSocket } from './useSocket.js';
import { useWakeLock } from './useWakeLock.js';
import { emit, describeTx, txDirection, formatRelative, getQuickAmounts, MAX_NAME_LENGTH } from './socket.js';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useTheme } from './useTheme.js';
import { useSoundSetting, useReceiveSound } from './useReceiveSound.js';
import { ConnectionBadge } from './ConnectionBadge.jsx';
import { DiceNotification } from './DiceNotification.jsx';
import { DiceList } from './DiceHistory.jsx';
import { GameTimer } from './GameTimer.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import {
  Send, Building2, Dices, Bell, BellOff, Users,
  Receipt, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, Flag, Building, Pencil,
} from 'lucide-react';
import '../index.css';

function getCookie(name) {
  return document.cookie.split('; ').find(c => c.startsWith(name + '='))?.split('=')[1];
}

function fmt(n, currency) {
  return `${n.toLocaleString()}${currency}`;
}

function App() {
  useTheme();
  const sound = useSoundSetting();
  // Çerez tüm sekmelerde ortak; her sekme açıldığı andaki oyuncu olarak kalmalı
  const [token] = useState(() => getCookie('playerToken'));
  useWakeLock(true);

  if (!token) return <NoToken />;

  const { socket, state, connected, diceRoll } = useSocket({ token });
  const [activeRoll, setActiveRoll] = useState(null);

  useEffect(() => { if (diceRoll) setActiveRoll(diceRoll); }, [diceRoll]);

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const me = state.players.find(p => p.token === token);
  if (!me) return <NoToken />;

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <Toaster position="top-center" toastOptions={{ duration: 2000 }} />
      <TopBar connected={connected} sound={sound} state={state} />
      {state.status === 'setup'
        ? <WaitingView me={me} />
        : <PlayingView socket={socket} state={state} me={me} sound={sound} />}
      {state.status === 'active' && <DiceFab socket={socket} />}
      <DiceNotification
        roll={activeRoll}
        players={state.players}
        onClose={() => setActiveRoll(null)}
      />
    </div>
  );
}

function TopBar({ connected, sound, state }) {
  const { t } = useTranslation();
  const startedAt = state?.startedAt ?? state?.transactions?.[0]?.ts;
  const isActive = state?.status === 'active';
  return (
    <div className="navbar bg-base-200 rounded-box mb-4 min-h-0 py-1 px-3">
      <div className="flex-1 flex items-center gap-2">
        <ConnectionBadge connected={connected} size="sm" />
        {isActive && startedAt && <GameTimer startedAt={startedAt} size="sm" />}
      </div>
      <div className="flex-none gap-1">
        <button
          onClick={sound.toggle}
          className="btn btn-ghost btn-circle btn-sm"
          title={sound.enabled ? t('common.soundOn') : t('common.soundOff')}
          aria-label={sound.enabled ? t('common.soundOn') : t('common.soundOff')}
        >
          {sound.enabled ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
        <LanguageSwitcher size="sm" />
        <ThemeToggle size="sm" />
      </div>
    </div>
  );
}

function DiceFab({ socket }) {
  const { t } = useTranslation();
  const [rolling, setRolling] = useState(false);
  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    try { await emit(socket, 'roll-dice'); }
    catch (e) { toast.error(e.message); }
    setTimeout(() => setRolling(false), 600);
  };
  return (
    <button
      onClick={rollDice}
      disabled={rolling}
      className="btn btn-secondary btn-circle btn-lg fixed bottom-6 right-6 shadow-2xl z-40 w-16 h-16"
      aria-label={t('player.rollDice')}
      title={t('player.rollDice')}
    >
      <Dices size={32} className={rolling ? 'animate-spin' : ''} />
    </button>
  );
}

function NoToken() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card bg-base-200 shadow-xl max-w-md">
        <div className="card-body text-center">
          <div className="text-5xl mb-2">📱</div>
          <h2 className="card-title justify-center">{t('player.notJoinedTitle')}</h2>
          <p className="opacity-70">{t('player.notJoinedHint')}</p>
        </div>
      </div>
    </div>
  );
}

function WaitingView({ me }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body text-center">
          <div className="badge badge-lg text-white font-bold mx-auto" style={{ backgroundColor: me.color }}>
            {me.name}
          </div>
          <h2 className="card-title justify-center mt-4">⏳ {t('player.waitingTitle')}</h2>
          <p className="opacity-70">{t('player.waitingHint')}</p>
          <span className="loading loading-dots loading-md mx-auto mt-2"></span>
        </div>
      </div>
    </div>
  );
}

function PlayingView({ socket, state, me, sound }) {
  const { t } = useTranslation();
  const cur = state.config.currency;
  const otherPlayers = state.players.filter(p => p.id !== me.id);
  const [showSend, setShowSend] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const receivedTx = useReceivedNotification(state, me);

  useReceiveSound(me.balance, sound.enabled);

  return (
    <>
      <div
        className="card bg-base-200 shadow-xl mb-4 overflow-hidden border-2"
        style={{ borderColor: me.color }}
      >
        <div
          className="px-4 py-3 flex items-center justify-center gap-1 text-white"
          style={{ backgroundColor: me.color }}
        >
          <span className="font-black text-xl tracking-wide drop-shadow min-w-0 break-words">{me.name}</span>
          <button
            className="btn btn-ghost btn-sm btn-circle text-white hover:bg-white/20"
            onClick={() => setShowRename(true)}
            aria-label={t('player.renameModal.title')}
            title={t('player.renameModal.title')}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="card-body items-center text-center p-5">
          <div className="balance-display text-6xl font-black my-2 text-primary">
            {fmt(me.balance, cur)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <button
              className="btn btn-primary whitespace-nowrap"
              onClick={() => setShowSend(true)}
              disabled={otherPlayers.length === 0}
            >
              <Send size={18} className="shrink-0" />
              <span>{t('player.sendMoney')}</span>
            </button>
            <button className="btn btn-accent whitespace-nowrap" onClick={() => setShowBank(true)}>
              <Building2 size={18} className="shrink-0" />
              <span>{t('player.payToBank')}</span>
            </button>
          </div>
        </div>
      </div>

      <PlayerList state={state} me={me} />
      <HistoryCard state={state} me={me} />

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
      <RenameModal
        open={showRename}
        socket={socket}
        me={me}
        onClose={() => setShowRename(false)}
      />
      {receivedTx.tx && (
        <ReceiveNotification
          tx={receivedTx.tx}
          state={state}
          onClose={receivedTx.dismiss}
        />
      )}
    </>
  );
}

function useReceivedNotification(state, me) {
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

function ReceiveNotification({ tx, state, onClose }) {
  const { t } = useTranslation();
  const cur = state.config.currency;
  const sender = state.players.find(p => p.id === tx.from);
  const senderName = sender?.name ?? t('common.bank');
  const color = sender?.color ?? '#475569';

  const label = tx.type === 'pass-go'
    ? t('receive.passGoBonus')
    : tx.type === 'banker-credit'
      ? t('receive.fromBank')
      : t('receive.moneyArrived');

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-6 cursor-pointer"
      style={{ backgroundColor: color }}
      onClick={onClose}
    >
      <div className="receive-notification text-center text-white">
        <div className="text-2xl opacity-90 font-semibold mb-3 drop-shadow">{label}</div>
        <div className="text-5xl font-black mb-6 drop-shadow tracking-tight">{senderName}</div>
        <div className="text-7xl font-black drop-shadow balance-display">
          +{tx.amount.toLocaleString()}{cur}
        </div>
        <div className="mt-10 text-sm opacity-70">{t('receive.tapToClose')}</div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 bg-white/40 receive-progress" />
    </div>
  );
}

function PlayerList({ state, me }) {
  const { t } = useTranslation();
  const cur = state.config.currency;
  const others = state.players.filter(p => p.id !== me.id);
  if (others.length === 0) return null;
  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <h3 className="font-bold text-sm opacity-70 uppercase tracking-wide mb-2">{t('player.otherPlayers')}</h3>
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
  'transfer':       { Icon: ArrowLeftRight,  color: 'text-info' },
  'pass-go':        { Icon: Dices,           color: 'text-success' },
  'banker-credit':  { Icon: ArrowDownToLine, color: 'text-success' },
  'banker-debit':   { Icon: ArrowUpFromLine, color: 'text-error' },
  'initial':        { Icon: Flag,            color: 'text-warning' },
};

function HistoryCard({ state, me }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('tx');
  const txCount = state.transactions.length;
  const diceCount = state.diceRolls?.length ?? 0;

  return (
    <div className="card bg-base-200 shadow-md mb-4">
      <div className="card-body p-4">
        <div role="tablist" className="tabs tabs-boxed bg-base-300">
          <button
            type="button"
            role="tab"
            className={`tab gap-2 flex-1 ${tab === 'tx' ? 'tab-active' : ''}`}
            onClick={() => setTab('tx')}
          >
            <Receipt size={16} /> {t('history.transactions')}
            <span className="badge badge-ghost badge-xs">{txCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            className={`tab gap-2 flex-1 ${tab === 'dice' ? 'tab-active' : ''}`}
            onClick={() => setTab('dice')}
          >
            <Dices size={16} /> {t('history.dice')}
            <span className="badge badge-ghost badge-xs">{diceCount}</span>
          </button>
        </div>

        {tab === 'tx' ? <TxList state={state} me={me} /> : <DiceList state={state} />}
      </div>
    </div>
  );
}

function TxList({ state, me }) {
  const { t } = useTranslation();
  const cur = state.config.currency;
  const [filter, setFilter] = useState('all');
  const allTxs = [...state.transactions].slice(-100).reverse();

  const filterFn = (tx) => {
    if (filter === 'all') return true;
    if (filter === 'me') return tx.from === me.id || tx.to === me.id;
    if (filter === 'bank') return !tx.from || !tx.to;
    return true;
  };
  const txs = allTxs.filter(filterFn);

  return (
    <>
      <div role="tablist" className="tabs tabs-boxed tabs-sm bg-base-300 mt-3">
        <button
          type="button"
          role="tab"
          className={`tab ${filter === 'all' ? 'tab-active' : ''}`}
          onClick={() => setFilter('all')}
        >{t('common.all')}</button>
        <button
          type="button"
          role="tab"
          className={`tab gap-1 ${filter === 'me' ? 'tab-active' : ''}`}
          onClick={() => setFilter('me')}
          style={filter === 'me' ? { backgroundColor: me.color, color: 'white' } : undefined}
        >{t('common.you')}</button>
        <button
          type="button"
          role="tab"
          className={`tab gap-1 ${filter === 'bank' ? 'tab-active' : ''}`}
          onClick={() => setFilter('bank')}
        ><Building size={14} /> {t('common.bank')}</button>
      </div>

      {allTxs.length === 0 ? (
        <div className="text-center py-6 opacity-50 text-sm">
          <div className="text-3xl">📭</div>
          <p>{t('history.noTransactions')}</p>
        </div>
      ) : txs.length === 0 ? (
        <div className="text-center py-6 opacity-50 text-sm">
          <div className="text-3xl">🔍</div>
          <p>{t('history.noFilteredTransactions')}</p>
        </div>
      ) : (
        <ul className="space-y-1 max-h-80 overflow-y-auto mt-3">
          {txs.map(tx => {
            const dir = txDirection(tx, me.id);
            const meta = TX_META[tx.type] ?? { Icon: ArrowLeftRight, color: 'opacity-60' };
            const Icon = meta.Icon;
            const sign = dir === 'in' ? '+' : dir === 'out' ? '−' : '';
            const amountClass = tx.undone
              ? 'opacity-40 line-through'
              : dir === 'in' ? 'text-success font-bold'
              : dir === 'out' ? 'text-error font-bold'
              : '';
            return (
              <li key={tx.id} className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-base-300/30 ${tx.undone ? 'opacity-50' : ''}`}>
                <span className={meta.color}><Icon size={16} /></span>
                <span className="flex-1 text-sm truncate">{describeTx(tx, state.players)}</span>
                <span className={`balance-display ${amountClass}`}>
                  {sign}{fmt(tx.amount, cur)}
                </span>
                <span className="text-xs opacity-50 w-14 text-right">{formatRelative(tx.ts)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function SendModal({ open, socket, state, me, others, onClose }) {
  const { t } = useTranslation();
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

  const isAll = toId === '__all__';
  const recipient = isAll ? null : others.find(p => p.id === toId);
  const numAmount = Number(amount) || 0;
  const totalCost = isAll ? numAmount * others.length : numAmount;
  const exceeds = totalCost > me.balance;
  const remaining = me.balance - totalCost;
  const hasSelection = isAll || !!recipient;
  const canSend = hasSelection && numAmount > 0 && !exceeds && !busy && (!isAll || others.length > 0);

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      if (isAll) {
        for (const p of others) {
          await emit(socket, 'transfer', { toId: p.id, amount: numAmount });
        }
        toast.success(t('player.sendModal.sentAll', {
          count: others.length,
          amount: fmt(numAmount, cur),
          total: fmt(totalCost, cur),
        }));
      } else {
        await emit(socket, 'transfer', { toId, amount: numAmount });
        toast.success(t('player.sendModal.sentSingle', {
          name: recipient.name,
          amount: fmt(numAmount, cur),
        }));
      }
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`💸 ${t('player.sendModal.title')}`} headerColor={me.color}>
      <div className="flex items-center justify-between bg-base-300 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs opacity-70 uppercase tracking-wide">{t('common.balance')}</span>
        <span className="font-bold balance-display text-lg">{fmt(me.balance, cur)}</span>
      </div>

      <div className="form-control w-full">
        <div className="label py-1">
          <span className="label-text font-semibold">{t('player.sendModal.recipient')}</span>
          {isAll && (
            <span className="label-text-alt text-xs text-secondary">
              {t('player.sendModal.allSelected', { count: others.length })}
            </span>
          )}
          {recipient && (
            <span className="label-text-alt text-xs" style={{ color: recipient.color }}>
              {t('player.sendModal.selected', { name: recipient.name })}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setToId('__all__')}
          className={`w-full mb-2 rounded-xl border-2 px-4 py-3 flex items-center gap-3 transition-all text-left ${isAll ? 'shadow-lg scale-[1.01] bg-secondary text-secondary-content border-secondary' : 'opacity-70 hover:opacity-100 active:scale-95 border-dashed border-secondary'}`}
        >
          <Users size={22} className="shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-bold">{t('player.sendModal.sendToAll')}</div>
            <div className="text-xs opacity-80">{t('player.sendModal.sendToAllSubtitle', { count: others.length })}</div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2">
          {others.map(p => {
            const selected = toId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setToId(p.id)}
                className={`relative rounded-xl border-2 px-4 py-4 flex items-center gap-3 transition-all text-left ${selected ? 'shadow-lg scale-[1.02]' : 'opacity-60 hover:opacity-100 active:scale-95'}`}
                style={{
                  borderColor: p.color,
                  backgroundColor: selected ? p.color : 'transparent',
                  color: selected ? 'white' : undefined,
                }}
              >
                {selected && (
                  <span className="absolute -top-2 -right-2 bg-white text-success rounded-full w-7 h-7 flex items-center justify-center shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
                <div
                  className="w-4 h-4 rounded-full flex-none"
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

      <div className="form-control w-full mt-3">
        <div className="label py-1">
          <span className="label-text font-semibold">
            {isAll ? t('player.sendModal.amountPerPerson') : t('player.sendModal.amount')}
          </span>
          <button
            type="button"
            className="label-text-alt link link-primary"
            onClick={() => {
              const max = isAll && others.length > 0
                ? Math.floor(me.balance / others.length)
                : me.balance;
              setAmount(String(max));
            }}
          >
            {t('player.sendModal.all')}
          </button>
        </div>
        <label className={`input input-bordered flex items-center gap-2 h-16 ${exceeds ? 'input-error' : ''}`}>
          <input
            type="text"
            inputMode="numeric" pattern="[0-9]*" size="1"
            className="grow min-w-0 text-3xl font-black text-right balance-display bg-transparent border-0 focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            min="1"
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="0"
          />
          <span className="text-2xl font-bold opacity-60">{cur}</span>
        </label>
        <div className="label py-1">
          <span className="label-text-alt">
            {exceeds ? (
              <span className="text-error font-semibold">{t('player.sendModal.insufficient')}</span>
            ) : numAmount > 0 ? (
              <span className="opacity-70">
                {isAll && (
                  <>
                    {t('common.total')}: <span className="font-semibold balance-display">{fmt(totalCost, cur)}</span>
                    {' • '}
                  </>
                )}
                {t('common.remaining')}: <span className="font-semibold balance-display">{fmt(remaining, cur)}</span>
              </span>
            ) : (
              <span className="opacity-50">{t('player.sendModal.quickPick')}</span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs opacity-60 uppercase tracking-wide">{t('player.sendModal.quickAdd')}</div>
          {numAmount > 0 && (
            <button type="button" className="text-xs link link-error" onClick={() => setAmount('')}>
              {t('common.reset')}
            </button>
          )}
        </div>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(getQuickAmounts(state).length, 6)}, minmax(0, 1fr))` }}
        >
          {getQuickAmounts(state).map(p => {
            const newAmount = numAmount + p;
            const newTotal = isAll ? newAmount * others.length : newAmount;
            return (
              <button
                key={p}
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setAmount(String(newAmount))}
                disabled={newTotal > me.balance}
              >
                +{p}
              </button>
            );
          })}
        </div>
      </div>

      <button
        className="btn btn-primary btn-lg w-full mt-5"
        onClick={send}
        disabled={!canSend}
      >
        {busy ? (
          <span className="loading loading-spinner loading-sm" />
        ) : !hasSelection ? (
          t('player.sendModal.selectRecipient')
        ) : !numAmount ? (
          t('player.sendModal.enterAmount')
        ) : exceeds ? (
          t('player.sendModal.insufficientShort')
        ) : isAll ? (
          t('player.sendModal.sendToAllAction', { amount: fmt(numAmount, cur), total: fmt(totalCost, cur) })
        ) : (
          t('player.sendModal.sendTo', { name: recipient.name, amount: fmt(numAmount, cur) })
        )}
      </button>
    </Modal>
  );
}

function PayBankModal({ open, socket, state, me, onClose }) {
  const { t } = useTranslation();
  const cur = state.config.currency;
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setAmount(''); }, [open]);

  const numAmount = Number(amount) || 0;
  const exceeds = numAmount > me.balance;
  const remaining = me.balance - numAmount;
  const canPay = numAmount > 0 && !exceeds && !busy;

  const send = async () => {
    if (!numAmount || exceeds) return;
    setBusy(true);
    try {
      await emit(socket, 'pay-to-bank', { amount: numAmount });
      toast.success(t('player.payBankModal.paid', { amount: fmt(numAmount, cur) }));
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`🏦 ${t('player.payBankModal.title')}`}>
      <p className="text-sm opacity-70 -mt-2 mb-3">{t('player.payBankModal.hint')}</p>

      <div className="flex items-center justify-between bg-base-300 rounded-lg px-3 py-2 mb-3">
        <span className="text-xs opacity-70 uppercase tracking-wide">{t('common.balance')}</span>
        <span className="font-bold balance-display text-lg">{fmt(me.balance, cur)}</span>
      </div>

      <div className="form-control w-full">
        <div className="label py-1">
          <span className="label-text font-semibold">{t('player.sendModal.amount')}</span>
          <button type="button" className="label-text-alt link link-primary" onClick={() => setAmount(String(me.balance))}>{t('player.sendModal.all')}</button>
        </div>
        <label className={`input input-bordered flex items-center gap-2 h-16 ${exceeds ? 'input-error' : ''}`}>
          <input
            type="text"
            inputMode="numeric" pattern="[0-9]*" size="1"
            className="grow min-w-0 text-3xl font-black text-right balance-display bg-transparent border-0 focus:outline-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
            min="1"
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="0"
          />
          <span className="text-2xl font-bold opacity-60">{cur}</span>
        </label>
        <div className="label py-1">
          <span className="label-text-alt">
            {exceeds ? (
              <span className="text-error font-semibold">{t('player.sendModal.insufficient')}</span>
            ) : numAmount > 0 ? (
              <span className="opacity-70">{t('common.remaining')}: <span className="font-semibold balance-display">{fmt(remaining, cur)}</span></span>
            ) : (
              <span className="opacity-50">{t('player.sendModal.quickPick')}</span>
            )}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs opacity-60 uppercase tracking-wide">{t('player.sendModal.quickAdd')}</div>
          {numAmount > 0 && (
            <button type="button" className="text-xs link link-error" onClick={() => setAmount('')}>
              {t('common.reset')}
            </button>
          )}
        </div>
        <div
          className="grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${Math.min(getQuickAmounts(state).length, 6)}, minmax(0, 1fr))` }}
        >
          {getQuickAmounts(state).map(p => (
            <button
              key={p}
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setAmount(String(numAmount + p))}
              disabled={numAmount + p > me.balance}
            >
              +{p}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-accent btn-lg w-full mt-5" onClick={send} disabled={!canPay}>
        {busy ? (
          <span className="loading loading-spinner loading-sm" />
        ) : !numAmount ? (
          t('player.sendModal.enterAmount')
        ) : exceeds ? (
          t('player.sendModal.insufficientShort')
        ) : (
          t('player.payBankModal.pay', { amount: fmt(numAmount, cur) })
        )}
      </button>
    </Modal>
  );
}

function RenameModal({ open, socket, me, onClose }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) setName(me.name); }, [open]);

  const trimmed = name.trim();
  const canSave = !!trimmed && trimmed !== me.name && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await emit(socket, 'rename-player', { name: trimmed });
      toast.success(t('player.renameModal.saved'));
      onClose();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('player.renameModal.title')} headerColor={me.color}>
      <div className="form-control w-full">
        <div className="label py-1">
          <span className="label-text font-semibold">{t('player.renameModal.label')}</span>
        </div>
        <input
          type="text"
          className="input input-bordered w-full"
          value={name}
          maxLength={MAX_NAME_LENGTH}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>

      <button className="btn btn-primary w-full mt-5" onClick={save} disabled={!canSave}>
        {busy ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          t('common.save')
        )}
      </button>
    </Modal>
  );
}

function Modal({ open, onClose, title, headerColor, children }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 modal-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-base-100 rounded-t-2xl sm:rounded-2xl border-2 overflow-hidden max-h-[90vh] overflow-y-auto modal-slide-in"
        style={headerColor ? { borderColor: headerColor } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`px-4 py-3 flex items-center justify-between sticky top-0 z-10 ${headerColor ? 'text-white' : 'bg-base-100 border-b border-base-300'}`}
          style={headerColor ? { backgroundColor: headerColor } : undefined}
        >
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className={`btn btn-circle btn-ghost ${headerColor ? 'text-white hover:bg-white/20' : ''}`}
            aria-label={t('common.close')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
