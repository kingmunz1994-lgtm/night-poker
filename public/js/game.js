// ── Night Poker — Game State & Logic ─────────────────────────

// ── Demo tables ──────────────────────────────────────────────
const DEMO_TABLES = [
  { id: 'tbl-1', name: 'Midnight Lounge',  bigBlind: 100,  smallBlind: 50,   maxBuyIn: 10000, rake: 50, players: 3, maxPlayers: 6, phase: 'waiting' },
  { id: 'tbl-2', name: 'High Roller Room', bigBlind: 1000, smallBlind: 500,  maxBuyIn: 100000,rake: 25, players: 5, maxPlayers: 6, phase: 'playing' },
  { id: 'tbl-3', name: 'ZK Private Table', bigBlind: 500,  smallBlind: 250,  maxBuyIn: 50000, rake: 50, players: 1, maxPlayers: 6, phase: 'waiting' },
  { id: 'tbl-4', name: 'Micro Stakes',     bigBlind: 10,   smallBlind: 5,    maxBuyIn: 1000,  rake: 50, players: 2, maxPlayers: 6, phase: 'playing' },
];

const DEMO_PLAYERS = [
  { name: 'NightOwl', emoji: '🦉', stack: 4200, seat: 0 },
  { name: 'ShadowAce', emoji: '🃏', stack: 8800, seat: 1 },
  { name: 'ZKMaster',  emoji: '🔮', stack: 3100, seat: 2 },
  { name: 'You',       emoji: '🌙', stack: 5000, seat: 3, isYou: true },
  { name: 'CryptoKid', emoji: '⚡', stack: 2700, seat: 4 },
];

// ── Game state ────────────────────────────────────────────────
let state = {
  view: 'lobby',          // 'lobby' | 'table'
  wallet: { connected: false, address: null, demo: false, night: 0, dust: 0 },
  table: null,
  hand: {
    phase: 'waiting',     // waiting|shuffle|preflop|flop|turn|river|showdown|complete
    pot: 0,
    currentBet: 0,
    communityCards: [null,null,null,null,null],
    players: [],          // { seat, name, emoji, stack, bet, action, folded, allin, cards, isYou }
    dealer: 0,
    activePlayer: -1,
    myHoleCards: [null, null],
    myKey: null,
    handNum: 0,
    winner: null,
  },
  timer: 30,
  timerInterval: null,
};

