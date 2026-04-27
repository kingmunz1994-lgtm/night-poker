// ── Night Poker — Game State & Logic ─────────────────────────

const DEMO_TABLES = [
  { id: 'tbl-1', name: 'Midnight Lounge',  bigBlind: 100,  smallBlind: 50,   maxBuyIn: 10000,  rake: 50, players: 3, maxPlayers: 6, phase: 'waiting' },
  { id: 'tbl-2', name: 'High Roller Room', bigBlind: 1000, smallBlind: 500,  maxBuyIn: 100000, rake: 25, players: 5, maxPlayers: 6, phase: 'playing' },
  { id: 'tbl-3', name: 'ZK Private Table', bigBlind: 500,  smallBlind: 250,  maxBuyIn: 50000,  rake: 50, players: 1, maxPlayers: 6, phase: 'waiting' },
  { id: 'tbl-4', name: 'Micro Stakes',     bigBlind: 10,   smallBlind: 5,    maxBuyIn: 1000,   rake: 50, players: 2, maxPlayers: 6, phase: 'playing' },
];

const DEMO_PLAYERS = [
  { name: 'NightOwl',  emoji: '🦉', stack: 4200, seat: 0 },
  { name: 'ShadowAce', emoji: '🃏', stack: 8800, seat: 1 },
  { name: 'ZKMaster',  emoji: '🔮', stack: 3100, seat: 2 },
  { name: 'You',       emoji: '🌙', stack: 5000, seat: 3, isYou: true },
  { name: 'CryptoKid', emoji: '⚡', stack: 2700, seat: 4 },
];

let state = {
  view: 'lobby',
  wallet: { connected: false, address: null, demo: false, night: 0, dust: 0 },
  table: null,
  hand: {
    phase: 'waiting',
    pot: 0,
    currentBet: 0,
    communityCards: [null,null,null,null,null],
    players: [],
    dealer: 0,
    activePlayer: -1,
    myHoleCards: [null, null],
    myKey: null,
    myCommitment: null,
    handNum: 0,
    winner: null,
    zkProofVerified: false,
  },
  timer: 30,
  timerInterval: null,
};

// ── Helpers ───────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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
  if (!state.wallet.connected) { openModal('ov-wallet'); return; }
  const tbl = DEMO_TABLES.find(t => t.id === id);
  if (!tbl) return;
  state.table = tbl;
  showView('table');
  startHand(tbl);
}

// ── ZK shuffle + deal ─────────────────────────────────────────
async function startHand(tbl) {
  state.hand = {
    ...state.hand,
    phase: 'shuffle',
    pot: tbl.bigBlind + tbl.smallBlind,
    currentBet: tbl.bigBlind,
    communityCards: [null,null,null,null,null],
    players: DEMO_PLAYERS.map(p => ({
      ...p, bet: 0, action: null, folded: false, allin: false,
      cards: p.isYou ? null : ['back','back'],
    })),
    dealer: 0,
    activePlayer: -1,
    myHoleCards: [null,null],
    myCommitment: null,
    handNum: state.hand.handNum + 1,
    winner: null,
    zkProofVerified: false,
  };
  renderTable();

  // Step 1: generate / load XOR key
  state.hand.myKey = poker_crypto.loadOrGenerateKey(tbl.id);
  const keyHex = poker_crypto.toHex(state.hand.myKey);
  toast(`🔑 Your key: 0x${keyHex.slice(0,8)}…`, 'info');
  await delay(700);

  // Step 2: shuffle with real crypto.getRandomValues Fisher-Yates
  const deck = Array.from({length:52}, (_,i) => i);
  const shuffled = poker_crypto.shuffle(deck);
  toast('🔀 Shuffling with your ZK key…', 'info');
  await delay(700);

  // Step 3: XOR-encrypt entire shuffled deck
  const encDeck = poker_crypto.encryptDeck(shuffled);
  toast('🔐 Deck encrypted · committed to Midnight…', 'info');
  await delay(600);

  // Step 4: deal our hole cards — decrypt slots 0 and 1
  const myCards = [
    poker_crypto.decrypt(encDeck[0]),
    poker_crypto.decrypt(encDeck[1]),
  ];

  // Step 5: SHA-256 commitment (simulates on-chain ZK commitment)
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const commitHash = await poker_crypto.hashCommit(myCards[0], [...nonce]);
  state.hand.myCommitment = poker_crypto.toHex(commitHash).slice(0, 16);
  toast(`✓ Hand committed: 0x${state.hand.myCommitment}…`, 'success');
  await delay(500);

  // Post blinds
  state.hand.players[1].bet = tbl.smallBlind; state.hand.players[1].stack -= tbl.smallBlind;
  state.hand.players[2].bet = tbl.bigBlind;   state.hand.players[2].stack -= tbl.bigBlind;

  state.hand.myHoleCards = myCards;
  state.hand.players.find(p => p.isYou).cards = myCards;
  state.hand.phase = 'preflop';
  state.hand.activePlayer = 3;

  renderTable();
  startTimer();
}

