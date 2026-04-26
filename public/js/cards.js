// ── Card rendering ────────────────────────────────────────────
// Cards encoded 0–51
// 0–12 Clubs, 13–25 Diamonds, 26–38 Hearts, 39–51 Spades
// Within each suit: A 2 3 4 5 6 7 8 9 T J Q K (0–12)

const SUITS  = ['♣','♦','♥','♠'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const RED_SUITS = new Set([1,2]); // diamonds, hearts

function cardSuit(card)  { return Math.floor(card / 13); }
function cardRank(card)  { return card % 13; }
function cardRankStr(card){ return RANKS[cardRank(card)]; }
function cardSuitStr(card){ return SUITS[cardSuit(card)]; }
function isRedCard(card) { return RED_SUITS.has(cardSuit(card)); }

function renderCard(card, faceDown = false, size = 'md') {
  if (card === null || card === undefined || faceDown) {
    return `<div class="card card-back"></div>`;
  }
  if (card === 255) {
    return `<div class="card card-hidden" style="opacity:.3"></div>`;
  }
  const rank = cardRankStr(card);
  const suit = cardSuitStr(card);
  const red  = isRedCard(card) ? ' red' : '';
  return `<div class="card card-face${red}">
    <div class="rank">${rank}</div>
    <div class="center-suit">${suit}</div>
    <div class="suit">${suit}</div>
  </div>`;
}

function renderCardSm(card, faceDown = false) {
  if (faceDown || card === null || card === undefined) {
    return `<div class="card card-back"></div>`;
  }
  const rank = cardRankStr(card);
  const suit = cardSuitStr(card);
  const red  = isRedCard(card) ? ' red' : '';
  return `<div class="card card-face${red}">
    <div class="rank">${rank}</div>
    <div class="suit">${suit}</div>
  </div>`;
}

// ── Hand evaluator (7-card best-5 for Texas Hold'em) ─────────
// Returns { rank, name, cards } where rank: 0=high card … 8=straight flush

const HAND_NAMES = [
  'High Card','One Pair','Two Pair','Three of a Kind',
  'Straight','Flush','Full House','Four of a Kind','Straight Flush'
];

function evaluateHand(holeCards, communityCards) {
  const all = [...holeCards, ...communityCards].filter(c => c !== undefined && c !== null && c < 52);
  if (all.length < 5) return { rank: -1, name: '—', cards: [] };

  const combos = combinations(all, 5);
  let best = null;
  for (const combo of combos) {
    const ev = eval5(combo);
    if (!best || ev.rank > best.rank || (ev.rank === best.rank && ev.tiebreak > best.tiebreak)) {
      best = ev;
    }
  }
  return best;
}

function eval5(cards) {
  const ranks   = cards.map(cardRank).sort((a,b) => b - a);
  const suits   = cards.map(cardSuit);
  const isFlush = suits.every(s => s === suits[0]);
  const rankSet = [...new Set(ranks)];
  const counts  = rankSet.map(r => ({ r, n: ranks.filter(x => x === r).length }))
                         .sort((a,b) => b.n - a.n || b.r - a.r);

  // Straight detection (handle A-low: A=12 → also try as -1)
  let isStraight = false;
  let straightHigh = 0;
  const sortedR = [...new Set(ranks)].sort((a,b) => b - a);
  if (sortedR.length === 5) {
    if (sortedR[0] - sortedR[4] === 4) { isStraight = true; straightHigh = sortedR[0]; }
    // A-2-3-4-5 (wheel): A=12, 4,3,2,1,0
    if (JSON.stringify(sortedR) === JSON.stringify([12,3,2,1,0])) {
      isStraight = true; straightHigh = 3;
    }
  }

  const maxCount  = counts[0].n;
  const secCount  = counts[1]?.n || 0;
  const tiebreak  = ranks.reduce((acc, r, i) => acc + r * Math.pow(13, 4 - i), 0);

  let rank, name;
  if (isFlush && isStraight) { rank = 8; name = straightHigh === 12 ? 'Royal Flush' : 'Straight Flush'; }
  else if (maxCount === 4)   { rank = 7; name = 'Four of a Kind'; }
  else if (maxCount === 3 && secCount === 2) { rank = 6; name = 'Full House'; }
  else if (isFlush)          { rank = 5; name = 'Flush'; }
  else if (isStraight)       { rank = 4; name = 'Straight'; }
  else if (maxCount === 3)   { rank = 3; name = 'Three of a Kind'; }
  else if (maxCount === 2 && secCount === 2) { rank = 2; name = 'Two Pair'; }
  else if (maxCount === 2)   { rank = 1; name = 'One Pair'; }
  else                       { rank = 0; name = 'High Card'; }

  return { rank, name, tiebreak, cards };
}

function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...combinations(rest, k - 1).map(c => [first, ...c]),
    ...combinations(rest, k)
  ];
}

// Determine winner(s) from revealed hands
function determineWinners(players) {
  // players: [{ seat, holeCards, communityCards }]
  let bestRank = -1, bestTie = -1;
  const evaluated = players.map(p => ({
    ...p,
    ev: evaluateHand(p.holeCards, p.communityCards)
  }));
  evaluated.forEach(p => {
    if (p.ev.rank > bestRank || (p.ev.rank === bestRank && p.ev.tiebreak > bestTie)) {
      bestRank = p.ev.rank; bestTie = p.ev.tiebreak;
    }
  });
  return evaluated.filter(p => p.ev.rank === bestRank && p.ev.tiebreak === bestTie);
}