// ── Navigation ────────────────────────────────────────────────
function showView(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + name);
  if (el) el.classList.add('active');
  state.view = name;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const wrap = document.getElementById('toast-wrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ── Lobby ─────────────────────────────────────────────────────
function renderLobby() {
  const grid = document.getElementById('tables-grid');
  if (!grid) return;
  grid.innerHTML = DEMO_TABLES.map(t => `
    <div class="table-card" onclick="joinTable('${t.id}')">
      <div class="tc-name">${t.name}</div>
      <div class="tc-blind">$${t.smallBlind}/$${t.bigBlind} · Max $${t.maxBuyIn.toLocaleString()}</div>
      <div class="tc-seats">
        ${Array.from({length: t.maxPlayers}, (_,i) =>
          `<div class="tc-seat${i < t.players ? ' taken' : ''}"></div>`
        ).join('')}
      </div>
      <div class="tc-meta">
        <span>${t.players}/${t.maxPlayers} players</span>
        <span class="tc-status ${t.phase}">${t.phase}</span>
      </div>
    </div>
  `).join('');
}

// ── Join table ────────────────────────────────────────────────
function joinTable(id) {
  if (!state.wallet.connected) {
    openModal('ov-wallet');
    return;
  }
  const tbl = DEMO_TABLES.find(t => t.id === id);
  if (!tbl) return;
  state.table = tbl;
  initHand(tbl);
  showView('table');
  renderTable();
}

// ── Init hand (demo deal) ─────────────────────────────────────
function initHand(tbl) {
  // Generate key for this table session
  state.hand.myKey = poker_crypto.loadOrGenerateKey(tbl.id);

  // Build player list
  const players = DEMO_PLAYERS.map(p => ({
    ...p,
    bet:     0,
    action:  null,
    folded:  false,
    allin:   false,
    cards:   p.isYou ? null : ['back', 'back'], // opponents: face-down
  }));

  // Deal my hole cards (demo — in prod these come from encrypted deck)
  const myCards = dealDemoHand();
  players.find(p => p.isYou).cards = myCards;
  state.hand.myHoleCards = myCards;

  state.hand = {
    ...state.hand,
    phase:          'preflop',
    pot:            tbl.bigBlind + tbl.smallBlind,
    currentBet:     tbl.bigBlind,
    communityCards: [null, null, null, null, null],
    players,
    dealer:         0,
    activePlayer:   3, // you go first in this demo
    handNum:        state.hand.handNum + 1,
    winner:         null,
  };

  // Post blinds
  state.hand.players[1].bet    = tbl.smallBlind;
  state.hand.players[1].stack -= tbl.smallBlind;
  state.hand.players[2].bet    = tbl.bigBlind;
  state.hand.players[2].stack -= tbl.bigBlind;

  startTimer();
}

function dealDemoHand() {
  // Deal a random 2-card hand for demo
  const deck = Array.from({length:52}, (_,i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return [deck[0], deck[1]];
}

function dealDemoCommunity(count) {
  const used = new Set(state.hand.myHoleCards);
  state.hand.players.forEach(p => {
    if (Array.isArray(p.cards) && typeof p.cards[0] === 'number') {
      p.cards.forEach(c => used.add(c));
    }
  });
  const avail = Array.from({length:52}, (_,i) => i).filter(c => !used.has(c));
  // shuffle available
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  return avail.slice(0, count);
}

// ── Player actions ────────────────────────────────────────────
function doAction(action, raiseAmt) {
  const me = state.hand.players.find(p => p.isYou);
  if (!me || state.hand.activePlayer !== me.seat) return;

  stopTimer();

  if (action === 'fold') {
    me.folded = true; me.action = 'fold';
    toast('You folded', 'info');
  } else if (action === 'check') {
    me.action = 'check';
    toast('You checked', 'info');
  } else if (action === 'call') {
    const toCall = state.hand.currentBet - me.bet;
    const actual = Math.min(toCall, me.stack);
    me.stack -= actual; me.bet += actual; state.hand.pot += actual;
    me.action = 'call';
    toast(`You called $${actual.toLocaleString()}`, 'info');
  } else if (action === 'raise') {
    const toRaise = raiseAmt - me.bet;
    if (toRaise > me.stack) { toast('Not enough chips','error'); return; }
    me.stack -= toRaise; me.bet += toRaise; state.hand.pot += toRaise;
    state.hand.currentBet = raiseAmt;
    me.action = 'raise';
    toast(`You raised to $${raiseAmt.toLocaleString()}`, 'success');
  } else if (action === 'allin') {
    state.hand.pot += me.stack;
    me.bet += me.stack; me.stack = 0;
    if (me.bet > state.hand.currentBet) state.hand.currentBet = me.bet;
    me.allin = true; me.action = 'allin';
    toast('All-in! 🔥', 'success');
  }

  // Advance phase after your action (simplified demo)
  setTimeout(() => runOpponentActions(), 800);
}

function runOpponentActions() {
  // Simple opponent AI for demo
  const activePlayers = state.hand.players.filter(p => !p.isYou && !p.folded);
  let i = 0;
  const tick = () => {
    if (i >= activePlayers.length) { advanceStreet(); return; }
    const opp = activePlayers[i++];
    const rand = Math.random();
    if (rand < 0.15) {
      opp.folded = true; opp.action = 'fold';
    } else if (rand < 0.6) {
      opp.action = 'call';
      const toCall = Math.min(state.hand.currentBet - opp.bet, opp.stack);
      opp.stack -= toCall; opp.bet += toCall; state.hand.pot += toCall;
    } else {
      opp.action = 'check';
    }
    renderTable();
    setTimeout(tick, 600);
  };
  tick();
}

function advanceStreet() {
  const phase = state.hand.phase;
  const active = state.hand.players.filter(p => !p.folded);

  // Reset bets
  state.hand.players.forEach(p => { p.bet = 0; p.action = null; });
  state.hand.currentBet = 0;

  if (active.length === 1) {
    // Everyone else folded — winner
    endHand(active[0]);
    return;
  }

  if (phase === 'preflop') {
    const cards = dealDemoCommunity(3);
    state.hand.communityCards[0] = cards[0];
    state.hand.communityCards[1] = cards[1];
    state.hand.communityCards[2] = cards[2];
    state.hand.phase = 'flop';
    toast('🃏 Flop revealed', 'info');
  } else if (phase === 'flop') {
    state.hand.communityCards[3] = dealDemoCommunity(1)[0];
    state.hand.phase = 'turn';
    toast('🃏 Turn revealed', 'info');
  } else if (phase === 'turn') {
    state.hand.communityCards[4] = dealDemoCommunity(1)[0];
    state.hand.phase = 'river';
    toast('🃏 River revealed', 'info');
  } else if (phase === 'river') {
    state.hand.phase = 'showdown';
    runShowdown();
    return;
  }

  state.hand.activePlayer = state.hand.players.find(p => !p.folded && !p.allin)?.seat ?? -1;
  renderTable();
  startTimer();
}

function runShowdown() {
  // Reveal opponent hole cards
  state.hand.players.forEach(p => {
    if (!p.isYou && !p.folded && p.cards[0] === 'back') {
      // Deal random cards to opponents (in prod: ZK reveal from chain)
      const used = new Set(state.hand.myHoleCards);
      state.hand.communityCards.filter(Boolean).forEach(c => used.add(c));
      const avail = Array.from({length:52}, (_,i)=>i).filter(c => !used.has(c));
      for (let i = avail.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1)); [avail[i],avail[j]]=[avail[j],avail[i]];
      }
      p.cards = [avail[0], avail[1]];
      used.add(avail[0]); used.add(avail[1]);
    }
  });

  const community = state.hand.communityCards.filter(Boolean);
  const contenders = state.hand.players
    .filter(p => !p.folded && Array.isArray(p.cards) && typeof p.cards[0] === 'number')
    .map(p => ({ ...p, holeCards: p.cards, communityCards: community }));

  const winners = determineWinners(contenders);
  const winner  = winners[0];
  state.hand.winner = winner;

  toast(`🏆 ${winner.name} wins with ${winner.ev.name}!`, 'success');
  endHand(winner);
}

function endHand(winner) {
  winner.stack += state.hand.pot;
  state.hand.pot = 0;
  state.hand.phase = 'complete';
  renderTable();

  // New hand after 4s
  setTimeout(() => {
    if (state.view === 'table') {
      initHand(state.table);
      renderTable();
    }
  }, 4000);
}

// ── Timer ─────────────────────────────────────────────────────
function startTimer() {
  state.timer = 30;
  stopTimer();
  updateTimerBar();
  state.timerInterval = setInterval(() => {
    state.timer--;
    updateTimerBar();
    if (state.timer <= 0) {
      stopTimer();
      doAction('fold'); // auto-fold on timeout
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

function updateTimerBar() {
  const bar = document.getElementById('timer-bar');
  if (bar) bar.style.width = (state.timer / 30 * 100) + '%';
}

// ── Wallet ────────────────────────────────────────────────────
function connectDemo() {
  state.wallet = {
    connected: true,
    demo: true,
    address: 'midnight1demo…' + Math.random().toString(36).slice(2, 6),
    night: 50000,
    dust: 1000,
  };
  closeModal('ov-wallet');
  updateWalletUI();
  toast('🎭 Demo wallet connected', 'success');
}

function disconnectWallet() {
  state.wallet = { connected: false, address: null, demo: false, night: 0, dust: 0 };
  updateWalletUI();
  showView('lobby');
  toast('Wallet disconnected', 'info');
}

function updateWalletUI() {
  const btn = document.getElementById('wallet-btn');
  const dot = document.getElementById('wallet-dot');
  const lbl = document.getElementById('wallet-label');
  if (!btn) return;
  if (state.wallet.connected) {
    dot.style.background = '#00d68f';
    lbl.textContent = state.wallet.demo ? '🎭 Demo' : state.wallet.address.slice(0,10) + '…';
  } else {
    dot.style.background = '#ef4444';
    lbl.textContent = 'Sign in';
  }
}

// ── Modals ────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('open'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

function openCreateTable() {
  if (!state.wallet.connected) { openModal('ov-wallet'); return; }
  openModal('ov-create');
}

function submitCreateTable() {
  const name     = document.getElementById('ct-name').value.trim();
  const bigBlind = parseInt(document.getElementById('ct-bb').value);
  const maxBuyIn = parseInt(document.getElementById('ct-buyin').value);
  if (!name || !bigBlind || !maxBuyIn) { toast('Fill in all fields','error'); return; }

  const newTable = {
    id: 'tbl-' + Date.now(),
    name, bigBlind, smallBlind: Math.floor(bigBlind / 2),
    maxBuyIn, rake: 50, players: 1, maxPlayers: 6, phase: 'waiting',
  };
  DEMO_TABLES.unshift(newTable);
  closeModal('ov-create');
  renderLobby();
  toast(`✓ Table "${name}" created`, 'success');
}

// ── Render table ──────────────────────────────────────────────
function renderTable() {
  renderTopbar();
  renderSeats();
  renderCommunityCards();
  renderActionBar();
}

function renderTopbar() {
  const t = state.table;
  const h = state.hand;
  setEl('tb-name',   t.name);
  setEl('tb-blind',  `$${t.smallBlind}/$${t.bigBlind} NL`);
  setEl('tb-pot',    `Pot: $${h.pot.toLocaleString()}`);
  setEl('tb-phase',  h.phase.toUpperCase());
  setEl('tb-hand',   `Hand #${h.handNum}`);
}

function renderSeats() {
  const h = state.hand;
  for (let i = 0; i < 6; i++) {
    const p = h.players.find(pl => pl.seat === i);
    const wrap = document.getElementById(`seat-${i}`);
    if (!wrap) continue;

    if (!p) {
      wrap.className = 'seat seat-empty';
      wrap.innerHTML = `
        <div class="seat-avatar" onclick="openModal('ov-wallet')" title="Take seat">+</div>
        <div class="seat-name" style="color:var(--muted)">Empty</div>`;
      continue;
    }

    const isActive  = h.activePlayer === p.seat && h.phase !== 'complete';
    const isDealer  = h.dealer === p.seat;
    const actionCls = p.action ? `sab-${p.action}` : '';
    const actionLbl = p.action ? (p.action === 'allin' ? 'ALL-IN' : p.action.toUpperCase()) : '';

    const myCards = p.isYou
      ? p.cards?.map(c => renderCard(c)).join('') ?? ''
      : p.cards?.map(c => renderCardSm(c, c === 'back')).join('') ?? '';

    wrap.className = `seat seat-${i}`;
    wrap.innerHTML = `
      <div class="seat-cards">${myCards}</div>
      <div class="seat-avatar${isActive ? ' active' : ''}${p.folded ? ' folded' : ''}${p.isYou ? ' you' : ''}">
        ${p.emoji}
        ${isDealer ? '<div class="dealer-chip">D</div>' : ''}
      </div>
      <div class="seat-name">${p.name}${p.isYou ? ' (You)' : ''}</div>
      <div class="seat-stack">$${p.stack.toLocaleString()}</div>
      ${p.bet > 0 ? `<div class="seat-bet">Bet: $${p.bet.toLocaleString()}</div>` : ''}
      ${actionLbl ? `<div class="seat-action-badge ${actionCls}">${actionLbl}</div>` : ''}
    `;
  }
}

function renderCommunityCards() {
  const cc = document.getElementById('community-cards');
  if (!cc) return;
  const cards = state.hand.communityCards;
  cc.innerHTML = cards.map((c, i) => {
    if (i === 3 && !['turn','river','showdown','complete'].includes(state.hand.phase)) return '';
    if (i === 4 && !['river','showdown','complete'].includes(state.hand.phase)) return '';
    return renderCard(c);
  }).join('');
}

function renderActionBar() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const h   = state.hand;
  const me  = h.players.find(p => p.isYou);
  const myTurn = me && !me.folded && h.activePlayer === me.seat;
  const inProgress = ['preflop','flop','turn','river'].includes(h.phase);

  bar.classList.toggle('hidden', !myTurn || !inProgress);
  if (!myTurn || !inProgress) return;

  const toCall = Math.max(0, h.currentBet - (me.bet || 0));
  const canCheck = toCall === 0;
  const minRaise = h.currentBet * 2;

  document.getElementById('btn-check-call').textContent = canCheck ? 'Check' : `Call $${toCall.toLocaleString()}`;
  document.getElementById('btn-check-call').onclick = () => doAction(canCheck ? 'check' : 'call');

  const slider = document.getElementById('raise-slider');
  if (slider) {
    slider.min   = minRaise;
    slider.max   = me.stack;
    slider.value = Math.min(minRaise * 2, me.stack);
    updateRaiseVal();
  }
}

function updateRaiseVal() {
  const slider = document.getElementById('raise-slider');
  const val    = document.getElementById('raise-val');
  if (slider && val) val.textContent = '$' + parseInt(slider.value).toLocaleString();
}

function setPreset(multiplier) {
  const me     = state.hand.players.find(p => p.isYou);
  const slider = document.getElementById('raise-slider');
  if (!me || !slider) return;
  const val = Math.min(Math.floor(state.hand.currentBet * multiplier), me.stack);
  slider.value = val;
  updateRaiseVal();
}

function doRaise() {
  const slider = document.getElementById('raise-slider');
  if (!slider) return;
  doAction('raise', parseInt(slider.value));
}

// Helper
function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderLobby();
  updateWalletUI();
});