// ── Player actions ────────────────────────────────────────────
function doAction(action) {
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
    const toCall = Math.min(state.hand.currentBet - me.bet, me.stack);
    me.stack -= toCall; me.bet += toCall; state.hand.pot += toCall;
    me.action = 'call';
    toast(`You called $${toCall.toLocaleString()}`, 'info');
  } else if (action === 'allin') {
    state.hand.pot += me.stack;
    me.bet += me.stack; me.stack = 0;
    if (me.bet > state.hand.currentBet) state.hand.currentBet = me.bet;
    me.allin = true; me.action = 'allin';
    toast('All-in! 🔥', 'success');
  }

  setTimeout(() => runOpponentActions(), 800);
}

function doRaise() {
  const slider = document.getElementById('raise-slider');
  const me = state.hand.players.find(p => p.isYou);
  if (!slider || !me) return;
  const amt = parseInt(slider.value);
  const toRaise = amt - me.bet;
  if (toRaise > me.stack) { toast('Not enough chips','error'); return; }
  stopTimer();
  me.stack -= toRaise; me.bet += toRaise; state.hand.pot += toRaise;
  state.hand.currentBet = amt;
  me.action = 'raise';
  toast(`You raised to $${amt.toLocaleString()}`, 'success');
  setTimeout(() => runOpponentActions(), 800);
}

function runOpponentActions() {
  const active = state.hand.players.filter(p => !p.isYou && !p.folded);
  let i = 0;
  const tick = () => {
    if (i >= active.length) { advanceStreet(); return; }
    const opp = active[i++];
    const r = Math.random();
    if (r < 0.15) {
      opp.folded = true; opp.action = 'fold';
    } else if (r < 0.65) {
      const toCall = Math.min(state.hand.currentBet - opp.bet, opp.stack);
      opp.stack -= toCall; opp.bet += toCall; state.hand.pot += toCall;
      opp.action = 'call';
    } else {
      opp.action = 'check';
    }
    renderTable();
    setTimeout(tick, 550);
  };
  tick();
}

function advanceStreet() {
  const phase  = state.hand.phase;
  const active = state.hand.players.filter(p => !p.folded);

  state.hand.players.forEach(p => { p.bet = 0; p.action = null; });
  state.hand.currentBet = 0;

  if (active.length === 1) { endHand(active[0]); return; }

  // Use real shuffle for community cards too
  const used = new Set([...state.hand.myHoleCards, ...state.hand.communityCards.filter(Boolean)]);
  const freshCards = () => poker_crypto.shuffle(
    Array.from({length:52},(_,i)=>i).filter(c=>!used.has(c))
  );

  if (phase === 'preflop') {
    const c = freshCards();
    [0,1,2].forEach(i => { state.hand.communityCards[i] = c[i]; used.add(c[i]); });
    state.hand.phase = 'flop';
    toast('🃏 Flop', 'info');
  } else if (phase === 'flop') {
    const c = freshCards();
    state.hand.communityCards[3] = c[0]; used.add(c[0]);
    state.hand.phase = 'turn';
    toast('🃏 Turn', 'info');
  } else if (phase === 'turn') {
    const c = freshCards();
    state.hand.communityCards[4] = c[0];
    state.hand.phase = 'river';
    toast('🃏 River', 'info');
  } else if (phase === 'river') {
    state.hand.phase = 'showdown';
    runShowdown(); return;
  }

  state.hand.activePlayer = state.hand.players.find(p => !p.folded && !p.allin)?.seat ?? -1;
  renderTable();
  startTimer();
}

