// ── Night Poker — Game State & Logic ─────────────────────────

const REBUY_AMOUNT = 5000;

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

// Stacks persist across hands within a session
const playerStacks = {};
DEMO_PLAYERS.forEach(p => { playerStacks[p.seat] = p.stack; });

let state = {
  view: 'lobby',
  quickDeal: false,
  wallet: { connected: false, address: null, demo: false, night: 0, dust: 0 },
  table: null,
  hand: {
    phase: 'waiting',
    pot: 0,
    currentBet: 0,
    bigBlind: 0,
    communityCards: [null, null, null, null, null],
    players: [],
    dealerSeat: 4,   // rotates before each hand; first hand dealer=0
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
  if (name === 'lobby') { state.quickDeal = false; updateQdBadge(); }
}

function updateQdBadge() {
  const badge = document.getElementById('qd-badge');
  if (badge) badge.style.display = state.quickDeal ? 'flex' : 'none';
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

// ── Quick Deal ────────────────────────────────────────────────
function joinQuickDeal() {
  if (!state.wallet.connected) {
    state.wallet = { connected: true, demo: true, address: 'midnight1demo', night: 50000, dust: 1000 };
    updateWalletUI();
    toast('🎭 Demo wallet connected', 'success');
  }
  state.quickDeal = true;
  state.table = DEMO_TABLES[0];
  DEMO_PLAYERS.forEach(p => { playerStacks[p.seat] = p.stack; });
  showView('table');
  updateQdBadge();
  startHand(state.table);
}

// ── Join table ────────────────────────────────────────────────
function joinTable(id) {
  if (!state.wallet.connected) { openModal('ov-wallet'); return; }
  const tbl = DEMO_TABLES.find(t => t.id === id);
  if (!tbl) return;
  state.table = tbl;
  DEMO_PLAYERS.forEach(p => { playerStacks[p.seat] = p.stack; });
  showView('table');
  updateScoreStrip();
  startHand(tbl);
}

// ── ZK shuffle + deal ─────────────────────────────────────────
async function startHand(tbl) {
  const bb = tbl.bigBlind;
  const sb = tbl.smallBlind;

  // Rotate dealer
  const prevIdx   = DEMO_PLAYERS.findIndex(p => p.seat === state.hand.dealerSeat);
  const nextIdx   = (prevIdx + 1) % DEMO_PLAYERS.length;
  const dealerSeat = DEMO_PLAYERS[nextIdx].seat;
  const sbSeat    = DEMO_PLAYERS[(nextIdx + 1) % DEMO_PLAYERS.length].seat;
  const bbSeat    = DEMO_PLAYERS[(nextIdx + 2) % DEMO_PLAYERS.length].seat;

  // Auto-rebuy any player whose stack is too small to post the blind
  DEMO_PLAYERS.forEach(p => {
    if ((playerStacks[p.seat] ?? 0) < bb * 2) {
      playerStacks[p.seat] = REBUY_AMOUNT;
    }
  });

  state.hand = {
    ...state.hand,
    phase: 'shuffle',
    pot: 0,
    currentBet: bb,
    bigBlind: bb,
    communityCards: [null, null, null, null, null],
    players: DEMO_PLAYERS.map(p => ({
      ...p,
      stack: playerStacks[p.seat],
      bet: 0, action: null, folded: false, allin: false,
      cards: p.isYou ? null : ['back', 'back'],
    })),
    dealerSeat,
    activePlayer: 3,
    myHoleCards: [null, null],
    myCommitment: null,
    handNum: state.hand.handNum + 1,
    winner: null,
    zkProofVerified: false,
  };

  // Post blinds to correct seats
  const sbPlayer = state.hand.players.find(p => p.seat === sbSeat);
  const bbPlayer = state.hand.players.find(p => p.seat === bbSeat);
  if (sbPlayer) {
    const amt = Math.min(sb, sbPlayer.stack);
    sbPlayer.bet = amt; sbPlayer.stack -= amt;
    if (sbPlayer.stack === 0) sbPlayer.allin = true;
  }
  if (bbPlayer) {
    const amt = Math.min(bb, bbPlayer.stack);
    bbPlayer.bet = amt; bbPlayer.stack -= amt;
    if (bbPlayer.stack === 0) bbPlayer.allin = true;
  }
  state.hand.pot = (sbPlayer?.bet ?? 0) + (bbPlayer?.bet ?? 0);

  renderTable();

  // Step 1: XOR key
  state.hand.myKey = poker_crypto.loadOrGenerateKey(tbl.id);
  const keyHex = poker_crypto.toHex(state.hand.myKey);
  toast(`🔑 Your key: 0x${keyHex.slice(0, 8)}…`, 'info');
  await delay(700);

  // Step 2: Fisher-Yates shuffle
  const deck = Array.from({length: 52}, (_, i) => i);
  const shuffled = poker_crypto.shuffle(deck);
  toast('🔀 Shuffling with your ZK key…', 'info');
  await delay(600);

  // Step 3: XOR-encrypt deck
  const encDeck = poker_crypto.encryptDeck(shuffled);
  toast('🔐 Deck encrypted · committed to Midnight…', 'info');
  await delay(500);

  // Step 4: deal hole cards
  const myCards = [
    poker_crypto.decrypt(encDeck[0]),
    poker_crypto.decrypt(encDeck[1]),
  ];

  // Step 5: SHA-256 commitment
  const nonce = crypto.getRandomValues(new Uint8Array(8));
  const commitHash = await poker_crypto.hashCommit(myCards[0], [...nonce]);
  state.hand.myCommitment = poker_crypto.toHex(commitHash).slice(0, 16);
  toast(`✓ Committed: 0x${state.hand.myCommitment}…`, 'success');
  await delay(400);

  state.hand.myHoleCards = myCards;
  state.hand.players.find(p => p.isYou).cards = myCards;
  state.hand.phase = 'preflop';
  state.hand.activePlayer = state.quickDeal ? -1 : 3;

  renderTable();
  if (state.quickDeal) {
    toast('⚡ Quick Deal — watch the ZK magic unfold…', 'info');
    setTimeout(() => advanceStreet(), 2400);
  } else {
    startTimer();
  }
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
    if (me.stack === 0) { me.allin = true; me.action = 'allin'; toast(`You called $${toCall.toLocaleString()} · All-in!`, 'info'); }
    else                { me.action = 'call'; toast(`You called $${toCall.toLocaleString()}`, 'info'); }
  } else if (action === 'allin') {
    state.hand.pot += me.stack;
    me.bet += me.stack; me.stack = 0;
    if (me.bet > state.hand.currentBet) state.hand.currentBet = me.bet;
    me.allin = true; me.action = 'allin';
    toast('All-in! 🔥', 'success');
  }

  renderTable();
  setTimeout(() => runOpponentActions(), 800);
}

function doRaise() {
  const slider = document.getElementById('raise-slider');
  const me = state.hand.players.find(p => p.isYou);
  if (!slider || !me) return;
  const amt     = parseInt(slider.value);
  const toRaise = amt - me.bet;
  if (toRaise <= 0 || toRaise > me.stack) { toast('Not enough chips', 'error'); return; }
  stopTimer();
  me.stack -= toRaise; me.bet = amt; state.hand.pot += toRaise;
  state.hand.currentBet = amt;
  if (me.stack === 0) { me.allin = true; me.action = 'allin'; }
  else                { me.action = 'raise'; }
  toast(`You raised to $${amt.toLocaleString()}`, 'success');
  renderTable();
  setTimeout(() => runOpponentActions(), 800);
}

// ── Opponent AI ───────────────────────────────────────────────
function runOpponentActions() {
  const active = state.hand.players.filter(p => !p.isYou && !p.folded);
  let i = 0;
  const tick = () => {
    if (i >= active.length) { advanceStreet(); return; }
    const opp = active[i++];

    if (opp.allin) { renderTable(); setTimeout(tick, 300); return; }

    const toCall = Math.min(state.hand.currentBet - opp.bet, opp.stack);
    const r = Math.random();

    if (r < 0.15) {
      // Fold
      opp.folded = true; opp.action = 'fold';
    } else if (r < 0.82 || toCall === 0) {
      // Call / check
      opp.stack -= toCall; opp.bet += toCall; state.hand.pot += toCall;
      if (opp.stack === 0) { opp.allin = true; opp.action = 'allin'; }
      else { opp.action = toCall === 0 ? 'check' : 'call'; }
    } else {
      // Raise (18% chance, capped at 2× current bet or all-in)
      const maxBet  = opp.stack + opp.bet;
      const raiseTo = Math.min(Math.max(state.hand.currentBet * 2, state.hand.bigBlind * 4), maxBet);
      const toAdd   = raiseTo - opp.bet;
      if (toAdd > 0 && toAdd <= opp.stack) {
        opp.stack -= toAdd; opp.bet = raiseTo; state.hand.pot += toAdd;
        state.hand.currentBet = raiseTo;
        opp.action = 'raise';
      } else {
        opp.stack -= toCall; opp.bet += toCall; state.hand.pot += toCall;
        if (opp.stack === 0) { opp.allin = true; opp.action = 'allin'; }
        else { opp.action = toCall === 0 ? 'check' : 'call'; }
      }
    }

    renderTable();
    setTimeout(tick, 550);
  };
  tick();
}

// ── Street transitions ────────────────────────────────────────
function advanceStreet() {
  const phase  = state.hand.phase;
  const active = state.hand.players.filter(p => !p.folded);

  state.hand.players.forEach(p => { p.bet = 0; p.action = null; });
  state.hand.currentBet = 0;

  if (active.length === 1) { endHand(active[0]); return; }

  const used = new Set([...state.hand.myHoleCards, ...state.hand.communityCards.filter(c => c !== null)]);
  const freshCards = () => poker_crypto.shuffle(
    Array.from({length: 52}, (_, i) => i).filter(c => !used.has(c))
  );

  if (phase === 'preflop') {
    const c = freshCards();
    [0, 1, 2].forEach(i => { state.hand.communityCards[i] = c[i]; used.add(c[i]); });
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
    runShowdown();
    return;
  }

  if (state.quickDeal) {
    state.hand.activePlayer = -1;
    renderTable();
    setTimeout(() => advanceStreet(), 1800);
    return;
  }

  const me = state.hand.players.find(p => p.isYou);
  if (me && !me.folded && !me.allin) {
    state.hand.activePlayer = me.seat;
    renderTable();
    startTimer();
  } else {
    // You've folded or are all-in — opponents play it out automatically
    state.hand.activePlayer = state.hand.players.find(p => !p.folded && !p.allin)?.seat ?? -1;
    renderTable();
    setTimeout(() => runOpponentActions(), 1100);
  }
}

// ── Showdown ──────────────────────────────────────────────────
async function runShowdown() {
  toast('🔓 Verifying ZK commitments…', 'info');
  await delay(900);

  // Reveal opponent hole cards from remaining deck
  const used = new Set([...state.hand.myHoleCards, ...state.hand.communityCards.filter(c => c !== null)]);
  state.hand.players.forEach(p => {
    if (!p.isYou && !p.folded && p.cards[0] === 'back') {
      const avail = poker_crypto.shuffle(Array.from({length: 52}, (_, i) => i).filter(c => !used.has(c)));
      p.cards = [avail[0], avail[1]];
      used.add(avail[0]); used.add(avail[1]);
    }
  });

  state.hand.zkProofVerified = true;
  toast('✓ All commitments verified on Midnight', 'success');
  await delay(600);

  const community  = state.hand.communityCards.filter(c => c !== null);
  const contenders = state.hand.players
    .filter(p => !p.folded && Array.isArray(p.cards) && typeof p.cards[0] === 'number')
    .map(p => ({ ...p, holeCards: p.cards, communityCards: community }));

  const winners = determineWinners(contenders);
  const winner  = winners[0];
  state.hand.winner = winner;

  renderTable();

  const potAmt = state.hand.pot;
  if (winners.length > 1) {
    toast(`🤝 Split pot! ${winners.map(w => w.name).join(' & ')} chop $${potAmt.toLocaleString()} with ${winner.ev.name}`, 'success');
  } else {
    toast(`🏆 ${winner.name} wins $${potAmt.toLocaleString()} with ${winner.ev.name}!`, 'success');
  }

  await delay(600);

  // Award each winner their share
  const share = Math.floor(potAmt / winners.length);
  winners.forEach(w => {
    const p = state.hand.players.find(pl => pl.seat === w.seat);
    if (p) p.stack += share;
  });
  state.hand.pot = 0;

  endHand();
}

function endHand(walkoverWinner) {
  if (walkoverWinner) {
    walkoverWinner.stack += state.hand.pot;
    state.hand.pot = 0;
    toast(`🏆 ${walkoverWinner.name} wins!`, 'success');
  }

  // Award Night Score
  const me = state.hand.players.find(p => p.isYou);
  const youWon = walkoverWinner?.isYou || state.hand.winner?.isYou;
  if (me) awardHandScore(youWon);

  // Persist stacks for next hand
  state.hand.players.forEach(p => { playerStacks[p.seat] = p.stack; });

  state.hand.phase = 'complete';
  renderTable();
  setTimeout(() => { if (state.view === 'table') startHand(state.table); }, 3800);
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
  stopTimer();
  toast('Wallet disconnected', 'info');
}

function updateWalletUI() {
  const dot = document.getElementById('wallet-dot');
  const lbl = document.getElementById('wallet-label');
  if (!dot || !lbl) return;
  if (state.wallet.connected) {
    dot.style.background = '#00d68f';
    lbl.textContent = state.wallet.demo ? '🎭 Demo' : state.wallet.address.slice(0, 12) + '…';
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
  if (!name || !bigBlind || !maxBuyIn) { toast('Fill in all fields', 'error'); return; }
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
    const p   = h.players.find(pl => pl.seat === i);
    const wrap = document.getElementById(`seat-${i}`);
    if (!wrap) continue;

    if (!p) {
      wrap.className = 'seat seat-empty';
      wrap.innerHTML = `<div class="seat-avatar" style="cursor:pointer" onclick="openModal('ov-wallet')">+</div><div class="seat-name" style="color:var(--muted)">Empty</div>`;
      continue;
    }

    const isActive = h.activePlayer === p.seat && ['preflop', 'flop', 'turn', 'river'].includes(h.phase);
    const isDealer = h.dealerSeat === p.seat;
    const isWinner = h.winner?.seat === p.seat || (h.phase === 'complete' && h.winner?.seat === p.seat);
    const actionLbl = p.action ? (p.action === 'allin' ? 'ALL-IN' : p.action.toUpperCase()) : '';

    let cardHtml = '';
    if (p.isYou && Array.isArray(p.cards) && typeof p.cards[0] === 'number') {
      cardHtml = p.cards.map(c => renderCard(c)).join('');
    } else if (Array.isArray(p.cards)) {
      cardHtml = p.cards.map(c => renderCardSm(c, c === 'back')).join('');
    }

    const zkBadge    = h.zkProofVerified && !p.isYou && !p.folded ? `<div class="zk-proof-badge">✓ ZK</div>` : '';
    const commitHtml = p.isYou && h.myCommitment ? `<div class="commit-hash">0x${h.myCommitment}…</div>` : '';
    const winnerGlow  = isWinner ? ' style="box-shadow:0 0 22px #fbbf24,0 0 6px #fbbf24;"' : '';

    wrap.className = `seat seat-${i}${p.folded ? ' seat-folded' : ''}`;
    wrap.innerHTML = `
      <div class="seat-cards">${cardHtml}${zkBadge}</div>
      ${commitHtml}
      <div class="seat-avatar${isActive ? ' active' : ''}${p.folded ? ' folded' : ''}${p.isYou ? ' you' : ''}"${winnerGlow}>
        ${p.emoji}${isDealer ? '<div class="dealer-chip">D</div>' : ''}
      </div>
      <div class="seat-name">${p.name}${p.isYou ? ' (You)' : ''}</div>
      <div class="seat-stack">$${p.stack.toLocaleString()}</div>
      ${p.bet > 0 ? `<div class="seat-bet">Bet: $${p.bet.toLocaleString()}</div>` : ''}
      ${actionLbl ? `<div class="seat-action-badge sab-${p.action}">${actionLbl}</div>` : ''}
    `;
  }
}

function renderCommunityCards() {
  const cc = document.getElementById('community-cards');
  if (!cc) return;
  const h = state.hand;
  const showFlop  = ['flop', 'turn', 'river', 'showdown', 'complete'].includes(h.phase);
  const showTurn  = ['turn', 'river', 'showdown', 'complete'].includes(h.phase);
  const showRiver = ['river', 'showdown', 'complete'].includes(h.phase);
  cc.innerHTML = h.communityCards.map((c, i) => {
    if (i < 3 && !showFlop)   return '';
    if (i === 3 && !showTurn)  return '';
    if (i === 4 && !showRiver) return '';
    return renderCard(c);
  }).join('');
}

function renderActionBar() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const h  = state.hand;
  const me = h.players.find(p => p.isYou);
  const myTurn = me && !me.folded && !me.allin && h.activePlayer === me.seat;
  const inPlay = ['preflop', 'flop', 'turn', 'river'].includes(h.phase);
  bar.classList.toggle('hidden', !myTurn || !inPlay);
  if (!myTurn || !inPlay) return;

  const toCall   = Math.max(0, h.currentBet - (me.bet || 0));
  const canCheck = toCall === 0;
  const maxBet   = me.stack + (me.bet || 0);
  const minRaise = Math.min(Math.max(h.currentBet * 2, h.bigBlind * 2), maxBet);

  const ccBtn = document.getElementById('btn-check-call');
  if (ccBtn) {
    ccBtn.textContent = canCheck ? 'Check' : `Call $${toCall.toLocaleString()}`;
    ccBtn.onclick = () => doAction(canCheck ? 'check' : 'call');
  }

  const slider = document.getElementById('raise-slider');
  if (slider) {
    slider.min   = minRaise;
    slider.max   = maxBet;
    if (parseInt(slider.value) < minRaise || parseInt(slider.value) > maxBet) {
      slider.value = Math.min(minRaise * 2, maxBet);
    }
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
  const maxBet = me.stack + (me.bet || 0);
  const target = multiplier >= 100
    ? maxBet
    : Math.min(Math.floor(state.hand.currentBet * multiplier), maxBet);
  slider.value = Math.max(parseInt(slider.min), target);
  updateRaiseVal();
}

// ── Night Score ───────────────────────────────────────────────
function loadNightScore() {
  try { return JSON.parse(localStorage.getItem('night_score') || '{"score":0,"hands":0,"zk":0,"tokens":0}'); }
  catch { return { score: 0, hands: 0, zk: 0, tokens: 0 }; }
}

function saveNightScore(ns) {
  localStorage.setItem('night_score', JSON.stringify(ns));
}

function awardHandScore(won) {
  const ns = loadNightScore();
  ns.hands  = (ns.hands  || 0) + 1;
  ns.score  = (ns.score  || 0) + (won ? 15 : 5);
  ns.zk     = (ns.zk     || 0) + 1;
  saveNightScore(ns);
  updateScoreStrip();
}

function updateScoreStrip() {
  const ns  = loadNightScore();
  const bar = document.getElementById('ns-bar');
  const val = document.getElementById('ns-val');
  const hnd = document.getElementById('ns-hands');
  const str = document.getElementById('ns-strip');
  if (!bar) return;
  if (str) str.style.display = state.view === 'table' && state.wallet.connected ? 'flex' : 'none';
  const pct = Math.min((ns.score / 2000) * 100, 100);
  bar.style.width = pct + '%';
  if (val) val.textContent = ns.score;
  if (hnd) hnd.textContent = ns.hands + ' hands';
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderLobby();
  updateWalletUI();
  updateScoreStrip();
});
