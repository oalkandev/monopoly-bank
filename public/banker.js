import { connect, emit, describeTx } from '/socket-client.js';
import { el, replaceChildren } from '/dom.js';

const socket = connect({ role: 'banker' });
const $ = (id) => document.getElementById(id);
let currentState = null;

socket.on('state', (s) => { currentState = s; render(s); });
socket.on('connect_error', (err) => console.error('Bağlantı hatası:', err));

$('addPlayer').addEventListener('click', async () => {
  const name = $('newName').value.trim();
  const color = $('newColor').value;
  if (!name) { alert('İsim girin'); return; }
  try {
    await emit(socket, 'add-player', { name, color });
    $('newName').value = '';
    $('newName').focus();
  } catch (e) { alert(e.message); }
});

$('newName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('addPlayer').click();
});

$('startGame').addEventListener('click', async () => {
  const startingBalance = Number($('startingBalance').value);
  const passGoBonus = Number($('passGoBonus').value);
  if (!Number.isFinite(startingBalance) || startingBalance <= 0) {
    return alert('Geçerli başlangıç parası girin');
  }
  try { await emit(socket, 'start-game', { startingBalance, passGoBonus }); }
  catch (e) { alert(e.message); }
});

$('reset').addEventListener('click', async () => {
  if (!confirm('Oyun sıfırlansın mı? Tüm bakiyeler ve oyuncular silinecek.')) return;
  try { await emit(socket, 'reset'); } catch (e) { alert(e.message); }
});

function render(s) {
  const isSetup = s.status === 'setup';
  $('setup').hidden = !isSetup;
  $('active').hidden = isSetup;
  if (isSetup) renderSetup(s); else renderActive(s);
}

function renderSetup(s) {
  $('startingBalance').value = s.config.startingBalance;
  $('passGoBonus').value = s.config.passGoBonus;

  const cards = s.players.map(p => {
    const link = `${location.origin}/join/${p.token}`;
    return el('div', { class: 'card', style: { margin: 0 } }, [
      el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
        el('span', { class: 'player-chip', style: { background: p.color } }, [p.name]),
        el('button', {
          class: 'secondary',
          style: { padding: '4px 8px', fontSize: '12px', minHeight: 'auto' },
          onClick: async () => {
            if (!confirm(`${p.name} silinsin mi?`)) return;
            try { await emit(socket, 'remove-player', { playerId: p.id }); }
            catch (e) { alert(e.message); }
          },
        }, ['Sil']),
      ]),
      el('p', { style: { fontSize: '12px', wordBreak: 'break-all', margin: '8px 0 4px' } }, [
        el('strong', {}, ['Katılım linki: ']),
        el('br'),
        el('code', {}, [link]),
      ]),
      el('button', {
        class: 'secondary',
        style: { width: '100%', marginTop: '8px', fontSize: '14px' },
        onClick: () => {
          navigator.clipboard?.writeText(link);
          alert('Link kopyalandı');
        },
      }, ['Linki Kopyala']),
    ]);
  });
  replaceChildren($('players'), cards);
  $('startGame').disabled = s.players.length < 2;
  $('startGame').textContent = s.players.length < 2
    ? `Oyunu Başlat (${s.players.length}/2 oyuncu)`
    : `Oyunu Başlat (${s.players.length} oyuncu)`;
}

function renderActive(s) {
  const cur = s.config.currency;

  const playerCards = s.players.map(p => {
    const input = el('input', {
      type: 'number',
      placeholder: '+/- miktar',
      style: { width: '120px' },
    });
    const apply = el('button', {
      onClick: async () => {
        const amount = Number(input.value);
        if (!amount) return;
        try {
          await emit(socket, 'banker-adjust', { playerId: p.id, amount });
          input.value = '';
        } catch (e) { alert(e.message); }
      },
    }, ['Uygula']);

    return el('div', { class: 'card', style: { margin: 0 } }, [
      el('div', { class: 'row', style: { justifyContent: 'space-between' } }, [
        el('span', { class: 'player-chip', style: { background: p.color } }, [p.name]),
        el('span', { class: p.online ? 'online-dot' : 'offline-dot' }, [
          p.online ? '● çevrimiçi' : '○ çevrimdışı',
        ]),
      ]),
      el('div', { class: 'balance' }, [`${p.balance.toLocaleString('tr-TR')}${cur}`]),
      el('div', { class: 'row' }, [input, apply]),
    ]);
  });
  replaceChildren($('activePlayers'), playerCards);

  const txRows = [...s.transactions].reverse().map(t => {
    const undoBtn = t.undone ? null : el('button', {
      class: 'secondary',
      style: { padding: '4px 8px', fontSize: '12px', minHeight: 'auto' },
      onClick: async () => {
        try { await emit(socket, 'undo', { transactionId: t.id }); }
        catch (e) { alert(e.message); }
      },
    }, ['Geri Al']);
    return el('div', { class: `tx-row${t.undone ? ' undone' : ''}` }, [
      el('span', {}, [describeTx(t, s)]),
      undoBtn,
    ]);
  });
  if (txRows.length === 0) {
    replaceChildren($('transactions'), [
      el('p', { style: { color: '#999', textAlign: 'center' } }, ['Henüz işlem yok']),
    ]);
  } else {
    replaceChildren($('transactions'), txRows);
  }
}