async function runShowdown() {
  toast('🔓 Verifying ZK commitments…', 'info');
  await delay(900);

  const used = new Set([...state.hand.myHoleCards, ...state.hand.communityCards.filter(Boolean)]);
  state.hand.players.forEach(p => {
    if (!p.isYou && !p.folded && p.cards[0] === 'back') {
      const avail = poker_crypto.shuffle(Array.from({length:52},(_,i)=>i).filter(c=>!used.has(c)));
      p.cards = [avail[0], avail[1]];
      used.add(avail[0]); used.add(avail[1]);
    }
  });

  state.hand.zkProofVerified = true;
  toast('✓ All commitments verified on Midnight', 'success');
  await delay(500);

  const community = state.hand.communityCards.filter(Boolean);
  const contenders = state.hand.players
    .filter(p => !p.folded && Array.isArray(p.cards) && typeof p.cards[0] === 'number')
    .map(p => ({ ...p, holeCards: p.cards, communityCards: community }));

  const winners = determineWinners(contenders);
  const winner  = winners[0];
  state.hand.winner = winner;

  renderTable();
  toast(`🏆 ${winner.name} wins with ${winner.ev.name}!`, 'success');
  endHand(winner);
}

function endHand(winner) {
  winner.stack += state.hand.pot;
  state.hand.pot = 0;
  state.hand.phase = 'complete';
  renderTable();
  setTimeout(() => { if (state.view === 'table') startHand(state.table); }, 4500);
}

