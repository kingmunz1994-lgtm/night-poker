// ── Night Poker — Hand History & Session Stats ─────────────────

const NightHistory = (() => {
  const STORAGE_KEY = 'np_hand_history';

  let _session = {
    handsPlayed: 0,
    handsWon:    0,
    handsVPIP:   0,  // hands where you voluntarily put chips in
    biggestPot:  0,
  };

  function _load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function _save(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-20)));
  }

  function _cardStr(idx) {
    if (typeof idx !== 'number') return '?';
    return cardRankStr(idx) + cardSuitStr(idx);
  }

  function _setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return {
    addHand({ handNum, holeCards, communityCards, pot, won, action, handRank, myKey, commitment }) {
      const history = _load();
      history.push({
        ts:             Date.now(),
        handNum:        handNum || 0,
        holeCards:      holeCards || [],
        communityCards: (communityCards || []).filter(c => c !== null),
        pot:            pot || 0,
        won:            !!won,
        action:         action || null,
        handRank:       handRank || null,
        myKey:          myKey ? Array.from(myKey).map(b => b.toString(16).padStart(2,'0')).join('') : null,
        commitment:     commitment || null,
      });
      _save(history);

      _session.handsPlayed++;
      if (won) _session.handsWon++;
      if (action && action !== 'fold') _session.handsVPIP++;
      if ((pot || 0) > _session.biggestPot) _session.biggestPot = pot || 0;

      this.renderSessionStats();
    },

    getSession() { return { ..._session }; },
    getHistory()  { return _load(); },

    renderSessionStats() {
      const s       = _session;
      const vpip    = s.handsPlayed > 0 ? Math.round(s.handsVPIP / s.handsPlayed * 100) : 0;
      const winRate = s.handsPlayed > 0 ? Math.round(s.handsWon  / s.handsPlayed * 100) : 0;
      _setEl('ss-hands',   s.handsPlayed);
      _setEl('ss-winrate', winRate + '%');
      _setEl('ss-vpip',    vpip + '%');
      _setEl('ss-bigpot',  '$' + s.biggestPot.toLocaleString());
    },

    renderHistoryModal() {
      const history = _load().slice().reverse();
      const el = document.getElementById('hist-list');
      if (!el) return;

      if (history.length === 0) {
        el.innerHTML = '<div style="color:var(--muted);text-align:center;padding:32px;font-size:13px;">No hands played yet — play a hand to see history here.</div>';
        return;
      }

      el.innerHTML = history.map(h => {
        const cards   = h.holeCards.length ? h.holeCards.map(_cardStr).join(' ') : '??';
        const result  = h.won ? 'Won' : 'Lost';
        const color   = h.won ? '#00d68f' : '#ef4444';
        const timeStr = new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const rank    = h.handRank || (h.action === 'fold' ? 'Folded' : '—');
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--raised);border:1px solid var(--rim);border-radius:10px;margin-bottom:5px;font-size:12px;">
          <span style="font-family:var(--mono);color:var(--muted);min-width:38px;">#${h.handNum}</span>
          <span style="min-width:64px;font-family:var(--mono);font-weight:700;">${cards}</span>
          <span style="flex:1;color:var(--text2);">${rank}</span>
          <span style="color:var(--muted);">$${(h.pot || 0).toLocaleString()}</span>
          <span style="font-weight:700;color:${color};min-width:32px;">${result}</span>
          <span style="color:var(--muted);font-size:10px;">${timeStr}</span>
        </div>`;
      }).join('');
    },

    openFairPanel() {
      const h = window.state?.hand;
      if (!h) return;
      const keyHex = h.myKey
        ? Array.from(h.myKey).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32)
        : '—';
      const cards = (h.myHoleCards || []).filter(c => typeof c === 'number').map(_cardStr).join(' ') || '—';
      _setEl('fp-hand',   `Hand #${h.handNum}`);
      _setEl('fp-key',    `0x${keyHex}…`);
      _setEl('fp-commit', h.myCommitment ? `0x${h.myCommitment}…` : '—');
      _setEl('fp-cards',  cards);
      document.getElementById('ov-fair')?.classList.add('open');
    },
  };
})();
