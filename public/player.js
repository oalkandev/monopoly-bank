import { connect, emit, describeTx } from '/socket-client.js';
import { el, replaceChildren } from '/dom.js';

const $ = (id) => document.getElementById(id);
const cookieToken = document.cookie.split('; ')
  .find(c => c.startsWith('playerToken='))?.split('=')[1];

if (!cookieToken) {
  $('loading').hidden = true;
  $('noToken').hidden = false;
} else {
  const socket = connect();
  let me = null;
  let currentState = null;

  socket.on('state', (s) => {
    currentState = s;
    me = s.players.find(p => p.token === cookieToken);
    if (!me) {
      $('loading').hidden = true;
      $('setup').hidden = true;
      $('active').hidden = true;
      $('noToken').hidden = false;
      return;
    }
    render(s);
  });

  $('goBtn').addEventListener('click', async () => {
    try { await emit(socket, 'pass-go'); } catch (e) { alert(e.message); }
  });

  $('sendBtn').addEventListener('click', () => {
    const others = currentState.players.filter(p => p.id !== me.id);
    if (others.length === 0) return alert('Gönderilecek başka oyuncu yok');
    const opts = others.map(p => el('option', { value: p.id }, [p.name]));
    replaceChildren($('recipient'), opts);
    $('amount').value = '';
    $('sendModal').hidden = false;
    setTimeout(() => $('amount').focus(), 50);
  });

  $('sendCancel').addEventListener('click', () => { $('sendModal').hidden = true; });

  $('sendConfirm').addEventListener('click', async () => {
    const toId = $('recipient').value;
    const amount = Number($('amount').value);
    if (!amount || amount <= 0) return alert('Geçersiz miktar');
    try {
      await emit(socket, 'transfer', { toId, amount });
      $('sendModal').hidden = true;
    } catch (e) { alert(e.message); }
  });

  $('amount').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('sendConfirm').click();
  });

  function render(s) {
    $('loading').hidden = true;
    $('noToken').hidden = true;
    const isSetup = s.status === 'setup';
    $('setup').hidden = !isSetup;
    $('active').hidden = isSetup;

    if (isSetup) {
      $('setupName').textContent = `Sen: ${me.name}`;
      return;
    }

    $('me').textContent = me.name;
    $('me').style.background = me.color;
    $('balance').textContent = `${me.balance.toLocaleString('tr-TR')}${s.config.currency}`;
    $('goBtn').textContent = `GO'dan Geçtim (+${s.config.passGoBonus}${s.config.currency})`;

    const rows = [...s.transactions].slice(-30).reverse().map(t => {
      const involvesMe = t.from === me.id || t.to === me.id;
      return el('div', {
        class: `tx-row${t.undone ? ' undone' : ''}`,
        style: involvesMe ? { fontWeight: '600' } : {},
      }, [el('span', {}, [describeTx(t, s)])]);
    });
    if (rows.length === 0) {
      replaceChildren($('transactions'), [
        el('p', { style: { color: '#999', textAlign: 'center' } }, ['Henüz işlem yok']),
      ]);
    } else {
      replaceChildren($('transactions'), rows);
    }
  }
}