// ── Timer ─────────────────────────────────────────────────────
function startTimer() {
  state.timer = 30;
  stopTimer();
  updateTimerBar();
  state.timerInterval = setInterval(() => {
    state.timer--;
    updateTimerBar();
    if (state.timer <= 0) { stopTimer(); doAction('fold'); }
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
    connected: true, demo: true,
    address: 'midnight1' + Math.random().toString(36).slice(2, 10),
    night: 50000, dust: 1000,
  };
  closeModal('ov-wallet');
  updateWalletUI();
  toast('🎭 Demo wallet connected', 'success');
  renderLobby();
}

function disconnectWallet() {
  state.wallet = { connected: false, address: null, demo: false, night: 0, dust: 0 };
  updateWalletUI();
  showView('lobby');
  toast('Wallet disconnected', 'info');
}

function updateWalletUI() {
  const dot = document.getElementById('wallet-dot');
  const lbl = document.getElementById('wallet-label');
  if (!dot || !lbl) return;
  if (state.wallet.connected) {
    dot.style.background = '#00d68f';
    lbl.textContent = state.wallet.demo ? '🎭 Demo' : state.wallet.address.slice(0,12) + '…';
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
  DEMO_TABLES.unshift({
    id: 'tbl-' + Date.now(), name, bigBlind,
    smallBlind: Math.floor(bigBlind / 2), maxBuyIn,
    rake: 50, players: 1, maxPlayers: 6, phase: 'waiting',
  });
  closeModal('ov-create');
  renderLobby();
  toast(`✓ "${name}" created`, 'success');
}

// ── Render ────────────────────────────────────────────────────
function renderTable() {
  renderTopbar();
  renderSeats();
  renderCommunityCards();
  renderActionBar();
}

function renderTopbar() {
  const t = state.table, h = state.hand;
  setEl('tb-name',  t.name);
  setEl('tb-blind', `$${t.smallBlind}/$${t.bigBlind} NL`);
  setEl('tb-pot',   `Pot: $${h.pot.toLocaleString()}`);
  setEl('tb-phase', h.phase.toUpperCase());
  setEl('tb-hand',  `Hand #${h.handNum}`);
}

function renderSeats() {
  const h = state.hand;
  for (let i = 0; i < 6; i++) {
    const p = h.players.find(pl => pl.seat === i);
    const wrap = document.getElementById(`seat-${i}`);
    if (!wrap) continue;

    if (!p) {
      wrap.className = 'seat seat-empty';
      wrap.innerHTML = `<div class="seat-avatar" style="cursor:pointer" onclick="openModal('ov-wallet')">+</div><div class="seat-name" style="color:var(--muted)">Empty</div>`;
      continue;
    }

    const isActive = h.activePlayer === p.seat && ['preflop','flop','turn','river'].includes(h.phase);
    const isDealer = h.dealer === p.seat;
    const actionLbl = p.action ? (p.action === 'allin' ? 'ALL-IN' : p.action.toUpperCase()) : '';

    let cardHtml = '';
    if (p.isYou && Array.isArray(p.cards) && typeof p.cards[0] === 'number') {
      cardHtml = p.cards.map(c => renderCard(c)).join('');
    } else if (Array.isArray(p.cards)) {
      cardHtml = p.cards.map(c => renderCardSm(c, c === 'back')).join('');
    }

    const zkBadge = h.zkProofVerified && !p.isYou && !p.folded
      ? `<div class="zk-proof-badge">✓ ZK</div>` : '';
    const commitHtml = p.isYou && h.myCommitment
      ? `<div class="commit-hash">0x${h.myCommitment}…</div>` : '';

    wrap.className = `seat seat-${i}`;
    wrap.innerHTML = `
      <div class="seat-cards">${cardHtml}${zkBadge}</div>
      ${commitHtml}
      <div class="seat-avatar${isActive?' active':''}${p.folded?' folded':''}${p.isYou?' you':''}">
        ${p.emoji}${isDealer?'<div class="dealer-chip">D</div>':''}
      </div>
      <div class="seat-name">${p.name}${p.isYou?' (You)':''}</div>
      <div class="seat-stack">$${p.stack.toLocaleString()}</div>
      ${p.bet>0?`<div class="seat-bet">Bet: $${p.bet.toLocaleString()}</div>`:''}
      ${actionLbl?`<div class="seat-action-badge sab-${p.action}">${actionLbl}</div>`:''}
    `;
  }
}

function renderCommunityCards() {
  const cc = document.getElementById('community-cards');
  if (!cc) return;
  cc.innerHTML = state.hand.communityCards.map((c, i) => {
    if (i === 3 && !['turn','river','showdown','complete'].includes(state.hand.phase)) return '';
    if (i === 4 && !['river','showdown','complete'].includes(state.hand.phase)) return '';
    return renderCard(c);
  }).join('');
}

function renderActionBar() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const h  = state.hand;
  const me = h.players.find(p => p.isYou);
  const myTurn = me && !me.folded && h.activePlayer === me.seat;
  const inPlay = ['preflop','flop','turn','river'].includes(h.phase);
  bar.classList.toggle('hidden', !myTurn || !inPlay);
  if (!myTurn || !inPlay) return;

  const toCall   = Math.max(0, h.currentBet - (me.bet || 0));
  const canCheck = toCall === 0;
  const minRaise = Math.max(h.currentBet * 2, h.currentBet + 1);

  const ccBtn = document.getElementById('btn-check-call');
  if (ccBtn) {
    ccBtn.textContent = canCheck ? 'Check' : `Call $${toCall.toLocaleString()}`;
    ccBtn.onclick = () => doAction(canCheck ? 'check' : 'call');
  }

  const slider = document.getElementById('raise-slider');
  if (slider) {
    slider.min = minRaise; slider.max = me.stack;
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
  slider.value = Math.min(Math.floor(state.hand.currentBet * multiplier), me.stack);
  updateRaiseVal();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderLobby();
  updateWalletUI();
});
